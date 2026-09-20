'use client';

import type { PaecProject } from '@/types/paec';

interface Props {
  project: PaecProject;
  isEditingContent: boolean;
  editPayload: any;
  setEditPayload: (v: any) => void;
}

export default function PaecStep4Cronograma({
  project,
  isEditingContent,
  editPayload,
  setEditPayload,
}: Props) {
  if (!project.fase2Cronograma) return null;

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', width: '18%' }}>Fase Bimestral</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', width: '22%' }}>Objetivo de la Etapa</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', width: '24%' }}>Macro-Actividades del Proyecto</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', width: '24%' }}>Asignaturas Responsables y Justificación</th>
            <th style={{ padding: '8px 12px', textAlign: 'center', width: '12%' }}>Semestre</th>
          </tr>
        </thead>
        <tbody>
          {(isEditingContent && editPayload ? editPayload : project.fase2Cronograma).map((r: any, i: number) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid var(--c-border)' }}>
              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.phase}</td>
              <td style={{ padding: '8px 12px' }}>
                {isEditingContent ? (
                  <textarea
                    value={r.objective}
                    onChange={(e) => {
                      const copy = [...editPayload];
                      copy[i].objective = e.target.value;
                      setEditPayload(copy);
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                  />
                ) : (
                  r.objective
                )}
              </td>
              <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                {isEditingContent ? (
                  <textarea
                    value={r.macroActivities}
                    onChange={(e) => {
                      const copy = [...editPayload];
                      copy[i].macroActivities = e.target.value;
                      setEditPayload(copy);
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                  />
                ) : (
                  r.macroActivities
                )}
              </td>
              <td style={{ padding: '8px 12px', lineHeight: 1.4 }}>
                {isEditingContent ? (
                  <textarea
                    value={r.responsibleSubjects || ''}
                    onChange={(e) => {
                      const copy = [...editPayload];
                      copy[i].responsibleSubjects = e.target.value;
                      setEditPayload(copy);
                    }}
                    style={{ width: '100%', padding: '6px', fontSize: '12.5px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px', fontFamily: 'inherit' }}
                  />
                ) : (
                  r.responsibleSubjects || 'Todas las asignaturas vinculadas'
                )}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{r.semesterInvolved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
