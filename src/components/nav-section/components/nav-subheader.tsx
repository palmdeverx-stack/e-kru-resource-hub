import type { ListSubheaderProps } from '@mui/material/ListSubheader';

import { mergeClasses } from 'minimal-shared/utils';

import { styled } from '@mui/material/styles';
import ListSubheader from '@mui/material/ListSubheader';

import { navSectionClasses } from '../styles';
import { RiArrowDownSLine, RiArrowRightSLine } from '../../remix-icon';

// ----------------------------------------------------------------------

export type NavSubheaderProps = ListSubheaderProps & { open?: boolean };

export const NavSubheader = styled(({ open, children, className, ...other }: NavSubheaderProps) => (
  <ListSubheader
    disableSticky
    component="div"
    {...other}
    className={mergeClasses([navSectionClasses.subheader, className])}
  >
    {open ? (
      <RiArrowDownSLine className="nav-subheader-icon" size={16} />
    ) : (
      <RiArrowRightSLine className="nav-subheader-icon" size={16} />
    )}
    {children}
  </ListSubheader>
))(({ theme }) => ({
  ...theme.typography.overline,
  cursor: 'pointer',
  alignItems: 'center',
  position: 'relative',
  gap: theme.spacing(1),
  display: 'inline-flex',
  alignSelf: 'flex-start',
  color: 'var(--nav-subheader-color)',
  padding: theme.spacing(2, 1, 1, 1.5),
  fontSize: theme.typography.pxToRem(11),
  transition: theme.transitions.create(['color', 'padding-left'], {
    duration: theme.transitions.duration.standard,
  }),
  '& .nav-subheader-icon': {
    left: -4,
    opacity: 0,
    position: 'absolute',
    transition: theme.transitions.create(['opacity'], {
      duration: theme.transitions.duration.standard,
    }),
  },
  '&:hover': {
    paddingLeft: theme.spacing(2),
    color: 'var(--nav-subheader-hover-color)',
    '& .nav-subheader-icon': { opacity: 1 },
  },
}));
