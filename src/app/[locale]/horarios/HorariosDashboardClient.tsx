'use client';

import React, { useState, useEffect } from 'react';
import WizardConfiguracion from '@/components/horarios/WizardConfiguracion';
import EditorHorarios from '@/components/horarios/EditorHorarios';
import ModalConfiguracionMapaCurricular from '@/components/ModalConfiguracionMapaCurricular';
import { Sparkles, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  isDirector: boolean;
  isAdmin?: boolean;
  teacherName: string;
  teacherId: string;
  schoolName: string;
  cct: string;
}

export default function HorariosDashboardClient({
  isDirector,
  isAdmin = false,
  teacherName,
  teacherId,
  schoolName,
  cct,
}: Props) {
  const [loading, setLoading] = useState<boolean>(true);
  const [modo, setModo] = useState<'WIZARD' | 'EDITOR'>('WIZARD');
  const [pasoActual, setPasoActual] = useState<number>(1);
  const [mapaModalAbierto, setMapaModalAbierto] = useState<boolean>(false);

  // escuela construida con datos reales del teacher (ID real, no hardcodeado)
  const escuelaBase = {
    id: teacherId,
    cct,
    nombre: schoolName,
    gruposPrimerAno: 1,
    gruposSegundoAno: 1,
    gruposTercerAno: 1,
    mapaCurricularCompletado: false,
  };

  const [escuelaState, setEscuelaState] = useState<any>(escuelaBase);
  const [config, setConfig] = useState<any>(null);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);
  const [docentes, setDocentes] = useState<any[]>([]);
  const [cargas, setCargas] = useState<any[]>([]);
  const [horario, setHorario] = useState<any>(null);

  // Guardar paso actual en localStorage cuando cambie
  useEffect(() => {
    if (typeof window !== 'undefined' && teacherId && pasoActual >= 1 && pasoActual <= 3) {
      try {
        localStorage.setItem(`horarios_paso_${teacherId}`, String(pasoActual));
      } catch {}
    }
  }, [pasoActual, teacherId]);

  useEffect(() => {
    if (isDirector) {
      cargarDatos();
    } else {
      setLoading(false);
    }
  }, [isDirector, teacherId]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/horarios/configuracion?escuelaId=${teacherId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.escuela) {
        setEscuelaState(data.escuela);
        // Solo abrir el modal si NO se ha completado Y NO existen grupos previamente guardados
        if (data.escuela.mapaCurricularCompletado === false && (!data.grupos || data.grupos.length === 0)) {
          setMapaModalAbierto(true);
        } else {
          setMapaModalAbierto(false);
        }
      }
      if (data.config) setConfig(data.config);
      if (data.grupos) setGrupos(data.grupos);
      if (data.aulas) setAulas(data.aulas);
      if (data.docentes) setDocentes(data.docentes);

      if (data.cargas) {
        const cargasNormalizadas = data.cargas.map((c: any) => ({
          grupoId: c.grupoId,
          asignaturaId: c.asignaturaId || c.uacName,
          uacName: c.uacName || '',
          personalId: c.personalId || c.docenteId,
          docenteId: c.docenteId || c.personalId,
          horasSemanales: c.horasSemanales,
          requiereAulaEspecial: c.requiereAulaEspecial || false,
        }));
        setCargas(cargasNormalizadas);
      }

      if (data.horario && Array.isArray(data.horario.celdas) && data.horario.celdas.length > 0) {
        setHorario(data.horario);
        setModo('EDITOR');
        setPasoActual(4);
      } else {
        setModo('WIZARD');
        // Restaurar paso guardado o iniciar en Paso 1
        let pasoGuardado: string | null = null;
        if (typeof window !== 'undefined') {
          try {
            pasoGuardado = localStorage.getItem(`horarios_paso_${teacherId}`);
          } catch {}
        }
        const pasoNum = pasoGuardado ? parseInt(pasoGuardado, 10) : 1;
        setPasoActual(pasoNum >= 1 && pasoNum <= 3 ? pasoNum : 1);
      }
    } catch (e) {
      console.error('Error cargando configuración de horarios:', e);
      toast.error('Error al cargar datos del horario');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarHorarioIA = async (paramsFromWizard?: any) => {
    setLoading(true);
    try {
      const finalGrupos = paramsFromWizard?.grupos || grupos;
      const finalDocentes = paramsFromWizard?.docentes || docentes;
      const finalAulas = paramsFromWizard?.aulas || (aulas.length > 0 ? aulas : [{ id: 'aula-gen', nombre: 'Aula General', tipo: 'REGULAR' }]);
      const finalCargas = paramsFromWizard?.cargas || cargas;
      const finalConfig = paramsFromWizard?.config || config || { horasPorDia: 6, diasLectivos: 5 };

      if (paramsFromWizard?.grupos) setGrupos(paramsFromWizard.grupos);
      if (paramsFromWizard?.docentes) setDocentes(paramsFromWizard.docentes);
      if (paramsFromWizard?.cargas) setCargas(paramsFromWizard.cargas);
      if (paramsFromWizard?.config) setConfig(paramsFromWizard.config);
      if (paramsFromWizard?.escuela) {
        setEscuelaState((prev: any) => ({ ...prev, ...paramsFromWizard.escuela }));
      }

      // Calcular jornada requerida por cada grupo individualmente y jornada máxima del plantel
      const gruposMapeados = finalGrupos.map((g: any) => {
        const cargasG = finalCargas.filter((c: any) => (c.grupoId || c.grupo_nombre) === g.id || (c.grupoId || c.grupo_nombre) === g.nombre);
        const tot = cargasG.reduce((s: number, c: any) => s + Number(c.horasSemanales || c.horas_semanales || 0), 0);
        const minD = Math.ceil(tot / (finalConfig.diasLectivos || 5));
        const defaultHoras = g.semestre === 3 ? 8 : g.semestre === 5 ? 7 : 6;
        const gHoras = g.horasPorDia ? Number(g.horasPorDia) : (g.horas_por_dia ? Number(g.horas_por_dia) : defaultHoras);
        return {
          ...g,
          horasPorDia: Math.max(gHoras, minD, 1)
        };
      });

      const maxHorasPlantel = Math.max(
        ...gruposMapeados.map((g: any) => g.horasPorDia),
        Number(finalConfig.horasPorDia || 6)
      );

      const res = await fetch('/api/horarios/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: {
            grupos: gruposMapeados,
            docentes: finalDocentes,
            aulas: finalAulas,
            cargas: finalCargas,
            diasLectivos: finalConfig.diasLectivos || 5,
            horasPorDia: maxHorasPlantel,
            horaInicio: finalConfig.horaInicio || '08:00',
            config: { ...finalConfig, horasPorDia: maxHorasPlantel },
          },
        }),
      });

      const data = await res.json();
      const horarioResultado = data.horario || data.resultado;
      if (data.success && horarioResultado) {
        setHorario(horarioResultado);
        setModo('EDITOR');
        setPasoActual(4);
        toast.success('¡Horario generado exitosamente con 0 empalmes!');
      } else {
        toast.error(data.error || 'No se pudo generar el horario. Verifique la carga docente.');
      }
    } catch (e) {
      toast.error('Error al generar horario con IA');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarHorario = async () => {
    if (!confirm('¿Estás SEGURO de eliminar el horario generado? Volverá al asistente de configuración.')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/horarios/generar?escuelaId=${teacherId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Horario generado eliminado exitosamente.');
        setHorario(null);
        await cargarDatos();
        setModo('WIZARD');
        setPasoActual(1);
      } else {
        toast.error(data.error || 'No se pudo eliminar el horario.');
      }
    } catch (e) {
      toast.error('Error al eliminar horario');
    } finally {
      setLoading(false);
    }
  };

  const handleVolverAWizard = async () => {
    await cargarDatos();
    setModo('WIZARD');
    setPasoActual(1);
  };

  const handleReiniciarMapaCurricular = async () => {
    if (!confirm('¿Estás SEGURO de reiniciar completamente el Mapa Curricular? Se borrará la estructura de grupos previa.')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/escuelas/${teacherId}/mapa-curricular`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Configuración reiniciada correctamente.');
        try { localStorage.removeItem(`horarios_wizard_v4_${teacherId}`); } catch {}
        setEscuelaState((prev: any) => ({ ...prev, mapaCurricularCompletado: false }));
        setMapaModalAbierto(true);
        cargarDatos();
      } else {
        toast.error(data.error || 'Error al reiniciar la configuración.');
      }
    } catch (e) {
      toast.error('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleReiniciarProgramaHorario = async () => {
    const primerAviso = confirm(
      '⚠️ ¿Estás SEGURO de reiniciar completamente el programa de horario?\n\nEsta acción borrará el horario generado, todas las cargas docentes y todos los grupos asignados.'
    );
    if (!primerAviso) return;

    const segundoAviso = confirm(
      '🚨 CONFIRMACIÓN DEFINITIVA:\n\nSe eliminarán de forma irreversible el horario, las cargas horarias y los grupos del plantel.\n\n¿Deseas continuar?'
    );
    if (!segundoAviso) return;

    setLoading(true);
    try {
      // 1. Borrar configuración (cargas y grupos)
      const resConfig = await fetch('/api/horarios/configuracion', { method: 'DELETE' });
      // 2. Borrar horario generado
      const resGenerar = await fetch(`/api/horarios/generar?escuelaId=${teacherId}`, { method: 'DELETE' });

      if (resConfig.ok && resGenerar.ok) {
        toast.success('Programa de horario reiniciado completamente.');
        try {
          localStorage.removeItem(`horarios_paso_${teacherId}`);
          localStorage.removeItem(`horarios_wizard_v4_${teacherId}`);
        } catch {}
        setHorario(null);
        setGrupos([]);
        setCargas([]);
        setModo('WIZARD');
        setPasoActual(1);
        await cargarDatos();
      } else {
        toast.error('Ocurrió un error al reiniciar el programa de horario.');
      }
    } catch {
      toast.error('Error de conexión al reiniciar el programa de horario.');
    } finally {
      setLoading(false);
    }
  };

  // ── Pantalla de acceso restringido ─────────────────────────────────
  if (!isDirector) {
    return (
      <div style={{
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 12, padding: 24, textAlign: 'center', margin: '40px auto', maxWidth: 600,
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fca5a5', marginBottom: 8 }}>
          Acceso Exclusivo para Directores y Supervisión
        </h2>
        <p style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.5 }}>
          Hola {teacherName}, esta herramienta está diseñada para la confección del horario escolar del plantel.
          Si eres Director, Supervisor o ATP y requieres acceso, solicita la actualización de tu rol en el panel administrativo.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <Sparkles style={{ width: '40px', height: '40px', color: '#2563eb', animation: 'spin 2s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#f8fafc' }}>Cargando Generador Inteligente de Horarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '1rem', background: '#0f172a', padding: '1rem 1.25rem',
        borderRadius: '14px', border: '1px solid #334155',
      }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Calendar style={{ width: '22px', height: '22px', color: '#38bdf8' }} />
            Asistente Interactivo de Horarios MCCEMS 2026-2027
          </h2>
          <p style={{ fontSize: '0.78125rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>
            {escuelaState?.nombre || schoolName}
            {(escuelaState?.cct || cct) !== 'SIN CCT' && ` (${escuelaState?.cct || cct})`}
            {' '}· Confección semiautomática sin empalmes
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setMapaModalAbierto(true)}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff',
              padding: '0.45rem 0.85rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.78125rem',
              border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            }}
          >
            ⚙️ Configurar Mapa Curricular
          </button>

          <button
            onClick={handleReiniciarMapaCurricular}
            style={{
              background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '0.45rem 0.85rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.78125rem',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            }}
          >
            🔄 Reiniciar Configuración
          </button>

          <button
            onClick={handleReiniciarProgramaHorario}
            style={{
              background: 'rgba(239, 68, 68, 0.22)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.45)',
              padding: '0.45rem 0.85rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.78125rem',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            }}
            title="Borra horario generado, cargas docentes y grupos (mantiene mapa curricular)"
          >
            ⚠️ Reiniciar programa de horario
          </button>

          {horario && (
            <button
              onClick={handleEliminarHorario}
              style={{
                background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '0.45rem 0.85rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.78125rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}
            >
              🗑️ Eliminar Horario Generado
            </button>
          )}
        </div>
      </div>

      {/* ── Stepper ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#1e293b', border: '1px solid #334155', borderRadius: '14px',
        padding: '0.75rem 1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginRight: '0.5rem' }}>
            Navegación del Módulo:
          </span>
          {[
            { num: 1, label: '1. Estructura & Currículum' },
            { num: 2, label: '2. Plantilla Docente' },
            { num: 3, label: '3. Matriz por Semestre' },
            { num: 4, label: '4. Horario Generado (IA)' },
          ].map((step) => {
            const esActivo = pasoActual === step.num;
            const esCompletado = step.num < pasoActual || (step.num === 4 && !!horario);
            const esDeshabilitado = step.num === 4 && !horario;

            return (
              <button
                key={step.num}
                type="button"
                disabled={esDeshabilitado}
                onClick={() => {
                  if (step.num === 4) {
                    if (horario) { setModo('EDITOR'); setPasoActual(4); }
                    else toast.error('Aún no se ha generado un horario. Complete los pasos 1-3.');
                  } else {
                    setModo('WIZARD'); setPasoActual(step.num);
                  }
                }}
                style={{
                  padding: '0.45rem 0.9rem', borderRadius: '20px', border: 'none',
                  fontSize: '0.8rem', fontWeight: 800,
                  cursor: esDeshabilitado ? 'not-allowed' : 'pointer',
                  background: esActivo ? '#2563eb' : esCompletado ? '#334155' : 'transparent',
                  color: esActivo ? '#ffffff' : esDeshabilitado ? '#64748b' : '#cbd5e1',
                  opacity: esDeshabilitado ? 0.6 : 1, transition: 'all 0.2s',
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                }}
              >
                {step.num === 4 && horario ? '✨ ' : ''}{step.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Contenido principal ───────────────────────────────────────── */}
      {modo === 'WIZARD' ? (
        <WizardConfiguracion
          escuelaId={teacherId}
          configInicial={config ? { ...config, escuela: escuelaState } : null}
          gruposIniciales={grupos}
          aulasIniciales={aulas}
          docentesIniciales={docentes}
          cargasIniciales={cargas}
          onGenerarClick={handleGenerarHorarioIA}
          pasoInicial={pasoActual}
          onStepChange={(p) => setPasoActual(p)}
        />
      ) : (
        <EditorHorarios
          escuela={escuelaState || escuelaBase}
          horarioInicial={horario}
          grupos={grupos}
          docentes={docentes}
          aulas={aulas}
          cargas={cargas}
          onVolverAWizard={handleVolverAWizard}
          onGuardarHorario={(h) => setHorario(h)}
        />
      )}

      {/* ── Modal Mapa Curricular ─────────────────────────────────────── */}
      <ModalConfiguracionMapaCurricular
        escuela={escuelaState || escuelaBase}
        gruposIniciales={grupos}
        isOpen={mapaModalAbierto}
        onClose={() => setMapaModalAbierto(false)}
        onSaved={() => {
          setMapaModalAbierto(false);
          cargarDatos();
        }}
        forceObligatorio={isAdmin ? false : !escuelaState?.mapaCurricularCompletado}
        isAdmin={isAdmin}
      />
    </div>
  );
}
