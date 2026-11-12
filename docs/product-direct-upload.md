# Product file direct uploads

Product files (full files and previews) are uploaded directly from the browser to
private Supabase Storage. The Next.js endpoints accept JSON metadata only.
Vercel Blob is not used. Images retain their separate limits (4 MB cover,
3 MB preview) and upload one at a time using the existing image endpoint.

## Flow

1. `POST .../files/direct-upload` with `action: init` validates ownership, active
   seller status, MIME allowlist, byte size (1–10 MiB), quotas and rate limits.
2. The API returns a non-upserting Storage upload URL and a signed, owner-bound
   completion ticket valid for 30 minutes. The browser PUTs file bytes to Storage.
3. `action: complete` verifies the ticket, downloads the private staged object
   server-to-server, validates its actual size/MIME, normalizes image files, and
   invokes the existing malware scanner.
4. The verified object is written to a different immutable final path. Only then
   is a file row inserted. The staged object is removed on success or confirmed
   invalid/malicious content. Temporary failures preserve staging for retry.
5. Completion is idempotent by file UUID. The browser keeps successful transfers
   in a WeakMap while the same File is selected, so retry only finalizes instead
   of uploading its bytes again. Page reload clears this temporary state.

All API responses contain metadata and signed download links, never the file
bytes. Existing Supabase download URLs and files continue to work. The legacy
multipart file endpoint remains restricted to 4 MiB; this form does not use it.

## Deployment

- Apply `202611120003_product_purchase_benefits_ten_items.sql` if not already
  applied, and `202611120004_product_file_upload_limits.sql`.
- The latter caps the private bucket at 10 MiB and adds an advisory-lock trigger
  enforcing 5 actual files and 1 preview atomically across uploads and moves.
- Existing `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
  `AUTH_JWT_SECRET` are sufficient. No new storage account or Blob token is needed.
- Deploy the new client and endpoint together. Keep the Supabase Storage host
  allowed by `connect-src`; the existing `https://*.supabase.co` rule covers it.
- Pending uploads abandoned before completion remain private and unreferenced.
  Include old `*/pending/*` objects in the storage maintenance policy, allowing
  at least the signed upload URL lifetime before deleting them.

Malware-scanner unavailability retains the application's existing `pending_scan`
behavior; it is not reported as a successful malware scan.

## Verification

Automated coverage includes size boundaries, ownership/ticket tampering, quotas,
actual-byte mismatch, malware rejection, idempotency, cleanup, and retry without
another Storage PUT. A live 10 MiB upload/read-back hash check is performed with
an isolated temporary object; it does not publish or submit a product.
