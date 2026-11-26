// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StepUAC_BGE from '@/components/planeacion/StepUAC_BGE';
import { construirProgresionesResumidas } from '@/lib/curriculum-evidence-engine';
import { SYSTEM_PROMPT } from '@/lib/prompts/system-prompt';
import { buildUserPrompt } from '@/lib/prompts/build-prompt';
import type { ExtractedPdfData, TeacherContext } from '@/types/planning';
import type { ProgramCatalogItem } from '@/lib/db';

const FFEO_TALLER_CD = {
  id: 'ffeo-cd-1',
  uac_name: 'Taller de Cultura Digital I',
  semester: 4,
  component: 'ffeo',
  curriculum_name: 'Formación Fundamental Extendida Obligatoria',
  total_hours: 18,
  learning_outcome: 'Gestiona entornos digitales colaborativos y pensamiento algorítmico.',
  activities: [
    { order: 1, name: 'Diagnóstico y gestión de entornos digitales', hours: 4 },
    { order: 2, name: 'Curaduría digital y licenciamiento abierto', hours: 5 },
    { order: 3, name: 'Automatización básica con hojas de cálculo', hours: 5 },
    { order: 4, name: 'Proyecto digital comunitario', hours: 4 },
  ],
  contenidos_formativos: [
    { orden: 1, temas: ['Entornos digitales', 'Colaboración en la nube', 'Seguridad básica'] },
    { orden: 2, temas: ['Curaduría', 'Creative Commons', 'Derechos de autor'] },
    { orden: 3, temas: ['Fórmulas lógicas', 'Automatización', 'Tablas dinámicas'] },
    { orden: 4, temas: ['Prototipo comunitario', 'Documentación', 'Validación'] },
  ],
  evidences: ['Bitácora digital', 'Prototipo automatizado'],
};

const SEM3_CNET3 = {
  id: 'fund-cnet-3',
  uac_name: 'Ciencias Naturales, Experimentales y Tecnología III. Nuestro hogar. El sistema terrestre',
  semester: 3,
  component: 'fundamental',
  curriculum_name: 'Ciencias Naturales, Experimentales y Tecnología',
  total_hours: 72,
  learning_outcome: 'Comprende el sistema terrestre.',
  activities: [{ order: 1, name: 'Sistema terrestre', hours: 24 }],
  contenidos_formativos: [{ order: 1, contenidos: ['Geosfera', 'Atmósfera'] }],
  evidences: ['Informe científico'],
};

describe('Wizard BGE — restauración de borrador sin race condition + temas FFEO', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('espera a hidratar el borrador local (4° FFEO) sin contaminar con 3° Fundamental y cuenta temas FFEO reales', async () => {
    window.localStorage.setItem(
      'sigpda_draft_planeacion-uac-bge-bge',
      JSON.stringify({
        uacName: 'Taller de Cultura Digital I',
        semester: 4,
        component: 'ext_obligatorio',
        subsystem: 'bge',
        curriculumName: 'Formación Fundamental Extendida Obligatoria',
      })
    );

    const requestedUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        requestedUrls.push(url);
        if (url.includes('semester=4') && url.includes('component=ext_obligatorio')) {
          return {
            ok: true,
            json: async () => ({ programs: [FFEO_TALLER_CD] }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ programs: [SEM3_CNET3] }),
        } as Response;
      })
    );

    render(
      <StepUAC_BGE
        selectedSubsystem="bge"
        onSubsystemChange={vi.fn()}
        onNext={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('12 temas precargados')).toBeTruthy();
    });

    // Nunca debió solicitar 3° Semestre Fundamental antes de hidratar el borrador
    expect(requestedUrls.some((u) => u.includes('semester=3') && u.includes('component=fundamental'))).toBe(false);
    expect(requestedUrls.some((u) => u.includes('semester=4') && u.includes('component=ext_obligatorio'))).toBe(true);
    expect(screen.queryByText(/Nuestro hogar/i)).toBeNull();
    expect(screen.queryByText('0 temas precargados')).toBeNull();
  });

  it('ignora respuestas tardías (stale) al cambiar rápidamente de semestre/componente', async () => {
    let resolveSlowSem3!: (value: Response) => void;
    const slowSem3Promise = new Promise<Response>((resolve) => {
      resolveSlowSem3 = resolve;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('semester=3') && url.includes('component=fundamental')) {
          return slowSem3Promise;
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ programs: [FFEO_TALLER_CD] }),
        } as Response);
      })
    );

    render(
      <StepUAC_BGE
        selectedSubsystem="bge"
        onSubsystemChange={vi.fn()}
        onNext={vi.fn()}
      />
    );

    const selects = screen.getAllByRole('combobox');
    // selects[1] = Semestre, selects[2] = Componente Curricular
    fireEvent.change(selects[1], { target: { value: '4' } });
    fireEvent.change(selects[2], { target: { value: 'ext_obligatorio' } });

    await waitFor(() => {
      expect(screen.getByText('12 temas precargados')).toBeTruthy();
    });

    // Ahora llega tarde la respuesta obsoleta de 3° Fundamental: NO debe sobrescribir la UI
    resolveSlowSem3({
      ok: true,
      json: async () => ({ programs: [SEM3_CNET3] }),
    } as Response);

    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByText('12 temas precargados')).toBeTruthy();
    expect(screen.queryByText(/Nuestro hogar/i)).toBeNull();
  });
});

describe('FFEO contenidos_formativos (orden + temas) en construirProgresionesResumidas', () => {
  it('extrae orden y temas cuando el catálogo FFEO usa clave temas en lugar de contenidos', () => {
    const progs = construirProgresionesResumidas(
      FFEO_TALLER_CD.contenidos_formativos,
      FFEO_TALLER_CD.activities
    );
    expect(progs).toHaveLength(4);
    expect(progs[0].orden).toBe(1);
    expect(progs[0].contenidos).toEqual(['Entornos digitales', 'Colaboración en la nube', 'Seguridad básica']);
    expect(progs[3].orden).toBe(4);
    expect(progs[3].contenidos).toContain('Prototipo comunitario');
  });
});

describe('Contrato de las 7 secciones del prompt de planeación', () => {
  it('SYSTEM_PROMPT declara sectionIII.productoIntegrador, cargas 1–5h, ABProblemas/ABI y 8 procesos', () => {
    expect(SYSTEM_PROMPT).toContain('"productoIntegrador"');
    expect(SYSTEM_PROMPT).toContain('1 h/semana');
    expect(SYSTEM_PROMPT).toContain('2 h/semana');
    expect(SYSTEM_PROMPT).toContain('5 h/semana');
    expect(SYSTEM_PROMPT).toContain('Aprendizaje Basado en Problemas (ABProblemas)');
    expect(SYSTEM_PROMPT).toContain('Aprendizaje Basado en Indagación (ABI)');
    expect(SYSTEM_PROMPT).toContain('EXACTAMENTE los 8 objetos completos');
    expect(SYSTEM_PROMPT).toContain('"Elaboró"');
  });

  it('buildUserPrompt usa sectionIII.productoIntegrador, sectionV.evaluations y normaliza BGE 64h→72h sin contradicción', () => {
    const extracted: ExtractedPdfData = {
      uacName: 'Pensamiento Matemático IV. Trigonometría y geometría analítica',
      learningOutcome: 'Aplica trigonometría y geometría analítica a problemas situados.',
      totalHours: 64,
      activities: [
        { order: 1, name: 'Concepto de punto y recta', hours: 9 },
        { order: 2, name: 'Razones trigonométricas', hours: 9 },
        { order: 3, name: 'Ley de senos y cosenos', hours: 9 },
        { order: 4, name: 'Circunferencia en el plano', hours: 9 },
        { order: 5, name: 'Parábola', hours: 9 },
        { order: 6, name: 'Elipse', hours: 9 },
        { order: 7, name: 'Hipérbola y aplicaciones', hours: 10 },
      ],
      evidences: ['Problemario de trigonometría aplicada'],
      parseConfidence: 'high',
    };

    const officialProgram: ProgramCatalogItem = {
      uac_name: extracted.uacName,
      semester: 4,
      component: 'fundamental',
      subsystem: 'bge',
      total_hours: 64,
      learning_outcome: extracted.learningOutcome,
      activities: extracted.activities,
      evidences: extracted.evidences,
    };

    const context: TeacherContext = {
      teacherName: 'Samuel Cruz',
      schoolName: 'Bachillerato General Estatal',
      cct: '21EBH0123X',
      schoolZone: '086',
      municipality: 'Puebla',
      state: 'Puebla',
      region: 'Angelópolis',
      subsystem: 'bge',
      groupInfo: '4° A',
      applicationPeriod: 'Febrero - Julio 2027',
      paecProjectName: 'Uso responsable del agua',
      paecObjective: 'Optimizar la captación pluvial en el plantel',
      paecProblem: 'Escasez de agua potable en temporada de estiaje',
      schoolResources: 'Cuaderno, juego de geometría y calculadora',
      studentContext: 'Estudiantes de 4° semestre con interés práctico',
      metodologiaActiva: 'abproblemas',
    };

    const prompt = buildUserPrompt(extracted, context, 4, 'fundamental', officialProgram);

    expect(prompt).toContain('"sectionIII.productoIntegrador"');
    expect(prompt).not.toContain('transversalidad.productoIntegrador');
    expect(prompt).toContain('"sectionV.evaluations"');
    expect(prompt).toContain('EXACTAMENTE los 8 objetos completos');
    // BGE 4 h/sem × 18 semanas = 72h (24h por corte), sin contradicción de 64h / 21h
    expect(prompt).toContain('Carga Horaria Semestral TOTAL: 72 horas oficiales');
    expect(prompt).toContain('Corte 1: 24h, Corte 2: 24h, Corte 3: 24h');
    expect(prompt).not.toContain('Corte 1: 21h');
  });
});
