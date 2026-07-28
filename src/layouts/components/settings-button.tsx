import type { IconButtonProps } from '@mui/material/IconButton';

import { m } from 'framer-motion';

import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';

import { RiSettings3Line } from 'src/components/remix-icon';
import { useSettingsContext } from 'src/components/settings';
import { varTap, varHover, transitionTap } from 'src/components/animate';

// ----------------------------------------------------------------------

export function SettingsButton({ sx, ...other }: IconButtonProps) {
  const settings = useSettingsContext();

  return (
    <IconButton
      component={m.button}
      whileTap={varTap(0.96)}
      whileHover={varHover(1.04)}
      transition={transitionTap()}
      aria-label="Settings button"
      onClick={settings.onToggleDrawer}
      sx={[{ p: 0, width: 40, height: 40 }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    >
      <Badge color="error" variant="dot" invisible={!settings.canReset}>
        <m.span
          animate={{ rotate: 360 }}
          transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
          style={{ display: 'inline-flex' }}
        >
          <RiSettings3Line size={24} />
        </m.span>
      </Badge>
    </IconButton>
  );
}
