'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { X, Save, Loader2, Sparkles, AlertCircle, Building2, User, Users, Clock, ShieldCheck, BookOpen } from 'lucide-react';
import type { GeneratedPlanningContent } from '@/types/planning';

interface QuickEditPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  planningId: string;
  content: GeneratedPlanningContent;
  onSaveSuccess: (updatedContent: GeneratedPlanningContent) => void;
}

export default function QuickEditPlanningModal({
  isOpen,
  onClose,
  planningId,
  content,
  onSaveSuccess,
}: QuickEditPlanningModalProps) {
  const [activeTab, setActiveTab] = useState<'admin' | 'curricular'>('admin');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State — Section I
  const [groups, setGroups] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [cct, setCct] = useState('');
  const [schoolZone, setSchoolZone] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [totalHours, setTotalHours] = useState<string | number>('');
  const [applicationPeriod, setApplicationPeriod] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [supervisorName, setSupervisorName] = useState('');

  // Form State — Section II
  const [purpose, setPurpose] = useState('');
  const [paecConnection, setPaecConnection] = useState('');

  // Populate form with current content when opening
  useEffect(() => {
    if (content) {
      const s1 = content.sectionI || ({} as GeneratedPlanningContent['sectionI']);
      const s2 = content.sectionII || ({} as GeneratedPlanningContent['sectionII']);

      setGroups(s1.groups || '');
      setTeacherName(s1.teacherName || '');
      setSchoolName(s1.schoolName || '');
      setCct(s1.cct || '');
      setSchoolZone(s1.schoolZone || '');
      setMunicipality(s1.municipality || '');
      setTotalHours(s1.totalHours !== undefined ? s1.totalHours : '');
      setApplicationPeriod(s1.applicationPeriod || '');
      setDirectorName(s1.directorName || '');
      setSupervisorName(s1.supervisorName || '');

      setPurpose(s2.purpose || '');
      setPaecConnection(s2.paecConnection || '');
      setErrorMsg(null);
    }
  }, [content, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const updatedContent: GeneratedPlanningContent = {
        ...content,
        sectionI: {
          ...content.sectionI,
          groups: groups.trim(),
          teacherName: teacherName.trim(),
          schoolName: schoolName.trim(),
          cct: cct.trim(),
          schoolZone: schoolZone.trim(),
          municipality: municipality.trim(),
          totalHours: typeof totalHours === 'number' ? totalHours : (Number(totalHours) || content.sectionI.totalHours),
          applicationPeriod: applicationPeriod.trim(),
          directorName: directorName.trim(),
          supervisorName: supervisorName.trim(),
        },
        sectionII: {
          ...content.sectionII,
          purpose: purpose.trim(),
          paecConnection: paecConnection.trim(),
        },
      };

      const res = await fetch(`/api/plannings/${planningId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_json: updatedContent }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar las modificaciones.');
      }

      toast.success('¡Datos actualizados exitosamente! Tus descargas de PDF y Word ya reflejan los cambios.');
      onSaveSuccess(updatedContent);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar cambios.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                ✏️ Edición Rápida de Datos
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(234, 179, 8, 0.2)',
                  color: '#facc15',
                  border: '1px solid rgba(234, 179, 8, 0.4)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                👑 Premium / Admin
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Ajusta datos del plantel, grupos o propósitos sin necesidad de regenerar toda la planeación.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '0 24px',
            backgroundColor: '#1e293b',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            style={{
              padding: '12px 14px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'admin' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'admin' ? '#60a5fa' : '#94a3b8',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Building2 size={15} /> I. Datos Administrativos y Grupos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('curricular')}
            style={{
              padding: '12px 14px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'curricular' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'curricular' ? '#60a5fa' : '#94a3b8',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <BookOpen size={15} /> II. Intención Curricular y PAEC
          </button>
        </div>

        {/* Info Banner */}
        <div
          style={{
            padding: '10px 24px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
            fontSize: '12px',
            color: '#93c5fd',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={14} style={{ flexShrink: 0 }} />
          <span>
            Los cambios se guardan en la base de datos y se aplicarán de inmediato a tus próximas descargas oficiales en <strong>PDF, Word (DOCX) y Libro Editorial</strong>.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {errorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} /> {errorMsg}
              </div>
            )}

            {activeTab === 'admin' ? (
              <>
                {/* Grupos & Docente */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                      <Users size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                      Grupo(s) Asignados:
                    </label>
                    <input
                      type="text"
                      value={groups}
                      onChange={(e) => setGroups(e.target.value)}
                      placeholder="Ej. 3°A o 3°B o 3°A, 3°B"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', display: 'block' }}>
                      Corrige si se asignó un grupo de más o faltó alguno.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                      <User size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                      Nombre del Docente:
                    </label>
                    <input
                      type="text"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder="Nombre completo del profesor"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Plantel & CCT */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                      <Building2 size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                      Nombre del Plantel / Escuela:
                    </label>
                    <input
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="Ej. Bachillerato Gral. Héroes de la Patria"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                      CCT (Clave Centro de Trabajo):
                    </label>
                    <input
                      type="text"
                      value={cct}
                      onChange={(e) => setCct(e.target.value)}
                      placeholder="Ej. 21EBH0285D"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Zona & Municipio */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                      Zona Escolar:
                    </label>
                    <input
                      type="text"
                      value={schoolZone}
                      onChange={(e) => setSchoolZone(e.target.value)}
                      placeholder="Ej. Zona 086"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                      Municipio / Localidad:
                    </label>
                    <input
                      type="text"
                      value={municipality}
                      onChange={(e) => setMunicipality(e.target.value)}
                      placeholder="Ej. Libres, Puebla"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                      <Clock size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                      Horas Totales:
                    </label>
                    <input
                      type="number"
                      value={totalHours}
                      onChange={(e) => setTotalHours(e.target.value)}
                      placeholder="Ej. 54"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Firmas Institucionales */}
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '14px', marginTop: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <ShieldCheck size={15} color="#10b981" /> Firmas Institucionales (Pie de Página):
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>
                        Nombre del Director(a):
                      </label>
                      <input
                        type="text"
                        value={directorName}
                        onChange={(e) => setDirectorName(e.target.value)}
                        placeholder="Nombre completo del director"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>
                        Nombre del Supervisor(a):
                      </label>
                      <input
                        type="text"
                        value={supervisorName}
                        onChange={(e) => setSupervisorName(e.target.value)}
                        placeholder="Nombre completo del supervisor"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Propósito Formativo */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                    Propósito Formativo (Intencionalidad Curricular):
                  </label>
                  <textarea
                    rows={4}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Redacción del propósito formativo general..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>

                {/* Vinculación PAEC */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#cbd5e1' }}>
                    Vinculación Comunitaria (PAEC):
                  </label>
                  <textarea
                    rows={4}
                    value={paecConnection}
                    onChange={(e) => setPaecConnection(e.target.value)}
                    placeholder="Descripción de la articulación con el Proyecto Aula Escuela Comunidad..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{
                padding: '9px 18px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#cbd5e1',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '9px 20px',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save size={16} /> Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

