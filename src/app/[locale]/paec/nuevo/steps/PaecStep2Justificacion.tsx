'use client';

import React from 'react';
import type { PaecProject, Fase2Justificacion } from '@/types/paec';

interface Props {
  project: PaecProject;
  isEditingContent: boolean;
  editPayload: Fase2Justificacion | null;
  setEditPayload: (v: Fase2Justificacion | null) => void;
}

export default function PaecStep2Justificacion({
  project,
  isEditingContent,
  editPayload,
  setEditPayload,
}: Props) {
  if (!project.fase2Justificacion) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', lineHeight: 1.6 }}>
      <div>
        <strong>Nombre del Proyecto Definitivo:</strong>
        {isEditingContent ? (
          <input
            type="text"
            value={editPayload?.projectName || ''}
            onChange={(e) => {
              const copy = { ...editPayload } as Fase2Justificacion;
              copy.projectName = e.target.value;
              setEditPayload(copy);
            }}
            style={{ width: '100%', padding: '8px', fontSize: '15px', fontWeight: 600, borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
          />
        ) : (
          <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--c-navy)' }}>{project.fase2Justificacion.projectName}</p>
        )}
      </div>
      <div>
        <strong>Introducción y Justificación Académica:</strong>
        {isEditingContent ? (
          <textarea
            value={editPayload?.introduction || ''}
            onChange={(e) => {
              const copy = { ...editPayload } as Fase2Justificacion;
              copy.introduction = e.target.value;
              setEditPayload(copy);
            }}
            style={{ width: '100%', padding: '8px', fontSize: '14px', borderRadius: '6px', border: '1px solid #ccc', minHeight: '140px', marginTop: '4px', fontFamily: 'inherit' }}
          />
        ) : (
          <p style={{ fontSize: '14px', whiteSpace: 'pre-line' }}>{project.fase2Justificacion.introduction}</p>
        )}
      </div>
      <div>
        <strong>Pilares Estratégicos de Viabilidad:</strong>
        {isEditingContent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            {(editPayload?.pilares || []).map((pilar: string, i: number) => (
              <input
                key={i}
                type="text"
                value={pilar}
                onChange={(e) => {
                  const copy = { ...editPayload } as Fase2Justificacion;
                  if (copy.pilares) {
                    copy.pilares[i] = e.target.value;
                  }
                  setEditPayload(copy);
                }}
                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            ))}
          </div>
        ) : (
          <ul style={{ listStyleType: 'disc', paddingLeft: '20px', fontSize: '14px' }}>
            {project.fase2Justificacion.pilares.map((pilar, i) => (
              <li key={i} style={{ marginBottom: '8px' }}>{pilar}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <strong>Propósitos Integrales del PEC:</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: '8px' }}>
          <div style={{ padding: '12px', background: 'var(--c-blue-pale)', borderRadius: '6px' }}>
            <strong style={{ color: 'var(--c-navy)' }}>Propósito Educativo:</strong>
            {isEditingContent ? (
              <textarea
                value={editPayload?.proposito?.educativo || ''}
                onChange={(e) => {
                  const copy = { ...editPayload } as Fase2Justificacion;
                  if (copy.proposito) {
                    copy.proposito.educativo = e.target.value;
                  }
                  setEditPayload(copy);
                }}
                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', marginTop: '4px', fontFamily: 'inherit' }}
              />
            ) : (
              <p style={{ margin: '6px 0 0', fontSize: '13px' }}>{project.fase2Justificacion.proposito.educativo}</p>
            )}
          </div>
          <div style={{ padding: '12px', background: 'var(--c-blue-pale)', borderRadius: '6px' }}>
            <strong style={{ color: 'var(--c-navy)' }}>Propósito Social:</strong>
            {isEditingContent ? (
              <textarea
                value={editPayload?.proposito?.social || ''}
                onChange={(e) => {
                  const copy = { ...editPayload } as Fase2Justificacion;
                  if (copy.proposito) {
                    copy.proposito.social = e.target.value;
                  }
                  setEditPayload(copy);
                }}
                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', marginTop: '4px', fontFamily: 'inherit' }}
              />
            ) : (
              <p style={{ margin: '6px 0 0', fontSize: '13px' }}>{project.fase2Justificacion.proposito.social}</p>
            )}
          </div>
          <div style={{ padding: '12px', background: 'var(--c-blue-pale)', borderRadius: '6px' }}>
            <strong style={{ color: 'var(--c-navy)' }}>Propósito Funcional:</strong>
            {isEditingContent ? (
              <textarea
                value={editPayload?.proposito?.funcional || ''}
                onChange={(e) => {
                  const copy = { ...editPayload } as Fase2Justificacion;
                  if (copy.proposito) {
                    copy.proposito.funcional = e.target.value;
                  }
                  setEditPayload(copy);
                }}
                style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', marginTop: '4px', fontFamily: 'inherit' }}
              />
            ) : (
              <p style={{ margin: '6px 0 0', fontSize: '13px' }}>{project.fase2Justificacion.proposito.funcional}</p>
            )}
          </div>
        </div>
      </div>
      <div>
        <strong>Metas Cuantitativas:</strong>
        {isEditingContent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            {(editPayload?.alcance?.metas || []).map((m: string, i: number) => (
              <input
                key={i}
                type="text"
                value={m}
                onChange={(e) => {
                  const copy = { ...editPayload } as Fase2Justificacion;
                  if (copy.alcance && copy.alcance.metas) {
                    copy.alcance.metas[i] = e.target.value;
                  }
                  setEditPayload(copy);
                }}
                style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            ))}
          </div>
        ) : (
          <ul style={{ listStyleType: 'decimal', paddingLeft: '20px', fontSize: '13px' }}>
            {project.fase2Justificacion.alcance.metas.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
