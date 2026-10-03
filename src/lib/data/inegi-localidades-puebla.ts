// src/lib/data/inegi-localidades-puebla.ts
/**
 * inegi-localidades-puebla.ts — Catálogo Demográfico Oficial de Localidades de Puebla (INEGI Censo 2020)
 * SIGPDA-EMS · Soporte para diagnóstico de contexto comunitario PAEC.
 * Regla B-001: Si la localidad no coincide con registros oficiales verificados, retorna null (cero invención).
 */

import type { InegiLocalidadDemographics } from '@/lib/inegi-demographic-parser';

export const INEGI_LOCALIDADES_PUEBLA: Record<string, InegiLocalidadDemographics> = {
  // Clave: "municipio_cve:localidad_cve" o nombre normalizado
  '21194:211940012': {
    entidad: 'Puebla',
    cveEntidad: '21',
    municipio: 'Venustiano Carranza',
    cveMunicipio: '21194',
    localidad: 'Coronel Tito Hernández (María Andrea)',
    cveLocalidad: '211940012',
    poblacion: {
      total: 2183,
      femenina: 1177,
      masculina: 1006,
      rango0a14: 593,
      rango15a29: 442,
      rango30a59: 787,
      rango60mas: 361,
      conDiscapacidad: 147,
      gradoPromedioEscolaridad: 7.69,
      gradoPromedioFemenino: 7.5,
      gradoPromedioMasculino: 7.92,
    },
    viviendas: {
      total: 798,
      particularesHabitadas: 657,
      promedioOcupantes: 3.32,
      disponenDrenaje: 651,
      disponenEnergiaElectrica: 638,
      disponenSanitario: 636,
      pisoMaterialDiferenteTierra: 621,
    },
    entornoUrbano: {
      recubrimientoCalle: { enTodas: 19, enAlguna: 45, enNinguna: 1, noEspecificado: 0 },
      banquetas: { enTodas: 6, enAlguna: 27, enNinguna: 32, noEspecificado: 0 },
      alumbradoPublico: { enTodas: 7, enAlguna: 47, enNinguna: 11, noEspecificado: 0 },
      arbolesPalmeras: { enTodas: 36, enAlguna: 20, enNinguna: 9, noEspecificado: 0 },
      drenajePluvial: { enTodas: 1, enAlguna: 0, enNinguna: 64, noEspecificado: 0 },
    },
    fuente: 'INEGI · Censo de Población y Vivienda 2020 (México en Cifras)',
    anioCenso: 2020,
  },
};

function normalizeText(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Busca y recupera la estadística demográfica oficial de una localidad en Puebla.
 * Si no hay correspondencia fidedigna, retorna null (sin datos ficticios).
 */
export function getInegiDemographics(
  municipio?: string | null,
  localidad?: string | null
): InegiLocalidadDemographics | null {
  if (!municipio && !localidad) return null;

  const normMuni = normalizeText(municipio || '');
  const normLoc = normalizeText(localidad || '');

  for (const item of Object.values(INEGI_LOCALIDADES_PUEBLA)) {
    const itemMuni = normalizeText(item.municipio);
    const itemLoc = normalizeText(item.localidad);

    const muniMatch = !normMuni || itemMuni.includes(normMuni) || normMuni.includes(itemMuni);
    const locMatch = !normLoc || itemLoc.includes(normLoc) || normLoc.includes(itemLoc);

    if (muniMatch && locMatch) {
      return item;
    }
  }

  return null;
}
