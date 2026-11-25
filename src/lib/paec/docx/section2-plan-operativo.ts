/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Paragraph,
  Table,
  TableRow,
  AlignmentType,
  PageBreak,
} from 'docx';
import type { PlanOperativoRow } from '@/types/paec';
import {
  C,
  safeStr,
  tc,
  tcH,
  tblL,
  macroH,
  type PaecDocxContext,
} from './helpers';

export function buildPaecDocxSection2(ctx: PaecDocxContext): (Paragraph | Table)[] {
  const { p } = ctx;

  // ═════════════════════════════════════════════════════════════════════════════
  // SECCIÓN 2 (LANDSCAPE): PLAN OPERATIVO SEMESTRE A Y SEMESTRE B (16 SEMANAS)
  // ═════════════════════════════════════════════════════════════════════════════
  const s2Children: (Paragraph | Table)[] = [];

  s2Children.push(...macroH('Macro-Fase III (A): Plan Operativo Territorial — Semestre A (16 Semanas)', 'Despliegue operativo semanal con articulación multidisciplinaria de 8 columnas'));

  const planA: PlanOperativoRow[] = p.fase3PlanOperativoA || (p.fase2PlanOperativo as Record<string, any>)?.semestreA || [];
  const planWidths = [800, 1400, 1800, 3600, 1500, 1700, 2000, 1600]; // Sum: 14400 (exacto en Landscape)

  const makePlanRows = (data: PlanOperativoRow[], isSemestreB = false): TableRow[] => {
    const rows: TableRow[] = [
      new TableRow({
        children: [
          tcH('Sem.', { w: 800, size: 17 }),
          tcH('Fase PEC', { w: 1400, size: 17 }),
          tcH('Materias / UAC', { w: 1800, size: 17 }),
          tcH('Actividad Detallada de Aprendizaje Situado', { w: 3600, size: 17 }),
          tcH('Metodología Activa', { w: 1500, size: 17 }),
          tcH('Recursos Requeridos', { w: 1700, size: 17 }),
          tcH('Productos / Evidencias', { w: 2000, size: 17 }),
          tcH('Responsables', { w: 1600, size: 17 }),
        ],
      }),
    ];

    if (data.length === 0) {
      rows.push(new TableRow({ children: [tc('Plan operativo pendiente de generación.', { span: 8, italics: true })] }));
      return rows;
    }

    data.forEach((r: any, idx) => {
      const week = r.week || r.semana || `${idx + 1}`;
      const isWeek16 = String(week) === '16';
      const isCallout = isSemestreB && isWeek16;
      const rowFill = isCallout ? C.accentLight : idx % 2 === 1 ? C.alt : C.white;

      const fase = r.phase || r.fase || 'Fase Operativa';
      const uac = r.uac || 'UACs Participantes';
      const act = r.activity || r.actividad || 'Actividad situada';
      const met = r.strategy || r.metodologia || r.estrategia || 'Aprendizaje Basado en Proyectos';
      const rec = r.progression || r.recursos || r.progresion || 'Materiales del entorno';
      const evi = r.evaluationInstrument || r.evidencia || r.instrumento || 'Rúbrica de evaluación';
      const resp = r.responsibles || r.responsable || 'Docentes y Estudiantes';

      rows.push(
        new TableRow({
          children: [
            tc(`Sem. ${week}`, { w: 800, bold: true, align: AlignmentType.CENTER, fill: rowFill, color: isCallout ? C.dark : C.text, compact: true, size: 17 }),
            tc(safeStr(fase), { w: 1400, fill: rowFill, compact: true, size: 17 }),
            tc(safeStr(uac), { w: 1800, bold: true, fill: rowFill, compact: true, size: 17 }),
            tc(safeStr(act), { w: 3600, fill: rowFill, compact: true, size: 17, bold: isCallout }),
            tc(safeStr(met), { w: 1500, fill: rowFill, compact: true, size: 17 }),
            tc(safeStr(rec), { w: 1700, fill: rowFill, compact: true, size: 17 }),
            tc(safeStr(evi), { w: 2000, fill: rowFill, compact: true, size: 17 }),
            tc(safeStr(resp), { w: 1600, fill: rowFill, compact: true, size: 17 }),
          ],
        })
      );
    });

    return rows;
  };

  s2Children.push(tblL(makePlanRows(planA, false), planWidths));
  s2Children.push(new Paragraph({ children: [new PageBreak()] }));

  // Plan Operativo Semestre B
  s2Children.push(...macroH('Macro-Fase III (B): Plan Operativo Territorial — Semestre B (16 Semanas)', 'Despliegue operativo semanal con Callout Normativo en Semana 16 para la Feria Comunitaria'));
  const planB: PlanOperativoRow[] = p.fase3PlanOperativoB || (p.fase2PlanOperativo as Record<string, any>)?.semestreB || [];
  s2Children.push(tblL(makePlanRows(planB, true), planWidths));


  return s2Children;
}
