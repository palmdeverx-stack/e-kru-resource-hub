import type { ReactNode } from 'react';

import Box from '@mui/material/Box';

// ----------------------------------------------------------------------

const TRAILING_ASTERISK = /\s\*$/;

/**
 * Colors a trailing " *" (the codebase's convention for marking a field
 * required in its label text) red, leaving non-string labels untouched.
 */
export function withRequiredAsterisk(label?: ReactNode): ReactNode {
  if (typeof label !== 'string' || !TRAILING_ASTERISK.test(label)) {
    return label;
  }

  return (
    <>
      {label.replace(TRAILING_ASTERISK, '')}{' '}
      <Box component="span" sx={{ color: 'error.main' }}>
        *
      </Box>
    </>
  );
}
