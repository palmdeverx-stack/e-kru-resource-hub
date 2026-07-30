import 'server-only';

export function withPublicSystemStoreFlag(seller: unknown) {
  if (!seller || typeof seller !== 'object' || Array.isArray(seller)) return seller;

  const { owner_role: ownerRole, ...sellerDetails } = seller as Record<string, unknown>;
  return {
    ...sellerDetails,
    is_system_store: ownerRole === 'master_admin',
  };
}
