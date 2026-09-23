'use client';

import type { PaecProject, PlanOperativoRow } from '@/types/paec';

interface Props {
  project: PaecProject;
  isEditingContent: boolean;
  editPayload: PlanOperativoRow[] | null;
  setEditPayload: (v: PlanOperativoRow[] | null) => void;
}

export default function PaecStep6PlanOpA({
  project,
  isEditingContent,
  editPayload,
  setEditPayload,
}: Props) {
  const semAData: PlanOperativoRow[] = (isEditingContent && Array.isArray(editPayload))
    ? editPayload
    : (project.fase3PlanOperativoA && project.fase3PlanOperativoA.length > 0
        ? project.fase3PlanOperativoA
        : (project.fase2PlanOperativo?.semestreA || []));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ fontSize: '17px', color: 'var(--c-navy-light)', fontWeight: 700, margin: 0 }}>
            Plan Operativo: Semestre A (1°, 3° y 5° Semestre)
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', margin: '4px 0 0' }}>
            Desglose operativo semanal estructurado en 3 bloques de ejecución conforme al estándar normativo MCCEMS.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge" style={{ backgroundColor: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '4px 10px', fontSize: '12px' }}>
            ⚡ 16 Semanas × 8 Columnas
          </span>
          <span className="badge" style={{ backgroundColor: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '4px 10px', fontSize: '12px' }}>
            {semAData.length} Actividades
          </span>
        </div>
      </div>

      {semAData.length === 0 ? (
        <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', color: 'var(--c-text-muted)' }}>
          No se encontraron actividades del Plan Operativo Semestre A. Haz clic en regenerar.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--c-border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
          <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', width: '9%' }}>Fase</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', width: '5%' }}>Sem.</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', width: '22%' }}>Actividad Semanal</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', width: '14%' }}>UAC / Asignatura</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '9%' }}>Progresión / Propósito</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', width: '13%' }}>Estrategia Didáctica</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', width: '14%' }}>Docentes Responsables</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', width: '14%' }}>Inst. Evaluación</th>
              </tr>
            </thead>
            <tbody>
              {semAData.map((r: PlanOperativoRow, i: number) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--c-blue-light)' }}>{r.phase}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: '#f0f4ff' }}>{r.week}</td>
                  <td style={{ padding: '8px 10px' }}>
                    {isEditingContent ? (
                      <textarea
                        value={r.activity}
                        onChange={(e) => {
                          const copy = [...semAData];
                          copy[i] = { ...copy[i], activity: e.target.value };
                          setEditPayload(copy);
                        }}
                        style={{ width: '100%', padding: '4px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #555', background: '#0d1530', color: '#fff', minHeight: '54px', fontFamily: 'inherit' }}
                      />
                    ) : (
                      <span style={{ color: '#f0f4ff', lineHeight: 1.4 }}>{r.activity}</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#93c5fd' }}>{r.uac}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: '#cbd5e1' }}>{r.progression}</td>
                  <td style={{ padding: '8px 10px' }}>
                    {isEditingContent ? (
                      <input
                        type="text"
                        value={r.strategy}
                        onChange={(e) => {
                          const copy = [...semAData];
                          copy[i] = { ...copy[i], strategy: e.target.value };
                          setEditPayload(copy);
                        }}
                        style={{ width: '100%', padding: '4px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #555', background: '#0d1530', color: '#fff' }}
                      />
                    ) : (
                      <span style={{ color: '#e2e8f0' }}>{r.strategy}</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {isEditingContent ? (
                      <input
                        type="text"
                        value={r.responsibles}
                        onChange={(e) => {
                          const copy = [...semAData];
                          copy[i] = { ...copy[i], responsibles: e.target.value };
                          setEditPayload(copy);
                        }}
                        style={{ width: '100%', padding: '4px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #555', background: '#0d1530', color: '#fff' }}
                      />
                    ) : (
                      <span style={{ color: '#cbd5e1' }}>{r.responsibles}</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {isEditingContent ? (
                      <input
                        type="text"
                        value={r.evaluationInstrument || ''}
                        onChange={(e) => {
                          const copy = [...semAData];
                          copy[i] = { ...copy[i], evaluationInstrument: e.target.value };
                          setEditPayload(copy);
                        }}
                        style={{ width: '100%', padding: '4px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #555', background: '#0d1530', color: '#fff' }}
                      />
                    ) : (
                      <span style={{ color: '#a7f3d0' }}>{r.evaluationInstrument || 'Rúbrica'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
