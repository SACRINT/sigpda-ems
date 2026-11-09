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
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
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

