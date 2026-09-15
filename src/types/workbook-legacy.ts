/**
 * Tipos y funciones de resolución de esquemas legados para libros de trabajo
 * SIGPDA-EMS · Normalización de salidas de IA entre renderers DOCX y PDF
 */

import type { TieredExercise } from '@/types/work-textbook';

export interface LegacyWorkbookMaterial {
  item?: string;
  material?: string;
  name?: string;
  quantity?: string | number;
  cantidad?: string | number;
  specification?: string;
  notes?: string;
  notas?: string;
}

export interface LegacyWorkbookStep {
  stepNumber?: number;
  number?: number;
  title?: string;
  titulo?: string;
  description?: string;
  descripcion?: string;
  instruction?: string;
  action?: string;
  estimatedHours?: number | string;
  durationMinutes?: number | string;
  deliverable?: string;
  entregable?: string;
}

export interface LegacyWorkbookExercise {
  number?: number;
  exerciseNumber?: number;
  statement?: string;
  problemStatement?: string;
  contextOrData?: string;
  contexto?: string;
  hint?: string;
  pista?: string;
  expectedOutputOrCriteria?: string;
  evaluationCriteria?: string;
  solution?: string;
  solucion?: string;
}

export interface LegacyRegistrationFormat {
  sections?: string[];
  suggestedFields?: string[];
  fields?: string[];
  description?: string;
  [key: string]: unknown;
}

export interface NormalizedExercise {
  number: number;
  statement: string;
  contextOrData: string;
  hint: string;
  expectedOutputOrCriteria: string;
  solution?: string;
}

export interface NormalizedStep {
  stepNumber?: number;
  title?: string;
  description: string;
  estimatedHours?: number | string;
  deliverable?: string;
  stepText: string;
}

/**
 * Normaliza un ítem de material que puede ser string plano u objeto de legacy schema
 */
export function resolveMaterialString(mat: unknown): string {
  if (!mat) return '';
  if (typeof mat === 'string') return mat;
  if (typeof mat === 'object') {
    const m = mat as LegacyWorkbookMaterial;
    const item = m.item || m.material || m.name || '';
    const qty = m.quantity || m.cantidad ? `[${m.quantity || m.cantidad}]` : '';
    const notes = m.notes || m.notas ? `— ${m.notes || m.notas}` : '';
    const res = `${item} ${qty} ${notes}`.replace(/\s+/g, ' ').trim();
    return res || JSON.stringify(mat);
  }
  return String(mat);
}

/**
 * Normaliza un paso procedimental que puede ser string plano u objeto estructurado
 */
export function resolveStepDetails(step: unknown): NormalizedStep {
  if (!step) {
    return { description: '', stepText: '' };
  }
  if (typeof step === 'string') {
    return { description: step, stepText: step };
  }
  if (typeof step === 'object') {
    const s = step as LegacyWorkbookStep;
    const stepNumber = s.stepNumber ?? s.number;
    const title = s.title ?? s.titulo;
    const description = s.description ?? s.descripcion ?? s.instruction ?? s.action ?? '';
    const estimatedHours = s.estimatedHours ?? s.durationMinutes;
    const deliverable = s.deliverable ?? s.entregable;

    const numStr = stepNumber ? `Paso ${stepNumber}: ` : '';
    const titleStr = title ? `${title}. ` : '';
    const hrsStr = estimatedHours ? ` (${estimatedHours} hrs)` : '';
    const delivStr = deliverable ? ` [Entregable: ${deliverable}]` : '';
    const stepText = `${numStr}${titleStr}${description}${hrsStr}${delivStr}`.trim();

    return {
      stepNumber,
      title,
      description,
      estimatedHours,
      deliverable,
      stepText,
    };
  }
  const text = String(step);
  return { description: text, stepText: text };
}

/**
 * Normaliza ejercicios de evaluación con soporte para campos legacy (español e inglés)
 */
export function resolveExercise(ex: TieredExercise | LegacyWorkbookExercise | unknown, fallbackIndex: number = 1): NormalizedExercise {
  if (!ex || typeof ex !== 'object') {
    return {
      number: fallbackIndex,
      statement: String(ex || ''),
      contextOrData: '',
      hint: '',
      expectedOutputOrCriteria: '',
    };
  }
  const e = ex as LegacyWorkbookExercise & Partial<TieredExercise>;
  return {
    number: e.number ?? e.exerciseNumber ?? fallbackIndex,
    statement: e.statement || e.problemStatement || '',
    contextOrData: e.contextOrData || e.contexto || '',
    hint: e.hint || e.pista || '',
    expectedOutputOrCriteria: e.expectedOutputOrCriteria || e.evaluationCriteria || '',
    solution: e.solution || e.solucion,
  };
}

/**
 * Normaliza y formatea el formato de registro de portafolio para DOCX o PDF
 */
export function formatRegistrationFormatText(rf: unknown, mode: 'docx' | 'pdf' = 'docx'): string {
  if (!rf) return '';
  if (typeof rf === 'string') return rf;
  if (typeof rf === 'object') {
    const formatObj = rf as LegacyRegistrationFormat;
    const parts: string[] = [];
    if (formatObj.sections && Array.isArray(formatObj.sections)) {
      if (mode === 'docx') {
        parts.push(`Secciones requeridas:\n${formatObj.sections.map((s: string) => ` • ${s}`).join('\n')}`);
      } else {
        parts.push(`Secciones: ${formatObj.sections.join(' | ')}`);
      }
    }
    const fields = formatObj.suggestedFields || formatObj.fields;
    if (fields && Array.isArray(fields)) {
      if (mode === 'docx') {
        parts.push(`Campos sugeridos:\n${fields.map((f: string) => ` - ${f}`).join('\n')}`);
      } else {
        parts.push(`Campos: ${fields.join(' | ')}`);
      }
    }
    if (formatObj.description) {
      parts.push(`Descripción: ${formatObj.description}`);
    }
    return parts.join(mode === 'docx' ? '\n\n' : '\n') || (mode === 'docx' ? JSON.stringify(rf, null, 2) : JSON.stringify(rf));
  }
  return String(rf);
}
