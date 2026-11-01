import { describe, it, expect } from 'vitest';
import { removeHyphens } from '@/lib/text-utils';
import { parsePlanOperativoHeuristics, parsePaecHeuristics } from '@/lib/paec-heuristics';

describe('PAEC Extractor Robustness — Heuristics & Sanitization', () => {
  it('1. Extrae el nombre completo del PEC incluyendo subtítulos en paréntesis en saltos de línea', () => {
    const rawMarkdown = `
# BACHILLERATO GENERAL ESTATAL "HÉROES DE LA PATRIA"
## PROYECTO ESCOLAR COMUNITARIO (PEC)
### Comunidad Resiliente: Vida Saludable
### (Bienestar Integral y Prevención de Riesgos)
`;
    const clean = (s: string) => removeHyphens(s.replace(/=== PÁGINA \d+ ===/g, '').replace(/#+/g, '').replace(/\s+/g, ' ').trim());

    const nameMatchCover = rawMarkdown.match(/(?:PROYECTO\s+ESCOLAR\s+COMUNITARIO(?:\s*\(PEC\))?|PEC)\s*[\r\n]+#*\s*([A-ZÁÉÍÓÚ0-9][^\r\n]{4,100})(?:\s*[\r\n]+#*\s*(\([^\r\n\)]+\)))?/i);
    expect(nameMatchCover).not.toBeNull();
    const extracted = clean(nameMatchCover![1].trim() + (nameMatchCover![2] ? ' ' + nameMatchCover![2].trim() : ''));
    expect(extracted).toBe('Comunidad Resiliente: Vida Saludable (Bienestar Integral y Prevención de Riesgos)');
  });

  it('2. Extrae el nombre oficial entrecomillado en la sección de Introducción', () => {
    const rawText = `
Por tanto, se presenta el Proyecto Escolar Comunitario (PEC) para el ciclo escolar 2025-2026, titulado: "Comunidad Resiliente: Vida Saludable (Bienestar Integral y Prevención de Riesgos)".
`;
    const clean = (s: string) => removeHyphens(s.replace(/=== PÁGINA \d+ ===/g, '').replace(/#+/g, '').replace(/\s+/g, ' ').trim());
    const nameMatchQuotes = rawText.match(/(?:titulado|denominado|nombre del proyecto|proyecto[:\s])\s*[:\-\s]*["'«“]([\s\S]*?)["'»”]/i);
    expect(nameMatchQuotes).not.toBeNull();
    const extracted = clean(nameMatchQuotes![1]);
    expect(extracted).toBe('Comunidad Resiliente: Vida Saludable (Bienestar Integral y Prevención de Riesgos)');
  });

  it('3. Extrae y ensambla la caracterización multidimensional de los estudiantes desde las secciones del diagnóstico', () => {
    const rawDoc = `
Características de la comunidad
Ubicación geográfica: Localidad: Coronel Tito Hernández, Municipio: Venustiano Carranza, Estado: Puebla.
Situación socioeconómica: Actividades principales: La economía está basada en la citricultura y ganadería.

Características de la educación
Características del estudiantado: Punto clave: Los estudiantes ya están familiarizados con el trabajo colaborativo. Fortalezas: Deportes y cultura socioemocional ConstruyeT.
Contexto familiar: Nivel socioeconómico medio-bajo con padres de escolaridad básica.
Características del plantel: Matrícula atendida: 190 estudiantes.
Indicadores educativos del plantel: Aprovechamiento del 96%, reprobación del 4% y deserción del 15%.
Análisis general: Tenemos estudiantes con fortalezas socioemocionales y deportivas que podemos potenciar, enfrentando debilidades de infraestructura y hábitos alimenticios.
`;

    const clean = (s: string) => removeHyphens(s.replace(/=== PÁGINA \d+ ===/g, '').replace(/#+/g, '').replace(/\s+/g, ' ').trim());
    const contextParts: string[] = [];

    const ubMatch = rawDoc.match(/(?:Ubicación\s+geográfica|Localidad)[:\s]*([^\n\r]+(?:,\s*[^\n\r]+){1,3})/i);
    if (ubMatch) contextParts.push(`Ubicación y Entorno: ${clean(ubMatch[1])}`);

    const ecoMatch = rawDoc.match(/(?:Situación\s+socioeconómica|Economía\s+local|Actividades\s+principales)[:\s]*([^\n\r]+(?:\r?\n[^\n\r]+){0,3})/i);
    if (ecoMatch) contextParts.push(`Contexto Socioeconómico: ${clean(ecoMatch[1])}`);

    const estMatch = rawDoc.match(/(?:Características\s+del\s+estudiantado|Perfil\s+del\s+estudiante|Contexto\s+estudiantil)[:\s]*([\s\S]*?)(?=\b(?:Características\s+del\s+plantel|Contexto\s+familiar|Indicadores|Análisis\s+general|FODA|=== PÁGINA|\n#{1,3}\s|$))/i);
    if (estMatch) contextParts.push(`Perfil del Estudiantado: ${clean(estMatch[1])}`);

    const famMatch = rawDoc.match(/(?:Contexto\s+familiar|Entorno\s+familiar)[:\s]*([\s\S]*?)(?=\b(?:Características\s+del\s+estudiantado|Características\s+del\s+plantel|Indicadores|Análisis\s+general|FODA|=== PÁGINA|\n#{1,3}\s|$))/i);
    if (famMatch) contextParts.push(`Contexto Familiar: ${clean(famMatch[1])}`);

    const plantMatch = rawDoc.match(/(?:Características\s+del\s+plantel|Infraestructura\s+escolar|Instalaciones\s+y\s+equipamiento)[:\s]*([\s\S]*?)(?=\b(?:Indicadores\s+educativos|Programas|Análisis\s+general|FODA|=== PÁGINA|\n#{1,3}\s|$))/i);
    if (plantMatch) contextParts.push(`Infraestructura del Plantel: ${clean(plantMatch[1])}`);

    const indMatch = rawDoc.match(/(?:Indicadores\s+educativos\s+del\s+plantel|Indicadores\s+académicos)[:\s]*([\s\S]*?)(?=\b(?:Programas|Instalaciones|Análisis\s+general|FODA|=== PÁGINA|\n#{1,3}\s|$))/i);
    if (indMatch) contextParts.push(`Indicadores Educativos: ${clean(indMatch[1])}`);

    const analMatch = rawDoc.match(/(?:Análisis\s+general|Diagnóstico\s+general|Síntesis\s+del\s+diagnóstico)[:\s]*([A-ZÁÉÍÓÚ][^\n\r]*(?:\r?\n[^\n\r]*){0,10})/i);
    if (analMatch) contextParts.push(`Diagnóstico Síntesis: ${clean(analMatch[1])}`);

    const studentContext = contextParts.join('\n\n');

    expect(studentContext).toContain('Ubicación y Entorno: Localidad: Coronel Tito Hernández, Municipio: Venustiano Carranza, Estado: Puebla.');
    expect(studentContext).toContain('Contexto Socioeconómico: Actividades principales: La economía está basada en la citricultura y ganadería.');
    expect(studentContext).toContain('Perfil del Estudiantado: Punto clave: Los estudiantes ya están familiarizados con el trabajo colaborativo. Fortalezas: Deportes y cultura socioemocional ConstruyeT.');
    expect(studentContext).toContain('Contexto Familiar: Nivel socioeconómico medio-bajo con padres de escolaridad básica.');
    expect(studentContext).toContain('Infraestructura del Plantel: Matrícula atendida: 190 estudiantes.');
    expect(studentContext).toContain('Indicadores Educativos: Aprovechamiento del 96%, reprobación del 4% y deserción del 15%.');
    expect(studentContext).toContain('Diagnóstico Síntesis: Tenemos estudiantes con fortalezas socioemocionales y deportivas que podemos potenciar, enfrentando debilidades de infraestructura y hábitos alimenticios.');
  });

  it('4. Sanitiza texto eliminando guiones divididos sin corromper palabras legítimas', () => {
    const rawStudentContext = 'Los estudian- tes de primer semestre presentan problemas de deshidrata-   ción y hábi-\ntos de alimen- tación deficientes en un entorno teórico-práctico.';
    const sanitized = removeHyphens(rawStudentContext).replace(/\s+/g, ' ').trim();
    expect(sanitized).toBe('Los estudiantes de primer semestre presentan problemas de deshidratación y hábitos de alimentación deficientes en un entorno teórico-práctico.');
  });

  it('5. parsePlanOperativoHeuristics extrae tablas del Plan Operativo eliminando anclas ⟦T##·R##·C##⟧ y discriminando tablas de mapeo simple', () => {
    const sampleMarkdown = `
## Mapeo Curricular Preliminar (Sin Plan Operativo)
| Asignatura | Problemática Comunitaria |
|---|---|
| Historia | Diagnóstico general |

## Plan Operativo Oficial del Proyecto
| Fase | Asignatura / UAC | Actividad Operativa | Semana | Producto o Evidencia | Responsable |
|---|---|---|---|---|---|
| Fase 1 | ⟦T08·R01·C01⟧ **Dibujo Técnico I** | ⟦T08·R01·C02⟧ Mapeo participativo y levantamiento de datos espaciales comunitarios | Semana 2 | Croquis técnico del área | Docente Dibujo |
| Fase 2 | ⟦T08·R02·C01⟧ Taller Pensamiento Variacional I | ⟦T08·R02·C02⟧ Modelado matemático y estadístico de factores de riesgo | Semana 4 | Reporte analítico de variación | Docente Matemáticas |
`;

    const extracted = parsePlanOperativoHeuristics(sampleMarkdown);
    expect(extracted).toHaveLength(2);
    expect(extracted[0].asignatura).toBe('Dibujo Técnico I');
    expect(extracted[0].actividad).toBe('Mapeo participativo y levantamiento de datos espaciales comunitarios');
    expect(extracted[0].semana).toBe('Semana 2');
    expect(extracted[1].asignatura).toBe('Taller Pensamiento Variacional I');
    expect(extracted[1].actividad).toBe('Modelado matemático y estadístico de factores de riesgo');
  });

  it('6. parsePaecHeuristics procesa markdown con tablas y extrae plan operativo íntegro', () => {
    const docWithPlan = `
# PROYECTO ESCOLAR COMUNITARIO (PEC)
Comunidad Resiliente: Vida Saludable

Problemáticas o necesidades de la comunidad
Etapa tres: Selección del problema: Elevada prevalencia de sedentarismo y conductas de riesgo en jóvenes.

| Fase | UAC / Asignatura | Actividades Específicas | Semana | Producto / Evidencia |
|---|---|---|---|---|
| Fase 1 | Dibujo Técnico I | Trazado de mapas de zonas recreativas | Semanas 1-3 | Plano comunitario |
`;
    const res = parsePaecHeuristics(docWithPlan);
    expect(res.projectName).toContain('Comunidad Resiliente');
    expect(res.problem).toContain('Elevada prevalencia de sedentarismo');
    expect(res.planOperativo).toHaveLength(1);
    expect(res.planOperativo[0].asignatura).toBe('Dibujo Técnico I');
    expect(res.planOperativo[0].actividad).toBe('Trazado de mapas de zonas recreativas');
  });

  it('7. parsePlanOperativoHeuristics mantiene colMap estable con celdas internas que contienen palabras clave y excluye Tabla 8 de actividades macro', () => {
    const markdown = `
## Tabla 8. Actividades Macro y Asignaturas Viga Maestra
| Fase | Actividades Macro | Asignaturas Viga Maestra | Responsables |
|---|---|---|---|
| Fase 1 | Coordinación general | Lengua y Comunicación | Comité Escolar |

## Tabla 10. Plan Operativo Oficial del Proyecto
| Semestre | Fase | Asignatura / UAC | Actividad / Acción | Estrategia | Progresiones/Recursos | Productos | Responsables |
|---|---|---|---|---|---|---|---|
| 5to | Fase 1 | Taller de Pensamiento Variacional I | C01: Análisis de razones de cambio y variación | Estrategia de indagación y actividad matemática | P01 a P04 | Reporte gráfico | Docente A |
| 5to | Fase 1 | Dibujo Técnico I | C02: Representación técnica a escala | Estrategia gráfica | P01 a P03 | Plano | Docente B |
| 5to | Fase 2 | Taller de Pensamiento Variacional I | C03: Modelado de optimización de recursos | Actividad de campo con la asignatura de física | P05 a P08 | Maqueta | Docente A |
| 6to | Fase 2 | Dibujo Técnico II | C04: Proyección ortogonal en maqueta | Estrategia proyectual | P01 a P08 | Lámina | Docente B |
`;
    const res = parsePlanOperativoHeuristics(markdown);
    // Debe excluir Tabla 8 y procesar exactamente las 4 filas de Tabla 10
    expect(res).toHaveLength(4);
    expect(res[0].asignatura).toBe('Taller de Pensamiento Variacional I');
    expect(res[0].actividad).toBe('C01: Análisis de razones de cambio y variación');
    expect(res[1].asignatura).toBe('Dibujo Técnico I');
    expect(res[1].actividad).toBe('C02: Representación técnica a escala');
    // Fila 3 contiene "actividad" y "asignatura" dentro de la columna Estrategia, pero colMap no debe corromperse
    expect(res[2].asignatura).toBe('Taller de Pensamiento Variacional I');
    expect(res[2].actividad).toBe('C03: Modelado de optimización de recursos');
    expect(res[3].asignatura).toBe('Dibujo Técnico II');
    expect(res[3].actividad).toBe('C04: Proyección ortogonal en maqueta');
  });

  it('8. parsePaecHeuristics limita la longitud de problem a un máximo de 600 caracteres', () => {
    const hugeProblemText = 'Problema grave de la comunidad: ' + 'Sedentarismo y consumo de alimentos ultraprocesados. '.repeat(30);
    const doc = `
# PROYECTO ESCOLAR COMUNITARIO
PEC Bienestar

Problemáticas o necesidades de la comunidad
Etapa tres: Selección del problema: ${hugeProblemText}

Fase 1: Diagnóstico
`;
    const res = parsePaecHeuristics(doc);
    expect(res.problem).toBeTruthy();
    expect(res.problem!.length).toBeLessThanOrEqual(600);
    expect(res.problem).toContain('Sedentarismo');
  });

  it('9. parsePaecHeuristics recupera studentContext mediante fallbackMatch cuando no hay encabezados segmentados', () => {
    const doc = `
# PROYECTO ESCOLAR COMUNITARIO
PEC Saludable

Caracterización de los estudiantes y el plantel:
El bachillerato se ubica en una zona semiurbana con alta cohesión social pero con carencia de espacios recreativos techados. Los estudiantes muestran interés en el deporte pero no cuentan con instalaciones adecuadas.

Propósito general: Fortalecer estilos de vida saludables.
`;
    const res = parsePaecHeuristics(doc);
    expect(res.studentContext).toBeTruthy();
    expect(res.studentContext).toContain('semiurbana');
    expect(res.studentContext).toContain('espacios recreativos techados');
  });
});
