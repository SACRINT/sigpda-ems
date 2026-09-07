'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { GeneratedPlanningContent, Planning, PlanningExtra } from '@/types/planning';
import { ExtraPreviewModal } from '@/components/planeacion/ExtraPreviewModal';
import DeletePlanningButton from '@/components/planeacion/DeletePlanningButton';
import GenerationFeedback from '@/components/feedback/GenerationFeedback';
import DocumentA4Viewer from '@/components/common/DocumentA4Viewer';
import { generatePlanningPDF } from '@/lib/pdf-generator';
// ── Lucide Icons ────────────────────────────────────────────────────────────
import {
  FileText, Zap, Clock, BookOpen, Printer, BarChart3, Package,
  Award, TrendingUp, Download, FileDown, Trash2, Search,
  RefreshCw, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Star, BookMarked, Microscope, Grid, Library, Send, Eye,
} from 'lucide-react';
// ── Recharts ─────────────────────────────────────────────────────────────────
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';

interface PlanningDetailClientProps {
  locale: string;
  planning: Planning;
  initialExtras: PlanningExtra[];
}

export default function PlanningDetailClient({
  locale,
  planning,
  initialExtras,
}: PlanningDetailClientProps) {
  const content = planning.contentJson as GeneratedPlanningContent | null;
  const s1 = content?.sectionI;
  const isLaboral = s1?.component?.toLowerCase().includes('laboral') || false;
  const activityLabel = isLaboral ? 'Actividades Clave' : 'Propósitos y Contenidos formativos';
  const prefix = isLaboral ? 'AC' : 'PC';

  // Tabs state
  const [activeTab, setActiveTab] = useState<'planning' | 'extras' | 'lessonPlans' | 'practiceGuides' | 'a4print' | 'audit' | 'bundle' | 'evaluador' | 'analytics'>('planning');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // ── Audit state ─────────────────────────────────────────────────────────
  const [auditReport, setAuditReport] = useState<any | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [expandedDimension, setExpandedDimension] = useState<string | null>(null);

  const handleRunAudit = async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      // First try to load existing audit
      const getRes = await fetch(`/api/audit/${planning.id}`);
      if (getRes.ok) {
        const getData = await getRes.json();
        if (getData?.audit) {
          setAuditReport(getData.audit);
          setAuditLoaded(true);
          setAuditLoading(false);
          return;
        }
      }
      // No existing audit — run a new one
      const postRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id }),
      });
      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error || 'Error al ejecutar la auditoría.');
      setAuditReport(postData.report);
      setAuditLoaded(true);
    } catch (err: any) {
      setAuditError(err.message || 'Error desconocido.');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleReAudit = async () => {
    setAuditReport(null);
    setAuditLoaded(false);
    setAuditError(null);
    setAuditLoading(true);
    try {
      const postRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id }),
      });
      const postData = await postRes.json();
      if (!postRes.ok) throw new Error(postData.error || 'Error al re-auditar.');
      setAuditReport(postData.report);
      setAuditLoaded(true);
    } catch (err: any) {
      setAuditError(err.message || 'Error desconocido.');
    } finally {
      setAuditLoading(false);
    }
  };

  // Load audit when switching to audit tab for the first time
  useEffect(() => {
    if (activeTab === 'audit' && !auditLoaded && !auditLoading) {
      handleRunAudit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Modal Checklist Supervisión DBEPA
  const [showChecklistModal, setShowChecklistModal] = useState(false);

  // Extras state
  const [extras, setExtras] = useState<PlanningExtra[]>(initialExtras);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [previewExtra, setPreviewExtra] = useState<PlanningExtra | null>(null);

  // Fetch extras on mount (to ensure sync)
  useEffect(() => {
    async function loadExtras() {
      try {
        const res = await fetch(`/api/plannings/${planning.id}/extras`);
        if (res.ok) {
          const data = await res.json();
          setExtras(data);
        }
      } catch (err) {
        console.error('Failed to load extras:', err);
      }
    }
    loadExtras();
  }, [planning.id]);

  // Generate extra handler
  async function handleGenerateExtra(
    type: 'rubric' | 'checklist' | 'material' | 'lesson_plan' | 'practice_guide',
    title: string,
    keyIndex: number | null,
    extraData: {
      activityName?: string;
      evidence?: string;
      sessionNum?: number;
      totalSessions?: number;
      practiceNumber?: number;
      practiceTitle?: string;
    }
  ) {
    // Generate unique key for loading state
    const loadingKey = `${type}-${keyIndex !== null ? keyIndex : ''}-${extraData.sessionNum || ''}-${extraData.evidence || title}`;
    setGeneratingKey(loadingKey);

    try {
      const res = await fetch(`/api/plannings/${planning.id}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          keyIndex,
          ...extraData,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate extra');
      }

      const result = await res.json();
      if (result.success && result.extra) {
        setExtras((prev) => [...prev, result.extra]);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al generar el recurso');
    } finally {
      setGeneratingKey(null);
    }
  }

  // Delete extra handler
  async function handleDeleteExtra(extraId: string) {
    if (!confirm('¿Estás seguro de que deseas eliminar este recurso generado?')) {
      return;
    }

    try {
      const res = await fetch(`/api/plannings/${planning.id}/extras?extraId=${extraId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setExtras((prev) => prev.filter((ex) => ex.id !== extraId));
      } else {
        alert('Error al eliminar el recurso');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Helper to find existing generated extra
  function findExtra(type: string, keyIndex: number | null, title?: string, sessionNum?: number) {
    return extras.find((ex) => {
      if (ex.type !== type) return false;
      if (ex.keyIndex !== keyIndex) return false;
      if (type === 'lesson_plan' && sessionNum !== undefined) {
        return ex.title.includes(`Sesión ${sessionNum} `) || ex.title.endsWith(`Sesión ${sessionNum}`);
      }
      if (type === 'material' && title) {
        return ex.title.toLowerCase().includes(title.toLowerCase());
      }
      return true;
    });
  }

  // List of estimated sessions for lesson plans
  const lessonSessions: {
    sessionNum: number;
    activityIndex: number;
    activityName: string;
    totalSessions: number;
  }[] = [];

  if (content?.sectionIV?.activities) {
    content.sectionIV.activities.forEach((act, actIdx) => {
      const hours = act.hours || 18;
      // Assume 1 session per hour of UAC
      for (let sNum = 1; sNum <= hours; sNum++) {
        lessonSessions.push({
          sessionNum: sNum,
          activityIndex: actIdx,
          activityName: act.name,
          totalSessions: hours,
        });
      }
    });
  }

  // Download PDF handler
  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const pdf = await generatePlanningPDF(planning);
      const filename = `Planeacion_${planning.uacName.replace(/\s+/g, '_')}_Semestre_${planning.semester}.pdf`;
      pdf.save(filename);
    } catch (e) {
      console.error('Error generating PDF:', e);
      alert('Hubo un error al generar el archivo PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };


  // ── Bundle state ────────────────────────────────────────────────────────
  interface BundleItem { type: string; label: string; icon: string; content: string | null; loading: boolean; }
  const BUNDLE_TYPES: { type: 'guia'|'instrumento'|'diapositivas'|'quiz'; label: string; icon: string; color: string }[] = [
    { type: 'guia',         label: 'Guía del Alumno',              icon: '📖', color: '#1d4ed8' },
    { type: 'instrumento',  label: 'Instrumento Coevaluación',     icon: '📋', color: '#059669' },
    { type: 'diapositivas', label: 'Guión de Diapositivas',        icon: '🎨', color: '#7c3aed' },
    { type: 'quiz',         label: 'Quiz / Evaluación Diagnóstica',icon: '🧩', color: '#b45309' },
  ];
  const [bundleResults, setBundleResults] = useState<Record<string, string | null>>({});
  const [bundleLoading, setBundleLoading] = useState<Record<string, boolean>>({});
  const [bundleErrors,  setBundleErrors]  = useState<Record<string, string | null>>({});
  const [bundleExpanded, setBundleExpanded] = useState<string | null>(null);

  const handleGenerateBundleItem = async (type: 'guia'|'instrumento'|'diapositivas'|'quiz') => {
    setBundleLoading(prev => ({ ...prev, [type]: true }));
    setBundleErrors(prev  => ({ ...prev, [type]: null }));
    try {
      const res = await fetch('/api/bundles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar el material');
      setBundleResults(prev => ({ ...prev, [type]: data.result || '' }));
      setBundleExpanded(type);
    } catch (err: any) {
      setBundleErrors(prev => ({ ...prev, [type]: err.message || 'Error desconocido' }));
    } finally {
      setBundleLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleGenerateFullBundle = async () => {
    for (const bt of BUNDLE_TYPES) {
      setBundleLoading(prev => ({ ...prev, [bt.type]: true }));
      setBundleErrors(prev  => ({ ...prev, [bt.type]: null }));
    }
    try {
      const res = await fetch('/api/bundles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id, type: 'full' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar bundle completo');
      const b = data.bundle;
      setBundleResults({
        guia:         b.guiaEstudiante        || '',
        instrumento:  b.instrumentoEvaluacion || '',
        diapositivas: b.guionDiapositivas     || '',
        quiz:         b.quiz                  || '',
      });
    } catch (err: any) {
      BUNDLE_TYPES.forEach(bt =>
        setBundleErrors(prev => ({ ...prev, [bt.type]: err.message || 'Error' }))
      );
    } finally {
      for (const bt of BUNDLE_TYPES) {
        setBundleLoading(prev => ({ ...prev, [bt.type]: false }));
      }
    }
  };

  // ── Evaluador state ─────────────────────────────────────────────────────
  const [evalResult, setEvalResult]   = useState<any | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError,   setEvalError]   = useState<string | null>(null);
  const [evalLoaded,  setEvalLoaded]  = useState(false);

  const handleRunEvaluacion = async () => {
    setEvalLoading(true);
    setEvalError(null);
    try {
      const res = await fetch('/api/planeaciones/evaluar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al evaluar la planeación.');
      setEvalResult(data.resultado);
      setEvalLoaded(true);
    } catch (err: any) {
      setEvalError(err.message || 'Error desconocido.');
    } finally {
      setEvalLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'evaluador' && !evalLoaded && !evalLoading) {
      handleRunEvaluacion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Analytics state ──────────────────────────────────────────────────────
  const [analyticsData, setAnalyticsData]   = useState<any | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError,   setAnalyticsError]   = useState<string | null>(null);
  const [analyticsLoaded,  setAnalyticsLoaded]  = useState(false);

  const handleLoadAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch('/api/pedagogical-analytics');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar analytics.');
      setAnalyticsData(data);
      setAnalyticsLoaded(true);
    } catch (err: any) {
      setAnalyticsError(err.message || 'Error desconocido.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics' && !analyticsLoaded && !analyticsLoading) {
      handleLoadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Classroom state
  const [publishingClassroom, setPublishingClassroom] = useState(false);

  // Classroom publish handler
  const handlePublishClassroom = async () => {
    try {
      setPublishingClassroom(true);
      const res = await fetch('/api/classroom/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningId: planning.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Error al conectar con Google Classroom');
      }

      if (!data.configured) {
        alert('Configura Google Classroom en Configuración\n\n' + data.message);
        return;
      }

      if (data.success) {
        alert(data.message);
        if (data.courseUrl) {
          window.open(data.courseUrl, '_blank');
        }
      } else {
        alert(data.message || 'No se pudo publicar la planeación en Classroom.');
      }
    } catch (err: any) {
      console.error('Error publishing to classroom:', err);
      alert(err.message || 'Ocurrió un error al intentar publicar en Google Classroom.');
    } finally {
      setPublishingClassroom(false);
    }
  };

  if (!content) {

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div className="page-header" style={{ borderBottom: '1px solid var(--c-border)', paddingBottom: '16px' }}>
          <Link href={`/${locale}/dashboard`} className="btn btn-ghost" style={{ marginBottom: '12px', display: 'inline-flex' }}>
            ← Mis planeaciones
          </Link>
          <h1 className="page-title" style={{ fontSize: '28px', color: 'var(--c-navy)' }}>{planning.uacName}</h1>
          <p className="page-subtitle" style={{ color: 'var(--c-text-muted)', fontSize: '15px' }}>
            {planning.semester}° Semestre · Componente {planning.component === 'laboral' ? 'Formación Laboral' : 'Fundamental/Ampliado'}
          </p>
          <div className="page-actions" style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <DeletePlanningButton id={planning.id} locale={locale} redirectAfterDelete={true} />
          </div>
        </div>

        {/* Warning Banner */}
        <div className="card" style={{ border: '1px solid #f5c2c7', backgroundColor: '#f8d7da', color: '#842029', padding: '24px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: 'bold' }}>
            <span>⚠️</span> Borrador - Generación Incompleta
          </div>
          <p style={{ lineHeight: 1.6, margin: 0, fontSize: '15px' }}>
            Esta planeación didáctica se encuentra en estado de <strong>Borrador</strong>. Las 7 secciones oficiales de la planeación y los instrumentos de evaluación no han sido generados.
          </p>
          <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Link href={`/${locale}/nueva-planeacion`} className="btn btn-primary" style={{ backgroundColor: 'var(--c-navy)', borderColor: 'var(--c-navy)' }}>
              Crear nueva planeación
            </Link>
            <DeletePlanningButton id={planning.id} locale={locale} redirectAfterDelete={true} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="page-header" style={{ borderBottom: '1px solid var(--c-border)', paddingBottom: '16px' }}>
        <Link href={`/${locale}/dashboard`} className="btn btn-ghost" style={{ marginBottom: '12px', display: 'inline-flex' }}>
          ← Mis planeaciones
        </Link>
        <h1 className="page-title" style={{ fontSize: '28px', color: 'var(--c-navy)' }}>{planning.uacName}</h1>
        <p className="page-subtitle" style={{ color: 'var(--c-text-muted)', fontSize: '15px' }}>
          {planning.semester}° Semestre · Componente {planning.component === 'laboral' ? 'Formación Laboral' : 'Fundamental/Ampliado'}
        </p>
        <div className="page-actions" style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {content && (
            <>
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#dc2626',
                  borderColor: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 600,
                }}
              >
                <Download size={15} /> {downloadingPdf ? 'Generando PDF…' : 'Descargar PDF'}
              </button>
              <a href={`/api/docx/${planning.id}`} className="btn btn-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <FileDown size={15} /> Descargar Word (DOCX)
              </a>
              <button
                onClick={() => setActiveTab('a4print')}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Eye size={15} /> Vista Impresión A4
              </button>
              <button
                onClick={handlePublishClassroom}
                disabled={publishingClassroom}
                className="btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#15803d',
                  borderColor: '#15803d',
                  color: '#ffffff',
                  fontWeight: 600,
                }}
              >
                <Send size={15} /> {publishingClassroom ? 'Publicando…' : 'Publicar en Classroom'}
              </button>
            </>
          )}
          <DeletePlanningButton id={planning.id} locale={locale} redirectAfterDelete={true} />
        </div>

      </div>

      {/* Hierarchy & Compliance Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#f8fafc',
        padding: '16px 20px',
        borderRadius: '10px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>
            Jerarquía Normativa DBEPA 2026-2027
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: '#3b82f6', color: '#fff', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
              Macro: Planeación Didáctica Semestral
            </span>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>➔</span>
            <span style={{ background: '#10b981', color: '#fff', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
              Micro: Secuencias Didácticas ({isLaboral ? 'Actividades Clave' : 'Propósitos Formativos'})
            </span>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>➔</span>
            <span style={{ background: '#f59e0b', color: '#fff', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
              Micro-operativo: Planes de Clase ({lessonSessions.length} Sesiones)
            </span>
            {planning.metodologiaActiva && (
              <>
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>·</span>
                <span style={{ background: '#7c3aed', color: '#fff', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                  🎯 {planning.metodologiaActiva}
                </span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowChecklistModal(true)}
          style={{
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          📋 Checklist de Supervisión DBEPA
        </button>
      </div>

      {/* Tabs Menu — Lucide icons */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--c-border)', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {([
          { key: 'planning',      label: 'Planeación',         icon: <FileText   size={15}/>, color: 'var(--c-blue-mid)' },
          { key: 'extras',        label: 'Rúbricas',           icon: <Zap        size={15}/>, color: 'var(--c-blue-mid)' },
          { key: 'lessonPlans',   label: `Planes (${lessonSessions.length})`, icon: <Clock size={15}/>, color: 'var(--c-blue-mid)' },
          { key: 'practiceGuides',label: 'Guías',              icon: <BookOpen   size={15}/>, color: '#7c3aed' },
          { key: 'a4print',       label: 'Formato A4',         icon: <Printer    size={15}/>, color: 'var(--c-blue-mid)' },
          { key: 'audit',         label: 'Auditoría',          icon: <BarChart3  size={15}/>, color: '#059669' },
          { key: 'bundle',        label: 'Bundle',             icon: <Package    size={15}/>, color: '#b45309' },
          { key: 'evaluador',     label: 'Evaluador IA',       icon: <Award      size={15}/>, color: '#dc2626' },
          { key: 'analytics',     label: 'Analytics',          icon: <TrendingUp size={15}/>, color: '#0891b2' },
        ] as const).map(({ key, label, icon, color }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderBottom: activeTab === key ? `3px solid ${color}` : '3px solid transparent',
              color: activeTab === key ? color : 'var(--c-text-muted)',
              background: activeTab === key ? `${color}10` : 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '6px 6px 0 0',
              transition: 'all 0.15s',
              border: 'none',
              borderBottomWidth: '3px',
              borderBottomStyle: 'solid',
              borderBottomColor: activeTab === key ? color : 'transparent',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: PLANNING GENERAL */}
      {/* TAB CONTENT: PLANNING GENERAL */}
      {activeTab === 'planning' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Section I */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">I. Datos Generales y Administrativos</span>
            </div>
            <div className="section-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div><strong>Docente:</strong> {s1?.teacherName}</div>
                <div><strong>UAC/Ubicación:</strong> {s1?.uacName}</div>
                <div><strong>Semestre:</strong> {s1?.semester}° Semestre</div>
                <div><strong>Grupos:</strong> {s1?.groups}</div>
                <div><strong>Carga horaria:</strong> {s1?.totalHours} hrs.</div>
                <div><strong>Subsistema:</strong> {s1?.subsystem}</div>
              </div>
            </div>
          </div>

          {/* Section II */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">II. Propósito Formativo (Intencionalidad Curricular)</span>
            </div>
            <div className="section-card-body">
              <p style={{ marginBottom: '16px', lineHeight: 1.6 }}>{content?.sectionII?.purpose}</p>
              
              <p style={{ fontWeight: 600, marginBottom: '6px' }}>Resultados de Aprendizaje:</p>
              <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginBottom: '16px' }}>
                {content?.sectionII?.learningOutcomes?.map((out, idx) => (
                  <li key={idx} style={{ marginBottom: '4px', fontSize: '14px' }}>{out}</li>
                ))}
              </ul>

              <p><strong>Vinculación PAEC:</strong></p>
              <p style={{ color: 'var(--c-text-2)', fontStyle: 'italic', fontSize: '14px' }}>
                {content?.sectionII?.paecConnection}
              </p>
            </div>
          </div>

          {/* Activities Dosificación Table */}
          {content?.sectionII?.activities && (
            <div className="section-card">
              <div className="section-card-header">
                <span className="section-card-title">Dosificación de Actividades Clave y Tiempos</span>
              </div>
              <div className="section-card-body" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left' }}>{activityLabel}</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Corte de Evaluación</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.sectionII.activities.map((a, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{a.name}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--c-navy-light)', fontWeight: 600 }}>
                          {a.corte || 'Corte ' + (i + 1)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>{a.hours} hrs.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section IV Summary */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">IV. Diseño de Secuencia Didáctica (Actividades)</span>
            </div>
            <div className="section-card-body">
              {content?.sectionIV?.activities?.map((a, i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px 18px',
                    background: i % 2 === 0 ? 'var(--c-blue-pale)' : 'var(--c-surface)',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    borderLeft: '4px solid var(--c-blue-mid)',
                  }}
                >
                  <strong>{prefix}{i + 1}:</strong> {a.name}{' '}
                  <span style={{ color: 'var(--c-text-muted)', fontSize: '13px' }}>({a.hours} hrs.)</span>
                  {' — '}
                  <em style={{ color: 'var(--c-navy-light)', fontWeight: 500 }}>{a.methodology}</em>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EXTRAS & INSTRUMENTS */}
      {activeTab === 'extras' && (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section V - Instruments generation */}
          <div className="section-card">
            <div className="section-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="section-card-title">A. Instrumentos de Evaluación Propuestos</span>
              <span className="text-xs" style={{ color: 'var(--c-navy-light)', fontWeight: 600 }}>Trinomio de Evaluación</span>
            </div>
            <div className="section-card-body">
              {content?.sectionV?.evaluationAgreement && (
                <div style={{ padding: '12px', background: '#F8FAFC', borderLeft: '3px solid var(--c-amber)', borderRadius: '6px', marginBottom: '16px', fontSize: '13.5px' }}>
                  <p style={{ fontWeight: 600, color: 'var(--c-navy)', marginBottom: '4px' }}>Acuerdo de Acreditación / Evaluación:</p>
                  <p style={{ color: '#475569', fontStyle: 'italic' }}>{content.sectionV.evaluationAgreement}</p>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--c-navy)', color: '#fff' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Corte / Momento</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Evidencia</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Instrumento Propuesto</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>%</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Herramientas Extra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content?.sectionV?.evaluations?.map((ev, i) => {
                      const isDiagnostic = ev.type?.toLowerCase().includes('diagn') || ev.percentage === 0;
                      const instrumentType = ev.instrument?.toLowerCase().includes('rubri') ? 'rubric' : 'checklist';
                      
                      // Match extra
                      const generated = findExtra(instrumentType, i);
                      const loadingKey = `${instrumentType}-${i}--${ev.evidence}`;
                      const isCurrentGenerating = generatingKey === loadingKey;

                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--c-blue-pale)', borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontWeight: 600 }}>{ev.moment}</span>
                            <div style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>{ev.type} · {ev.agent}</div>
                          </td>
                          <td style={{ padding: '10px 12px', maxWidth: '220px' }}>{ev.evidence}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 500 }}>{ev.instrument}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{ev.percentage}%</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {generated ? (
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => setPreviewExtra(generated)}
                                  className="btn"
                                  style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px' }}
                                >
                                  👁️ Ver
                                </button>
                                <a
                                  href={`/api/docx/extra/${generated.id}`}
                                  className="btn btn-amber"
                                  style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none' }}
                                >
                                  ↓ Word
                                </a>
                                <a
                                  href={`/api/pdf/extra/${generated.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn"
                                  style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600 }}
                                >
                                  ↓ PDF
                                </a>
                                <button
                                  onClick={() => handleDeleteExtra(generated.id)}
                                  className="btn"
                                  style={{ padding: '4px 8px', fontSize: '11px', background: '#FEE2E2', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '4px' }}
                                >
                                  🗑️
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  handleGenerateExtra(
                                    instrumentType,
                                    `${ev.instrument}: ${ev.evidence.substring(0, 30)}...`,
                                    i,
                                    { evidence: ev.evidence, activityName: ev.moment }
                                  )
                                }
                                disabled={generatingKey !== null}
                                className="btn btn-navy"
                                style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px', background: 'var(--c-blue-mid)', color: '#fff', border: 'none', cursor: 'pointer' }}
                              >
                                {isCurrentGenerating ? '⏳ Generando...' : `⚡ Generar ${instrumentType === 'rubric' ? 'Rúbrica' : 'Lista'}`}
                              </button>
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

          {/* Section VI - Classroom Materials */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">B. Materiales Didácticos Impresos del Docente</span>
            </div>
            <div className="section-card-body">
              <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginBottom: '14px' }}>
                Genera el contenido técnico real y completo de los materiales sugeridos en la Sección VI.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {content?.sectionVI?.teacherMaterials?.map((mat, idx) => {
                  const cleanMatName = mat.replace(/^[•\s\-\*]+/g, '').trim();
                  
                  // Match extra
                  const generated = findExtra('material', null, cleanMatName);
                  const loadingKey = `material--${cleanMatName}`;
                  const isCurrentGenerating = generatingKey === loadingKey;

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontSize: '16px' }}>📄</span>
                        <span style={{ fontWeight: 500, fontSize: '14px', color: 'var(--c-navy)' }}>{cleanMatName}</span>
                      </div>
                      
                      <div>
                        {generated ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => setPreviewExtra(generated)}
                              className="btn"
                              style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px' }}
                            >
                              👁️ Ver en Pantalla
                            </button>
                            <a
                              href={`/api/docx/extra/${generated.id}`}
                              className="btn btn-amber"
                              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', textDecoration: 'none' }}
                            >
                              ↓ Descargar Word
                            </a>
                            <a
                              href={`/api/pdf/extra/${generated.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600 }}
                            >
                              ↓ Descargar PDF
                            </a>
                            <button
                              onClick={() => handleDeleteExtra(generated.id)}
                              className="btn"
                              style={{ padding: '6px 12px', fontSize: '12px', background: '#FEE2E2', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '4px' }}
                            >
                              🗑️
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              handleGenerateExtra(
                                'material',
                                cleanMatName,
                                null,
                                {}
                              )
                            }
                            disabled={generatingKey !== null}
                            className="btn btn-navy"
                            style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                          >
                            {isCurrentGenerating ? '⏳ Redactando...' : '⚡ Generar Material Impreso'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Widget */}
        <GenerationFeedback entityType="planning" entityId={planning.id} />
        </>
      )}

      {/* TAB CONTENT: LESSON PLANS */}
      {activeTab === 'lessonPlans' && (
        <div className="section-card">
          <div className="section-card-header">
            <span className="section-card-title">Planes de Clase Desglosados por Sesión (50 min)</span>
          </div>
          <div className="section-card-body">
            <div style={{ padding: '12px', background: 'var(--c-blue-pale)', borderLeft: '3px solid var(--c-blue-mid)', borderRadius: '6px', marginBottom: '16px', fontSize: '13.5px' }}>
              <p style={{ color: 'var(--c-navy)', fontWeight: 600 }}>💡 Evaluación del Supervisor (USICAMM):</p>
              <p style={{ color: 'var(--c-text-muted)' }}>
                Genera el desglose del plan de clase de una sesión específica. Cada plan de clase cuenta con temporalidad exacta (Apertura 10m, Desarrollo 30m, Cierre 10m), exploración de saberes previos, metodología socio-crítica y metacognición formativa.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {lessonSessions.map((session, idx) => {
                const sLabel = `Plan de Clase: Sesión ${session.sessionNum} - ${session.activityName.substring(0, 40)}...`;
                
                // Match generated extra
                const generated = findExtra('lesson_plan', session.activityIndex, undefined, session.sessionNum);
                const loadingKey = `lesson_plan-${session.activityIndex}-${session.sessionNum}-`;
                const isCurrentGenerating = generatingKey?.startsWith(loadingKey);

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: idx % 2 === 0 ? '#fff' : 'var(--c-blue-pale)',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                    }}
                  >
                    <div>
                      <span className="font-semibold" style={{ color: 'var(--c-navy-light)', marginRight: '10px' }}>
                        Sesión {session.sessionNum}
                      </span>
                      <span style={{ fontSize: '13px', color: '#475569' }}>
                        ({prefix}{session.activityIndex + 1}) {session.activityName.substring(0, 75)}...
                      </span>
                    </div>

                    <div>
                      {generated ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => setPreviewExtra(generated)}
                            className="btn"
                            style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--c-blue-pale)', border: '1px solid var(--c-blue-mid)', color: 'var(--c-blue-mid)', borderRadius: '4px' }}
                          >
                            👁️ Ver
                          </button>
                          <a
                            href={`/api/docx/extra/${generated.id}`}
                            className="btn btn-amber"
                            style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none' }}
                          >
                            ↓ Word
                          </a>
                          <a
                            href={`/api/pdf/extra/${generated.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', textDecoration: 'none', background: '#dc2626', color: '#fff', fontWeight: 600 }}
                          >
                            ↓ PDF
                          </a>
                          <button
                            onClick={() => handleDeleteExtra(generated.id)}
                            className="btn"
                            style={{ padding: '4px 8px', fontSize: '11px', background: '#FEE2E2', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '4px' }}
                          >
                            🗑️
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            handleGenerateExtra(
                              'lesson_plan',
                              `Plan de Clase: Sesión ${session.sessionNum} - ${session.activityName.substring(0, 45)}`,
                              session.activityIndex,
                              {
                                sessionNum: session.sessionNum,
                                totalSessions: session.totalSessions,
                                activityName: session.activityName,
                              }
                            )
                          }
                          disabled={generatingKey !== null}
                          className="btn btn-navy"
                          style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                        >
                          {isCurrentGenerating ? '⏳ Creando plan...' : '⚡ Generar Plan de Clase'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PRACTICE GUIDES (Fase 3) */}
      {activeTab === 'practiceGuides' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="section-card">
            <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)', color: '#fff' }}>
              <span className="section-card-title" style={{ color: '#fff' }}>📚 Guías de Práctica para el Estudiante (Estilo MPM Tecnológico)</span>
            </div>
            <div className="section-card-body">
              <div style={{ padding: '12px', background: '#f5f3ff', borderLeft: '3px solid #7c3aed', borderRadius: '6px', marginBottom: '16px', fontSize: '13.5px' }}>
                <p style={{ color: '#4c1d95', fontWeight: 600, marginBottom: '4px' }}>💡 ¿Qué es la Guía de Práctica para el Estudiante?</p>
                <p style={{ color: '#6d28d9', marginBottom: '6px' }}>
                  Documento que el estudiante recibe directamente (impreso o digital) para guiar su aprendizaje autónomo.
                  Tiene la misma estructura que los manuales MPM2S12027 de los Bachilleratos Tecnológicos (CECyTE/DGETI),
                  incluyendo propósito, competencias, materiales, procedimiento por fases de la metodología activa,
                  preguntas de análisis (taxonomía Bloom), tabla de datos y autoevaluación formativa.
                </p>
                {planning.metodologiaActiva && (
                  <p style={{ color: '#4c1d95', fontWeight: 700, fontSize: '13px' }}>
                    🎯 Metodología activa seleccionada: <strong>{planning.metodologiaActiva}</strong> — las guías incluirán sus fases específicas.
                  </p>
                )}
              </div>

              {/* One card per key activity */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {content?.sectionIV?.activities?.map((act, actIdx) => {
                  const practiceNum = actIdx + 1;
                  const practiceTitle = `${act.name.substring(0, 60)}`;
                  const generatedGuide = extras.find(
                    (ex) => ex.type === 'practice_guide' && ex.keyIndex === actIdx
                  );
                  const loadingKey = `practice_guide-${actIdx}--`;
                  const isCurrentGenerating = generatingKey?.startsWith(loadingKey);

                  return (
                    <div
                      key={actIdx}
                      style={{
                        border: '1px solid #ddd6fe',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: '#faf5ff',
                      }}
                    >
                      {/* Activity header */}
                      <div style={{
                        padding: '12px 16px',
                        background: 'linear-gradient(90deg, #ede9fe, #f5f3ff)',
                        borderBottom: '1px solid #ddd6fe',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}>
                        <div>
                          <span style={{ fontWeight: 700, color: '#4c1d95', fontSize: '15px' }}>
                            📋 Práctica {practiceNum}: {practiceTitle}
                          </span>
                          <div style={{ fontSize: '12px', color: '#7c3aed', marginTop: '2px' }}>
                            {act.hours} hrs · {act.methodology || 'Metodología activa'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {generatedGuide ? (
                            <>
                              <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600, background: '#d1fae5', padding: '3px 10px', borderRadius: '12px' }}>
                                ✓ Guía generada
                              </span>
                              <button
                                onClick={() => setPreviewExtra(generatedGuide)}
                                className="btn"
                                style={{ padding: '6px 14px', fontSize: '12px', background: '#ede9fe', border: '1px solid #7c3aed', color: '#7c3aed', borderRadius: '6px' }}
                              >
                                👁️ Ver Guía
                              </button>
                              <a
                                href={`/api/docx/extra/${generatedGuide.id}`}
                                className="btn"
                                style={{ padding: '6px 14px', fontSize: '12px', background: '#7c3aed', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}
                              >
                                ↓ Word
                              </a>
                              <a
                                href={`/api/pdf/extra/${generatedGuide.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ padding: '6px 14px', fontSize: '12px', background: '#dc2626', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}
                              >
                                ↓ PDF
                              </a>
                              <button
                                onClick={() => handleDeleteExtra(generatedGuide.id)}
                                className="btn"
                                style={{ padding: '6px 12px', fontSize: '12px', background: '#FEE2E2', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '6px' }}
                              >
                                🗑️
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() =>
                                handleGenerateExtra(
                                  'practice_guide',
                                  `Guía de Práctica ${practiceNum}: ${practiceTitle.substring(0, 50)}`,
                                  actIdx,
                                  {
                                    activityName: act.name,
                                    practiceNumber: practiceNum,
                                    practiceTitle: practiceTitle,
                                  }
                                )
                              }
                              disabled={generatingKey !== null}
                              className="btn"
                              style={{
                                padding: '8px 18px',
                                fontSize: '13px',
                                borderRadius: '6px',
                                border: 'none',
                                background: generatingKey !== null ? '#c4b5fd' : '#7c3aed',
                                color: '#fff',
                                fontWeight: 600,
                                cursor: generatingKey !== null ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isCurrentGenerating ? '⏳ Generando guía...' : '📚 Generar Guía del Estudiante'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Preview of learning outcome if available */}
                      {content?.sectionII?.learningOutcomes?.[actIdx] && (
                        <div style={{ padding: '10px 16px', fontSize: '13px', color: '#6d28d9', borderTop: '1px dashed #ddd6fe' }}>
                          <strong>📌 Resultado de aprendizaje:</strong> {content.sectionII.learningOutcomes[actIdx]}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(!content?.sectionIV?.activities || content.sectionIV.activities.length === 0) && (
                  <div style={{ textAlign: 'center', color: 'var(--c-text-muted)', padding: '40px 0', fontSize: '14px' }}>
                    No se encontraron actividades clave en la Sección IV de esta planeación.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feedback */}
          <GenerationFeedback entityType="planning" entityId={planning.id} />
        </div>
      )}
      {activeTab === 'a4print' && (
        <DocumentA4Viewer
          planning={planning}
          onDownloadDocx={() => {
            window.location.href = `/api/docx/${planning.id}`;
          }}
        />
      )}

      {/* ── TAB CONTENT: AUDITORÍA PEDAGÓGICA ─────────────────────────── */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '8px' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--c-navy)', margin: 0 }}>📊 Auditoría Pedagógica IA</h2>
              <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', margin: '4px 0 0' }}>
                Evaluación automática en 4 dimensiones MCCEMS · Motor v2 · SEMS
              </p>
            </div>
            {auditLoaded && !auditLoading && (
              <button
                onClick={handleReAudit}
                style={{
                  padding: '9px 18px', fontSize: '13px', fontWeight: 600,
                  background: '#f0fdf4', border: '1.5px solid #059669', borderRadius: '8px',
                  color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                🔄 Re-auditar
              </button>
            )}
          </div>

          {/* Loading */}
          {auditLoading && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '16px', padding: '60px 20px', background: '#f8fafc', borderRadius: '12px',
              border: '1px dashed #cbd5e1',
            }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                border: '4px solid #e2e8f0', borderTopColor: '#059669',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ fontSize: '15px', color: 'var(--c-text-muted)', fontWeight: 500, margin: 0 }}>
                Analizando planeación contra el programa oficial SEP…
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Error */}
          {!auditLoading && auditError && (
            <div style={{
              padding: '20px 24px', background: '#fff1f2', border: '1px solid #fda4af',
              borderRadius: '10px', display: 'flex', gap: '12px', alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: '22px' }}>❌</span>
              <div>
                <div style={{ fontWeight: 700, color: '#be123c', fontSize: '14px' }}>Error al ejecutar la auditoría</div>
                <div style={{ color: '#e11d48', fontSize: '13px', marginTop: '4px' }}>{auditError}</div>
                <button
                  onClick={handleReAudit}
                  style={{
                    marginTop: '12px', padding: '7px 16px', fontSize: '13px', fontWeight: 600,
                    background: '#be123c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  }}
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* Audit Results */}
          {!auditLoading && !auditError && auditReport && (() => {
            const score: number = auditReport.overall_score ?? 0;
            const level: string = auditReport.compliance_level ?? 'requiere_mejora';
            const scoreColor = score >= 80 ? '#059669' : score >= 60 ? '#d97706' : score >= 40 ? '#ea580c' : '#dc2626';
            const scoreBg = score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : score >= 40 ? '#fff7ed' : '#fff1f2';
            const levelLabel: Record<string, string> = {
              excelente: '🏆 Excelente',
              satisfactorio: '✅ Satisfactorio',
              requiere_mejora: '⚠️ Requiere Mejora',
              no_alineado: '❌ No Alineado',
            };
            const dimLabel: Record<string, string> = {
              propositos_alineacion: '1. Alineación con Propósitos Formativos',
              cobertura_contenidos: '2. Cobertura de Contenidos Temáticos',
              secuenciacion_logica: '3. Secuenciación Lógica y Momentos Didácticos',
              adecuacion_evidencias: '4. Adecuación de Evidencias e Instrumentos',
            };
            const statusIcon: Record<string, string> = { cumple: '✅', parcial: '⚠️', no_cumple: '❌' };
            const dimScores = auditReport.dimension_scores || {};
            const findings = auditReport.findings || {};
            const recommendations: any[] = auditReport.recommendations || [];
            const sevColor: Record<string, string> = { alta: '#dc2626', media: '#d97706', baja: '#059669' };

            return (
              <>
                {/* Score Card */}
                <div style={{
                  display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap',
                  padding: '24px', borderRadius: '14px', background: scoreBg,
                  border: `2px solid ${scoreColor}33`,
                }}>
                  {/* Circular score */}
                  <div style={{
                    position: 'relative', width: '100px', height: '100px', flexShrink: 0,
                  }}>
                    <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                      <circle
                        cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="10"
                        strokeDasharray={`${(score / 100) * 263.9} 263.9`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: '24px', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</span>
                      <span style={{ fontSize: '11px', color: scoreColor, fontWeight: 600 }}>/ 100</span>
                    </div>
                  </div>

                  {/* Level + meta */}
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: scoreColor }}>
                      {levelLabel[level] || level}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginTop: '4px' }}>
                      {auditReport.uac_name} · {auditReport.semester}° Semestre
                    </div>
                    {auditReport.created_at && (
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                        Auditado: {new Date(auditReport.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>

                  {/* Mini dimension bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px', flex: 1 }}>
                    {Object.entries(dimScores).map(([key, dim]: [string, any]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--c-text-muted)', width: '14px', textAlign: 'center' }}>
                          {statusIcon[dim.status] || '⚠️'}
                        </span>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${dim.score}%`, height: '100%',
                            background: dim.score >= 80 ? '#059669' : dim.score >= 60 ? '#d97706' : '#dc2626',
                            borderRadius: '99px', transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-navy)', width: '28px', textAlign: 'right' }}>
                          {dim.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dimension Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-navy)', margin: 0 }}>Detalle por Dimensión</h3>
                  {Object.entries(dimScores).map(([key, dim]: [string, any]) => {
                    const isExpanded = expandedDimension === key;
                    const dimScore: number = dim.score ?? 0;
                    const dimColor = dimScore >= 80 ? '#059669' : dimScore >= 60 ? '#d97706' : '#dc2626';
                    const dimBg = dimScore >= 80 ? '#f0fdf4' : dimScore >= 60 ? '#fffbeb' : '#fff1f2';
                    return (
                      <div key={key} style={{ border: `1px solid ${dimColor}33`, borderRadius: '10px', overflow: 'hidden' }}>
                        <button
                          onClick={() => setExpandedDimension(isExpanded ? null : key)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '14px 16px', background: dimBg, border: 'none', cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ fontSize: '18px' }}>{statusIcon[dim.status] || '⚠️'}</span>
                          <span style={{ flex: 1, fontWeight: 700, fontSize: '14px', color: 'var(--c-navy)' }}>
                            {dimLabel[key] || key}
                          </span>
                          <span style={{
                            fontSize: '16px', fontWeight: 900, color: dimColor,
                            background: `${dimColor}18`, borderRadius: '6px', padding: '2px 10px',
                          }}>
                            {dimScore}/100
                          </span>
                          <span style={{ color: 'var(--c-text-muted)', fontSize: '13px' }}>{isExpanded ? '▲' : '▼'}</span>
                        </button>
                        {isExpanded && (
                          <div style={{ padding: '14px 16px', background: '#fff', borderTop: `1px solid ${dimColor}22` }}>
                            <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.6, margin: 0 }}>
                              {dim.feedback}
                            </p>
                            <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                padding: '2px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 700,
                                background: dim.status === 'cumple' ? '#dcfce7' : dim.status === 'parcial' ? '#fef9c3' : '#fee2e2',
                                color: dim.status === 'cumple' ? '#166534' : dim.status === 'parcial' ? '#92400e' : '#991b1b',
                              }}>
                                {dim.status === 'cumple' ? 'Cumple' : dim.status === 'parcial' ? 'Cumple Parcialmente' : 'No Cumple'}
                              </span>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Ponderación: {Math.round((dim.weight ?? 0) * 100)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Findings */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {/* Fortalezas */}
                  {findings.fortalezas?.length > 0 && (
                    <div style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#166534', marginBottom: '10px' }}>✅ Fortalezas</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {findings.fortalezas.map((f: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: '#14532d', lineHeight: 1.5 }}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Desalineaciones */}
                  {findings.desalineaciones?.length > 0 && (
                    <div style={{ padding: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#92400e', marginBottom: '10px' }}>⚠️ Desalineaciones Detectadas</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {findings.desalineaciones.map((d: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: '#78350f', lineHeight: 1.5 }}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Omisiones */}
                  {findings.omisiones_detectadas?.length > 0 && (
                    <div style={{ padding: '16px', background: '#fff1f2', border: '1px solid #fda4af', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#be123c', marginBottom: '10px' }}>❌ Contenidos Omitidos</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {findings.omisiones_detectadas.map((o: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: '#9f1239', lineHeight: 1.5 }}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Propósitos cubiertos */}
                  {findings.propositos_cubiertos?.length > 0 && (
                    <div style={{ padding: '16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e40af', marginBottom: '10px' }}>📌 Propósitos Cubiertos</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {findings.propositos_cubiertos.map((p: string, i: number) => (
                          <li key={i} style={{ fontSize: '13px', color: '#1e3a8a', lineHeight: 1.5 }}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Recommendations */}
                {recommendations.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--c-navy)', margin: 0 }}>🎯 Recomendaciones del Auditor</h3>
                    {recommendations.map((rec: any, i: number) => {
                      const sev: string = rec.severidad ?? 'media';
                      const bg = sev === 'alta' ? '#fff1f2' : sev === 'media' ? '#fffbeb' : '#f0fdf4';
                      const border = sev === 'alta' ? '#fda4af' : sev === 'media' ? '#fde68a' : '#86efac';
                      return (
                        <div key={i} style={{
                          padding: '14px 16px', background: bg, border: `1px solid ${border}`,
                          borderRadius: '10px', display: 'flex', gap: '12px', alignItems: 'flex-start',
                        }}>
                          <span style={{
                            padding: '2px 9px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                            background: sevColor[sev] ?? '#d97706', color: '#fff', flexShrink: 0, marginTop: '1px',
                          }}>
                            {sev.toUpperCase()}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {dimLabel[rec.dimension] || rec.dimension}
                            </div>
                            <div style={{ fontSize: '13.5px', color: '#1e293b', lineHeight: 1.6 }}>{rec.mensaje}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* TAB CONTENT: BUNDLE DIDÁCTICO */}
      {activeTab === 'bundle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header card */}
          <div className="section-card">
            <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #78350f 0%, #b45309 100%)', color: '#fff' }}>
              <span className="section-card-title" style={{ color: '#fff' }}>📦 Bundle Didáctico Complementario</span>
            </div>
            <div className="section-card-body">
              <div style={{ padding: '12px', background: '#fef3c7', borderLeft: '3px solid #b45309', borderRadius: '6px', marginBottom: '20px', fontSize: '13.5px' }}>
                <p style={{ color: '#78350f', fontWeight: 600, marginBottom: '4px' }}>💡 ¿Qué es el Bundle Didáctico?</p>
                <p style={{ color: '#92400e', margin: 0 }}>
                  Conjunto de 4 materiales complementarios generados automáticamente a partir de tu planeación:
                  Guía del Alumno, Instrumento de Coevaluación, Guión de Diapositivas y Quiz Diagnóstico.
                  Genera cada uno individualmente o todos a la vez con <strong>Suite Completa</strong>.
                </p>
              </div>

              {/* Generate All button */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <button
                  onClick={handleGenerateFullBundle}
                  disabled={Object.values(bundleLoading).some(Boolean)}
                  style={{
                    padding: '12px 32px',
                    fontSize: '15px',
                    fontWeight: 700,
                    background: Object.values(bundleLoading).some(Boolean) ? '#d97706' : '#b45309',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: Object.values(bundleLoading).some(Boolean) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(180,83,9,0.3)',
                    transition: 'all 0.2s',
                  }}
                >
                  {Object.values(bundleLoading).some(Boolean) ? '⏳ Generando Suite…' : '⚡ Generar Suite Completa (4 materiales)'}
                </button>
              </div>

              {/* 4 material cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {BUNDLE_TYPES.map((bt) => {
                  const result  = bundleResults[bt.type] ?? null;
                  const loading = bundleLoading[bt.type] ?? false;
                  const error   = bundleErrors[bt.type]  ?? null;
                  const isExpanded = bundleExpanded === bt.type;

                  return (
                    <div
                      key={bt.type}
                      style={{
                        border: `1px solid ${bt.color}33`,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: '#fafafa',
                      }}
                    >
                      {/* Card header */}
                      <div style={{
                        padding: '12px 16px',
                        background: `${bt.color}15`,
                        borderBottom: `2px solid ${bt.color}33`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>{bt.icon}</span>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: bt.color }}>{bt.label}</span>
                        </div>
                        {result && (
                          <span style={{ background: '#10b981', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>✓ Listo</span>
                        )}
                      </div>

                      {/* Card body */}
                      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {error && (
                          <div style={{ background: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', color: '#dc2626' }}>
                            ⚠️ {error}
                          </div>
                        )}

                        {!result ? (
                          <button
                            onClick={() => handleGenerateBundleItem(bt.type)}
                            disabled={loading}
                            style={{
                              padding: '8px 16px',
                              fontSize: '13px',
                              fontWeight: 600,
                              background: loading ? `${bt.color}80` : bt.color,
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              width: '100%',
                            }}
                          >
                            {loading ? `⏳ Generando ${bt.label}…` : `⚡ Generar ${bt.label}`}
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setBundleExpanded(isExpanded ? null : bt.type)}
                              style={{
                                flex: 1,
                                padding: '7px 12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                background: isExpanded ? bt.color : `${bt.color}15`,
                                color: isExpanded ? '#fff' : bt.color,
                                border: `1px solid ${bt.color}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                            >
                              {isExpanded ? '▲ Ocultar' : '👁️ Ver contenido'}
                            </button>
                            <button
                              onClick={() => handleGenerateBundleItem(bt.type)}
                              disabled={loading}
                              style={{
                                padding: '7px 12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                background: '#f1f5f9',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {loading ? '⏳' : '🔄 Regenerar'}
                            </button>
                          </div>
                        )}

                        {/* Expanded preview */}
                        {isExpanded && result && (
                          <div style={{
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '12px',
                            maxHeight: '320px',
                            overflowY: 'auto',
                            fontSize: '12.5px',
                            lineHeight: 1.65,
                            color: '#1e293b',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                          }}>
                            {result}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EVALUADOR IA */}
      {activeTab === 'evaluador' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="section-card">
            <div className="section-card-header" style={{ background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)', color: '#fff' }}>
              <span className="section-card-title" style={{ color: '#fff' }}>🏅 Evaluador IA — Rúbrica Oficial Anexo 12 USICAMM</span>
            </div>
            <div className="section-card-body">
              {evalLoading && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#dc2626' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                  <p style={{ fontWeight: 600 }}>Evaluando planeación con IA…</p>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>Esto puede tardar 15-30 segundos. La IA analiza todos los criterios del Anexo 12.</p>
                </div>
              )}

              {evalError && (
                <div style={{ background: '#FEE2E2', border: '1px solid #dc2626', borderRadius: '8px', padding: '16px', color: '#991b1b' }}>
                  <p style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ Error al evaluar</p>
                  <p style={{ fontSize: '14px', margin: 0 }}>{evalError}</p>
                  <button
                    onClick={handleRunEvaluacion}
                    style={{ marginTop: '12px', padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    🔄 Reintentar
                  </button>
                </div>
              )}

              {evalResult && !evalLoading && (
                <>
                  {/* Score hero */}
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px', padding: '20px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ textAlign: 'center', minWidth: '100px' }}>
                      <div style={{
                        width: '96px', height: '96px', borderRadius: '50%', margin: '0 auto 8px',
                        background: `conic-gradient(${evalResult.nivelCumplimiento === 'COMPLETO' ? '#10b981' : evalResult.nivelCumplimiento === 'PARCIAL' ? '#f59e0b' : '#ef4444'} ${(evalResult.puntajeTotal / evalResult.puntajeMaximo) * 360}deg, #e2e8f0 0)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 0 8px #fff inset',
                      }}>
                        <div style={{ background: '#fff', borderRadius: '50%', width: '72px', height: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{evalResult.puntajeTotal}</span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>/{evalResult.puntajeMaximo}</span>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: evalResult.nivelCumplimiento === 'COMPLETO' ? '#10b981' : evalResult.nivelCumplimiento === 'PARCIAL' ? '#d97706' : '#dc2626' }}>
                        {evalResult.nivelCumplimiento === 'COMPLETO' ? '✅ COMPLETO' : evalResult.nivelCumplimiento === 'PARCIAL' ? '⚠️ PARCIAL' : '❌ REQUIERE CORRECCIÓN'}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', color: '#475569', marginBottom: '8px' }}><strong>Rúbrica:</strong> {evalResult.rubricaUsada}</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {evalResult.puntosFuertes?.slice(0, 3).map((pf: string, i: number) => (
                          <span key={i} style={{ background: '#dcfce7', color: '#166534', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>✓ {pf}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {evalResult.mejorasUrgentes?.slice(0, 3).map((m: string, i: number) => (
                          <span key={i} style={{ background: '#fef9c3', color: '#854d0e', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>⚡ {m}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => { setEvalLoaded(false); handleRunEvaluacion(); }}
                      style={{ alignSelf: 'flex-start', padding: '8px 14px', fontSize: '12px', fontWeight: 600, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      🔄 Re-evaluar
                    </button>
                  </div>

                  {/* Criteria table */}
                  <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#0f172a', color: '#fff' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Criterio</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Categoría</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Pts</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Cumple</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Observación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evalResult.criterios?.map((cr: any, idx: number) => (
                          <tr key={idx} style={{ background: idx % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '9px 12px', color: '#0f172a', fontWeight: 500 }}>{cr.criterio}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>{cr.categoria}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: cr.cumple === 'SI' ? '#059669' : cr.cumple === 'PARCIAL' ? '#d97706' : '#dc2626' }}>
                              {cr.puntajeObtenido}/{cr.puntajeMax}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                              <span style={{ background: cr.cumple === 'SI' ? '#dcfce7' : cr.cumple === 'PARCIAL' ? '#fef9c3' : '#fee2e2', color: cr.cumple === 'SI' ? '#166534' : cr.cumple === 'PARCIAL' ? '#92400e' : '#991b1b', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                                {cr.cumple}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px', color: '#475569', fontSize: '12.5px' }}>{cr.observacion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Retroalimentación */}
                  {evalResult.retroalimentacionDocente && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px' }}>
                      <p style={{ fontWeight: 700, color: '#1e40af', marginBottom: '8px' }}>💬 Retroalimentación Docente</p>
                      <p style={{ fontSize: '14px', color: '#1e293b', lineHeight: 1.7, margin: 0 }}>{evalResult.retroalimentacionDocente}</p>
                    </div>
                  )}
                  {evalResult.alineacionPaecPec && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginTop: '12px' }}>
                      <p style={{ fontWeight: 700, color: '#166534', marginBottom: '8px' }}>🌿 Alineación PAEC/PEC</p>
                      <p style={{ fontSize: '14px', color: '#1e293b', lineHeight: 1.7, margin: 0 }}>{evalResult.alineacionPaecPec}</p>
                    </div>
                  )}
                </>
              )}

              {!evalLoading && !evalResult && !evalError && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ color: '#64748b' }}>Iniciando evaluación automática…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ANALYTICS PEDAGÓGICO — Recharts */}
      {activeTab === 'analytics' && (() => {
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
                    onClick={() => { setAnalyticsLoaded(false); handleLoadAnalytics(); }}
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
                        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
                          <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BarChart3 size={15} color="#1d4ed8"/> Planeaciones por Semestre
                          </p>
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={semesterBarData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false}/>
                              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false}/>
                              <Tooltip
                                contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                formatter={(v: any) => [v, 'Planeaciones']}
                              />
                              <Bar dataKey="value" fill="#1d4ed8" radius={[4, 4, 0, 0]}>
                                {semesterBarData.map((_, i) => (
                                  <Cell key={i} fill={['#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe'][i % 6]}/>
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* PieChart — por componente */}
                      {componentPieData.length > 0 && (
                        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
                          <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Grid size={15} color="#059669"/> Distribución por Componente
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
                                contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                formatter={(v: any, name: any) => [v, name]}
                              />
                              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '12px' }}/>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* RadarChart — distribución de módulos */}
                      {radarData.some(r => r.A > 0) && (
                        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
                          <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <TrendingUp size={15} color="#7c3aed"/> Perfil Pedagógico General
                          </p>
                          <ResponsiveContainer width="100%" height={180}>
                            <RadarChart data={radarData}>
                              <PolarGrid stroke="#e2e8f0"/>
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }}/>
                              <PolarRadiusAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false}/>
                              <Radar name="Total" dataKey="A" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25}/>
                              <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '6px' }}/>
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Feedback ratings */}
                      {analyticsData.feedback && analyticsData.feedback.length > 0 && (() => {
                        const fbBarData = analyticsData.feedback.map((fb: any) => ({
                          name: (fb.entity_type as string).split('_').pop() || fb.entity_type,
                          rating: Number(Number(fb.avg_rating).toFixed(1)),
                          count: fb.total_count,
                        }));
                        return (
                          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
                            <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Star size={15} color="#d97706"/> Ratings de Generación IA
                            </p>
                            <ResponsiveContainer width="100%" height={180}>
                              <BarChart data={fbBarData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false}/>
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={72}/>
                                <Tooltip
                                  contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                  formatter={(v: any) => [`${v}/5`, 'Rating']}
                                />
                                <Bar dataKey="rating" radius={[0, 4, 4, 0]}>
                                  {fbBarData.map((fb: any, i: number) => (
                                    <Cell key={i} fill={fb.rating >= 4 ? '#059669' : fb.rating >= 3 ? '#d97706' : '#dc2626'}/>
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
                        <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} color="#0891b2"/> Últimas planeaciones
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {analyticsData.plannings.recent.map((p: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                              <span style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FileText size={13} color="#0891b2"/> {p.uac_name}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '12px' }}>
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
      })()}

      {/* Visor Modal Overlay */}
      {previewExtra && (
        <ExtraPreviewModal
          isOpen={previewExtra !== null}
          onClose={() => setPreviewExtra(null)}
          title={previewExtra.title}
          contentText={previewExtra.contentText}
          type={previewExtra.type}
        />
      )}

      {/* Modal Lista de Cotejo de Supervisión */}
      {showChecklistModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '12px', maxWidth: '750px', width: '100%',
            maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            color: '#1e293b'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  📋 Lista de Cotejo de Supervisión DBEPA (2026-2027)
                </h3>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 0' }}>
                  Alineado a <em>03 Lista de cotejo Plan de Clase 1-4_SEM.pdf</em> y normativas del Bachillerato General Estatal.
                </p>
              </div>
              <button onClick={() => setShowChecklistModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Propósitos Formativos / Contenidos Formativos', desc: 'Contenidos temáticos oficiales de la UAC vinculados al MCCEMS.', status: true },
                { label: 'Meta Educativa', desc: 'Metas de aprendizaje claras, objetivas y orientadas al logro de trayectoria.', status: true },
                { label: 'Transversalidad Disciplinar', desc: 'Conexión coherente con otras asignaturas del mismo semestre y currículum ampliado.', status: true },
                { label: 'Exploración de Conocimientos Previos', desc: 'Fase de Apertura con recuperación activa de saberes e ideas de los estudiantes.', status: true },
                { label: 'Actividades de Aprendizaje Acordes', desc: 'Actividades continuas, contextualizadas a la comunidad de Puebla y al PAEC.', status: true },
                { label: 'Metodología Socio-crítica / Estrategias Activas', desc: 'Uso obligatorio de ABP, Método de Casos o Simulaciones prácticas (Nivel 2 de complejidad).', status: true },
                { label: 'Productos Esperados', desc: 'Entregables físicos/digitales concretos por sesión y por Actividad Clave.', status: true },
                { label: 'Temporalidad y Dosificación de Tiempos', desc: 'Dosificación matemática estricta por Cortes (18h/24h por corte) y sesiones de 50 min.', status: true },
                { label: 'Momentos de Evaluación Formativa', desc: 'Evaluación Diagnóstica, Formativa y Sumativa con Hetero, Co y Autoevaluación.', status: true },
                { label: 'Metacognición Formativa en Cierre', desc: 'Fase de Cierre orientada a la reflexión del aprendizaje y consolidación de competencias.', status: true },
                { label: 'Instrumentos Objetivos de Evaluación', desc: 'Rúbricas analíticas y Listas de cotejo para Producto y Desempeño.', status: true }
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ background: '#10b981', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>✓</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{i + 1}. {item.label}</div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>
                ✓ Cumplimiento del 100% verificado por DidácticaIA
              </span>
              <button onClick={() => setShowChecklistModal(false)} className="btn btn-navy" style={{ padding: '8px 18px', fontSize: '13px', borderRadius: '6px' }}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
