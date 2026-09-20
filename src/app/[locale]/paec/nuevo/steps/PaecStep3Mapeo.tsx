'use client';

import type { PaecProject } from '@/types/paec';

interface Props {
  project: PaecProject;
  isEditingContent: boolean;
  editPayload: any;
  setEditPayload: (v: any) => void;
}

export default function PaecStep3Mapeo({
  project,
  isEditingContent,
  editPayload,
  setEditPayload,
}: Props) {
  if (!project.fase2Mapeo) return null;

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
            <th style={{ padding: '8px 12px', textAlign: 'center', width: '10%' }}>Sem</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Asignatura (UAC)</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', width: '25%' }}>Actividad / Tema Práctico</th>
            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Vinculación y Progresión Curricular</th>
          </tr>
        </thead>
        <tbody>
          {(isEditingContent && editPayload ? editPayload : project.fase2Mapeo).map((r: any, i: number) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
              <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{r.semester}°</td>
              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.uacName}</td>
              <td style={{ padding: '8px 12px' }}>
                {isEditingContent ? (
                  <input
                    type="text"
                    value={r.topic}
                    onChange={(e) => {
                      const copy = [...editPayload];
                      copy[i].topic = e.target.value;
                      setEditPayload(copy);
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                ) : (
                  r.topic
                )}
              </td>
              <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                {isEditingContent ? (
                  <textarea
                    value={r.linking}
                    onChange={(e) => {
                      const copy = [...editPayload];
                      copy[i].linking = e.target.value;
                      setEditPayload(copy);
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                  />
                ) : (
                  r.linking
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
