'use client';

import type { PaecProject, PaecImplementacion, AnexosData } from '@/types/paec';

interface Props {
  project: PaecProject;
  collapsedCarta: boolean;
  setCollapsedCarta: (v: boolean) => void;
  collapsedMinuta: boolean;
  setCollapsedMinuta: (v: boolean) => void;
  collapsedOficios: boolean;
  setCollapsedOficios: (v: boolean) => void;
  activeAnexoTab: number;
  setActiveAnexoTab: (v: number) => void;
}

export default function PaecStep8Implementacion({
  project,
  collapsedCarta,
  setCollapsedCarta,
  collapsedMinuta,
  setCollapsedMinuta,
  collapsedOficios,
  setCollapsedOficios,
  activeAnexoTab,
  setActiveAnexoTab,
}: Props) {
  const imp: PaecImplementacion | undefined = project.fase3Implementacion || undefined;
  const carta = imp?.cartaInvitacion;
  const minuta = imp?.minutaArranque;
  const oficios = imp?.oficiosAliados || [];
  const anexos: AnexosData | undefined = (project.fase2Anexos as unknown as AnexosData) || undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Secciones Colapsables de Implementación */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 1. Carta de Convocatoria */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div
            onClick={() => setCollapsedCarta(!collapsedCarta)}
            style={{ padding: '14px 18px', background: 'rgba(30,58,138,0.25)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>✉️</span>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#93c5fd' }}>
                1. Carta de Convocatoria Comunitaria (Asamblea de Vinculación)
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              {collapsedCarta ? '▶ Mostrar' : '▼ Ocultar'}
            </span>
          </div>

          {!collapsedCarta && (
            <div style={{ padding: '18px', fontSize: '13px', lineHeight: 1.6, color: '#f0f4ff' }}>
              {carta ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', padding: '10px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px' }}>
                    <div><strong>Asunto:</strong> {carta.asunto}</div>
                    <div><strong>Fecha de emisión:</strong> {carta.fecha}</div>
                    <div><strong>Destinatarios:</strong> {carta.destinatarios}</div>
                    <div><strong>Cita:</strong> {carta.fechaReunion} a las {carta.hora} hrs en {carta.lugar}</div>
                  </div>
                  <div style={{ whiteSpace: 'pre-line', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                    {carta.cuerpo}
                  </div>
                  {carta.objetivos && carta.objetivos.length > 0 && (
                    <div>
                      <strong style={{ color: '#93c5fd' }}>Objetivos de la Convocatoria:</strong>
                      <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
                        {carta.objetivos.map((obj, oi) => (
                          <li key={oi}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div style={{ textAlign: 'right', marginTop: '10px', fontStyle: 'italic', color: 'rgba(255,255,255,0.7)' }}>
                    <div>Atentamente,</div>
                    <strong>{carta.firmante}</strong>
                    <div>{carta.cargo}</div>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--c-text-muted)', fontStyle: 'italic' }}>Carta generada como parte de la fase de implementación.</div>
              )}
            </div>
          )}
        </div>

        {/* 2. Minuta de Arranque */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div
            onClick={() => setCollapsedMinuta(!collapsedMinuta)}
            style={{ padding: '14px 18px', background: 'rgba(16,185,129,0.18)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>📝</span>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#6ee7b7' }}>
                2. Minuta de Arranque e Instalación del Comité de Proyecto
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              {collapsedMinuta ? '▶ Mostrar' : '▼ Ocultar'}
            </span>
          </div>

          {!collapsedMinuta && (
            <div style={{ padding: '18px', fontSize: '13px', color: '#f0f4ff' }}>
              {minuta ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', color: 'rgba(255,255,255,0.8)' }}>
                    <span><strong>Fecha:</strong> {minuta.fecha}</span>
                    <span><strong>Tipo:</strong> {minuta.tipoReunion}</span>
                    {minuta.cct && <span><strong>CCT:</strong> {minuta.cct}</span>}
                  </div>

                  {minuta.acuerdos && minuta.acuerdos.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '14px', color: '#a7f3d0', margin: '0 0 8px' }}>Acuerdos y Compromisos Formales:</h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ background: 'rgba(16,185,129,0.2)', color: '#fff' }}>
                              <th style={{ padding: '6px 8px', textAlign: 'center', width: '5%' }}>No.</th>
                              <th style={{ padding: '6px 8px', textAlign: 'left', width: '45%' }}>Acuerdo</th>
                              <th style={{ padding: '6px 8px', textAlign: 'left', width: '25%' }}>Responsable</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center', width: '15%' }}>Límite</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center', width: '10%' }}>Estatus</th>
                            </tr>
                          </thead>
                          <tbody>
                            {minuta.acuerdos.map((ac, ai) => (
                              <tr key={ai} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{ac.no}</td>
                                <td style={{ padding: '6px 8px' }}>{ac.acuerdo}</td>
                                <td style={{ padding: '6px 8px', color: '#93c5fd' }}>{ac.responsable}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{ac.fechaLimite}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                  <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
                                    {ac.estatus || 'Vigente'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {minuta.firmas && minuta.firmas.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <h4 style={{ fontSize: '14px', color: '#a7f3d0', margin: '0 0 8px' }}>Firmas de Validación y Compromiso:</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        {minuta.firmas.map((f, fi) => (
                          <div key={fi} style={{ padding: '10px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '16px', marginBottom: '6px' }} />
                            <div style={{ fontWeight: 600 }}>{f.nombre}</div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{f.cargo}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--c-text-muted)', fontStyle: 'italic' }}>Minuta generada como parte de la fase de implementación.</div>
              )}
            </div>
          )}
        </div>

        {/* 3. Oficios a Aliados */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div
            onClick={() => setCollapsedOficios(!collapsedOficios)}
            style={{ padding: '14px 18px', background: 'rgba(245,158,11,0.18)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>🏛️</span>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#fde68a' }}>
                3. Oficios a Aliados Estratégicos ({oficios.length > 0 ? oficios.length : 3} Oficios de Vinculación)
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
              {collapsedOficios ? '▶ Mostrar' : '▼ Ocultar'}
            </span>
          </div>

          {!collapsedOficios && (
            <div style={{ padding: '18px', fontSize: '13px', color: '#f0f4ff' }}>
              {oficios.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {oficios.map((oficio, oi) => (
                    <div key={oi} style={{ padding: '14px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
                        Oficio de Vinculación #{oi + 1}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>
                        {oficio.destinatario}
                      </div>
                      <div style={{ fontSize: '12px', color: '#93c5fd' }}>
                        {oficio.cargo} — {oficio.institucion}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                        Asunto: {oficio.asunto}
                      </div>
                      <div style={{ fontSize: '12px', lineHeight: 1.4, color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px' }}>
                        {oficio.propuestaColaboracion}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--c-text-muted)', fontStyle: 'italic' }}>Oficios a aliados generados formalmente para Salud, Municipio y Sociedad Civil.</div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Vista Previa de los 6 Anexos Normativos con Tabs */}
      <div style={{ marginTop: '12px', background: 'rgba(13,21,48,0.9)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '18px' }}>
        <div style={{ marginBottom: '14px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#f0f4ff', margin: 0 }}>
            📋 Sistema Integral de Anexos Técnicos Oficiales (Anexos 1 al 6)
          </h4>
          <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0' }}>
            Selecciona un anexo para consultar su formato e instrumentos normativos de evaluación y seguimiento.
          </p>
        </div>

        {/* Tabs Navigation */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '10px', marginBottom: '16px' }}>
          {[
            { tab: 1, title: 'Anexo 1: Minuta Instalación' },
            { tab: 2, title: 'Anexo 2: Seguimiento Semanal' },
            { tab: 3, title: 'Anexo 3: Reporte Mensual' },
            { tab: 4, title: 'Anexo 4: Impacto Comunidad' },
            { tab: 5, title: 'Anexo 5: Autoevaluación' },
            { tab: 6, title: 'Anexo 6: Evaluación Colegiado' },
          ].map(t => (
            <button
              key={t.tab}
              type="button"
              onClick={() => setActiveAnexoTab(t.tab)}
              className="btn btn-sm"
              style={{
                background: activeAnexoTab === t.tab ? 'var(--c-blue-mid)' : 'rgba(255,255,255,0.06)',
                color: activeAnexoTab === t.tab ? '#fff' : 'rgba(255,255,255,0.7)',
                border: activeAnexoTab === t.tab ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {t.title}
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        <div style={{ minHeight: '180px' }}>
          {/* Tab 1 */}
          {activeAnexoTab === 1 && (
            <div>
              <h5 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '8px' }}>Anexo 1: Minuta de Instalación del Comité PAEC</h5>
              <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                {anexos?.anexo1Minuta ? JSON.stringify(anexos.anexo1Minuta, null, 2) : (anexos?.anexo1 || 'Sin datos generados aún')}
              </pre>
            </div>
          )}

          {/* Tab 2 */}
          {activeAnexoTab === 2 && (
            <div>
              <h5 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '8px' }}>Anexo 2: Cuadro de Seguimiento Semanal con Semáforo</h5>
              {Array.isArray(anexos?.anexo2Seguimiento) && anexos.anexo2Seguimiento.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Semana</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Fase</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>UAC</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Meta Operativa</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left' }}>Evidencia</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Avance</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Semáforo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anexos.anexo2Seguimiento.map((s, si) => (
                        <tr key={si} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{s.semana}</td>
                          <td style={{ padding: '6px 8px' }}>{s.fase}</td>
                          <td style={{ padding: '6px 8px', color: '#93c5fd' }}>{s.uac}</td>
                          <td style={{ padding: '6px 8px' }}>{s.metaOperativa}</td>
                          <td style={{ padding: '6px 8px' }}>{s.evidencia}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>{s.avancePorcentaje}%</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase',
                              background: s.semaforo === 'verde' ? 'rgba(16,185,129,0.2)' : s.semaforo === 'amarillo' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                              color: s.semaforo === 'verde' ? '#34d399' : s.semaforo === 'amarillo' ? '#fbbf24' : '#f87171'
                            }}>
                              {s.semaforo}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                  {anexos?.anexo2 || 'Sin datos generados aún'}
                </pre>
              )}
            </div>
          )}

          {/* Tab 3 */}
          {activeAnexoTab === 3 && (
            <div>
              <h5 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '8px' }}>Anexo 3: Reporte Mensual de Avances</h5>
              <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                {anexos?.anexo3ReporteMensual ? JSON.stringify(anexos.anexo3ReporteMensual, null, 2) : (anexos?.anexo3 || 'Sin datos generados aún')}
              </pre>
            </div>
          )}

          {/* Tab 4 */}
          {activeAnexoTab === 4 && (
            <div>
              <h5 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '8px' }}>Anexo 4: Cuestionario de Impacto Comunitario (Escala Likert 1-5)</h5>
              {anexos?.anexo4ImpactoComunidad?.reactivos ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                    <strong>Título:</strong> {anexos.anexo4ImpactoComunidad.titulo}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'center', width: '6%' }}>No.</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', width: '64%' }}>Reactivo / Pregunta de Impacto</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', width: '30%' }}>Dimensión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anexos.anexo4ImpactoComunidad.reactivos.map((r, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{ri + 1}</td>
                          <td style={{ padding: '6px 8px' }}>{r.reactivo}</td>
                          <td style={{ padding: '6px 8px', color: '#93c5fd' }}>{r.dimension}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                  {anexos?.anexo4 || 'Sin datos generados aún'}
                </pre>
              )}
            </div>
          )}

          {/* Tab 5 */}
          {activeAnexoTab === 5 && (
            <div>
              <h5 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '8px' }}>Anexo 5: Cuestionario de Autoevaluación de Estudiantes</h5>
              {anexos?.anexo5AutoevaluacionEstudiantes?.reactivos ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                    <strong>Título:</strong> {anexos.anexo5AutoevaluacionEstudiantes.titulo}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'center', width: '6%' }}>No.</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', width: '64%' }}>Reactivo de Autoevaluación</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', width: '30%' }}>Dimensión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anexos.anexo5AutoevaluacionEstudiantes.reactivos.map((r, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{ri + 1}</td>
                          <td style={{ padding: '6px 8px' }}>{r.reactivo}</td>
                          <td style={{ padding: '6px 8px', color: '#93c5fd' }}>{r.dimension}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                  {anexos?.anexo5 || 'Sin datos generados aún'}
                </pre>
              )}
            </div>
          )}

          {/* Tab 6 */}
          {activeAnexoTab === 6 && (
            <div>
              <h5 style={{ fontSize: '14px', color: '#93c5fd', marginBottom: '8px' }}>Anexo 6: Cuestionario de Evaluación para Docentes y Colegiado</h5>
              {anexos?.anexo6EvaluacionColegiado?.reactivos ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                    <strong>Título:</strong> {anexos.anexo6EvaluacionColegiado.titulo}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'center', width: '6%' }}>No.</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', width: '64%' }}>Reactivo Colegiado Docente</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', width: '30%' }}>Dimensión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anexos.anexo6EvaluacionColegiado.reactivos.map((r, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{ri + 1}</td>
                          <td style={{ padding: '6px 8px' }}>{r.reactivo}</td>
                          <td style={{ padding: '6px 8px', color: '#93c5fd' }}>{r.dimension}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                  {anexos?.anexo6 || 'Sin datos generados aún'}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
