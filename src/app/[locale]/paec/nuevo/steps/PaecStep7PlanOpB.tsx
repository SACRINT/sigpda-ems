'use client';

import type { PaecProject, PlanOperativoRow } from '@/types/paec';

interface Props {
  project: PaecProject;
  isEditingContent: boolean;
  editPayload: any;
  setEditPayload: (v: any) => void;
}

export default function PaecStep7PlanOpB({
  project,
  isEditingContent,
  editPayload,
  setEditPayload,
}: Props) {
  const semBData: PlanOperativoRow[] = (isEditingContent && Array.isArray(editPayload))
    ? editPayload
    : (project.fase3PlanOperativoB && project.fase3PlanOperativoB.length > 0
        ? project.fase3PlanOperativoB
        : (project.fase2PlanOperativo?.semestreB || []));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ fontSize: '17px', color: 'var(--c-navy-light)', fontWeight: 700, margin: 0 }}>
            Plan Operativo: Semestre B (2°, 4° y 6° Semestre)
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', margin: '4px 0 0' }}>
            Continuidad operativa mediante el Modelo de Relevos Curriculares hasta la entrega de la solución comunitaria.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge" style={{ backgroundColor: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)', padding: '4px 10px', fontSize: '12px' }}>
            ⚡ 16 Semanas × 8 Columnas
          </span>
          <span className="badge" style={{ backgroundColor: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', padding: '4px 10px', fontSize: '12px' }}>
            {semBData.length} Actividades
          </span>
        </div>
      </div>

      {/* Banner Semana 16 */}
      <div style={{ padding: '12px 16px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '22px' }}>🏆</span>
        <div style={{ fontSize: '13px', color: '#fde68a', lineHeight: 1.4 }}>
          <strong>Semana 16 de Cierre Institucional:</strong> Culminación de proyectos integradores, Feria / Muestra Comunitaria de Aprendizajes y Rendición de Cuentas a familias y autoridades educativas.
        </div>
      </div>

      {semBData.length === 0 ? (
        <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', color: 'var(--c-text-muted)' }}>
          No se encontraron actividades del Plan Operativo Semestre B. Haz clic en regenerar.
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
              {semBData.map((r: PlanOperativoRow, i: number) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--c-blue-light)' }}>{r.phase}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: String(r.week) === '16' ? '#fbbf24' : '#f0f4ff' }}>
                    {String(r.week) === '16' ? '⭐ 16' : r.week}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {isEditingContent ? (
                      <textarea
                        value={r.activity}
                        onChange={(e) => {
                          const copy = [...semBData];
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
                          const copy = [...semBData];
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
                          const copy = [...semBData];
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
                          const copy = [...semBData];
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
