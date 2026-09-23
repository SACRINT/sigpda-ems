'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SignOutButton from '@/components/layout/SignOutButton';
import { signOutAction } from '@/lib/server-actions';

// ── Descripción visual de roles ───────────────────────────────────────────────
const ROLES_INFO = [
  {
    value: 'docente',
    label: '👨‍🏫 Docente',
    descripcion: 'Soy maestro frente a grupo.',
    color: '#60a5fa',
    colorBg: 'rgba(59,130,246,0.12)',
    colorBorder: 'rgba(59,130,246,0.35)',
    acceso: [
      '📝 Secuencias Didácticas (Planeaciones)',
      '📁 Mis Documentos',
      '🏫 Mis Escuelas',
      '📚 Biblioteca Personal',
    ],
    noAcceso: [
      '🏫 Proyectos PAEC-PEC',
      '👥 Gestión de Personal del Plantel',
      '📈 Plan de Mejora PMC',
      '📅 Generador de Horarios',
      '🗺️ Cartografía de Supervisión',
    ],
  },
  {
    value: 'director',
    label: '🏫 Director',
    descripcion: 'Dirijo un plantel educativo.',
    color: '#34d399',
    colorBg: 'rgba(16,185,129,0.12)',
    colorBorder: 'rgba(16,185,129,0.35)',
    acceso: [
      '👥 Gestión de Personal del Plantel',
      '🏫 Proyectos PAEC-PEC',
      '📈 Plan de Mejora (PMC)',
      '📅 Generador de Horarios Escolares IA',
      '📝 Secuencias Didácticas (Planeaciones)',
      '📁 Mis Documentos',
      '🏫 Mis Escuelas',
    ],
    noAcceso: ['🗺️ Cartografía de Supervisión'],
  },
  {
    value: 'supervisor',
    label: '🔍 Supervisor',
    descripcion: 'Superviso varias escuelas de mi zona.',
    color: '#fbbf24',
    colorBg: 'rgba(245,158,11,0.12)',
    colorBorder: 'rgba(245,158,11,0.35)',
    acceso: [
      '🗺️ Cartografía de Supervisión (PIPS)',
      '🏫 Gestión de Escuelas de mi Zona',
      '📁 Mis Documentos',
    ],
    noAcceso: ['📝 Secuencias Didácticas', '📈 PMC', '📅 Horarios IA'],
  },
];

const SUBSYSTEMS = [
  'Bachillerato General Estatal (BGE)',
  'Bachillerato Tecnológico',
  'Bachillerato General Digital (BGD)',
  'EMSAD',
  'COBAEP',
  'CECYTEP',
  'CONALEP',
  'Otro',
];

interface Props {
  locale: string;
  teacherName: string;
  teacherEmail: string;
  currentData: {
    schoolName: string;
    municipality: string;
    city?: string;
    cct?: string;
    subsystem: string;
  };
}

export default function ConfigurarPerfilClient({ locale, teacherName, teacherEmail, currentData }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState('');
  const [form, setForm] = useState({
    schoolName: currentData.schoolName || '',
    municipality: currentData.municipality || '',
    city: currentData.city || '',
    cct: currentData.cct || '',
    subsystem: currentData.subsystem || '',
    teacherFullName: teacherName || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleRoleContinue = () => {
    if (!selectedRole) { setError('Por favor selecciona tu rol antes de continuar.'); return; }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.schoolName.trim() || !form.municipality.trim() || !form.city.trim() || !form.cct.trim() || !form.subsystem) {
      setError('Por favor completa todos los campos obligatorios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/teacher-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: form.schoolName.trim(),
          municipality: form.municipality.trim(),
          city: form.city.trim(),
          cct: form.cct.trim(),
          subsystem: form.subsystem,
          name: form.teacherFullName.trim(),
          role: selectedRole,
          lockProfile: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }
      router.push(`/${locale}/suscripcion`);
    } catch (err: any) {
      setError(err.message || 'Error al guardar. Intenta de nuevo.');
      setSaving(false);
    }
  };

  const roleInfo = ROLES_INFO.find(r => r.value === selectedRole);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10,
    color: '#f0f4ff',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #0d1530 0%, #080c18 60%, #020408 100%)',
      backgroundAttachment: 'fixed',
      padding: '24px 16px',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: step === 1 ? 760 : 560 }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative' }}>
          <div style={{ position: 'absolute', top: -10, right: 0 }}>
            <SignOutButton locale={locale} signOutAction={signOutAction} />
          </div>
          <div style={{ fontSize: 48, marginBottom: 10 }}>📚</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f0f4ff', letterSpacing: '-0.5px', marginBottom: 6 }}>
            {step === 1 ? 'Bienvenido a DidácticaIA' : 'Datos de tu Plantel'}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(240,244,255,0.55)', lineHeight: 1.6, maxWidth: 500, margin: '0 auto' }}>
            {step === 1
              ? 'Selecciona tu rol en el sistema educativo. Esto define las herramientas disponibles en tu cuenta.'
              : `Rol: ${roleInfo?.label} — Ahora ingresa los datos de tu plantel o zona.`}
          </p>
          {/* Steps */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 }}>
            {(['Elige tu rol', 'Datos del plantel'] as const).map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: i + 1 <= step ? '#6366f1' : 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: i + 1 <= step ? '#fff' : 'rgba(255,255,255,0.3)',
                }}>
                  {i + 1 < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i + 1 <= step ? 'rgba(240,244,255,0.7)' : 'rgba(240,244,255,0.25)', fontWeight: i + 1 === step ? 700 : 400 }}>
                  {label}
                </span>
                {i < 1 && <div style={{ width: 24, height: 1, background: step > i + 1 ? '#6366f1' : 'rgba(255,255,255,0.1)' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* ── PASO 1: Selección de Rol ── */}
        {step === 1 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
              {ROLES_INFO.map(role => {
                const isSel = selectedRole === role.value;
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => { setSelectedRole(role.value); setError(''); }}
                    style={{
                      background: isSel ? role.colorBg : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${isSel ? role.color : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 16,
                      padding: '20px 16px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      boxShadow: isSel ? `0 4px 28px ${role.colorBg}` : 'none',
                    }}
                  >
                    <div style={{ fontSize: 30, marginBottom: 8 }}>
                      {role.value === 'docente' ? '👨‍🏫' : role.value === 'director' ? '🏫' : '🔍'}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: isSel ? role.color : '#f0f4ff', marginBottom: 3 }}>
                      {role.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(240,244,255,0.55)', lineHeight: 1.4, marginBottom: 14 }}>
                      {role.descripcion}
                    </div>
                    <div style={{ borderTop: `1px solid ${isSel ? role.colorBorder : 'rgba(255,255,255,0.07)'}`, paddingTop: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: isSel ? role.color : 'rgba(240,244,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                        ✓ Tienes acceso a:
                      </div>
                      {role.acceso.map(item => (
                        <div key={item} style={{ fontSize: 11, color: isSel ? '#d1fae5' : '#cbd5e1', marginBottom: 3, display: 'flex', alignItems: 'flex-start', gap: 5, lineHeight: 1.3 }}>
                          <span style={{ color: isSel ? '#34d399' : '#64748b', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                          <span>{item}</span>
                        </div>
                      ))}
                      {role.noAcceso.length > 0 && (
                        <>
                          <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(240,244,255,0.3)', marginTop: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                            ✕ Sin acceso:
                          </div>
                          {role.noAcceso.map(item => (
                            <div key={item} style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2, display: 'flex', alignItems: 'flex-start', gap: 5, lineHeight: 1.3 }}>
                              <span style={{ color: 'rgba(239,68,68,0.55)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✕</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Aviso de permanencia */}
            <div style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.22)',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 14,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}>
              <span style={{ flexShrink: 0, fontSize: 16 }}>⚠️</span>
              <p style={{ fontSize: 12, color: '#fcd34d', lineHeight: 1.6, margin: 0 }}>
                <strong>Importante:</strong> El rol que elijas es <strong>permanente</strong>. Si en el futuro necesitas cambiarlo,
                deberás enviar un correo al administrador de la plataforma y podrías perder el trabajo guardado. Elige con cuidado.
              </p>
            </div>

            {error && (
              <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#f87171', marginBottom: 12 }}>
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleRoleContinue}
              disabled={!selectedRole}
              style={{
                width: '100%',
                padding: '14px',
                background: selectedRole
                  ? `linear-gradient(135deg, #6366f1, #818cf8)`
                  : 'rgba(99,102,241,0.18)',
                border: 'none',
                borderRadius: 12,
                color: selectedRole ? '#fff' : 'rgba(255,255,255,0.3)',
                fontSize: 15,
                fontWeight: 700,
                cursor: selectedRole ? 'pointer' : 'not-allowed',
                transition: 'all 0.25s',
                boxShadow: selectedRole ? '0 4px 20px rgba(99,102,241,0.4)' : 'none',
              }}
            >
              {selectedRole
                ? `Continuar como ${ROLES_INFO.find(r => r.value === selectedRole)?.label} →`
                : 'Selecciona tu rol para continuar'}
            </button>
          </div>
        )}

        {/* ── PASO 2: Datos del Plantel ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit} style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${roleInfo?.colorBorder || 'rgba(255,255,255,0.1)'}`,
            borderRadius: 20,
            padding: '32px 28px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
          }}>
            {/* Rol badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: roleInfo?.colorBg,
              border: `1px solid ${roleInfo?.colorBorder}`,
              borderRadius: 20,
              padding: '5px 14px',
              marginBottom: 20,
              fontSize: 13,
              fontWeight: 700,
              color: roleInfo?.color,
            }}>
              {roleInfo?.label}
            </div>

            {/* Permanencia */}
            <div style={{
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 22,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
              <p style={{ fontSize: 12, color: '#fcd34d', lineHeight: 1.5, margin: 0 }}>
                Una vez guardado, tu <strong>rol</strong>, nombre de plantel y subsistema quedarán bloqueados permanentemente.
              </p>
            </div>

            {/* Nombre completo */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(240,244,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Nombre completo *
              </label>
              <input
                type="text"
                value={form.teacherFullName}
                onChange={e => setForm({ ...form, teacherFullName: e.target.value })}
                placeholder="Ej: María González Pérez"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#6366f1')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
              />
            </div>

            {/* Subsistema */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(240,244,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Subsistema educativo *
              </label>
              <select
                value={form.subsystem}
                onChange={e => setForm({ ...form, subsystem: e.target.value })}
                required
                style={{ ...inputStyle, background: 'rgba(13,21,48,0.95)', cursor: 'pointer' }}
              >
                <option value="">Selecciona tu subsistema...</option>
                {SUBSYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Nombre escuela / zona */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(240,244,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {selectedRole === 'supervisor' ? 'Nombre de la Zona de Supervisión *' : 'Nombre oficial del plantel *'}
              </label>
              <input
                type="text"
                value={form.schoolName}
                onChange={e => setForm({ ...form, schoolName: e.target.value })}
                placeholder={selectedRole === 'supervisor' ? 'Ej: Supervisión Escolar Zona 004' : 'Ej: Bachillerato General Estatal No. 12'}
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#6366f1')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
              />
            </div>

            {/* Grid: municipio + localidad */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(240,244,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Municipio *
                </label>
                <input
                  type="text"
                  value={form.municipality}
                  onChange={e => setForm({ ...form, municipality: e.target.value })}
                  placeholder="Ej: Puebla"
                  required
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#6366f1')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(240,244,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Localidad *
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                  placeholder="Ej: Cholula"
                  required
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#6366f1')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
                />
              </div>
            </div>

            {/* CCT */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(240,244,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {selectedRole === 'supervisor' ? 'Clave de Supervisión *' : 'CCT del plantel *'}
              </label>
              <input
                type="text"
                value={form.cct}
                onChange={e => setForm({ ...form, cct: e.target.value })}
                placeholder={selectedRole === 'supervisor' ? 'Ej: 21S004' : 'Ej: 21EBH0000Z'}
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#6366f1')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>
                {error}
              </div>
            )}

            {/* Email read-only */}
            <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: 8, padding: '8px 14px', fontSize: 11, color: 'rgba(240,244,255,0.45)', marginBottom: 20 }}>
              🔒 Cuenta vinculada: <strong style={{ color: 'rgba(240,244,255,0.65)' }}>{teacherEmail}</strong>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                style={{
                  padding: '13px 20px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  color: 'rgba(240,244,255,0.7)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                ← Regresar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '13px',
                  background: saving ? 'rgba(99,102,241,0.35)' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                  border: 'none',
                  borderRadius: 12,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: saving ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                }}
              >
                {saving ? '⏳ Guardando...' : '✅ Guardar y continuar →'}
              </button>
            </div>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(240,244,255,0.2)' }}>
          DidácticaIA · MCCEMS Puebla 2026-2027
        </p>
      </div>
    </div>
  );
}
