'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PipsProject, PipsPlantele, PipsCronogramaActividad } from '@/types/pips';
import { SCHOOL_YEAR } from '@/lib/config';
import ExcelUploadZone from '@/components/cartografia/ExcelUploadZone';

// ─── Step labels ──────────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: 'Datos de la Zona' },
  { n: 2, label: 'Presentación' },
  { n: 3, label: 'Directorio de Escuelas' },
  { n: 4, label: 'Diagnóstico Territorial' },
  { n: 5, label: 'Objetivos y Metas' },
  { n: 6, label: 'Cronograma y Cierre' },
];

// ─── Default PIPS object ─────────────────────────────────────────────────────
function defaultPips(): Partial<PipsProject> {
  return {
    zona_clave: '21FMS0020X',
    zona_nombre: 'Zona Escolar 004',
    supervisor_name: 'Ing. Alejandro Escamilla Martínez',
    municipio_sede: 'Lázaro Cárdenas, Venustiano Carranza, Puebla',
    municipios_atiende: 'Venustiano Carranza, Francisco Z. Mena, Pantepec y Jalpan',
    num_planteles: 17,
    subsistema: 'BGE',
    modalidad: 'Escolarizada',
    ciclo_escolar: SCHOOL_YEAR,
    atps: 'Ing. Samuel Cruz Interial, Imelda Hernández García, Víctor Manuel Sáenz Cuellar, Lilia Castillo Leyva',
    presentacion_supervisor: '',
    pips_anterior_realizado: true,
    reflexion_pips_anterior: '',
    fortalezas_anterior: '',
    areas_oportunidad_anterior: '',
    planteles_json: [],
    diagnostico_contexto: '',
    problematicas_json: [],
    objetivo_general: '',
    objetivos_especificos_json: [],
    cronograma_json: [],
    evaluacion_json: [],
    current_step: 1,
    status: 'draft',
  };
}

// ─── Input / Textarea helpers ─────────────────────────────────────────────────
const inp = (
  label: string,
  value: string | number,
  onChange: (v: string) => void,
  opts: { type?: string; rows?: number; placeholder?: string; required?: boolean } = {}
) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)' }}>
      {label}{opts.required && <span style={{ color: '#ef4444' }}> *</span>}
    </label>
    {opts.rows ? (
      <textarea
        rows={opts.rows}
        placeholder={opts.placeholder}
        value={String(value)}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--c-text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
      />
    ) : (
      <input
        type={opts.type ?? 'text'}
        placeholder={opts.placeholder}
        value={String(value)}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--c-text)', fontSize: 13, fontFamily: 'inherit' }}
      />
    )}
  </div>
);

// ─── Main Wizard Component ────────────────────────────────────────────────────
export default function PipsWizard({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingId = searchParams.get('id');

  const [pips, setPips] = useState<Partial<PipsProject>>(defaultPips());
  const [projectId, setProjectId] = useState<string | null>(existingId);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');
  const [newPlantele, setNewPlantele] = useState<PipsPlantele>({ no: 1, cct: '', nombre: '', localidad: '', municipio: '', hombres: 0, mujeres: 0, total: 0 });

  // Estados de Previsualización y Modales (Paso 2, 3 y 5)
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvParsed, setCsvParsed] = useState<{
    no: number;
    cct: string;
    nombre: string;
    localidad: string;
    municipio: string;
    hombres: number;
    mujeres: number;
    total: number;
    isValidCct: boolean;
  }[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [cctSearching, setCctSearching] = useState(false);
  const [cctWarning, setCctWarning] = useState<string | null>(null);

  // Autocompletado de CCT mediante el catálogo de Puebla
  const handleCctLookup = async (cctInput: string) => {
    const clean = cctInput.trim().toUpperCase();
    if (!clean || clean.length < 7) {
      setCctWarning(null);
      return;
    }
    setCctSearching(true);
    setCctWarning(null);
    try {
      const res = await fetch(`/api/admin/catalogo-escuelas?cct=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (res.ok && data.success && data.escuela) {
        setNewPlantele(prev => ({
          ...prev,
          cct: data.escuela.cct || clean,
          nombre: data.escuela.nombre || prev.nombre,
          municipio: data.escuela.municipio || prev.municipio,
          localidad: data.escuela.localidad || prev.localidad,
        }));
        setCctWarning(null);
      } else {
        setCctWarning('CCT no encontrado en el catálogo de Puebla');
      }
    } catch {
      setCctWarning('Error de conexión al consultar el catálogo');
    } finally {
      setCctSearching(false);
    }
  };

  // Parser para Importador CSV
  const parseCsvContent = (content: string) => {
    setCsvError(null);
    const lines = content.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) {
      setCsvError('El archivo CSV está vacío');
      setCsvParsed([]);
      return;
    }

    const firstLine = lines[0];
    const sep = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';
    const header = firstLine.split(sep).map(h => h.trim().toLowerCase().replace(/["']/g, ''));

    let nombreIdx = header.findIndex(h => h.includes('nombre') || h.includes('plantel') || h.includes('escuela'));
    let cctIdx = header.findIndex(h => h === 'cct' || h.includes('clave'));
    let hIdx = header.findIndex(h => h.includes('matricula_h') || h.includes('hombres') || h.includes('hom') || h === 'h');
    let mIdx = header.findIndex(h => h.includes('matricula_m') || h.includes('mujeres') || h.includes('muj') || h === 'm');

    // Por defecto asumir [nombre, cct, matricula_h, matricula_m]
    if (nombreIdx === -1 && cctIdx === -1) {
      nombreIdx = 0;
      cctIdx = 1;
      hIdx = 2;
      mIdx = 3;
    }

    const rows: typeof csvParsed = [];
    const startIndex = (lines[0].toLowerCase().includes('nombre') || lines[0].toLowerCase().includes('cct')) ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(sep).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) continue;

      const rawNombre = parts[nombreIdx] || `Plantel ${rows.length + 1}`;
      const rawCct = (parts[cctIdx] || '').toUpperCase();
      const hVal = parseInt(parts[hIdx] || '0', 10) || 0;
      const mVal = parseInt(parts[mIdx] || '0', 10) || 0;
      const isValidCct = /^[0-9]{2}[A-Z0-9]{8}$/i.test(rawCct) || rawCct.startsWith('21');

      rows.push({
        no: rows.length + 1,
        cct: rawCct,
        nombre: rawNombre,
        localidad: '',
        municipio: '',
        hombres: hVal,
        mujeres: mVal,
        total: hVal + mVal,
        isValidCct,
      });
    }

    if (rows.length === 0) {
      setCsvError('No se encontraron registros de escuelas válidos en el CSV');
    }
    setCsvParsed(rows);
  };

  const confirmCsvImport = () => {
    if (csvParsed.length === 0) return;
    const currentList = pips.planteles_json ?? [];
    const startNo = currentList.length + 1;
    const mappedToImport: PipsPlantele[] = csvParsed.map((r, idx) => ({
      no: startNo + idx,
      cct: r.cct,
      nombre: r.nombre,
      localidad: r.localidad || 'Puebla',
      municipio: r.municipio || 'Venustiano Carranza',
      hombres: r.hombres,
      mujeres: r.mujeres,
      total: r.total,
    }));

    const combined = [...currentList, ...mappedToImport];
    set('planteles_json', combined);
    set('num_planteles', combined.length);
    setShowCsvModal(false);
    setCsvText('');
    setCsvParsed([]);
  };

  // Load existing project
  useEffect(() => {
    if (existingId) {
      fetch(`/api/pips/${existingId}`)
        .then(r => r.json())
        .then(data => {
          if (data.project) {
            setPips(data.project as Partial<PipsProject>);
            setStep(Math.min((data.project.current_step as number) || 1, 6));
          }
        });
    }
  }, [existingId]);

  const set = (key: keyof PipsProject, value: unknown) =>
    setPips(prev => ({ ...prev, [key]: value }));

  // Save/update project
  const save = useCallback(async (nextStep: number, finalStatus = 'draft') => {
    setSaving(true);
    const payload = { ...pips, current_step: nextStep, status: finalStatus };

    try {
      if (projectId) {
        await fetch(`/api/pips/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        const res = await fetch('/api/pips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.project?.id) {
          setProjectId(data.project.id as string);
          router.replace(`/${locale}/pips/nuevo?id=${data.project.id as string}`);
        }
      }
    } finally {
      setSaving(false);
    }
  }, [pips, projectId, locale, router]);

  const next = async () => {
    const ns = Math.min(step + 1, 6);
    await save(ns);
    setStep(ns);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prev = () => {
    setStep(s => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // AI Generation
  const generate = async () => {
    if (!projectId) { setMsg('Guarda el proyecto primero.'); return; }
    setGenerating(true);
    setMsg('');
    try {
      const res = await fetch(`/api/pips/${projectId}/generate`, { method: 'POST' });
      const data = await res.json();
      if (data.content) {
        set('generated_content', data.content);
        await save(6, 'completed');
        setMsg('✅ PIPS generado con éxito. Puedes descargarlo como Word.');
      } else {
        setMsg('Error al generar el contenido. Intenta de nuevo.');
      }
    } catch {
      setMsg('Error de conexión. Intenta de nuevo.');
    } finally {
      setGenerating(false);
    }
  };

  const [generatingMomento, setGeneratingMomento] = useState<string | null>(null);

  const generateMomento = async (momentoNum: '3' | '4' | '5' | 'memoria') => {
    let currentId = projectId;
    setGeneratingMomento(momentoNum);
    setMsg('');
    try {
      if (!currentId) {
        const res = await fetch('/api/pips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...pips, current_step: step, status: 'draft' }),
        });
        const data = await res.json();
        if (data.project?.id) {
          currentId = data.project.id as string;
          setProjectId(currentId);
          router.replace(`/${locale}/pips/nuevo?id=${currentId}`);
        } else {
          throw new Error('No se pudo inicializar el proyecto para generar el momento.');
        }
      } else {
        await fetch(`/api/pips/${currentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...pips, current_step: step }),
        });
      }

      setMsg(`✨ Generando Momento ${momentoNum} con IA (DBEPA Puebla)...`);
      const res = await fetch(`/api/pips/${currentId}/cartografia/generate-momento?momento=${momentoNum}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Error al generar el Momento ${momentoNum}`);
      }

      if (momentoNum === '3') {
        set('momento3_ubicar', data.data);
        if (data.data.descripcionTerritorial) {
          const prevDiag = pips.diagnostico_contexto ? `${pips.diagnostico_contexto}\n\n` : '';
          set('diagnostico_contexto', `${prevDiag}${data.data.descripcionTerritorial}\n\nMovilidad y Conectividad:\n${data.data.movilidadTransporte}\n${data.data.conectividadInfraestructura}`);
        }
      } else if (momentoNum === '4') {
        set('momento4_analizar', data.data);
      } else if (momentoNum === '5') {
        set('momento5_decidir', data.data);
        if (data.data.metaGeneralZona) {
          set('objetivo_general', data.data.metaGeneralZona);
        }
      } else if (momentoNum === 'memoria') {
        set('memoria_pedagogica', data.data);
      }

      setMsg(`✅ Momento ${momentoNum === 'memoria' ? 'Memoria Pedagógica' : momentoNum} generado y persistido con éxito.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al generar momento con IA';
      setMsg(`❌ ${message}`);
    } finally {
      setGeneratingMomento(null);
    }
  };

  // ─── Render steps ────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: 'var(--c-surface)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '28px 32px',
    marginBottom: 24,
  };

  const sectionTitle = (t: string) => (
    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {t}
    </h3>
  );

  // ── Step 1 ── Datos generales
  const step1 = (
    <div style={cardStyle}>
      {sectionTitle('Datos generales de la supervisión')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        {inp('Clave de zona escolar *', pips.zona_clave ?? '', v => set('zona_clave', v), { required: true, placeholder: 'ej. 21FMS0020X' })}
        {inp('Nombre de la zona *', pips.zona_nombre ?? '', v => set('zona_nombre', v), { required: true })}
        {inp('Nombre del supervisor *', pips.supervisor_name ?? '', v => set('supervisor_name', v), { required: true })}
        {inp('Municipio sede', pips.municipio_sede ?? '', v => set('municipio_sede', v), { placeholder: 'ej. Lázaro Cárdenas, Venustiano Carranza' })}
        {inp('Municipios que atiende', pips.municipios_atiende ?? '', v => set('municipios_atiende', v), { placeholder: 'ej. Venustiano Carranza, Francisco Z. Mena...' })}
        {inp('Número de planteles', pips.num_planteles ?? 1, v => set('num_planteles', parseInt(v) || 1), { type: 'number' })}
        {inp('Tipo de subsistema', pips.subsistema ?? '', v => set('subsistema', v), { placeholder: 'ej. BGE, BD, COBACH' })}
        {inp('Modalidad', pips.modalidad ?? '', v => set('modalidad', v), { placeholder: 'ej. Escolarizada' })}
        {inp('Ciclo escolar', pips.ciclo_escolar ?? '', v => set('ciclo_escolar', v), { placeholder: `ej. ${SCHOOL_YEAR}` })}
      </div>
      {inp('Personal ATP (nombres separados por coma)', pips.atps ?? '', v => set('atps', v), { rows: 2, placeholder: 'ej. Juan Pérez, María González...' })}
    </div>
  );

  // ── Step 2 ── Presentación del supervisor
  const step2 = (
    <div style={cardStyle}>
      {sectionTitle('Presentación del supervisor escolar')}
      <p style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 16 }}>
        Escribe una presentación curricular del supervisor: formación académica, experiencia en el subsistema, logros relevantes y visión pedagógica.
      </p>
      {inp('Presentación del supervisor', pips.presentacion_supervisor ?? '', v => set('presentacion_supervisor', v), {
        rows: 8,
        placeholder: 'El Ing. / Lic. / Dr. [nombre] es egresado de... Desde [año] ejerce como supervisor de la Zona [No.]...',
      })}
    </div>
  );

  const planteles = pips.planteles_json ?? [];
  const totalHombres = planteles.reduce((sum, p) => sum + (Number(p.hombres) || 0), 0);
  const totalMujeres = planteles.reduce((sum, p) => sum + (Number(p.mujeres) || 0), 0);
  const granTotalAlumnos = planteles.reduce((sum, p) => sum + (Number(p.total) || (Number(p.hombres) || 0) + (Number(p.mujeres) || 0)), 0);

  // ── Step 3 ── Directorio de Escuelas y Reflexión PIPS anterior
  const step3 = (
    <>
      {/* Directorio de Escuelas y Concentrado Zonal */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            {sectionTitle('Directorio de Escuelas y Concentrado Zonal')}
            <p style={{ fontSize: 13, color: 'var(--c-text-muted)', margin: '4px 0 0' }}>
              Concentrado oficial de planteles adscritos a la zona escolar con desglose de matrícula.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowExcelUpload(prev => !prev)}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px', background: '#059669', borderColor: '#047857', color: '#ffffff', fontWeight: 700 }}
            >
              📊 Cargar Excel (911.7G / F11C)
            </button>
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
            >
              📋 Exportar vista previa
            </button>
            <button
              type="button"
              onClick={() => setShowCsvModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
            >
              📥 Importar directorio desde CSV
            </button>
          </div>
        </div>

        {/* Asistente de Carga Excel Interactivo (Formato 911.7G / F11C / DBEPA) */}
        {showExcelUpload && (
          <div style={{ margin: '16px 0' }}>
            <ExcelUploadZone
              zonaNumero={pips.zona_nombre?.replace(/[^0-9]/g, '') || '004'}
              cicloEscolar={pips.ciclo_escolar || SCHOOL_YEAR}
              onDataInjected={({ planteles: importedPlanteles, diagnosticoText }) => {
                set('planteles_json', importedPlanteles);
                set('num_planteles', importedPlanteles.length);
                if (diagnosticoText && (!pips.diagnostico_contexto || pips.diagnostico_contexto.length < 50)) {
                  set('diagnostico_contexto', diagnosticoText);
                }
                setShowExcelUpload(false);
                setMsg(`✅ Se importaron exitosamente ${importedPlanteles.length} planteles desde la matriz oficial de Excel.`);
              }}
              onClose={() => setShowExcelUpload(false)}
            />
          </div>
        )}

        {/* KPI resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, margin: '16px 0' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--c-text-muted)', textTransform: 'uppercase' }}>Planteles</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8', marginTop: 2 }}>{planteles.length}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--c-text-muted)', textTransform: 'uppercase' }}>Hombres</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>{totalHombres}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--c-text-muted)', textTransform: 'uppercase' }}>Mujeres</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f472b6', marginTop: 2 }}>{totalMujeres}</div>
          </div>
          <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#818cf8', textTransform: 'uppercase', fontWeight: 600 }}>Total Zonal</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>{granTotalAlumnos}</div>
          </div>
        </div>

        {/* Tabla Concentrado Zonal */}
        {planteles.length > 0 ? (
          <div style={{ overflowX: 'auto', marginBottom: 16, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(99,102,241,0.2)' }}>
                  <th style={{ padding: '8px', textAlign: 'center', color: '#c7d2fe', fontWeight: 700 }}>No.</th>
                  <th style={{ padding: '8px', textAlign: 'left', color: '#c7d2fe', fontWeight: 700 }}>Nombre del Plantel</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: '#c7d2fe', fontWeight: 700 }}>CCT</th>
                  <th style={{ padding: '8px', textAlign: 'left', color: '#c7d2fe', fontWeight: 700 }}>Localidad</th>
                  <th style={{ padding: '8px', textAlign: 'left', color: '#c7d2fe', fontWeight: 700 }}>Municipio</th>
                  <th style={{ padding: '8px', textAlign: 'right', color: '#38bdf8', fontWeight: 700 }}>Matrícula H</th>
                  <th style={{ padding: '8px', textAlign: 'right', color: '#f472b6', fontWeight: 700 }}>Matrícula M</th>
                  <th style={{ padding: '8px', textAlign: 'right', color: '#4ade80', fontWeight: 800 }}>Total</th>
                  <th style={{ padding: '8px', textAlign: 'center', color: '#c7d2fe' }}></th>
                </tr>
              </thead>
              <tbody>
                {planteles.map((pl, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--c-text-muted)' }}>{pl.no || i + 1}</td>
                    <td style={{ padding: '7px 8px', fontWeight: 600, color: 'var(--c-text)' }}>{pl.nombre}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#818cf8', fontWeight: 600 }}>{pl.cct}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--c-text-muted)' }}>{pl.localidad || '—'}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--c-text-muted)' }}>{pl.municipio || '—'}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#38bdf8' }}>{pl.hombres}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#f472b6' }}>{pl.mujeres}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: '#4ade80' }}>{pl.total || (pl.hombres + pl.mujeres)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = planteles.filter((_, idx) => idx !== i);
                          set('planteles_json', updated);
                          set('num_planteles', updated.length);
                        }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}
                        title="Eliminar plantel"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(99,102,241,0.15)', borderTop: '2px solid rgba(99,102,241,0.3)', fontWeight: 800 }}>
                  <td colSpan={5} style={{ padding: '8px 12px', textAlign: 'right', color: '#ffffff', textTransform: 'uppercase' }}>
                    Concentrado Total Zonal:
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#38bdf8' }}>{totalHombres}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#f472b6' }}>{totalMujeres}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#4ade80', fontSize: 13 }}>{granTotalAlumnos}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8, padding: '24px', textAlign: 'center', color: 'var(--c-text-muted)', marginBottom: 16 }}>
            No hay planteles agregados en este PIPS. Puedes importar un archivo CSV o agregar escuelas individualmente.
          </div>
        )}

        {/* Formulario individual con Autocompletado CCT */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text)', margin: 0 }}>➕ Agregar plantel individualmente</p>
            {cctSearching && (
              <span style={{ fontSize: 11, color: '#38bdf8' }}>🔍 Buscando en catálogo de Puebla...</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 140px 2fr 1fr 1fr 70px 70px', gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 3 }}>No.</label>
              <input
                type="number"
                value={newPlantele.no}
                onChange={e => setNewPlantele(prev => ({ ...prev, no: parseInt(e.target.value) || 1 }))}
                style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--c-text)', fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 3 }}>CCT</label>
              <input
                type="text"
                value={newPlantele.cct}
                placeholder="21EBH0000X"
                onChange={e => {
                  const val = e.target.value.toUpperCase();
                  setNewPlantele(prev => ({ ...prev, cct: val }));
                  if (val.length >= 10) {
                    handleCctLookup(val);
                  } else {
                    setCctWarning(null);
                  }
                }}
                onBlur={() => {
                  if (newPlantele.cct && newPlantele.cct.length >= 8) {
                    handleCctLookup(newPlantele.cct);
                  }
                }}
                style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: cctWarning ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--c-text)', fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 3 }}>Nombre del plantel</label>
              <input
                type="text"
                value={newPlantele.nombre}
                placeholder="Nombre del Bachillerato"
                onChange={e => setNewPlantele(prev => ({ ...prev, nombre: e.target.value }))}
                style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--c-text)', fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 3 }}>Localidad</label>
              <input
                type="text"
                value={newPlantele.localidad}
                placeholder="Localidad"
                onChange={e => setNewPlantele(prev => ({ ...prev, localidad: e.target.value }))}
                style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--c-text)', fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 3 }}>Municipio</label>
              <input
                type="text"
                value={newPlantele.municipio}
                placeholder="Municipio"
                onChange={e => setNewPlantele(prev => ({ ...prev, municipio: e.target.value }))}
                style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--c-text)', fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 3 }}>Hombres</label>
              <input
                type="number"
                value={newPlantele.hombres}
                onChange={e => {
                  const h = parseInt(e.target.value, 10) || 0;
                  setNewPlantele(prev => ({ ...prev, hombres: h, total: h + prev.mujeres }));
                }}
                style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--c-text)', fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 3 }}>Mujeres</label>
              <input
                type="number"
                value={newPlantele.mujeres}
                onChange={e => {
                  const m = parseInt(e.target.value, 10) || 0;
                  setNewPlantele(prev => ({ ...prev, mujeres: m, total: prev.hombres + m }));
                }}
                style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--c-text)', fontSize: 12 }}
              />
            </div>
          </div>

          {cctWarning && (
            <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              ⚠️ {cctWarning}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                if (!newPlantele.nombre.trim() || !newPlantele.cct.trim()) {
                  alert('Por favor ingresa al menos el CCT y el Nombre del plantel');
                  return;
                }
                const pl = { ...newPlantele, total: newPlantele.hombres + newPlantele.mujeres };
                const updatedList = [...planteles, pl];
                set('planteles_json', updatedList);
                set('num_planteles', updatedList.length);
                setNewPlantele({
                  no: updatedList.length + 1,
                  cct: '',
                  nombre: '',
                  localidad: '',
                  municipio: '',
                  hombres: 0,
                  mujeres: 0,
                  total: 0
                });
                setCctWarning(null);
              }}
              className="btn btn-secondary btn-sm"
            >
              + Agregar plantel al directorio
            </button>
            <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
              Total estimado: <strong>{newPlantele.hombres + newPlantele.mujeres}</strong> alumnos
            </span>
          </div>
        </div>
      </div>

      {/* Reflexión PIPS anterior */}
      <div style={cardStyle}>
        {sectionTitle('Reflexión del PIPS del ciclo anterior')}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)' }}>
            ¿Realizó PIPS en el ciclo escolar anterior?
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            {['Sí', 'No'].map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' }}>
                <input
                  type="radio"
                  checked={opt === 'Sí' ? !!pips.pips_anterior_realizado : !pips.pips_anterior_realizado}
                  onChange={() => set('pips_anterior_realizado', opt === 'Sí')}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
        {pips.pips_anterior_realizado ? (
          <>
            {inp('Reflexión general del PIPS anterior', pips.reflexion_pips_anterior ?? '', v => set('reflexion_pips_anterior', v), {
              rows: 5, placeholder: 'Describe los principales resultados, logros y aprendizajes del PIPS del ciclo anterior...',
            })}
            {inp('Fortalezas identificadas (una por línea)', pips.fortalezas_anterior ?? '', v => set('fortalezas_anterior', v), {
              rows: 4, placeholder: '• Todos los planteles entregaron el PAEC-PEC...\n• Se consolidó el equipo ATP...',
            })}
            {inp('Áreas de oportunidad (una por línea)', pips.areas_oportunidad_anterior ?? '', v => set('areas_oportunidad_anterior', v), {
              rows: 4, placeholder: '• Errores de alineación curricular en el 60% de los planteles...\n• Falta de comités completos...',
            })}
          </>
        ) : (
          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: 16, fontSize: 13, color: 'var(--c-text-muted)' }}>
            <strong style={{ color: '#818cf8' }}>Protocolo Anexo 1 (DBEPA):</strong> Si no realizó PIPS en el ciclo anterior,
            el diagnóstico deberá basarse en al menos 3 problemáticas pedagógicas identificadas durante el ciclo,
            los instrumentos utilizados para detectarlas y los objetivos/metas que se abordaron.
            Registra esa información en el paso de Diagnóstico (paso 4).
          </div>
        )}
      </div>
    </>
  );

  // ── Step 4 ── Diagnóstico y problemáticas
  const step4 = (
    <>
      {/* Contexto */}
      <div style={cardStyle}>
        {sectionTitle('Contexto socioeducativo y diagnóstico')}
        {inp('Descripción del contexto de la zona', pips.diagnostico_contexto ?? '', v => set('diagnostico_contexto', v), {
          rows: 8,
          placeholder: 'Describe el contexto geográfico, socioeconómico y educativo de la zona. Incluye características de los municipios, condiciones de las comunidades, perfil del estudiantado...',
        })}
      </div>

      {/* Problemáticas */}
      <div style={cardStyle}>
        {sectionTitle('Problemáticas pedagógicas detectadas')}
        {(pips.problematicas_json ?? []).map((prob, i) => (
          <div key={prob.id ?? i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14, marginBottom: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--c-text)' }}>Problemática {i + 1}</span>
              <button
                onClick={() => set('problematicas_json', (pips.problematicas_json ?? []).filter((_, idx) => idx !== i))}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}
              >✕ Eliminar</button>
            </div>
            <input
              value={prob.titulo}
              onChange={e => {
                const arr = [...(pips.problematicas_json ?? [])];
                arr[i] = { ...arr[i], titulo: e.target.value };
                set('problematicas_json', arr);
              }}
              placeholder="Título de la problemática"
              style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--c-text)', fontSize: 13 }}
            />
            <textarea
              rows={3}
              value={prob.descripcion}
              onChange={e => {
                const arr = [...(pips.problematicas_json ?? [])];
                arr[i] = { ...arr[i], descripcion: e.target.value };
                set('problematicas_json', arr);
              }}
              placeholder="Descripción detallada de la problemática..."
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--c-text)', fontSize: 13, resize: 'vertical' }}
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>Prioridad:</label>
              {(['alta', 'media', 'baja'] as const).map(p => (
                <label key={p} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, cursor: 'pointer', color: prob.prioridad === p ? (p === 'alta' ? '#ef4444' : p === 'media' ? '#f59e0b' : '#22c55e') : 'var(--c-text-muted)' }}>
                  <input type="radio" checked={prob.prioridad === p} onChange={() => {
                    const arr = [...(pips.problematicas_json ?? [])];
                    arr[i] = { ...arr[i], prioridad: p };
                    set('problematicas_json', arr);
                  }} /> {p.charAt(0).toUpperCase() + p.slice(1)}
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={() => {
            const arr = [...(pips.problematicas_json ?? [])];
            arr.push({ id: Date.now().toString(), titulo: '', descripcion: '', prioridad: 'alta' });
            set('problematicas_json', arr);
          }}
          className="btn btn-secondary btn-sm"
        >
          + Agregar problemática
        </button>
      </div>

      {/* ─── Momento 3: Ubicar (Mapeo Escuela-Territorio) ─── */}
      <div style={{ ...cardStyle, border: '1px solid rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, background: '#0284c7', color: '#fff', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Momento 3 · DBEPA Puebla
            </span>
            <h4 style={{ margin: '6px 0 0', fontSize: 16, color: 'var(--c-text)' }}>
              🗺️ Mapeo Escuela-Territorio y Recursos Comunitarios
            </h4>
          </div>
          <button
            type="button"
            onClick={() => generateMomento('3')}
            disabled={generatingMomento !== null || saving}
            className="btn btn-sm"
            style={{
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {generatingMomento === '3' ? '⏳ Generando Mapeo...' : '✨ Generar Momento 3 con IA'}
          </button>
        </div>

        {pips.momento3_ubicar ? (
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8 }}>
              <strong style={{ color: '#38bdf8' }}>Descripción Territorial:</strong>
              <p style={{ margin: '4px 0 0', color: 'var(--c-text)', lineHeight: 1.5 }}>
                {pips.momento3_ubicar.descripcionTerritorial}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
                <strong style={{ color: '#38bdf8', fontSize: 12 }}>🚌 Movilidad y Transporte:</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--c-text-muted)', fontSize: 12 }}>
                  {pips.momento3_ubicar.movilidadTransporte}
                </p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
                <strong style={{ color: '#38bdf8', fontSize: 12 }}>📡 Conectividad e Infraestructura:</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--c-text-muted)', fontSize: 12 }}>
                  {pips.momento3_ubicar.conectividadInfraestructura}
                </p>
              </div>
            </div>
            {pips.momento3_ubicar.recursosAliados?.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8 }}>
                <strong style={{ color: '#38bdf8', fontSize: 12 }}>🤝 Recursos y Aliados Comunitarios:</strong>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {pips.momento3_ubicar.recursosAliados.map((rec, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'rgba(2, 132, 199, 0.15)',
                        border: '1px solid rgba(2, 132, 199, 0.3)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 11,
                        color: '#bae6fd',
                      }}
                    >
                      🏷️ {rec.nombre} ({rec.tipo}) — {rec.vinculacionPedagogica}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--c-text-muted)', margin: 0 }}>
            Presiona el botón para georreferenciar la relación escuela-territorio, rutas de movilidad y recursos aliados con IA.
          </p>
        )}
      </div>

      {/* ─── Momento 4: Analizar (Triangulación de las 4 Perspectivas) ─── */}
      <div style={{ ...cardStyle, border: '1px solid rgba(168, 85, 247, 0.3)', background: 'rgba(168, 85, 247, 0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, background: '#7e22ce', color: '#fff', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Momento 4 · DBEPA Puebla
            </span>
            <h4 style={{ margin: '6px 0 0', fontSize: 16, color: 'var(--c-text)' }}>
              🔍 Triangulación de Perspectivas y Retos Pedagógicos CREAA
            </h4>
          </div>
          <button
            type="button"
            onClick={() => generateMomento('4')}
            disabled={generatingMomento !== null || saving}
            className="btn btn-sm"
            style={{
              background: '#7e22ce',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {generatingMomento === '4' ? '⏳ Analizando...' : '✨ Generar Momento 4 con IA'}
          </button>
        </div>

        {pips.momento4_analizar ? (
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, borderLeft: '3px solid #c084fc' }}>
                <strong style={{ color: '#c084fc', fontSize: 12 }}>🏛️ Directivos:</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--c-text-muted)', fontSize: 12, lineHeight: 1.4 }}>
                  {pips.momento4_analizar.triangulacion.directivos}
                </p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, borderLeft: '3px solid #c084fc' }}>
                <strong style={{ color: '#c084fc', fontSize: 12 }}>👨‍🏫 Colectivos Docentes:</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--c-text-muted)', fontSize: 12, lineHeight: 1.4 }}>
                  {pips.momento4_analizar.triangulacion.docentes}
                </p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, borderLeft: '3px solid #c084fc' }}>
                <strong style={{ color: '#c084fc', fontSize: 12 }}>👨‍👩‍👧 Alumnos y Familias:</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--c-text-muted)', fontSize: 12, lineHeight: 1.4 }}>
                  {pips.momento4_analizar.triangulacion.alumnosFamilias}
                </p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, borderLeft: '3px solid #c084fc' }}>
                <strong style={{ color: '#c084fc', fontSize: 12 }}>🧭 Supervisión y ATP:</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--c-text-muted)', fontSize: 12, lineHeight: 1.4 }}>
                  {pips.momento4_analizar.triangulacion.supervisionAtp}
                </p>
              </div>
            </div>

            {pips.momento4_analizar.retosPedagogicosCreaa?.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8 }}>
                <strong style={{ color: '#c084fc', fontSize: 12 }}>🎯 Retos Pedagógicos CREAA:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--c-text-muted)', fontSize: 12 }}>
                  {pips.momento4_analizar.retosPedagogicosCreaa.map((r, idx) => (
                    <li key={idx} style={{ marginBottom: 3 }}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--c-text-muted)', margin: 0 }}>
            Aplica la metodología de triangulación para contrastar las 4 voces del territorio (Directores, Docentes, Alumnos y Supervisión).
          </p>
        )}
      </div>
    </>
  );

  // ── Step 5 ── Objetivos y metas
  const step5 = (
    <>
      {/* ─── Momento 5: Decidir (Meta General CREAA + 3 Líneas Oficiales DBEPA) ─── */}
      <div style={{ ...cardStyle, border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, background: '#d97706', color: '#fff', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Momento 5 · DBEPA Puebla
            </span>
            <h4 style={{ margin: '6px 0 0', fontSize: 16, color: 'var(--c-text)' }}>
              🎯 Meta General CREAA y 3 Líneas de Acción Oficiales
            </h4>
          </div>
          <button
            type="button"
            onClick={() => generateMomento('5')}
            disabled={generatingMomento !== null || saving}
            className="btn btn-sm"
            style={{
              background: '#d97706',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {generatingMomento === '5' ? '⏳ Decidiendo...' : '✨ Generar Momento 5 con IA'}
          </button>
        </div>

        {pips.momento5_decidir ? (
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'rgba(217, 119, 6, 0.1)', padding: 12, borderRadius: 8, border: '1px solid rgba(217, 119, 6, 0.2)' }}>
              <strong style={{ color: '#fbbf24' }}>📐 Meta General de Zona (Fórmula Sintáctica CREAA):</strong>
              <p style={{ margin: '4px 0 0', color: 'var(--c-text)', fontWeight: 600, lineHeight: 1.4 }}>
                {pips.momento5_decidir.metaGeneralZona}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <strong style={{ color: '#fbbf24', fontSize: 12 }}>📋 Las 3 Líneas de Acción Oficiales de la DBEPA:</strong>
              {pips.momento5_decidir.lineasAccion?.map((linea, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, color: 'var(--c-text)', fontSize: 12 }}>
                    Línea {linea.numero}: {linea.titulo}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4 }}>
                    <strong>Responsables:</strong> {linea.responsables} | <strong>Entregables:</strong> {linea.entregables}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--c-text-muted)', margin: 0 }}>
            Genera la meta general bajo la fórmula estricta CREAA y las 3 líneas de acción oficiales para el acompañamiento docente y directivo.
          </p>
        )}
      </div>

      <div style={cardStyle}>
        {sectionTitle('Objetivo general del PIPS')}
        {inp('Objetivo general', pips.objetivo_general ?? '', v => set('objetivo_general', v), {
          rows: 4, placeholder: 'Fortalecer la calidad pedagógica de los [N] planteles de la Zona [X] mediante...',
        })}
      </div>
      <div style={cardStyle}>
        {sectionTitle('Objetivos específicos y metas')}
        {(pips.objetivos_especificos_json ?? []).map((obj, i) => (
          <div key={obj.id ?? i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14, marginBottom: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#818cf8' }}>Objetivo {i + 1}</span>
              <button onClick={() => set('objetivos_especificos_json', (pips.objetivos_especificos_json ?? []).filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>
            <input
              value={obj.descripcion}
              onChange={e => {
                const arr = [...(pips.objetivos_especificos_json ?? [])];
                arr[i] = { ...arr[i], descripcion: e.target.value };
                set('objetivos_especificos_json', arr);
              }}
              placeholder="Descripción del objetivo específico"
              style={{ width: '100%', marginBottom: 10, padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'var(--c-text)', fontSize: 13 }}
            />
            <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 8 }}>Metas del objetivo:</p>
            {(obj.metas ?? []).map((meta, j) => (
              <div key={j} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}>
                {(['Meta', 'Indicador', 'Responsable', 'Fecha'] as const).map((field, k) => (
                  <input
                    key={field}
                    value={meta[(['meta', 'indicador', 'responsable', 'fecha'] as const)[k]]}
                    onChange={e => {
                      const arrO = [...(pips.objetivos_especificos_json ?? [])];
                      const arrM = [...(arrO[i].metas ?? [])];
                      arrM[j] = { ...arrM[j], [(['meta', 'indicador', 'responsable', 'fecha'] as const)[k]]: e.target.value };
                      arrO[i] = { ...arrO[i], metas: arrM };
                      set('objetivos_especificos_json', arrO);
                    }}
                    placeholder={field}
                    style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--c-text)', fontSize: 11 }}
                  />
                ))}
                <button onClick={() => {
                  const arrO = [...(pips.objetivos_especificos_json ?? [])];
                  arrO[i] = { ...arrO[i], metas: arrO[i].metas.filter((_, idx) => idx !== j) };
                  set('objetivos_especificos_json', arrO);
                }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
            <button
              onClick={() => {
                const arrO = [...(pips.objetivos_especificos_json ?? [])];
                arrO[i] = { ...arrO[i], metas: [...(arrO[i].metas ?? []), { meta: '', indicador: '', responsable: '', fecha: '' }] };
                set('objetivos_especificos_json', arrO);
              }}
              className="btn btn-sm"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', fontSize: 11, cursor: 'pointer', borderRadius: 6, padding: '4px 10px' }}
            >+ Meta</button>
          </div>
        ))}
        <button
          onClick={() => {
            const arr = [...(pips.objetivos_especificos_json ?? [])];
            arr.push({ id: Date.now().toString(), numero: arr.length + 1, descripcion: '', metas: [] });
            set('objetivos_especificos_json', arr);
          }}
          className="btn btn-secondary btn-sm"
        >+ Agregar objetivo</button>
      </div>
    </>
  );

  // ── Step 6 ── Cronograma y cierre
  const step6 = (
    <>
      <div style={cardStyle}>
        {sectionTitle('Cronograma de actividades')}
        {(pips.cronograma_json ?? []).length > 0 && (
          <div style={{ overflowX: 'auto', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'rgba(99,102,241,0.15)' }}>
                  {['Actividad', 'Objetivo', 'Responsable', 'Mes', 'Recursos', 'Indicador', ''].map(h => (
                    <th key={h} style={{ padding: '6px 8px', color: 'var(--c-text-muted)', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(pips.cronograma_json ?? []).map((act, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {([act.actividad, act.objetivo, act.responsable, act.mes, act.recursos, act.indicador] as string[]).map((v, j) => (
                      <td key={j} style={{ padding: '5px 8px', color: 'var(--c-text)', verticalAlign: 'top' }}>{v}</td>
                    ))}
                    <td><button onClick={() => set('cronograma_json', (pips.cronograma_json ?? []).filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AddCronogramaRow onAdd={(act: PipsCronogramaActividad) => set('cronograma_json', [...(pips.cronograma_json ?? []), act])} />
      </div>

      {/* ─── Memoria Pedagógica Viva (Cierre y Trascendencia) ─── */}
      <div style={{ ...cardStyle, border: '1px solid rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, background: '#15803d', color: '#fff', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Memoria Pedagógica · DBEPA Puebla
            </span>
            <h4 style={{ margin: '6px 0 0', fontSize: 16, color: 'var(--c-text)' }}>
              🌱 Memoria Pedagógica Viva: ¿Qué logramos?, ¿Cómo?, ¿Qué aprendimos?
            </h4>
          </div>
          <button
            type="button"
            onClick={() => generateMomento('memoria')}
            disabled={generatingMomento !== null || saving}
            className="btn btn-sm"
            style={{
              background: '#15803d',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {generatingMomento === 'memoria' ? '⏳ Sistematizando...' : '✨ Generar Memoria con IA'}
          </button>
        </div>

        {pips.memoria_pedagogica ? (
          <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
              <strong style={{ color: '#4ade80', fontSize: 12 }}>¿Qué logramos?</strong>
              <p style={{ margin: '4px 0 0', color: 'var(--c-text)', fontSize: 12, lineHeight: 1.4 }}>{pips.memoria_pedagogica.queLogramos}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
              <strong style={{ color: '#4ade80', fontSize: 12 }}>¿Cómo lo logramos?</strong>
              <p style={{ margin: '4px 0 0', color: 'var(--c-text)', fontSize: 12, lineHeight: 1.4 }}>{pips.memoria_pedagogica.comoLoLogramos}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
              <strong style={{ color: '#4ade80', fontSize: 12 }}>¿Qué aprendimos?</strong>
              <p style={{ margin: '4px 0 0', color: 'var(--c-text)', fontSize: 12, lineHeight: 1.4 }}>{pips.memoria_pedagogica.queAprendimos}</p>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--c-text-muted)', margin: 0 }}>
            Sistematiza el impacto territorial y pedagógico respondiendo a las tres preguntas clave de la DBEPA.
          </p>
        )}
      </div>

      {/* Generar y Descargar */}
      <div style={{ ...cardStyle, textAlign: 'center', border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)' }}>
        {sectionTitle('✅ Generar y Exportar Cartografía de Zona')}
        <p style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 20 }}>
          La Cartografía de Zona Escolar integra los 5 Momentos metodológicos, diagnósticos 911/F11, metas CREAA y la Memoria Pedagógica en formato oficial para entrega ante la DBEPA.
        </p>
        {msg && (
          <div style={{ padding: '10px 16px', borderRadius: 8, background: msg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: msg.startsWith('✅') ? '#22c55e' : '#ef4444', marginBottom: 16, fontSize: 13 }}>
            {msg}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={generate}
            disabled={generating || saving}
            className="btn btn-primary"
            style={{ fontSize: 14, padding: '12px 28px' }}
          >
            {generating ? '⏳ Consolidando...' : '🤖 Consolidar con IA'}
          </button>
          {projectId && (
            <a
              href={`/api/pdf/cartografia/${projectId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{
                background: '#1F3864',
                color: '#fff',
                border: '1.5px solid #E8A020',
                fontSize: 14,
                padding: '12px 24px',
                textDecoration: 'none',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(31, 56, 100, 0.4)',
              }}
            >
              📄 Descargar Cartografía Oficial DBEPA (PDF)
            </a>
          )}
          {projectId && pips.status === 'completed' && (
            <>
              <a
                href={`/api/pdf/pips/${projectId}`}
                className="btn"
                style={{ background: '#c0392b', color: '#fff', border: 'none', fontSize: 14, padding: '12px 28px', textDecoration: 'none', borderRadius: 8, display: 'inline-block', fontWeight: 600 }}
              >
                ↓ Descargar PDF Resumen
              </a>
              <a
                href={`/api/docx/pips/${projectId}`}
                className="btn"
                style={{ background: '#f59e0b', color: '#fff', border: 'none', fontSize: 14, padding: '12px 28px', textDecoration: 'none', borderRadius: 8, display: 'inline-block' }}
              >
                ↓ Descargar Word Oficial
              </a>
            </>
          )}
        </div>
      </div>
    </>
  );

  const stepContent = [step1, step2, step3, step4, step5, step6];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 32, overflowX: 'auto' }}>
        {STEPS.map(s => (
          <div
            key={s.n}
            onClick={() => s.n < step && setStep(s.n)}
            style={{
              flex: 1, minWidth: 80, padding: '10px 8px', borderRadius: 10, textAlign: 'center', cursor: s.n < step ? 'pointer' : 'default',
              background: step === s.n ? 'rgba(99,102,241,0.2)' : s.n < step ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${step === s.n ? 'rgba(99,102,241,0.5)' : s.n < step ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`,
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: 16, marginBottom: 2 }}>
              {s.n < step ? '✅' : step === s.n ? '▶' : '○'}
            </div>
            <div style={{ fontSize: 10, color: step === s.n ? '#818cf8' : s.n < step ? '#22c55e' : 'var(--c-text-muted)', fontWeight: step === s.n ? 700 : 400 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Step content */}
      {stepContent[step - 1]}

      {/* Nav buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button onClick={prev} disabled={step === 1 || saving} className="btn btn-secondary">
          ← Anterior
        </button>
        <span style={{ fontSize: 12, color: 'var(--c-text-muted)', alignSelf: 'center' }}>
          Paso {step} de {STEPS.length}
        </span>
        {step < STEPS.length ? (
          <button onClick={next} disabled={saving} className="btn btn-primary">
            {saving ? 'Guardando…' : 'Siguiente →'}
          </button>
        ) : (
          <button onClick={() => save(6, 'draft')} disabled={saving} className="btn btn-secondary">
            {saving ? 'Guardando…' : '💾 Guardar borrador'}
          </button>
        )}
      </div>

      {/* ── Modal: Exportar Vista Previa del Concentrado Zonal (Paso 2) ── */}
      {showPreviewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            style={{
              background: 'var(--c-bg-card, #1e293b)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 16,
              maxWidth: 850,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--c-text, #fff)' }}>
                  📋 Concentrado Zonal de Escuelas — Vista Previa
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--c-text-muted)' }}>
                  {pips.zona_nombre || 'Zona Escolar'} ({pips.zona_clave || 'S/C'}) • Ciclo: {pips.ciclo_escolar || SCHOOL_YEAR} • Supervisor: {pips.supervisor_name || 'No asignado'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--c-text-muted)', fontSize: 18, cursor: 'pointer', borderRadius: 8, width: 32, height: 32 }}
              >
                ✕
              </button>
            </div>

            {/* Contenido de la tabla formateada */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>Planteles</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{planteles.length}</div>
                </div>
                <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600 }}>Matrícula Hombres</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{totalHombres}</div>
                </div>
                <div style={{ background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.25)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#f472b6', fontWeight: 600 }}>Matrícula Mujeres</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{totalMujeres}</div>
                </div>
                <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>Total Alumnos</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{granTotalAlumnos}</div>
                </div>
              </div>

              {planteles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--c-text-muted)', fontStyle: 'italic' }}>
                  No se han registrado escuelas en este PIPS.
                </div>
              ) : (
                <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'rgba(99,102,241,0.25)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'center', color: '#c7d2fe' }}>No.</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#c7d2fe' }}>Nombre de la Escuela</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', color: '#c7d2fe' }}>CCT</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: '#c7d2fe' }}>Municipio</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', color: '#38bdf8' }}>Hombres</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', color: '#f472b6' }}>Mujeres</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', color: '#4ade80', fontWeight: 700 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planteles.map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--c-text-muted)' }}>{p.no || idx + 1}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--c-text)' }}>{p.nombre}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', color: '#818cf8' }}>{p.cct}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--c-text-muted)' }}>{p.municipio || p.localidad || '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#38bdf8' }}>{p.hombres}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#f472b6' }}>{p.mujeres}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#4ade80' }}>{p.total || (Number(p.hombres) + Number(p.mujeres))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'rgba(99,102,241,0.2)', borderTop: '2px solid rgba(99,102,241,0.4)', fontWeight: 800 }}>
                        <td colSpan={4} style={{ padding: '8px 10px', textAlign: 'right', color: '#fff', textTransform: 'uppercase' }}>
                          Total Concentrado Zonal:
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#38bdf8' }}>{totalHombres}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#f472b6' }}>{totalMujeres}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#4ade80', fontSize: 13 }}>{granTotalAlumnos}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Footer con acciones */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  const headers = ['No.', 'Nombre', 'CCT', 'Municipio', 'Hombres', 'Mujeres', 'Total'];
                  const rows = planteles.map(p => [
                    p.no || '',
                    p.nombre || '',
                    p.cct || '',
                    p.municipio || p.localidad || '',
                    p.hombres,
                    p.mujeres,
                    p.total || (Number(p.hombres) + Number(p.mujeres)),
                  ]);
                  const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
                  navigator.clipboard.writeText(tsv);
                  alert('Tabla copiada al portapapeles en formato tabular para Excel / Google Sheets.');
                }}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                📋 Copiar para Excel/Sheets
              </button>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="btn btn-primary btn-sm"
              >
                Cerrar vista previa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Importador CSV para PIPS (Paso 5) ── */}
      {showCsvModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowCsvModal(false)}
        >
          <div
            style={{
              background: 'var(--c-bg-card, #1e293b)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 16,
              maxWidth: 750,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--c-text, #fff)' }}>
                  📥 Importar Directorio de Escuelas desde CSV
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--c-text-muted)' }}>
                  Formato admitido: <code>nombre, CCT, matricula_h, matricula_m</code> (valores separados por comas o tabulaciones)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--c-text-muted)', fontSize: 18, cursor: 'pointer', borderRadius: 8, width: 32, height: 32 }}
              >
                ✕
              </button>
            </div>

            {/* Contenido del importador */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {/* Selector de archivo CSV */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--c-text)', marginBottom: 6 }}>
                  1. Cargar archivo (.csv, .txt):
                </label>
                <input
                  type="file"
                  accept=".csv, .txt, .tsv"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = ev => {
                        const content = ev.target?.result as string;
                        if (content) {
                          setCsvText(content);
                          parseCsvContent(content);
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  style={{ fontSize: 12, color: 'var(--c-text-muted)' }}
                />
              </div>

              {/* Pegar texto CSV directamente */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--c-text)', marginBottom: 6 }}>
                  2. O pegar datos en formato texto:
                </label>
                <textarea
                  value={csvText}
                  onChange={e => {
                    setCsvText(e.target.value);
                    parseCsvContent(e.target.value);
                  }}
                  rows={5}
                  placeholder={`nombre, CCT, matricula_h, matricula_m\nBachillerato Digital Núm. 46, 21EBH0200X, 45, 52\nBachillerato Gral. Lázaro Cárdenas, 21EBH0018G, 120, 135`}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.03)',
                    color: 'var(--c-text)',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Error de validación */}
              {csvError && (
                <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#fca5a5', fontSize: 12, marginBottom: 14 }}>
                  ⚠️ {csvError}
                </div>
              )}

              {/* Previsualización de los datos parseados */}
              {csvParsed.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>
                      ✓ {csvParsed.length} escuela(s) detectadas para importar
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                      Mostrando previsualización
                    </span>
                  </div>
                  <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <th style={{ padding: '6px', textAlign: 'left', color: 'var(--c-text-muted)' }}>Escuela</th>
                          <th style={{ padding: '6px', textAlign: 'center', color: 'var(--c-text-muted)' }}>CCT</th>
                          <th style={{ padding: '6px', textAlign: 'right', color: 'var(--c-text-muted)' }}>H</th>
                          <th style={{ padding: '6px', textAlign: 'right', color: 'var(--c-text-muted)' }}>M</th>
                          <th style={{ padding: '6px', textAlign: 'right', color: 'var(--c-text-muted)' }}>Total</th>
                          <th style={{ padding: '6px', textAlign: 'center', color: 'var(--c-text-muted)' }}>Validación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvParsed.map((r, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '5px 6px', fontWeight: 600 }}>{r.nombre}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'center', fontFamily: 'monospace' }}>{r.cct}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{r.hombres}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{r.mujeres}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, color: '#4ade80' }}>{r.total}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                              {r.isValidCct ? (
                                <span style={{ color: '#4ade80', fontSize: 11 }}>✓ CCT Válido</span>
                              ) : (
                                <span style={{ color: '#f59e0b', fontSize: 11 }}>⚠️ CCT no estándar</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer del modal */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmCsvImport}
                disabled={csvParsed.length === 0}
                className="btn btn-primary btn-sm"
              >
                Confirmar e importar ({csvParsed.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cronograma row helper ───────────────────────────────────────────────────
function AddCronogramaRow({ onAdd }: { onAdd: (a: PipsCronogramaActividad) => void }) {
  const [row, setRow] = useState<PipsCronogramaActividad>({ actividad: '', objetivo: 'Obj. 1', responsable: 'Supervisor + ATP', mes: 'Ago 2026', recursos: '', indicador: '' });
  const setR = (k: keyof PipsCronogramaActividad, v: string) => setRow(prev => ({ ...prev, [k]: v }));
  const fields: [keyof PipsCronogramaActividad, string][] = [
    ['actividad', 'Actividad'], ['objetivo', 'Objetivo'], ['responsable', 'Responsable'], ['mes', 'Mes'], ['recursos', 'Recursos'], ['indicador', 'Indicador'],
  ];
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14, border: '1px dashed rgba(255,255,255,0.1)' }}>
      <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 10 }}>➕ Agregar actividad al cronograma</p>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        {fields.map(([key, label]) => (
          <div key={key}>
            <label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 3 }}>{label}</label>
            <input value={row[key] as string} onChange={e => setR(key, e.target.value)} placeholder={label} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--c-text)', fontSize: 11 }} />
          </div>
        ))}
      </div>
      <button onClick={() => { onAdd({ ...row }); setRow({ actividad: '', objetivo: 'Obj. 1', responsable: 'Supervisor + ATP', mes: 'Ago 2026', recursos: '', indicador: '' }); }} className="btn btn-secondary btn-sm">Agregar actividad</button>
    </div>
  );
}
