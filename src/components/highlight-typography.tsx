import type { TypographyProps } from '@mui/material';

import match from 'autosuggest-highlight/match';
import parse from 'autosuggest-highlight/parse';

import { useTheme, Typography } from '@mui/material';

// ----------------------------------------------------------------------

type HighLightTypographyProps = Omit<TypographyProps, 'children'> & {
  children: string;
  search: string;
};

// ----------------------------------------------------------------------

export function HighLightTypography({
  children: text,
  search,
  sx,
  color,
  ...other
}: HighLightTypographyProps) {
  const theme = useTheme();

  const matches = match(text, search, { insideWords: true });
  const parts = parse(text, matches);

  const defaultColor = search ? theme.palette.text.disabled : theme.palette.text.primary;

  return (
    <Typography component="span">
      {parts.map((part, index) => (
        <Typography
          key={`${part.text}-${index}`}
          component="span"
          sx={{
            fontWeight: 400,
            color: color ?? defaultColor,
            ...(part.highlight && {
              fontWeight: 700,
              color: theme.palette.text.primary,
            }),
            ...sx,
          }}
          {...other}
        >
          {part.text}
        </Typography>
      ))}
    </Typography>
  );
}
