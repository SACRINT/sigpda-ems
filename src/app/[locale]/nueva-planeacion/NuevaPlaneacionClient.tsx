'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ExtractedPdfData, TeacherContext } from '@/types/planning';
import StepUAC from '@/components/planeacion/StepUAC';
import StepPdfUpload from '@/components/planeacion/StepPdfUpload';
import StepContext from '@/components/planeacion/StepContext';
import StepGenerate from '@/components/planeacion/StepGenerate';
import { useWizardPersistence } from '@/hooks/useWizardPersistence';

const STEPS = [
  { num: 1, label: 'Datos UAC' },
  { num: 2, label: 'Programa' },
  { num: 3, label: 'Contexto' },
  { num: 4, label: 'Generar' },
];

const STORAGE_KEY = 'didactica_planeacion_draft';

interface UACSelection {
  uacName: string;
  semester: number;
  component: string;
  curriculumName?: string;
}

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

  // All wizard state is persisted in localStorage automatically
  const { state: draft, setState: setDraft, clearDraft, isHydrated } = useWizardPersistence<WizardDraft>(
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
    setDraft(prev => ({
      ...prev,
      uacSelection: data,
      extractedData: initialData ?? null,
      step: 2,
    }));
  };

  const handlePdfNext = (data: ExtractedPdfData) => {
    setDraft(prev => ({ ...prev, extractedData: data, step: 3 }));
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
          metodologiaActiva: ctx.metodologiaActiva || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.planning?.id) {
        throw new Error(data.error || 'No se pudo registrar la planeación en el servidor.');
      }

      // Transición ATÓMICA al paso 4 con el planningId ya verificado
      setDraft(prev => ({
        ...prev,
        context: ctx,
        planningId: data.planning.id,
        step: 4,
      }));
    } catch (err: any) {
      console.error('Error creating planning record:', err);
      setPlanningError(err.message || 'Error de conexión al crear el registro de la planeación.');
    } finally {
      setIsCreatingPlanning(false);
    }
  };

  const handleDone = (id: string) => {
    // Clear the draft when the wizard is completed successfully
    clearDraft();
    router.push(`/${locale}/planeacion/${id}`);
  };

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Nueva planeación didáctica</h1>
        <p className="page-subtitle">Ciclo escolar 2026-2027 · Formato oficial DBEPA</p>
      </div>

      <div style={{ maxWidth: '820px' }}>
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
              <StepUAC onNext={handleUACNext} />
            )}

            {draft.step === 2 && draft.uacSelection && (
              <StepPdfUpload
                uacSelection={draft.uacSelection}
                initialData={draft.extractedData}
                onNext={handlePdfNext}
                onBack={() => setStep(1)}
              />
            )}

            {draft.step === 3 && draft.extractedData && (
              <StepContext
                extractedData={draft.extractedData}
                initialContext={draft.context}
                onNext={handleContextNext}
                onBack={() => setStep(2)}
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
