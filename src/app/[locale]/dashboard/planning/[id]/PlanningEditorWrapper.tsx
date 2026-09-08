'use client';

import { useState, useEffect } from 'react';
import type { GeneratedPlanningContent } from '@/types/planning';
import type { PlanningEditor } from '@/components/planeacion/PlanningEditor';

interface PlanningEditorWrapperProps {
  planningId: string;
  content: GeneratedPlanningContent;
}

export function PlanningEditorWrapper({ planningId, content }: PlanningEditorWrapperProps) {
  const [EditorComponent, setEditorComponent] = useState<typeof PlanningEditor | null>(null);

  useEffect(() => {
    import('@/components/planeacion/PlanningEditor').then(mod => {
      setEditorComponent(() => mod.PlanningEditor);
    });
  }, []);

  if (!EditorComponent) {
    return (
      <div className="border border-[var(--c-border)] rounded-xl bg-[var(--c-bg-surface)] shadow-sm p-8 text-center">
        <div className="animate-pulse text-[var(--c-text-muted)]">Cargando editor...</div>
      </div>
    );
  }

  return <EditorComponent planningId={planningId} content={content} />;
}
