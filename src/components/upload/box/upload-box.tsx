import type { UploadProps } from '../types';

import { useDropzone } from 'react-dropzone';
import { mergeClasses } from 'minimal-shared/utils';

import { UploadArea } from './styles';
import { uploadClasses } from '../classes';
import { RemixIcon } from '../../remix-icon';

// ----------------------------------------------------------------------

export function UploadBox({
  sx,
  error,
  disabled,
  className,
  placeholder,
  ...dropzoneOptions
}: UploadProps) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    disabled,
    ...dropzoneOptions,
  });

  const hasError = isDragReject || !!error;

  return (
    <UploadArea
      {...getRootProps()}
      className={mergeClasses([uploadClasses.box, className], {
        [uploadClasses.state.dragActive]: isDragActive,
        [uploadClasses.state.disabled]: disabled,
        [uploadClasses.state.error]: hasError,
      })}
      sx={sx}
    >
      <input {...getInputProps()} />
      {placeholder ?? <RemixIcon icon="eva:cloud-upload-fill" width={28} />}
    </UploadArea>
  );
}
