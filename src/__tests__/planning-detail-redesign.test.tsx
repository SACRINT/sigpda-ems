// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ResourceCard from '@/components/planeacion/ResourceCard';
import PlanningDetailHero from '@/components/planeacion/PlanningDetailHero';
import DocumentA4Modal from '@/components/planeacion/DocumentA4Modal';
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
          downloadingPdf={false}
          publishingClassroom={false}
          onDownloadPdf={vi.fn()}
          onOpenA4Modal={vi.fn()}
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
});

