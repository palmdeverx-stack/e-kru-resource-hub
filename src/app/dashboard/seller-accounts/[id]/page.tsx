import type { Metadata } from 'next';

import { paths } from 'src/routes/paths';

import { MarketplaceSellerApprovalDetailView } from 'src/sections/marketplace/admin/view/seller-approval-detail-view';

export const metadata: Metadata = { title: 'รายละเอียดบัญชีร้านค้า | E-KRU Marketplace' };

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;
  return (
    <MarketplaceSellerApprovalDetailView
      sellerId={id}
      backHref={paths.marketplace.sellerAccounts}
      backLabel="กลับไปบัญชีร้านค้าในระบบ"
    />
  );
}
