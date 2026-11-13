/**
 * Verificación de administradores definidos por variables de entorno.
 * Módulo aislado sin dependencias de DB/auth para evitar ciclos de importación.
 */
export function isEnvAdmin(email?: string | null): boolean {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  const envAdmins = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);
  return envAdmins.includes(cleanEmail);
}
