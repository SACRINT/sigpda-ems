export type SacrintStyleId = 'exactas' | 'naturales' | 'humanidades' | 'socioemocional' | 'tecnica' | 'general';

export interface SacrintVisualStyle {
  id: SacrintStyleId;
  label: string;
  description: string;
  coverCaption: string;
}

export const SACRINT_STYLES: Record<SacrintStyleId, SacrintVisualStyle> = {
  exactas: {
    id: 'exactas',
    label: 'Exactas y modelos',
    description: 'Retícula técnica, construcción geométrica y medición.',
    coverCaption: 'ANCLA VISUAL · GEOMETRÍA',
  },
  naturales: {
    id: 'naturales',
    label: 'Ciencias naturales',
    description: 'Red molecular, pulso y observación clínica.',
    coverCaption: 'ANCLA VISUAL · RED MOLECULAR',
  },
  humanidades: {
    id: 'humanidades',
    label: 'Humanidades',
    description: 'Página abierta, columnas y argumento.',
    coverCaption: 'ANCLA VISUAL · PÁGINA ABIERTA',
  },
  socioemocional: {
    id: 'socioemocional',
    label: 'Socioemocional',
    description: 'Ondas suaves, círculos y contención.',
    coverCaption: 'ANCLA VISUAL · ONDAS',
  },
  tecnica: {
    id: 'tecnica',
    label: 'Técnica y acción',
    description: 'Bloques, chevrones y movimiento.',
    coverCaption: 'ANCLA VISUAL · ACCIÓN',
  },
  general: {
    id: 'general',
    label: 'General',
    description: 'Estructura neutra para asignaturas sin familia.',
    coverCaption: 'ANCLA VISUAL · ESTRUCTURA',
  },
} as const;

export const SACRINT_STYLE_BY_PACK: Record<string, SacrintStyleId> = {
  matematicas: 'exactas',
  fisica: 'exactas',
  quimica: 'naturales',
  biologia: 'naturales',
  salud: 'naturales',
  filosofia: 'humanidades',
  literatura: 'humanidades',
  ingles: 'humanidades',
  historia: 'humanidades',
  tecnologia: 'tecnica',
  laboral: 'tecnica',
  artes: 'tecnica',
  educacion_fisica: 'tecnica',
  socioemocional: 'socioemocional',
  general: 'general',
};

export function resolveSacrintStyle(packId: string | undefined): SacrintVisualStyle {
  const id = packId ? SACRINT_STYLE_BY_PACK[packId] : undefined;
  return SACRINT_STYLES[id ?? 'general'];
}
