/**
 * Configuración Oficial de Subsistemas Educativos — MCCEMS Ciclo 2026-2027
 * Arquitectura Dual: BGE (Bachillerato General Estatal) vs BT (Bachilleratos Tecnológicos)
 */

export interface SubsystemConfig {
  id: 'bge' | 'bt';
  subsystemCodes: string[];
  componentKey: 'laboral'; // Clave técnica interna para compatibilidad de esquemas
  componentName: string;   // "Formación Laboral" | "Carrera Técnica"
  componentDescription: string;
  validSemesters: number[];
  weeksPerSemester: number;
  hasPropositosFormativos: boolean;
  hasContenidosTemas: boolean;
  hasActividadesClave: boolean;
  hasResultadoAprendizaje: boolean;
  hasModulos: boolean;
  summaryCardFields: ('carga' | 'resultado' | 'modulo' | 'actividades')[];
}

export const BGE_CONFIG: SubsystemConfig = {
  id: 'bge',
  subsystemCodes: ['bge', 'digital', 'emsad'],
  componentKey: 'laboral',
  componentName: 'Formación Laboral',
  componentDescription: 'Formación Laboral (3°-6° sem.)',
  validSemesters: [3, 4, 5, 6],
  weeksPerSemester: 18,
  hasPropositosFormativos: false,
  hasContenidosTemas: false,
  hasActividadesClave: true,
  hasResultadoAprendizaje: true,
  hasModulos: false,
  summaryCardFields: ['carga', 'resultado', 'actividades'],
};

export const BT_CONFIG: SubsystemConfig = {
  id: 'bt',
  subsystemCodes: ['tecnologico', 'cbtis', 'cbta', 'cecyte'],
  componentKey: 'laboral',
  componentName: 'Carrera Técnica',
  componentDescription: 'Carrera Técnica (2°-6° sem.)',
  validSemesters: [2, 3, 4, 5, 6],
  weeksPerSemester: 16,
  hasPropositosFormativos: false,
  hasContenidosTemas: false,
  hasActividadesClave: true,
  hasResultadoAprendizaje: false,
  hasModulos: true,
  summaryCardFields: ['carga', 'modulo', 'actividades'],
};

/**
 * Semestres donde el componente técnico/laboral NO está disponible
 * (Reemplaza la constante hardcoded SEMESTERS_WITHOUT_LABORAL = [1, 2])
 */
export const SEMESTERS_WITHOUT_COMPONENT: Record<'bge' | 'bt', number[]> = {
  bge: [1, 2],
  bt: [1],
};

/**
 * Obtiene la configuración correspondiente según el código del subsistema
 */
export function getSubsystemConfig(subsystemId?: string | null): SubsystemConfig {
  const norm = (subsystemId || 'bge').toLowerCase().trim();
  if (BT_CONFIG.subsystemCodes.includes(norm)) {
    return BT_CONFIG;
  }
  return BGE_CONFIG;
}

/**
 * Determina si el subsistema es Tecnológico
 */
export function isTechnologicalSubsystem(subsystemId?: string | null): boolean {
  const norm = (subsystemId || 'bge').toLowerCase().trim();
  return BT_CONFIG.subsystemCodes.includes(norm);
}
