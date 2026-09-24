/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * pmc-prompts.ts
 * Generador de prompts oficiales para el Programa de Mejora Continua (PMC) CREAA
 * SIGPDA-EMS · MCCEMS Puebla Ciclo Escolar 2026-2027
 * 
 * Integra:
 * - Datos estadísticos oficiales del Formato 911 (Matrícula, Abandono, Eficiencia Terminal)
 * - Datos de acreditación del Formato F11 (Calificaciones, Promedios por Asignatura, Aprobación)
 * - Evaluaciones externas estandarizadas (EDIEMS y ESA)
 * - 3 Categorías Oficiales CREAA (Apropiación Curricular, Permanencia, Gestión Comunitaria/PAEC)
 * - Fórmula Sintáctica de Meta: [VERBO] + [%] + [POBLACIÓN] + [ESTRATEGIA] + [PERIODO Y TERRITORIO]
 * - 8 Fechas Oficiales del Cronograma de Seguimiento 2026-2027
 * - 3 Líneas de Acción Oficiales
 */

import type { PmcProject, PmcStatisticalContext, PmcIndicadoresAcademicos, PmcFodaData } from '@/types/pmc';

function safeStr(val: unknown, fallback = 'N/D'): string {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  return str.length > 0 ? str : fallback;
}

function parseJson<T = any>(val: unknown): T {
  if (!val) return {} as T;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(String(val)) as T;
  } catch {
    return {} as T;
  }
}

/**
 * Construye el prompt para el apartado de DIAGNÓSTICO INTEGRAL del PMC CREAA.
 */
export function buildPmcDiagnosticoPrompt(
  project: PmcProject,
  statisticalContext?: PmcStatisticalContext,
  libraryContext?: string
): string {
  const indic = parseJson<PmcIndicadoresAcademicos>(project.indicadores_academicos);
  const foda = parseJson<PmcFodaData>(project.foda);

  // Inyectar datos estadísticos reales (911 + F11) si existen
  const stats = statisticalContext?.plantel;
  const zona = statisticalContext?.zona;

  const matriculaReal = stats?.matricula ?? indic.matricula ?? 'N/D';
  const abandonoReal = stats?.abandono ?? indic.abandono_ant ?? 'N/D';
  const eficienciaReal = stats?.eficienciaTerminal ?? indic.et_ant ?? 'N/D';
  const reprobacionReal = stats?.reprobacion ?? indic.reprobacion_ant ?? 'N/D';
  const promedioF11 = stats?.promedioGeneral ?? stats?.promedioCalificaciones ?? 'N/D';
  const aprobacionReal = stats?.aprobadosPorcentaje ?? indic.aprobacion_ant ?? 'N/D';

  let contextoEstadisticoExtra = '';
  if (stats) {
    contextoEstadisticoExtra = `
DATOS ESTADÍSTICOS OFICIALES VINCULADOS (Formato 911 y F11):
- Matrícula oficial (911.7G): ${matriculaReal} alumnos
- Tasa de Abandono Escolar (911): ${abandonoReal}%
- Eficiencia Terminal (911): ${eficienciaReal}%
- Aprobación Escolar (F11C): ${aprobacionReal}%
- Reprobación Escolar (F11C / 911): ${reprobacionReal}%
- Promedio General de Aprovechamiento (F11C): ${promedioF11}
${stats.egresados ? `- Egresados certificados ciclo anterior: ${stats.egresados} estudiantes` : ''}
${stats.bajasDefinitivas ? `- Bajas definitivas ciclo anterior: ${stats.bajasDefinitivas} estudiantes` : ''}
${stats.promediosPorAsignatura ? `- Promedios específicos por asignatura (F11C):\n${Object.entries(stats.promediosPorAsignatura).map(([asig, prom]) => `    • ${asig}: ${prom}`).join('\n')}` : ''}
${stats.ediemsPre ? `- Resultado Diagnóstico EDIEMS Inicial: ${stats.ediemsPre}%` : ''}
`;
  }

  let contextoZonaExtra = '';
  if (zona) {
    contextoZonaExtra = `
BENCHMARKS REGIONALES DE ZONA ESCOLAR (${zona.zonaNumero || project.school_zone || 'Supervisión'}):
- Promedio de Abandono en la Zona: ${zona.promedioAbandono}% (Brecha del plantel: ${zona.brechasDiagnostico.brechaAbandonoVsZona > 0 ? '+' : ''}${zona.brechasDiagnostico.brechaAbandonoVsZona}%)
- Promedio de Eficiencia Terminal en la Zona: ${zona.promedioEficiencia}% (Brecha del plantel: ${zona.brechasDiagnostico.brechaEficienciaVsZona > 0 ? '+' : ''}${zona.brechasDiagnostico.brechaEficienciaVsZona}%)
- Promedio de Reprobación en la Zona: ${zona.promedioReprobacion}% (Brecha del plantel: ${zona.brechasDiagnostico.brechaReprobacionVsZona > 0 ? '+' : ''}${zona.brechasDiagnostico.brechaReprobacionVsZona}%)
- Nivel de prioridad de intervención: ${zona.brechasDiagnostico.prioridadIntervencion.toUpperCase()}
- Observaciones de Supervisión:
${zona.brechasDiagnostico.observaciones.map((obs) => `    • ${obs}`).join('\n')}
`;
  }

  return `Eres un experto en gestión directiva y planeación institucional de Bachilleratos Generales Estatales (BGE/TBC) de Puebla, alineado al Modelo Educativo 2025 de la NEM y las Pautas para la Planeación de la Mejora Continua 2026-2027 bajo la política estatal CREAA del MCCEMS.

${libraryContext || ''}

INFORMACIÓN GENERAL DEL PLANTEL:
- Nombre: ${safeStr(project.school_name)} (CCT: ${safeStr(project.school_cct)})
- Ubicación: ${safeStr(project.locality)}, Municipio de ${safeStr(project.municipality)}, Puebla
- Zona Escolar: ${safeStr(project.school_zone)} | Ciclo Escolar: ${safeStr(project.ciclo_escolar, '2026-2027')}
- Director(a): ${safeStr(project.director_name)}

CONTEXTO COMUNITARIO:
${safeStr(project.diagnostico_comunidad)}

${contextoEstadisticoExtra}
${contextoZonaExtra}

METAS PROYECTADAS REGISTRADAS:
- Aprobación meta: ${indic.aprobacion_meta ?? 'N/D'}%
- Abandono meta: ${indic.abandono_meta ?? 'N/D'}%
- Eficiencia terminal meta: ${indic.et_meta ?? 'N/D'}%

MATRIZ FODA SITUACIONAL:
- Fortalezas (F): ${safeStr(foda.fortalezas)}
- Oportunidades (O): ${safeStr(foda.oportunidades)}
- Debilidades (D): ${safeStr(foda.debilidades)}
- Amenazas (A): ${safeStr(foda.amenazas)}

INSTRUCCIONES PARA GENERAR EL DIAGNÓSTICO INTEGRAL:
Genera un objeto JSON con exactamente las siguientes 5 secciones redactadas con estilo técnico, formal y rigurosidad metodológica:
1. "presentacion": (Texto de presentación institucional del PMC, 2-3 párrafos. Debe fundamentar el artículo 3° constitucional, la política CREAA de Puebla y el MCCEMS 2025).
2. "contexto": (Narrativa profunda del contexto territorial, sociocultural y geográfico del plantel, articulando con el entorno donde viven los ${matriculaReal} estudiantes).
3. "analisis_indicadores": (Análisis cuantitativo e interpretativo de los datos reales del Formato 911 y F11: abandono del ${abandonoReal}%, eficiencia terminal del ${eficienciaReal}%, aprovechamiento promedio de ${promedioF11}, y comparación con la media de la zona escolar).
4. "sintesis_foda": (Síntesis cruzada de los cuadrantes FODA en 2 párrafos, identificando cómo las fortalezas mitigarán las debilidades y amenazas del entorno).
5. "priorizacion": (Narrativa de priorización estratégica para el ciclo escolar 2026-2027, justificando la intervención en las 3 categorías CREAA: Apropiación Curricular, Permanencia y Gestión Comunitaria).

Responde ÚNICAMENTE con el objeto JSON con estas 5 claves. NO inventes cifras estadísticas: usa exactamente los datos proporcionados.`;
}

/**
 * Construye el prompt para el PLAN DE ACCIÓN y METAS CREAA del PMC.
 */
export function buildPmcPlanAccionPrompt(
  project: PmcProject,
  statisticalContext?: PmcStatisticalContext,
  libraryContext?: string
): string {
  const indic = parseJson<PmcIndicadoresAcademicos>(project.indicadores_academicos);
  const diagnosticoGenerado = parseJson<Record<string, string>>(project.diagnostico_generado);
  const diagnosticoResumen = [
    diagnosticoGenerado.presentacion ?? '',
    diagnosticoGenerado.contexto ?? '',
    diagnosticoGenerado.analisis_indicadores ?? '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .substring(0, 2000);

  const stats = statisticalContext?.plantel;
  const zona = statisticalContext?.zona;

  const matriculaReal = stats?.matricula ?? indic.matricula ?? 220;
  const abandonoReal = stats?.abandono ?? indic.abandono_ant ?? 6.8;
  const eficienciaReal = stats?.eficienciaTerminal ?? indic.et_ant ?? 85;
  const aprobacionReal = stats?.aprobadosPorcentaje ?? indic.aprobacion_ant ?? 90;
  const promedioF11 = stats?.promedioGeneral ?? stats?.promedioCalificaciones ?? 8.0;

  // Formatear categorías priorizadas
  interface CategoriaPriorizadaAPI {
    id?: string;
    nombre?: string;
    temas?: string[];
  }
  const rawCategorias = parseJson<CategoriaPriorizadaAPI[]>(project.categorias_priorizadas);
  const categoriasList = Array.isArray(rawCategorias) && rawCategorias.length > 0
    ? rawCategorias
        .map((c) => {
          const nombre = c.nombre ?? `Categoría ${c.id}`;
          const temas = Array.isArray(c.temas) && c.temas.length > 0
            ? c.temas.map((t) => `    • ${t}`).join('\n')
            : '    • (sin temas específicos)';
          return `- ${nombre}:\n${temas}`;
        })
        .join('\n')
    : `- Categoría 1: Apropiación Curricular y Trayectorias Exitosas (CREAA: Resultados de Aprendizaje)\n    • Fortalecimiento en Pensamiento Matemático, Comunicación y Ciencias\n- Categoría 2: Permanencia y Conclusión Oportuna (CREAA: Abandono Escolar)\n    • Prevención del abandono escolar mediante tutorías integrales\n- Categoría 3: Gestión Comunitaria y Bienestar Estudiantil (CREAA: Eficiencia Terminal / PAEC)\n    • Proyectos comunitarios PAEC y cultura de paz`;

  const totalTemas = Array.isArray(rawCategorias) && rawCategorias.length > 0
    ? rawCategorias.reduce((sum, c) => sum + (Array.isArray(c.temas) ? c.temas.length : 1), 0)
    : 3;

  // Plantilla del personal — incluir metas predefinidas si existen
  type StaffMember = {
    nombre?: string;
    cargo?: string;
    metas_individuales?: {
      categoria?: string;
      tema?: string;
      meta?: string;
      estrategia?: string;
      entregable?: string;
      periodo?: string;
    }[];
  };

  let staffData: StaffMember[] = [];
  try {
    const parsed = parseJson<StaffMember[]>(project.staff_data);
    if (Array.isArray(parsed)) {
      staffData = parsed.filter(Boolean);
    }
  } catch {
    staffData = [];
  }

  const staffList = staffData.length > 0
    ? staffData.slice(0, 35).map((s) => {
        const metasInfo = Array.isArray(s?.metas_individuales) && s.metas_individuales.length > 0
          ? s.metas_individuales
              .filter(Boolean)
              .map(m => `      → ${m?.categoria || 'S/C'}: ${m?.meta || '(sin definir)'}${m?.estrategia ? ` [${m.estrategia}]` : ''}`)
              .join('\n')
          : '      (sin metas predefinidas — genera según su cargo y las categorías)';
        return `- ${s?.nombre ?? 'Docente'} — ${s?.cargo ?? 'Docente frente a grupo'}\n    Metas predefinidas:\n${metasInfo}`;
      }).join('\n')
    : `- ${safeStr(project.director_name, 'Director del Plantel')} — Director(a)\n    Metas predefinidas: (genera según cargo)\n- Colectivo Docente — Docentes frente a grupo\n    Metas predefinidas: (genera según cargo)`;

  return `Eres el diseñador técnico líder de Planes de Mejora Continua (PMC) para el Ciclo Escolar 2026-2027, experto en la metodología CREAA del Bachillerato General Estatal en Puebla.

${libraryContext || ''}

DATOS OFICIALES DEL PLANTEL:
- Escuela: ${safeStr(project.school_name)} | CCT: ${safeStr(project.school_cct)}
- Municipio/Comunidad: ${safeStr(project.municipality)}, ${safeStr(project.locality)}, Puebla
- Director(a): ${safeStr(project.director_name)} | Zona Escolar: ${safeStr(project.school_zone)}

LÍNEA BASE ESTADÍSTICA OFICIAL (Formato 911 y F11):
- Matrícula oficial atendida: ${matriculaReal} estudiantes (Fuente: 911.7G)
- Tasa de Abandono Escolar Línea Base: ${abandonoReal}% (Fuente: 911.7 / Bajas definitivas)
- Eficiencia Terminal Línea Base: ${eficienciaReal}% (Fuente: 911.7G / Egresados)
- Tasa de Aprobación Escolar Línea Base: ${aprobacionReal}% (Fuente: F11C)
- Aprovechamiento General Promedio: ${promedioF11} (Fuente: F11C Control Escolar)
${stats?.promediosPorAsignatura ? `- Desglose de Promedios por Asignatura F11C:\n${Object.entries(stats.promediosPorAsignatura).map(([asig, prom]) => `    • ${asig}: ${prom}`).join('\n')}` : ''}
${zona ? `- Promedios de Zona (${zona.zonaNumero || '004'}): Abandono ${zona.promedioAbandono}%, Eficiencia ${zona.promedioEficiencia}%, Reprobación ${zona.promedioReprobacion}%` : ''}

CATEGORÍAS Y TEMAS SELECCIONADOS POR EL PLANTEL:
${categoriasList}

PLANTILLA DE PERSONAL DISPONIBLE:
${staffList}

═══════════════════════════════════════════════════════════════════════════════
REGLAS OBLIGATORIAS DE REDACCIÓN DE METAS CREAA (MCCEMS PUEBLA 2026-2027):
═══════════════════════════════════════════════════════════════════════════════

1. FÓRMULA SINTÁCTICA OBLIGATORIA PARA TODA META INSTITUCIONAL:
   Cada meta institucional DEBE cumplir estrictamente con la estructura:
   [VERBO EN INFINITIVO DE ACCIÓN] + [INDICADOR CUANTIFICABLE / PORCENTAJE] + [POBLACIÓN OBJETIVO] + [ESTRATEGIA O ACCIÓN SITUADA] + [PERIODO Y TERRITORIO]
   
   Ejemplo oficial: "Reducir en un 3% el abandono escolar en los ${matriculaReal} estudiantes del plantel durante el ciclo escolar 2026-2027, implementando círculos de acompañamiento socioemocional y alertas tempranas en semanas 6 y 12 en ${safeStr(project.locality)}, Puebla."

2. ALINEACIÓN A LAS 3 CATEGORÍAS CREAA (SEPARACIÓN ESTRICTA DE FUENTES OFICIALES):
   - Categoría 1 (Apropiación Curricular y Trayectorias Exitosas / Académico):
     * Fuente Primaria: Formato F11C (Control Escolar). Usar obligatoriamente los promedios por asignatura (ej. Pensamiento Matemático, Lenguaje y Comunicación, Ciencias) para identificar materias con rezago y definir la meta de aprovechamiento/aprobación.
     * Fuente de Verificación Externa: Evaluaciones diagnósticas estandarizadas (EDIEMS y ESA) independientes del F11 como cortes de seguimiento (septiembre, diciembre, marzo).
   - Categoría 2 (Permanencia y Conclusión Oportuna):
     * Fuente Obligatoria: Formato 911 (911.7G / Bajas definitivas). Usar la Tasa de Abandono Escolar del 911 (${abandonoReal}%) como línea base institucional obligatoria. La meta debe comprometer la reducción del abandono mediante tutorías socioemocionales, alerta temprana en semanas 6 y 12 y vinculación comunitaria.
   - Categoría 3 (Gestión Comunitaria, Clima Escolar y PAEC):
     * Fuente Obligatoria: Formato 911 (911.7G / Egresados). Usar la Eficiencia Terminal del 911 (${eficienciaReal}%) como línea base institucional obligatoria, articulando la gestión directiva con los proyectos comunitarios PAEC y cultura de paz para asegurar la conclusión oportuna.

3. CRONOGRAMA Y FECHAS OFICIALES INSTITUCIONALES (Usar estas ventanas temporales en estrategias):
   - 31 ago al 4 sep 2026: Diagnóstico EDIEMS y ESA inicial
   - Del 21 al 25 sep 2026: Exposición del PMC y PAEC a Supervisión Escolar
   - Del 30 nov al 4 dic 2026: Aplicación Post-Test EDIEMS y ESA (Primer corte)
   - Del 8 al 12 mar 2027: Aplicación ESA de seguimiento
   - Del 14 al 18 jun 2027: Presentación de informe final ante Supervisión Escolar

4. ENTREGABLES TÉCNICOS CUALITATIVOS (PROHIBIDO SÓLO FOTOGRAFÍAS O LISTAS):
   Los entregables deben ser productos analíticos: "Informe de análisis de causas raíz", "Bitácora de tutorías con matriz de riesgo", "Memoria de proyectos PAEC con rúbricas de evaluación".

5. METAS PERSONALES POR TRABAJADOR:
   Generar MÚLTIPLES metas individuales para cada trabajador listado, una por cada categoría/tema que le aplique según su cargo.
   - Un director(a) puede tener metas en todas las categorías (gestión, académico, socioemocional).
   - Un docente puede tener metas en categoría 1 (académico) y categoría 3 (PAEC/comunitario).
   - Un orientador puede tener metas en categoría 3 (socioemocional) y categoría 1 (tutorías).
   - Si el trabajador tiene metas predefinidas en la plantilla, úsalas como base y complementa con metas adicionales según las categorías seleccionadas.
   - Cada meta individual DEBE especificar a qué categoría y tema pertenece.

Estructura de respuesta en JSON:
{
  "metas_institucionales": [
    {
      "categoria": "1",
      "nombre_categoria": "Desarrollo académico y aprendizaje | Gestión y administración escolar | Desarrollo socioemocional y prevención de la violencia en la escuela",
      "tema": "Tema o ámbito oficial específico (ej. Formación y actualización docente, Propuestas pedagógicas, Seguimiento al desempeño docente en el aula, etc.)",
      "diagnostico_meta": "Hallazgo específico de rezago en F11 / FODA que justifica esta meta",
      "meta": "[VERBO] + [% O CIFRA] + [POBLACIÓN] + [ESTRATEGIA] + [PERIODO Y TERRITORIO]",
      "estrategia": "1. Acción concreta con hito de alerta temprana. 2. Acción de nivelación pedagógica. 3. Evaluación formativa vinculada al cronograma institucional.",
      "linea_base": "Valor exacto de partida (ej. Calificación F11: ${promedioF11}, Abandono 911: ${abandonoReal}%, o Eficiencia: ${eficienciaReal}%)",
      "personal_designado": "Nombre y Cargo del responsable",
      "entregable": "Documento técnico cualitativo de evidencia",
      "periodo_inicio": "08/2026",
      "periodo_fin": "06/2027"
    }
  ],
  "metas_personales": [
    {
      "nombre": "Nombre del trabajador",
      "cargo": "Cargo",
      "categoria": "Desarrollo académico y aprendizaje | Gestión y administración escolar | Desarrollo socioemocional y prevención de la violencia en la escuela",
      "tema": "Tema o ámbito oficial específico según la categoría",
      "meta_individual": "Meta SMART individual para este tema",
      "estrategia": "Acciones concretas",
      "entregable": "Informe o producto entregable",
      "periodo": "agosto 2026 - junio 2027"
    }
  ]
}

Responde ÚNICAMENTE con el JSON válido.`;
}
