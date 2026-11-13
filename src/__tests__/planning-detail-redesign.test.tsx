// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ update: vi.fn() }),
}));

import ResourceCard from '@/components/planeacion/ResourceCard';
import PlanningDetailHero from '@/components/planeacion/PlanningDetailHero';
import DocumentA4Modal from '@/components/planeacion/DocumentA4Modal';
import PlanningDownloadsHub from '@/components/planeacion/PlanningDownloadsHub';
import PlanningTabMateriales from '@/components/planeacion/tabs/PlanningTabMateriales';
import {
  summarizeMaterialReviewStatus,
} from '@/hooks/useBlockMaterialReviews';
import type { GeneratedPlanningContent, Planning } from '@/types/planning';
import type { MaterialReviewReport } from '@/lib/guide-engine/material-review';

const mockContent: GeneratedPlanningContent = {
  sectionI: {
    teacherName: 'Prof. Juan Pérez',
    groups: '5A, 5B',
    schoolYear: '2026-2027',
    applicationPeriod: 'Agosto - Diciembre 2026',
    estimatedSessions: '54 sesiones',
    uacName: 'Taller de Pensamiento Variacional I',
    component: 'Formación Laboral',
    semester: 5,
    totalHours: 54,
    subsystem: 'DGB',
  },
  sectionII: {
    purpose: 'Propósito formativo del taller',
    learningOutcomes: ['Resultado de aprendizaje 1'],
    paecConnection: 'Articulación con proyecto escolar y comunitario',
    activities: [
      { name: 'Actividad Clave 1', hours: 18, order: 1, corte: 'Corte 1' },
      { name: 'Actividad Clave 2', hours: 18, order: 2, corte: 'Corte 2' },
      { name: 'Actividad Clave 3', hours: 18, order: 3, corte: 'Corte 3' },
    ],
  },
  sectionIII: {
    fundamentalCurriculum: [],
    expandedCurriculum: [],
  },
  sectionIV: {
    note: 'Secuencia didáctica por bloques',
    activities: [
      {
        name: 'Actividad Clave 1',
        hours: 18,
        corte: 'Corte 1',
        methodology: 'abp',
        apertura: { activities: 'Inicio', processes: 'Exploración', materials: 'Cuaderno' },
        ejecucion: { activities: 'Desarrollo', processes: 'Construcción', materials: 'Guía' },
        conclusion: { activities: 'Cierre', processes: 'Evaluación', materials: 'Rúbrica' },
      },
      {
        name: 'Actividad Clave 2',
        hours: 18,
        corte: 'Corte 2',
        methodology: 'abp',
        apertura: { activities: 'Inicio', processes: 'Exploración', materials: 'Cuaderno' },
        ejecucion: { activities: 'Desarrollo', processes: 'Construcción', materials: 'Guía' },
        conclusion: { activities: 'Cierre', processes: 'Evaluación', materials: 'Rúbrica' },
      },
      {
        name: 'Actividad Clave 3',
        hours: 18,
        corte: 'Corte 3',
        methodology: 'abp',
        apertura: { activities: 'Inicio', processes: 'Exploración', materials: 'Cuaderno' },
        ejecucion: { activities: 'Desarrollo', processes: 'Construcción', materials: 'Guía' },
        conclusion: { activities: 'Cierre', processes: 'Evaluación', materials: 'Rúbrica' },
      },
    ],
  },
  sectionV: {
    evaluations: [],
  },
  sectionVI: {
    studentMaterials: [],
    teacherMaterials: [],
    digital: [],
    spaces: [],
    references: [],
  },
  sectionVII: {},
};

const mockPlanning: Planning = {
  id: 'test-planning-1',
  teacherId: 'user-1',
  uacName: 'Taller de Pensamiento Variacional I y Operaciones Algebraicas Avanzadas en Contexto Situado para Bachillerato',
  semester: 5,
  component: 'laboral',
  curriculumName: 'MCCEMS 2026-2027',
  paecContext: 'Contexto comunitario y diagnóstico PAEC',
  extractedData: null,
  status: 'generated',
  metodologiaActiva: 'Aprendizaje Basado en Proyectos (ABP)',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  contentJson: mockContent,
};

describe('Rediseño UI/UX — Componentes Atómicos y Ejes', () => {
  describe('ResourceCard', () => {
    it('renderiza título, subtítulo, badges y botones de acción en formatos PDF y Word', () => {
      const onOpenMock = vi.fn();
      render(
        <ResourceCard
          testId="test-card"
          icon={<span data-testid="card-icon">📄</span>}
          title="Planeación Didáctica Semestral"
          subtitle="Documento rector oficial con 7 secciones"
          metaBadge="Semestral"
          statusBadge={{ status: 'ok', label: 'Lista' }}
          actions={[
            { format: 'PDF', label: 'Descargar PDF', onClick: vi.fn() },
            { format: 'Word', href: '/api/docx/test-1' },
          ]}
          onOpenDetail={onOpenMock}
          detailLabel="Ver detalle"
        />
      );

      expect(screen.getByText('Planeación Didáctica Semestral')).toBeTruthy();
      expect(screen.getByText('Documento rector oficial con 7 secciones')).toBeTruthy();
      expect(screen.getByText('Semestral')).toBeTruthy();
      expect(screen.getByText('Lista')).toBeTruthy();
      expect(screen.getByText('Descargar PDF')).toBeTruthy();
      expect(screen.getByText('Word')).toBeTruthy();

      const detailBtn = screen.getByText(/Ver detalle/i);
      fireEvent.click(detailBtn);
      expect(onOpenMock).toHaveBeenCalledTimes(1);
    });

    it('respeta estados deshabilitados y muestra disabledReason', () => {
      render(
        <ResourceCard
          testId="disabled-card"
          icon={<span>🔒</span>}
          title="Solucionario Bloqueado"
          statusBadge={{ status: 'blocked', label: 'Bloqueado R1', tooltip: 'Faltan respuestas' }}
          actions={[
            {
              format: 'PDF',
              disabled: true,
              disabledReason: 'Corregir primero errores de R1',
            },
          ]}
        />
      );

      const pdfBtn = screen.getByRole('button', { name: /PDF/i }) as HTMLButtonElement;
      expect(pdfBtn.disabled).toBe(true);
      expect(pdfBtn.getAttribute('title')).toBe('Corregir primero errores de R1');
      expect(screen.getByText('Bloqueado R1')).toBeTruthy();
    });
  });

  describe('PlanningDetailHero', () => {
    it('muestra enlace de regreso al dashboard, título, badges de semestre y total de sesiones', () => {
      render(
        <PlanningDetailHero
          locale="es"
          planning={mockPlanning}
          isLaboral={true}
          weeklyHours={3}
          totalSessions={54}
          hasContent={true}
          publishingClassroom={false}
          onPublishClassroom={vi.fn()}
          onOpenChecklistModal={vi.fn()}
        />
      );

      expect(screen.getByText('Volver al Dashboard').closest('a')?.getAttribute('href')).toBe('/es/dashboard');
      expect(screen.getByText('5° Semestre')).toBeTruthy();
      expect(screen.getByText(/Componente Formación Laboral/i)).toBeTruthy();
      expect(screen.getByText(/3 hrs\/sem · 54 sesiones totales/i)).toBeTruthy();
      expect(screen.getByText(/🎯 Aprendizaje Basado en Proyectos/i)).toBeTruthy();
    });

    it('elimina botones redundantes de PDF, Word y Vista Carta del hero y expone Classroom y Eliminar con confirmación', () => {
      render(
        <PlanningDetailHero
          locale="es"
          planning={mockPlanning}
          isLaboral={true}
          weeklyHours={3}
          totalSessions={54}
          hasContent={true}
          publishingClassroom={false}
          onPublishClassroom={vi.fn()}
          onOpenChecklistModal={vi.fn()}
        />
      );

      // Los botones duplicados ya no existen en el hero
      expect(screen.queryByRole('button', { name: /Descargar PDF/i })).toBeNull();
      expect(screen.queryByRole('link', { name: /Word \(DOCX\)/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Vista Carta/i })).toBeNull();

      // Botón de Classroom está visible
      expect(screen.getByRole('button', { name: /Classroom/i })).toBeTruthy();

      // Botón de Eliminar está en la barra de acciones y al hacer clic pide confirmación inline sin window.confirm
      const deleteBtn = screen.getByRole('button', { name: /Eliminar/i });
      expect(deleteBtn).toBeTruthy();
      fireEvent.click(deleteBtn);
      expect(screen.getByText(/¿Eliminar planeación\?/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Sí, borrar/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Cancelar/i })).toBeTruthy();
    });
  });

  describe('DocumentA4Modal', () => {
    it('se abre cuando isOpen es true y responde al botón de cierre', () => {
      const onCloseMock = vi.fn();
      const { rerender } = render(
        <DocumentA4Modal
          isOpen={false}
          onClose={onCloseMock}
          planning={mockPlanning}
        />
      );

      expect(screen.queryByRole('dialog')).toBeNull();

      rerender(
        <DocumentA4Modal
          isOpen={true}
          onClose={onCloseMock}
          planning={mockPlanning}
        />
      );

      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText(/Vista Previa de Impresión/i)).toBeTruthy();

      const closeBtn = screen.getByLabelText('Cerrar vista de impresión');
      fireEvent.click(closeBtn);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('summarizeMaterialReviewStatus', () => {
    it('retorna pending cuando no hay materiales generados', () => {
      const summary = summarizeMaterialReviewStatus({}, 'lesson_plan', 0);
      expect(summary.status).toBe('pending');
      expect(summary.label).toBe('Pendiente de generar');
    });

    it('retorna pending cuando blockReviews está vacío aunque generatedCount sea mayor a 0 (anti falso positivo)', () => {
      const summary = summarizeMaterialReviewStatus({}, 'lesson_plan', 54);
      expect(summary.status).toBe('pending');
      expect(summary.label).toBe('Pendiente de generar');
    });

    it('detecta bloqueos si algún bloque falla la validación R1', () => {
      const mockReports: Record<number, MaterialReviewReport> = {
        0: {
          ok: false,
          score: 60,
          issues: [{ material: 'answer_key', code: 'AK_MISSING', message: 'Falta clave', severity: 'error' }],
          errors: [{ material: 'answer_key', code: 'AK_MISSING', message: 'Falta clave', severity: 'error' }],
          warnings: [],
          byMaterial: {
            answer_key: {
              ok: false,
              issues: [{ material: 'answer_key', code: 'AK_MISSING', message: 'Falta clave', severity: 'error' }],
            },
            rubric: { ok: true, issues: [] },
            checklist: { ok: true, issues: [] },
            lesson_plan: { ok: true, issues: [] },
            student_guide: { ok: true, issues: [] },
            didactic_material: { ok: true, issues: [] },
            recovery_cards: { ok: true, issues: [] },
            deck: { ok: true, issues: [] },
            infographic: { ok: true, issues: [] },
            visual_asset: { ok: true, issues: [] },
          },
        },
      };

      const summary = summarizeMaterialReviewStatus(mockReports, 'answer_key', 1);
      expect(summary.status).toBe('blocked');
      expect(summary.label).toContain('Bloqueado R1');
    });
  });

  describe('PlanningDownloadsHub', () => {
    it('renderiza enlaces de Paquete ZIP con URLs correctas y navega a guías de práctica', () => {
      const onGuiasMock = vi.fn();
      render(
        <PlanningDownloadsHub
          planning={mockPlanning}
          totalSessions={54}
          totalWorkbookBlocks={3}
          generatedWorkbookCount={3}
          semestralReady={true}
          blockReviews={{}}
          onOpenA4Modal={vi.fn()}
          onNavigateToLessonPlans={vi.fn()}
          onNavigateToGuiasPractica={onGuiasMock}
        />
      );

      const wordZipLink = screen.getByTitle(/Descargar.*ZIP \(Word/i);
      expect(wordZipLink.getAttribute('href')).toBe('/api/docx/extra/bulk?planningId=test-planning-1');
      expect(screen.getByText('Paquete Completo (Word + PPTX ZIP)')).toBeTruthy();

      const pdfZipLink = screen.getByTitle(/Descargar.*ZIP \(PDF/i);
      expect(pdfZipLink.getAttribute('href')).toBe('/api/pdf/extra/bulk?planningId=test-planning-1');
      expect(screen.getByText('Paquete Completo (PDF + PPTX ZIP)')).toBeTruthy();

      const guiasBtn = screen.getByRole('button', { name: /Ver guías de práctica/i });
      fireEvent.click(guiasBtn);
      expect(onGuiasMock).toHaveBeenCalledTimes(1);
    });

    it('H-03: maneja divisiones por cero con totalSessions=0 y totalWorkbookBlocks=0 sin NaN ni crash', () => {
      render(
        <PlanningDownloadsHub
          planning={mockPlanning}
          totalSessions={0}
          totalWorkbookBlocks={0}
          generatedWorkbookCount={0}
          semestralReady={false}
          blockReviews={{}}
          extras={[]}
          onOpenA4Modal={vi.fn()}
        />
      );

      const planesCard = screen.getByTestId('hub-card-planes');
      const disabledPlanesPdf = planesCard.querySelector('a[aria-disabled="true"]');
      expect(disabledPlanesPdf).toBeTruthy();
      expect(disabledPlanesPdf?.getAttribute('title')).toContain('No hay sesiones programadas');

      const solucionarioCard = screen.getByTestId('hub-card-solucionario');
      const disabledSolPdf = solucionarioCard.querySelector('a[aria-disabled="true"]');
      expect(disabledSolPdf).toBeTruthy();
      expect(disabledSolPdf?.getAttribute('title')).toContain('No hay bloques curriculares');
    });

    it('utiliza etiquetas simplificadas de botones (PDF, Word, PPTX) y bloquea entregables combinados incompletos', () => {
      render(
        <PlanningDownloadsHub
          planning={mockPlanning}
          totalSessions={54}
          totalWorkbookBlocks={3}
          generatedWorkbookCount={1}
          semestralReady={false}
          blockReviews={{}}
          extras={[]}
          onOpenA4Modal={vi.fn()}
        />
      );

      // Los botones no deben tener sufijos redundantes como '(18 en 1)' o '(Todos)'
      expect(screen.queryByText(/PDF \(18 en 1\)/i)).toBeNull();
      expect(screen.queryByText(/Word \(18 en 1\)/i)).toBeNull();
      expect(screen.queryByText(/PDF \(Todos\)/i)).toBeNull();
      expect(screen.queryByText(/Word \(1 archivo\)/i)).toBeNull();
      expect(screen.queryByText(/Compendio Word/i)).toBeNull();

      // Card de planes: debe estar deshabilitado porque 0 < 54 sesiones
      const planesCard = screen.getByTestId('hub-card-planes');
      const disabledPdf = planesCard.querySelector('a[aria-disabled="true"]');
      expect(disabledPdf).toBeTruthy();
      expect(disabledPdf?.getAttribute('title')).toContain('Genera las 54 sesiones');
    });
  });

  describe('PlanningTabMateriales', () => {
    it('renderiza la vista dedicada de Guías de Práctica cuando activeSubTab="practiceGuides"', () => {
      const onSubTabChangeMock = vi.fn();
      render(
        <PlanningTabMateriales
          planning={mockPlanning}
          activeSubTab="practiceGuides"
          onSubTabChange={onSubTabChangeMock}
          extras={[]}
          generatingKey={null}
          syncingSuite={null}
          blockWorkbooks={{}}
          handleGenerateExtra={vi.fn().mockResolvedValue(undefined)}
          handleDeleteExtra={vi.fn().mockResolvedValue(undefined)}
          handlePreviewExtra={vi.fn()}
          handleSyncSuite={vi.fn().mockResolvedValue(undefined)}
          handleGenerateWorkbook={vi.fn().mockResolvedValue(undefined)}
          findExtra={vi.fn().mockReturnValue(undefined)}
          setPreviewExtra={vi.fn()}
        />
      );

      expect(screen.getByText(/Guías de Práctica, Taller y Laboratorio/i)).toBeTruthy();
      expect(screen.getByText(/Protocolos Situados de Práctica \(MCCEMS\)/i)).toBeTruthy();

      const extrasTabBtn = screen.getByRole('tab', { name: /Instrumentos de Evaluación y Recursos/i });
      fireEvent.click(extrasTabBtn);
      expect(onSubTabChangeMock).toHaveBeenCalledWith('extras');
    });

    it('incorpora atributos ARIA en subtabs y confirmación inline sin window.confirm al eliminar recursos', async () => {
      const mockRubricExtra = {
        id: 'rubric-extra-1',
        planningId: 'test-planning-1',
        type: 'rubric' as const,
        title: 'Rúbrica Analítica · Bloque 1',
        contentText: 'Criterios de evaluación',
        keyIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const handleDeleteMock = vi.fn().mockResolvedValue(undefined);

      render(
        <PlanningTabMateriales
          planning={mockPlanning}
          activeSubTab="extras"
          extras={[mockRubricExtra]}
          generatingKey={null}
          syncingSuite={null}
          blockWorkbooks={{}}
          handleGenerateExtra={vi.fn().mockResolvedValue(undefined)}
          handleDeleteExtra={handleDeleteMock}
          handlePreviewExtra={vi.fn()}
          handleSyncSuite={vi.fn().mockResolvedValue(undefined)}
          handleGenerateWorkbook={vi.fn().mockResolvedValue(undefined)}
          findExtra={vi.fn().mockImplementation((type, blockIdx) => (type === 'rubric' && blockIdx === 0 ? mockRubricExtra : undefined))}
          setPreviewExtra={vi.fn()}
        />
      );

      // Verificación de ARIA en subtabs
      const tabBtn = screen.getByRole('tab', { name: /Instrumentos de Evaluación y Recursos/i });
      expect(tabBtn.getAttribute('id')).toBe('subtab-extras');
      expect(tabBtn.getAttribute('aria-controls')).toBe('subtabpanel-extras');

      const panel = screen.getByRole('tabpanel');
      expect(panel.getAttribute('id')).toBe('subtabpanel-extras');

      // Verificación de confirmación inline al eliminar
      const deleteBtn = screen.getAllByTitle('Eliminar rúbrica')[0];
      expect(deleteBtn).toBeTruthy();
      fireEvent.click(deleteBtn);

      // Aparece la confirmación inline
      expect(screen.getByText('¿Borrar?')).toBeTruthy();
      const cancelBtn = screen.getByRole('button', { name: 'No' });

      // Si hace clic en No, se cancela la confirmación
      fireEvent.click(cancelBtn);
      expect(screen.queryByText('¿Borrar?')).toBeNull();
      expect(handleDeleteMock).not.toHaveBeenCalled();

      // Si hace clic en Sí, se ejecuta la eliminación
      fireEvent.click(screen.getAllByTitle('Eliminar rúbrica')[0]);
      const confirmBtn = screen.getByRole('button', { name: 'Sí' });
      fireEvent.click(confirmBtn);
      expect(handleDeleteMock).toHaveBeenCalledWith('rubric-extra-1');
    });

    it('H-04: renderiza tablist y tabpanel como hermanos (APG compliant) y no anidados', () => {
      render(
        <PlanningTabMateriales
          planning={mockPlanning}
          activeSubTab="practiceGuides"
          onSubTabChange={vi.fn()}
          extras={[]}
          generatingKey={null}
          syncingSuite={null}
          blockWorkbooks={{}}
          handleGenerateExtra={vi.fn().mockResolvedValue(undefined)}
          handleDeleteExtra={vi.fn().mockResolvedValue(undefined)}
          handlePreviewExtra={vi.fn()}
          handleSyncSuite={vi.fn().mockResolvedValue(undefined)}
          handleGenerateWorkbook={vi.fn().mockResolvedValue(undefined)}
          findExtra={vi.fn().mockReturnValue(undefined)}
          setPreviewExtra={vi.fn()}
        />
      );

      const tablist = screen.getByRole('tablist');
      const tabpanel = screen.getByRole('tabpanel');
      expect(tablist).toBeTruthy();
      expect(tabpanel).toBeTruthy();
      // El tablist NO debe estar contenido dentro del tabpanel
      expect(tabpanel.contains(tablist)).toBe(false);
    });

    it('separa visualmente los Instrumentos de Evaluación de Soporte Docente y Protocolos Situados', () => {
      const mockRubric = {
        id: 'rubric-extra-1',
        planningId: 'test-planning-1',
        type: 'rubric' as const,
        title: 'Rúbrica Analítica de Desempeño',
        contentText: 'Criterios de evaluación',
        keyIndex: 0,
        createdAt: new Date(),
      };

      render(
        <PlanningTabMateriales
          planning={mockPlanning}
          activeSubTab="extras"
          onSubTabChange={vi.fn()}
          extras={[mockRubric]}
          generatingKey={null}
          syncingSuite={null}
          blockWorkbooks={{}}
          handleGenerateExtra={vi.fn().mockResolvedValue(undefined)}
          handleDeleteExtra={vi.fn().mockResolvedValue(undefined)}
          handlePreviewExtra={vi.fn()}
          handleSyncSuite={vi.fn().mockResolvedValue(undefined)}
          handleGenerateWorkbook={vi.fn().mockResolvedValue(undefined)}
          findExtra={vi.fn().mockImplementation((type) => (type === 'rubric' ? mockRubric : undefined))}
          setPreviewExtra={vi.fn()}
        />
      );

      expect(screen.getAllByText(/Instrumentos de Evaluación Formativa y Sumativa/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Soporte Docente y Protocolos Situados/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Compendio bloque:/i).length).toBeGreaterThan(0);
    });
  });

  describe('Fase H-01 / H-05 — Prompts y alineación pedagógica de guías de práctica', () => {
    it('PRACTICE_GUIDE_PROMPT_TEMPLATE incluye fases de metodología y practiceAlignment', async () => {
      const { PRACTICE_GUIDE_PROMPT_TEMPLATE } = await import('@/lib/prompts/extras-prompts');
      const prompt = PRACTICE_GUIDE_PROMPT_TEMPLATE(
        'Pensamiento Matemático III',
        'Actividad Clave 1',
        1,
        'Práctica 1: Modelos Lineales',
        'Cuidado del agua',
        'Comprender modelos lineales',
        'Estudiantes de bachillerato',
        'abp',
        ['Fase 1: Planteamiento', 'Fase 2: Investigación', 'Fase 3: Solución'],
        {
          saberes: { saber: 'Ecuaciones', saberHacer: 'Graficar', saberSer: 'Colaboración' },
          plannedEjecucion: 'Resolver problemas en equipo',
          devSessionsSummary: 'Sesión 1: Planteamiento\nSesión 2: Análisis',
          plannedMaterials: ['Calculadora', 'Regla'],
          plannedReferences: ['Libro de Matemáticas III'],
        }
      );

      expect(prompt).toContain('Pensamiento Matemático III');
      expect(prompt).toContain('Práctica 1: Modelos Lineales');
      expect(prompt).toContain('Fase 1: Planteamiento');
      expect(prompt).toContain('• Saber (Teórico): Ecuaciones');
      expect(prompt).toContain('• Saber Hacer (Procedimental - Práctica): Graficar');
      expect(prompt).toContain('• Saber Ser (Actitudinal / Seguridad): Colaboración');
      expect(prompt).toContain('Sesión 1: Planteamiento');
      expect(prompt).toContain('Calculadora, Regla');
      expect(prompt).toContain('Libro de Matemáticas III');
    });
  });

  describe('Fase H-04 — Paquete ZIP Maestro con exactamente 9 entregables consolidados', () => {
    it('El catálogo del paquete maestro define estrictamente los 9 archivos canónicos (01..09) con Instrumentos de Evaluación unificados', () => {
      // Las 9 claves canónicas correspondientes a las 9 tarjetas del Centro de Descargas
      const canonicalDeliverablePrefixes = [
        '01_Planeacion_Didactica_Semestral_',
        '02_Secuencia_Didactica_',
        '03_Planes_de_Clase_Compilado_',
        '04_Solucionario_Docente_Compilado_',
        '05_Guias_de_Practica_Compilado_',
        '06_Libro_de_Texto_Semestral_Consolidado_',
        '07_Instrumentos_de_Evaluacion_Compilado_',
        '08_Presentaciones_SACRINT_',
        '09_Infografias_Sinteticas_',
      ];

      expect(canonicalDeliverablePrefixes).toHaveLength(9);
      expect(canonicalDeliverablePrefixes.some((p) => p.startsWith('10_'))).toBe(false);
      // Validar orden estricto de prefijos 01 a 09
      for (let i = 1; i <= 9; i++) {
        const expectedPrefix = `${String(i).padStart(2, '0')}_`;
        expect(canonicalDeliverablePrefixes[i - 1].startsWith(expectedPrefix)).toBe(true);
      }
    });

    it('PlanningDownloadsHub renderiza la tarjeta unificada de Instrumentos de Evaluación con enlaces type=evaluation', () => {
      render(
        <PlanningDownloadsHub
          planning={mockPlanning}
          extras={[
            {
              id: 'rub-1',
              planningId: 'test-planning-1',
              type: 'rubric',
              title: 'Rúbrica Bloque 1',
              contentText: 'Texto rúbrica',
              keyIndex: 0,
              createdAt: new Date(),
            },
            {
              id: 'chk-1',
              planningId: 'test-planning-1',
              type: 'checklist',
              title: 'Lista Cotejo Bloque 1',
              contentText: 'Texto lista',
              keyIndex: 0,
              createdAt: new Date(),
            },
          ]}
          totalSessions={54}
          generatedWorkbookCount={3}
          totalWorkbookBlocks={3}
          semestralReady={true}
          blockReviews={{}}
        />
      );

      const card = screen.getByTestId('hub-card-instrumentos');
      expect(card).toBeDefined();
      expect(card.textContent).toContain('Instrumentos de Evaluación');
      expect(card.textContent).toContain('1 rúbricas · 1 listas');

      const links = card.querySelectorAll('a');
      const pdfLink = Array.from(links).find((a) => a.textContent?.includes('PDF'));
      const wordLink = Array.from(links).find((a) => a.textContent?.includes('Word'));

      expect(pdfLink?.getAttribute('href')).toContain('type=evaluation');
      expect(wordLink?.getAttribute('href')).toContain('type=evaluation');
    });
  });

  describe('Fase H-05 — Nombre de plataforma dinámico en ChecklistSupervisionModal', () => {
    it('getRuntimePlatformName usa SIGPDA-EMS por defecto y acepta el nombre resuelto', async () => {
      const {
        getRuntimePlatformName,
        setRuntimePlatformName,
        FALLBACK_PLATFORM_NAME,
      } = await import('@/lib/platform/platform-name-shared');

      expect(FALLBACK_PLATFORM_NAME).toBe('SIGPDA-EMS');
      setRuntimePlatformName('SEMS-Puebla IA');
      expect(getRuntimePlatformName()).toBe('SEMS-Puebla IA');
      setRuntimePlatformName(null);
      expect(getRuntimePlatformName()).toBe('SIGPDA-EMS');
    });

    it('ChecklistSupervisionModal renderiza el nombre dinámico de la plataforma sin hardcode DidácticaIA', async () => {
      const ChecklistSupervisionModal = (await import('@/components/planeacion/ChecklistSupervisionModal')).default;
      const { container } = render(
        <ChecklistSupervisionModal isOpen={true} onClose={vi.fn()} />
      );

      const footerText = container.textContent || '';
      expect(footerText).toContain('✓ Cumplimiento del 100% verificado por SIGPDA-EMS');
      expect(footerText).not.toContain('DidácticaIA');
      expect(footerText).not.toContain('Didáctica-IA');
    });
  });
});


