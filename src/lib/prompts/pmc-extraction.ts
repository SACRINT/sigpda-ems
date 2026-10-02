import { z } from 'zod';
import { nullableString, nullableStringOrArray } from './zod-helpers';

/**
 * Specialized prompts and schemas for extracting structured PMC data from previous documents (PDF / Word DOCX).
 * Aligned with MCCEMS and New School Model (NEM) guidelines (PMC-EXTRACT v6.4).
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
  participantes: z.preprocess(
    (val) => {
      if (!Array.isArray(val)) return [];
      return val.map((item) => {
        if (typeof item === 'string') return { nombre: item, cargo: null, firma: null };
        if (item && typeof item === 'object') return item;
        return null;
      }).filter(Boolean);
    },
    z.array(z.object({
      nombre: nullableString(),
      cargo: nullableString(),
      firma: nullableString(),
    })).max(100).optional().default([])
  ),
  staffData: z.preprocess(
    (val) => {
      if (!Array.isArray(val)) return [];
      return val.map((item) => {
        if (typeof item === 'string') {
          return {
            nombre: item,
            cargo: 'Docente',
            meta_individual: null,
            metas_individuales: [],
          };
        }
        return item;
      }).filter(Boolean);
    },
    z.array(z.object({
      nombre: nullableString(),
      cargo: nullableString('Docente'),
      meta_individual: nullableString(),
      metas_individuales: z.preprocess(
        (val) => {
          if (!Array.isArray(val)) return [];
          return val.map((item) => {
            if (typeof item === 'string') {
              return {
                categoria: null,
                tema: null,
                meta: item,
                estrategia: null,
                entregable: null,
                periodo: null,
              };
            }
            return item;
          }).filter(Boolean);
        },
        z.array(z.object({
          categoria: nullableString(),
          tema: nullableString(),
          meta: nullableString(),
          estrategia: nullableString(),
          entregable: nullableString(),
          periodo: nullableString(),
        })).optional().default([])
      ),
    })).max(100).optional().default([])
  ),
  metas_institucionales_previas: z.preprocess(
    (val) => {
      if (!Array.isArray(val)) return [];
      return val.map((item) => {
        if (typeof item === 'string') {
          return {
            numero_origen: null,
            categoria: null,
            tema: null,
            meta: item,
            linea_base: null,
            estrategia: null,
            responsable: null,
            entregable: null,
            periodo: null,
          };
        }
        return item;
      }).filter(Boolean);
    },
    z.array(z.object({
      numero_origen: z.coerce.number().nullable().optional(),
      categoria: nullableString(),
      tema: nullableString(),
      meta: nullableString(),
      linea_base: nullableString(),
      estrategia: nullableString(),
      responsable: nullableString(),
      entregable: nullableString(),
      periodo: nullableString(),
    })).max(100).optional().default([])
  ),
  elementos_plan: z.preprocess(
    (val) => (Array.isArray(val) ? val : []),
    z.array(z.object({
      tipo: z.preprocess(
        (val) => {
          if (typeof val !== 'string') return 'meta';
          const lower = val.toLowerCase().trim();
          if (['meta', 'actividad', 'estrategia', 'indicador', 'responsable', 'evidencia', 'cronograma', 'otro'].includes(lower)) {
            return lower;
          }
          if (lower.includes('actividad') || lower.includes('tarea') || lower.includes('accion') || lower.includes('acción')) return 'actividad';
          if (lower.includes('estrategia') || lower.includes('linea') || lower.includes('línea')) return 'estrategia';
          if (lower.includes('indicador') || lower.includes('metrica') || lower.includes('métrica')) return 'indicador';
          if (lower.includes('responsable') || lower.includes('docente')) return 'responsable';
          if (lower.includes('evidencia') || lower.includes('entregable') || lower.includes('producto')) return 'evidencia';
          if (lower.includes('cronograma') || lower.includes('periodo') || lower.includes('fecha')) return 'cronograma';
          return 'meta';
        },
        z.enum(['meta', 'actividad', 'estrategia', 'indicador', 'responsable', 'evidencia', 'cronograma', 'otro'])
      ).default('meta'),
      numero_origen: z.coerce.number().nullable().optional(),
      celda_ref: z.preprocess((val) => (val == null ? undefined : String(val)), z.string().nullable().optional()),
      texto_original: z.preprocess((val) => (val != null ? String(val) : ''), z.string()),
      texto_normalizado: z.preprocess((val) => (val != null ? String(val) : ''), z.string()),
      categoria: nullableString(),
      tema: nullableString(),
      responsable: nullableString(),
      periodo: nullableString(),
      ubicacion: z.preprocess(
        (val) => (val && typeof val === 'object' ? val : undefined),
        z.object({
          pagina: z.coerce.number().nullable().optional(),
          seccion: nullableString(),
          tabla: nullableString(),
        }).partial().optional()
      ),
      requiere_revision: z.preprocess((val) => Boolean(val), z.boolean()).default(false),
      motivos_revision: z.preprocess(
        (val) => {
          if (Array.isArray(val)) return val.map((s) => String(s)).filter(Boolean);
          if (typeof val === 'string' && val.trim()) return [val.trim()];
          return undefined;
        },
        z.array(z.string()).optional()
      ),
    })).max(200).optional().default([])
  ),
  totales_detectados: z.object({
    metas: z.coerce.number().nullable().optional(),
    actividades: z.coerce.number().nullable().optional(),
  }).partial().optional().default({ metas: null, actividades: null }),
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
    fortalezas: nullableStringOrArray(),
    oportunidades: nullableStringOrArray(),
    debilidades: nullableStringOrArray(),
    amenazas: nullableStringOrArray(),
  }).partial().optional().default({}),
});

export type PmcPreviousExtractDTO = z.infer<typeof PmcPreviousExtractSchema>;
export type PmcPlanElement = NonNullable<PmcPreviousExtractDTO['elementos_plan']>[number];

export const PMC_EXTRACTION_SYSTEM_PROMPT = `Eres el AUDITOR EDUCATIVO Y ESTRUCTURADOR FORENSE DE DATOS de la plataforma SIGPDA-EMS (MCCEMS / NEM / DGB).
Tu objetivo es realizar la minería semántica y relacional completa de documentos del Programa de Mejora Continua (PMC) de planteles de bachillerato general.

PRINCIPIOS NO NEGOCIABLES:
1. FIDELIDAD DOCUMENTAL TOTAL: Jamás inventar, proyectar metas no escritas ni alucinar datos cuantitativos.
2. REGLA ANTI-COLAPSO B-001: Si una celda contiene N metas independientes, DEBES emitir N objetos independientes. Jamás agrupar varias metas en un solo registro.
3. INVARIANZA NUMÉRICA PURA: Cada cifra, porcentaje, fracción, fecha o ciclo escolar debe copiarse con precisión exacta entre la fuente y el esquema final.
4. ASOCIACIÓN HORIZONTAL ESTRICTA EN TABLAS (ANTI-DESPLAZAMIENTO):
En tablas donde la columna 'Responsable' está ubicada a la derecha de 'Meta(s)' y 'Estrategia y/o Acciones':
El docente o directivo nombrado en esa celda es el responsable ÚNICAMENTE de las metas y acciones de ESA MISMA FILA / RENGLÓN HORIZONTAL (a su izquierda en la misma línea de la tabla).
PROHIBIDO asociar al docente con las metas de la fila o bloque siguiente.
Ejemplo: Si en una fila la meta es "Realizar una instalación eléctrica..." y en la columna responsable de esa misma fila dice "Nemesio Loyda López", la meta le pertenece 100% a Nemesio Loyda López.
5. SALIDA EXCLUSIVAMENTE EN JSON VÁLIDO: Responde únicamente con un objeto JSON sin markdown exterior ni comentarios.`;

export interface StructuralPromptMetadata {
  formato?: string;
  ambito_numeracion?: string;
  k_metas_estimadas?: number | null;
  secuencia_indices?: number[];
  nonce?: string;
}

export function buildPmcExtractionPrompt(documentText: string, metaContext?: StructuralPromptMetadata): string {
  const nonce = metaContext?.nonce || Math.random().toString(36).substring(2, 10);
  const metadataHeader = metaContext
    ? `<<<METADATOS_ESTRUCTURALES>>>
- formato: "${metaContext.formato || 'CANONICO_MATRIZ'}"
- ambito_numeracion: "${metaContext.ambito_numeracion || 'GLOBAL_VERIFIABLE'}"
- k_metas_estimadas: ${metaContext.k_metas_estimadas ?? 'null'}
- secuencia_indices_detectada: ${JSON.stringify(metaContext.secuencia_indices || [])}
<<<FIN_METADATOS_ESTRUCTURALES>>>

AVISO DE CONTROL: "k_metas_estimadas" es una PISTA de referencia del pre-escáner. No fabriques metas que no existan para alcanzar ese número. Tu prioridad es extraer fielmente cada meta real del documento.\n\n`
    : '';

  return `${metadataHeader}Analiza con minuciosidad el siguiente documento correspondiente a un Programa de Mejora Continua (PMC) previo y extrae la información institucional, de personal, diagnóstica y académica.

<<<DOC_${nonce}>>>
${documentText.slice(0, 250000)}
<<<FIN_DOC_${nonce}>>>

Estructura la información en el siguiente esquema JSON exacto:
{
  "schoolName": "Nombre oficial del plantel o escuela (ej. Bachillerato General Oficial 'Héroes de la Patria')",
  "schoolCct": "Clave de Centro de Trabajo (10 caracteres, ej. 21EBH0200X)",
  "municipality": "Municipio donde se ubica el plantel",
  "locality": "Localidad o comunidad del plantel",
  "schoolZone": "Zona escolar (ej. 086, 004, etc.)",
  "directorName": "Nombre completo del Director(a) (limpio de prefijos como Profr., Ing., Lic.)",
  "supervisorName": "Nombre completo del Supervisor(a) escolar",
  "cicloEscolar": "Ciclo escolar del documento (ej. 2026-2027)",
  "subsystem": "Subsistema (ej. BGE)",
  "totalStaff": número entero con el total de personal reportado (o null),
  "participantes": [
    {
      "nombre": "Nombre completo del participante o firmante",
      "cargo": "Director(a) | Docente | Tutor(a) | Alumno(a) | Supervisor(a) | etc.",
      "firma": "Anotación de firma (o null)"
    }
  ],
  "staffData": [
    {
      "nombre": "Nombre completo del docente o directivo (limpio de prefijos)",
      "cargo": "Director(a) | Docente | Tutor(a) | etc.",
      "meta_individual": "Meta individual asignada o null",
      "metas_individuales": [
        {
          "categoria": "Desarrollo académico y aprendizaje | Gestión y administración escolar | Desarrollo socioemocional y prevención de la violencia en la escuela",
          "tema": "Tema o ámbito específico",
          "meta": "Redacción de la meta individual",
          "estrategia": "Estrategia asociada o null",
          "entregable": "Evidencia o producto esperado o null",
          "periodo": "Periodo de ejecución o null"
        }
      ]
    }
  ],
  "totales_detectados": {
    "metas": número entero con el total exacto de metas contabilizadas en todo el documento (OBLIGATORIO),
    "actividades": número entero con el total de actividades
  },
  "elementos_plan": [
    {
      "tipo": "meta | actividad | estrategia | indicador | responsable | evidencia | cronograma | otro",
      "numero_origen": número entero de la meta si está numerada (ej. 1, 2, ..., 45) o null,
      "celda_ref": "Ancla de celda si está presente (ej. ⟦T05·R02·C03⟧) o null",
      "texto_original": "Texto literal exacto tal como aparece en el documento con su numeración",
      "texto_normalizado": "Versión corregida ortográficamente y adaptada a fórmula CREAA preservando 100% de cifras y fechas",
      "categoria": "Desarrollo académico y aprendizaje | Gestión y administración escolar | Desarrollo socioemocional y prevención de la violencia en la escuela",
      "tema": "Tema o ámbito oficial",
      "responsable": "Nombre o cargo del responsable (separado de la meta/actividad)",
      "periodo": "Periodo o fecha de ejecución",
      "requiere_revision": false,
      "motivos_revision": []
    }
  ],
  "metas_institucionales_previas": [
    {
      "numero_origen": número de la meta o null,
      "categoria": "Desarrollo académico y aprendizaje | Gestión y administración escolar | Desarrollo socioemocional y prevención de la violencia en la escuela",
      "tema": "Tema o ámbito oficial",
      "meta": "Redacción completa de la meta",
      "linea_base": "Línea base o null",
      "estrategia": "Estrategias o acciones acordadas o null",
      "responsable": "Responsable asignado",
      "entregable": "Evidencia o producto esperado o null",
      "periodo": "Cronograma o periodo de ejecución o null"
    }
  ],
  "diagnosticoComunidad": "Diagnóstico textual de la comunidad o null",
  "indicadores": {},
  "foda": {
    "fortalezas": "Texto o lista de fortalezas detectadas en el documento (especialmente en tablas FODA o diagnóstico institucional) o null",
    "oportunidades": "Texto o lista de oportunidades del entorno detectadas o null",
    "debilidades": "Texto o lista de debilidades internas detectadas o null",
    "amenazas": "Texto o lista de amenazas externas detectadas o null"
  }
}

REGLAS DE ORO OBLIGATORIAS:
1. REGLA CRÍTICA ANTI-COLAPSO (B-001): Si una celda o fila contiene varias metas numeradas o con viñetas (ej. 1., 2., 3., 4., 5., 6.), DEBES generar un objeto independiente por cada meta en 'elementos_plan' y en 'metas_institucionales_previas'. PROHIBIDO colapsar múltiples metas en una sola fila.
2. PROPAGACIÓN DE RESPONSABILIDAD: Cada meta desglosada hereda el 'responsable' de su fila original (ej. 'Mtra. Claudia González Widobro').
3. RESPONSABLES COLECTIVOS: Si el responsable es 'Director y docentes', 'Comité de Salud' o 'Colectivo Docente', CONSÉRVALO TEXTUALMENTE. No inventes nombres individuales.
4. METAS O ACTIVIDADES: Redáctalas en prosa institucional formal y limpia iniciando con un verbo en infinitivo (ej. 'Implementar una campaña de reciclaje...'). PROHIBIDO usar marcadores entre corchetes como [POR DEFINIR: ...] o etiquetas de borrador.
5. CORRELACIÓN HORIZONTAL ANTI-DESFASE Y ASOCIACIÓN DE RESPONSABLE EN TABLAS:
   - En tablas markdown (| Col1 | Col2 | Col3 | Col4 |): el responsable nombrado en una celda pertenece EXCLUSIVAMENTE a las metas y acciones de ESA MISMA LÍNEA / FILA HORIZONTAL (a su izquierda).
   - JAMÁS desplaces o asocies el nombre del docente a las metas de la fila siguiente.
   - Si una fila tiene las acciones/metas de "Instalación eléctrica..." y en esa misma fila el responsable es "Nemesio Loyda López", esa meta corresponde a Nemesio Loyda López.
   - Si la fila tiene "Cursos COSFAC / Lectura de textos narrativos" y el responsable es "Nicolás Cruz Vázquez", pertenece a Nicolás Cruz Vázquez.
   - Si la fila tiene "Observación de docentes / Convenio ITSVC / CAPA / patrulla" y el responsable es el Director, pertenece al Director.
   - Empareja Estrategia k ↔ Meta k ↔ Evidencia k por número si existe numeración. Si hay 1 sola estrategia para varias metas, cópiala a todas. Si no hay afinidad demostrable, usa null; NUNCA desplaces en cascada las evidencias.
6. INVARIANZA NUMÉRICA Y REDACCIÓN LIMPIA: Todo porcentaje (70%), número, fecha o ciclo escolar del original DEBE conservarse idéntico en 'texto_normalizado'. Redacta de forma institucional completa y limpia, sin introducir jamás marcadores artificiales entre corchetes como [POR DEFINIR: ...]. Si una meta requiere revisión por redacción incompleta, marca 'requiere_revision': true pero mantén la redacción limpia.
7. TAXONOMÍA ESTRICTA: 'categoria' DEBE ser exactamente una de las 3 oficiales:
   - 'Desarrollo académico y aprendizaje'
   - 'Gestión y administración escolar'
   - 'Desarrollo socioemocional y prevención de la violencia en la escuela'
   Desempate: clasifica por el RESULTADO FINAL que se mide, no por el medio.
8. ANÁLISIS FODA: Si el documento contiene una tabla o sección de FODA (Fortalezas, Oportunidades, Debilidades, Amenazas), extrae textualmente la información de cada cuadrante en el objeto 'foda'. Si no existe sección explícita de FODA, deja sus campos como null.
9. Salida: Responde EXCLUSIVAMENTE con el JSON válido.`;
}

export function buildPmcChunkExtractionPrompt(
  chunkText: string,
  chunkIndex: number,
  totalChunks: number,
  metaContext?: StructuralPromptMetadata
): string {
  const nonce = metaContext?.nonce || Math.random().toString(36).substring(2, 10);
  const metadataHeader = metaContext
    ? `<<<METADATOS_ESTRUCTURALES>>>
- lote: ${chunkIndex + 1} de ${totalChunks}
- formato: "${metaContext.formato || 'CANONICO_MATRIZ'}"
<<<FIN_METADATOS_ESTRUCTURALES>>>\n\n`
    : '';

  return `${metadataHeader}Analiza el siguiente fragmento (${chunkIndex + 1} de ${totalChunks}) correspondiente a un Programa de Mejora Continua (PMC) previo.
Tu objetivo en este fragmento es extraer de forma exhaustiva y fiel TODOS los elementos del plan de acción (elementos_plan), metas institucionales (metas_institucionales_previas) y personal escolar (staffData/participantes) que figuren en este fragmento.

<<<DOC_${nonce}>>>
${chunkText.slice(0, 100000)}
<<<FIN_DOC_${nonce}>>>

Estructura la información en el siguiente esquema JSON exacto:
{
  "schoolName": null,
  "schoolCct": null,
  "municipality": null,
  "locality": null,
  "schoolZone": "Zona escolar si se menciona en este fragmento (ej. 086), o null",
  "directorName": null,
  "supervisorName": "Nombre del supervisor(a) escolar si se menciona en este fragmento, o null",
  "staffData": [
    {
      "nombre": "Nombre del docente o directivo (limpio de prefijos)",
      "cargo": "Docente | Director(a) | Tutor(a) | etc.",
      "meta_individual": null,
      "metas_individuales": []
    }
  ],
  "participantes": [],
  "totales_detectados": {
    "metas": null,
    "actividades": null
  },
  "elementos_plan": [
    {
      "tipo": "meta | actividad | estrategia | indicador | responsable | evidencia | cronograma | otro",
      "numero_origen": número entero o null,
      "celda_ref": "Ancla de celda (ej. ⟦T05·R02·C03⟧) o null",
      "texto_original": "Texto literal exacto tal como aparece en el documento",
      "texto_normalizado": "Versión corregida ortográficamente preservando 100% de cifras y fechas",
      "categoria": "Desarrollo académico y aprendizaje | Gestión y administración escolar | Desarrollo socioemocional y prevención de la violencia en la escuela",
      "tema": "Tema o ámbito oficial",
      "responsable": "Nombre o cargo del responsable (separado de la meta/actividad)",
      "periodo": "Periodo o fecha de ejecución",
      "requiere_revision": false,
      "motivos_revision": []
    }
  ],
  "metas_institucionales_previas": [
    {
      "numero_origen": número entero o null,
      "categoria": "Desarrollo académico y aprendizaje | Gestión y administración escolar | Desarrollo socioemocional y prevención de la violencia en la escuela",
      "tema": "Tema o ámbito oficial",
      "meta": "Redacción de la meta",
      "linea_base": null,
      "estrategia": null,
      "responsable": "Nombre o cargo del responsable",
      "entregable": null,
      "periodo": null
    }
  ]
}

REGLAS ESTRICTAS DEL FRAGMENTO:
1. REGLA ANTI-COLAPSO: Si una celda contiene N metas numeradas o con viñetas, emite N objetos independientes.
2. ASOCIACIÓN HORIZONTAL ESTRICTA EN TABLAS: Cada meta hereda el 'responsable' de SU MISMA FILA HORIZONTAL (en la misma línea de la tabla markdown). Jamás desplaces el responsable hacia la fila siguiente. Si en la misma línea de la tabla dice 'Nemesio Loyda López', esa meta es de Nemesio Loyda López. Si es colectivo ('Director y docentes'), consérvalo literal.
3. Preserva 100% de porcentajes y fechas. Redacta de forma institucional y limpia. PROHIBIDO usar marcadores artificiales entre corchetes como [POR DEFINIR: ...].
4. Asigna únicamente una de las 3 categorías canónicas oficiales del MCCEMS.
5. Responde EXCLUSIVAMENTE con el objeto JSON válido.`;
}
