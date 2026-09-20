import { z } from 'zod';

/**
 * curriculum-schema.ts
 * Schemas Zod para validación formal y Quality Gate del Catálogo Canónico Oficial EMS (SEP / BGE).
 */

export const ContenidoFormativoSchema = z.object({
  order: z.number().int().positive('El orden del propósito debe ser positivo'),
  proposito: z.string().min(10, 'El propósito formativo debe tener al menos 10 caracteres'),
  contenidos: z
    .array(z.string().trim().min(1, 'El contenido formativo no puede estar vacío'))
    .min(1, 'Cada propósito formativo debe contener al menos 1 contenido formativo'),
});

export const ActivitySchema = z.object({
  order: z.number().int().positive('El orden de la actividad debe ser positivo'),
  name: z.string().trim().min(3, 'El nombre de la actividad/progresión debe tener al menos 3 caracteres'),
  hours: z.number().int().nonnegative('Las horas deben ser un número no negativo').optional(),
});

export const ComponentEnum = z.enum([
  'fundamental',
  'laboral',
  'ffe_optativa',
  'ffeo',
  'socioemocional',
]);

export const ModelTypeEnum = z.enum([
  'progresiones',
  'propositos_contenidos',
]);

export const SubsystemEnum = z.literal('bge');

export const UACSchema = z.object({
  uac_name: z.string().trim().min(3, 'El nombre de la UAC debe tener al menos 3 caracteres'),
  semester: z.number().int().min(1, 'Semestre mínimo es 1').max(6, 'Semestre máximo es 6'),
  component: ComponentEnum,
  subsystem: SubsystemEnum,
  total_hours: z.number().int().positive('total_hours debe ser mayor a 0'),
  learning_outcome: z.string().trim().min(10, 'learning_outcome debe tener al menos 10 caracteres').nullable(),
  activities: z.array(ActivitySchema),
  evidences: z.array(z.string().trim().min(3, 'Cada evidencia debe tener al menos 3 caracteres')),
  contenidos_formativos: z.array(ContenidoFormativoSchema).nullable(),
  model_type: ModelTypeEnum,
  year: z.number().int().min(2020).max(2030),
  curriculum_name: z.string().trim().min(2, 'curriculum_name debe ser válido'),
});

export const CanonicalCurriculumSchema = z.array(UACSchema);

export type ContenidoFormativo = z.infer<typeof ContenidoFormativoSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type ComponentType = z.infer<typeof ComponentEnum>;
export type ModelType = z.infer<typeof ModelTypeEnum>;
export type UACCanonical = z.infer<typeof UACSchema>;
export type CanonicalCurriculum = z.infer<typeof CanonicalCurriculumSchema>;
