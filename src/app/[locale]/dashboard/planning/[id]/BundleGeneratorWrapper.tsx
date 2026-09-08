'use client';

import { useState, useEffect } from 'react';
import type { BundleGenerator } from '@/components/planeacion/BundleGenerator';

interface BundleGeneratorWrapperProps {
  planningId: string;
  uacName: string;
}

export function BundleGeneratorWrapper({ planningId, uacName }: BundleGeneratorWrapperProps) {
  const [Component, setComponent] = useState<typeof BundleGenerator | null>(null);

  useEffect(() => {
    import('@/components/planeacion/BundleGenerator').then(mod => {
      setComponent(() => mod.BundleGenerator);
    });
  }, []);

  if (!Component) {
    return (
      <div className="border border-[var(--c-border)] rounded-xl bg-[var(--c-bg-surface)] shadow-sm p-4">
        <div className="animate-pulse text-[var(--c-text-muted)] text-sm">Cargando bundles...</div>
      </div>
    );
  }

  return <Component planningId={planningId} uacName={uacName} />;
}
