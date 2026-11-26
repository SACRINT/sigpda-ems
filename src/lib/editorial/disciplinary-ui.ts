/**
 * disciplinary-ui.ts — Adaptador Editorial de Etiquetas y Paleta por Dominio Disciplinar
 * SIGPDA-EMS · Fase 1 Rescate del Libro Editorial (Typst)
 *
 * Elimina textos matemáticos hardcodeados de `workbook-template.typ` derivando
 * encabezados, metodología y paleta editorial sobria desde los 17 dominios reales
 * de `DisciplinaryDomainId` (`src/lib/prompts/disciplinary-adapters`).
 */

import { z } from 'zod';
import {
  getDisciplinaryAdapter,
  type DisciplinaryDomainId,
} from '@/lib/prompts/disciplinary-adapters';

export const DISCIPLINARY_DOMAIN_IDS = [
  'pensamiento_matematico',
  'ciencias_fisica_ingenieria',
  'ciencias_quimica_biologia_ambiental',
  'lengua_comunicacion_literatura',
  'lengua_extranjera_ingles',
  'lengua_extranjera_general',
  'conciencia_historica_ciencias_sociales',
  'humanidades_filosofia_logica_etica',
  'cultura_digital_programacion_ti',
  'dibujo_tecnico_diseno_arquitectura',
  'actividades_fisicas_deportivas_salud',
  'artes_educacion_artistica_cultural',
  'socioemocional_tutoria_educacion_integral',
  'formacion_laboral_servicios_gestion_turismo',
  'formacion_laboral_salud_clinica',
  'formacion_laboral_industrial_agro_salud',
  'indagacion_interdisciplinaria_general',
] as const satisfies readonly DisciplinaryDomainId[];

export const EditorialDisciplinaryUiSchema = z.object({
  domainId: z.enum(DISCIPLINARY_DOMAIN_IDS),
  palette: z.object({
    primary: z.string().regex(/^[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^[0-9a-fA-F]{6}$/),
    teal: z.string().regex(/^[0-9a-fA-F]{6}$/),
    tealBg: z.string().regex(/^[0-9a-fA-F]{6}$/),
  }),
  labels: z.object({
    conceptHeading: z.string().min(5),
    exampleHeading: z.string().min(5),
    methodologyTheoryBullet: z.string().min(10),
    methodologyExampleBullet: z.string().min(10),
    sidenoteTitle: z.string().min(3),
  }),
});

export type EditorialDisciplinaryUi = z.infer<typeof EditorialDisciplinaryUiSchema>;

const DOMAIN_EDITORIAL_UI: Record<DisciplinaryDomainId, EditorialDisciplinaryUi> = {
  pensamiento_matematico: {
    domainId: 'pensamiento_matematico',
    palette: { primary: '0f294a', accent: 'c98a2c', teal: '0d766e', tealBg: 'f0fdfa' },
    labels: {
      conceptHeading: 'Conceptos Fundamentales y Modelado Matemático',
      exampleHeading: 'Ejemplo Resuelto con Números: Paso a Paso',
      methodologyTheoryBullet: 'Fórmulas, definiciones rigurosas y modelos matemáticos claros.',
      methodologyExampleBullet: 'Procedimientos numéricos explícitos para ver cómo se aplican las fórmulas y métodos.',
      sidenoteTitle: 'Concepto y Fórmula Clave',
    },
  },
  ciencias_fisica_ingenieria: {
    domainId: 'ciencias_fisica_ingenieria',
    palette: { primary: '0f3554', accent: 'c86d2d', teal: '0e7490', tealBg: 'ecfeff' },
    labels: {
      conceptHeading: 'Fundamentos Físicos y Modelado de Fenómenos',
      exampleHeading: 'Ejemplo Resuelto con Magnitudes y Unidades: Paso a Paso',
      methodologyTheoryBullet: 'Leyes físicas, relaciones cuantitativas y modelos explicativos claros.',
      methodologyExampleBullet: 'Resolución paso a paso con unidades del SI, diagramas y verificación física.',
      sidenoteTitle: 'Ley y Magnitud Clave',
    },
  },
  ciencias_quimica_biologia_ambiental: {
    domainId: 'ciencias_quimica_biologia_ambiental',
    palette: { primary: '14453d', accent: 'c98a2c', teal: '1f7a5a', tealBg: 'f0fdf4' },
    labels: {
      conceptHeading: 'Fundamentos Científicos y Procesos Experimentales',
      exampleHeading: 'Caso Experimental Analizado: Paso a Paso',
      methodologyTheoryBullet: 'Principios científicos, mecanismos biológicos o químicos y explicaciones rigurosas.',
      methodologyExampleBullet: 'Procedimientos de laboratorio y análisis de evidencias explicados paso a paso.',
      sidenoteTitle: 'Concepto Científico Clave',
    },
  },
  lengua_comunicacion_literatura: {
    domainId: 'lengua_comunicacion_literatura',
    palette: { primary: '5b1e2d', accent: 'b57c2a', teal: '1e4d6b', tealBg: 'f8fafc' },
    labels: {
      conceptHeading: 'Fundamentos Textuales y Análisis Comunicativo',
      exampleHeading: 'Ejemplo Comentado y Analizado: Paso a Paso',
      methodologyTheoryBullet: 'Categorías lingüísticas, recursos expresivos y teoría literaria sin tecnicismos innecesarios.',
      methodologyExampleBullet: 'Lecturas, fragmentos y modelos de redacción analizados paso a paso en contexto.',
      sidenoteTitle: 'Glosario Textual Clave',
    },
  },
  lengua_extranjera_ingles: {
    domainId: 'lengua_extranjera_ingles',
    palette: { primary: '163d6b', accent: 'c97a2b', teal: '1d5b8c', tealBg: 'eff6ff' },
    labels: {
      conceptHeading: 'Fundamentos Lingüísticos y Estructuras Comunicativas',
      exampleHeading: 'Modelo Comunicativo Analizado: Paso a Paso',
      methodologyTheoryBullet: 'Estructuras gramaticales, vocabulario funcional y usos comunicativos en contexto real.',
      methodologyExampleBullet: 'Diálogos, oraciones y modelos de comprensión aplicados paso a paso.',
      sidenoteTitle: 'Key Concept / Glosario',
    },
  },
  lengua_extranjera_general: {
    domainId: 'lengua_extranjera_general',
    palette: { primary: '1e3a5f', accent: 'c96a3b', teal: '2b4c7e', tealBg: 'f0f4fa' },
    labels: {
      conceptHeading: 'Fundamentos Comunicativos e Interculturales',
      exampleHeading: 'Modelo de Interacción Analizado: Paso a Paso',
      methodologyTheoryBullet: 'Estructuras funcionales, vocabulario situado y claves interculturales claras.',
      methodologyExampleBullet: 'Ejemplos comunicativos comentados paso a paso para situaciones cotidianas.',
      sidenoteTitle: 'Glosario Comunicativo',
    },
  },
  conciencia_historica_ciencias_sociales: {
    domainId: 'conciencia_historica_ciencias_sociales',
    palette: { primary: '4a2c1d', accent: 'c57b27', teal: '7a352e', tealBg: 'fef9f3' },
    labels: {
      conceptHeading: 'Fundamentos Históricos y Análisis Socioeconómico',
      exampleHeading: 'Estudio de Caso y Fuentes Analizado: Paso a Paso',
      methodologyTheoryBullet: 'Procesos históricos, categorías sociales y análisis de fuentes con rigor crítico.',
      methodologyExampleBullet: 'Casos históricos y problemáticas sociales explicados paso a paso con evidencia documental.',
      sidenoteTitle: 'Categoría Histórica Clave',
    },
  },
  humanidades_filosofia_logica_etica: {
    domainId: 'humanidades_filosofia_logica_etica',
    palette: { primary: '2b3a4f', accent: 'a6842d', teal: '4c5d73', tealBg: 'f8f7f3' },
    labels: {
      conceptHeading: 'Fundamentos Filosóficos y Argumentación Crítica',
      exampleHeading: 'Análisis de Dilema y Argumento: Paso a Paso',
      methodologyTheoryBullet: 'Tradiciones filosóficas, criterios éticos y herramientas de reflexión rigurosa.',
      methodologyExampleBullet: 'Dilemas, premisas y textos filosóficos examinados paso a paso con método argumentativo.',
      sidenoteTitle: 'Concepto Filosófico Clave',
    },
  },
  cultura_digital_programacion_ti: {
    domainId: 'cultura_digital_programacion_ti',
    palette: { primary: '0f3557', accent: '1f8a70', teal: '1e6fb8', tealBg: 'f0f9ff' },
    labels: {
      conceptHeading: 'Fundamentos Digitales y Pensamiento Algorítmico',
      exampleHeading: 'Desarrollo Lógico y Prototipo: Paso a Paso',
      methodologyTheoryBullet: 'Principios computacionales, ciudadanía digital y lógica algorítmica explicados con claridad.',
      methodologyExampleBullet: 'Algoritmos, flujos de datos y prácticas digitales desarrollados paso a paso.',
      sidenoteTitle: 'Concepto Digital Clave',
    },
  },
  dibujo_tecnico_diseno_arquitectura: {
    domainId: 'dibujo_tecnico_diseno_arquitectura',
    palette: { primary: '1b4965', accent: 'c98a2c', teal: '3a5a72', tealBg: 'f1f5f9' },
    labels: {
      conceptHeading: 'Fundamentos de Expresión Gráfica y Planimetría',
      exampleHeading: 'Trazo y Construcción Técnica: Paso a Paso',
      methodologyTheoryBullet: 'Normas de representación gráfica, escalas y proyecciones técnicas claras.',
      methodologyExampleBullet: 'Procedimientos de trazo, acotación y diseño desarrollados paso a paso.',
      sidenoteTitle: 'Norma Gráfica Clave',
    },
  },
  actividades_fisicas_deportivas_salud: {
    domainId: 'actividades_fisicas_deportivas_salud',
    palette: { primary: '16425b', accent: 'd96528', teal: '1f7a5a', tealBg: 'fff7ed' },
    labels: {
      conceptHeading: 'Fundamentos del Movimiento, Condición Física y Salud',
      exampleHeading: 'Rutina y Ejecución Técnica Guiada: Paso a Paso',
      methodologyTheoryBullet: 'Principios biomecánicos, higiene postural y hábitos saludables claros.',
      methodologyExampleBullet: 'Secuencias motrices, dosificación del esfuerzo y técnica corporal paso a paso.',
      sidenoteTitle: 'Criterio de Salud y Técnica',
    },
  },
  artes_educacion_artistica_cultural: {
    domainId: 'artes_educacion_artistica_cultural',
    palette: { primary: '4c2a5c', accent: 'd48a29', teal: '7b3f8c', tealBg: 'faf5ff' },
    labels: {
      conceptHeading: 'Fundamentos Estéticos y Lenguajes Artísticos',
      exampleHeading: 'Proceso Creativo y Obra Analizada: Paso a Paso',
      methodologyTheoryBullet: 'Elementos compositivos, apreciación estética y patrimonio cultural explicados con claridad.',
      methodologyExampleBullet: 'Ejercicios de creación e interpretación artística guiados paso a paso.',
      sidenoteTitle: 'Concepto Estético Clave',
    },
  },
  socioemocional_tutoria_educacion_integral: {
    domainId: 'socioemocional_tutoria_educacion_integral',
    palette: { primary: '3d3461', accent: '2a8c6e', teal: '5b4e8c', tealBg: 'f5f3ff' },
    labels: {
      conceptHeading: 'Fundamentos del Bienestar Integral y Socioemocional',
      exampleHeading: 'Situación Cotidiana Analizada: Paso a Paso',
      methodologyTheoryBullet: 'Herramientas de autocuidado, convivencia respetuosa y bienestar integral claras.',
      methodologyExampleBullet: 'Casos reales de toma de decisiones y gestión emocional analizados paso a paso.',
      sidenoteTitle: 'Clave de Bienestar',
    },
  },
  formacion_laboral_servicios_gestion_turismo: {
    domainId: 'formacion_laboral_servicios_gestion_turismo',
    palette: { primary: '123b5d', accent: 'c96a2b', teal: '1f6f78', tealBg: 'f0fdfa' },
    labels: {
      conceptHeading: 'Fundamentos Técnicos, Normativos y de Servicio',
      exampleHeading: 'Procedimiento Operativo Estándar: Paso a Paso',
      methodologyTheoryBullet: 'Estándares operativos, normativa vigente y criterios de calidad en el servicio.',
      methodologyExampleBullet: 'Procesos administrativos, contables o de servicio ejecutados paso a paso.',
      sidenoteTitle: 'Estándar Técnico Clave',
    },
  },
  formacion_laboral_salud_clinica: {
    domainId: 'formacion_laboral_salud_clinica',
    palette: { primary: '145343', accent: 'b83b3b', teal: '1f7a5a', tealBg: 'f0fdf4' },
    labels: {
      conceptHeading: 'Fundamentos Clínicos, Bioseguridad y Atención en Salud',
      exampleHeading: 'Protocolo Clínico y de Bioseguridad: Paso a Paso',
      methodologyTheoryBullet: 'Bases anatomofisiológicas, prevención de riesgos y protocolos sanitarios vigentes.',
      methodologyExampleBullet: 'Procedimientos clínicos supervisados y medidas de bioseguridad paso a paso.',
      sidenoteTitle: 'Protocolo Clave de Salud',
    },
  },
  formacion_laboral_industrial_agro_salud: {
    domainId: 'formacion_laboral_industrial_agro_salud',
    palette: { primary: '1f4e79', accent: 'c98a1c', teal: '2b6e57', tealBg: 'f8fafc' },
    labels: {
      conceptHeading: 'Fundamentos Técnicos, Operativos y de Seguridad',
      exampleHeading: 'Procedimiento de Taller y Campo: Paso a Paso',
      methodologyTheoryBullet: 'Especificaciones técnicas, normas de seguridad industrial (EPP) y criterios operativos.',
      methodologyExampleBullet: 'Secuencias técnicas de instalación, medición o producción explicadas paso a paso.',
      sidenoteTitle: 'Criterio Técnico y EPP',
    },
  },
  indagacion_interdisciplinaria_general: {
    domainId: 'indagacion_interdisciplinaria_general',
    palette: { primary: '0f294a', accent: 'c98a2c', teal: '1f7a5a', tealBg: 'f0fdfa' },
    labels: {
      conceptHeading: 'Conceptos Fundamentales e Indagación Interdisciplinaria',
      exampleHeading: 'Caso Resuelto y Analizado: Paso a Paso',
      methodologyTheoryBullet: 'Conceptos clave, principios disciplinarios y explicaciones claras sin tecnicismos innecesarios.',
      methodologyExampleBullet: 'Modelos y casos aplicados paso a paso para observar el criterio en contexto.',
      sidenoteTitle: 'Glosario Clave',
    },
  },
};

/**
 * Resuelve la configuración editorial (etiquetas y paleta) para cualquier UAC
 * a partir de los 17 dominios canónicos de `DisciplinaryDomainId`.
 */
export function resolveEditorialDisciplinaryUi(
  uacName?: string | null,
  component?: string | null,
): EditorialDisciplinaryUi {
  const adapter = getDisciplinaryAdapter(uacName || '', component || undefined);
  return DOMAIN_EDITORIAL_UI[adapter.id] ?? DOMAIN_EDITORIAL_UI.indagacion_interdisciplinaria_general;
}
