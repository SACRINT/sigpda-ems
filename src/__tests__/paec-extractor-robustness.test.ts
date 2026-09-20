import { describe, it, expect } from 'vitest';
import { removeHyphens } from '@/lib/text-utils';

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
});
