import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';
import { requireAuthenticated } from 'src/lib/auth-token';

import { withMediaUrls } from 'src/sections/marketplace/seller/server/product-media';
import { withPublicSystemStoreFlag } from 'src/sections/marketplace/seller/server/public-seller';
import { hasPurchasedProduct } from 'src/sections/marketplace/catalog/server/product-engagement';
import {
  canViewSellerTools,
  SELLER_TOOLS_CATEGORY,
} from 'src/sections/marketplace/seller/server/seller-tools-access';

type Context = { params: Promise<{ id: string }> };

type Relation = { id: string; name?: string };
type RelationLink = { grade_level?: Relation | Relation[] | null; tag?: Relation | Relation[] | null };
type ProductRow = {
  id: string;
  seller_id: string;
  category: string;
  subject_label: string | null;
  curriculum_id: string | null;
  media_type_id: string | null;
  price: number;
  reviews?: Array<{ rating: number }>;
  grade_levels?: RelationLink[];
  tags?: RelationLink[];
  images?: Array<{ storage_bucket: string; storage_path: string; [key: string]: unknown }>;
  seller?: unknown;
  [key: string]: unknown;
};

type Affinity = {
  categories: Map<string, number>;
  subjects: Map<string, number>;
  curricula: Map<string, number>;
  mediaTypes: Map<string, number>;
  grades: Map<string, number>;
  tags: Map<string, number>;
};

const PRODUCT_SELECT =
  'id, seller_id, title, title_en, description, description_en, short_description, short_description_en, subject_label, curriculum_id, category, media_type_id, sale_type_id, resource_type, price, list_price, currency, cover_url, status, created_at, seller:marketplace_sellers(id, display_name, display_name_en, seller_type, slug, logo_url, bio, owner_role), media_type:marketplace_media_types(id, name, delivery_mode), sale_type:marketplace_sale_types(id, name, pricing_mode), curriculum:marketplace_curricula(id,name), grade_levels:marketplace_product_grade_levels(grade_level:marketplace_grade_levels(id,name)), tags:marketplace_product_tags(tag:marketplace_tags(id,name)), images:marketplace_product_images(*), reviews:marketplace_product_reviews(rating)';

const AFFINITY_SELECT =
  'id, category, subject_label, curriculum_id, media_type_id, grade_levels:marketplace_product_grade_levels(grade_level:marketplace_grade_levels(id)), tags:marketplace_product_tags(tag:marketplace_tags(id))';

function relationIds(links: RelationLink[] | undefined, key: 'grade_level' | 'tag') {
  return new Set(
    (links ?? []).flatMap((link) => {
      const relation = link[key];
      const item = Array.isArray(relation) ? relation[0] : relation;
      return item?.id ? [item.id] : [];
    })
  );
}

function increment(map: Map<string, number>, value: unknown) {
  const key = String(value ?? '').trim();
  if (key) map.set(key, (map.get(key) ?? 0) + 1);
}

function createAffinity(rows: ProductRow[]): Affinity {
  const affinity: Affinity = {
    categories: new Map(),
    subjects: new Map(),
    curricula: new Map(),
    mediaTypes: new Map(),
    grades: new Map(),
    tags: new Map(),
  };
  rows.forEach((row) => {
    increment(affinity.categories, row.category);
    increment(affinity.subjects, row.subject_label);
    increment(affinity.curricula, row.curriculum_id);
    increment(affinity.mediaTypes, row.media_type_id);
    relationIds(row.grade_levels, 'grade_level').forEach((id) => increment(affinity.grades, id));
    relationIds(row.tags, 'tag').forEach((id) => increment(affinity.tags, id));
  });
  return affinity;
}

function affinityScore(map: Map<string, number>, key: unknown, weight: number, cap: number) {
  const value = map.get(String(key ?? '')) ?? 0;
  return Math.min(cap, value * weight);
}

function overlapCount(left: Set<string>, right: Set<string>) {
  let count = 0;
  left.forEach((value) => {
    if (right.has(value)) count += 1;
  });
  return count;
}

function hashUnit(value: string) {
  let hash = 7;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647;
  }
  return hash / 2147483647;
}

function scoreProduct(
  candidate: ProductRow,
  source: ProductRow,
  affinity: Affinity,
  purchases: number
) {
  let score = 0;
  if (candidate.category === source.category) score += 40;
  if (candidate.subject_label && candidate.subject_label === source.subject_label) score += 25;
  if (candidate.curriculum_id && candidate.curriculum_id === source.curriculum_id) score += 15;
  if (candidate.media_type_id && candidate.media_type_id === source.media_type_id) score += 10;

  const tagOverlap = overlapCount(
    relationIds(candidate.tags, 'tag'),
    relationIds(source.tags, 'tag')
  );
  const gradeOverlap = overlapCount(
    relationIds(candidate.grade_levels, 'grade_level'),
    relationIds(source.grade_levels, 'grade_level')
  );
  score += Math.min(50, tagOverlap * 25);
  score += Math.min(30, gradeOverlap * 15);

  const sourcePrice = Number(source.price || 0);
  const candidatePrice = Number(candidate.price || 0);
  if (sourcePrice === 0 && candidatePrice === 0) score += 10;
  if (sourcePrice > 0 && candidatePrice > 0) {
    const differenceRatio = Math.abs(candidatePrice - sourcePrice) / sourcePrice;
    if (differenceRatio <= 0.2) score += 10;
    else if (differenceRatio <= 0.5) score += 5;
  }

  score += affinityScore(affinity.categories, candidate.category, 8, 24);
  score += affinityScore(affinity.subjects, candidate.subject_label, 6, 18);
  score += affinityScore(affinity.curricula, candidate.curriculum_id, 4, 12);
  score += affinityScore(affinity.mediaTypes, candidate.media_type_id, 3, 9);
  relationIds(candidate.tags, 'tag').forEach((id) => {
    score += affinityScore(affinity.tags, id, 4, 12);
  });
  relationIds(candidate.grade_levels, 'grade_level').forEach((id) => {
    score += affinityScore(affinity.grades, id, 3, 9);
  });

  const ratings = (candidate.reviews ?? [])
    .map((review) => Number(review.rating))
    .filter(Number.isFinite);
  const averageRating = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : 0;
  score += Math.min(8, Math.log2(purchases + 1) * 2);
  if (averageRating >= 4) score += Math.min(6, ratings.length + 2);
  return score;
}

export async function GET(request: Request, { params }: Context) {
  const caller = requireAuthenticated(request);
  const { id } = await params;
  const { data: sourceData, error: sourceError } = await supabaseAdmin
    .from('marketplace_products')
    .select(PRODUCT_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (sourceError) return NextResponse.json({ message: sourceError.message }, { status: 500 });
  if (!sourceData) return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });

  const source = sourceData as unknown as ProductRow;
  const canAccessArchived =
    source.status === 'archived' && caller
      ? await hasPurchasedProduct(source.id, caller.sub)
      : false;
  if (source.status !== 'published' && !canAccessArchived) {
    return NextResponse.json({ message: 'ไม่พบสินค้า' }, { status: 404 });
  }

  const sellerToolsVisible = await canViewSellerTools(caller?.sub);
  let candidateQuery = supabaseAdmin
    .from('marketplace_products')
    .select(PRODUCT_SELECT)
    .eq('status', 'published')
    .neq('id', source.id)
    .neq('seller_id', source.seller_id)
    .order('created_at', { ascending: false })
    .limit(240);
  if (!sellerToolsVisible) candidateQuery = candidateQuery.neq('category', SELLER_TOOLS_CATEGORY);
  const { data: candidateData, error: candidateError } = await candidateQuery;
  if (candidateError) {
    return NextResponse.json({ message: candidateError.message }, { status: 500 });
  }
  const candidates = (candidateData ?? []) as unknown as ProductRow[];
  if (!candidates.length) return NextResponse.json({ products: [] });

  let affinityRows: ProductRow[] = [];
  if (caller) {
    const [{ data: purchased }, { data: collections }] = await Promise.all([
      supabaseAdmin
        .from('marketplace_order_items')
        .select('product_id, order:marketplace_orders!inner(status)')
        .eq('order.buyer_id', caller.sub)
        .in('order.status', ['paid', 'completed'])
        .limit(60),
      supabaseAdmin
        .from('marketplace_product_collections')
        .select('product_id')
        .eq('user_id', caller.sub)
        .limit(60),
    ]);
    const affinityIds = [
      ...new Set([
        ...(purchased ?? []).map((item) => item.product_id),
        ...(collections ?? []).map((item) => item.product_id),
      ]),
    ];
    if (affinityIds.length) {
      const { data } = await supabaseAdmin
        .from('marketplace_products')
        .select(AFFINITY_SELECT)
        .in('id', affinityIds);
      affinityRows = (data ?? []) as unknown as ProductRow[];
    }
  }
  const affinity = createAffinity(affinityRows);

  const candidateIds = candidates.map((candidate) => candidate.id);
  const { data: purchaseRows } = await supabaseAdmin
    .from('marketplace_order_items')
    .select('product_id, quantity, order:marketplace_orders!inner(status)')
    .in('product_id', candidateIds)
    .in('order.status', ['paid', 'completed']);
  const purchaseCounts = new Map<string, number>();
  (purchaseRows ?? []).forEach((item) => {
    purchaseCounts.set(
      item.product_id,
      (purchaseCounts.get(item.product_id) ?? 0) + Number(item.quantity || 0)
    );
  });

  const pool = candidates
    .map((candidate) => ({
      product: candidate,
      score: scoreProduct(candidate, source, affinity, purchaseCounts.get(candidate.id) ?? 0),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 32);

  const url = new URL(request.url);
  const anonymousKey = url.searchParams.get('viewer')?.slice(0, 100) || 'anonymous';
  const day = new Date().toISOString().slice(0, 10);
  const viewerSeed = caller?.sub ?? anonymousKey;
  const selected = pool
    .map((item) => ({
      ...item,
      randomOrder: hashUnit(`${viewerSeed}:${day}:${source.id}:${item.product.id}`),
    }))
    .sort((left, right) => left.randomOrder - right.randomOrder)
    .slice(0, 12);

  const products = await Promise.all(
    selected.map(async ({ product }) => {
      const resolved = await withMediaUrls({ ...product, files: [] });
      const safeProduct: Record<string, unknown> = { ...resolved };
      delete safeProduct.reviews;
      delete safeProduct.files;
      safeProduct.seller = withPublicSystemStoreFlag(safeProduct.seller);
      return safeProduct;
    })
  );

  return NextResponse.json({ products });
}
