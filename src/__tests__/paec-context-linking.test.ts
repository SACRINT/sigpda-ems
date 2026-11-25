/**
 * H-322 — Vinculación PAEC ↔ Planeación: emparejamiento por UAC con esquema real y legado.
 * Regresión: el matching anterior hacía `'x'.includes('')` === true y enlazaba la primera fila
 * del plan operativo a cualquier UAC (con actividad vacía) cuando la fila usaba `uac`/`activity`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockRows: Array<Record<string, unknown>> = [];
const mockSql = vi.fn(() => Promise.resolve(mockRows));
vi.mock('@/lib/db', () => ({ sql: () => mockSql }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import {
  uacMatches,
  flattenPlanOperativo,
  matchOperationalActivity,
  matchOperationalActivities,
  matchCurricularMapping,
  loadPaecContext,
} from '@/lib/paec-context';

const rowReal = (uac: string, activity: string, extra: Record<string, string> = {}) => ({
  phase: 'Fase 2: Diagnóstico (Sep-Oct)', activity, uac, progression: 'Prog X', strategy: 'ABR',
  week: '3', responsibles: 'Docente', evaluationInstrument: 'Rúbrica', ...extra,
});

describe('H-322 — uacMatches', () => {
  it('ignora acentos y mayúsculas', () => {
    expect(uacMatches('PENSAMIENTO MATEMÁTICO I', 'Pensamiento Matematico I')).toBe(true);
  });
  it('nunca coincide con vacío (bug includes(""))', () => {
    expect(uacMatches('', 'Física')).toBe(false);
    expect(uacMatches('Física', '')).toBe(false);
    expect(uacMatches('', '')).toBe(false);
  });
  it('UACs distintas no coinciden', () => {
    expect(uacMatches('Física', 'Historia de México')).toBe(false);
  });
  it('empareja tolerando stopwords como "de", acentos, anclas y numeración romana vs arábiga', () => {
    expect(uacMatches('Taller Pensamiento Variacional I', 'Taller de Pensamiento Variacional I')).toBe(true);
    expect(uacMatches('Taller de Pensamiento Variacional I', 'Taller Pensamiento Variacional I')).toBe(true);
    expect(uacMatches('Dibujo Técnico I', 'Dibujo Tecnico 1')).toBe(true);
    expect(uacMatches('⟦T08·R01·C01⟧ Dibujo Técnico I', 'Dibujo Técnico I')).toBe(true);
    expect(uacMatches('Química II', 'Quimica 2')).toBe(true);
  });
  it('nunca empareja niveles romanos distintos (ej. II vs I)', () => {
    expect(uacMatches('Conciencia Histórica II', 'Conciencia Histórica I')).toBe(false);
    expect(uacMatches('Ciencias Sociales II', 'Ciencias Sociales I')).toBe(false);
    expect(uacMatches('Pensamiento Matemático III', 'Pensamiento Matemático II')).toBe(false);
  });
});

describe('Fase C — matchOperationalActivities (trayectoria completa por corte vía curricular-blocks)', () => {
  it('devuelve todas las actividades ordenadas por semana y mapeadas a Corte 1/2/3', () => {
    const rows = [
      rowReal('Pensamiento Matemático I', 'Evaluación final comunitaria', { week: '16', phase: 'Fase 3', progression: 'Propósito Formativo 7: Modela.' }),
      rowReal('Pensamiento Matemático I', 'Diagnóstico inicial con encuestas', { week: '2', phase: 'Fase 1', progression: 'Propósito Formativo 1: Clasifica.' }),
      rowReal('Pensamiento Matemático I', 'Diseño de modelo de costos', { week: '8', phase: 'Fase 2', progression: 'Propósito Formativo 4: Calcula.' }),
    ];
    const acts = matchOperationalActivities(rows, 'Pensamiento Matemático I', { totalCurricularActivities: 7 });
    expect(acts).toHaveLength(3);
    expect(acts.map((a) => a.semana)).toEqual(['Semana 2', 'Semana 8', 'Semana 16']);
    expect(acts.map((a) => a.corte)).toEqual([1, 2, 3]);
  });
});

describe('H-322 — flattenPlanOperativo', () => {
  it('acepta arreglo, {semestreA, semestreB} y valores inválidos', () => {
    expect(flattenPlanOperativo([{ a: 1 }])).toHaveLength(1);
    expect(flattenPlanOperativo({ semestreA: [{ a: 1 }], semestreB: [{ b: 2 }, { c: 3 }] })).toHaveLength(3);
    expect(flattenPlanOperativo(null)).toEqual([]);
    expect(flattenPlanOperativo('x')).toEqual([]);
  });
});

describe('H-322 — matchOperationalActivity', () => {
  it('encuentra la fila de la UAC en el esquema REAL (uac/activity/...)', () => {
    const rows = [rowReal('Historia de México', 'Línea del tiempo comunitaria'), rowReal('Física', 'Medición de caudal del río', { week: '5' })];
    const act = matchOperationalActivity(rows, 'Física')!;
    expect(act.actividad).toBe('Medición de caudal del río');
    expect(act.semana).toBe('Semana 5');
    expect(act.estrategiaDidactica).toBe('ABR');
    expect(act.progresion).toBe('Prog X');
    expect(act.fase).toContain('Fase 2');
    expect(act.asignatura).toBe('Física');
    expect(act.isPrescheduled).toBe(true);
  });

  it('sigue soportando el esquema legado', () => {
    const act = matchOperationalActivity(
      [{ asignatura: 'Química', actividad: 'Análisis de agua', semana: 'Semanas 2-3', estrategiaDidactica: 'ABP', progresion: 'P' }],
      'Química'
    )!;
    expect(act.actividad).toBe('Análisis de agua');
    expect(act.semana).toBe('Semanas 2-3');
  });

  it('NO enlaza otra UAC ni filas sin UAC o sin actividad (regresión)', () => {
    expect(matchOperationalActivity([rowReal('Historia de México', 'X')], 'Física')).toBeNull();
    expect(matchOperationalActivity([{ activity: 'Sin UAC' }], 'Física')).toBeNull();
    expect(matchOperationalActivity([rowReal('Física', '')], 'Física')).toBeNull();
    expect(matchOperationalActivity([rowReal('Física', 'X')], '')).toBeNull();
  });

  it('ignora filas de ruido donde la actividad es idéntica a la asignatura y devuelve la oficial', () => {
    const rows = [
      { uac: 'Dibujo Técnico I', activity: 'Dibujo Técnico I', week: '1' },
      { uac: 'Dibujo Técnico I', activity: 'Mapeo participativo y levantamiento de datos espaciales preliminares', week: '2' },
    ];
    const act = matchOperationalActivity(rows, 'Dibujo Técnico I')!;
    expect(act).not.toBeNull();
    expect(act.actividad).toBe('Mapeo participativo y levantamiento de datos espaciales preliminares');
    expect(act.semana).toBe('Semana 2');
  });

  it('descarta una extracción donde la actividad es el nombre de otra asignatura del PAEC', () => {
    const rows = [
      rowReal('Ciencias Naturales, Experimentales y Tecnología I', 'Indagación sobre mezclas'),
      rowReal('Prepara materiales para mezclas', 'Ciencias Naturales, Experimentales y Tecnología I'),
    ];
    expect(matchOperationalActivity(rows, 'Prepara materiales para mezclas')).toBeNull();
  });
});

describe('H-322 — matchCurricularMapping', () => {
  const mapeo = [
    { semester: 1, uacName: 'Física', progressionsOrPurposes: 'Propósito 1', curricularJustification: 'Justifica A' },
    { semester: 3, uacName: 'Física', progressionsOrPurposes: 'Propósito 3', curricularJustification: 'Justifica B' },
  ];
  it('filtra por UAC y semestre con el esquema real', () => {
    expect(matchCurricularMapping(mapeo, 'Física', 3)).toEqual({ uacTopic: 'Propósito 3', uacLinking: 'Justifica B' });
  });
  it('soporta legado topic/linking y devuelve {} sin coincidencia', () => {
    expect(matchCurricularMapping([{ semester: 1, uacName: 'Arte', topic: 'T', linking: 'L' }], 'Arte', 1)).toEqual({ uacTopic: 'T', uacLinking: 'L' });
    expect(matchCurricularMapping(mapeo, 'Arte', 1)).toEqual({});
    expect(matchCurricularMapping([], '', undefined)).toEqual({});
  });
});

describe('H-322 — loadPaecContext', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('found:false sin CCT ni docente', async () => {
    expect((await loadPaecContext('', {})).found).toBe(false);
  });

  it('integra proyecto, plan operativo A/B y mapeo', async () => {
    mockRows = [{
      id: 'p1', project_name: 'Héroes de la Patria', problem_statement: 'Contaminación del río', cycle_type: 'anual',
      school_context: { cct: '21EBH0001A', nombre_escuela: 'BGE Zapata', municipio: 'Tehuacán' }, community_context: {},
      fase2_mapeo: [{ semester: 1, uacName: 'Física', progressionsOrPurposes: 'Propósito', curricularJustification: 'Justif' }],
      fase2_plan_operativo: null,
      fase3_plan_operativo_a: [rowReal('Historia', 'Otra')],
      fase3_plan_operativo_b: [rowReal('Física', 'Medición del caudal')],
    }];
    const ctx = await loadPaecContext('21ebh0001a', { uacName: 'Física', semester: 1 });
    expect(ctx.found).toBe(true);
    expect(ctx.projectName).toBe('Héroes de la Patria');
    expect(ctx.problemStatement).toBe('Contaminación del río');
    expect(ctx.schoolName).toBe('BGE Zapata');
    expect(ctx.operationalActivity?.actividad).toBe('Medición del caudal');
    expect(ctx.uacTopic).toBe('Propósito');
  });

  it('found:false si la BD falla (resiliente)', async () => {
    mockSql.mockRejectedValueOnce(new Error('db down'));
    expect((await loadPaecContext('21EBH0001A')).found).toBe(false);
  });
});
