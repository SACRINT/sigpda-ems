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
  ClipboardList,
  CheckSquare,
  Presentation,
  Image as ImageIcon,
  Archive,
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
  const generatedRubricsCount = extras.filter((ex) => ex.type === 'rubric').length;
  const generatedChecklistsCount = extras.filter((ex) => ex.type === 'checklist').length;
  const hasPresentations = generatedWorkbookCount > 0;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11.5px',
              color: 'var(--c-text-muted)',
              fontWeight: 600,
            }}
          >
            Todos los entregables en un solo paquete:
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <a
              href={`/api/docx/extra/bulk?planningId=${planning.id}`}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                padding: '4px 9px',
                borderRadius: '6px',
                textDecoration: 'none',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                color: '#c7d2fe',
                fontWeight: 600,
              }}
              title="Descargar los 10 entregables consolidados en un archivo ZIP (Word y Presentaciones PPTX)"
            >
              <Archive size={12} /> Paquete Completo (Word + PPTX ZIP)
            </a>
            <a
              href={`/api/pdf/extra/bulk?planningId=${planning.id}`}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                padding: '4px 9px',
                borderRadius: '6px',
                textDecoration: 'none',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                fontWeight: 600,
              }}
              title="Descargar los 10 entregables consolidados en un archivo ZIP (PDF y Presentaciones PPTX)"
            >
              <Archive size={12} /> Paquete Completo (PDF + PPTX ZIP)
            </a>
          </div>
        </div>
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
                label: 'PDF',
                href: `/api/pdf/extra/combined?planningId=${planning.id}&type=lesson_plan`,
                targetBlank: true,
                disabled: totalSessions === 0 || generatedLessonPlans < totalSessions || lessonPlansStatus.status === 'blocked',
                disabledReason:
                  totalSessions === 0
                    ? 'No hay sesiones programadas en la planeación'
                    : generatedLessonPlans < totalSessions
                      ? `Genera las ${totalSessions} sesiones para descargar el compilado (${generatedLessonPlans}/${totalSessions} listas)`
                      : lessonPlansStatus.tooltip,
              },
              {
                format: 'Word',
                label: 'Word',
                href: `/api/docx/extra/combined?planningId=${planning.id}&type=lesson_plan`,
                disabled: totalSessions === 0 || generatedLessonPlans < totalSessions || lessonPlansStatus.status === 'blocked',
                disabledReason:
                  totalSessions === 0
                    ? 'No hay sesiones programadas en la planeación'
                    : generatedLessonPlans < totalSessions
                      ? `Genera las ${totalSessions} sesiones para descargar el compilado (${generatedLessonPlans}/${totalSessions} listas)`
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
                label: 'PDF',
                href: `/api/pdf/extra/combined?planningId=${planning.id}&type=teacher_guide`,
                targetBlank: true,
                disabled: totalWorkbookBlocks === 0 || generatedGuidesCount < totalWorkbookBlocks || answerKeyStatus.status === 'blocked',
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : generatedGuidesCount < totalWorkbookBlocks
                      ? `Genera el solucionario de los ${totalWorkbookBlocks} bloques para descargar el compilado (${generatedGuidesCount}/${totalWorkbookBlocks} listos)`
                      : answerKeyStatus.tooltip,
              },
              {
                format: 'Word',
                label: 'Word',
                href: `/api/docx/extra/combined?planningId=${planning.id}&type=teacher_guide`,
                disabled: totalWorkbookBlocks === 0 || generatedGuidesCount < totalWorkbookBlocks || answerKeyStatus.status === 'blocked',
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : generatedGuidesCount < totalWorkbookBlocks
                      ? `Genera el solucionario de los ${totalWorkbookBlocks} bloques para descargar el compilado (${generatedGuidesCount}/${totalWorkbookBlocks} listos)`
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
                label: 'PDF',
                href: `/api/pdf/extra/combined?planningId=${planning.id}&type=practice_guide`,
                targetBlank: true,
                disabled:
                  totalWorkbookBlocks === 0 || generatedPracticeGuidesCount < totalWorkbookBlocks || practiceGuidesStatus.status === 'blocked',
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : generatedPracticeGuidesCount < totalWorkbookBlocks
                      ? `Genera las guías de práctica de los ${totalWorkbookBlocks} bloques para descargar el compilado (${generatedPracticeGuidesCount}/${totalWorkbookBlocks} listas)`
                      : practiceGuidesStatus.tooltip,
              },
              {
                format: 'Word',
                label: 'Word',
                href: `/api/docx/extra/combined?planningId=${planning.id}&type=practice_guide`,
                disabled:
                  totalWorkbookBlocks === 0 || generatedPracticeGuidesCount < totalWorkbookBlocks || practiceGuidesStatus.status === 'blocked',
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : generatedPracticeGuidesCount < totalWorkbookBlocks
                      ? `Genera las guías de práctica de los ${totalWorkbookBlocks} bloques para descargar el compilado (${generatedPracticeGuidesCount}/${totalWorkbookBlocks} listas)`
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
            subtitle="Compendio semestral consolidado y cuadernos de trabajo por bloque."
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
                label: 'Word',
                href: `/api/docx/libro-semestral/${planning.id}`,
                download: true,
                disabled: totalWorkbookBlocks === 0 || !semestralReady,
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : !semestralReady
                      ? `Genera los ${totalWorkbookBlocks} bloques para descargar el Compendio Semestral`
                      : undefined,
              },
              {
                format: 'PDF',
                label: 'PDF',
                href: `/api/pdf/libro-semestral/${planning.id}`,
                targetBlank: true,
                disabled: totalWorkbookBlocks === 0 || !semestralReady,
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : !semestralReady
                      ? `Genera los ${totalWorkbookBlocks} bloques para descargar el Compendio Semestral`
                      : undefined,
              },
            ]}
            onOpenDetail={scrollToBooksSection}
            detailLabel="Ir a bloques"
          />

          {/* 7. Rúbricas Analíticas Oficiales (Todos los Bloques) */}
          <ResourceCard
            testId="hub-card-rubricas"
            icon={<ClipboardList size={16} />}
            title="Rúbricas Analíticas Oficiales"
            subtitle="Descriptores cualitativos por niveles de dominio NEM (unificados)."
            metaBadge={generatedRubricsCount > 0 ? `${generatedRubricsCount} bloques` : undefined}
            statusBadge={{
              status: generatedRubricsCount > 0 ? 'ok' : 'pending',
              label: generatedRubricsCount > 0 ? `${generatedRubricsCount} listas` : 'Por derivar',
            }}
            actions={[
              {
                format: 'PDF',
                label: 'PDF',
                href: `/api/pdf/extra/combined?planningId=${planning.id}&type=rubric`,
                targetBlank: true,
                disabled: totalWorkbookBlocks === 0 || generatedRubricsCount < totalWorkbookBlocks,
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : generatedRubricsCount < totalWorkbookBlocks
                      ? `Genera las rúbricas de los ${totalWorkbookBlocks} bloques para descargar el compilado (${generatedRubricsCount}/${totalWorkbookBlocks} listas)`
                      : undefined,
              },
              {
                format: 'Word',
                label: 'Word',
                href: `/api/docx/extra/combined?planningId=${planning.id}&type=rubric`,
                disabled: totalWorkbookBlocks === 0 || generatedRubricsCount < totalWorkbookBlocks,
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : generatedRubricsCount < totalWorkbookBlocks
                      ? `Genera las rúbricas de los ${totalWorkbookBlocks} bloques para descargar el compilado (${generatedRubricsCount}/${totalWorkbookBlocks} listas)`
                      : undefined,
              },
            ]}
            onOpenDetail={onNavigateToInstrumentos}
            detailLabel="Ver rúbricas"
          />

          {/* 8. Listas de Cotejo de Verificación (Todos los Bloques) */}
          <ResourceCard
            testId="hub-card-listas"
            icon={<CheckSquare size={16} />}
            title="Listas de Cotejo Formativas"
            subtitle="Reactivos observables de autoevaluación y coevaluación (unificados)."
            metaBadge={generatedChecklistsCount > 0 ? `${generatedChecklistsCount} bloques` : undefined}
            statusBadge={{
              status: generatedChecklistsCount > 0 ? 'ok' : 'pending',
              label: generatedChecklistsCount > 0 ? `${generatedChecklistsCount} listas` : 'Por derivar',
            }}
            actions={[
              {
                format: 'PDF',
                label: 'PDF',
                href: `/api/pdf/extra/combined?planningId=${planning.id}&type=checklist`,
                targetBlank: true,
                disabled: totalWorkbookBlocks === 0 || generatedChecklistsCount < totalWorkbookBlocks,
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : generatedChecklistsCount < totalWorkbookBlocks
                      ? `Genera las listas de cotejo de los ${totalWorkbookBlocks} bloques para descargar el compilado (${generatedChecklistsCount}/${totalWorkbookBlocks} listas)`
                      : undefined,
              },
              {
                format: 'Word',
                label: 'Word',
                href: `/api/docx/extra/combined?planningId=${planning.id}&type=checklist`,
                disabled: totalWorkbookBlocks === 0 || generatedChecklistsCount < totalWorkbookBlocks,
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : generatedChecklistsCount < totalWorkbookBlocks
                      ? `Genera las listas de cotejo de los ${totalWorkbookBlocks} bloques para descargar el compilado (${generatedChecklistsCount}/${totalWorkbookBlocks} listas)`
                      : undefined,
              },
            ]}
            onOpenDetail={onNavigateToInstrumentos}
            detailLabel="Ver listas"
          />

          {/* 9. Presentaciones Diapositivas SACRINT (Todos los Bloques) */}
          <ResourceCard
            testId="hub-card-presentaciones"
            icon={<Presentation size={16} />}
            title="Presentaciones SACRINT (.pptx)"
            subtitle="Diapositivas interactivas generadas del libro para proyección en aula."
            metaBadge={hasPresentations ? `${generatedWorkbookCount} bloques` : undefined}
            statusBadge={{
              status: hasPresentations ? 'ok' : 'pending',
              label: hasPresentations ? `${generatedWorkbookCount} listas` : 'Por generar',
            }}
            actions={[
              {
                format: 'PPTX',
                label: 'PPTX',
                href: `/api/planeaciones/${planning.id}/presentacion/combinada`,
                targetBlank: true,
                disabled: totalWorkbookBlocks === 0 || generatedWorkbookCount < totalWorkbookBlocks,
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : generatedWorkbookCount < totalWorkbookBlocks
                      ? `Genera los libros de trabajo de los ${totalWorkbookBlocks} bloques para habilitar las diapositivas (${generatedWorkbookCount}/${totalWorkbookBlocks} listos)`
                      : undefined,
              },
            ]}
            onOpenDetail={onNavigateToInstrumentos}
            detailLabel="Ver diapositivas"
          />

          {/* 10. Infografías Sintéticas SACRINT (Todos los Bloques) */}
          <ResourceCard
            testId="hub-card-infografias"
            icon={<ImageIcon size={16} />}
            title="Infografías Sintéticas SACRINT"
            subtitle="Láminas infográficas pedagógicas vectoriales de alta resolución (unificadas)."
            metaBadge={hasPresentations ? `${generatedWorkbookCount} bloques` : undefined}
            statusBadge={{
              status: hasPresentations ? 'ok' : 'pending',
              label: hasPresentations ? `${generatedWorkbookCount} listas` : 'Por generar',
            }}
            actions={[
              {
                format: 'PDF',
                label: 'PDF',
                href: `/api/planeaciones/${planning.id}/infografia/combinada?format=pdf`,
                targetBlank: true,
                disabled: totalWorkbookBlocks === 0 || generatedWorkbookCount < totalWorkbookBlocks,
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : generatedWorkbookCount < totalWorkbookBlocks
                      ? `Genera los libros de trabajo de los ${totalWorkbookBlocks} bloques para habilitar las infografías (${generatedWorkbookCount}/${totalWorkbookBlocks} listos)`
                      : undefined,
              },
            ]}
            onOpenDetail={onNavigateToInstrumentos}
            detailLabel="Ver infografías"
          />
        </div>
      </div>
    </section>
  );
}

