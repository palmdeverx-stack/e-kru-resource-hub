import type { FileUploadType } from '../types';

import { mergeClasses } from 'minimal-shared/utils';

import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { uploadClasses } from '../classes';
import { getFileMeta, FileThumbnail, useFilePreview } from '../../file-thumbnail';

// ----------------------------------------------------------------------

export type SingleFilePreviewProps = React.ComponentProps<typeof PreviewRoot> & {
  file: FileUploadType;
  fileName?: string;
  mimeType?: string | null;
};

export function SingleFilePreview({
  sx,
  file,
  fileName,
  mimeType,
  className,
  ...other
}: SingleFilePreviewProps) {
  const fileMeta = getFileMeta(file);
  const { previewUrl } = useFilePreview(file);

  return (
    <PreviewRoot
      className={mergeClasses([uploadClasses.preview.single, className])}
      sx={sx}
      {...other}
    >
      {mimeType === 'application/pdf' ||
      fileName?.toLowerCase().endsWith('.pdf') ||
      fileMeta.format === 'pdf' ||
      (file instanceof File && file.type === 'application/pdf') ? (
        <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: 1, px: 4 }}>
          <FileThumbnail file={fileName || file} sx={{ width: 56, height: 56 }} />
          <Typography variant="body2" sx={{ textAlign: 'center', overflowWrap: 'anywhere' }}>
            {fileName || fileMeta.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ไฟล์ PDF · กดดูตัวอย่างเพื่อเปิดเอกสาร
          </Typography>
        </Stack>
      ) : (
        previewUrl && (
          <PreviewImage alt={fileMeta.name} src={previewUrl} referrerPolicy="no-referrer" />
        )
      )}
    </PreviewRoot>
  );
}

// ----------------------------------------------------------------------

const PreviewRoot = styled('div')(({ theme }) => ({
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  position: 'absolute',
  borderRadius: 'inherit',
  padding: theme.spacing(1),
}));

const PreviewImage = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: '8px',
});
