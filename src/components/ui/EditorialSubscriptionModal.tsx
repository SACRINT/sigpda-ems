'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Sparkles, X, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

export interface EditorialSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * EditorialSubscriptionModal — Modal de Suscripción al Motor Editorial Premium
 * SIGPDA-EMS · Motor Editorial de Alta Gama (Fase 3)
 *
 * Se presenta exclusivamente cuando el Route Handler devuelve HTTP 403 con code: PREMIUM_REQUIRED.
 * Ofrece acceso a los planes de suscripción para habilitar la compilación con Typst en imprenta.
 */
export default function EditorialSubscriptionModal({
  isOpen,
  onClose,
}: EditorialSubscriptionModalProps) {
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap y tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        // AUD-U2: Si el foco quedó fuera del modal, reincorporarlo al primer elemento
        if (!modalRef.current.contains(document.activeElement)) {
          event.preventDefault();
          firstElement.focus();
          return;
        }

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Auto-focus en el botón primario al abrir
    const timer = setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNavigateToSubscription = () => {
    onClose();
    router.push('/suscripcion');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="editorial-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(8, 10, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        style={{
          background: 'var(--c-bg-surface, #131324)',
          border: '1px solid var(--c-border, rgba(255, 255, 255, 0.15))',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '580px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          color: 'var(--c-text, #f0f4ff)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Cabecera con badge de grado editorial */}
        <div
          style={{
            padding: '24px 28px 20px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.05) 100%)',
            borderBottom: '1px solid var(--c-border, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 700,
                background: 'rgba(99, 102, 241, 0.2)',
                color: 'var(--c-accent-bright, #818cf8)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                marginBottom: '10px',
              }}
            >
              <Sparkles size={13} />
              <span>SUSCRIPCIÓN REQUERIDA</span>
            </div>
            <h2
              id="editorial-modal-title"
              style={{
                fontSize: '21px',
                fontWeight: 800,
                margin: 0,
                color: 'var(--c-text, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                letterSpacing: '-0.02em',
              }}
            >
              <BookOpen size={24} style={{ color: '#818cf8' }} />
              Motor Editorial Premium
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              padding: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del modal y Copy de Valor */}
        <div style={{ padding: '24px 28px' }}>
          <p
            style={{
              margin: '0 0 20px',
              fontSize: '14.5px',
              lineHeight: 1.6,
              color: 'var(--c-text-muted, #cbd5e1)',
            }}
          >
            La generación de libros de texto para estudiantes con el estándar tipográfico de imprenta
            oficial es una característica exclusiva para suscriptores Premium de SIGPDA-EMS.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px 18px',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <CheckCircle2 size={17} style={{ color: '#34d399', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '13.5px', color: '#f1f5f9' }}>
                <strong>Compilación de Imprenta Typst:</strong> Libros de texto deterministas con maquetación
                profesional a 2 columnas y tipografía editorial de alta legibilidad.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <CheckCircle2 size={17} style={{ color: '#34d399', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '13.5px', color: '#f1f5f9' }}>
                <strong>Lomo Paramétrico Automatizado:</strong> Cálculo exacto del lomo y guías de encuadernación
                según el gramaje de papel estándar (0.09 mm).
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <CheckCircle2 size={17} style={{ color: '#34d399', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '13.5px', color: '#f1f5f9' }}>
                <strong>Almacenamiento Durable Vercel Blob:</strong> Enlaces permanentes y optimización de
                descarga instantánea sin costo de re-compilación (deduplicación por contenido).
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <ShieldCheck size={17} style={{ color: '#818cf8', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '13.5px', color: '#f1f5f9' }}>
                <strong>Cumplimiento Normativo MCCEMS:</strong> Estructura pedagógica completa alineada a Proyectos
                Aula Escuela Comunidad (PAEC).
              </span>
            </div>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn"
              style={{
                padding: '10px 18px',
                fontSize: '13.5px',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
            <button
              ref={primaryButtonRef}
              type="button"
              onClick={handleNavigateToSubscription}
              className="btn"
              style={{
                padding: '10px 22px',
                fontSize: '13.5px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(79, 70, 229, 0.45)',
              }}
            >
              <span>Ver planes</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
