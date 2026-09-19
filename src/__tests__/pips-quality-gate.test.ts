// src/__tests__/pips-quality-gate.test.ts
/**
 * Tests unitarios para pips-quality-gate.ts
 * Fase 12A · SIGPDA-EMS
 *
 * Sin mocking: funciones puras que solo reciben y retornan datos.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGlobalPipsScore,
  formatPipsAuditReport,
  PIPS_DIMENSIONS,
} from '@/lib/pips-quality-gate';
import type { PipsProject, PipsPlantele, PipsObjetivo, PipsCronogramaActividad, PipsProblematica } from '@/types/pips';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMinimalProject(overrides: Partial<PipsProject> = {}): PipsProject {
  return {
    zona_clave: '',
    zona_nombre: '',
    supervisor_name: '',
    municipio_sede: '',
    municipios_atiende: '',
    num_planteles: 0,
    subsistema: '',
    modalidad: '',
    ciclo_escolar: '',
    atps: '',
    presentacion_supervisor: '',
    pips_anterior_realizado: false,
    reflexion_pips_anterior: '',
    fortalezas_anterior: '',
    areas_oportunidad_anterior: '',
    planteles_json: [],
    diagnostico_contexto: '',
    problematicas_json: [],
    objetivo_general: '',
    objetivos_especificos_json: [],
    cronograma_json: [],
    evaluacion_json: [],
    current_step: 1,
    status: 'draft',
    ...overrides,
  };
}

const PLANTELES: PipsPlantele[] = [
  { no: 1, cct: '21EBH0001X', nombre: 'Bachillerato 001', localidad: 'Atlixco', municipio: 'Atlixco', hombres: 100, mujeres: 95, total: 195 },
  { no: 2, cct: '21EBH0002Y', nombre: 'Bachillerato 002', localidad: 'Izucar', municipio: 'Izucar de Matamoros', hombres: 80, mujeres: 85, total: 165 },
  { no: 3, cct: '21EBH0003Z', nombre: 'Bachillerato 003', localidad: 'Chietla', municipio: 'Chietla', hombres: 60, mujeres: 58, total: 118 },
];

const OBJETIVOS: PipsObjetivo[] = [
  {
    id: 'obj-1',
    numero: 1,
    descripcion: 'Mejorar los indicadores de aprobacion y eficiencia terminal en los planteles de la zona mediante estrategias de acompanamiento tecnico-pedagogico.',
    metas: [
      { meta: 'Reducir reprobacion al 18%', indicador: 'Porcentaje de reprobacion', responsable: 'Supervisor', fecha: 'Enero 2027' },
      { meta: 'Elevar ET al 80%', indicador: 'Eficiencia Terminal', responsable: 'Supervisor', fecha: 'Julio 2027' },
    ],
  },
  {
    id: 'obj-2',
    numero: 2,
    descripcion: 'Fortalecer las practicas pedagogicas docentes mediante ATP de acompanamiento bimestral en cada plantel de la zona escolar.',
    metas: [
      { meta: 'Realizar 6 ATPs bimestrales', indicador: 'Numero de ATPs realizadas', responsable: 'ATP zonal', fecha: 'Junio 2027' },
    ],
  },
];

const CRONOGRAMA: PipsCronogramaActividad[] = [
  {
    actividad: 'Visita de diagnostico inicial a planteles de la zona',
    objetivo: 'Objetivo 1',
    responsable: 'Supervisor',
    mes: 'Agosto 2026',
    recursos: 'Vehiculo oficial, instrumentos de observacion',
    indicador: 'Lista de asistencia firmada por director',
  },
  {
    actividad: 'ATP de lectura y escritura en planteles con mayor rezago',
    objetivo: 'Objetivo 2',
    responsable: 'ATP Zonal',
    mes: 'Septiembre 2026',
    recursos: 'Material bibliografico MCCEMS, proyector',
    indicador: 'Numero de docentes participantes',
  },
  {
    actividad: 'Seguimiento bimestral de indicadores academicos',
    objetivo: 'Objetivo 1',
    responsable: 'Supervisor y directores',
    mes: 'Octubre 2026',
    recursos: 'Formato de seguimiento DBEPA',
    indicador: 'Reporte estadistico comparativo mensual',
  },
  {
    actividad: 'Reunion tecnica de directivos para analisis de resultados parciales',
    objetivo: 'Objetivo 1',
    responsable: 'Supervisor',
    mes: 'Noviembre 2026',
    recursos: 'Sala de juntas, formatos de analisis DBEPA',
    indicador: 'Acta de reunion con compromisos firmada por directores',
  },
];

const COMPLETE_PROJECT: PipsProject = makeMinimalProject({
  zona_clave: 'Z-012',
  zona_nombre: 'Zona Escolar 012 — Atlixco',
  supervisor_name: 'Lic. Carmen Diaz Morales',
  municipio_sede: 'Atlixco, Puebla',
  municipios_atiende: 'Atlixco, Izucar de Matamoros, Chietla, Tlapala',
  num_planteles: 3,
  subsistema: 'DGB',
  modalidad: 'Presencial',
  ciclo_escolar: '2026-2027',
  atps: 'Mtro. Jorge Ruiz, Mtra. Adriana Lopez',
  presentacion_supervisor:
    'Licenciada en Ciencias de la Educacion con 15 anios de experiencia en supervision escolar de nivel medio superior en la DBEPA Puebla. Ha coordinado programas de mejora continua y acompanamiento pedagogico en 12 planteles de la region Mixteca.',
  pips_anterior_realizado: true,
  reflexion_pips_anterior:
    'El PIPS 2025-2026 logro reducir la reprobacion promedio de la zona en 3 puntos porcentuales mediante el programa de tutoria entre pares y los circulos de lectura bimestral.',
  fortalezas_anterior: 'Alta participacion docente en ATPs y compromiso directivo con el seguimiento de indicadores.',
  areas_oportunidad_anterior: 'Fortalecer la documentacion de evidencias y sistematizar los reportes bimestrales de cada plantel.',
  planteles_json: PLANTELES,
  diagnostico_contexto:
    'La zona atiende 3 planteles ubicados en municipios con alta marginacion. El promedio de eficiencia terminal zonal es 72%, por debajo de la media estatal de 78%.',
  problematicas_json: [
    {
      id: 'prob-1',
      titulo: 'Rezago academico en matematicas',
      descripcion: 'El 34% de los estudiantes de primer semestre presentan niveles de logro insuficientes en pensamiento matematico.',
      prioridad: 'alta',
      planteles_afectados: ['21EBH0001X', '21EBH0002Y'],
    } as PipsProblematica,
    {
      id: 'prob-2',
      titulo: 'Ausentismo docente',
      descripcion: 'Se registra un promedio de 2.4 dias de ausentismo docente por mes por plantel, afectando la continuidad pedagogica.',
      prioridad: 'media',
    } as PipsProblematica,
  ],
  objetivo_general:
    'Fortalecer los indicadores de logro academico y convivencia escolar en los 3 planteles de la zona mediante acompanamiento tecnico-pedagogico sistematico y participacion comunitaria activa durante el ciclo 2026-2027.',
  objetivos_especificos_json: OBJETIVOS,
  cronograma_json: CRONOGRAMA,
  evaluacion_json: [
    { indicador: 'Tasa de aprobacion promedio zonal', meta: '85%', instrumento: 'Formato estadistico DBEPA' },
    { indicador: 'Numero de ATPs realizadas', meta: '6 por semestre', instrumento: 'Lista de asistencia firmada' },
  ],
  current_step: 8,
  status: 'completed',
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('pips-quality-gate — calculateGlobalPipsScore', () => {

  it('proyecto vacio (strings vacios, listas vacias) -> REQUIERE_REVISION', () => {
    const project = makeMinimalProject();
    const audit = calculateGlobalPipsScore(project);

    expect(audit.overallStatus).toBe('REQUIERE_REVISION');
    expect(audit.percentage).toBeLessThan(50);
    expect(audit.passedCriteria).toBe(0);
    expect(audit.criteria).toHaveLength(7); // PIPS tiene 7 criterios
  });

  it('proyecto completo -> overallStatus SATISFACTORIO o superior (score >= 70%)', () => {
    const audit = calculateGlobalPipsScore(COMPLETE_PROJECT);
    // El fixture rico cubre C1-C7 -> al menos SATISFACTORIO (>=70%) garantizado
    expect(audit.percentage).toBeGreaterThanOrEqual(70);
    expect(['EXCELENTE', 'SATISFACTORIO']).toContain(audit.overallStatus);
    expect(audit.criteria).toHaveLength(7);
    expect(typeof audit.auditedAt).toBe('string');
  });

  it('planteles_json con 3+ entradas -> criterio C3 en pass', () => {
    const project = makeMinimalProject({ planteles_json: PLANTELES });
    const audit = calculateGlobalPipsScore(project);
    const c3 = audit.criteria.find(c => c.id === 'PIPS-C3');
    expect(c3).toBeDefined();
    expect(c3!.status).toBe('pass');
  });

  it('planteles_json vacio -> criterio C3 en fail', () => {
    const project = makeMinimalProject({ planteles_json: [] });
    const audit = calculateGlobalPipsScore(project);
    const c3 = audit.criteria.find(c => c.id === 'PIPS-C3');
    expect(c3).toBeDefined();
    expect(c3!.status).toBe('fail');
  });

  it('objetivos con 2+ entradas y metas -> criterio C5 en pass', () => {
    const project = makeMinimalProject({
      objetivo_general: 'Mejorar indicadores de logro y convivencia en la zona escolar durante 2026-2027.',
      objetivos_especificos_json: OBJETIVOS,
    });
    const audit = calculateGlobalPipsScore(project);
    const c5 = audit.criteria.find(c => c.id === 'PIPS-C5');
    expect(c5).toBeDefined();
    expect(c5!.status).toBe('pass');
  });

  it('cronograma con 3+ actividades -> criterio C6 en pass', () => {
    const project = makeMinimalProject({ cronograma_json: CRONOGRAMA });
    const audit = calculateGlobalPipsScore(project);
    const c6 = audit.criteria.find(c => c.id === 'PIPS-C6');
    expect(c6).toBeDefined();
    expect(c6!.status).toBe('pass');
  });

  it('formatPipsAuditReport genera reporte con PIPS y score porcentual', () => {
    const audit = calculateGlobalPipsScore(COMPLETE_PROJECT);
    const report = formatPipsAuditReport(audit);
    expect(typeof report).toBe('string');
    expect(report).toContain('PIPS');
    expect(report).toContain('%');
    expect(report).toContain(PIPS_DIMENSIONS.DIM1);
  });

});
