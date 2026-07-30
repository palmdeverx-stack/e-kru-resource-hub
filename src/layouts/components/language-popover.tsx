'use client';

import type { IconButtonProps } from '@mui/material/IconButton';
import type { LangCode } from 'src/locales';

import { m } from 'framer-motion';
import { useCallback } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';

import { useTranslate } from 'src/locales';

import { FlagIcon } from 'src/components/flag-icon';
import { RiTranslate2 } from 'src/components/remix-icon';
import { CustomPopover } from 'src/components/custom-popover';
import { varTap, varHover, transitionTap } from 'src/components/animate';

// ----------------------------------------------------------------------

export type LanguagePopoverProps = IconButtonProps & {
  showTranslateIcon?: boolean;
  data?: {
    value: string;
    label: string;
    countryCode: string;
  }[];
};

export function LanguagePopover({
  data = [],
  sx,
  showTranslateIcon = false,
  ...other
}: LanguagePopoverProps) {
  const theme = useTheme();
  const { open, anchorEl, onClose, onOpen } = usePopover();

  const { t, onChangeLang, currentLang } = useTranslate();

  const handleChangeLang = useCallback(
    (lang: LangCode) => {
      onChangeLang(lang);
      onClose();
    },
    [onChangeLang, onClose]
  );

  const renderMenuList = () => (
    <CustomPopover open={open} anchorEl={anchorEl} onClose={onClose}>
      <MenuList sx={{ width: 160, minHeight: 72 }}>
        {data?.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === currentLang.value}
            onClick={() => handleChangeLang(option.value as LangCode)}
          >
            <FlagIcon code={option.countryCode} />

            {option.label}
          </MenuItem>
        ))}
      </MenuList>
    </CustomPopover>
  );

  return (
    <>
      <IconButton
        component={m.button}
        whileTap={varTap(0.96)}
        whileHover={varHover(1.04)}
        transition={transitionTap()}
        aria-label={t('language.select', { defaultValue: 'เลือกภาษา' })}
        onClick={onOpen}
        sx={[
          () => ({
            p: 0,
            width: 40,
            height: 40,
            ...(open && { bgcolor: theme.vars.palette.action.selected }),
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        {showTranslateIcon ? (
          <RiTranslate2 aria-hidden="true" size={22} color="text.primary" />
        ) : (
          <FlagIcon code={currentLang.countryCode} />
        )}
      </IconButton>

      {renderMenuList()}
    </>
  );
}
