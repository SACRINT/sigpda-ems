'use client';

import React, { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import type { Planning, PlanningExtra, SecuenciaBloque } from '@/types/planning';
import type { MaterialReviewReport } from '@/lib/guide-engine/material-review';
import { summarizeMaterialReviewStatus } from '@/hooks/useBlockMaterialReviews';
import { shortSubjectCode } from '@/lib/short-filename';
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
  Presentation,
  Image as ImageIcon,
  Archive,
} from 'lucide-react';

function BulkDownloadButton({
  href,
  label,
  title,
  style,
  icon,
  items,
  zipFileName,
}: {
  href: string;
  label: string;
  title: string;
  style: React.CSSProperties;
  icon: React.ReactNode;
  items?: Array<{ label: string; url: string; fileName: string }>;
  zipFileName?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (status !== 'loading') return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const start = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    setElapsed(0);
    setProgress(0);
    setCurrentItem('');
    setError('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let blob: Blob;
      let filename = 'Paquete_Entregables.zip';
      if (items && items.length > 0) {
        const zip = new JSZip();
        for (let index = 0; index < items.length; index++) {
          if (controller.signal.aborted) throw new DOMException('Cancelado', 'AbortError');
          const item = items[index]!;
          setCurrentItem(item.label);
          const res = await fetch(item.url, { signal: controller.signal });
          if (!res.ok) {
            throw new Error(`Falló ${item.label} (HTTP ${res.status}).`);
          }
          zip.file(item.fileName, await res.arrayBuffer());
          setProgress(Math.round(((index + 1) / items.length) * 100));
        }
        blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
        filename =
          zipFileName ||
          `${label.replace(/[^\wáéíóúñÁÉÍÓÚÑ -]+/g, '').trim() || 'Paquete_Entregables'}.zip`;
      } else {
        const res = await fetch(href, { signal: controller.signal });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(
            res.status === 504
              ? 'El paquete tardó demasiado en generarse (timeout del servidor). Intenta de nuevo o descarga los entregables por separado.'
              : detail || `No se pudo generar el paquete (HTTP ${res.status}).`
          );
        }
        blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^";]+)"?/i);
        filename = match?.[1] || filename;
        setProgress(100);
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus('idle');
    } catch (err) {
      if (controller.signal.aborted) {
        setStatus('idle');
      } else {
        setError(err instanceof Error ? err.message : 'Error al descargar el paquete.');
        setStatus('error');
      }
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <>
      <style>{`@keyframes sigpda-indeterminate { 0% { transform: translateX(-120%); } 50% { transform: translateX(120%); } 100% { transform: translateX(260%); } }`}</style>
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          void start();
        }}
        aria-disabled={status === 'loading'}
        className="btn btn-secondary btn-sm"
        style={{ ...style, cursor: status === 'loading' ? 'wait' : 'pointer' }}
        title={title}
      >
        {status === 'loading' ? <Clock size={13} /> : icon}
        {status === 'loading' ? `${label} (${elapsed}s)` : label}
      </a>
      {status !== 'idle' && (
        <div
          style={{
            position: 'fixed',
            bottom: 18,
            right: 18,
            zIndex: 9999,
            width: 'min(420px, calc(100vw - 32px))',
            background: '#0f172a',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            borderRadius: 12,
            padding: 14,
            color: '#e2e8f0',
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <strong style={{ fontSize: 13 }}>
              {status === 'loading' ? 'Generando paquete…' : 'No se pudo descargar'}
            </strong>
            {status === 'loading' ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => abortRef.current?.abort()}
              >
                Cancelar
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => setStatus('idle')}
              >
                Cerrar
              </button>
            )}
          </div>
          {status === 'loading' ? (
            <>
              <div
                style={{
                  height: 5,
                  marginTop: 10,
                  borderRadius: 999,
                  background: 'rgba(148,163,184,0.2)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(2, progress)}%`,
                    borderRadius: 999,
                    background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                    transition: 'width 0.35s ease',
                  }}
                />
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8' }}>
                {progress}% · {currentItem || label} · {elapsed}s
              </p>
            </>
          ) : (
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: '#fca5a5' }}>{error}</p>
          )}
        </div>
      )}
    </>
  );
}

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
  const subjectCode = shortSubjectCode(planning.uacName || 'UAC');
  const pdfPackageItems = [
    { label: '01 Planeación', url: `/api/planeaciones/${planning.id}/pdf`, fileName: `01_Planeacion_${subjectCode}.pdf` },
    { label: '02 Secuencia', url: `/api/planeaciones/${planning.id}/secuencia/pdf`, fileName: `02_Secuencia_${subjectCode}.pdf` },
    { label: '03 Planes de clase', url: `/api/pdf/extra/combined?planningId=${planning.id}&type=lesson_plan`, fileName: `03_Planes_Clase_${subjectCode}.pdf` },
    { label: '04 Solucionario', url: `/api/pdf/extra/combined?planningId=${planning.id}&type=teacher_guide`, fileName: `04_Solucionario_${subjectCode}.pdf` },
    { label: '05 Guías de práctica', url: `/api/pdf/extra/combined?planningId=${planning.id}&type=practice_guide`, fileName: `05_Guias_Practica_${subjectCode}.pdf` },
    { label: '06 Libro semestral', url: `/api/pdf/libro-semestral/${planning.id}`, fileName: `06_Libro_Semestral_${subjectCode}.pdf` },
    { label: '07 Instrumentos', url: `/api/pdf/extra/combined?planningId=${planning.id}&type=evaluation`, fileName: `07_Instrumentos_${subjectCode}.pdf` },
    { label: '08 Presentaciones', url: `/api/planeaciones/${planning.id}/presentacion/combinada`, fileName: `08_Presentaciones_${subjectCode}.pptx` },
    { label: '09 Infografías', url: `/api/planeaciones/${planning.id}/infografia/combinada?format=pdf`, fileName: `09_Infografias_${subjectCode}.pdf` },
  ];
  const docxPackageItems = [
    { label: '01 Planeación', url: `/api/docx/${planning.id}`, fileName: `01_Planeacion_${subjectCode}.docx` },
    { label: '02 Secuencia', url: `/api/docx/secuencia/${planning.id}`, fileName: `02_Secuencia_${subjectCode}.docx` },
    { label: '03 Planes de clase', url: `/api/docx/extra/combined?planningId=${planning.id}&type=lesson_plan`, fileName: `03_Planes_Clase_${subjectCode}.docx` },
    { label: '04 Solucionario', url: `/api/docx/extra/combined?planningId=${planning.id}&type=teacher_guide`, fileName: `04_Solucionario_${subjectCode}.docx` },
    { label: '05 Guías de práctica', url: `/api/docx/extra/combined?planningId=${planning.id}&type=practice_guide`, fileName: `05_Guias_Practica_${subjectCode}.docx` },
    { label: '06 Libro semestral', url: `/api/docx/libro-semestral/${planning.id}`, fileName: `06_Libro_Semestral_${subjectCode}.docx` },
    { label: '07 Instrumentos', url: `/api/docx/extra/combined?planningId=${planning.id}&type=evaluation`, fileName: `07_Instrumentos_${subjectCode}.docx` },
    { label: '08 Presentaciones', url: `/api/planeaciones/${planning.id}/presentacion/combinada`, fileName: `08_Presentaciones_${subjectCode}.pptx` },
    { label: '09 Infografías', url: `/api/planeaciones/${planning.id}/infografia/combinada?format=pdf`, fileName: `09_Infografias_${subjectCode}.pdf` },
  ];
  const generatedLessonPlans = extras.filter((ex) => ex.type === 'lesson_plan').length;
  const generatedGuidesCount = extras.filter((ex) => ex.type === 'teacher_guide').length;
  const generatedPracticeGuidesCount = extras.filter((ex) => ex.type === 'practice_guide').length;
  const generatedRubricsCount = extras.filter((ex) => ex.type === 'rubric').length;
  const generatedChecklistsCount = extras.filter((ex) => ex.type === 'checklist').length;
  const hasEvaluationReady = generatedRubricsCount > 0 || generatedChecklistsCount > 0;
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
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <BulkDownloadButton
              href={`/api/planeaciones/${planning.id}/paquete-aula`}
              label="Paquete Integral de Aula (ZIP)"
              title="Descargar Paquete Integral de Aula (ZIP). El libro semestral se descarga aparte por su tamaño."
              icon={<Archive size={14} />}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '7px',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))',
                border: '1px solid rgba(52,211,153,0.75)',
                color: '#ffffff',
                fontWeight: 800,
                boxShadow: '0 2px 10px rgba(16,185,129,0.25)',
              }}
            />
            <BulkDownloadButton
              href={`/api/docx/extra/bulk?planningId=${planning.id}`}
              items={docxPackageItems}
              zipFileName={`Paquete_${subjectCode}_Word.zip`}
              label="Paquete Completo (Word + PPTX ZIP)"
              title="Descargar los 9 entregables consolidados en un archivo ZIP (Word y Presentaciones PPTX)"
              icon={<Archive size={12} />}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                padding: '4px 9px',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                color: '#c7d2fe',
                fontWeight: 600,
              }}
            />
            <BulkDownloadButton
              href={`/api/pdf/extra/bulk?planningId=${planning.id}`}
              items={pdfPackageItems}
              zipFileName={`Paquete_${subjectCode}_PDF.zip`}
              label="Paquete Completo (PDF + PPTX ZIP)"
              title="Descargar los 9 entregables consolidados en un archivo ZIP (PDF y Presentaciones PPTX)"
              icon={<Archive size={12} />}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                padding: '4px 9px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                fontWeight: 600,
              }}
            />
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

          {/* 7. Instrumentos de Evaluación Formativa y Sumativa (Todos los Bloques) */}
          <ResourceCard
            testId="hub-card-instrumentos"
            icon={<ClipboardList size={16} />}
            title="Instrumentos de Evaluación"
            subtitle="Rúbricas analíticas, listas de cotejo y herramientas formativas unificadas por bloque."
            metaBadge={hasEvaluationReady ? `${Math.max(generatedRubricsCount, generatedChecklistsCount)} bloques` : undefined}
            statusBadge={{
              status: hasEvaluationReady ? 'ok' : 'pending',
              label: hasEvaluationReady
                ? `${generatedRubricsCount} rúbricas · ${generatedChecklistsCount} listas`
                : 'Por derivar',
            }}
            actions={[
              {
                format: 'PDF',
                label: 'PDF',
                href: `/api/pdf/extra/combined?planningId=${planning.id}&type=evaluation`,
                targetBlank: true,
                disabled: totalWorkbookBlocks === 0 || !hasEvaluationReady,
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : !hasEvaluationReady
                      ? `Genera los instrumentos de evaluación en los bloques curriculares`
                      : undefined,
              },
              {
                format: 'Word',
                label: 'Word',
                href: `/api/docx/extra/combined?planningId=${planning.id}&type=evaluation`,
                disabled: totalWorkbookBlocks === 0 || !hasEvaluationReady,
                disabledReason:
                  totalWorkbookBlocks === 0
                    ? 'No hay bloques curriculares definidos en la planeación'
                    : !hasEvaluationReady
                      ? `Genera los instrumentos de evaluación en los bloques curriculares`
                      : undefined,
              },
            ]}
            onOpenDetail={onNavigateToInstrumentos}
            detailLabel="Ver instrumentos"
          />

          {/* 8. Presentaciones Diapositivas SACRINT (Todos los Bloques) */}
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

          {/* 9. Infografías Sintéticas SACRINT (Todos los Bloques) */}
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

