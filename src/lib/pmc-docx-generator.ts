import { Document, Packer, Paragraph, Table } from 'docx';
import {
  computePmcIndicatorValues,
  type PmcIndicatorComputedValues,
  type PmcStatisticalContext,
} from './pmc-indicator-calculator';
import {
  C,
  MARGIN,
  parseJson,
  type PmcProject,
  type NormativaDoc,
  type DiagnosticoGenerado,
  type IndicadoresAcademicos,
  type FodaData,
  type PlanAccion,
} from './pmc/docx/helpers';
import {
  buildCoverPage,
  buildIndice,
  buildPresentacion,
  buildObjetivo,
  buildNormativa,
  buildDiagnostico,
  buildPriorizacion,
  AREAS_OBLIGATORIAS_51,
  PENDIENTE_DEFINICION_51,
  resolveAreaObligatoria51,
  type AreaObligatoriaConfig,
  type ResolvedArea51,
} from './pmc/docx/sections-diagnostico';
import {
  buildPlanAccion,
  buildMetasPersonales,
  buildControlRevisiones,
} from './pmc/docx/sections-plan-accion';
import { generatePmcInformeDocx } from './pmc/docx/informe-generator';

export {
  AREAS_OBLIGATORIAS_51,
  PENDIENTE_DEFINICION_51,
  resolveAreaObligatoria51,
  generatePmcInformeDocx,
  type PmcProject,
  type AreaObligatoriaConfig,
  type ResolvedArea51,
};

// ─── Main Generator ───────────────────────────────────────────────────────────
export async function generatePmcDocx(project: PmcProject): Promise<Buffer> {
  const normativa = parseJson<NormativaDoc>(project.normativa);
  const diag = parseJson<DiagnosticoGenerado>(project.diagnostico_generado);
  const indic = parseJson<IndicadoresAcademicos>(project.indicadores_academicos);
  const statsCtx = parseJson<PmcStatisticalContext>(project.statistical_context);
  const foda = parseJson<FodaData>(project.foda);
  const plan = parseJson<PlanAccion>(project.plan_accion);
  const categorias = parseJson<Array<{ id?: string; nombre?: string; temas?: string[] }>>(project.categorias_priorizadas);
  const categoriasArr = Array.isArray(categorias) ? categorias : [];

  const children: (Paragraph | Table)[] = [
    ...buildCoverPage(project),
    ...buildIndice(),
    ...buildPresentacion(diag, project),
    ...buildObjetivo(project),
    ...buildNormativa(normativa),
    ...buildDiagnostico(diag, indic, foda, statsCtx, project),
    ...buildPriorizacion(diag, categoriasArr),
    ...buildPlanAccion(plan, project),
    ...buildMetasPersonales(plan),
    ...buildControlRevisiones(project, plan),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 20, color: C.text },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN,
              right: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
            },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export function getPmcDocxIndicatorValues(project: PmcProject): PmcIndicatorComputedValues {
  const indic = parseJson<IndicadoresAcademicos>(project.indicadores_academicos);
  const statsCtx = parseJson<PmcStatisticalContext>(project.statistical_context);
  return computePmcIndicatorValues(indic, statsCtx);
}

