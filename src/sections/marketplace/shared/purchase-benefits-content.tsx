'use client';

import { Editor } from 'src/components/editor';
import { editorClasses } from 'src/components/editor/classes';

import { legacyPurchaseBenefitsToHtml } from './purchase-benefits';

type Props = {
  html?: string | null;
  legacyItems?: string[];
};

export function PurchaseBenefitsContent({ html, legacyItems = [] }: Props) {
  const content = html?.trim() || legacyPurchaseBenefitsToHtml(legacyItems);
  if (!content) return null;

  return (
    <Editor
      key={content}
      editable={false}
      value={content}
      sx={{
        minHeight: 0,
        border: 0,
        opacity: '1 !important',
        bgcolor: 'transparent',
        [`.${editorClasses.toolbar.root}`]: { display: 'none' },
        [`.${editorClasses.content.root}`]: {
          overflow: 'visible',
          bgcolor: 'transparent',
          '& .tiptap.ProseMirror': {
            p: 0,
            fontSize: '14px',
            '& p, & li, & h1, & h2, & h3, & h4, & h5, & h6': {
              fontSize: '14px',
            },
          },
          '& .tiptap > :first-child': { mt: 0 },
          '& .tiptap > :last-child': { mb: 0 },
        },
      }}
    />
  );
}
