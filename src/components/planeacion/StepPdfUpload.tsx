'use client';

import { useState, useCallback, useRef } from 'react';
import type { ExtractedPdfData, KeyActivity } from '@/types/planning';
import { isTechnologicalSubsystem } from '@/lib/subsystem-config';

interface Props {
  uacSelection: { uacName: string; semester: number; component: string; subsystem?: string };
  initialData?: ExtractedPdfData | null;
  onNext: (data: ExtractedPdfData) => void;
  onBack: () => void;
}

export default function StepPdfUpload({ uacSelection, initialData, onNext, onBack }: Props) {
  const isLaboral = uacSelection.component === 'laboral';
  const isProgresiones = uacSelection.semester >= 5;
  const isTec = isTechnologicalSubsystem(uacSelection.subsystem);

  const activityLabel = isLaboral
    ? (isTec
        ? 'Competencias Profesionales y Actividades Clave del Submódulo'
        : 'Actividades Clave y Resultados de la Capacitación')
    : isProgresiones
      ? 'Progresiones de Aprendizaje MCCEMS (Ciclo de Transición 26-27)'
      : 'Propósitos Formativos y Contenidos de Estudio (SEP 26-27)';

  const activityPlaceholder = isLaboral
    ? (isTec
        ? 'Actividad clave / competencia profesional del submódulo'
        : 'Nombre de la Actividad Clave de la capacitación')
    : isProgresiones
      ? 'Texto de la Progresión X...'
      : 'Nombre del Propósito Formativo (ej: Propósito 1, Bloque 1)';

  const addBtnLabel = isLaboral
    ? (isTec
        ? '+ Agregar actividad clave del submódulo'
        : '+ Agregar actividad clave')
    : isProgresiones
      ? '+ Agregar progresión'
      : '+ Agregar propósito formativo';

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parseResult, setParseResult] = useState<{ confidence: string; errors: string[] } | null>(null);
  
  const [formData, setFormData] = useState<ExtractedPdfData>(() => {
    if (initialData) {
      return { ...initialData };
    }
    return {
      uacName: uacSelection.uacName,
      learningOutcome: '',
      totalHours: 54,
      activities: [
        { name: '', hours: 18, order: 1 },
        { name: '', hours: 18, order: 2 },
        { name: '', hours: 18, order: 3 },
      ],
      evidences: [''],
      parseConfidence: 'failed',
    };
  });

  const hasPreloadedData = !!(initialData && initialData.activities && initialData.activities.length > 0);

  const [isProgramCorrect, setIsProgramCorrect] = useState(() => hasPreloadedData);
  const [showUploadZone, setShowUploadZone] = useState(() => !hasPreloadedData);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsProgramCorrect(checked);
    if (checked) {
      setShowUploadZone(false);
      if (initialData) {
        setFormData({ ...initialData });
      }
      setFile(null);
      setParseResult(null);
    } else {
      setShowUploadZone(true);
    }
  };

  const handleFile = async (f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      alert('Solo se aceptan archivos PDF.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      alert('El archivo no puede superar 10 MB.');
      return;
    }
    setFile(f);
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append('pdf', f);
      const res = await fetch('/api/pdf/parse', { method: 'POST', body: fd });
      const result = await res.json();

      setParseResult({ confidence: result.confidence || 'failed', errors: result.errors || [] });

      if (result.data) {
        setFormData(prev => ({
          ...prev,
          uacName: result.data.uacName || prev.uacName,
          learningOutcome: result.data.learningOutcome || prev.learningOutcome,
          totalHours: result.data.totalHours || prev.totalHours,
          activities: result.data.activities?.length > 0 ? result.data.activities : prev.activities,
          evidences: result.data.evidences?.length > 0 ? result.data.evidences : prev.evidences,
          rawText: result.data.rawText,
          parseConfidence: result.confidence || 'failed',
        }));
      }
    } catch {
      setParseResult({ confidence: 'failed', errors: ['Error de red al procesar el PDF.'] });
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addActivity = () => {
    setFormData(prev => ({
      ...prev,
      activities: [...prev.activities, { name: '', hours: 18, order: prev.activities.length + 1 }],
    }));
  };

  const removeActivity = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities
        .filter((_, i) => i !== idx)
        .map((a, i) => ({ ...a, order: i + 1 })),
    }));
  };

  const updateActivity = (idx: number, field: keyof KeyActivity, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.map((a, i) => i === idx ? { ...a, [field]: value } : a),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(formData);
  };

  const confidenceLabel: Record<string, string> = {
    high: '✅ Alta confianza — datos extraídos correctamente',
    medium: '⚠️ Confianza media — algunos campos requieren revisión',
    low: '⚠️ Confianza baja — por favor revisa todos los campos',
    failed: '❌ No se pudo extraer — captura los datos manualmente',
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Upload card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 className="card-title">Paso 2: Subir programa de estudios</h2>
        <p className="card-subtitle">
          Sube el PDF de tu plan y programa de estudios. La plataforma extraerá los datos
          automáticamente. Siempre podrás editar cualquier campo antes de continuar.
        </p>

        {hasPreloadedData && initialData && (
          <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid var(--c-border)', borderRadius: '8px', background: 'var(--c-bg-surface)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 500, color: 'var(--c-accent-bright)' }}>
              <input
                type="checkbox"
                checked={isProgramCorrect}
                onChange={handleCheckboxChange}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>Confirmo que el programa oficial ({initialData.year || 2025}) es el correcto para esta UAC</span>
            </label>
            <p style={{ margin: '6px 0 0 28px', fontSize: '13px', color: 'var(--c-text-muted)' }}>
              Si el programa seleccionado ya no es el actual o si sabes que hay uno más nuevo, desmarca esta casilla para subir el archivo PDF del programa más reciente.
            </p>
          </div>
        )}

        {showUploadZone ? (
          <div>
            {!hasPreloadedData && (
              <div className="alert alert-warning" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <strong>Programa de estudios no precargado</strong>
                </div>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Esta asignatura aún no tiene sus propósitos formativos precargados en la base de datos de la escuela. Por favor sube el programa de estudios oficial (PDF) para extraer los datos de forma automática, o captúralos manualmente abajo.
                </p>
              </div>
            )}
            {!file ? (
              <div
                className={`pdf-upload-zone ${dragging ? 'dragover' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
              >
                <div className="pdf-upload-icon">📄</div>
                <p className="pdf-upload-title">Arrastra tu PDF aquí o haz clic para seleccionar</p>
                <p className="pdf-upload-sub">Solo archivos PDF · Máximo 10 MB</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="pdf-file-info">
                <span className="pdf-file-icon">📄</span>
                <span className="pdf-file-name">{file.name}</span>
                <span className="pdf-file-size">{(file.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setFile(null); setParseResult(null); }}
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="alert alert-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📚</span>
              <strong>UAC precargada desde el catálogo oficial ({initialData?.year || 2025})</strong>
            </div>
            <p style={{ margin: 0, fontSize: '14px' }}>
              Hemos completado los campos con los datos oficiales del plan de estudios (MCCEMS). Puedes revisarlos abajo.
            </p>
          </div>
        )}

        {loading && (
          <div className="alert alert-info">
            <div className="spinner spinner-dark" />
            <span>Extrayendo datos del programa de estudios...</span>
          </div>
        )}

        {parseResult && (
          <div className={`confidence confidence-${parseResult.confidence}`}>
            {confidenceLabel[parseResult.confidence]}
          </div>
        )}

        {parseResult?.errors?.map((err, i) => (
          <div key={i} className="alert alert-warning">{err}</div>
        ))}
      </div>

      {/* Always-visible editable fields — first option, not a fallback */}
      <div className="card">
        <h3 className="card-title" style={{ fontSize: '16px' }}>
          Revisar y completar datos del programa
        </h3>
        <p className="card-subtitle">
          Verifica que la información extraída sea correcta. Puedes editar todos los campos.
          {!file && !initialData && ' (Puedes completar los datos manualmente sin subir un PDF.)'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div className="form-group">
            <label className="form-label form-label-required">Nombre de la UAC</label>
            <input
              className="form-input"
              value={formData.uacName}
              onChange={e => setFormData({ ...formData, uacName: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Resultado de aprendizaje</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={formData.learningOutcome}
              onChange={e => setFormData({ ...formData, learningOutcome: e.target.value })}
              placeholder="Al finalizar la UAC, el estudiante será capaz de..."
            />
          </div>

          <div className="form-group">
            <label className="form-label form-label-required">Carga horaria total (horas)</label>
            <input
              type="number"
              className="form-input"
              value={formData.totalHours}
              min={10}
              max={400}
              onChange={e => setFormData({ ...formData, totalHours: Number(e.target.value) })}
              style={{ maxWidth: '140px' }}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label form-label-required">{activityLabel}</label>
            {formData.activities.map((a, idx) => (
              <div key={idx} className="activity-card-item" style={{ marginBottom: '12px', background: 'var(--c-bg-elevated)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--c-border-2)' }}>
                <div className="activity-row" style={{ marginBottom: '6px' }}>
                  <input
                    className="form-input"
                    placeholder={`${activityPlaceholder} ${idx + 1}`}
                    value={a.name}
                    onChange={e => updateActivity(idx, 'name', e.target.value)}
                    required
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Horas"
                      value={a.hours}
                      min={1}
                      onChange={e => updateActivity(idx, 'hours', Number(e.target.value))}
                      style={{ flex: 1, minWidth: '0' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--c-text-muted)', whiteSpace: 'nowrap' }}>hrs</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeActivity(idx)}
                    disabled={formData.activities.length <= 1}
                  >
                    ✕
                  </button>
                </div>

                {/* Sub-lista de Contenidos Formativos si el modelo no es de progresiones Y NO es componente laboral/técnico */}
                {!isProgresiones && !isLaboral && (
                  <div style={{ paddingLeft: '12px', marginTop: '6px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', fontWeight: 500, marginBottom: '4px' }}>
                      📋 Contenidos / Temas de estudio asociados:
                    </div>
                    {((formData.contenidosFormativos && formData.contenidosFormativos[idx]?.contenidos) || []).map((tema: string, tIdx: number) => (
                      <div key={tIdx} style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                        <input
                          className="form-input"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                          value={tema}
                          onChange={e => {
                            const val = e.target.value;
                            setFormData(prev => {
                              const cfs = [...(prev.contenidosFormativos || [])];
                              if (!cfs[idx]) cfs[idx] = { proposito: a.name, contenidos: [] };
                              cfs[idx].contenidos[tIdx] = val;
                              return { ...prev, contenidosFormativos: cfs };
                            });
                          }}
                          placeholder={`Tema ${tIdx + 1}...`}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 8px' }}
                          onClick={() => {
                            setFormData(prev => {
                              const cfs = [...(prev.contenidosFormativos || [])];
                              if (!cfs[idx]) return prev;
                              cfs[idx].contenidos = cfs[idx].contenidos.filter((_: string, i: number) => i !== tIdx);
                              return { ...prev, contenidosFormativos: cfs };
                            });
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => {
                        setFormData(prev => {
                          const cfs = [...(prev.contenidosFormativos || [])];
                          if (!cfs[idx]) cfs[idx] = { proposito: a.name, contenidos: [''] };
                          else cfs[idx].contenidos.push('');
                          return { ...prev, contenidosFormativos: cfs };
                        });
                      }}
                    >
                      ➕ Agregar tema de estudio
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addActivity}
              style={{ marginTop: '8px' }}
            >
              {addBtnLabel}
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Evidencias sugeridas</label>
            {formData.evidences.map((ev, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  className="form-input"
                  placeholder={`Evidencia ${idx + 1}`}
                  value={ev}
                  onChange={e => {
                    const updated = [...formData.evidences];
                    updated[idx] = e.target.value;
                    setFormData({ ...formData, evidences: updated });
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    setFormData({ ...formData, evidences: formData.evidences.filter((_, i) => i !== idx) })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setFormData({ ...formData, evidences: [...formData.evidences, ''] })}
            >
              + Agregar evidencia
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
        <button type="button" className="btn btn-secondary" onClick={onBack}>← Atrás</button>
        <button type="submit" className="btn btn-primary">Continuar →</button>
      </div>
    </form>
  );
}
