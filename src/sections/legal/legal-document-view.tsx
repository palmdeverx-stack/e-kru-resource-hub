'use client';

import Paper from '@mui/material/Paper';
import Container from '@mui/material/Container';

import { Markdown } from 'src/components/markdown';

type Props = {
  content: string;
};

export function LegalDocumentView({ content }: Props) {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, sm: 5, md: 7 },
          borderRadius: 3,
          boxShadow: (theme) => theme.customShadows.z8,
        }}
      >
        <Markdown
          sx={{
            '& h1': { mb: 1.5 },
            '& h2': { mt: 5, scrollMarginTop: 96 },
            '& blockquote': {
              m: 0,
              mt: 3,
              px: 2.5,
              py: 1,
              borderRadius: 1.5,
              color: 'warning.darker',
              bgcolor: 'warning.lighter',
              borderLeftColor: 'warning.main',
            },
            '& table': { minWidth: 640 },
          }}
        >
          {content}
        </Markdown>
      </Paper>
    </Container>
  );
}
