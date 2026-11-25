import type { PlanOperativoRow } from '@/types/paec';
import type { getPaecProjectById } from '@/lib/db';

export type PaecDbProject = NonNullable<Awaited<ReturnType<typeof getPaecProjectById>>>;
export type LegacyPlanOperativo = { semestreA?: PlanOperativoRow[]; semestreB?: PlanOperativoRow[] };

export interface PaecStepHandlerContext {
  id: string;
  step: number;
  project: PaecDbProject;
  teacherId: string;
  stepSystemPrompt: string;
  libraryContext: string | null;
}

export interface PaecStepHandlerResult {
  fieldName: string;
  userPrompt: string;
  stepResultData: object | null;
  errorResponse?: { error: string; status: number };
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
