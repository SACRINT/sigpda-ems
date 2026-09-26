/**
 * cartografia-prompts.ts
 * Generador de prompts oficiales para la Cartografía de Zona Escolar
 * SIGPDA-EMS · MCCEMS Puebla Ciclo Escolar 2026-2027
 * 
 * Basado en las orientaciones oficiales de Educación Media Superior:
 * "Del PIPS a la Cartografía de Zona Escolar: Cambiar la mirada para tomar mejores decisiones de acompañamiento pedagógico"
 * 
 * Estructura oficial:
 * 1. Momento 1: Conocer (Planteles, comunidades, matrícula)
 * 2. Momento 2: Organizar (Capa Cuantitativa 911/F11 + Capa Cualitativa PAEC/PMC)
 * 3. Momento 3: Ubicar (Mapeo escuela-territorio, recursos y aliados comunitarios)
 * 4. Momento 4: Analizar (Triangulación de 4 Perspectivas: Directivos, Docentes, Alumnos/Familias, Supervisión/ATP)
 * 5. Momento 5: Decidir (Meta General CREAA + 3 Líneas de Acción Oficiales)
 * 6. Memoria Pedagógica (¿Qué logramos?, ¿Cómo lo logramos?, ¿Qué aprendimos?)
 */

import type {
  CartografiaMomento1Conocer,
  CartografiaMomento2Organizar,
  CartografiaMomento3Ubicar,
  CartografiaMomento4Analizar,
  CartografiaMomento5Decidir,
} from '@/types/cartografia';
import { formatZoneMetric } from '@/lib/zone-metric-format';

export const CARTOGRAFIA_SYSTEM_PROMPT = `Eres el Asesor Técnico Pedagógico y Cartógrafo Líder de Educación Media Superior de Puebla, México.
Tu misión es estructurar la Cartografía Educativa de Zona Escolar para el Ciclo Escolar 2026–2027 bajo el Modelo Educativo 2025 y el MCCEMS.

PRINCIPIOS INSTITUCIONALES DE LA CARTOGRAFÍA DE ZONA (MCCEMS PUEBLA):
1. TRANSICIÓN DEL PIPS A LA CARTOGRAFÍA:
   El Plan de Intervención Pedagógica de Supervisión (PIPS) ha cumplido su ciclo por ser un recopilador estático de cifras. La Cartografía no es un nuevo trámite burocrático; es una herramienta viva de navegación territorial para comprender la realidad, acompañar a los colectivos docentes y tomar decisiones situadas y pertinentes.
2. LOS 5 MOMENTOS OFICIALES:
   - Momento 1: CONOCER (Identificación del territorio: qué tenemos, quiénes somos, dónde estamos).
   - Momento 2: ORGANIZAR (Capa Cuantitativa de síntomas [911.7G y F11C] + Capa Cualitativa de contexto [PAEC y PMC]).
   - Momento 3: UBICAR (Mapeo escuela-comunidad, rutas de movilidad, conectividad y aliados comunitarios).
   - Momento 4: ANALIZAR (Metodología de Triangulación: Directivos, Docentes, Alumnos/Familias y Supervisión/ATP).
   - Momento 5: DECIDIR (Meta General CREAA + 3 Líneas de Acción Oficiales).
3. MEMORIA PEDAGÓGICA VIVA:
   Sistematizar no el trámite administrativo, sino la transformación real respondiendo a: ¿Qué logramos?, ¿Cómo lo logramos?, y ¿Qué aprendimos?
4. FÓRMULA SINTÁCTICA CREAA OBLIGATORIA:
   [VERBO EN INFINITIVO] + [INDICADOR/PORCENTAJE] + [POBLACIÓN DE LA ZONA] + [ESTRATEGIA TERRITORIAL] + [PERIODO Y TERRITORIO].`;

/**
 * Prompt monolítico legacy para generar los Momentos 3, 4, 5 y la Memoria Pedagógica en un solo llamado.
 * 
 * @deprecated En el runtime oficial de SIGPDA-EMS (Fase 8+), la generación es modular por momento
 * para evitar timeouts de serverless (180s) y prevenir desbordamiento de ventana de contexto.
 * Utilice en su lugar:
 * - `buildMomento3UbicarPrompt`
 * - `buildMomento4AnalizarPrompt`
 * - `buildMomento5DecidirPrompt`
 * - `buildMemoriaPedagogicaPrompt`
 * a través de `/api/pips/[id]/cartografia/generate-momento`.
 * 
 * Se conserva únicamente como fallback arquitectónico para scripts batch, pruebas offline o migraciones.
 */
export function buildCartografiaFullPrompt(
  identificacion: {
    zonaNumero: string;
    zonaClave: string;
    supervisorName: string;
    municipioSede: string;
    municipiosAtiende: string;
    subsistema: string;
    cicloEscolar: string;
    atps: string[];
  },
  momento1: CartografiaMomento1Conocer,
  momento2: CartografiaMomento2Organizar,
  libraryContext?: string
): string {
  const numPlanteles = momento1.planteles.length;
  const matTotal = momento1.matriculaTotalZona;
  const promAbandono = momento2.capaCuantitativa.promedioAbandonoZona;
  const promEficiencia = momento2.capaCuantitativa.promedioEficienciaZona;
  const promCalificaciones = momento2.capaCuantitativa.promedioAprovechamientoZona;
  const promReprobacion = momento2.capaCuantitativa.promedioReprobacionZona;

  const plantelesResumen = momento1.planteles
    .slice(0, 20)
    .map(
      (p) =>
        `- ${p.nombre} (CCT: ${p.cct}): Matrícula ${p.matricula}, Abandono ${formatZoneMetric(p.abandono, { pct: true })}, Eficiencia ${formatZoneMetric(p.eficienciaTerminal, { pct: true })}, Promedio ${p.promedioGeneral}. Proyecto PAEC: "${p.paecProyecto}"`
    )
    .join('\n');

  return `DATOS INSTITUCIONALES DE LA ZONA ESCOLAR:
- Zona Escolar: ${identificacion.zonaNumero} (Clave: ${identificacion.zonaClave})
- Subsistema: ${identificacion.subsistema} | Ciclo Escolar: ${identificacion.cicloEscolar}
- Supervisor(a): ${identificacion.supervisorName}
- Municipio Sede: ${identificacion.municipioSede}
- Municipios de Cobertura: ${identificacion.municipiosAtiende}
- Asesores Técnicos Pedagógicos (ATP): ${identificacion.atps.join(', ') || 'Equipo de Asesoría de Zona'}
- Total de Planteles: ${numPlanteles} planteles oficiales
- Matrícula Total Atendida: ${matTotal} estudiantes

${libraryContext || ''}

CAPA CUANTITATIVA CONSOLIDADA (Línea Base 911.7G y F11C):
- Promedio de Abandono Escolar en la Zona: ${formatZoneMetric(promAbandono, { pct: true })}
- Promedio de Eficiencia Terminal en la Zona: ${formatZoneMetric(promEficiencia, { pct: true })}
- Promedio General de Aprovechamiento (F11C): ${formatZoneMetric(promCalificaciones)}
- Promedio de Reprobación en la Zona: ${formatZoneMetric(promReprobacion, { pct: true })}
- Planteles con prioridad de acompañamiento intensivo:
${momento2.capaCuantitativa.plantelesAtencionPrioritaria.map((pl) => `  * ${pl}`).join('\n') || '  * Todos en rangos de estabilidad promedio'}

CAPA CUALITATIVA SITUADA (PAEC y Contexto Territorial):
- Problemáticas comunes en proyectos PAEC:
${momento2.capaCualitativa.problematicasComunes.map((pr) => `  * ${pr}`).join('\n')}
- Desafíos socioeconómicos y geográficos:
  ${momento2.capaCualitativa.desafiosSocioeconomicos}

MUESTRA DE PLANTELES DE LA ZONA:
${plantelesResumen}

═══════════════════════════════════════════════════════════════════════════════
TAREA: GENERAR LA CARTOGRAFÍA DE ZONA ESCOLAR (MOMENTOS 3, 4, 5 Y MEMORIA)
═══════════════════════════════════════════════════════════════════════════════
Genera un objeto JSON estrictamente estructurado con las siguientes secciones:

{
  "momento3Ubicar": {
    "descripcionTerritorial": "Narrativa amplia (3 párrafos) de la georreferenciación y relación escuela-territorio en los municipios de ${identificacion.municipiosAtiende}, Puebla.",
    "comunidadesProcedencia": ["Comunidad A", "Comunidad B", "Comunidad C", "Comunidad D"],
    "movilidadTransporte": "Análisis de las rutas de traslado, tiempos de recorrido de los estudiantes y su impacto en la puntualidad y permanencia escolar.",
    "conectividadInfraestructura": "Diagnóstico de conectividad digital, acceso a internet y recursos tecnológicos en los planteles y hogares de la zona.",
    "recursosAliados": [
      {
        "nombre": "Nombre de institución, centro de salud o cooperativa",
        "tipo": "salud | deportivo | cultural | productivo | comunitario",
        "ubicacion": "Localidad/Municipio",
        "vinculacionPedagogica": "Cómo se vincula con los proyectos PAEC de los planteles vecinos"
      },
      {
        "nombre": "Espacio cultural o biblioteca comunitaria",
        "tipo": "cultural",
        "ubicacion": "Cabecera municipal",
        "vinculacionPedagogica": "Encuentros de lectura y foros de divulgación científica inter-bachilleratos"
      },
      {
        "nombre": "Asociación agropecuaria o artesanal local",
        "tipo": "productivo",
        "ubicacion": "Municipio sede",
        "vinculacionPedagogica": "Talleres de formación para el trabajo y proyectos de desarrollo sustentable"
      }
    ],
    "mapaContextual": "Descripción sinóptica de la distribución espacial de los ${numPlanteles} planteles y los nodos comunitarios clave."
  },
  "momento4Analizar": {
    "triangulacion": {
      "directivos": "Perspectiva estratégica de directores: retos de gestión, optimización de plantillas, retención en semestres críticos y clima institucional.",
      "docentes": "Perspectiva de colectivos docentes: desafíos didácticos en aula, rezago en matemáticas y comunicación, y adaptación de fichas formativas.",
      "alumnosFamilias": "Perspectiva comunitaria (alumnos y padres): relevancia social de los aprendizajes, necesidades de apoyo económico/transporte y aspiraciones formativas.",
      "supervisionAtp": "Mirada del equipo de supervisión: acompañamiento situado, retroalimentación formativa y vinculación entre escuelas de la microrregión."
    },
    "patronesRecurrentes": [
      "Patrón 1 identificado a través de la triangulación",
      "Patrón 2 sobre factores que inciden en el abandono escolar",
      "Patrón 3 sobre fortalezas didácticas compartidas entre planteles"
    ],
    "retosPedagogicosCreaa": [
      "Reto 1: Disminución de la reprobación mediante codiseño de evaluación formativa",
      "Reto 2: Alerta temprana en semanas 6 y 12 para reducir el abandono del ${promAbandono}%",
      "Reto 3: Impulso a la eficiencia terminal articulando proyectos comunitarios PAEC"
    ],
    "acuerdosAutonomiaConsejo": [
      "Acuerdo de autonomía docente tomado en Consejo Académico de Zona 1",
      "Acuerdo de adaptación curricular situada 2"
    ]
  },
  "momento5Decidir": {
    "metaGeneralZona": "[VERBO EN INFINITIVO] + [% O CIFRA] + [POBLACIÓN DE LA ZONA] + [ESTRATEGIA TERRITORIAL] + [PERIODO Y TERRITORIO]",
    "indicadoresCreaaAsociados": [
      "Abandono Escolar (Línea base ${formatZoneMetric(promAbandono, { pct: true })})",
      "Eficiencia Terminal (Línea base ${formatZoneMetric(promEficiencia, { pct: true })})",
      "Resultados de Aprendizaje / EDIEMS-ESA (Línea base ${promCalificaciones})"
    ],
    "lineasAccion": [
      {
        "numero": 1,
        "titulo": "Línea de Acción 1: Homologación y seguimiento a resultados diagnósticos (EDIEMS / ESA / F11C)",
        "accionesEspecificas": [
          "Análisis colegiado en academia de zona de los cortes diagnósticos iniciales (agosto-septiembre 2026)",
          "Diseño e intercambio de secuencias de nivelación didáctica contextualizada en Matemáticas y Lenguaje",
          "Alineación curricular con base en los reportes post-test de diciembre 2026 y marzo 2027"
        ],
        "recursos": ["Resultados de pruebas estandarizadas", "Fichas temáticas de formación", "Plataformas institucionales"],
        "responsables": "Supervisión Escolar, ATPs y Colegiados de Asignatura de los ${numPlanteles} planteles",
        "entregables": "Informe analítico de zona, bancos de reactivos situados y matrices de nivelación",
        "estrategiaSeguimiento": "Evaluación en sesiones de Consejo Académico y seguimiento en semanas clave del calendario oficial",
        "periodoEjecucion": "Agosto 2026 - Enero 2027"
      },
      {
        "numero": 2,
        "titulo": "Línea de Acción 2: Articulación del PAEC por plantel y a nivel zona escolar",
        "accionesEspecificas": [
          "Mapeo de problemáticas comunitarias concurrentes en los ${numPlanteles} planteles",
          "Desarrollo de proyectos interdisciplinarios PAEC con impacto microrregional",
          "Muestra de proyectos comunitarios y foros de saberes territoriales en mayo 2027"
        ],
        "recursos": ["Proyectos escolares PAEC", "Espacios comunitarios", "Aliados estratégicos locales"],
        "responsables": "Directores de plantel, docentes coordinadores de proyecto y comités estudiantiles",
        "entregables": "Memoria de proyectos PAEC de zona con rúbricas de impacto socioformativo",
        "estrategiaSeguimiento": "Revisión trimestral de evidencias y visitas de acompañamiento situado",
        "periodoEjecucion": "Septiembre 2026 - Mayo 2027"
      },
      {
        "numero": 3,
        "titulo": "Línea de Acción 3: Participación en Encuentros Académicos, Alertas Tempranas y Retención Estudiantil",
        "accionesEspecificas": [
          "Instalación de la Red de Alerta Temprana de Zona para detección oportuna de riesgo de deserción en semanas 6 y 12",
          "Conformación de comités de tutoría y círculos de acompañamiento socioemocional",
          "Organización del Encuentro de Ciencia, Arte y Tecnología de la Zona Escolar ${identificacion.zonaNumero}"
        ],
        "recursos": ["Protocolos institucionales de alerta temprana", "Convocatorias oficiales", "Directorios comunitarios"],
        "responsables": "Supervisión Escolar, Asesores Técnicos, Directores y Tutores Escolares",
        "entregables": "Padrón de estudiantes en riesgo con plan de rescate individual y reporte de participación",
        "estrategiaSeguimiento": "Cortes bimestrales de retención y análisis de causas de baja",
        "periodoEjecucion": "Septiembre 2026 - Julio 2027"
      }
    ],
    "compromisosSupervision": [
      "Brindar al menos 3 visitas de acompañamiento pedagógico situado por plantel priorizando diálogo con docentes",
      "Gestionar espacios de diálogo inter-institucional con autoridades municipales de la región",
      "Difundir buenas prácticas de autonomía docente documentadas en la zona"
    ]
  },
  "memoriaPedagogica": {
    "queLogramos": "Resultados sustantivos del acompañamiento en la Zona Escolar contrastados con los propósitos del Modelo Educativo 2025.",
    "comoLoLogramos": "Descripción de las estrategias situadas, adaptaciones de autonomía profesional y dinámicas de colegiado que permitieron los avances.",
    "queAprendimos": "Reflexión crítica sobre los obstáculos encontrados, la pertinencia de las fichas formativas y las fortalezas que emergieron en el territorio.",
    "indicadoresCambio": {
      "proceso": "Transformación en la práctica docente: mayor diversificación en evaluación formativa y planeación vinculada al contexto comunitario.",
      "creaa": "Evolución tangible en los indicadores de cobertura, retención estudiantil, aprobación y eficiencia terminal.",
      "impactoTerritorial": "Fortalecimiento del vínculo escuela-comunidad y apropiación social del bachillerato en la región."
    },
    "hojaDeRutaProximoCiclo": [
      "Recomendación 1 para la planeación del Ciclo 2027-2028 basada en la evidencia acumulada",
      "Recomendación 2 sobre focalización del acompañamiento en planteles con mayor dispersión",
      "Recomendación 3 sobre consolidación de la autonomía profesional en los Consejos Académicos"
    ]
  }
}

Responde ÚNICAMENTE con el JSON válido.`;
}

// ─── CONTEXTO BASE REUTILIZABLE ──────────────────────────────────────────────
export interface CartografiaIdentificacion {
  zonaNumero: string;
  zonaClave: string;
  supervisorName: string;
  municipioSede: string;
  municipiosAtiende: string;
  subsistema: string;
  cicloEscolar: string;
  atps: string[];
}

function renderBaseStats(
  identificacion: CartografiaIdentificacion,
  momento1: CartografiaMomento1Conocer,
  momento2: CartografiaMomento2Organizar,
  libraryContext?: string
): string {
  const numPlanteles = momento1.planteles.length;
  const matTotal = momento1.matriculaTotalZona;
  const promAbandono = momento2.capaCuantitativa.promedioAbandonoZona;
  const promEficiencia = momento2.capaCuantitativa.promedioEficienciaZona;
  const promCalificaciones = momento2.capaCuantitativa.promedioAprovechamientoZona;
  const promReprobacion = momento2.capaCuantitativa.promedioReprobacionZona;

  const plantelesResumen = momento1.planteles
    .slice(0, 15)
    .map(
      (p) =>
        `- ${p.nombre} (${p.cct}): Matrícula ${p.matricula}, Abandono ${formatZoneMetric(p.abandono, { pct: true })}, Eficiencia ${formatZoneMetric(p.eficienciaTerminal, { pct: true })}, Promedio ${p.promedioGeneral}. Proyecto PAEC: "${p.paecProyecto}"`
    )
    .join('\n');

  return `DATOS INSTITUCIONALES DE LA ZONA:
- Zona Escolar: ${identificacion.zonaNumero} (Clave: ${identificacion.zonaClave}) | Subsistema: ${identificacion.subsistema}
- Supervisor(a): ${identificacion.supervisorName} | Ciclo Escolar: ${identificacion.cicloEscolar}
- Municipio Sede: ${identificacion.municipioSede} | Municipios de Cobertura: ${identificacion.municipiosAtiende}
- Total de Planteles: ${numPlanteles} | Matrícula Total Atendida: ${matTotal} estudiantes
- Equipo ATP: ${identificacion.atps.join(', ') || 'Equipo de Asesoría de Zona'}

${libraryContext ? `CONTEXTO DE BIBLIOTECA DOCENTE:\n${libraryContext}\n` : ''}
LÍNEA BASE ESTADÍSTICA 911.7G / F11C:
- Promedio Abandono: ${formatZoneMetric(promAbandono, { pct: true })} | Eficiencia Terminal: ${formatZoneMetric(promEficiencia, { pct: true })}
- Promedio Calificaciones: ${promCalificaciones} | Reprobación: ${formatZoneMetric(promReprobacion, { pct: true })}
- Planteles Atención Prioritaria: ${momento2.capaCuantitativa.plantelesAtencionPrioritaria.slice(0, 5).join(', ') || 'En rangos promedio'}

CAPA CUALITATIVA SITUADA (PAEC Y RETOS TERRITORIALES):
- Problemáticas comunes PAEC: ${momento2.capaCualitativa.problematicasComunes.slice(0, 3).join('; ')}
- Desafíos socioeconómicos: ${momento2.capaCualitativa.desafiosSocioeconomicos}

MUESTRA DE PLANTELES:
${plantelesResumen}`;
}

// ─── MOMENTO 3: UBICAR ───────────────────────────────────────────────────────
export function buildMomento3UbicarPrompt(
  identificacion: CartografiaIdentificacion,
  momento1: CartografiaMomento1Conocer,
  momento2: CartografiaMomento2Organizar,
  libraryContext?: string
): string {
  const base = renderBaseStats(identificacion, momento1, momento2, libraryContext);
  return `${base}

═══════════════════════════════════════════════════════════════════════════════
TAREA: GENERAR MOMENTO 3: UBICAR (MAPEO ESCUELA-TERRITORIO Y RECURSOS COMUNITARIOS)
═══════════════════════════════════════════════════════════════════════════════
Bajo el Modelo Educativo 2025 y el MCCEMS Puebla, elabora el mapeo contextual y territorial de la zona.
Genera un objeto JSON estrictamente con la siguiente estructura:

{
  "descripcionTerritorial": "Narrativa amplia (2-3 párrafos) de la georreferenciación y relación escuela-territorio en los municipios de ${identificacion.municipiosAtiende}, Puebla.",
  "comunidadesProcedencia": ["Comunidad Principal A", "Comunidad B", "Comunidad C", "Comunidad D"],
  "movilidadTransporte": "Análisis situado sobre las rutas de traslado, tiempos de recorrido de los estudiantes y su impacto directo en la puntualidad y retención escolar.",
  "conectividadInfraestructura": "Diagnóstico de conectividad digital, acceso a internet y recursos tecnológicos en los planteles y hogares de la zona.",
  "recursosAliados": [
    {
      "nombre": "Nombre de institución, centro de salud o cooperativa local",
      "tipo": "salud",
      "ubicacion": "${identificacion.municipioSede}",
      "vinculacionPedagogica": "Vinculación directa con los proyectos comunitarios PAEC de los planteles de la zona"
    },
    {
      "nombre": "Biblioteca comunitaria o espacio cultural",
      "tipo": "cultural",
      "ubicacion": "Cabecera municipal",
      "vinculacionPedagogica": "Foros inter-escolares y fortalecimiento de la lectoescritura situada"
    },
    {
      "nombre": "Unidad productiva, artesanal o agropecuaria",
      "tipo": "productivo",
      "ubicacion": "Región de atención",
      "vinculacionPedagogica": "Proyectos de inserción sociolaboral y desarrollo sostenible comunitario"
    }
  ],
  "mapaContextual": "Descripción sinóptica de la distribución espacial de los ${momento1.planteles.length} planteles y los nodos de convergencia comunitaria."
}

Responde ÚNICAMENTE con el JSON válido.`;
}

// ─── MOMENTO 4: ANALIZAR ─────────────────────────────────────────────────────
export function buildMomento4AnalizarPrompt(
  identificacion: CartografiaIdentificacion,
  momento1: CartografiaMomento1Conocer,
  momento2: CartografiaMomento2Organizar,
  momento3?: CartografiaMomento3Ubicar,
  libraryContext?: string
): string {
  const base = renderBaseStats(identificacion, momento1, momento2, libraryContext);
  const contextoTerritorial = momento3 ? `\nCONTEXTO TERRITORIAL (MOMENTO 3 PREVIO):\n- Movilidad: ${momento3.movilidadTransporte}\n- Conectividad: ${momento3.conectividadInfraestructura}\n` : '';

  return `${base}
${contextoTerritorial}
═══════════════════════════════════════════════════════════════════════════════
TAREA: GENERAR MOMENTO 4: ANALIZAR (TRIANGULACIÓN DE LAS 4 PERSPECTIVAS Y RETOS CREAA)
═══════════════════════════════════════════════════════════════════════════════
Aplica la metodología institucional de triangulación contrastando la voz de los 4 actores fundamentales.
Genera un objeto JSON estrictamente con la siguiente estructura:

{
  "triangulacion": {
    "directivos": "Perspectiva estratégica de directores: retos de gestión, optimización de plantillas docentes, clima institucional y retención en semestres de alto riesgo.",
    "docentes": "Perspectiva de colectivos docentes: desafíos pedagógicos en aula, barreras de aprendizaje en pensamiento matemático y comunicación, y adaptación de fichas formativas.",
    "alumnosFamilias": "Perspectiva comunitaria (alumnos y padres): pertinencia social de lo aprendido, limitaciones socioeconómicas, necesidades de transporte y aspiraciones formativas.",
    "supervisionAtp": "Perspectiva de la Supervisión y Asesoría Técnica: detección de asimetrías entre planteles, acompañamiento formativo situado y arbitraje institucional."
  },
  "patronesRecurrentes": [
    "Patrón recurrente 1 detectado en los planteles de la zona escolar",
    "Patrón recurrente 2 sobre hábitos de estudio o impacto del trabajo estudiantil",
    "Patrón recurrente 3 sobre necesidades de formación continua docente"
  ],
  "retosPedagogicosCreaa": [
    "Reto prioritario para elevar la Cobertura y Retención escolar en la zona",
    "Reto pedagógico para abatir la Reprobación en áreas fundamentales",
    "Reto formativo para consolidar la transversalidad de los proyectos PAEC"
  ],
  "acuerdosAutonomiaConsejo": [
    "Acuerdo colegiado de zona para flexibilizar la dosificación curricular ante contingencias territoriales",
    "Acuerdo de intercambio de secuencias didácticas y proyectos integradores entre docentes de la zona"
  ]
}

Responde ÚNICAMENTE con el JSON válido.`;
}

// ─── MOMENTO 5: DECIDIR ──────────────────────────────────────────────────────
export function buildMomento5DecidirPrompt(
  identificacion: CartografiaIdentificacion,
  momento1: CartografiaMomento1Conocer,
  momento2: CartografiaMomento2Organizar,
  momento3?: CartografiaMomento3Ubicar,
  momento4?: CartografiaMomento4Analizar,
  libraryContext?: string
): string {
  const base = renderBaseStats(identificacion, momento1, momento2, libraryContext);
  const contextoPrevio = momento4 ? `\nRETOS PEDAGÓGICOS IDENTIFICADOS:\n- ${momento4.retosPedagogicosCreaa.join('; ')}\n` : '';

  return `${base}
${contextoPrevio}
═══════════════════════════════════════════════════════════════════════════════
TAREA: GENERAR MOMENTO 5: DECIDIR (META GENERAL CREAA + 3 LÍNEAS DE ACCIÓN INSTITUCIONALES)
═══════════════════════════════════════════════════════════════════════════════
REGLA INQUEBRANTABLE PARA LA META GENERAL DE ZONA:
Debe cumplir estrictamente la fórmula sintáctica CREAA:
[VERBO EN INFINITIVO] + [INDICADOR/PORCENTAJE] + [POBLACIÓN DE LA ZONA] + [ESTRATEGIA TERRITORIAL] + [PERIODO Y TERRITORIO]

LAS 3 LÍNEAS DE ACCIÓN OFICIALES:
- Línea 1: Acompañamiento a la autonomía docente y curricular situada
- Línea 2: Acompañamiento directivo para la gestión participativa y clima escolar
- Línea 3: Acompañamiento integral a las trayectorias formativas y proyectos comunitarios

Genera un objeto JSON estrictamente con la siguiente estructura:

{
  "metaGeneralZona": "Incrementar en un 4.5% el promedio de permanencia y eficiencia terminal de los 1,850 estudiantes de la Zona Escolar ${identificacion.zonaNumero} mediante el acompañamiento formativo situado, comunidades de práctica docente y articulación de proyectos PAEC durante el ciclo escolar ${identificacion.cicloEscolar}.",
  "indicadoresCreaaAsociados": [
    "Porcentaje de Eficiencia Terminal zonal",
    "Tasa de Abandono Escolar acumulado",
    "Porcentaje de Aprobación en áreas de acceso al conocimiento",
    "Proyectos PAEC con impacto comunitario validado"
  ],
  "lineasAccion": [
    {
      "numero": 1,
      "titulo": "Acompañamiento a la autonomía docente y curricular situada",
      "accionesEspecificas": [
        "Talleres vivenciales de codiseño curricular y contextualización de progresiones",
        "Observación de aula formativa sin carácter punitivo con retroalimentación dialógica",
        "Red de intercambio pedagógico inter-bachilleratos en áreas de pensamiento lógico y comunicación"
      ],
      "recursos": ["Fichas formativas institucionales 2025", "Materiales digitales compartidos", "Guías de observación dialógica"],
      "responsables": "Equipo de Asesores Técnicos Pedagógicos (ATP) y Academias de Zona",
      "entregables": "Portafolio digital de secuencias didácticas contextualizadas y bitácoras de diálogo pedagógico",
      "estrategiaSeguimiento": "Revisiones trimestrales en sesiones de Consejo Técnico de Zona",
      "periodoEjecucion": "Agosto 2026 - Julio 2027"
    },
    {
      "numero": 2,
      "titulo": "Acompañamiento directivo para la gestión participativa y clima escolar",
      "accionesEspecificas": [
        "Círculos de liderazgo pedagógico y gestión de la convivencia armónica para directores",
        "Estandarización de protocolos de prevención del abandono temprano",
        "Estrategias de articulación con comités escolares de administración participativa"
      ],
      "recursos": ["Guías de gestión directiva institucional", "Manual de convivencia escolar de Puebla"],
      "responsables": "Supervisión Escolar y Directores de los ${momento1.planteles.length} planteles",
      "entregables": "Actas de acuerdos de Consejo Directivo y diagnóstico semestral de clima escolar",
      "estrategiaSeguimiento": "Reuniones bimensuales de seguimiento y visitas de supervisión acompañante",
      "periodoEjecucion": "Septiembre 2026 - Junio 2027"
    },
    {
      "numero": 3,
      "titulo": "Acompañamiento integral a las trayectorias formativas y proyectos comunitarios",
      "accionesEspecificas": [
        "Tutoría personalizada a estudiantes en situación de vulnerabilidad académica o económica",
        "Muestra Zonal de Proyectos Comunitarios PAEC con participación de actores locales",
        "Monitoreo nominal de estudiantes en riesgo de deserción en los tres momentos del ciclo"
      ],
      "recursos": ["Sistema de alerta temprana SIGPDA-EMS", "Redes de apoyo comunitario", "Formatos PAEC"],
      "responsables": "Supervisión Escolar, Tutores Escolares y Comités de Vinculación",
      "entregables": "Madrina/Padrino de trayectoria para alumnos en riesgo y catálogo de proyectos comunitarios",
      "estrategiaSeguimiento": "Cortes nominales de permanencia en cada evaluación parcial",
      "periodoEjecucion": "Agosto 2026 - Julio 2027"
    }
  ],
  "compromisosSupervision": [
    "Garantizar visitas de acompañamiento situado al 100% de los planteles priorizando el diálogo reflexivo",
    "Facilitar la articulación con dependencias del sector salud y cultura en beneficio de las comunidades escolares",
    "Reconocer y difundir las experiencias exitosas de autonomía profesional emanadas de la zona"
  ]
}

Responde ÚNICAMENTE con el JSON válido.`;
}

// ─── MEMORIA PEDAGÓGICA ──────────────────────────────────────────────────────
export function buildMemoriaPedagogicaPrompt(
  identificacion: CartografiaIdentificacion,
  momento1: CartografiaMomento1Conocer,
  momento2: CartografiaMomento2Organizar,
  momento5?: CartografiaMomento5Decidir,
  libraryContext?: string
): string {
  const base = renderBaseStats(identificacion, momento1, momento2, libraryContext);
  const contextoMeta = momento5 ? `\nMETA GENERAL DE ZONA DECIDIDA:\n${momento5.metaGeneralZona}\n` : '';

  return `${base}
${contextoMeta}
═══════════════════════════════════════════════════════════════════════════════
TAREA: GENERAR LA MEMORIA PEDAGÓGICA VIVA (CIERRE Y TRASCENDENCIA DEL CICLO)
═══════════════════════════════════════════════════════════════════════════════
Sistematiza la experiencia pedagógica de la zona escolar respondiendo con rigor y sensibilidad a las tres preguntas eje pedagógicas:
¿Qué logramos?, ¿Cómo lo logramos?, y ¿Qué aprendimos?

Genera un objeto JSON estrictamente con la siguiente estructura:

{
  "queLogramos": "Resultados sustantivos del acompañamiento en la Zona Escolar contrastados con los propósitos del Modelo Educativo 2025 y las metas CREAA trazadas.",
  "comoLoLogramos": "Descripción profunda de las estrategias situadas, adaptaciones de autonomía profesional, dinámicas colegiadas y articulación territorial que permitieron los avances.",
  "queAprendimos": "Reflexión crítica y propositiva sobre los obstáculos superados, la pertinencia de los recursos formativos utilizados y las fortalezas docentes que emergieron en el territorio.",
  "indicadoresCambio": {
    "proceso": "Transformación tangible en la práctica docente: mayor diversificación en evaluación formativa y planeación vinculada al contexto comunitario.",
    "creaa": "Evolución comparativa positiva en los indicadores de permanencia, aprobación y egreso oportuno de los estudiantes.",
    "impactoTerritorial": "Apropiación social del bachillerato en las comunidades y fortalecimiento de la corresponsabilidad comunitaria."
  },
  "hojaDeRutaProximoCiclo": [
    "Prioridad 1 para la planeación del siguiente ciclo escolar basada en la evidencia acumulada",
    "Prioridad 2 sobre focalización del acompañamiento situado en planteles con mayor dispersión",
    "Prioridad 3 sobre consolidación de las redes de aprendizaje y comunidades docentes de práctica"
  ]
}

Responde ÚNICAMENTE con el JSON válido.`;
}

