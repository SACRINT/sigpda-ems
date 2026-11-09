'use client';

import React from 'react';
import type { Planning, PlanningExtra, SecuenciaBloque } from '@/types/planning';
import type { MaterialReviewReport } from '@/lib/guide-engine/material-review';
import { summarizeMaterialReviewStatus } from '@/hooks/useBlockMaterialReviews';
import ResourceCard from '@/components/planeacion/ResourceCard';
import {
  FileText,
  Layers,
  Clock,
  GraduationCap,
  BookOpen,
  FlaskConical,
  FolderDown,
} from 'lucide-react';

export interface PlanningDownloadsHubProps {
  planning: Planning;
  sequenceData?: Record<number, SecuenciaBloque>;
  extras?: PlanningExtra[];
  totalSessions: number;
  generatedWorkbookCount: number;
  totalWorkbookBlocks: number;
  semestralReady: boolean;
  blockReviews: Record<number, MaterialReviewReport>;
  downloadingPdf?: boolean;
  downloadingSeqPdf?: boolean;
  onDownloadPdf?: () => void;
  onDownloadSecuenciaPdf?: () => void;
  onOpenA4Modal?: () => void;
  onNavigateToLessonPlans?: () => void;
  onNavigateToSolucionario?: () => void;
  onNavigateToInstrumentos?: () => void;
  onNavigateToGuiasPractica?: () => void;
}

export default function PlanningDownloadsHub({
  planning,
  sequenceData = {},
  extras = [],
  totalSessions,
  generatedWorkbookCount,
  totalWorkbookBlocks,
  semestralReady,
  blockReviews,
  downloadingPdf = false,
  downloadingSeqPdf = false,
  onDownloadPdf,
  onDownloadSecuenciaPdf,
  onOpenA4Modal,
  onNavigateToLessonPlans,
  onNavigateToSolucionario,
  onNavigateToInstrumentos,
  onNavigateToGuiasPractica,
}: PlanningDownloadsHubProps) {
  const hasSequences = Object.keys(sequenceData).length > 0;
  const generatedLessonPlans = extras.filter((ex) => ex.type === 'lesson_plan').length;
  const generatedGuidesCount = extras.filter((ex) => ex.type === 'teacher_guide').length;
  const generatedPracticeGuidesCount = extras.filter((ex) => ex.type === 'practice_guide').length;

  const lessonPlansStatus = summarizeMaterialReviewStatus(
    blockReviews,
    'lesson_plan',
    generatedLessonPlans
  );
  const answerKeyStatus = summarizeMaterialReviewStatus(
    blockReviews,
    'answer_key',
    generatedGuidesCount
  );
  const practiceGuidesStatus = summarizeMaterialReviewStatus(
    blockReviews,
    'recovery_cards',
    generatedPracticeGuidesCount
  );

  const scrollToBooksSection = () => {
    const el = document.getElementById('libros-bloque');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section
      className="section-card"
      data-testid="planning-downloads-hub"
      style={{
        border: '1px solid var(--c-border-2)',
      }}
    >
      <div
        className="section-card-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderDown size={17} style={{ color: 'var(--c-accent-bright)' }} />
          <span className="section-card-title">
            Centro de Descargas y Entregables de la Planeación
          </span>
        </div>
        <span
          style={{
            fontSize: '11.5px',
            color: 'var(--c-text-muted)',
            fontWeight: 600,
          }}
        >
          Acceso directo a documentos oficiales y cuadernos de trabajo
        </span>
      </div>

      <div className="section-card-body">
        <div className="resource-grid">
          {/* 1. Planeación Didáctica Semestral */}
          <ResourceCard
            testId="hub-card-planeacion"
            icon={<FileText size={16} />}
            title="Planeación Didáctica Semestral"
            subtitle="Documento rector oficial con las 7 secciones normativas MCCEMS."
            metaBadge="Semestral"
            statusBadge={{ status: 'ok', label: 'Lista' }}
            actions={[
              {
                format: 'PDF',
                onClick: onDownloadPdf,
                loading: downloadingPdf,
              },
              {
                format: 'Word',
                href: `/api/docx/${planning.id}`,
              },
            ]}
            onOpenDetail={onOpenA4Modal}
            detailLabel="Vista Carta"
          />

          {/* 2. Secuencia Didáctica */}
          <ResourceCard
            testId="hub-card-secuencia"
            icon={<Layers size={16} />}
            title="Secuencia Didáctica"
            subtitle="Momentos pedagógicos de Apertura, Desarrollo y Cierre por corte."
            metaBadge={totalWorkbookBlocks > 0 ? `${totalWorkbookBlocks} bloques` : undefined}
            statusBadge={{
              status: hasSequences ? 'ok' : 'pending',
              label: hasSequences ? 'Generada' : 'Por generar',
            }}
            actions={[
              {
                format: 'PDF',
                onClick: onDownloadSecuenciaPdf,
                loading: downloadingSeqPdf,
                disabled: !hasSequences,
                disabledReason: !hasSequences
                  ? 'Genera primero la secuencia didáctica de los bloques'
                  : undefined,
              },
              {
                format: 'Word',
                href: `/api/docx/secuencia/${planning.id}`,
                disabled: !hasSequences,
                disabledReason: !hasSequences
                  ? 'Genera primero la secuencia didáctica de los bloques'
                  : undefined,
              },
            ]}
            onOpenDetail={scrollToBooksSection}
            detailLabel="Ver bloques"
          />

          {/* 3. Planes de Clase */}
          <ResourceCard
            testId="hub-card-planes"
            icon={<Clock size={16} />}
            title="Planes de Clase (50 min)"
            subtitle={`Compilado de sesiones micro-operativas (${generatedLessonPlans} de ${totalSessions} generadas).`}
            metaBadge={`${generatedLessonPlans}/${totalSessions} sesiones`}
            statusBadge={lessonPlansStatus}
            actions={[
              {
                format: 'PDF',
                label: generatedLessonPlans > 0 ? `PDF (${generatedLessonPlans} en 1)` : 'PDF',
                href: `/api/pdf/extra/combined?planningId=${planning.id}&type=lesson_plan`,
                targetBlank: true,
                disabled: generatedLessonPlans === 0 || lessonPlansStatus.status === 'blocked',
                disabledReason:
                  generatedLessonPlans === 0
                    ? 'Sincroniza primero los planes desde el Libro de Trabajo'
                    : lessonPlansStatus.tooltip,
              },
              {
                format: 'Word',
                label: generatedLessonPlans > 0 ? `Word (${generatedLessonPlans} en 1)` : 'Word',
                href: `/api/docx/extra/combined?planningId=${planning.id}&type=lesson_plan`,
                disabled: generatedLessonPlans === 0 || lessonPlansStatus.status === 'blocked',
                disabledReason:
                  generatedLessonPlans === 0
                    ? 'Sincroniza primero los planes desde el Libro de Trabajo'
                    : lessonPlansStatus.tooltip,
              },
            ]}
            onOpenDetail={onNavigateToLessonPlans}
            detailLabel="Ver planes"
          />

          {/* 4. Solucionario Docente */}
          <ResourceCard
            testId="hub-card-solucionario"
            icon={<GraduationCap size={16} />}
            title="Solucionario Docente"
            subtitle="Respuestas modelo paso a paso y criterios de mediación docente."
            metaBadge={totalWorkbookBlocks > 0 ? `${generatedGuidesCount}/${totalWorkbookBlocks} bloques` : `${generatedGuidesCount} bloques`}
            statusBadge={answerKeyStatus}
            actions={[
              {
                format: 'PDF',
                label: generatedGuidesCount > 0 ? `PDF (${generatedGuidesCount} en 1)` : 'PDF',
                href: `/api/pdf/extra/combined?planningId=${planning.id}&type=teacher_guide`,
                targetBlank: true,
                disabled: generatedGuidesCount === 0 || answerKeyStatus.status === 'blocked',
                disabledReason:
                  generatedGuidesCount === 0
                    ? 'Sincroniza o genera el solucionario desde Materiales'
                    : answerKeyStatus.tooltip,
              },
              {
                format: 'Word',
                label: generatedGuidesCount > 0 ? `Word (${generatedGuidesCount} en 1)` : 'Word',
                href: `/api/docx/extra/combined?planningId=${planning.id}&type=teacher_guide`,
                disabled: generatedGuidesCount === 0 || answerKeyStatus.status === 'blocked',
                disabledReason:
                  generatedGuidesCount === 0
                    ? 'Sincroniza o genera el solucionario desde Materiales'
                    : answerKeyStatus.tooltip,
              },
            ]}
            onOpenDetail={onNavigateToSolucionario}
            detailLabel="Ver solucionarios"
          />

          {/* 5. Guías de Práctica */}
          <ResourceCard
            testId="hub-card-practicas"
            icon={<FlaskConical size={16} />}
            title="Guías de Práctica"
            subtitle="Protocolos situados de taller, laboratorio o estudio de caso por bloque."
            metaBadge={`${generatedPracticeGuidesCount} generadas`}
            statusBadge={practiceGuidesStatus}
            actions={[
              {
                format: 'PDF',
                label: generatedPracticeGuidesCount > 0 ? `PDF (${generatedPracticeGuidesCount} en 1)` : 'PDF',
                href: `/api/pdf/extra/combined?planningId=${planning.id}&type=practice_guide`,
                targetBlank: true,
                disabled:
                  generatedPracticeGuidesCount === 0 || practiceGuidesStatus.status === 'blocked',
                disabledReason:
                  generatedPracticeGuidesCount === 0
                    ? 'Sincroniza la suite del bloque para derivar las guías de práctica'
                    : practiceGuidesStatus.tooltip,
              },
              {
                format: 'Word',
                label: generatedPracticeGuidesCount > 0 ? `Word (${generatedPracticeGuidesCount} en 1)` : 'Word',
                href: `/api/docx/extra/combined?planningId=${planning.id}&type=practice_guide`,
                disabled:
                  generatedPracticeGuidesCount === 0 || practiceGuidesStatus.status === 'blocked',
                disabledReason:
                  generatedPracticeGuidesCount === 0
                    ? 'Sincroniza la suite del bloque para derivar las guías de práctica'
                    : practiceGuidesStatus.tooltip,
              },
            ]}
            onOpenDetail={onNavigateToGuiasPractica || onNavigateToInstrumentos}
            detailLabel="Ver guías de práctica"
          />

          {/* 6. Libros de Texto Activos */}
          <ResourceCard
            testId="hub-card-libros"
            icon={<BookOpen size={16} />}
            title="Libros de Texto Activos"
            subtitle="Compendio semestral consolidado (~150-200 págs) y cuadernos por bloque."
            metaBadge={totalWorkbookBlocks > 0 ? `${generatedWorkbookCount}/${totalWorkbookBlocks} bloques` : `${generatedWorkbookCount} bloques`}
            statusBadge={{
              status: semestralReady
                ? 'ok'
                : generatedWorkbookCount > 0
                  ? 'warn'
                  : 'pending',
              label: semestralReady
                ? 'Compendio listo'
                : `${generatedWorkbookCount}/${totalWorkbookBlocks} listos`,
            }}
            actions={[
              {
                format: 'Word',
                label: 'Compendio Word',
                href: `/api/docx/libro-semestral/${planning.id}`,
                download: true,
                disabled: !semestralReady,
                disabledReason: !semestralReady
                  ? `Genera los ${totalWorkbookBlocks} bloques para descargar el Compendio Semestral`
                  : undefined,
              },
              {
                format: 'PDF',
                label: 'Compendio PDF',
                href: `/api/pdf/libro-semestral/${planning.id}`,
                targetBlank: true,
                disabled: !semestralReady,
                disabledReason: !semestralReady
                  ? `Genera los ${totalWorkbookBlocks} bloques para descargar el Compendio Semestral`
                  : undefined,
              },
            ]}
            onOpenDetail={scrollToBooksSection}
            detailLabel="Ir a bloques"
          />
        </div>
      </div>
    </section>
  );
}

