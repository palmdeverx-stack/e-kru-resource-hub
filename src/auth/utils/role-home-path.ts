import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------

const ROLE_HOME_PATHS: Record<string, string> = {
  master_admin: paths.marketplace.dashboard,
  school_admin: paths.marketplace.dashboard,
  teacher: paths.marketplace.dashboard,
  student: paths.marketplace.dashboard,
  marketplace_user: paths.marketplace.dashboard,
};

export function getHomePathForRole(role?: string): string {
  return (role && ROLE_HOME_PATHS[role]) || paths.auth.jwt.signIn;
}
