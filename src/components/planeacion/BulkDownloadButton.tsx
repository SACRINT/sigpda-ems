'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import { Archive, Clock } from 'lucide-react';
import {
  buildPlanningPackageSpec,
  type PlanningPackageItem,
} from '@/lib/planning-package-items';

export interface BulkDownloadButtonProps {
  href: string;
  label: string;
  title: string;
  style: React.CSSProperties;
  icon: React.ReactNode;
  items?: PlanningPackageItem[];
  zipFileName?: string;
  progressTitle?: string;
}

export function BulkDownloadButton({
  href,
  label,
  title,
  style,
  icon,
  items,
  zipFileName,
  progressTitle,
}: BulkDownloadButtonProps) {
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

  const toastNode =
    status !== 'idle' ? (
      <div
        role="status"
        aria-live="polite"
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
            {status === 'loading'
              ? progressTitle
                ? `Generando paquete (${progressTitle})…`
                : 'Generando paquete…'
              : progressTitle
                ? `No se pudo descargar (${progressTitle})`
                : 'No se pudo descargar'}
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
    ) : null;

  return (
    <>
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
      {toastNode && (typeof document !== 'undefined' ? createPortal(toastNode, document.body) : toastNode)}
    </>
  );
}

/**
 * Atajos compactos DOCX y PDF en las tarjetas de "Mis planeaciones".
 * Ejecutan exactamente la misma descarga de los 9 entregables en ZIP que el Centro de Descargas.
 */
export function DashboardPackageDownloadButtons({
  planningId,
  uacName,
}: {
  planningId: string;
  uacName: string;
}) {
  const docxPkg = buildPlanningPackageSpec(planningId, uacName, 'docx');
  const pdfPkg = buildPlanningPackageSpec(planningId, uacName, 'pdf');

  return (
    <>
      <BulkDownloadButton
        href={docxPkg.href}
        items={docxPkg.items}
        zipFileName={docxPkg.zipFileName}
        progressTitle={`${docxPkg.subjectCode} · DOCX`}
        label="DOCX"
        title={docxPkg.title}
        icon={<Archive size={12} />}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '12px',
          padding: '5px 10px',
          borderRadius: '6px',
          background: 'rgba(99, 102, 241, 0.14)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          color: '#c7d2fe',
          fontWeight: 600,
        }}
      />
      <BulkDownloadButton
        href={pdfPkg.href}
        items={pdfPkg.items}
        zipFileName={pdfPkg.zipFileName}
        progressTitle={`${pdfPkg.subjectCode} · PDF`}
        label="PDF"
        title={pdfPkg.title}
        icon={<Archive size={12} />}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '12px',
          padding: '5px 10px',
          borderRadius: '6px',
          background: 'rgba(239, 68, 68, 0.14)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          fontWeight: 600,
        }}
      />
    </>
  );
}
