/**
 * types.ts — Tipos del Catálogo Modular de Instrumental Curricular V7
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 */

export type EquipmentCategory =
  | 'instrumento_medicion'
  | 'laboratorio_ciencias'
  | 'herramienta_taller'
  | 'seguridad_epp'
  | 'tecnologia_computo'
  | 'dibujo_matematicas'
  | 'salud_clinica'
  | 'agropecuaria'
  | 'alimentos_gastronomia';

export type TechnologyFamilyId =
  | 'electronica_mecatronica'
  | 'electricidad_energia'
  | 'mecanica_soldadura'
  | 'agropecuaria'
  | 'biotecnologia'
  | 'salud'
  | 'gastronomia'
  | 'servicios_turismo'
  | 'tics_ciberseguridad'
  | 'diseno_grafico'
  | 'ciencias_experimentales';

export interface CatalogItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  englishQuery: string;
  aliases: string[];
  keywordsBilingual: string[]; // Raíces léxicas en ES y EN para validar título/tags de Openverse
  technicalRole: string;
  safetyRule?: string;
  normaNOM?: string;
  familias: TechnologyFamilyId[];
  svgKey: string;
}
