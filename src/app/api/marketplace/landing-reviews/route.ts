import { NextResponse } from 'next/server';

import { supabaseAdmin } from 'src/lib/supabase-admin';

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  updated_at: string;
  product:
    | {
        id: string;
        title: string;
        title_en: string | null;
      }
    | Array<{
        id: string;
        title: string;
        title_en: string | null;
      }>;
};

function publicReviewerName(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.includes('@')) return 'ผู้ซื้อ E-KRU';

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0].slice(0, 24);
  return `${parts[0].slice(0, 20)} ${parts[1].slice(0, 1)}.`;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('marketplace_product_reviews')
    .select(
      'id, rating, comment, reviewer_name, updated_at, product:marketplace_products!inner(id, title, title_en, status, seller:marketplace_sellers!inner(status))'
    )
    .not('comment', 'is', null)
    .gte('rating', 4)
    .eq('product.status', 'published')
    .eq('product.seller.status', 'active')
    .order('updated_at', { ascending: false })
    .limit(12);

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ items: [] });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const items = ((data ?? []) as unknown as ReviewRow[])
    .flatMap((review) => {
      const product = Array.isArray(review.product) ? review.product[0] : review.product;
      const comment = review.comment?.trim() ?? '';
      if (!product || comment.length < 10) return [];

      return [
        {
          id: review.id,
          rating: Number(review.rating),
          comment,
          reviewerName: publicReviewerName(review.reviewer_name),
          updatedAt: review.updated_at,
          product: {
            id: product.id,
            title: product.title,
            titleEn: product.title_en,
          },
        },
      ];
    })
    .slice(0, 6);

  return NextResponse.json(
    { items },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  );
}
