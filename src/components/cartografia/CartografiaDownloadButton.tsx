'use client';

import React, { useState } from 'react';

export interface QualityReportError {
  error: string;
  percentage?: number;
  status?: string;
  recommendations?: string[];
}

export type ParseDownloadResponseResult =
  | {
      kind: 'quality_422';
      data: QualityReportError;
    }
  | {
      kind: 'generic_error';
      status: number;
      error: string;
    }
  | {
      kind: 'success';
      filename: string;
      blob: Blob;
    };

interface ApiResponsePayload {
  error?: string;
  quality?: {
    percentage?: number;
    status?: string;
    recommendations?: string[];
  };
}

/**
 * Función pura que analiza la respuesta HTTP de descarga de cartografía.
 * Maneja el bloqueo suave 422 del Quality Gate, errores HTTP genéricos y la obtención del archivo binario.
 */
export async function parseDownloadResponse(
  res: Response,
  defaultFilename = 'documento'
): Promise<ParseDownloadResponseResult> {
  if (res.status === 422) {
    const data = (await res.json().catch(() => ({}))) as ApiResponsePayload;
    return {
      kind: 'quality_422',
      data: {
        error: data.error || 'El proyecto no cumple con los criterios mínimos de calidad requeridos.',
        percentage: data.quality?.percentage,
        status: data.quality?.status,
        recommendations: Array.isArray(data.quality?.recommendations) ? data.quality.recommendations : [],
      },
    };
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiResponsePayload;
    return {
      kind: 'generic_error',
      status: res.status,
      error: data.error || `Error ${res.status}: No se pudo descargar el documento.`,
    };
  }

  const disposition = res.headers.get('Content-Disposition');
  let filename = defaultFilename;
  if (disposition) {
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      filename = decodeURIComponent(utf8Match[1]);
    } else {
      const match = disposition.match(/filename="?([^";]+)"?/i);
      if (match && match[1]) {
        filename = match[1];
      }
    }
  }

  const blob = await res.blob();
  return {
    kind: 'success',
    filename,
    blob,
  };
}

interface CartografiaDownloadButtonProps {
  url: string;
  defaultFilename?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export default function CartografiaDownloadButton({
  url,
  defaultFilename = 'documento',
  className = 'btn',
  style,
  children,
}: CartografiaDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [qualityError, setQualityError] = useState<QualityReportError | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setQualityError(null);
    setGenericError(null);

    try {
      const res = await fetch(url);
      const parsed = await parseDownloadResponse(res, defaultFilename);

      if (parsed.kind === 'quality_422') {
        setQualityError(parsed.data);
        return;
      }

      if (parsed.kind === 'generic_error') {
        setGenericError(parsed.error);
        return;
      }

      const blobUrl = window.URL.createObjectURL(parsed.blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = parsed.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      setGenericError(err instanceof Error ? err.message : 'Error inesperado al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className={className}
        style={{
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.75 : 1,
          ...style,
        }}
      >
        {loading ? '⏳ Descargando...' : children}
      </button>

      {/* Modal de Bloqueo por Quality Gate (422) */}
      {qualityError && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quality-gate-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(10, 10, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: '#131324',
              border: '1px solid #E8A020',
              borderRadius: 16,
              width: '100%',
              maxWidth: 650,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
              color: '#f0f4ff',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'rgba(232, 160, 32, 0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>⚠️</span>
                <div>
                  <h3 id="quality-gate-title" style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#FBBF24' }}>
                    Validación de Calidad Requerida (Quality Gate)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12, opacity: 0.8 }}>
                    Criterios mínimos oficiales de Cartografía de Zona (SEMS / DGB)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQualityError(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: 20,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: '#FCA5A5',
                }}
              >
                {qualityError.error}
              </div>

              {qualityError.percentage !== undefined && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '8px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    📊 <strong>Puntaje Actual:</strong> {qualityError.percentage}%
                  </div>
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#F87171',
                      padding: '8px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Estatus: {qualityError.status || 'REQUIERE_REVISION'}
                  </div>
                </div>
              )}

              {qualityError.recommendations && qualityError.recommendations.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#93C5FD', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Recomendaciones para habilitar la descarga:
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6, color: 'rgba(255, 255, 255, 0.85)' }}>
                    {qualityError.recommendations.map((rec, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              <button
                type="button"
                onClick={() => setQualityError(null)}
                className="btn btn-primary"
                style={{ padding: '8px 20px', fontSize: 14 }}
              >
                Entendido / Volver al Proyecto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Error Genérico */}
      {genericError && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(10, 10, 20, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: '#131324',
              border: '1px solid #ef4444',
              borderRadius: 16,
              width: '100%',
              maxWidth: 450,
              padding: 24,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
              color: '#f0f4ff',
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', margin: '0 0 12px 0' }}>
              Error al descargar
            </h3>
            <p style={{ fontSize: 14, margin: '0 0 20px 0', opacity: 0.85 }}>{genericError}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setGenericError(null)}
                className="btn btn-secondary"
                style={{ padding: '6px 16px', fontSize: 13 }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
