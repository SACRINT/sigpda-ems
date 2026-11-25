import type React from 'react';
import type { IndicadoresAcademicos } from '../wizard/helpers';

export interface MetaPersonalItem {
  nombre: string;
  cargo: string;
  categoria?: string;
  tema?: string;
  meta_individual: string;
  estrategia: string;
  entregable: string;
  periodo: string;
}

export interface MetaInstitucionalItem {
  categoria: string;
  nombre_categoria: string;
  tema: string;
  meta: string;
  estrategia: string;
  linea_base: string;
  personal_designado: string;
  entregable: string;
  periodo_inicio: string;
  periodo_fin: string;
  diagnostico_meta: string;
  continuidad_de?: string;
  accion_especifica?: string;
  finalidad?: string;
  necesidad?: string;
  proceso_evaluacion?: string;
  subcategorias_vinculadas?: string[];
  estrategias_seguimiento?: string;
  observaciones?: string;
}

export interface PlanAccionData {
  metas_institucionales: MetaInstitucionalItem[];
  metas_personales: MetaPersonalItem[];
}

export interface StaffMemberData {
  nombre: string;
  cargo: string;
  horas_base?: number | string | null;
  meta_individual?: string;
  asignaturas?: string;
  grupos?: string;
}

export interface PmcMetasComplementariasProps {
  projectId: string | null;
  planAccion: PlanAccionData | null;
  setPlanAccion: React.Dispatch<React.SetStateAction<PlanAccionData | null>>;
  staffData: StaffMemberData[];
  setStaffData?: React.Dispatch<React.SetStateAction<StaffMemberData[]>>;
  cicloEscolar: string;
  subsystem?: string;
  indicadores?: IndicadoresAcademicos;
  onPlanUpdated?: (updatedPlan: PlanAccionData) => void;
}

export const AMBITOS_OFICIALES = [
  { id: 'aprovechamiento', nombre: '1. Aprovechamiento académico y asistencia educativa' },
  { id: 'practica_docente', nombre: '2. Práctica docente y formación continua' },
  { id: 'infraestructura', nombre: '3. Infraestructura y equipamiento escolar' },
  { id: 'convivencia_paec', nombre: '4. Convivencia escolar y Proyecto Escolar Comunitario (PAEC)' },
  { id: 'adicional', nombre: '5. Ámbito Institucional Adicional (Priorizado por el Plantel)' },
];
