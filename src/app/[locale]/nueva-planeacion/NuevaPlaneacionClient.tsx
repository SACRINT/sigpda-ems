'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { ExtractedPdfData, TeacherContext } from '@/types/planning';
import StepUAC from '@/components/planeacion/StepUAC';
import StepPdfUpload from '@/components/planeacion/StepPdfUpload';
import StepContext from '@/components/planeacion/StepContext';
import StepGenerate from '@/components/planeacion/StepGenerate';
import { clearLocalDraftsByPrefix, useWizardPersistence } from '@/hooks/useWizardPersistence';
import {
  applyUacSelection,
  type WizardUacSelection,
} from '@/lib/planeacion-wizard-state';

const STEPS = [
  { num: 1, label: 'Datos UAC' },
  { num: 2, label: 'Programa' },
  { num: 3, label: 'Contexto' },
  { num: 4, label: 'Generar' },
];

const STORAGE_KEY = 'didactica_planeacion_draft';

type UACSelection = WizardUacSelection;

interface WizardDraft {
  step: number;
  uacSelection: UACSelection | null;
  extractedData: ExtractedPdfData | null;
  context: TeacherContext | null;
  planningId: string | null;
}

const INITIAL_DRAFT: WizardDraft = {
  step: 1,
  uacSelection: null,
  extractedData: null,
  context: null,
  planningId: null,
};

interface Props {
  locale: string;
}

export default function NuevaPlaneacionClient({ locale }: Props) {
  const router = useRouter();
  const { update } = useSession();

  // All wizard state is persisted in localStorage automatically
  const { state: draft, setState: setDraft, clearDraft, isHydrated, hasDraft, restoredFromStorage } = useWizardPersistence<WizardDraft>(
    STORAGE_KEY,
    INITIAL_DRAFT
  );

  const [isCreatingPlanning, setIsCreatingPlanning] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);

  // Convenience setters
  const setStep = (step: number) => {
    setPlanningError(null);
    setDraft(prev => ({ ...prev, step }));
  };

  const handleUACNext = (data: UACSelection, initialData?: ExtractedPdfData) => {
    setDraft(prev => applyUacSelection(prev, data, initialData));
  };

  const handlePdfNext = (data: ExtractedPdfData) => {
    setDraft(prev => ({ ...prev, extractedData: data, step: 3 }));
  };

  const handlePdfBack = (data: ExtractedPdfData) => {
    setDraft(prev => ({ ...prev, extractedData: data, step: 1 }));
  };

  const handleContextBack = (context: TeacherContext) => {
    setDraft(prev => ({ ...prev, context, step: 2 }));
  };

  const handleContextNext = async (ctx: TeacherContext) => {
    if (!draft.uacSelection) {
      setPlanningError('Faltan los datos de la UAC. Por favor regresa al Paso 1.');
      return;
    }

    setIsCreatingPlanning(true);
    setPlanningError(null);

    try {
      const res = await fetch('/api/plannings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uacName: draft.uacSelection.uacName,
          semester: draft.uacSelection.semester,
          component: draft.uacSelection.component,
          curriculumName: draft.uacSelection.curriculumName,
          paecContext: ctx.paecProblem,
          extractedData: draft.extractedData,
          teacherName: ctx.teacherName,
          schoolName: ctx.schoolName,
          cct: ctx.cct,
          municipality: ctx.municipality,
          schoolZone: ctx.schoolZone,
          metodologiaActiva: ctx.metodologiaActiva || undefined,
          paecOperationalActivity: (ctx.usePaecActivity !== false && ctx.paecOperationalActivity) ? ctx.paecOperationalActivity : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.planning?.id) {
        throw new Error(data.error || 'No se pudo registrar la planeación en el servidor.');
      }

      try {
        await update();
      } catch (updateErr) {
        console.warn('No se pudo refrescar la sesión tras crear la planeación:', updateErr);
      }

      // Transición ATÓMICA al paso 4 con el planningId ya verificado
      setDraft(prev => ({
        ...prev,
        context: ctx,
        planningId: data.planning.id,
        step: 4,
      }));
    } catch (err: unknown) {
      console.error('Error creating planning record:', err);
      const message = err instanceof Error ? err.message : 'Error de conexión al crear el registro de la planeación.';
      setPlanningError(message);
    } finally {
      setIsCreatingPlanning(false);
    }
  };

  const handleDone = (id: string) => {
    clearDraft();
    clearLocalDraftsByPrefix('sigpda_draft_planeacion-');
    router.push(`/${locale}/planeacion/${id}`);
  };

  const handleDiscardDraft = () => {
    if (!window.confirm('¿Descartar el borrador guardado en este dispositivo?')) return;
    clearDraft();
    clearLocalDraftsByPrefix('sigpda_draft_planeacion-');
    window.location.reload();
  };

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Nueva planeación didáctica</h1>
        <p className="page-subtitle">Ciclo escolar 2026-2027 · Formato oficial MCCEMS</p>
      </div>

      <div style={{ maxWidth: '820px' }}>
        {isHydrated && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              padding: '10px 14px',
              marginBottom: '16px',
              borderRadius: '10px',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              color: 'var(--c-text-muted)',
              fontSize: '12px',
            }}
          >
            <span>
              💾 Guardado automático local activo
              {restoredFromStorage && (
                <strong style={{ color: '#34d399', marginLeft: '6px' }}>· Borrador restaurado</strong>
              )}
            </span>
            {hasDraft && (
              <button
                type="button"
                onClick={handleDiscardDraft}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.35)',
                  color: '#f87171',
                  borderRadius: '7px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Descartar borrador
              </button>
            )}
          </div>
        )}

        {/* Step progress indicator */}
        <div className="step-wizard">
          {STEPS.map((s) => (
            <div
              key={s.num}
              className={`step-item ${
                s.num < draft.step ? 'done' : s.num === draft.step ? 'active' : ''
              }`}
            >
              <div className="step-num">
                {s.num < draft.step ? '✓' : s.num}
              </div>
              <span className="step-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Step content */}
        {!isHydrated ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <div className="spinner spinner-dark" style={{ margin: '0 auto 12px', width: '24px', height: '24px' }} />
            <p style={{ color: 'var(--c-text-muted)', fontSize: '14px', margin: 0 }}>
              Restaurando borrador de planeación...
            </p>
          </div>
        ) : (
          <>
            {draft.step === 1 && (
              <StepUAC
                onNext={handleUACNext}
                initialSelection={draft.uacSelection}
              />
            )}

            {draft.step === 2 && draft.uacSelection && (
              <StepPdfUpload
                uacSelection={draft.uacSelection}
                initialData={draft.extractedData}
                onNext={handlePdfNext}
                onBack={handlePdfBack}
              />
            )}

            {draft.step === 3 && draft.extractedData && draft.uacSelection && (
              <StepContext
                extractedData={draft.extractedData}
                component={draft.uacSelection.component}
                initialContext={draft.context}
                onNext={handleContextNext}
                onBack={handleContextBack}
                isSubmitting={isCreatingPlanning}
                submissionError={planningError}
              />
            )}

            {draft.step === 4 && draft.extractedData && draft.context && (
              <StepGenerate
                planningId={draft.planningId}
                extractedData={draft.extractedData}
                context={draft.context}
                uacSelection={draft.uacSelection!}
                onDone={handleDone}
                onBack={() => setStep(3)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
