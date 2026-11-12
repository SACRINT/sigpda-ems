'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import type { AjustesDUA, DUACategoria, DUAAdjustment } from '@/types/planning';
import { Accessibility, Loader2, Sparkles } from 'lucide-react';

const CATEGORIAS: Array<{ id: DUACategoria; label: string; short: string }> = [
  { id: 'bap_sensorial', label: 'BAP sensorial', short: 'Visual, auditiva o multimodal' },
  { id: 'bap_motriz', label: 'BAP motriz', short: 'Espacio, instrumentos y participación' },
  { id: 'ritmos_rezago', label: 'Ritmos y rezago', short: 'Dosificación y acompañamiento' },
  { id: 'sobresalientes', label: 'Sobresalientes', short: 'Enriquecimiento y profundización' },
];

export interface DUAAdjustmentsCardProps {
  planningId: string;
  ajustesDUA?: AjustesDUA | null;
  canEdit?: boolean;
  onGenerated?: (ajustesDUA: AjustesDUA) => void;
}

function AdjustmentBlock({ adjustment }: { adjustment: DUAAdjustment }) {
  const label = CATEGORIAS.find((item) => item.id === adjustment.categoria)?.label || adjustment.categoria;
  return (
    <div
      style={{
        border: '1px solid var(--c-border)',
        borderRadius: '10px',
        padding: '14px',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '10.5px',
            fontWeight: 800,
            color: '#a78bfa',
            background: 'rgba(167,139,250,0.12)',
            border: '1px solid rgba(167,139,250,0.3)',
            borderRadius: '999px',
            padding: '2px 8px',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <strong style={{ fontSize: '13px', color: 'var(--c-text)' }}>{adjustment.titulo}</strong>
      </div>
      <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.55, color: 'var(--c-text-2)' }}>
        {adjustment.descripcion}
      </p>
      <div>
        <p style={{ margin: '0 0 3px', fontSize: '11.5px', fontWeight: 700, color: 'var(--c-text)' }}>
          Estrategias
        </p>
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', lineHeight: 1.55, color: 'var(--c-text-2)' }}>
          {adjustment.estrategias.map((estrategia, idx) => (
            <li key={idx}>{estrategia}</li>
          ))}
        </ul>
      </div>
      <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: 'var(--c-text-2)' }}>
        <strong style={{ color: 'var(--c-text)' }}>Evaluación diferenciada:</strong>{' '}
        {adjustment.evaluacionDiferenciada}
      </p>
      <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: 'var(--c-text-muted)' }}>
        <strong style={{ color: 'var(--c-text-2)' }}>Recursos:</strong> {adjustment.recursos.join(' · ')}
      </p>
    </div>
  );
}

export default function DUAAdjustmentsCard({
  planningId,
  ajustesDUA,
  canEdit = true,
  onGenerated,
}: DUAAdjustmentsCardProps) {
  const [current, setCurrent] = useState<AjustesDUA | null>(ajustesDUA || null);
  const [selected, setSelected] = useState<DUACategoria[]>(CATEGORIAS.map((item) => item.id));
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrent(ajustesDUA || null);
  }, [ajustesDUA]);

  const generatedLabel = (() => {
    if (!current?.generadoEn) return '';
    const date = new Date(current.generadoEn);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  })();

  const toggleCategoria = (categoria: DUACategoria) => {
    setSelected((prev) =>
      prev.includes(categoria) ? prev.filter((item) => item !== categoria) : [...prev, categoria]
    );
  };

  const handleGenerate = async () => {
    if (loading || selected.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/planeaciones/dua', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId, categorias: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudieron generar las adecuaciones DUA.');
      const next = data.ajustesDUA as AjustesDUA;
      setCurrent(next);
      onGenerated?.(next);
      if (data.warning) {
        toast(data.warning, { icon: '⚠️' });
      } else {
        toast.success('Adecuaciones DUA generadas y guardadas.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al generar DUA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-card" data-testid="dua-adjustments-card">
      <div
        className="section-card-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Accessibility size={18} style={{ color: '#a78bfa' }} />
          <span className="section-card-title">Adecuaciones DUA</span>
          {current && (
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 800,
                color: '#a78bfa',
                background: 'rgba(167,139,250,0.12)',
                border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: '999px',
                padding: '2px 8px',
              }}
            >
              {current.fuente === 'ia' ? 'IA' : current.fuente === 'manual' ? 'Manual' : 'Sugerida'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !canEdit || selected.length === 0}
          title={!canEdit ? 'No tienes permisos para editar esta planeación.' : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(167,139,250,0.45)',
            background: 'rgba(167,139,250,0.14)',
            color: '#c4b5fd',
            fontSize: '12px',
            fontWeight: 700,
            cursor: loading || !canEdit || selected.length === 0 ? 'not-allowed' : 'pointer',
            opacity: loading || !canEdit || selected.length === 0 ? 0.55 : 1,
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Generando…' : current ? 'Regenerar con IA' : 'Generar con IA'}
        </button>
      </div>

      <div className="section-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {CATEGORIAS.map((categoria) => {
            const active = selected.includes(categoria.id);
            return (
              <button
                key={categoria.id}
                type="button"
                onClick={() => toggleCategoria(categoria.id)}
                aria-pressed={active}
                style={{
                  padding: '6px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${active ? 'rgba(167,139,250,0.55)' : 'var(--c-border)'}`,
                  background: active ? 'rgba(167,139,250,0.14)' : 'transparent',
                  color: active ? '#c4b5fd' : 'var(--c-text-muted)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title={categoria.short}
              >
                {categoria.label}
              </button>
            );
          })}
        </div>

        {current ? (
          <>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.55, color: 'var(--c-text-2)' }}>
              {current.resumen}
              {generatedLabel ? ` · ${generatedLabel}` : ''}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {current.ajustes.map((adjustment) => (
                <AdjustmentBlock key={adjustment.id} adjustment={adjustment} />
              ))}
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.55, color: 'var(--c-text-muted)' }}>
            Genera ajustes razonables para eliminar barreras de aprendizaje sin reducir los aprendizajes esperados.
            Selecciona las categorías que necesitas y guarda la propuesta en la planeación.
          </p>
        )}
      </div>
    </div>
  );
}
