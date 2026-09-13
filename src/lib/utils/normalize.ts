/**
 * normalize.ts — Utilidades compartidas de normalización de texto
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 */

export function normalizeUnicode(str: string): string {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
