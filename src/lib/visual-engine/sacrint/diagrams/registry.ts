import type { MissionSection } from '@/types/work-textbook';
import { finalizeVisibleText, fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import { hasDanglingEnding } from '@/lib/editorial/fitter/dangling-guards';
import type { SacrintPack } from '../discipline-packs';
import type {
  DiagramBuildOptions,
  RegulationFlowDiagramSpec,
  SacrintDiagramSpec,
  SacrintVariable,
  TrainingCycleDiagramSpec,
} from '../types';
import {
  clip,
  compactNonQuantitativeDiagram,
  toSessionScopedMission,
} from './shared';
import { buildMathDiagram } from './math-diagrams';
import {
  buildArgumentDiagram,
  buildBlockDiagram,
  buildClinicalFlowDiagram,
  buildConceptDiagram,
  buildLanguageDiagram,
  buildReactionDiagram,
  buildSopFlowDiagram,
  buildSystemMapDiagram,
  buildTimelineDiagram,
} from './conceptual-diagrams';
import {
  buildCreativeCycleDiagram,
  buildRegulationFlowDiagram,
  buildTrainingCycleDiagram,
} from './cycle-diagrams';

export function buildSacrintDiagram(
  mission: MissionSection,
  pack: SacrintPack,
  options: DiagramBuildOptions = {}
): SacrintDiagramSpec {
  const effectiveMission = options.session
    ? toSessionScopedMission(mission, options.session, options.allowMissionFallback ?? true)
    : mission;

  const built = ((): SacrintDiagramSpec => {
    switch (pack.diagram) {
      case 'linear-model':
        return buildMathDiagram(effectiveMission, options);
      case 'reaction-scheme':
        return buildReactionDiagram(effectiveMission);
      case 'argument-map':
      case 'rhetorical-map':
        return buildArgumentDiagram(effectiveMission, options);
      case 'word-map':
        return buildLanguageDiagram(effectiveMission);
      case 'timeline':
        return buildTimelineDiagram(effectiveMission);
      case 'system-map':
        return buildSystemMapDiagram(effectiveMission);
      case 'clinical-flow':
        return buildClinicalFlowDiagram(effectiveMission);
      case 'block-diagram':
        return buildBlockDiagram(effectiveMission);
      case 'sop-flow':
        return buildSopFlowDiagram(effectiveMission);
      case 'creative-cycle':
        return buildCreativeCycleDiagram(effectiveMission, options);
      case 'training-cycle':
        return buildTrainingCycleDiagram(effectiveMission, options);
      case 'regulation-flow':
        return buildRegulationFlowDiagram(effectiveMission, options);
      default:
        return buildConceptDiagram(effectiveMission);
    }
  })();

  return options.allowMissionFallback === false
    ? compactNonQuantitativeDiagram(built, options.theorySources)
    : built;
}

export function buildDiagramVariables(diagram: SacrintDiagramSpec): SacrintVariable[] {
  if (!diagram.available) return [];
  const safeVar = (raw: string | undefined, maxChars = 76): string => {
    const clean = (raw ?? '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    if (clean.length <= maxChars && !hasDanglingEnding(clean)) return clean;
    const fitted = fitPedagogicalText(clean, { maxChars, role: 'concept', ensurePeriod: false });
    if (fitted && !hasDanglingEnding(fitted) && fitted.length >= 10) return fitted;
    const finalized = finalizeVisibleText(clean, { maxChars: maxChars + 24, ensurePeriod: false });
    if (finalized && !hasDanglingEnding(finalized)) return finalized;
    return clean;
  };
  switch (diagram.kind) {
    case 'linear': {
      const isDefaultX = /^(?:eje\s+x|variable\s+independiente)/i.test(diagram.xLabel);
      const isDefaultY = /^(?:eje\s+y|variable\s+dependiente)/i.test(diagram.yLabel);
      return [
        {
          symbol: 'x',
          label: 'Eje X',
          meaning: isDefaultX ? `Dominio [0, ${diagram.domainMax}]` : diagram.xLabel,
        },
        {
          symbol: 'y',
          label: 'Eje Y',
          meaning: isDefaultY
            ? diagram.targetY !== undefined
              ? `Meta: y = ${diagram.targetY}`
              : `Rango [0, ${diagram.rangeMax}]`
            : diagram.yLabel,
        },
        {
          symbol: 'm',
          label: 'Pendiente',
          meaning: `Pendiente ${diagram.slope}`,
        },
        {
          symbol: 'b',
          label: 'Valor inicial',
          meaning: `Intersección ${diagram.intercept}`,
        },
      ];
    }
    case 'quadratic':
      return [
        {
          symbol: 'a',
          label: 'Concavidad',
          meaning: `a = ${diagram.a} (abre hacia ${diagram.a >= 0 ? 'arriba' : 'abajo'})`,
        },
        {
          symbol: 'V',
          label: 'Vértice óptimo',
          meaning: `(${diagram.vertexX}, ${diagram.vertexY})`,
        },
        {
          symbol: 'Δ',
          label: 'Discriminante',
          meaning: `b² - 4ac = ${Number((diagram.b * diagram.b - 4 * diagram.a * diagram.c).toFixed(2))}`,
        },
        {
          symbol: 'x₁,₂',
          label: 'Raíces reales',
          meaning: diagram.roots.length > 0 ? diagram.roots.join(' y ') : 'Sin raíces reales',
        },
      ];
    case 'system-2x2':
      return [
        { symbol: 'L₁', label: 'Ecuación 1', meaning: diagram.equation1 },
        { symbol: 'L₂', label: 'Ecuación 2', meaning: diagram.equation2 },
        {
          symbol: 'P*',
          label: 'Intersección',
          meaning: diagram.intersection
            ? `x = ${diagram.intersection.x}, y = ${diagram.intersection.y}`
            : 'Rectas paralelas',
        },
        {
          symbol: 'Δ',
          label: 'Determinante',
          meaning: `Δ = ${Number((diagram.a1 * diagram.b2 - diagram.a2 * diagram.b1).toFixed(2))}`,
        },
      ];
    case 'exponential': {
      const isPop = diagram.context === 'population' || /P\(t\)|Poblaci[oó]n/i.test(diagram.equation + ' ' + diagram.yLabel);
      const ratePct = Number((diagram.rate * 100).toFixed(2));
      const finalVal = diagram.compoundSeries[diagram.compoundSeries.length - 1]?.value ?? diagram.principal;
      if (isPop) {
        return [
          {
            symbol: 'P₀',
            label: 'Pob. inicial',
            meaning: `${diagram.principal.toLocaleString('en-US')} hab.`,
          },
          {
            symbol: 'r',
            label: 'Tasa anual',
            meaning: `${ratePct}%`,
          },
          {
            symbol: 't',
            label: 'Horizonte',
            meaning: `0 a ${diagram.periods} períodos`,
          },
          {
            symbol: 'P(t)',
            label: 'Pob. proyectada',
            meaning: `${finalVal.toLocaleString('en-US')} hab.`,
          },
        ];
      }
      return [
        {
          symbol: 'C₀',
          label: 'Capital inicial',
          meaning: `$${diagram.principal.toLocaleString('en-US')}`,
        },
        {
          symbol: 'r',
          label: 'Tasa por período',
          meaning: `${ratePct}%`,
        },
        {
          symbol: 't',
          label: 'Horizonte',
          meaning: `0 a ${diagram.periods} períodos`,
        },
        {
          symbol: 'M',
          label: 'Monto compuesto',
          meaning: `$${finalVal.toLocaleString('en-US')}`,
        },
      ];
    }
    case 'geometry':
      return [
        { symbol: '90\u00B0', label: 'Figura', meaning: clip(diagram.primaryLabel, 38) },
        { symbol: 'REGLA', label: 'Regla', meaning: clip(diagram.secondaryLabel, 38) },
        { symbol: 'E1', label: diagram.highlights[0]?.label ?? 'Elemento 1', meaning: clip(diagram.highlights[0]?.detail ?? '', 38) },
        { symbol: 'E2', label: diagram.highlights[1]?.label ?? 'Elemento 2', meaning: clip(diagram.highlights[1]?.detail ?? '', 38) },
      ];
    case 'reaction':
      return [
        {
          symbol: 'R',
          label: 'Reactivos',
          meaning: clip(diagram.reactants.map((node) => node.label).join(' + '), 72),
        },
        { symbol: 'Δ', label: 'Transformación', meaning: clip(diagram.condition, 72) },
        {
          symbol: 'P',
          label: 'Productos',
          meaning: clip(diagram.products.map((node) => node.label).join(' + '), 72),
        },
        { symbol: 'E', label: 'Evidencia', meaning: clip(diagram.note, 72) },
      ];
    case 'argument':
      return [
        { symbol: 'T', label: 'Tesis', meaning: safeVar(diagram.thesis.detail, 76) },
        { symbol: 'P', label: 'Premisas', meaning: safeVar(diagram.premises.map((node) => node.detail).join(' '), 76) },
        ...(diagram.objection.detail.trim()
          ? [{ symbol: 'O', label: 'Objeción', meaning: safeVar(diagram.objection.detail, 76) }]
          : []),
        { symbol: 'C', label: 'Conclusión', meaning: safeVar(diagram.conclusion.detail, 76) },
      ];
    case 'language':
      return [
        { symbol: 'E', label: 'Entrada', meaning: safeVar(diagram.input.detail, 76) },
        { symbol: 'F', label: 'Forma', meaning: safeVar(diagram.rule.detail, 76) },
        { symbol: 'S', label: 'Salida', meaning: safeVar(diagram.output.detail, 76) },
        { symbol: 'C', label: 'Contexto', meaning: safeVar(diagram.context.detail, 76) },
      ];
    case 'concept':
      return [
        { symbol: 'F', label: 'Fenómeno', meaning: safeVar(diagram.nodes[0]?.detail, 76) },
        { symbol: 'C', label: 'Concepto', meaning: safeVar(diagram.nodes[1]?.detail, 76) },
        { symbol: 'P', label: 'Práctica', meaning: safeVar(diagram.nodes[2]?.detail, 76) },
        { symbol: 'D', label: 'Decisión', meaning: safeVar(diagram.nodes[3]?.detail, 76) },
      ];
    case 'timeline':
      return [
        { symbol: 'T', label: 'Trayectoria', meaning: safeVar(diagram.span, 76) },
        {
          symbol: 'P',
          label: 'Proceso',
          meaning: safeVar(diagram.events[1]?.detail ?? diagram.events[0]?.detail ?? diagram.span, 76),
        },
        { symbol: 'C', label: 'Causalidad', meaning: safeVar(diagram.events[0]?.detail, 76) },
        {
          symbol: 'B',
          label: 'Balance',
          meaning: safeVar(diagram.events[diagram.events.length - 1]?.detail, 76),
        },
      ];
    case 'system-map':
      return [
        { symbol: 'S', label: 'Sistema', meaning: safeVar(diagram.center.detail, 76) },
        { symbol: 'C', label: 'Componentes', meaning: safeVar(diagram.components.map((node) => node.label).join(' · '), 76) },
        { symbol: 'E', label: 'Entorno', meaning: safeVar(diagram.environment.detail, 76) },
        { symbol: 'R', label: 'Respuesta', meaning: safeVar(diagram.components[2]?.detail, 76) },
      ];
    case 'clinical-flow':
      return [
        { symbol: 'S', label: 'Síntoma', meaning: safeVar(diagram.stages[0]?.detail, 76) },
        { symbol: 'E', label: 'Evaluación', meaning: safeVar(diagram.stages[1]?.detail, 76) },
        { symbol: 'D', label: 'Diagnóstico', meaning: safeVar(diagram.stages[2]?.detail, 76) },
        { symbol: 'C', label: 'Cuidado', meaning: safeVar(diagram.stages[3]?.detail, 76) },
      ];
    case 'block-diagram':
      return [
        { symbol: 'I', label: 'Entrada', meaning: safeVar(diagram.input.detail, 76) },
        { symbol: 'P', label: 'Proceso', meaning: safeVar(diagram.process.detail, 76) },
        { symbol: 'S', label: 'Salida', meaning: safeVar(diagram.output.detail, 76) },
        { symbol: 'R', label: 'Retroalimentación', meaning: safeVar(diagram.feedback.detail, 76) },
      ];
    case 'sop-flow':
      return [
        { symbol: 'P', label: 'Preparación', meaning: safeVar(diagram.steps[0]?.detail, 76) },
        { symbol: 'E', label: 'Ejecución', meaning: safeVar(diagram.steps[1]?.detail, 76) },
        { symbol: 'V', label: 'Verificación', meaning: safeVar(diagram.steps[2]?.detail, 76) },
        { symbol: 'N', label: 'Norma', meaning: safeVar(diagram.standard, 76) },
      ];
    case 'creative-cycle':
      return [
        { symbol: 'D', label: 'Detonante', meaning: safeVar(diagram.phases[0]?.detail, 76) },
        { symbol: 'X', label: 'Exploración', meaning: safeVar(diagram.phases[1]?.detail, 76) },
        { symbol: 'O', label: 'Obra', meaning: safeVar(diagram.phases[2]?.detail, 76) },
        { symbol: 'P', label: 'Difusión', meaning: safeVar(diagram.phases[3]?.detail, 76) },
      ];
    case 'training-cycle':
      return diagram.phases.slice(0, 4).map((phase, idx) => ({
        symbol: (phase.label[0] || String(idx + 1)).toUpperCase(),
        label: phase.label.charAt(0) + phase.label.slice(1).toLowerCase(),
        meaning: safeVar(phase.detail, 76),
      }));
    case 'regulation-flow':
      return diagram.stages.slice(0, 4).map((stage, idx) => ({
        symbol: (stage.label[0] || String(idx + 1)).toUpperCase(),
        label: stage.label.charAt(0) + stage.label.slice(1).toLowerCase(),
        meaning: safeVar(stage.detail, 76),
      }));
  }
}

function isPhysicalTrainingProtocol(diagram: TrainingCycleDiagramSpec): boolean {
  return diagram.phases.some((p) => p.label === 'CALENTAMIENTO' || p.label === 'ESFUERZO');
}

function isEmotionalRegulationProtocol(diagram: RegulationFlowDiagramSpec): boolean {
  return diagram.stages.some((s) => s.label === 'EMOCIÓN' || s.label === 'REGULACIÓN');
}

export function diagramFormula(diagram: SacrintDiagramSpec): string {
  if (!diagram.available) return '';
  switch (diagram.kind) {
    case 'linear':
    case 'quadratic':
    case 'exponential':
    case 'geometry':
    case 'reaction':
      return diagram.equation;
    case 'system-2x2':
      return `${diagram.equation1}  |  ${diagram.equation2}`;
    case 'argument':
      return 'P1 + P2 → T';
    case 'language':
      return 'ENTRADA → REGLA → SALIDA';
    case 'concept':
      return 'FENÓMENO → CONCEPTO → DECISIÓN';
    case 'timeline':
      return 'ANTECEDENTE → PROCESO → CONSECUENCIA';
    case 'system-map':
      return 'SISTEMA → COMPONENTES → EQUILIBRIO';
    case 'clinical-flow':
      return 'SÍNTOMA → EVALUACIÓN → CUIDADO';
    case 'block-diagram':
      return 'ENTRADA → PROCESO → SALIDA';
    case 'sop-flow':
      return 'PREPARACIÓN → EJECUCIÓN → VERIFICACIÓN';
    case 'creative-cycle':
      return 'DETONANTE → EXPLORACIÓN → OBRA → DIFUSIÓN';
    case 'training-cycle':
      return isPhysicalTrainingProtocol(diagram)
        ? 'CALENTAMIENTO → ESFUERZO → RECUPERACIÓN'
        : 'DIAGNÓSTICO → CRITERIO → APLICACIÓN';
    case 'regulation-flow':
      return isEmotionalRegulationProtocol(diagram)
        ? 'EMOCIÓN → INTERPRETACIÓN → RESPUESTA'
        : 'SITUACIÓN → ANÁLISIS → ACCIÓN';
  }
}

export function diagramModelLabel(diagram: SacrintDiagramSpec): string {
  switch (diagram.kind) {
    case 'linear':
      return 'Modelo lineal';
    case 'quadratic':
      return 'Modelo cuadrático';
    case 'system-2x2':
      return 'Sistema lineal 2×2';
    case 'exponential':
      return diagram.context === 'population' || /P\(t\)|Poblaci[oó]n/i.test(diagram.equation + ' ' + diagram.yLabel)
        ? 'Crecimiento exponencial'
        : 'Interés simple vs. compuesto';
    case 'geometry':
      return 'Modelo geométrico';
    case 'reaction':
      return 'Esquema de reacción';
    case 'argument':
      return 'Mapa argumental';
    case 'language':
      return 'Red de lengua';
    case 'concept':
      return 'Mapa conceptual';
    case 'timeline':
      return 'Línea de tiempo';
    case 'system-map':
      return 'Red de sistemas';
    case 'clinical-flow':
      return 'Flujo clínico';
    case 'block-diagram':
      return 'Diagrama de bloques';
    case 'sop-flow':
      return 'Flujo de procedimiento';
    case 'creative-cycle':
      return 'Ciclo creativo';
    case 'training-cycle':
      return isPhysicalTrainingProtocol(diagram) ? 'Ciclo de entrenamiento' : 'Práctica física';
    case 'regulation-flow':
      return isEmotionalRegulationProtocol(diagram) ? 'Flujo de regulación' : 'Ruta socioemocional';
  }
}

export function diagramSubtitle(diagram: SacrintDiagramSpec): string {
  switch (diagram.kind) {
    case 'linear':
      return 'Del fenómeno al modelo lineal';
    case 'quadratic':
      return 'Curva parabólica, vértice y raíces';
    case 'system-2x2':
      return 'Intersección simultánea de rectas';
    case 'exponential':
      return 'Comparación lineal vs. exponencial';
    case 'geometry':
      return 'Propiedades métricas y angulares';
    case 'reaction':
      return 'Del fenómeno a la reacción';
    case 'argument':
      return 'Del fenómeno al argumento';
    case 'language':
      return 'Del contexto a la producción';
    case 'concept':
      return 'Del fenómeno al concepto';
    case 'timeline':
      return 'Del contexto a la trayectoria';
    case 'system-map':
      return 'Del organismo al equilibrio';
    case 'clinical-flow':
      return 'Del síntoma al cuidado';
    case 'block-diagram':
      return 'Del requerimiento a la solución';
    case 'sop-flow':
      return 'Del estándar a la ejecución';
    case 'creative-cycle':
      return 'Del detonante a la difusión';
    case 'training-cycle':
      return isPhysicalTrainingProtocol(diagram)
        ? 'Del calentamiento a la adaptación'
        : 'Del diagnóstico a la mejora motriz';
    case 'regulation-flow':
      return isEmotionalRegulationProtocol(diagram)
        ? 'De la emoción a la regulación'
        : 'De la situación al bienestar';
  }
}

export function diagramFooterLabel(diagram: SacrintDiagramSpec): string {
  switch (diagram.kind) {
    case 'linear':
      return 'modelo · variables · decisión';
    case 'quadratic':
      return 'vértice · raíces · modelado';
    case 'system-2x2':
      return 'rectas · intersección · solución';
    case 'exponential':
      return diagram.context === 'population' || /P\(t\)|Poblaci[oó]n/i.test(diagram.equation + ' ' + diagram.yLabel)
        ? 'población · tasa · proyección'
        : 'capital · tasa · crecimiento';
    case 'geometry':
      return 'trazo · medida · teorema';
    case 'reaction':
      return 'reactivos · proceso · productos';
    case 'argument':
      return 'tesis · premisas · conclusión';
    case 'language':
      return 'entrada · forma · salida';
    case 'concept':
      return 'fenómeno · concepto · decisión';
    case 'timeline':
      return 'antecedente · proceso · consecuencia';
    case 'system-map':
      return 'sistema · componentes · entorno';
    case 'clinical-flow':
      return 'síntoma · evaluación · cuidado';
    case 'block-diagram':
      return 'entrada · proceso · salida';
    case 'sop-flow':
      return 'preparación · ejecución · verificación';
    case 'creative-cycle':
      return 'detonante · exploración · obra';
    case 'training-cycle':
      return isPhysicalTrainingProtocol(diagram)
        ? 'calentamiento · esfuerzo · recuperación'
        : 'diagnóstico · criterio · aplicación';
    case 'regulation-flow':
      return isEmotionalRegulationProtocol(diagram)
        ? 'emoción · interpretación · regulación'
        : 'situación · análisis · bienestar';
  }
}

export function stepLabelsForPack(pack: SacrintPack, contextText?: string): string[] {
  switch (pack.id) {
    case 'quimica':
      return ['EL FENÓMENO', 'LA REACCIÓN', 'EL BALANCE', 'EL IMPACTO'];
    case 'filosofia':
    case 'literatura':
      return ['LA PREGUNTA', 'LA TESIS', 'LA OBJECIÓN', 'LA CONCLUSIÓN'];
    case 'ingles':
      return ['EL CONTEXTO', 'LA FORMA', 'LA PRÁCTICA', 'LA PRODUCCIÓN'];
    case 'matematicas': {
      const needsTable =
        contextText &&
        /tabul|tabla\s+de\s+valores|muestra|frecuencia|inter[eé]s|capital|poblaci[oó]n/i.test(contextText) &&
        !/congruen|napole[oó]n|pit[aá]goras|suplementar|complementar|f[oó]rmula\s+general|factoriz/i.test(contextText);
      return contextText
        ? needsTable
          ? ['EL FENÓMENO', 'LA TABULACIÓN', 'EL MODELO', 'LA APLICACIÓN']
          : ['EL PLANTEAMIENTO', 'EL ANÁLISIS', 'EL MODELO', 'LA VERIFICACIÓN']
        : ['EL FENÓMENO', 'LA TABULACIÓN', 'EL MODELO', 'EL IMPACTO'];
    }
    case 'historia':
      return ['EL ANTECEDENTE', 'EL PROCESO', 'LA CONSECUENCIA', 'LA DECISIÓN'];
    case 'biologia':
      return ['EL ESTÍMULO', 'EL MECANISMO', 'LA RESPUESTA', 'LA ADAPTACIÓN'];
    case 'salud':
      return ['EL SÍNTOMA', 'LA EVALUACIÓN', 'EL DIAGNÓSTICO', 'EL CUIDADO'];
    case 'tecnologia':
      return ['LA ENTRADA', 'EL PROCESO', 'LA SALIDA', 'EL CONTROL'];
    case 'laboral':
      return ['LA PREPARACIÓN', 'LA EJECUCIÓN', 'LA VERIFICACIÓN', 'LA ENTREGA'];
    case 'artes':
      return ['EL DETONANTE', 'LA EXPLORACIÓN', 'LA OBRA', 'LA DIFUSIÓN'];
    case 'educacion_fisica':
      return ['EL CALENTAMIENTO', 'LA ACTIVACIÓN', 'EL ESFUERZO', 'LA RECUPERACIÓN'];
    case 'socioemocional':
      return ['LA EMOCIÓN', 'LA INTERPRETACIÓN', 'LA RESPUESTA', 'LA REGULACIÓN'];
    default:
      return ['EL FENÓMENO', 'EL CONCEPTO', 'LA PRÁCTICA', 'LA DECISIÓN'];
  }
}
