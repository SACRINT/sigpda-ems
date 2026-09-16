/**
 * config.ts — Configuración centralizada de APIs y servicios externos
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 */

export const API_CONFIG = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  openverse: 'https://api.openverse.org/v1/images',
  mermaid: 'https://kroki.io/mermaid/png',
};

export const SCHOOL_YEAR = '2026-2027';

/**
 * Obtiene la URL base de la aplicación de manera dinámica y resiliente:
 * 1. window.location.origin (en entorno de navegador)
 * 2. NEXT_PUBLIC_APP_URL (variable de entorno explícita)
 * 3. VERCEL_PROJECT_PRODUCTION_URL o VERCEL_URL (despliegues en Vercel)
 * 4. Dominio institucional de producción (https://sigpda-ems.vercel.app si NODE_ENV=production)
 * 5. Fallback a desarrollo local (http://localhost:3000)
 */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://sigpda-ems.vercel.app';
  }
  return 'http://localhost:3000';
}

export const APP_CONFIG = {
  get baseUrl() {
    return getAppBaseUrl();
  },
};

