'use client';

import type { PaecProject } from '@/types/paec';

interface Props {
  project: PaecProject;
  isEditingContent: boolean;
  editPayload: any;
  setEditPayload: (v: any) => void;
}

export default function PaecStep5DetalleCurricular({
  project,
  isEditingContent,
  editPayload,
  setEditPayload,
}: Props) {
  if (!project.fase2DetalleCurricular) return null;

  return (
    <div>
      <h3 style={{ fontSize: '15px', color: 'var(--c-navy-light)', fontWeight: 600, marginBottom: '10px' }}>
        Matriz de Detalle Curricular por Semestre (Fundamentación y Progresiones / Propósitos NOM-MCCEMS)
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
            <th style={{ padding: '8px 12px', textAlign: 'center', width: '8%' }}>Sem</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', width: '22%' }}>Asignatura (UAC)</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Progresiones o Propósitos Formativos</th>
            <th style={{ padding: '8px 12px', textAlign: 'center', width: '15%' }}>Fase(s) del Proyecto</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', width: '30%' }}>Justificación Curricular</th>
          </tr>
        </thead>
        <tbody>
          {(isEditingContent && editPayload ? editPayload : project.fase2DetalleCurricular).map((r: any, i: number) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
              <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{r.semester}°</td>
              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.uacName}</td>
              <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                {isEditingContent ? (
                  <textarea
                    value={r.progressionsOrPurposes}
                    onChange={(e) => {
                      const copy = [...editPayload];
                      copy[i].progressionsOrPurposes = e.target.value;
                      setEditPayload(copy);
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                  />
                ) : (
                  r.progressionsOrPurposes
                )}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                {isEditingContent ? (
                  <input
                    type="text"
                    value={r.projectPhases}
                    onChange={(e) => {
                      const copy = [...editPayload];
                      copy[i].projectPhases = e.target.value;
                      setEditPayload(copy);
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                ) : (
                  r.projectPhases
                )}
              </td>
              <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                {isEditingContent ? (
                  <textarea
                    value={r.curricularJustification}
                    onChange={(e) => {
                      const copy = [...editPayload];
                      copy[i].curricularJustification = e.target.value;
                      setEditPayload(copy);
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                  />
                ) : (
                  r.curricularJustification
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
