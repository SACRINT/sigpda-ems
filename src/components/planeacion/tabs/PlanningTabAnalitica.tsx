'use client';

import React from 'react';
import type { Planning } from '@/types/planning';
import type { TeacherProgressSummary, FeedbackSummary } from '@/lib/pedagogical-analytics';
import {
  TrendingUp, FileText, BookMarked, Grid, Microscope, Library,
  Clock, BarChart3, RefreshCw, AlertTriangle, Star
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';

export interface PlanningTabAnaliticaProps {
  planning: Planning;
  analyticsData: TeacherProgressSummary | null;
  analyticsLoading: boolean;
  analyticsError: string | null;
  analyticsLoaded: boolean;
  handleLoadAnalytics: () => Promise<void> | void;
}

export default function PlanningTabAnalitica({
  analyticsData,
  analyticsLoading,
  analyticsError,
  analyticsLoaded: _analyticsLoaded,
  handleLoadAnalytics,
}: PlanningTabAnaliticaProps) {
        // ── Derived chart data ────────────────────────────────────────────────
        const semesterBarData = analyticsData?.plannings?.by_semester
          ? Object.entries(analyticsData.plannings.by_semester)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([sem, count]) => ({ name: `Sem ${sem}`, value: Number(count) }))
          : [];

        const componentPieData = analyticsData?.plannings?.by_component
          ? Object.entries(analyticsData.plannings.by_component).map(([comp, count]) => ({
              name: comp === 'laboral' ? 'Laboral' : comp === 'fundamental' ? 'Fundamental' : comp,
              value: Number(count),
            }))
          : [];

        const KPI_ITEMS = [
          { label: 'Planeaciones', value: analyticsData?.plannings?.total_plannings ?? 0, icon: <FileText size={20}/>,  color: '#1d4ed8' },
          { label: 'PAEC',         value: analyticsData?.paec_count         ?? 0, icon: <BookMarked size={20}/>, color: '#059669' },
          { label: 'PMC',          value: analyticsData?.pmc_count          ?? 0, icon: <Grid       size={20}/>, color: '#7c3aed' },
          { label: 'PIPS',         value: analyticsData?.pips_count         ?? 0, icon: <Microscope size={20}/>, color: '#b45309' },
          { label: 'Biblioteca',   value: analyticsData?.library_docs_count ?? 0, icon: <Library    size={20}/>, color: '#0891b2' },
        ];

        const radarData = KPI_ITEMS.map(k => ({ subject: k.label, A: k.value }));

        const PIE_COLORS = ['#1d4ed8', '#059669', '#d97706', '#7c3aed', '#0891b2'];


  return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="section-card">
              <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #0c4a6e 0%, #0891b2 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="section-card-title" style={{ color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18}/> Analytics Pedagógico Personal
                </span>
                {!analyticsLoading && analyticsData && (
                  <button
                    onClick={() => { handleLoadAnalytics(); }}
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <RefreshCw size={12}/> Actualizar
                  </button>
                )}
              </div>
              <div className="section-card-body">

                {/* ── Loading ─────────────────────────────────────────────── */}
                {analyticsLoading && (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: '#0891b2' }}>
                    <TrendingUp size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }}/>
                    <p style={{ fontWeight: 600 }}>Cargando tu panel de analytics…</p>
                  </div>
                )}

                {/* ── Error ───────────────────────────────────────────────── */}
                {analyticsError && (
                  <div style={{ background: '#FEE2E2', border: '1px solid #dc2626', borderRadius: '8px', padding: '16px', color: '#991b1b' }}>
                    <p style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16}/> Error</p>
                    <p style={{ fontSize: '14px', margin: 0 }}>{analyticsError}</p>
                    <button onClick={handleLoadAnalytics} style={{ marginTop: '12px', padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <RefreshCw size={13}/> Reintentar
                    </button>
                  </div>
                )}

                {analyticsData && !analyticsLoading && (
                  <>
                    {/* ── KPI cards ──────────────────────────────────────── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '28px' }}>
                      {KPI_ITEMS.map((item) => (
                        <div key={item.label} style={{ background: `${item.color}0f`, border: `1px solid ${item.color}30`, borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                          <div style={{ color: item.color, display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>{item.icon}</div>
                          <div style={{ fontSize: '30px', fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>{item.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* ── Two-column charts ──────────────────────────────── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>

                      {/* BarChart — por semestre */}
                      {semesterBarData.length > 0 && (
                        <div style={{ background: 'var(--c-bg-surface)', borderRadius: '10px', padding: '16px', border: '1px solid var(--c-border)' }}>
                          <p style={{ fontWeight: 700, color: 'var(--c-text)', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BarChart3 size={15} color="#818cf8"/> Planeaciones por Semestre
                          </p>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={semesterBarData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} tickLine={false} axisLine={false}/>
                              <YAxis tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false}/>
                              <Tooltip
                                contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--c-border)', background: 'var(--c-card-bg)', color: 'var(--c-text)' }}
                                formatter={(v: unknown) => [String(v), 'Planeaciones']}
                              />
                              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                                {semesterBarData.map((_, i) => (
                                  <Cell key={i} fill={['#6366f1','#818cf8','#3b82f6','#60a5fa','#93c5fd','#bfdbfe'][i % 6]}/>
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* PieChart — por componente */}
                      {componentPieData.length > 0 && (
                        <div style={{ background: 'var(--c-bg-surface)', borderRadius: '10px', padding: '16px', border: '1px solid var(--c-border)' }}>
                          <p style={{ fontWeight: 700, color: 'var(--c-text)', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Grid size={15} color="#34d399"/> Distribución por Componente
                          </p>
                          <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                              <Pie
                                data={componentPieData}
                                cx="50%" cy="50%"
                                innerRadius={45} outerRadius={70}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {componentPieData.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--c-border)', background: 'var(--c-card-bg)', color: 'var(--c-text)' }}
                                formatter={(v: unknown, name: unknown) => [String(v), String(name)]}
                              />
                              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '12px', color: 'var(--c-text-muted)' }}/>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* RadarChart — distribución de módulos */}
                      {radarData.some(r => r.A > 0) && (
                        <div style={{ background: 'var(--c-bg-surface)', borderRadius: '10px', padding: '16px', border: '1px solid var(--c-border)' }}>
                          <p style={{ fontWeight: 700, color: 'var(--c-text)', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <TrendingUp size={15} color="#c084fc"/> Perfil Pedagógico General
                          </p>
                          <ResponsiveContainer width="100%" height={180}>
                            <RadarChart data={radarData}>
                              <PolarGrid stroke="var(--c-border)"/>
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--c-text-muted)' }}/>
                              <PolarRadiusAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false}/>
                              <Radar name="Total" dataKey="A" stroke="#a855f7" fill="#a855f7" fillOpacity={0.25}/>
                              <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--c-border)', background: 'var(--c-card-bg)', color: 'var(--c-text)' }}/>
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Feedback ratings */}
                      {analyticsData.feedback && analyticsData.feedback.length > 0 && (() => {
                        const fbBarData = analyticsData.feedback.map((fb: FeedbackSummary) => ({
                          name: (fb.entity_type as string).split('_').pop() || fb.entity_type,
                          rating: Number(Number(fb.avg_rating).toFixed(1)),
                          count: fb.total_count,
                        }));
                        return (
                          <div style={{ background: 'var(--c-bg-surface)', borderRadius: '10px', padding: '16px', border: '1px solid var(--c-border)' }}>
                            <p style={{ fontWeight: 700, color: 'var(--c-text)', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Star size={15} color="#fbbf24"/> Ratings de Generación IA
                            </p>
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={fbBarData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} tickLine={false} axisLine={false}/>
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--c-text-muted)' }} tickLine={false} axisLine={false} width={72}/>
                                <Tooltip
                                  contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--c-border)', background: 'var(--c-card-bg)', color: 'var(--c-text)' }}
                                  formatter={(v: unknown) => [`${String(v)}/5`, 'Rating']}
                                />
                                <Bar dataKey="rating" radius={[0, 4, 4, 0]}>
                                  {fbBarData.map((fb, i: number) => (
                                    <Cell key={i} fill={fb.rating >= 4 ? '#10b981' : fb.rating >= 3 ? '#f59e0b' : '#f43f5e'}/>
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </div>

                    {/* ── Recent plannings list ──────────────────────────── */}
                    {analyticsData.plannings?.recent && analyticsData.plannings.recent.length > 0 && (
                      <div>
                        <p style={{ fontWeight: 700, color: 'var(--c-text)', marginBottom: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} color="#38bdf8"/> Últimas planeaciones
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {analyticsData.plannings.recent.map((p, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--c-bg-surface)', borderRadius: '6px', border: '1px solid var(--c-border)', fontSize: '13px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--c-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileText size={13} color="#38bdf8"/> {p.uac_name}
                              </span>
                              <span style={{ color: 'var(--c-text-muted)', fontSize: '12px' }}>
                                {new Date(p.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
  );
}
