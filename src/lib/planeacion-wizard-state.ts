import type { ExtractedPdfData, TeacherContext } from '@/types/planning';
import { normalizeUnicode } from '@/lib/utils/normalize';

export interface WizardUacSelection {
  uacName: string;
  semester: number;
  component: string;
  subsystem?: string;
  curriculumName?: string;
}

export interface PlaneacionWizardDraft {
  step: number;
  uacSelection: WizardUacSelection | null;
  extractedData: ExtractedPdfData | null;
  context: TeacherContext | null;
  planningId: string | null;
}

function key(value: string | undefined | null): string {
  return normalizeUnicode(value || '').replace(/\s+/g, ' ').trim();
}

export function isSameUacSelection(
  current: WizardUacSelection | null | undefined,
  next: WizardUacSelection
): boolean {
  if (!current) return false;
  return (
    key(current.uacName) === key(next.uacName) &&
    Number(current.semester) === Number(next.semester) &&
    key(current.component) === key(next.component) &&
    key(current.subsystem) === key(next.subsystem)
  );
}

export function preserveContextForNewUac(
  context: TeacherContext | null,
  selection: WizardUacSelection
): TeacherContext | null {
  if (!context) return null;

  return {
    ...context,
    subsystem: selection.subsystem || context.subsystem,
    metodologiaActiva: undefined,
    paecOperationalActivity: null,
    usePaecActivity: false,
  };
}

export function applyUacSelection(
  previous: PlaneacionWizardDraft,
  selection: WizardUacSelection,
  initialData?: ExtractedPdfData
): PlaneacionWizardDraft {
  const sameUac = isSameUacSelection(previous.uacSelection, selection);

  return {
    ...previous,
    step: 2,
    uacSelection: selection,
    extractedData: sameUac
      ? previous.extractedData ?? initialData ?? null
      : initialData ?? null,
    context: sameUac
      ? previous.context
      : preserveContextForNewUac(previous.context, selection),
    planningId: sameUac ? previous.planningId : null,
  };
}
