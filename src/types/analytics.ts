/**
 * src/types/analytics.ts
 * Definición de tipos de dominio multi-nivel para Analítica Avanzada y Supervisión Inteligente (Fase 5)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 */

export type QualityStatus = 'excelente' | 'aprobada' | 'requiere_ajustes' | 'insuficiente';

export interface QualityMetric {
  score: number; // 0-100
  status: QualityStatus;
  retoSituadoOk: boolean;
  tresSaberesOk: boolean;
  coherenciaOk: boolean;
  horasOk: boolean;
  evaluatedAt: string;
}

export interface SchoolMetric {
  schoolId: string;
  cct: string;
  name: string;
  municipality?: string;
  subsystem: string;
  directorName?: string;
  directorEmail?: string;
  totalPlannings: number;
  avgQualityScore: number;
  retoSituadoPct: number;
  tresSaberesPct: number;
  horasBalancePct: number;
  paecLinkedPct: number;
  pmcStatus: 'completed' | 'draft' | 'none';
  paecStatus: 'completed' | 'draft' | 'none';
  activeTeachers: number;
  criticalAlerts: number;
  alertas: string[];
}

export interface ZoneMetric {
  zoneId: string;
  zoneName: string;
  supervisorName: string;
  totalSchools: number;
  totalTeachers: number;
  totalPlannings: number;
  avgQualityScore: number;
  curricularCoveragePct: number;
  paecVinculacionPct: number;
  retoSituadoCumplimientoPct: number;
  tresSaberesCoberturaPct: number;
  horasCorteBalancePct: number;
  docentesActivosPct: number;
  alertasCriticasActivas: number;
  schools: SchoolMetric[];
}

export interface TeacherMetric {
  teacherId: string;
  name: string;
  email: string;
  schoolCct?: string;
  schoolName?: string;
  planningsCount: number;
  avgScore: number;
  paecCount: number;
  pmcCount: number;
  lastActive?: string;
}

export interface TrendData {
  date: string;
  qualityScore: number;
  coberturaPct: number;
  alertasActivas: number;
}

export type AlertSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export interface PedagogicalAlert {
  id: string;
  alertType: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  schoolCct?: string;
  schoolName?: string;
  teacherId?: string;
  planningId?: string;
  zoneId?: string;
  channel: 'in_app' | 'email' | 'stream';
  createdAt: string;
  resolved: boolean;
}

export interface DomainEvent {
  id?: string;
  eventType: 'planeacion_generated' | 'planeacion_evaluated' | 'paec_completed' | 'pmc_completed' | 'quality_score_calculated' | 'alert_triggered' | 'alert_resolved' | (string & {});
  aggregateId: string;
  aggregateType: 'planning' | 'school' | 'zone' | 'teacher' | 'alert' | (string & {});
  payload: Record<string, unknown>;
  createdAt?: string;
}
