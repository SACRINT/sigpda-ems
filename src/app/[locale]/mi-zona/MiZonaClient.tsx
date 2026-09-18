'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SupervisorDashboardData } from '@/lib/zone-sync-service';

interface EscuelaItem {
  id: string;
  nombre: string;
  cct: string;
  municipio?: string;
  subsistema: string;
  director_nombre?: string;
  director_email?: string;
  activa: boolean;
}

const SUBSISTEMAS = ['BGE', 'Bachillerato Tecnológico', 'CBTA', 'CBTIS', 'CECyTE', 'COBACH', 'COBAO', 'COLEGIO', 'OTRO'];

interface MiZonaClientProps {
  supervisorName: string;
  zoneName: string;
  isAdmin: boolean;
}

interface FormState {
  nombre: string;
  cct: string;
  municipio: string;
  subsistema: string;
  directorNombre: string;
  directorEmail: string;
  activa: boolean;
}

const EMPTY_FORM: FormState = {
  nombre: '',
  cct: '',
  municipio: '',
  subsistema: 'BGE',
  directorNombre: '',
  directorEmail: '',
  activa: true,
};

export default function MiZonaClient({ supervisorName, zoneName }: MiZonaClientProps) {
  const [activeTab, setActiveTab] = useState<'semaforo' | 'planteles'>('semaforo');
  const [escuelas, setEscuelas] = useState<EscuelaItem[]>([]);
  const [dashboard, setDashboard] = useState<SupervisorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchEscuelas = useCallback(async () => {
    try {
      const res = await fetch('/api/supervisor-escuelas');
      const data = await res.json();
      if (data.escuelas) setEscuelas(data.escuelas);
    } catch {
      setError('No se pudo cargar las escuelas.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const res = await fetch('/api/supervisor-escuelas/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch {
      // no-op error handling
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const [escRes, dashRes] = await Promise.all([
          fetch('/api/supervisor-escuelas'),
          fetch('/api/supervisor-escuelas/dashboard'),
        ]);
        if (!mounted) return;
        if (escRes.ok) {
          const escData = await escRes.json();
          if (escData.escuelas) setEscuelas(escData.escuelas);
        }
        if (dashRes.ok) {
          const dashData = await dashRes.json();
          setDashboard(dashData);
        }
      } catch {
        if (mounted) setError('No se pudieron cargar los datos de zona.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  const openNew = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (e: EscuelaItem) => {
    setEditId(e.id);
    setForm({
      nombre: e.nombre,
      cct: e.cct,
      municipio: e.municipio || '',
      subsistema: e.subsistema,
      directorNombre: e.director_nombre || '',
      directorEmail: e.director_email || '',
      activa: e.activa,
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.cct.trim()) {
      setError('Nombre y CCT son requeridos.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = editId ? { id: editId, ...form } : form;
      const res = await fetch('/api/supervisor-escuelas', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar.'); return; }
      setSuccess(editId ? 'Plantel actualizado.' : 'Plantel agregado a tu zona.');
      setShowModal(false);
      fetchEscuelas();
      fetchDashboard();
      setTimeout(() => setSuccess(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/supervisor-escuelas?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEscuelas(prev => prev.filter(e => e.id !== id));
        setDeleteConfirm(null);
        setSuccess('Plantel eliminado de tu zona.');
        fetchDashboard();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch {
      setError('Error al eliminar.');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: '#0f172a', border: '1px solid #334155',
    borderRadius: '8px', color: '#f8fafc', fontSize: '0.9rem',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ maxWidth: '1150px', margin: '0 auto' }}>

      {/* STATS DE CABECERA */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px', marginBottom: '20px',
      }}>
        {[
          { label: 'Planteles en zona', value: dashboard?.resumen.totalPlanteles ?? escuelas.length, color: '#3b82f6', icon: '🏫' },
          { label: 'PMC Completados', value: dashboard?.resumen.pmcCompletados ?? 0, color: '#10b981', icon: '📋' },
          { label: 'PAEC Activos', value: dashboard?.resumen.paecCompletados ?? 0, color: '#06b6d4', icon: '🌱' },
          { label: 'Atención Prioritaria', value: dashboard?.resumen.plantelesAtencionPrioritaria ?? 0, color: '#f59e0b', icon: '⚠️' },
          { label: 'Zona Escolar', value: dashboard?.zona.nombre ? `Zona ${dashboard.zona.nombre}` : zoneName, color: '#8b5cf6', icon: '📍' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'var(--card-bg, #1e293b)',
            border: `1px solid ${stat.color}40`,
            borderRadius: '12px', padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: '4px',
          }}>
            <span style={{ fontSize: '20px' }}>{stat.icon}</span>
            <span style={{ color: stat.color, fontWeight: 700, fontSize: '1.35rem', lineHeight: 1 }}>
              {stat.value}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* NAVEGACIÓN POR PESTAÑAS */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #334155',
        marginBottom: '20px',
        paddingBottom: '4px',
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('semaforo')}
            style={{
              padding: '10px 18px',
              background: activeTab === 'semaforo' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: activeTab === 'semaforo' ? '#60a5fa' : '#94a3b8',
              border: 'none',
              borderBottom: activeTab === 'semaforo' ? '2px solid #3b82f6' : '2px solid transparent',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '6px 6px 0 0',
            }}
          >
            🚦 Semáforo Pedagógico de Zona
          </button>
          <button
            onClick={() => setActiveTab('planteles')}
            style={{
              padding: '10px 18px',
              background: activeTab === 'planteles' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              color: activeTab === 'planteles' ? '#a78bfa' : '#94a3b8',
              border: 'none',
              borderBottom: activeTab === 'planteles' ? '2px solid #8b5cf6' : '2px solid transparent',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '6px 6px 0 0',
            }}
          >
            🏫 Gestión de Planteles ({escuelas.length})
          </button>
        </div>

        {activeTab === 'semaforo' ? (
          <button
            onClick={fetchDashboard}
            disabled={loadingDashboard}
            style={{
              padding: '8px 14px',
              background: '#334155',
              color: '#f8fafc',
              border: '1px solid #475569',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: loadingDashboard ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {loadingDashboard ? '⏳ Actualizando...' : '🔄 Actualizar Semáforo'}
          </button>
        ) : (
          <button
            onClick={openNew}
            style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            ＋ Agregar plantel
          </button>
        )}
      </div>

      {/* FEEDBACK */}
      {success && (
        <div style={{
          background: '#065f4620', border: '1px solid #10b981',
          color: '#6ee7b7', borderRadius: '8px', padding: '10px 16px',
          marginBottom: '16px', fontWeight: 600,
        }}>{success}</div>
      )}

      {/* CONTENIDO PESTAÑA 1: SEMÁFORO DE ZONA */}
      {activeTab === 'semaforo' && (
        <div>
          {loadingDashboard && !dashboard ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px' }}>
              Cargando semáforo pedagógico en tiempo real...
            </div>
          ) : !dashboard || dashboard.planteles.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: '#1e293b', borderRadius: '16px',
              border: '1px dashed #334155',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🚦</div>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '1rem' }}>
                No hay información agregada para mostrar. Registra planteles en la pestaña de gestión o carga tu Cartografía de Zona.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* BANNER ESTADO DE CARTOGRAFÍA */}
              <div style={{
                background: dashboard.zona.hasCartografia ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                border: `1px solid ${dashboard.zona.hasCartografia ? '#10b98140' : '#f59e0b40'}`,
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', color: '#f8fafc', fontSize: '0.95rem', fontWeight: 700 }}>
                    🗺️ Cartografía de Zona {dashboard.zona.nombre} ({dashboard.zona.clave})
                  </h4>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>
                    Supervisor: <strong style={{ color: '#e2e8f0' }}>{dashboard.zona.supervisorName || supervisorName}</strong> · Metas CREAA:{' '}
                    <span style={{ color: dashboard.zona.momento5Completed ? '#34d399' : '#fbbf24', fontWeight: 600 }}>
                      {dashboard.zona.momento5Completed ? 'Definidas (Momento 5)' : 'Pendiente'}
                    </span> · Memoria:{' '}
                    <span style={{ color: dashboard.zona.memoriaCompleted ? '#34d399' : '#94a3b8', fontWeight: 600 }}>
                      {dashboard.zona.memoriaCompleted ? 'Integrada' : 'Pendiente'}
                    </span>
                  </p>
                </div>
              </div>

              {/* TABLA SEMÁFORO */}
              <div style={{
                background: '#1e293b',
                borderRadius: '14px',
                border: '1px solid #334155',
                overflow: 'hidden',
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                        <th style={{ padding: '12px 16px', fontWeight: 700 }}>Plantel / CCT</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>PMC (Mejora)</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>PAEC (Comunitario)</th>
                        <th style={{ padding: '12px 14px', fontWeight: 700 }}>Indicadores 911/F11</th>
                        <th style={{ padding: '12px 16px', fontWeight: 700 }}>Alertas Pedagógicas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.planteles.map((p) => {
                        const pmcBadge =
                          p.pmc.status === 'completed'
                            ? { bg: '#10b98120', border: '#10b981', color: '#34d399', text: `Completado (Paso ${p.pmc.currentStep})` }
                            : p.pmc.status === 'draft'
                            ? { bg: '#f59e0b20', border: '#f59e0b', color: '#fbbf24', text: `En proceso (Paso ${p.pmc.currentStep})` }
                            : { bg: '#64748b20', border: '#64748b', color: '#94a3b8', text: 'Sin iniciar' };

                        const paecBadge =
                          p.paec.status === 'completed'
                            ? { bg: '#06b6d420', border: '#06b6d4', color: '#22d3ee', text: p.paec.projectName ? `Activo: ${p.paec.projectName}` : 'Completado' }
                            : p.paec.status === 'draft'
                            ? { bg: '#f59e0b20', border: '#f59e0b', color: '#fbbf24', text: 'En proceso' }
                            : { bg: '#64748b20', border: '#64748b', color: '#94a3b8', text: 'Sin iniciar' };

                        return (
                          <tr
                            key={p.cct}
                            style={{
                              borderBottom: '1px solid #334155',
                              background: p.cartografia.atencionPrioritaria ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                            }}
                          >
                            {/* PLANTEL */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 700, color: '#f8fafc' }}>{p.nombre}</div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px' }}>
                                <code style={{ fontSize: '0.75rem', color: '#818cf8', background: '#0f172a', padding: '1px 6px', borderRadius: '4px' }}>
                                  {p.cct}
                                </code>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>· {p.municipio || p.subsistema}</span>
                              </div>
                            </td>

                            {/* PMC */}
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: pmcBadge.bg,
                                border: `1px solid ${pmcBadge.border}50`,
                                color: pmcBadge.color,
                              }}>
                                {pmcBadge.text}
                              </span>
                            </td>

                            {/* PAEC */}
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: paecBadge.bg,
                                border: `1px solid ${paecBadge.border}50`,
                                color: paecBadge.color,
                                maxWidth: '240px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {paecBadge.text}
                              </span>
                            </td>

                            {/* INDICADORES */}
                            <td style={{ padding: '12px 14px' }}>
                              {p.cartografia.inZona ? (
                                <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                                  <span>Abandono: <strong>{p.cartografia.abandono ?? 'N/A'}%</strong></span>
                                  <span style={{ marginLeft: '8px' }}>ET: <strong>{p.cartografia.eficienciaTerminal ?? 'N/A'}%</strong></span>
                                  {p.cartografia.atencionPrioritaria && (
                                    <span style={{
                                      display: 'inline-block',
                                      marginLeft: '8px',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: '#ef444430',
                                      color: '#f87171',
                                      fontWeight: 700,
                                      fontSize: '0.7rem',
                                    }}>
                                      Prioritario
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No en Cartografía</span>
                              )}
                            </td>

                            {/* ALERTAS */}
                            <td style={{ padding: '12px 16px' }}>
                              {p.alertas.length === 0 ? (
                                <span style={{ color: '#34d399', fontSize: '0.78rem', fontWeight: 600 }}>
                                  ✅ Al día
                                </span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  {p.alertas.map((al, idx) => (
                                    <span key={idx} style={{ color: '#fca5a5', fontSize: '0.73rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      ⚠️ {al}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO PESTAÑA 2: GESTIÓN DE PLANTELES (CATÁLOGO EXISTENTE) */}
      {activeTab === 'planteles' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px' }}>Cargando planteles...</div>
          ) : escuelas.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 24px',
              background: '#1e293b', borderRadius: '16px',
              border: '1px dashed #334155',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🏫</div>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '1rem' }}>
                Aún no has registrado planteles en tu zona. Haz clic en &quot;+ Agregar plantel&quot; para comenzar.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px',
            }}>
              {escuelas.map(e => (
                <div key={e.id} style={{
                  background: '#1e293b',
                  border: `1px solid ${e.activa ? '#334155' : '#1e293b'}`,
                  borderRadius: '14px', padding: '18px',
                  opacity: e.activa ? 1 : 0.6,
                  transition: 'border-color 0.2s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <h3 style={{ color: '#f8fafc', margin: '0 0 4px', fontSize: '1rem', fontWeight: 700 }}>
                        {e.nombre}
                      </h3>
                      <code style={{
                        color: '#818cf8', fontSize: '0.75rem',
                        background: '#0f172a', padding: '2px 8px', borderRadius: '4px',
                      }}>{e.cct}</code>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                      background: e.activa ? '#10b98120' : '#6b728020',
                      color: e.activa ? '#34d399' : '#9ca3af',
                      border: `1px solid ${e.activa ? '#10b98140' : '#6b728040'}`,
                      flexShrink: 0,
                    }}>{e.activa ? 'Activo' : 'Inactivo'}</span>
                  </div>

                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {e.municipio && (
                      <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>📍 {e.municipio}</span>
                    )}
                    <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                      🏛️ {e.subsistema}
                    </span>
                    {e.director_nombre && (
                      <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                        👔 {e.director_nombre}
                        {e.director_email && <span style={{ color: '#60a5fa' }}> · {e.director_email}</span>}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                    <button
                      onClick={() => openEdit(e)}
                      style={{
                        flex: 1, padding: '7px', borderRadius: '8px',
                        background: '#3b82f620', color: '#60a5fa',
                        border: '1px solid #3b82f640', cursor: 'pointer',
                        fontSize: '0.8rem', fontWeight: 600,
                      }}
                    >✏️ Editar</button>
                    <button
                      onClick={() => setDeleteConfirm(e.id)}
                      style={{
                        padding: '7px 12px', borderRadius: '8px',
                        background: '#ef444420', color: '#f87171',
                        border: '1px solid #ef444440', cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL AGREGAR/EDITAR */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: '#00000080', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div style={{
            background: '#1e293b', borderRadius: '16px',
            border: '1px solid #334155', padding: '28px',
            width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ color: '#f8fafc', margin: '0 0 20px', fontSize: '1.2rem', fontWeight: 700 }}>
              {editId ? '✏️ Editar Plantel' : '➕ Agregar Plantel a mi Zona'}
            </h2>

            {error && (
              <div style={{
                background: '#7f1d1d20', border: '1px solid #ef4444',
                color: '#fca5a5', borderRadius: '8px', padding: '10px 14px',
                marginBottom: '16px', fontSize: '0.85rem',
              }}>{error}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'Nombre del plantel *', key: 'nombre' as keyof FormState, placeholder: 'Ej. COBACH Plantel 15' },
                { label: 'CCT *', key: 'cct' as keyof FormState, placeholder: 'Ej. 21EBH0015X' },
                { label: 'Municipio', key: 'municipio' as keyof FormState, placeholder: 'Ej. Puebla' },
                { label: 'Nombre del Director', key: 'directorNombre' as keyof FormState, placeholder: 'Ej. Juan Pérez García' },
                { label: 'Email del Director', key: 'directorEmail' as keyof FormState, placeholder: 'director@plantel.edu.mx' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>
                    {label}
                  </label>
                  <input
                    type="text"
                    value={form[key] as string}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={inputStyle}
                  />
                </div>
              ))}

              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '5px' }}>
                  Subsistema
                </label>
                <select
                  value={form.subsistema}
                  onChange={e => setForm(prev => ({ ...prev, subsistema: e.target.value }))}
                  style={{ ...inputStyle, boxSizing: 'border-box' }}
                >
                  {SUBSISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {editId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    id="activa-check"
                    type="checkbox"
                    checked={form.activa}
                    onChange={e => setForm(prev => ({ ...prev, activa: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: '#8b5cf6', cursor: 'pointer' }}
                  />
                  <label htmlFor="activa-check" style={{ color: '#e2e8f0', fontSize: '0.9rem', cursor: 'pointer' }}>
                    Plantel activo en mi zona
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => { setShowModal(false); setError(''); }}
                  style={{
                    padding: '10px 22px', borderRadius: '8px',
                    background: 'transparent', border: '1px solid #334155',
                    color: '#94a3b8', cursor: 'pointer', fontWeight: 600,
                  }}
                >Cancelar</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '10px 22px', borderRadius: '8px',
                    background: saving ? '#334155' : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                  }}
                >
                  {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Agregar plantel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINAR */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: '#00000090', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div style={{
            background: '#1e293b', borderRadius: '16px',
            border: '1px solid #ef4444', padding: '28px',
            maxWidth: '400px', width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ color: '#f8fafc', margin: '0 0 10px' }}>¿Quitar plantel de tu zona?</h3>
            <p style={{ color: '#94a3b8', margin: '0 0 20px', fontSize: '0.9rem' }}>
              Esta acción no se puede deshacer. El plantel será removido de tu zona de supervisión.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '10px 22px', borderRadius: '8px',
                  background: 'transparent', border: '1px solid #334155',
                  color: '#94a3b8', cursor: 'pointer', fontWeight: 600,
                }}
              >Cancelar</button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{
                  padding: '10px 22px', borderRadius: '8px',
                  background: '#ef4444', color: '#fff',
                  border: 'none', cursor: 'pointer', fontWeight: 700,
                }}
              >Sí, quitar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
