/**
 * Admin middleware helper — re-exports from unified admin authorization module.
 */
export {
  isAdmin,
  isEnvAdmin,
  getUserRole,
  requireAdmin,
  adminUnauthorized,
  adminForbidden,
} from './admin-unified';

