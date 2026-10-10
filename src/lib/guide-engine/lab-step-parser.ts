/**
 * lab-step-parser.ts — Parser Determinista de Pasos de Laboratorio
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Transforma la prosa numerada de `stepByStepProcedure` (emitida por `lab-writer.ts`)
 * en una estructura tipada `LabStepCard[]` para su renderizado en cuadrícula visual.
 *
 * Reglas de diseño y degradación D9:
 * 1. Cero dependencias externas y ejecución 100% offline.
 * 2. Si el texto no contiene al menos 3 pasos válidos numerados correlativos,
 *    devuelve `[]` para que el renderer degrade limpiamente a los párrafos planos actuales.
 * 3. Aísla código fuente en bloques o líneas y detecta salidas esperadas (Terminal / Output).
 */

import type { LabStepCard } from '@/types/work-textbook';

export function parseLabStepsFromProse(text: string | null | undefined): LabStepCard[] {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return [];
  }

  const lines = text.split(/\r?\n/);
  const rawSteps: { stepNumber: number; rawLines: string[] }[] = [];
  let currentStep: { stepNumber: number; rawLines: string[] } | null = null;

  // Regex para detectar inicio de paso numerado:
  // "1. Título", "1) Título", "Paso 1: Título", "PASO 1. Título"
  const stepStartRegex = /^\s*(?:paso\s*)?(\d+)[\.\:\)]\s*(.*)$/i;

  for (const line of lines) {
    const trimmed = line.trim();
    // Ignorar tags especiales como <!--workbook:...-->
    if (trimmed.startsWith('<!--workbook:') && trimmed.endsWith('-->')) {
      continue;
    }

    const match = line.match(stepStartRegex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) {
        if (currentStep) {
          rawSteps.push(currentStep);
        }
        currentStep = {
          stepNumber: num,
          rawLines: [match[2].trim()],
        };
        continue;
      }
    }

    if (currentStep) {
      currentStep.rawLines.push(line);
    }
  }

  if (currentStep) {
    rawSteps.push(currentStep);
  }

  // Criterio de degradación D9: mínimo 3 pasos estructurados
  if (rawSteps.length < 3) {
    return [];
  }

  const parsedCards: LabStepCard[] = [];

  for (const step of rawSteps) {
    const rawContent = step.rawLines.join('\n').trim();
    if (!rawContent) continue;

    let title = '';
    let actionDescription = '';
    let codeSnippet: string | undefined;
    let expectedOutput: string | undefined;
    let tipOrNote: string | undefined;

    // 1. Extraer bloques de código delimitados por ``` si existen
    const codeBlockRegex = /```(?:[a-zA-Z0-9_\-]+)?\s*\n([\s\S]*?)```/;
    const codeMatch = rawContent.match(codeBlockRegex);
    let remainingText = rawContent;

    if (codeMatch) {
      codeSnippet = codeMatch[1].trim();
      remainingText = remainingText.replace(codeBlockRegex, '').trim();
    }

    // 2. Extraer Salida esperada / Output
    const outputRegex = /(?:salida(?:\s+esperada)?|output|resultado(?:\s+esperado)?)\s*:\s*([^\n\r]+(?:\n[^\n\r]+)*)/i;
    const outputMatch = remainingText.match(outputRegex);
    if (outputMatch) {
      expectedOutput = outputMatch[1].trim();
      remainingText = remainingText.replace(outputRegex, '').trim();
    }

    // 3. Extraer Tip / Nota
    const noteRegex = /(?:nota|tip|pista|atenci[oó]n)\s*:\s*([^\n\r]+)/i;
    const noteMatch = remainingText.match(noteRegex);
    if (noteMatch) {
      tipOrNote = noteMatch[1].trim();
      remainingText = remainingText.replace(noteRegex, '').trim();
    }

    // 4. Analizar líneas para extraer código/comandos y separar Título de Descripción
    const stepLines = remainingText.split('\n').map((l) => l.trim()).filter(Boolean);
    const nonCodeLines: string[] = [];

    for (const sLine of stepLines) {
      if (!codeSnippet && (/^\s*(\$|pip\s+|python\s+)/i.test(sLine) || /^\s*(?:df[\.\[]|print\(|import\s|[a-zA-Z_]\w*\s*=[^=])/.test(sLine))) {
        codeSnippet = sLine.trim();
      } else {
        nonCodeLines.push(sLine);
      }
    }

    if (nonCodeLines.length > 0) {
      const firstLine = nonCodeLines[0];
      // Si la primera línea tiene separador ":" o "-" o "."
      const sepMatch = firstLine.match(/^([^:\-\.]{3,60})[:\-\.]\s*(.*)$/);
      if (sepMatch && sepMatch[2].trim().length > 0) {
        title = sepMatch[1].trim();
        actionDescription = [sepMatch[2].trim(), ...nonCodeLines.slice(1)].join(' ').trim();
      } else {
        // Si no hay separador obvio, la primera línea es el título si es breve (<= 50 chars)
        if (firstLine.length <= 50) {
          title = firstLine;
          actionDescription = nonCodeLines.slice(1).join(' ').trim() || firstLine;
        } else {
          title = `Paso ${step.stepNumber}`;
          actionDescription = nonCodeLines.join(' ').trim();
        }
      }
    } else {
      title = `Paso ${step.stepNumber}`;
      actionDescription = 'Ejecución técnica del procedimiento.';
    }

    parsedCards.push({
      stepNumber: step.stepNumber,
      title,
      actionDescription: actionDescription || title,
      codeSnippet,
      expectedOutput,
      tipOrNote,
    });
  }

  // Validar nuevamente degradación tras parsear
  if (parsedCards.length < 3) {
    return [];
  }

  return parsedCards;
}
