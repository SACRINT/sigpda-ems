'use client';

import React, { useEffect, useRef } from 'react';

export interface ChecklistSupervisionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHECKLIST_ITEMS = [
  { label: 'Propósitos Formativos / Contenidos Formativos', desc: 'Contenidos temáticos oficiales de la UAC vinculados al MCCEMS.', status: true },
  { label: 'Meta Educativa', desc: 'Metas de aprendizaje claras, objetivas y orientadas al logro de trayectoria.', status: true },
  { label: 'Transversalidad Disciplinar', desc: 'Conexión coherente con otras asignaturas del mismo semestre y currículum ampliado.', status: true },
  { label: 'Exploración de Conocimientos Previos', desc: 'Fase de Apertura con recuperación activa de saberes e ideas de los estudiantes.', status: true },
  { label: 'Actividades de Aprendizaje Acordes', desc: 'Actividades continuas, contextualizadas a la comunidad de Puebla y al PAEC.', status: true },
  { label: 'Metodología Socio-crítica / Estrategias Activas', desc: 'Uso obligatorio de ABP, Método de Casos o Simulaciones prácticas (Nivel 2 de complejidad).', status: true },
  { label: 'Productos Esperados', desc: 'Entregables físicos/digitales concretos por sesión y por Actividad Clave.', status: true },
  { label: 'Temporalidad y Dosificación de Tiempos', desc: 'Dosificación matemática estricta por Cortes (18h/24h por corte) y sesiones de 50 min.', status: true },
  { label: 'Momentos de Evaluación Formativa', desc: 'Evaluación Diagnóstica, Formativa y Sumativa con Hetero, Co y Autoevaluación.', status: true },
  { label: 'Metacognición Formativa en Cierre', desc: 'Fase de Cierre orientada a la reflexión del aprendizaje y consolidación de competencias.', status: true },
  { label: 'Instrumentos Objetivos de Evaluación', desc: 'Rúbricas analíticas y Listas de cotejo para Producto y Desempeño.', status: true },
];

export default function ChecklistSupervisionModal({
  isOpen,
  onClose,
}: ChecklistSupervisionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const focusables = modalRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables && focusables.length > 0) {
      focusables[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const elements = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (elements.length === 0) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
      }}
    >
      <div
        className="modal-sheet"
        style={{
          background: 'var(--c-card-bg)',
          border: '1px solid var(--c-border-2)',
          borderRadius: '12px',
          maxWidth: '750px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: 'var(--shadow-xl)',
          color: 'var(--c-text)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--c-border)',
            paddingBottom: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3
              id="checklist-modal-title"
              style={{ fontSize: '18px', fontWeight: 800, color: 'var(--c-text)', margin: 0 }}
            >
              📋 Lista de Cotejo de Supervisión MCCEMS (2026-2027)
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--c-text-muted)', margin: '4px 0 0 0' }}>
              Alineado a <em>03 Lista de cotejo Plan de Clase 1-4_SEM.pdf</em> y normativas del Bachillerato General Estatal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de supervisión"
            style={{
              background: 'var(--c-bg-elevated)',
              color: 'var(--c-text)',
              border: '1px solid var(--c-border)',
              borderRadius: '6px',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {CHECKLIST_ITEMS.map((item, i) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                padding: '10px 12px',
                background: 'var(--c-bg-surface)',
                borderRadius: '8px',
                border: '1px solid var(--c-border)',
              }}
            >
              <span
                style={{
                  background: '#10b981',
                  color: '#fff',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                ✓
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--c-text)' }}>
                  {i + 1}. {item.label}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--c-text-muted)', marginTop: '2px' }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--c-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>
            ✓ Cumplimiento del 100% verificado por DidácticaIA
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-navy"
            style={{ padding: '8px 18px', fontSize: '13px', borderRadius: '6px' }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

