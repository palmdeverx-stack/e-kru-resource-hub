'use client';

import { useEffect } from 'react';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { SplashScreen } from 'src/components/loading-screen';

import { useAuthContext } from '../hooks';

// ----------------------------------------------------------------------

type DepartmentPermissionGuardProps = {
  /**
   * Permission key required to reach this page (e.g. 'subjects.manage').
   * Omit for pages a delegated teacher should never reach regardless of
   * permissions (e.g. department management itself).
   */
  permission?: string;
  children: React.ReactNode;
};

type DepartmentWorkspaceGuardProps = {
  children: React.ReactNode;
};

/**
 * Blocks direct URL access to admin pages that manage department-scoped
 * data. A school admin always passes. A delegated teacher must hold
 * `permission` in `department_permissions` — the same check the nav already
 * uses to hide/show these links (see filterAdminNavForTeacher /
 * filterNavByDepartment), so this just closes the direct-URL bypass.
 *
 * Sends unauthorized visitors to the 404 page rather than a "permission
 * denied" screen, so the page's existence isn't confirmed to someone who
 * isn't meant to reach it.
 */
export function DepartmentPermissionGuard({ permission, children }: DepartmentPermissionGuardProps) {
  const { user } = useAuthContext();
  const router = useRouter();

  const isSchoolAdmin = user?.role === 'school_admin';
  const hasPermission = !!permission && (user?.department_permissions ?? []).includes(permission);
  const isAllowed = isSchoolAdmin || hasPermission;

  useEffect(() => {
    if (user && !isAllowed) {
      router.replace(paths.page404);
    }
  }, [user, isAllowed, router]);

  if (!user || !isAllowed) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}

/**
 * The personal department workspace is for operational staff who are actual
 * department members. Executives have a separate approval-only workspace.
 */
export function DepartmentWorkspaceGuard({ children }: DepartmentWorkspaceGuardProps) {
  const { user } = useAuthContext();
  const router = useRouter();

  const isAllowed =
    user?.role === 'teacher' &&
    !user.is_school_director &&
    (user.departments ?? []).length > 0;

  useEffect(() => {
    if (user && !isAllowed) {
      router.replace(paths.page404);
    }
  }, [user, isAllowed, router]);

  if (!user || !isAllowed) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
