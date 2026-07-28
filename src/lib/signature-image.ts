import 'server-only';

// ----------------------------------------------------------------------

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_SIGNATURE_SIZE = 2 * 1024 * 1024;

export function decodeSignatureDataUrl(value: unknown) {
  const match =
    typeof value === 'string' ? value.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!match) return null;

  const buffer = Buffer.from(match[1], 'base64');
  if (
    buffer.length < PNG_HEADER.length ||
    buffer.length > MAX_SIGNATURE_SIZE ||
    !buffer.subarray(0, PNG_HEADER.length).equals(PNG_HEADER)
  ) {
    return null;
  }

  return buffer;
}
