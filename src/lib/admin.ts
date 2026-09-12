import { isAdmin as isAdminUnified } from './admin-unified';

export async function isAdmin(email: string | null | undefined): Promise<boolean> {
  return isAdminUnified(email);
}
