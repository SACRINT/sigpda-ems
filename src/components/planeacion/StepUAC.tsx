'use client';

import { useState } from 'react';
import type { ExtractedPdfData } from '@/types/planning';
import { isTechnologicalSubsystem } from '@/lib/subsystem-config';
import StepUAC_BGE, { UACSelection } from './StepUAC_BGE';
import StepUAC_BT from './StepUAC_BT';

interface Props {
  onNext: (data: UACSelection, initialData?: ExtractedPdfData) => void;
}

/**
 * StepUAC Dispatcher
 * Implementa el Patrón Estrategia (Strategy Pattern) para bifurcar limpiamente
 * entre Bachillerato General Estatal (BGE) y Bachilleratos Tecnológicos (BT).
 */
export default function StepUAC({ onNext }: Props) {
  const [selectedSubsystem, setSelectedSubsystem] = useState<string>('bge');

  const isTec = isTechnologicalSubsystem(selectedSubsystem);

  if (isTec) {
    return (
      <StepUAC_BT
        onNext={onNext}
        selectedSubsystem={selectedSubsystem}
        onSubsystemChange={setSelectedSubsystem}
      />
    );
  }

  return (
    <StepUAC_BGE
      onNext={onNext}
      selectedSubsystem={selectedSubsystem}
      onSubsystemChange={setSelectedSubsystem}
    />
  );
}
