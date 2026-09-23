/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * mission-rubric-generator.ts — Generador de Rúbricas Analíticas Situadas por Misión V7
 * SEMS Puebla · Marco Curricular Común de la EMS 2026-2027
 *
 * Genera y dibuja instrumentos de evaluación formativa analítica adaptados a cada misión:
 * - 4 Criterios con ponderación oficial MCCEMS (Concepto 30%, Taller/NOM 30%, PAEC 25%, Metacognición 15%)
 * - 4 Niveles de desempeño: Sobresaliente (10-9), Notable (8-7), Suficiente (6-5), Insuficiente (4-1)
 * - Descriptores contextualizados con el título de misión, fenómeno detonador y reto práctico
 * - Renderizado en tabla compacta integrada con el sistema de tokens V7
 */

import type jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  EvaluationRubricCriterion,
  MissionSection,
} from '@/types/work-textbook';
import {
  COLOR,
  RADIUS,
  STROKE,
  type RGB,
} from './design-tokens';
import {
  setFontHeading,
} from './font-loader';
import { sanitizePdfText } from './pdf-components-core';
import { stripMarkdown } from './content-extractor';

/**
 * Genera una rúbrica analítica situada y personalizada para una misión específica.
 */
export function generateMissionRubric(
  mission: MissionSection,
  subjectName?: string,
  paecContext?: string
): EvaluationRubricCriterion[] {
  const cleanTitle = sanitizePdfText(stripMarkdown(mission.title || 'Misión'));
  const topic = sanitizePdfText(stripMarkdown(mission.sessionTopic || subjectName || cleanTitle));
  const hookStory = mission.phenomenonHook?.story
    ? sanitizePdfText(stripMarkdown(mission.phenomenonHook.story)).slice(0, 80)
    : (paecContext ? `el contexto de ${paecContext}` : 'la situación del entorno comunitario');
  const safetyMention = mission.safetyOrWorkshopTip
    ? 'protocolos y normas técnicas de seguridad'
    : 'normas de seguridad y precisión metodológica';

  const rubrics: EvaluationRubricCriterion[] = [
    {
      criterion: `1. Dominio Conceptual y Fundamentación (${topic.slice(0, 32)})`,
      weightPercent: 30,
      levels: [
        {
          levelName: 'Excelente',
          points: 10,
          descriptor: `Explica con rigor y precisión los principios de ${topic}. Contrasta conceptos con falacias comunes y fundamenta teóricamente sus deducciones.`,
        },
        {
          levelName: 'Bueno',
          points: 8,
          descriptor: `Comprende y define los conceptos clave de ${topic}. Resuelve ejercicios demostrativos con mínimos errores de interpretación.`,
        },
        {
          levelName: 'Suficiente',
          points: 6,
          descriptor: `Identifica nociones básicas de ${topic}, pero muestra dificultades para explicar el porqué de los resultados o justificar el modelo.`,
        },
        {
          levelName: 'Requiere Apoyo',
          points: 4,
          descriptor: `Confunde los conceptos elementales de la misión o no logra explicar los principios fundamentales de ${topic}.`,
        },
      ],
    },
    {
      criterion: '2. Ejecución Procedimental y Seguridad en Taller/Laboratorio',
      weightPercent: 30,
      levels: [
        {
          levelName: 'Excelente',
          points: 10,
          descriptor: `Ejecuta la práctica (Yo Hago/Hacemos) con orden metódico, siguiendo ${safetyMention} y registrando evidencia cuantitativa rigurosa.`,
        },
        {
          levelName: 'Bueno',
          points: 8,
          descriptor: 'Sigue los pasos procedimentales y completa las actividades guiadas cumpliendo las medidas esenciales de cuidado y orden.',
        },
        {
          levelName: 'Suficiente',
          points: 6,
          descriptor: 'Realiza la práctica con omisiones menores en el registro de datos o requiere supervisión para mantener medidas de seguridad.',
        },
        {
          levelName: 'Requiere Apoyo',
          points: 4,
          descriptor: 'Desatiende los pasos del procedimiento, omite normas de seguridad o no entrega registros observables de la práctica.',
        },
      ],
    },
    {
      criterion: '3. Conexión Situada, Reto de Vida Diaria y PAEC',
      weightPercent: 25,
      levels: [
        {
          levelName: 'Excelente',
          points: 10,
          descriptor: `Resuelve el reto autónomo (Tú Haces) vinculándolo con ${hookStory}, proponiendo alternativas viables y de beneficio comunitario en Puebla.`,
        },
        {
          levelName: 'Bueno',
          points: 8,
          descriptor: 'Aplica el aprendizaje en el reto de la vida cotidiana, justificando su utilidad en el hogar o la comunidad escolar.',
        },
        {
          levelName: 'Suficiente',
          points: 6,
          descriptor: 'Plantea una respuesta básica al reto pero con escasa vinculación al contexto comunitario o situaciones reales del entorno.',
        },
        {
          levelName: 'Requiere Apoyo',
          points: 4,
          descriptor: 'No concluye el reto de vida diaria o la propuesta carece de viabilidad y relación con la problemática planteada.',
        },
      ],
    },
    {
      criterion: '4. Metacognición, Diagnóstico de Fallas y Resiliencia',
      weightPercent: 15,
      levels: [
        {
          levelName: 'Excelente',
          points: 10,
          descriptor: 'Aplica sistemáticamente la ruta de solución de fallas (troubleshooting), reflexiona en el semáforo y sustenta sus áreas de mejora.',
        },
        {
          levelName: 'Bueno',
          points: 8,
          descriptor: 'Identifica causas comunes de error, autoevalúa su desempeño honestamente y formula preguntas pertinentes para resolver dudas.',
        },
        {
          levelName: 'Suficiente',
          points: 6,
          descriptor: 'Reconoce dificultades con ayuda del docente, mostrando iniciativa limitada para diagnosticar fallas de forma autónoma.',
        },
        {
          levelName: 'Requiere Apoyo',
          points: 4,
          descriptor: 'No muestra reflexión metacognitiva, omite la autoevaluación o abandona la actividad ante el primer error.',
        },
      ],
    },
  ];

  return rubrics;
}

/**
 * Renderiza la tabla de rúbrica analítica por misión usando autoTable estilizado.
 */
export function drawMissionRubricTable(
  doc: jsPDF,
  rubric: EvaluationRubricCriterion[],
  margin: number,
  drawWidth: number,
  y: number,
  missionColor: RGB = COLOR.NAVY
): number {
  if (!rubric || rubric.length === 0) return y;

  // Banner compacto de la Rúbrica
  const bannerH = 6.5;
  doc.setFillColor(...COLOR.TABLE_ALT_ROW);
  doc.roundedRect(margin, y, drawWidth, bannerH, RADIUS.SM, RADIUS.SM, 'F');
  doc.setFillColor(...missionColor);
  doc.roundedRect(margin, y, 3.5, bannerH, RADIUS.SM, RADIUS.SM, 'F');

  setFontHeading(doc);
  doc.setFontSize(7.5);
  doc.setTextColor(...missionColor);
  doc.text('RÚBRICA FORMATIVA ANALÍTICA DE LA MISIÓN (MCCEMS)', margin + 6, y + 4.5);

  y += bannerH + 2.5;

  const tableBody = rubric.map((crit) => {
    const getLevelDesc = (lvlName: string): string => {
      const found = crit.levels.find((l) =>
        l.levelName.toLowerCase().includes(lvlName.toLowerCase())
      );
      return found ? sanitizePdfText(stripMarkdown(found.descriptor)) : 'N/A';
    };

    return [
      `${sanitizePdfText(crit.criterion)}\n[${crit.weightPercent}%]`,
      getLevelDesc('Excelente'),
      getLevelDesc('Bueno'),
      getLevelDesc('Suficiente'),
      getLevelDesc('Requiere Apoyo'),
    ];
  });

  const col0W = Math.floor(drawWidth * 0.28);
  const colRemainW = (drawWidth - col0W) / 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: drawWidth,
    head: [
      [
        'Criterio y Ponderación',
        'Sobresaliente (10-9)',
        'Notable (8-7)',
        'Suficiente (6-5)',
        'Requiere Apoyo (4-1)',
      ],
    ],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: missionColor,
      textColor: [255, 255, 255],
      fontSize: 6.2,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 5.5,
      cellPadding: 1.5,
      textColor: COLOR.TEXT_PRIMARY,
      lineColor: COLOR.TABLE_BORDER,
      lineWidth: STROKE.HAIRLINE,
    },
    columnStyles: {
      0: { cellWidth: col0W, fontStyle: 'bold' },
      1: { cellWidth: colRemainW },
      2: { cellWidth: colRemainW },
      3: { cellWidth: colRemainW },
      4: { cellWidth: colRemainW },
    },
  });

  return (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 4 : y + 30;
}
