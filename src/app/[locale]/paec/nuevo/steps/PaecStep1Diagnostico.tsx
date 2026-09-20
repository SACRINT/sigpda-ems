'use client';

import type { PaecProject } from '@/types/paec';

interface Props {
  project: PaecProject;
  isEditingContent: boolean;
  editPayload: any;
  setEditPayload: (v: any) => void;
}

export default function PaecStep1Diagnostico({
  project,
  isEditingContent,
  editPayload,
  setEditPayload,
}: Props) {
  if (!project.fase1Diagnostico) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Tabla 1: Características de la comunidad (Contexto Externo)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Aspecto</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {(isEditingContent && editPayload?.tabla1 ? editPayload.tabla1 : project.fase1Diagnostico.tabla1).map((r: any, i: number) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.col1}</td>
                <td style={{ padding: '8px 12px', lineHeight: 1.5 }}>
                  {isEditingContent ? (
                    <textarea
                      value={r.col2}
                      onChange={(e) => {
                        const copy = { ...editPayload };
                        copy.tabla1[i].col2 = e.target.value;
                        setEditPayload(copy);
                      }}
                      style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                    />
                  ) : (
                    r.col2
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Tabla 2: Características de la educación e institución (Contexto Interno)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Aspecto Escolar</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {(isEditingContent && editPayload?.tabla2 ? editPayload.tabla2 : project.fase1Diagnostico.tabla2).map((r: any, i: number) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.col1}</td>
                <td style={{ padding: '8px 12px', lineHeight: 1.5 }}>
                  {isEditingContent ? (
                    <textarea
                      value={r.col2}
                      onChange={(e) => {
                        const copy = { ...editPayload };
                        copy.tabla2[i].col2 = e.target.value;
                        setEditPayload(copy);
                      }}
                      style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                    />
                  ) : (
                    r.col2
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Tabla 3: Análisis FODA y Estrategia Maestra del PEC</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Aspecto FODA</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Análisis Estratégico</th>
            </tr>
          </thead>
          <tbody>
            {(isEditingContent && editPayload?.tabla3 ? editPayload.tabla3 : project.fase1Diagnostico.tabla3).map((r: any, i: number) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.aspect}</td>
                <td style={{ padding: '8px 12px', lineHeight: 1.5 }}>
                  {isEditingContent ? (
                    <textarea
                      value={r.analysis}
                      onChange={(e) => {
                        const copy = { ...editPayload };
                        copy.tabla3[i].analysis = e.target.value;
                        setEditPayload(copy);
                      }}
                      style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                    />
                  ) : (
                    r.analysis
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>Tabla 4: Problemáticas o necesidades de la comunidad (Proceso de Selección)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Etapa del Proceso</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {(isEditingContent && editPayload?.tabla4 ? editPayload.tabla4 : project.fase1Diagnostico.tabla4).map((r: any, i: number) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.col1}</td>
                <td style={{ padding: '8px 12px', lineHeight: 1.5 }}>
                  {isEditingContent ? (
                    <textarea
                      value={r.col2}
                      onChange={(e) => {
                        const copy = { ...editPayload };
                        copy.tabla4[i].col2 = e.target.value;
                        setEditPayload(copy);
                      }}
                      style={{ width: '100%', padding: '6px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                    />
                  ) : (
                    r.col2
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
