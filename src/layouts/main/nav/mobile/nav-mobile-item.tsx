import type { CSSObject } from '@mui/material/styles';
import type { NavItemProps } from '../types';

import { varAlpha, mergeClasses } from 'minimal-shared/utils';

import { styled } from '@mui/material/styles';
import ButtonBase from '@mui/material/ButtonBase';

import { RiArrowDownSLine, RiArrowRightSLine } from 'src/components/remix-icon';
import { createNavItem, navItemStyles, navSectionClasses } from 'src/components/nav-section';

// ----------------------------------------------------------------------

export function NavItem({
  path,
  icon,
  title,
  /********/
  open,
  active,
  /********/
  hasChild,
  className,
  externalLink,
  ...other
}: NavItemProps) {
  const navItem = createNavItem({
    path,
    icon,
    hasChild,
    externalLink,
  });

  const ownerState: StyledState = { open, active };

  return (
    <ItemRoot
      aria-label={title}
      {...ownerState}
      {...navItem.baseProps}
      className={mergeClasses([navSectionClasses.item.root, className], {
        [navSectionClasses.state.open]: open,
        [navSectionClasses.state.active]: active,
      })}
      {...other}
    >
      <ItemIcon {...ownerState}> {navItem.renderIcon}</ItemIcon>

      <ItemTitle {...ownerState}>{title}</ItemTitle>

      {hasChild && (
        <>{open ? <ItemArrowDown {...ownerState} /> : <ItemArrowRight {...ownerState} />}</>
      )}
    </ItemRoot>
  );
}

// ----------------------------------------------------------------------

type StyledState = Pick<NavItemProps, 'open' | 'active'>;

const shouldForwardProp = (prop: string) => !['open', 'active', 'sx'].includes(prop);

/**
 * @slot root
 */
const ItemRoot = styled(ButtonBase, { shouldForwardProp })<StyledState>(({ theme }) => {
  const openStyles: CSSObject = {
    color: theme.vars.palette.primary.main,
    backgroundColor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
  };

  const activeStyles: CSSObject = {
    color: theme.vars.palette.primary.main,
    backgroundColor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
    '&:hover': { backgroundColor: varAlpha(theme.vars.palette.primary.mainChannel, 0.16) },
  };

  return {
    gap: 16,
    height: 48,
    width: '100%',
    paddingLeft: theme.spacing(2.5),
    paddingRight: theme.spacing(1.5),
    color: theme.vars.palette.primary.main,
    '&:hover': {
      color: theme.vars.palette.primary.dark,
      backgroundColor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
    },
    variants: [
      { props: { open: true }, style: openStyles },
      { props: { active: true }, style: activeStyles },
    ],
  };
});

/**
 * @slot icon
 */
const ItemIcon = styled('span', { shouldForwardProp })<StyledState>(() => ({
  ...navItemStyles.icon,
}));

/**
 * @slot title
 */
const ItemTitle = styled('span', { shouldForwardProp })<StyledState>(({ theme }) => ({
  ...navItemStyles.title(theme),
  ...theme.typography.body2,
  fontWeight: theme.typography.fontWeightMedium,
  variants: [
    { props: { active: true }, style: { fontWeight: theme.typography.fontWeightSemiBold } },
  ],
}));

/**
 * @slot arrow
 */
const ItemArrowDown = styled(RiArrowDownSLine, { shouldForwardProp })<StyledState>(({ theme }) => ({
  ...navItemStyles.arrow(theme),
}));

const ItemArrowRight = styled(RiArrowRightSLine, { shouldForwardProp })<StyledState>(
  ({ theme }) => ({
    ...navItemStyles.arrow(theme),
  })
);
