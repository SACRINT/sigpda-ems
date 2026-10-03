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
