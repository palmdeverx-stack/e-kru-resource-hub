# Marketplace shipping (SHIPPOP)

The shipping feature is disabled for regular sellers by default. An administrator controls it at
`/dashboard/settings/shipping`. While disabled, regular sellers' physical products, navigation,
fields, and shipping APIs stay unavailable. The official E-KRU store (`owner_role = master_admin`)
can use the complete shipping flow whenever the provider is configured, so it can be tested before
the marketplace-wide rollout. Master admins may open the seller shipping page and prepare pickup or
parcel data before credentials are complete; live rates, checkout, booking, and labels still require
the provider configuration. The emergency kill switch disables shipping for every store.

## Flow

1. The administrator configures the server-only SHIPPOP credentials and enables the feature.
2. Sellers save their pickup address and enter packed weight and dimensions on physical products.
3. Checkout groups physical items by seller and asks SHIPPOP for rates for every group.
4. The buyer enters a delivery address, selects one service per seller, and pays products plus
   shipping. Signed, expiring quote tokens prevent client-side price changes.
5. The platform creates one order and one pending shipment per seller. Shipping is excluded from
   marketplace commission calculations.
6. After payment, the seller clicks **Prepare shipment**. The server books SHIPPOP and stores the
   tracking number. Labels are proxied by an authenticated endpoint so the API key never reaches the
   browser.
7. SHIPPOP webhook events update the buyer and seller tracking timeline through delivery, return,
   or problem states.

## Shipping finance

- The buyer's shipping charge is posted only after payment is verified; abandoned checkouts are not
  counted as collected cash.
- Product commission and the seller's payment-processing fee are calculated from product value.
  The platform absorbs the processing-fee portion attributable to shipping.
- SHIPPOP's actual charge is posted when booking returns a price or when a webhook reports the
  final price. Later weight or remote-area surcharges create an adjustment entry.
- Stripe refunds and lost disputes create a shipping refund entry. Unbooked shipments are cancelled;
  already-booked provider costs remain visible so the platform loss is not hidden.
- Master Admins with verified finance PIN access can view totals and manually reconcile pending or
  mismatched shipments on `/dashboard/settings/shipping`.
- Shipping ledger entries use idempotency keys so webhook and payment retries do not duplicate money.

## Required environment variables

- `SHIPPOP_API_KEY`: Marketplace API key supplied by SHIPPOP.
- `SHIPPOP_ACCOUNT_EMAIL`: email registered with the SHIPPOP account. `SHIPPOP_API_SECRET` remains a
  legacy fallback.
- `SHIPPOP_API_BASE_URL`: use the URL assigned by SHIPPOP; the example defaults to its developer
  endpoint.
- `MARKETPLACE_SHIPPING_QUOTE_SECRET`: random server-only secret used to sign checkout quotes. The
  existing `AUTH_SECRET` is used only when this value is absent.
- `SHIPPOP_WEBHOOK_SECRET`: random server-only token included in the webhook URL shown to admins.
- `MARKETPLACE_SHIPPING_KILL_SWITCH=true`: emergency hard-off switch. The admin UI cannot override
  it.

Do not add `NEXT_PUBLIC_` to any shipping secret. Register the exact webhook URL displayed on the
admin settings page with SHIPPOP.

## Database

Apply `supabase/migrations/202608030001_marketplace_shipping.sql` before enabling the feature. It
adds the central switch, parcel dimensions, pickup and delivery snapshots, shipments, tracking
events, and indexes. New shipping tables use RLS and are accessed only through authenticated server
routes.
