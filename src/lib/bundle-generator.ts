/**
 * Phase 6C: Bundle Generator — Generates complementary teaching materials
 * Creates: Student Guide, Coevaluation Instrument, Slide Deck, Quiz
 */
import { generateWithRotation } from '@/lib/ai-provider';
import type { GeneratedPlanningContent } from '@/types/planning';

export interface BundleResult {
  guiaEstudiante: string;
  instrumentoEvaluacion: string;
  guionDiapositivas: string;
  quiz: string;
}

const SYSTEM_PROMPT = `Eres un generador de materiales didácticos para educación media superior en Puebla, México.
Genera materiales complementarios EXACTOS y ALINEADOS con la planeación proporcionada.
Sé conciso pero completo. Usa formato Markdown.
Todos los materiales deben ser impresibles en formato Carta.`;

function buildBundlePrompt(
  content: GeneratedPlanningContent,
  type: 'guia' | 'instrumento' | 'diapositivas' | 'quiz'
): string {
  const s = content;
  const base = `
UAC: ${s.sectionI.uacName}
Semestre: ${s.sectionI.semester}° ${s.sectionI.component}
Docente: ${s.sectionI.teacherName}
Ciclo: ${s.sectionI.schoolYear}

Propósito Formativo:
${s.sectionII.purpose}

Actividades Clave:
${s.sectionII.activities?.map((a, i) => `${i + 1}. ${a.name} (${a.hours}h)`).join('\n') || 'No especificadas'}

Contenidos Temáticos:
${s.sectionIV.activities?.map((a, i) => `${i + 1}. ${a.name}: ${a.methodology || 'Metodología activa'}`).join('\n') || 'No especificados'}
`;

  switch (type) {
    case 'guia':
      return `${base}
Genera una GUÍA DE TRABAJO DEL ALUMNO con los siguientes apartados:
1. Encabezado (UAC, Semestre, Nombre del alumno, Fecha)
2. Introducción breve del tema (2-3 párrafos orientadores)
3. Objetivos de aprendizaje (3-5 objetivos medibles)
4. Actividades prácticas paso a paso (al menos 3 actividades)
5. Espacio para reflexión y notas
6. Recursos complementarios sugeridos
7. Rúbrica de autoevaluación breve

Formato: Markdown limpio, listo para imprimir en tamaño Carta.`;

    case 'instrumento':
      return `${base}
Genera un INSTRUMENTO DE COEVALUACIÓN Y AUTOEVALUACIÓN con:
1. Lista de cotejo con 8-10 criterios observables
2. Escala de valoración: Excelente / Bueno / Regular / Necesita Mejorar
3. Espacio para autoevaluación del alumno
4. Espacio para coevaluación entre pares
5. Comentarios del docente
6. Firma del alumno y fecha

Formato: Tabla limpia en Markdown, imprimible en tamaño Carta.`;

    case 'diapositivas':
      return `${base}
Genera un GUION DE DIAPOSITIVAS para proyectar en clase con 8-12 láminas:
Cada lámina debe incluir:
- Título de la lámina
- Contenido principal (puntos clave, no párrafos largos)
- Pregunta detonadora o actividad breve
- Notas del docente para explicar

Estructura sugerida:
- Lámina 1: Título y objetivos
- Láminas 2-4: Contenido conceptual
- Láminas 5-7: Actividad práctica
- Láminas 8-9: Evaluación
- Lámina 10: Cierre y tarea

Formato: Markdown con separadores claros entre láminas.`;

    case 'quiz':
      return `${base}
Genera un QUIZ / EVALUACIÓN DIAGNÓSTICA RÁPIDA con:
1. Instrucciones generales
2. 10 reactivos de opción múltiple (4 opciones cada uno)
3. 2 reactivos de desarrollo breve
4. Clave de respuestas al final
5. Criterios de evaluación

Los reactivos deben evaluar:
- Comprensión del propósito formativo (3 reactivos)
- Aplicación de contenidos temáticos (4 reactivos)
- Análisis y reflexión (3 reactivos)

Formato: Markdown limpio, listo para imprimir.`;
  }
}

export async function generateBundle(
  content: GeneratedPlanningContent,
  type: 'guia' | 'instrumento' | 'diapositivas' | 'quiz'
): Promise<string> {
  const prompt = buildBundlePrompt(content, type);
  const result = await generateWithRotation(prompt, SYSTEM_PROMPT);
  return result;
}

export async function generateFullBundle(
  content: GeneratedPlanningContent
): Promise<BundleResult> {
  const [guiaEstudiante, instrumentoEvaluacion, guionDiapositivas, quiz] = await Promise.all([
    generateBundle(content, 'guia'),
    generateBundle(content, 'instrumento'),
    generateBundle(content, 'diapositivas'),
    generateBundle(content, 'quiz'),
  ]);

  return { guiaEstudiante, instrumentoEvaluacion, guionDiapositivas, quiz };
}

/**
 * Convert bundle markdown to simple HTML for download
 */
export function bundleMarkdownToHtml(markdown: string, title: string): string {
  let html = markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
    })
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { size: letter; margin: 2cm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; max-width: 215.9mm; margin: 0 auto; padding: 2cm; }
    h1 { font-size: 18pt; color: #1A3A5C; border-bottom: 2px solid #E8A020; padding-bottom: 8px; }
    h2 { font-size: 14pt; color: #2E6DA4; margin-top: 24px; }
    h3 { font-size: 12pt; color: #1A3A5C; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    td, th { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #D6E4F0; }
    li { margin: 4px 0; }
    .header { text-align: center; margin-bottom: 24px; }
    .header img { height: 40px; }
    .footer { text-align: center; font-size: 10pt; color: #666; margin-top: 32px; border-top: 1px solid #eee; padding-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <strong>SEP · Estado de Puebla · Bachillerato</strong><br>
    <small>${title}</small>
  </div>
  <p>${html}</p>
  <div class="footer">Documento generado por SIGPDA-EMS — ${new Date().toLocaleDateString('es-MX')}</div>
</body>
</html>`;
}
