'use client';

import type { RemixIconName } from './icon-map';

import { createElement } from 'react';
import { mergeClasses } from 'minimal-shared/utils';

import { styled } from '@mui/material/styles';

import { getRemixIcon } from './icon-map';
import { remixIconClasses } from './classes';

export type RemixIconProps = Omit<React.ComponentProps<typeof IconRoot>, 'children' | 'color'> & {
  icon: RemixIconName;
  width?: number | string;
  height?: number | string;
  color?: string;
};

export function RemixIcon({
  className,
  icon,
  width = 20,
  height,
  color,
  sx,
  ...other
}: RemixIconProps) {
  return (
    <IconRoot
      className={mergeClasses([remixIconClasses.root, className])}
      sx={[
        {
          width,
          color,
          flexShrink: 0,
          height: height ?? width,
          display: 'inline-flex',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {createElement(getRemixIcon(icon), {
        size: '100%',
        'aria-hidden': true,
        focusable: false,
      })}
    </IconRoot>
  );
}

const IconRoot = styled('span')({
  lineHeight: 0,
  alignItems: 'center',
  justifyContent: 'center',
  verticalAlign: 'middle',
  '& svg': {
    width: '100%',
    height: '100%',
  },
});
