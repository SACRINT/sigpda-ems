'use client';

import React from 'react';
import PaecWizardLegacy from './legacy/PaecWizardLegacy';
import {
  getCachedPaecStep,
  setCachedPaecStep,
  getCachedPaecBlock,
  setCachedPaecBlock,
  invalidatePaecStepCache,
  FFE_PAIRS,
  type PaecCacheInvalidationOptions,
  type InvalidateCacheTarget,
  type AcademicBaseline,
  type Props,
} from './wizard/helpers';
import { usePaecWizardState } from './wizard/usePaecWizardState';
import { usePaecWizardActions, type PaecWizardController } from './wizard/usePaecWizardActions';
import { PaecSetupFormView } from './wizard/PaecSetupFormView';
import { PaecActiveWizardView } from './wizard/PaecActiveWizardView';

export {
  getCachedPaecStep,
  setCachedPaecStep,
  getCachedPaecBlock,
  setCachedPaecBlock,
  invalidatePaecStepCache,
  FFE_PAIRS,
  type PaecCacheInvalidationOptions,
  type InvalidateCacheTarget,
  type AcademicBaseline,
};

function PaecWizardModularClient(props: Props) {
  const state = usePaecWizardState(props);
  const actions = usePaecWizardActions(state);
  const w: PaecWizardController = { ...state, ...actions };

  if (w.loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--c-text-muted)' }}>
        <span
          className="spinner"
          style={{
            display: 'inline-block',
            width: '32px',
            height: '32px',
            border: '3px solid var(--c-blue-pale)',
            borderTopColor: 'var(--c-blue-mid)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <p style={{ marginTop: '16px', fontSize: '16px' }}>Cargando proyecto...</p>
      </div>
    );
  }

  if (!w.projectId) {
    return <PaecSetupFormView w={w} />;
  }

  return <PaecActiveWizardView w={w} />;
}

export default function PaecWizardClient(props: Props) {
  if (process.env.NEXT_PUBLIC_FF_NEW_PAEC_WIZARD === 'false') {
    return <PaecWizardLegacy {...props} />;
  }
  return <PaecWizardModularClient {...props} />;
}
