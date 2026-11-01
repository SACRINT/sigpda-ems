/**
 * paec-heuristics.ts
 * Extractor heurístico determinista multi-ancla para documentos PAEC.
 * Módulo puro sin dependencias de Node / Next server (apto para tests y ejecución cliente/servidor).
 */

import { removeHyphens } from '@/lib/text-utils';
import { normalizeUnicode } from '@/lib/utils/normalize';
import type { PaecOperationalActivity } from '@/types/planning';

export interface PaecHeuristicResult {
  projectName: string | null;
  objective: string | null;
  problem: string | null;
  studentContext: string | null;
  schoolName: string | null;
  municipality: string | null;
  cct: string | null;
  planOperativo: PaecOperationalActivity[];
}

/**
 * Limpia y normaliza el texto de una celda de tabla:
 * - Elimina anclas de extracción estructurada como ⟦T08·R01·C01⟧
 * - Elimina negritas markdown **
 * - Aplica removeHyphens
 * - Colapsa espacios redundantes
 */
export function cleanTableCell(s: string): string {
  return removeHyphens(s)
    .replace(/⟦[^⟧]*⟧/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extractor heurístico de tablas markdown del Plan Operativo.
 * Discrimina entre tablas de mapeo curricular simple y tablas del Plan Operativo oficial
 * exigiendo marcadores de cronograma/entregable (producto, evidencia, responsable, semana, etc.).
 */
export function parsePlanOperativoHeuristics(text: string): PaecOperationalActivity[] {
  const activities: PaecOperationalActivity[] = [];
  const lines = text.split(/\r?\n/);

  let inTable = false;
  let colMap = {
    fase: -1,
    actividad: -1,
    asignatura: -1,
    proposito: -1,
    estrategia: -1,
    semana: -1,
    progresion: -1,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) {
      inTable = false;
      continue;
    }

    const cells = line.split('|').map(c => c.trim()).slice(1, -1);
    if (cells.length < 2) continue;

    // Normalizar celdas para detección de cabeceras
    const lowerCells = cells.map(c => normalizeUnicode(c).toLowerCase());
    const hasAsignatura = lowerCells.some(c => c.includes('asignatura') || c.includes('uac') || c.includes('materia') || c.includes('disciplina'));
    const hasActividad = lowerCells.some(c => c.includes('actividad') || c.includes('accion') || c.includes('tarea'));
    const hasPlanMarkers = lowerCells.some(c =>
      c.includes('producto') ||
      c.includes('evidencia') ||
      c.includes('responsable') ||
      c.includes('semana') ||
      c.includes('periodo') ||
      c.includes('cronograma') ||
      c.includes('tiempo') ||
      c.includes('fase') ||
      c.includes('etapa')
    );
    const isExcludedTable = lowerCells.some(c =>
      c.includes('actividades macro') ||
      c.includes('asignaturas viga maestra') ||
      c.includes('viga maestra')
    );

    if (!inTable && hasAsignatura && hasActividad && hasPlanMarkers && !isExcludedTable) {
      inTable = true;
      colMap = {
        fase: lowerCells.findIndex(c => c.includes('fase') || c.includes('etapa')),
        actividad: lowerCells.findIndex(c => c.includes('actividad') || c.includes('accion') || c.includes('tarea')),
        asignatura: lowerCells.findIndex(c => c.includes('asignatura') || c.includes('uac') || c.includes('materia') || c.includes('disciplina')),
        proposito: lowerCells.findIndex(c => c.includes('proposito') || c.includes('aprendizaje') || c.includes('objetivo')),
        estrategia: lowerCells.findIndex(c => c.includes('estrategia') || c.includes('metodolog')),
        semana: lowerCells.findIndex(c => c.includes('semana') || c.includes('periodo') || c.includes('fecha') || c.includes('tiempo')),
        progresion: lowerCells.findIndex(c => c.includes('progresion') || c.includes('meta')),
      };
      continue;
    }

    // Saltar línea separadora |---|---|
    if (inTable && cells.every(c => /^[-:\s]+$/.test(c))) {
      continue;
    }

    // Extraer fila de datos de la tabla
    if (inTable && colMap.asignatura !== -1 && colMap.actividad !== -1) {
      const asigText = cleanTableCell(cells[colMap.asignatura] || '');
      const actText = cleanTableCell(cells[colMap.actividad] || '');

      if (asigText && actText && !asigText.toLowerCase().includes('asignatura') && asigText.length > 2) {
        activities.push({
          asignatura: asigText,
          actividad: actText,
          fase: colMap.fase !== -1 && cells[colMap.fase] ? cleanTableCell(cells[colMap.fase]) : undefined,
          propositoFormativo: colMap.proposito !== -1 && cells[colMap.proposito] ? cleanTableCell(cells[colMap.proposito]) : undefined,
          estrategiaDidactica: colMap.estrategia !== -1 && cells[colMap.estrategia] ? cleanTableCell(cells[colMap.estrategia]) : undefined,
          semana: colMap.semana !== -1 && cells[colMap.semana] ? cleanTableCell(cells[colMap.semana]) : undefined,
          progresion: colMap.progresion !== -1 && cells[colMap.progresion] ? cleanTableCell(cells[colMap.progresion]) : undefined,
          isPrescheduled: true,
        });
      }
    }
  }

  return activities;
}

/**
 * Extractor heurístico multi-ancla del documento PAEC completo.
 */
export function parsePaecHeuristics(text: string): PaecHeuristicResult {
  let projectName: string | null = null;
  let objective: string | null = null;
  let problem: string | null = null;
  let studentContext: string | null = null;
  let schoolName: string | null = null;
  let municipality: string | null = null;
  let cct: string | null = null;

  const planOperativo = parsePlanOperativoHeuristics(text);

  // 1. Nombre del proyecto (Multi-ancla con soporte para subtítulos en paréntesis)
  const nameMatchQuotes = text.match(/(?:titulado|denominado|nombre del proyecto|proyecto[:\s])\s*[:\-\s]*["'«“]([\s\S]*?)["'»”]/i);
  if (nameMatchQuotes && nameMatchQuotes[1]?.trim().length > 5) {
    projectName = nameMatchQuotes[1].trim();
  }

  if (!projectName) {
    const nameMatchCover = text.match(/(?:PROYECTO\s+ESCOLAR\s+COMUNITARIO(?:\s*\(PEC\))?|PEC)\s*[\r\n]+#*\s*([A-ZÁÉÍÓÚ0-9][^\r\n]{4,100})(?:\s*[\r\n]+#*\s*(\([^\r\n\)]+\)))?/i);
    if (nameMatchCover) {
      projectName = nameMatchCover[1].trim() + (nameMatchCover[2] ? ' ' + nameMatchCover[2].trim() : '');
    }
  }

  if (!projectName) {
    const nameMatch1 = text.match(/(?:PEC titulado|PEC denominado|proyecto denominado|proyecto titulado)\s*[:\-\s]*["'«“](.*?)["'»”]/i) 
      || text.match(/PEC titulado\s*["'«“]?([^\r\n"»”]+(?:\s*\([^\)]+\))?)(?:\.|\r?\n|$)/i);
    if (nameMatch1) {
      projectName = nameMatch1[1].trim();
    } else {
      const nameMatch2 = text.match(/(?:PROYECTO ESCOLAR COMUNITARIO|PEC)\s*[:\-\s]+([^\n\r]{10,120})/i);
      if (nameMatch2) {
        projectName = nameMatch2[1].trim();
      }
    }
  }

  // 2. Problemática comunitaria (Multi-ancla)
  const matchPNC = text.match(/Problemáticas\s+o\s+necesidades\s+de\s+la\s+comunidad[\s\S]*?(?:Etapa\s+tres[:\s]*|eje\s+central\s+del\s+proyecto[:\s]*|selección\s+del\s+problema[:\s]*)([\s\S]*?)(?=\b(?:Fase|FASE|1\.\s+Introducción|Propósito|Alcance|=== PÁGINA|\r?\n\||$))/i);
  if (matchPNC && matchPNC[1]?.trim().length > 30) {
    problem = matchPNC[1].trim().slice(0, 600);
  } else {
    const matchEtapa3 = text.match(/(?:Etapa\s+tres[:\s]*[^\n\r]*selecci[oó]n\s+del\s+problema[^\n\r]*)[\s\S]*?([A-ZÁÉÍÓÚ][\s\S]{30,600}?)(?=\b(?:Fase|FASE|1\.\s+Introducción|Propósito|=== PÁGINA|$))/i);
    if (matchEtapa3 && matchEtapa3[1]?.trim().length > 30) {
      problem = matchEtapa3[1].trim().slice(0, 600);
    } else {
      const matchProbDet = text.match(/(?:problem[aá]tica\s+detectada|problema\s+detectado|problema\s+central|problema\s+a\s+resolver)\s*[:\-\s]*([^\n\r]+(?:\r?\n[^\n\r]+){1,5})/i);
      if (matchProbDet && matchProbDet[1]?.trim().length > 25) {
        problem = matchProbDet[1].trim().slice(0, 600);
      }
    }
  }

  // 3. Objetivo general / propósito
  const objMatch = text.match(/(?:Propósito\s+general|Objetivo\s+general\s+del\s+proyecto|Objetivo\s+del\s+proyecto|Propósito|Objetivo)\s*[:\-\s]*([A-ZÁÉÍÓÚ][^\n\r]+(?:\r?\n[^\n\r]+){1,4})/i);
  if (objMatch && objMatch[1]?.trim().length > 20) {
    objective = objMatch[1].trim();
  }

  // 4. Caracterización / Contexto de estudiantes y plantel
  const contextParts: string[] = [];

  const ubMatch = text.match(/(?:Ubicación\s+geográfica|Localidad)[:\s]*([^\n\r]+(?:,\s*[^\n\r]+){1,3})/i);
  if (ubMatch) {
    contextParts.push(`Ubicación y Entorno: ${ubMatch[1].trim()}`);
  }

  const ecoMatch = text.match(/(?:Situación\s+socioeconómica|Economía\s+local|Actividades\s+principales)[:\s]*([^\n\r]+(?:\r?\n[^\n\r]+){0,3})/i);
  if (ecoMatch) {
    contextParts.push(`Contexto Socioeconómico: ${ecoMatch[1].trim()}`);
  }

  const estMatch = text.match(/(?:Características\s+del\s+estudiantado|Perfil\s+del\s+estudiante|Contexto\s+estudiantil)[:\s]*([\s\S]*?)(?=\b(?:Características\s+del\s+plantel|Contexto\s+familiar|Indicadores|Análisis\s+general|FODA|=== PÁGINA|\n#{1,3}\s|$))/i);
  if (estMatch && estMatch[1]?.trim().length > 20) {
    contextParts.push(`Perfil del Estudiantado: ${estMatch[1].trim()}`);
  }

  const famMatch = text.match(/(?:Contexto\s+familiar|Entorno\s+familiar)[:\s]*([\s\S]*?)(?=\b(?:Características\s+del\s+estudiantado|Características\s+del\s+plantel|Indicadores|Análisis\s+general|FODA|=== PÁGINA|\n#{1,3}\s|$))/i);
  if (famMatch && famMatch[1]?.trim().length > 20) {
    contextParts.push(`Contexto Familiar: ${famMatch[1].trim()}`);
  }

  const plantMatch = text.match(/(?:Características\s+del\s+plantel|Infraestructura\s+escolar|Instalaciones\s+y\s+equipamiento)[:\s]*([\s\S]*?)(?=\b(?:Indicadores\s+educativos|Programas|Análisis\s+general|FODA|=== PÁGINA|\n#{1,3}\s|$))/i);
  if (plantMatch && plantMatch[1]?.trim().length > 20) {
    contextParts.push(`Infraestructura del Plantel: ${plantMatch[1].trim()}`);
  }

  const indMatch = text.match(/(?:Indicadores\s+educativos\s+del\s+plantel|Indicadores\s+académicos)[:\s]*([\s\S]*?)(?=\b(?:Programas|Instalaciones|Análisis\s+general|FODA|=== PÁGINA|\n#{1,3}\s|$))/i);
  if (indMatch && indMatch[1]?.trim().length > 20) {
    contextParts.push(`Indicadores Educativos: ${indMatch[1].trim()}`);
  }

  const analMatch = text.match(/(?:Análisis\s+general|Diagnóstico\s+general|Síntesis\s+del\s+diagnóstico)[:\s]*([A-ZÁÉÍÓÚ][^\n\r]*(?:\r?\n[^\n\r]*){0,10})/i);
  if (analMatch && analMatch[1]?.trim().length > 20) {
    contextParts.push(`Diagnóstico Síntesis: ${analMatch[1].trim()}`);
  }

  if (contextParts.length > 0) {
    studentContext = contextParts.join('\n\n');
  } else {
    const fallbackMatch = text.match(/(?:Contexto|Diagn[oó]stico|Caracterizaci[oó]n)[^\n\r]*[:\-\s]*([^\n\r]+(?:\r?\n[^\n\r]+){1,6})/i);
    if (fallbackMatch && fallbackMatch[1]?.trim().length > 30) {
      studentContext = fallbackMatch[1].trim();
    }
  }

  // 5. Clave CCT (10 caracteres, ej: 21EBH0200X, 21ECT0017T)
  const cctMatch = text.match(/\b([0-9]{2}[A-Z]{3}[0-9]{4}[A-Z])\b/);
  if (cctMatch) {
    cct = cctMatch[1].trim();
  }

  // 6. Nombre del plantel
  const schoolMatch = text.match(/(?:Bachillerato\s+(?:General\s+Estatal|Tecnol[oó]gico|Digital)?|Plantel|Escuela|CBTIS|CBTA|CECyTE|CONALEP)[^\n\r,.;]{3,80}/i);
  if (schoolMatch) {
    schoolName = schoolMatch[0].trim();
  }

  // 7. Municipio / Localidad
  const munMatch = text.match(/(?:Municipio|Localidad|Ubicaci[oó]n|en\s+el\s+municipio\s+de)[:\s]*([A-ZÁÉÍÓÚ][a-záéíóúñA-ZÁÉÍÓÚ\s]{3,40})(?:,|\.|\r?\n|$)/i);
  if (munMatch) {
    municipality = munMatch[1].trim();
  }

  const clean = (s: string) => removeHyphens(s.replace(/=== PÁGINA \d+ ===/g, '').replace(/#+/g, '').replace(/\s+/g, ' ').trim());

  return {
    projectName: projectName ? clean(projectName) : null,
    objective: objective ? clean(objective) : null,
    problem: problem ? clean(problem).slice(0, 600) : null,
    studentContext: studentContext ? clean(studentContext) : null,
    schoolName: schoolName ? clean(schoolName) : null,
    municipality: municipality ? clean(municipality) : null,
    cct: cct ? clean(cct) : null,
    planOperativo,
  };
}

/**
 * Síntesis contextual de respaldo (último recurso).
 */
export function synthesizeProblemFallback(projectName: string, objective: string): string {
  const title = (projectName + ' ' + objective).toLowerCase();
  
  if (title.includes('salud') || title.includes('vida saludable') || title.includes('adiccion') || title.includes('riesgo') || title.includes('resilien')) {
    return 'Necesidad de cultivar una cultura de autocuidado, alimentación balanceada y prevención de conductas de riesgo (alcoholismo, sustancias nocivas y sedentarismo) en los estudiantes y su comunidad.';
  }
  if (title.includes('recicla') || title.includes('ecolog') || title.includes('ambiente') || title.includes('tierra') || title.includes('basura') || title.includes('verde')) {
    return 'Acumulación de residuos sólidos plásticos y necesidad de implementar acciones comunitarias de reciclaje, conservación ambiental y sustentabilidad escolar.';
  }
  if (title.includes('palapa') || title.includes('infraestructura') || title.includes('espacio') || title.includes('obra')) {
    return 'Carencia de espacios adecuados y áreas techadas para el descanso, trabajo colaborativo y convivencia saludable del estudiantado.';
  }
  if (title.includes('academ') || title.includes('lectura') || title.includes('aprendizaje') || title.includes('habilidad')) {
    return 'Bajo aprovechamiento escolar y necesidad de fortalecer las habilidades cognitivas, lectoras y socioemocionales de los alumnos vinculadas a su entorno.';
  }

  const projectLabel = projectName ? `del proyecto "${projectName}"` : 'escolar y comunitario';
  return `Atención a las necesidades formativas y comunitarias identificadas en el marco ${projectLabel}, orientadas a favorecer el bienestar integral de los estudiantes y su vinculación con la localidad.`;
}
