import { z } from 'zod';
import { nullableString } from './zod-helpers';

/**
 * Specialized prompts and schemas for extracting structured PMC data from previous documents (PDF / Word DOCX).
 * Aligned with MCCEMS and New School Model (NEM) guidelines.
 */

export const PmcPreviousExtractSchema = z.object({
  schoolName: nullableString(),
  schoolCct: nullableString(),
  municipality: nullableString(),
  locality: nullableString(),
  schoolZone: nullableString(),
  directorName: nullableString(),
  supervisorName: nullableString(),
  cicloEscolar: nullableString('2025-2026'),
  subsystem: nullableString('BGE'),
  totalStaff: z.coerce.number().optional(),
  participantes: z.array(z.object({
    nombre: nullableString(),
    cargo: nullableString(),
    firma: nullableString(),
  })).max(40).optional().default([]),
  staffData: z.array(z.object({
    nombre: nullableString(),
    cargo: nullableString('Docente'),
    meta_individual: nullableString(),
    metas_individuales: z.array(z.object({
      categoria: nullableString(),
      tema: nullableString(),
      meta: nullableString(),
      estrategia: nullableString(),
      entregable: nullableString(),
      periodo: nullableString(),
    })).optional().default([]),
  })).max(40).optional().default([]),
  metas_institucionales_previas: z.array(z.object({
    categoria: nullableString(),
    tema: nullableString(),
    meta: nullableString(),
    linea_base: nullableString(),
    estrategia: nullableString(),
    responsable: nullableString(),
    entregable: nullableString(),
    periodo: nullableString(),
  })).max(15).optional().default([]),
  categorias_priorizadas: z.array(z.object({
    categoria: nullableString(),
    temas: z.array(z.string()).optional().default([]),
  })).optional().default([]),
  diagnosticoComunidad: nullableString(),
  indicadores: z.object({
    matricula: z.coerce.number().nullable().optional(),
    matricula_meta: z.coerce.number().nullable().optional(),
    aprobacion_ant: z.coerce.number().nullable().optional(),
    aprobacion_meta: z.coerce.number().nullable().optional(),
    reprobacion_ant: z.coerce.number().nullable().optional(),
    reprobacion_meta: z.coerce.number().nullable().optional(),
    abandono_ant: z.coerce.number().nullable().optional(),
    abandono_meta: z.coerce.number().nullable().optional(),
    et_ant: z.coerce.number().nullable().optional(),
    et_meta: z.coerce.number().nullable().optional(),
    promedio_f11: z.coerce.number().nullable().optional(),
    promedio_meta: z.coerce.number().nullable().optional(),
  }).partial().optional().default({}),
  foda: z.object({
    fortalezas: nullableString(),
    oportunidades: nullableString(),
    debilidades: nullableString(),
    amenazas: nullableString(),
  }).partial().optional().default({}),
});

export type PmcPreviousExtractDTO = z.infer<typeof PmcPreviousExtractSchema>;

export const PMC_EXTRACTION_SYSTEM_PROMPT = `Eres un auditor y especialista educativo experto en el Programa de Mejora Continua (PMC) de la Educación Media Superior en México (MCCEMS / NEM).
Tu objetivo es analizar textos extraídos de documentos previos del PMC (PDFs o archivos Word) y estructurar con precisión todos los datos encontrados.
Debes responder EXCLUSIVAMENTE con un objeto JSON válido, sin bloques de código markdown, explicaciones ni comentarios.`;

export function buildPmcExtractionPrompt(documentText: string): string {
  return `Analiza con minuciosidad el siguiente documento correspondiente a un Programa de Mejora Continua (PMC) previo y extrae la información institucional, de personal, diagnóstica y académica.

TEXTO DEL DOCUMENTO:
"""
${documentText.slice(0, 250000)}
"""

Estructura la información en el siguiente esquema JSON exacto:
{
  "schoolName": "Nombre oficial del plantel o escuela (ej. Bachillerato General Oficial 'Moisés Sáenz Garza')",
  "schoolCct": "Clave de Centro de Trabajo (10 caracteres alfanuméricos, ej. 21EBH0465E)",
  "municipality": "Municipio donde se ubica el plantel (ej. Fco. Z. Mena)",
  "locality": "Localidad o comunidad del plantel (ej. El Tecomate)",
  "schoolZone": "Zona escolar a la que pertenece (ej. 004, 013, etc.)",
  "directorName": "Nombre completo del Director(a) o Responsable del plantel (limpio de prefijos como Profr., ej. Juan Rogelio García Escudero)",
  "supervisorName": "Nombre completo del Supervisor(a) escolar (limpio de prefijos, ej. Alejandro Escamilla Martínez)",
  "cicloEscolar": "Ciclo escolar del documento (ej. 2025-2026, 2026-2027)",
  "subsystem": "Subsistema (ej. BGE, Bachillerato Tecnológico, TBC, etc.)",
  "totalStaff": número entero con el total de personal reportado (o null si no se especifica),
  "participantes": [
    {
      "nombre": "Nombre completo del participante o firmante (director, docentes, tutores, alumnos, supervisores)",
      "cargo": "Director(a) | Docente | Tutor(a) | Alumno(a) | Supervisor(a) | etc.",
      "firma": "Anotación de firma (o vacía)"
    }
  ],
  "staffData": [
    {
      "nombre": "Nombre completo del docente o directivo (limpio de prefijos Profr., Profra., Ing., Lic.)",
      "cargo": "Director(a) | Docente y tutor del plantel | Docente y tutor de grupo | Docente de grupo | Docente de tiempo completo | Administrativo | etc.",
      "meta_individual": "Meta o compromiso si se especifica",
      "metas_individuales": [
        {
          "categoria": "Categoría Oficial exacta: 'Desarrollo académico y aprendizaje' | 'Gestión y administración escolar' | 'Desarrollo socioemocional y prevención de la violencia en la escuela'",
          "tema": "Tema o ámbito oficial específico (ej. Trabajo Colegiado, Proyecto Escolar Comunitario PEC, Indicadores académicos, Planeación Didáctica, Seguimiento al desempeño docente en el aula, Seguimiento a egresados, Ámbitos de Formación Socioemocional, etc.)",
          "meta": "Meta individual o institucional asignada",
          "estrategia": "Estrategia o acciones a realizar",
          "entregable": "Producto o evidencia de entrega",
          "periodo": "Periodo de ejecución"
        }
      ]
    }
  ],
  "categorias_priorizadas": [
    {
      "categoria": "Categoría Oficial exacta",
      "temas": ["Tema 1", "Tema 2"]
    }
  ],
  "metas_institucionales_previas": [
    {
      "categoria": "Categoría Oficial exacta",
      "tema": "Tema o ámbito oficial",
      "meta": "Redacción completa de la meta del Plan de Acción",
      "linea_base": "Diagnóstico o situación inicial detectada",
      "estrategia": "Estrategias y/o acciones colegiadas acordadas",
      "responsable": "Responsables asignados (ej. Director y docentes, Asesor de grupo, etc.)",
      "entregable": "Evidencia o producto esperado (ej. Fotografías, minutas, reportes, etc.)",
      "periodo": "Cronograma o periodo de ejecución"
    }
  ],
  "diagnosticoComunidad": "Diagnóstico de la comunidad y del entorno escolar (descripción textual amplia, contexto social, económico y cultural)",
  "indicadores": {
    "matricula": número de alumnos inscritos (o null si no se especifica),
    "matricula_meta": número de alumnos proyectados como meta (o null si no se especifica),
    "aprobacion_ant": porcentaje de aprobación previo (número 0-100 o null),
    "aprobacion_meta": porcentaje de aprobación proyectado como meta (número 0-100 o null),
    "reprobacion_ant": porcentaje de reprobación previo (número 0-100 o null),
    "reprobacion_meta": porcentaje de reprobación meta (número 0-100 o null),
    "abandono_ant": porcentaje de abandono o deserción previo (número 0-100 o null),
    "abandono_meta": porcentaje de abandono meta (número 0-100 o null),
    "et_ant": porcentaje de eficiencia terminal previo (número 0-100 o null),
    "et_meta": porcentaje de eficiencia terminal meta (número 0-100 o null),
    "promedio_f11": promedio general de calificaciones previo (número 0-10 o null),
    "promedio_meta": promedio general de calificaciones proyectado como meta (número 0-10 o null)
  },
  "foda": {
    "fortalezas": "Fortalezas institucionales identificadas en el diagnóstico o cuadro FODA",
    "oportunidades": "Oportunidades del entorno exterior detectadas",
    "debilidades": "Debilidades internas de la escuela o comunidad escolar",
    "amenazas": "Amenazas o riesgos externos que impactan a la escuela"
  }
}

REGLAS DE EXTRACCIÓN:
1. Conserva la redacción textual del diagnóstico de la comunidad y de los cuatro cuadrantes del FODA a partir de los cuadros de diagnóstico y tablas FODA del documento.
2. Si el documento contiene porcentajes de indicadores académicos (reprobación, abandono, aprobación), extráelos como números limpios.
3. OBLIGATORIO - AUTORIDADES Y ZONA: Extrae el directorName del responsable del bachillerato o director firmante. Extrae el supervisorName del supervisor escolar y la schoolZone del bloque de control de revisiones o firmas (ej. 'SUPERVISOR ESCOLAR ZONA 004' -> supervisor: 'Alejandro Escamilla Martínez', zona: '004').
4. OBLIGATORIO - EXTRAE A TODO EL PERSONAL DEL PLANTEL EN staffData:
   - Extrae a cada docente, tutor del plantel, tutor de grupo, subdirector o administrativo que figure en las tablas de participantes, comités o acuerdos del colectivo escolar.
   - Preserva su cargo específico (ej. 'Docente y tutor del plantel', 'Docente y tutor de grupo', 'Docente de grupo').
   - EXCLUYE estudiantes o alumnos de staffData (los alumnos solo van en 'participantes').
   - Limpia los nombres de prefijos como 'PROFR.', 'PROFRA.', 'ING.', 'LIC.'.
5. OBLIGATORIO - PLAN DE ACCIÓN Y METAS:
   - Extrae exhaustivamente TODAS las metas de las tablas del Plan de Acción (incluyendo diagnóstico, acciones acordadas, responsables, cronograma y evidencias).
   - Extrae todas las tablas de metas encontradas (pueden ser 10 o más), no te limites a un resumen general.
6. OBLIGATORIO: Asigna en 'categoria' ÚNICAMENTE una de las 3 categorías oficiales de los Lineamientos del PMC:
   - 'Desarrollo académico y aprendizaje'
   - 'Gestión y administración escolar'
   - 'Desarrollo socioemocional y prevención de la violencia en la escuela'`;
}
