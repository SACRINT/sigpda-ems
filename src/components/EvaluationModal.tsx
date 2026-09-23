'use client';

import { useState } from 'react';
import { ResultadoEvaluacion } from '@/lib/planeaciones-evaluator';

interface Props {
  planningId?: string;
  planningTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function EvaluationModal({ planningId, planningTitle, isOpen, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEvaluacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const ejecutarEvaluacion = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/planeaciones/evaluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al evaluar');
      setResultado(data.resultado);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(10, 10, 20, 0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: '#131324', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 16, width: '100%', maxWidth: 850, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)', color: '#f0f4ff'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#60a5fa' }}>
              🔍 Co-Piloto Evaluador con IA (Anexo 12 USICAMM)
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.7 }}>
              {planningTitle ? `Evaluando: ${planningTitle}` : 'Auditoría técnico-pedagógica'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)',
              fontSize: 20, cursor: 'pointer', padding: 4
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {!resultado && !loading && !error && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>¿Iniciar Evaluación de Calidad Pedagógica?</h3>
              <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 500, margin: '0 auto 24px' }}>
                La Inteligencia Artificial auditará tu planeación contra los criterios oficiales del MCCEMS y el Anexo 12 de USICAMM, generando observaciones y puntajes en segundos.
              </p>
              <button
                onClick={ejecutarEvaluacion}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14,
                  fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.4)'
                }}
              >
                🚀 Ejecutar Evaluación IA Ahora
              </button>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div className="spinner" style={{ margin: '0 auto 16px', borderTopColor: '#3b82f6' }} />
              <p style={{ fontSize: 15, fontWeight: 600 }}>Auditando rúbricas de la planeación con IA...</p>
              <p style={{ fontSize: 13, opacity: 0.6 }}>Evaluando coherencia, dosificación y transversales Anexo 12.</p>
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: 16, color: '#fca5a5', fontSize: 14, marginBottom: 20
            }}>
              ⚠️ {error}
            </div>
          )}

          {resultado && (
            <div>
              {/* Score card */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16, marginBottom: 24
              }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: 12, opacity: 0.7, textTransform: 'uppercase' }}>Puntaje Obtenido</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#60a5fa', marginTop: 4 }}>
                    {resultado.puntajeTotal} <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>/ {resultado.puntajeMaximo}</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: 12, opacity: 0.7, textTransform: 'uppercase' }}>Nivel de Cumplimiento</div>
                  <div style={{
                    fontSize: 14, fontWeight: 700, marginTop: 8, display: 'inline-block',
                    padding: '4px 10px', borderRadius: 6,
                    background: resultado.nivelCumplimiento === 'COMPLETO' ? 'rgba(74,222,128,0.2)' : resultado.nivelCumplimiento === 'PARCIAL' ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)',
                    color: resultado.nivelCumplimiento === 'COMPLETO' ? '#4ade80' : resultado.nivelCumplimiento === 'PARCIAL' ? '#fbbf24' : '#fca5a5'
                  }}>
                    {resultado.nivelCumplimiento}
                  </div>
                </div>
              </div>

              {/* Puntos Fuertes & Mejoras */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.2)', padding: 16, borderRadius: 10 }}>
                  <h4 style={{ margin: '0 0 10px', color: '#4ade80', fontSize: 14, fontWeight: 700 }}>✅ Puntos Fuertes</h4>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, opacity: 0.9 }}>
                    {resultado.puntosFuertes.map((pf, i) => <li key={i} style={{ marginBottom: 4 }}>{pf}</li>)}
                  </ul>
                </div>

                <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', padding: 16, borderRadius: 10 }}>
                  <h4 style={{ margin: '0 0 10px', color: '#fca5a5', fontSize: 14, fontWeight: 700 }}>⚠️ Áreas de Oportunidad</h4>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, opacity: 0.9 }}>
                    {resultado.mejorasUrgentes.map((mu, i) => <li key={i} style={{ marginBottom: 4 }}>{mu}</li>)}
                  </ul>
                </div>
              </div>

              {/* Dictamen formal */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: 16, borderRadius: 10, marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#93c5fd' }}>📝 Dictamen de Retroalimentación Pedagógica</h4>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, opacity: 0.95, whiteSpace: 'pre-line' }}>
                  {resultado.retroalimentacionDocente}
                </p>
              </div>

              {/* Criterios desglosados */}
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Desglose de Criterios (Anexo 12)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {resultado.criterios.map((c, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, padding: 12, fontSize: 13
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{c.criterio}</span>
                      <span style={{ fontWeight: 700, color: c.cumple === 'SI' ? '#4ade80' : c.cumple === 'PARCIAL' ? '#fbbf24' : '#fca5a5' }}>
                        {c.puntajeObtenido} / {c.puntajeMax} pts ({c.cumple})
                      </span>
                    </div>
                    <p style={{ margin: '4px 0', opacity: 0.8, fontSize: 12 }}>{c.observacion}</p>
                    {c.recomendacion && (
                      <p style={{ margin: '4px 0 0', color: '#93c5fd', fontSize: 12, fontStyle: 'italic' }}>
                        💡 Recomendación: {c.recomendacion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', justifyContent: 'flex-end', gap: 12
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none',
              borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
