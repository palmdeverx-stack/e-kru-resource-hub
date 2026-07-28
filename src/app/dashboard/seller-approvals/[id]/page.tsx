import type { Metadata } from 'next';

import { MarketplaceSellerApprovalDetailView } from 'src/sections/marketplace/admin/view/seller-approval-detail-view';

export const metadata: Metadata = {
  title: 'รายละเอียดคำขอเปิดร้าน | eKru Marketplace',
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <MarketplaceSellerApprovalDetailView sellerId={id} />;
}
