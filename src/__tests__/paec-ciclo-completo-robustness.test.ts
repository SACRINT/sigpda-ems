/**
 * paec-ciclo-completo-robustness.test.ts
 *
 * Suite integral de pruebas de integración y robustez para el ciclo completo de PAEC (Items B1 a B5).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getTeacherByEmail: vi.fn(),
  getPaecProjectById: vi.fn(),
  updatePaecProjectStep: vi.fn(),
  updatePaecQualityAudit: vi.fn(),
  getProgramsCatalogForPaec: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@/lib/ai-provider', () => ({
  generateWithRotation: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock('@/lib/idempotency', () => ({
  extractIdempotencyKey: vi.fn(() => null),
  checkIdempotencyKey: vi.fn(async () => null),
  createIdempotencyKey: vi.fn(),
}));

vi.mock('@/lib/context-extractor', () => ({
  getUserLibraryContext: vi.fn(async () => ''),
}));

import { auth } from '@/lib/auth';
import { getTeacherByEmail, getPaecProjectById, updatePaecProjectStep, sql } from '@/lib/db';
import { generateWithRotation } from '@/lib/ai-provider';
import { POST } from '@/app/api/paec/[id]/generate-step/route';
import {
  buildPrompt1Diagnostico,
  buildStatisticalBaselinePromptBlock,
  type PaecAcademicBaseline,
} from '@/lib/prompts/paec-prompts';
import {
  setCachedPaecBlock,
  getCachedPaecBlock,
  invalidatePaecStepCache,
} from '@/app/[locale]/paec/nuevo/PaecWizardClient';
import { getZoneContextForSchool } from '@/lib/zone-sync-service';
import { formatZoneMetric } from '@/lib/zone-metric-format';
import { validatePaecStepResult, calculateGlobalPaecScore } from '@/lib/paec-quality-gate';

describe('B6: Suite de Integración y Robustez para Ciclo Completo PAEC (B1-B5)', () => {
  const mockTeacher = {
    id: 'teacher-paec-full-1',
    email: 'docente.robustez@puebla.gob.mx',
    name: 'Mtra. Elena Vázquez',
  };

  const fullBaseProject = {
    id: 'paec-full-cycle-uuid',
    teacher_id: mockTeacher.id,
    project_name: 'Rescate de Saberes Comunitarios y Cuenca del Río Nexapa',
    problem_statement: 'Deterioro ambiental y pérdida de memoria biocultural comunitaria',
    cycle_type: 'annual',
    school_context: {
      cct: '21EBH0004Z',
      schoolName: 'Bachillerato General Moisés Sáenz',
      academicBaseline: {
        eficienciaTerminal: 87.4,
        promEficienciaZona: 82.1,
        problematicasComunesZona: ['Rezago en lectoescritura', 'Déficit en infraestructura'],
      },
    },
    fase1_diagnostico: null,
    fase2_justificacion: null,
    fase2_cronograma: [],
    fase3_plan_operativo_a: [{ uacName: 'Lengua y Comunicación', semestre: '1' }],
    fase3_plan_operativo_b: [{ uacName: 'Pensamiento Matemático', semestre: '2' }],
    fase3_implementacion: null,
    fase4_gobernanza_e_informe: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: mockTeacher.email } } as never);
    vi.mocked(getTeacherByEmail).mockResolvedValue(mockTeacher as never);
  });

  // ── INTEGRACIÓN B1: LÍNEA BASE ESTADÍSTICA ──────────────────────────────────
  it('[B1] Inyección estadística limpia: Inyecta métricas reales y excluye estrictamente métricas ausentes sin defaults 0%', () => {
    const baselineWithMissingAbandono: PaecAcademicBaseline = {
      eficienciaTerminal: 88.5,
      promEficienciaZona: 81.3,
      problematicasComunesZona: ['Contaminación hídrica'],
    };

    const prompt = buildPrompt1Diagnostico(
      '{"location": "Izúcar de Matamoros"}',
      '{"schoolName": "Bachillerato General"}',
      'Contaminación del río Nexapa',
      baselineWithMissingAbandono
    );

    // Debe contener el bloque oficial
    expect(prompt).toContain('LÍNEA BASE ESTADÍSTICA OFICIAL (911/F11 y Cartografía de Zona)');
    expect(prompt).toContain('Eficiencia terminal del plantel: 88.5%');
    expect(prompt).toContain('Promedio de eficiencia terminal de la zona: 81.3%');
    expect(prompt).toContain('Problemáticas comunes reportadas en la zona: Contaminación hídrica');

    // No debe contener 0% ni etiquetas de abandono falsas
    expect(prompt).not.toContain('0%');
    expect(prompt).not.toContain('0% de abandono');
    expect(prompt).not.toContain('Tasa de abandono escolar del plantel:');

    const block = buildStatisticalBaselinePromptBlock(baselineWithMissingAbandono);
    expect(block).not.toContain('abandono');
  });

  // ── INTEGRACIÓN B2: CHUNKING Y CHECKPOINTS PASO 8 & 9 ───────────────────────
  it('[B2] Resiliencia ante fallos transitorios: Guarda checkpoints en BD y completa bloques restantes', async () => {
    vi.mocked(getPaecProjectById).mockResolvedValue({ ...fullBaseProject } as never);

    const b1Data = JSON.stringify({
      cartaInvitacion: {
        asunto: 'Convocatoria Comunitaria',
        cuerpo: 'Convocatoria formal para la asamblea de instalación del comité PAEC.',
        firmante: 'Dirección del Plantel',
      },
      minutaArranque: {
        cct: '21EBH0004Z',
        acuerdos: [{ no: 1, acuerdo: 'Instalación de brigadas', responsable: 'Comité PAEC', fechaLimite: 'Semana 2', estatus: 'Cumplido' }],
        firmas: [{ cargo: 'Director', nombre: 'Roberto Mendoza' }],
      },
      oficiosAliados: [
        {
          destinatario: 'Alcaldía Municipal',
          asunto: 'Vinculación de apoyo territorial',
          propuestaColaboracion: 'Apoyo con equipamiento técnico para jornadas comunitarias.',
        },
      ],
      sesionLanzamiento: {
        fecha: 'Octubre 2026',
        dinamica: 'Asamblea general escolar',
        participantes: 'Comunidad estudiantil',
        acuerdosEstudiantiles: ['Compromiso activo'],
      },
    });

    const b2Data = JSON.stringify({
      anexo1Minuta: {
        cct: '21EBH0004Z',
        tipoReunion: 'Asamblea Anexo 1',
        acuerdos: [{ no: 1, acuerdo: 'Acuerdo Anexo', responsable: 'Comité PAEC', fechaLimite: 'Semana 4', estatus: 'Cumplido' }],
        firmas: [{ cargo: 'Director', nombre: 'Roberto Mendoza' }],
      },
      anexo2Seguimiento: [
        {
          semana: 'Semana 1',
          fase: 'Fase 1',
          uac: 'Lengua y Comunicación',
          metaOperativa: 'Encuestas comunitarias',
          evidencia: 'Cuestionarios capturados',
          avancePorcentaje: 100,
          semaforo: 'verde',
        },
      ],
      anexo3ReporteMensual: {
        periodo: 'Octubre 2026',
        resumenEjecutivo: 'Reporte del primer mes de operación comunitaria con 92% de avance.',
        logros: ['Instalación formal de comités'],
        dificultades: ['Coordinación de tiempos'],
        accionesAjuste: ['Ajuste de cronograma'],
      },
    });

    const b3Data = JSON.stringify({
      anexo4ImpactoComunidad: {
        titulo: 'Cuestionario de Impacto en Comunidad',
        tipoAplicacion: 'PRE/POST',
        reactivos: [{ reactivo: 'La problemática fue atendida', dimension: 'Impacto' }],
      },
      anexo5AutoevaluacionEstudiantes: {
        titulo: 'Rúbrica de Autoevaluación',
        tipoAplicacion: 'FINAL',
        reactivos: [{ reactivo: 'Participé en el proyecto', dimension: 'Participación' }],
      },
      anexo6EvaluacionColegiado: {
        titulo: 'Evaluación del Colegiado Docente',
        tipoAplicacion: 'FINAL',
        reactivos: [{ reactivo: 'Transversalidad lograda', dimension: 'Metodología' }],
      },
    });

    // Simulamos que Bloque 1 pasa, Bloque 2 se reintenta 1 vez y pasa, Bloque 3 pasa a la primera
    vi.mocked(generateWithRotation)
      .mockResolvedValueOnce(b1Data)
      .mockRejectedValueOnce(new Error('Transient AI Provider Timeout'))
      .mockResolvedValueOnce(b2Data)
      .mockResolvedValueOnce(b3Data);

    const req = new NextRequest('http://localhost:3000/api/paec/paec-full-cycle-uuid/generate-step', {
      method: 'POST',
      body: JSON.stringify({ step: 8 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'paec-full-cycle-uuid' }) });
    expect(res.status).toBe(200);

    // Se guardaron checkpoints de los 3 bloques + guardado consolidado final del paso
    expect(updatePaecProjectStep).toHaveBeenCalledTimes(4);

    const payload = await res.json();
    expect(payload.success).toBe(true);
    expect(payload.data.cartaInvitacion).toBeDefined();
    expect(payload.data.anexos.anexo2Seguimiento).toHaveLength(1);
    expect(payload.data.anexos.anexo4ImpactoComunidad).toBeDefined();
    expect(payload.stepAudit).toBeDefined();
  });

  // ── INTEGRACIÓN B3: QUALITY GATE Y 23 CRITERIOS ─────────────────────────────
  it('[B3] Quality Gate evaluativo: Evalúa rúbrica de 23 criterios y calcula estatus y puntaje normalizado', () => {
    // Evaluación de Paso 1
    const testFase1 = {
      tabla1: [
        { col1: 'Ubicacion geografica', col2: 'El plantel se encuentra en la periferia sur de la ciudad de Puebla, municipio con 1,500,000 habitantes segun censo INEGI.' },
        { col1: 'Perfil socioeconomico', col2: 'El 65% de los estudiantes provienen de familias de ingreso bajo con $4,500 pesos mensuales promedio.' },
        { col1: 'Contexto cultural', col2: 'Fuerte presencia de tradicion artesanal local en textiles, representando un potencial de vinculacion comunitaria.' },
        { col1: 'Salud comunitaria', col2: 'Alta incidencia de diabetes en 35% de adultos mayores de la comunidad, oportunidad para huerta comunitaria.' },
      ],
      tabla2: [
        { col1: 'Matricula actual', col2: 'El plantel cuenta con 347 estudiantes matriculados en 12 grupos de 1er a 6to semestre con 18 docentes activos.' },
        { col1: 'Plantilla docente', col2: '24 docentes activos con 75% titulares en el CCT 21EBH0004Z.' },
        { col1: 'Indicadores de logro', col2: 'Tasa de aprobacion de 88% y abandono escolar del 3.5% segun estadistica 911.' },
      ],
      tabla3: [
        { aspect: 'Fortaleza', analysis: 'Cuerpo docente comprometido con actualizacion permanente y participacion activa en CTE (cruce FO-DO).' },
        { aspect: 'Oportunidad', analysis: 'Red de aliados comunitarios con convenio para estrategia maestra adaptativa.' },
        { aspect: 'Debilidad', analysis: 'Infraestructura de laboratorios con equipamiento limitado para 6 aulas didacticas.' },
        { aspect: 'Amenaza', analysis: 'Migracion juvenil hacia el norte.' },
      ],
      tabla4: [
        { col1: 'Etapa 1', col2: 'Recuperacion y deteccion de problematicas comunitarias prioritarias.' },
        { col1: 'Etapa 2', col2: 'Analisis colegiado y deliberacion de prioridades en CTE.' },
        { col1: 'Etapa 3', col2: 'Seleccion colegiada del problema central por consenso docente.' },
      ],
    };

    const auditStep1 = validatePaecStepResult(1, testFase1);
    expect(auditStep1.score).toBeGreaterThanOrEqual(70);
    expect(auditStep1.criterios).toHaveLength(4);
    expect(auditStep1.criterios.map((c) => c.id)).toEqual([1, 2, 3, 4]);

    // Evaluación Global
    const globalAudit = calculateGlobalPaecScore({
      ...fullBaseProject,
      fase1Diagnostico: testFase1 as never,
    } as never);

    expect(globalAudit.criterios).toHaveLength(23);
    expect(globalAudit.score).toBeGreaterThan(0);
    expect(globalAudit.summary).toBeDefined();
    expect(typeof globalAudit.summary?.passedCount).toBe('number');
  });

  // ── INTEGRACIÓN B4: CACHÉ GRANULAR POR BLOQUE ──────────────────────────────
  it('[B4] Aislamiento de caché por bloque: Modificar o invalidar un bloque no destruye los datos de los bloques vecinos', () => {
    const storage: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, val: string) => { storage[key] = val; }),
      removeItem: vi.fn((key: string) => { delete storage[key]; }),
      clear: vi.fn(() => { for (const k of Object.keys(storage)) delete storage[k]; }),
      get length() { return Object.keys(storage).length; },
      key: vi.fn((i: number) => Object.keys(storage)[i] ?? null),
    };
    vi.stubGlobal('window', { localStorage: mockLocalStorage });

    const pId = 'proj-granular-test';
    setCachedPaecBlock(pId, 9, 1, { gobernanza: 'Calendario bimestral' });
    setCachedPaecBlock(pId, 9, 2, { informe: 'Supervisión 004' });

    // Invalidar solo Bloque 1
    invalidatePaecStepCache(pId, { targetStep: 9, targetBlock: 1 });

    expect(getCachedPaecBlock(pId, 9, 1)).toBeNull();
    expect(getCachedPaecBlock(pId, 9, 2)).toEqual({ informe: 'Supervisión 004' });
  });

  // ── INTEGRACIÓN B5: GUARDS DEFENSIVOS N/D DE MÉTRICAS DE ZONA ───────────────
  it('[B5] Paridad defensiva: Maneja de forma segura planteles sin estadísticas sin inyectar 0%, NaN% ni excepciones', async () => {
    const mockRow = {
      id: 'pips-defensive-99',
      zona_nombre: 'Zona 004',
      planteles_json: [
        {
          cct: '21EBH0555X',
          nombre: 'Plantel Rural de Nueva Creación',
          matricula: 28,
          // abandono y eficiencia no registrados
        },
      ],
    };

    const mockSql = vi.fn().mockResolvedValue([mockRow]);
    vi.mocked(sql).mockReturnValue(mockSql as never);

    const zoneCtx = await getZoneContextForSchool('21EBH0555X');
    expect(zoneCtx.found).toBe(true);
    expect(zoneCtx.plantel?.cct).toBe('21EBH0555X');

    // Métricas ausentes deben ser undefined, nunca 0 o NaN
    expect(zoneCtx.plantel?.abandono).toBeUndefined();
    expect(zoneCtx.plantel?.eficienciaTerminal).toBeUndefined();
    expect(zoneCtx.plantel?.reprobacion).toBeUndefined();

    // Comportamiento del renderizado seguro con helper compartido real:
    expect(formatZoneMetric(zoneCtx.plantel?.abandono, { pct: true })).toBe('N/D');
    expect(formatZoneMetric(zoneCtx.plantel?.eficienciaTerminal, { pct: true })).toBe('N/D');
    expect(formatZoneMetric(0, { pct: true })).toBe('0%');
    expect(formatZoneMetric(0)).toBe('0');
    expect(formatZoneMetric(4.5, { pct: true })).toBe('4.5%');
  });
});
