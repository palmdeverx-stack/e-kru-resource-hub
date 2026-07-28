'use client';

import { useQuery } from '@tanstack/react-query';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';

import { RouterLink } from 'src/routes/components';

import { Logo } from 'src/components/logo';

import { getSchool } from 'src/sections/school/school-actions';

import { useAuthContext } from 'src/auth/hooks';
import { getHomePathForRole } from 'src/auth/utils/role-home-path';

// ----------------------------------------------------------------------

export function useMainSchoolBrand() {
  const { user } = useAuthContext();
  const schoolId = typeof user?.school_id === 'string' ? user.school_id : '';
  const schoolQuery = useQuery({
    queryKey: ['nav-school', schoolId],
    queryFn: () => getSchool(schoolId),
    enabled: !!schoolId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user,
    school: schoolQuery.data ?? null,
    isLoading: !!schoolId && schoolQuery.isLoading,
  };
}

export function MainSchoolLogo({ size = 40 }: { size?: number }) {
  const { user, school, isLoading } = useMainSchoolBrand();
  const href = user ? getHomePathForRole(user.role) : '/';

  if (isLoading) {
    return <Skeleton variant="rounded" width={size} height={size} />;
  }

  if (!school?.logo_url) {
    return <Logo href={href} sx={{ width: size, height: size }} />;
  }

  return (
    <Link
      component={RouterLink}
      href={href}
      aria-label={school.name}
      underline="none"
      sx={{
        width: size,
        height: size,
        p: 0.25,
        flexShrink: 0,
        display: 'inline-flex',
        overflow: 'hidden',
        alignItems: 'center',
        borderRadius: 1.25,
        justifyContent: 'center',
        bgcolor: 'common.white',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        component="img"
        src={school.logo_url}
        alt={`โลโก้ ${school.name}`}
        sx={{ width: 1, height: 1, objectFit: 'contain' }}
      />
    </Link>
  );
}
