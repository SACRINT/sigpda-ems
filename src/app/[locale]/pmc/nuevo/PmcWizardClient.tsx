'use client';

import Link from 'next/link';
import {
  STEPS,
  generarEstrategiaSituada,
  isPreviousMetaAdapted,
  buildIndicadoresPayload,
  buildPmcSaveBody,
  format911FinAnteriorBanner,
  extractF11Warnings,
  validateCanGenerateStep,
  type DirectorSource,
  type IndicadoresAcademicos,
  type IngestCoverageData,
  type Props,
} from './wizard/helpers';
import { usePmcWizardState } from './wizard/usePmcWizardState';
import { usePmcFileIngest } from './wizard/usePmcFileIngest';
import { usePmcGenerationAndNav, type PmcWizardController } from './wizard/usePmcGenerationAndNav';
import { Step1DatosInstitucionales } from './wizard/Step1DatosInstitucionales';
import { Step2Personal } from './wizard/Step2Personal';
import { Step3Diagnostico } from './wizard/Step3Diagnostico';
import { Step4GeneracionIA } from './wizard/Step4GeneracionIA';
import { Step5Exportacion } from './wizard/Step5Exportacion';
import { PmcWizardModals } from './wizard/PmcWizardModals';

export {
  generarEstrategiaSituada,
  isPreviousMetaAdapted,
  buildIndicadoresPayload,
  buildPmcSaveBody,
  format911FinAnteriorBanner,
  extractF11Warnings,
  validateCanGenerateStep,
  type DirectorSource,
  type IndicadoresAcademicos,
  type IngestCoverageData,
};

export default function PmcWizardClient(props: Props) {
  const state = usePmcWizardState(props);
  const ingest = usePmcFileIngest(state);
  const navGen = usePmcGenerationAndNav(state);
  const w: PmcWizardController = { ...state, ...ingest, ...navGen };

  const {
    locale,
    cicloEscolar,
    activeStep,
    goToStep,
    error,
    successBanner,
    setSuccessBanner,
    handleBack,
    handleNext,
    saving,
    generating,
  } = w;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0d1530 0%, #080c18 60%, #020408 100%)', backgroundAttachment: 'fixed', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: 'rgba(6,10,20,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#f0f4ff', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>📈</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.3px', background: 'linear-gradient(135deg,#e0e7ff,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Plan de Mejora Continua</div>
            <div style={{ fontSize: '12px', color: 'rgba(240,244,255,0.5)' }}>Lineamientos MCCEMS {cicloEscolar}</div>
          </div>
        </div>
        <Link href={`/${locale}/pmc`} style={{ color: 'rgba(240,244,255,0.6)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
          ← Volver
        </Link>
      </header>

      {/* Progress steps */}
      <div style={{ background: 'rgba(8,12,24,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 0, maxWidth: '900px', margin: '0 auto' }}>
          {STEPS.map(step => (
            <div key={step.n} style={{
              flex: 1, padding: '14px 8px', textAlign: 'center', fontSize: '12px', fontWeight: 600,
              borderBottom: `3px solid ${activeStep === step.n ? '#6366f1' : activeStep > step.n ? '#10b981' : 'transparent'}`,
              color: activeStep === step.n ? '#818cf8' : activeStep > step.n ? '#34d399' : 'rgba(240,244,255,0.4)',
              cursor: activeStep > step.n ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }} onClick={() => activeStep > step.n && goToStep(step.n)}>
              <div style={{ fontSize: '18px', marginBottom: '2px' }}>
                {activeStep > step.n ? '✓' : step.n}
              </div>
              {step.label}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>

        {/* Error banner */}
        {error && (
          <div style={{ background: 'rgba(244,63,94,0.12)', color: '#fb7185', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '14px', border: '1px solid rgba(244,63,94,0.25)' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Success / Notification banner */}
        {successBanner && (
          <div style={{ marginBottom: '18px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{successBanner}</span>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
            >
              ×
            </button>
          </div>
        )}


        {activeStep === 1 && <Step1DatosInstitucionales w={w} />}
        {activeStep === 2 && <Step2Personal w={w} />}
        {activeStep === 3 && <Step3Diagnostico w={w} />}
        {activeStep === 4 && <Step4GeneracionIA w={w} />}
        {activeStep === 5 && <Step5Exportacion w={w} />}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--c-border)', paddingTop: '16px' }}>
          {activeStep > 1 ? (
            <button onClick={handleBack} disabled={saving} className="btn btn-secondary">
              ← Anterior
            </button>
          ) : (
            <Link href={`/${locale}/pmc`} className="btn btn-secondary">← Cancelar</Link>
          )}

          {activeStep < 5 && (
            <button onClick={handleNext} disabled={saving || generating !== null} className="btn btn-primary">
              {saving ? 'Guardando...' : activeStep === 4 ? '✓ Finalizar PMC' : 'Siguiente →'}
            </button>
          )}
          {activeStep === 5 && (
            <Link href={`/${locale}/pmc`} className="btn btn-primary">
              Ir a mis PMC →
            </Link>
          )}
        </div>

        <PmcWizardModals w={w} />
      </div>
    </div>
  );
}
