'use client';

import React, { useEffect } from 'react';
import type { Planning, SecuenciaBloque } from '@/types/planning';
import DocumentA4Viewer from '@/components/common/DocumentA4Viewer';
import { Printer, X } from 'lucide-react';

export interface DocumentA4ModalProps {
  isOpen: boolean;
  onClose: () => void;
  planning: Planning;
  sequenceData?: Record<number, SecuenciaBloque>;
}

export default function DocumentA4Modal({
  isOpen,
  onClose,
  planning,
  sequenceData = {},
}: DocumentA4ModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

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
      aria-labelledby="a4-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-sheet">
        <div className="modal-sheet-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Printer size={18} style={{ color: 'var(--c-accent-bright)' }} />
            <div>
              <h3
                id="a4-modal-title"
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--c-text)',
                }}
              >
                Vista Previa de Impresión · Formato Carta Oficial
              </h3>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '12px',
                  color: 'var(--c-text-muted)',
                }}
              >
                {planning.uacName} · {planning.semester}° Semestre
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista de impresión"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--c-bg-surface)',
              border: '1px solid var(--c-border-2)',
              color: 'var(--c-text)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-sheet-body">
          <DocumentA4Viewer
            planning={{ ...planning, sequenceJson: sequenceData }}
            onDownloadDocx={() => {
              window.location.href = `/api/docx/${planning?.id}`;
            }}
          />
        </div>
      </div>
    </div>
  );
}

