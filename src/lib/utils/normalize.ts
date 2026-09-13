/**
 * normalize.ts — Utilidades compartidas de normalización de texto
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 */

export function normalizeUnicode(str: string): string {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizarId(val: any): string {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object' && val.id) return String(val.id).trim();
  return String(val).trim();
}

export function normalizarCargo(cargoRaw: any): string {
  if (!cargoRaw) return 'DOCENTE';
  const str = String(cargoRaw).trim().toUpperCase();
  if (str.includes('DOC') || str.includes('PROF') || str.includes('MAESTR') || str.includes('CATEDRATICO')) return 'DOCENTE';
  if (str.includes('DIR') || str.includes('RECT') || str.includes('SUBDIR') || str.includes('COORDINAD')) return 'DIRECTIVO';
  if (str.includes('PREF') || str.includes('DISCIPLIN')) return 'PREFECTO';
  if (str.includes('ORIENT') || str.includes('TUTOR') || str.includes('PSICO') || str.includes('TRABAJO')) return 'ORIENTADOR';
  if (str.includes('ADMIN') || str.includes('SECRET') || str.includes('OFICIN') || str.includes('CONTAB') || str.includes('ASISTEN') || str.includes('APOYO')) return 'ADMINISTRATIVO';
  return 'OTRO';
}

