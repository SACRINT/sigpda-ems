import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import {
  GENERIC_FILLER_RE,
  hasDanglingEnding,
  isPublishablePedagogicalText,
  isTruncatedAgainstSource,
  NODE_TRUNCATION_RE,
} from '@/lib/editorial/fitter/dangling-guards';
import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import type {
  SacrintConceptSlide,
  SacrintDiagramSpec,
  SacrintPracticeSlide,
  SacrintSlide,
} from '../types';
import {
  GENERIC_CONCLUSION_RE,
  NUMERIC_ONLY_STEP_RE,
  TEMPLATE_PHRASE_RE,
} from '../text/grammar-normalization';
import {
  normalizeLearningObjective,
  validatePracticeActivity,
} from '../text/objective-and-activity-guards';
import { distillStepPreservingMath } from '../distiller/formula-and-steps';
import { OBJECTIVE_CENTER_VERB_RE } from './content-integrity';

function collectDiagramText(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    if (value.trim()) out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectDiagramText(item, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) collectDiagramText(item, out);
  }
}

function slideVisibleText(slide: SacrintSlide): string {
  const parts: string[] = [];
  const add = (value: string | undefined | null) => {
    if (value && value.trim()) parts.push(value.trim());
  };
  add(slide.title);
  add(slide.subtitle);
  if (slide.kind === 'concept') {
    const hasRenderedDiagram = Boolean(slide.diagram?.available);
    add(slide.explanation);
    if (!slide.isLessonGuide) {
      add(slide.analogy);
    }
    add(slide.misconception);
    // La fórmula / regla clave siempre se renderiza en la franja inferior del pizarrón 1/2,
    // incluso cuando hay diagrama, por lo que debe contarse en el presupuesto real de palabras.
    add(slide.formulas && slide.formulas.length > 0 ? slide.formulas[0] : slide.formula);
    if (!slide.isLessonGuide || !hasRenderedDiagram) {
      for (const item of slide.keyTakeaways ?? []) add(item);
    }
    if (slide.workedExample) {
      add(slide.workedExample.problemStatement);
      for (const step of slide.workedExample.steps.slice(0, 3)) add(step);
      add(slide.workedExample.interpretation);
    }
    if (!slide.isLessonGuide) {
      for (const variable of slide.variables ?? []) {
        add(variable.label);
        add(variable.meaning);
      }
    }
    if (hasRenderedDiagram) {
      const diagramText: string[] = [];
      collectDiagramText(slide.diagram, diagramText);
      for (const item of diagramText) add(item);
    }
  }
  if (slide.kind === 'practice') {
    const activities =
      slide.activities && slide.activities.length > 0
        ? slide.activities
        : slide.checkpoints.map((checkpoint, index) => ({
            label: `Actividad ${index + 1}`,
            statement: checkpoint,
            hint: '',
          }));
    const visibleActivities = slide.isLessonGuide ? activities.slice(0, 2) : activities;
    for (const activity of visibleActivities) {
      add(activity.label);
      add(activity.statement);
      add(activity.hint);
    }
    add(slide.applicationText || slide.practiceText);
    for (const item of (slide.objectiveBullets ?? []).slice(0, 2)) add(item);
    for (const item of (slide.evaluationCriteria ?? []).slice(0, 2)) add(item);
    if (!slide.isLessonGuide) {
      for (const item of slide.exitChecks ?? []) add(item);
    }
    add(slide.artifactName);
    add(slide.artifactStep);
  }
  return parts.join(' ');
}

export function countSlideWords(slide: SacrintSlide): number {
  const text = slideVisibleText(slide);
  const visibleWords = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const chromeWords =
    slide.kind === 'concept'
      ? slide.isLessonGuide
        ? slide.diagram?.available
          ? 64
          : 44
        : 44
      : slide.kind === 'practice'
        ? slide.isLessonGuide
          ? 64
          : 44
        : 0;
  return visibleWords + chromeWords;
}

export function compactConceptNarrative(value: string): string {
  return String(value || '')
    .replace(/\bObservamos que\b/gi, '')
    .replace(/\bpor lo que podemos sustituir directamente su valor\b/gi, 'y sustituimos')
    .replace(/\bde manera (?:exacta|precisa|rigurosa|detallada)\b/gi, '')
    .replace(/\bredactas en el registro de coevaluaci[oó]n que\b/gi, '')
    .replace(/\bdebido a un fallo en el signo del despeje\b/gi, 'por un fallo de signo')
    .replace(/\bAplica la ra[ií]z cuadrada en ambos miembros de la ecuaci[oó]n para despejar\b/gi, 'Despeja con la raíz cuadrada')
    .replace(/\bEl plano indica que\b/gi, '')
    .replace(/\bformado entre ellas en el v[eé]rtice superior es exactamente de\b/gi, 'entre ellas es de')
    .replace(/\bEn la comunidad de estudio se realiz[oó] un censo inicial que determin[oó] una poblaci[oó]n base de\b/gi, 'La población base es')
    .replace(/\belaborando la memoria de c[aá]lculo paso a paso y determinando\b/gi, 'y determina')
    .replace(/\bDurante el proceso de coevaluaci[oó]n de tu expediente t[eé]cnico,\s*tus compa[ñn]eros revisan[^,]+y detectan que\b/gi, 'En coevaluación se detecta que')
    .replace(/\bDebes aplicar la correcci[oó]n y documentar el registro de coevaluaci[oó]n\./gi, 'Corrige y documenta la coevaluación.')
    .replace(/\bSe desea dise[ñn]ar (una|un) ([^.]{5,80}) con forma rectangular\./gi, 'Diseña $1 $2 rectangular.')
    .replace(/\bDebes calcular anal[ií]ticamente ([^.]{4,70}) y validar gr[aá]ficamente el resultado para integrarlo en tu [^.]+\./gi, 'Calcula $1 y valida el resultado gráficamente.')
    .replace(/\bResuelve la ecuaci[oó]n algebraica:\s*Agrupa los t[eé]rminos con ([a-z]) en un miembro y los t[eé]rminos independientes(?:\s+en\s+el\s+otro)?:\s*/gi, 'Agrupa $1 y constantes: ')
    .replace(/\bIdentificar los coeficientes de la ecuaci[oó]n en su forma general ([^:]+):\s*/gi, 'Identifica los coeficientes ($1): ')
    .replace(/\butilizando el Teorema de Pit[aá]goras,\s*donde la hipotenusa es ([^,]{2,20}) y el cateto base es la mitad del lado \(([^)]+)\)\./gi, 'por Pitágoras (hipotenusa $1, cateto $2):')
    .replace(/\bdebido al paralelismo de los soportes met[aá]licos,?\s*/gi, 'por paralelismo, ')
    .replace(/\ben el marco del Pensamiento Matem[aá]tico\b/gi, 'en Pensamiento Matemático')
    .replace(/\bSi se ha determinado algebraicamente que uno de los [aá]ngulos internos mide\b/gi, 'Si un ángulo interno mide')
    .replace(/\by su [aá]ngulo alterno interno correspondiente mide\b/gi, 'y su alterno interno mide')
    .replace(/\bcalcula el valor exacto de la inc[oó]gnita ([a-z]),\s*determina la medida num[eé]rica de esos [aá]ngulos para validar el plano estructural/gi, 'calcula $1 y la medida de ambos ángulos')
    .replace(/\basegurando el uso correcto de dos cifras decimales en todas las operaciones intermedias\b/gi, 'con dos decimales')
    .replace(/\badem[aá]s de un error menor de redondeo en el c[aá]lculo de\b/gi, 'y un error de redondeo en')
    .replace(/(\$[\d.,]+)\s+pesos\b/gi, '$1')
    .replace(/(?<![=+\-*/×÷^]\s*)\s*\([^)\d=×·÷+\-*/²³√^]{14,90}\)(?!\s*[/÷×·^])/g, '')
    .replace(/\bde dichos\b/gi, 'de esos')
    .replace(/\bde el\b/gi, 'del')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
}

export function compactProblemPreamble(value: string): string {
  return compactConceptNarrative(
    String(value || '')
      .replace(
        /\bDurante\s+[^,]{5,140},\s*(?:analizas|revisas|estudias)\s+el\s+procedimiento\s+(?:empleado\s+)?para\s+resolver\b/gi,
        'Resuelve'
      )
      .replace(
        /^Si el presupuesto (?:total )?disponible(?: para esta [a-záéíóúñ]+)? es de (\$[\d.,]+)(?:\s+pesos)?,\s+/i,
        'Con presupuesto de $1, '
      )
  );
}

export function compactEvaluationCriterion(value: string): string {
  const cleaned = String(value || '')
    .replace(/^¿(?:Puedo|Soy capaz de|Fui capaz de|Logr[eé])\s+/i, '')
    .replace(/\?$/, '.')
    .replace(/\bcon mis propias palabras\b/gi, '')
    .replace(/\bcon claridad\b/gi, '')
    .replace(/\bcon orden y rigor\b/gi, '')
    .replace(/\brigor met[oó]dico y orden al\b/gi, 'orden al')
    .replace(/\btodos los elementos requeridos en mi\b/gi, 'los elementos de mi')
    .replace(/\ben qu[eé] se diferencia de\b/gi, 'cómo se diferencia de')
    .replace(/\by en qu[eé] se diferencia\b/gi, 'y cómo se diferencia')
    .replace(/\bexact[oa]s?\b/gi, '')
    .replace(/\bpara verificar la precisi[oó]n de mis (?:c[aá]lculos|resultados)[^,.?]*/gi, 'para verificar mis resultados')
    .replace(/\bde mi compa[ñn]er[oa]\b/gi, 'de un par')
    .replace(/\ben mi (?:modelo|proyecto|reporte)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;?])/g, '$1')
    .trim();
  return cleaned
    .replace(/^¿([a-záéíóúñ])/, (_, letter: string) => `¿${letter.toUpperCase()}`)
    .replace(/^([a-záéíóúñ])/, (_, letter: string) => letter.toUpperCase());
}

export function compactHintText(value: string | undefined): string | undefined {
  if (!value) return value;
  const cleaned = String(value)
    .replace(
      /^(?:Recuerda|Ten en cuenta|Considera|Observa|Nota)\s+que\s+(?:para\s+[^,]{3,40},?\s*)?(?:debes|puedes|tienes que|hay que|se debe)\s+/i,
      ''
    )
    .replace(
      /^(?:Recuerda|Ten en cuenta|Considera|Observa|Nota)\s+que,\s*(?:por\s+definici[oó]n|en\s+general|en\s+todo\s+caso),\s*/i,
      ''
    )
    .replace(/^(?:Recuerda|Ten en cuenta|Considera)\s+que\s+/i, '')
    .replace(/,?\s*o\s+plantea\s+que\s+[^,]{15,85},\s*es\s+decir,\s*/gi, ' o plantea ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!cleaned || cleaned.length < 24 || /^(?:para|por|con|de|en|a)\b/i.test(cleaned)) {
    return value;
  }
  return cleaned.replace(/^([a-záéíóúñ])/, (_, ch: string) => ch.toUpperCase());
}

export function compactActivityStatement(statement: string): string {
  const original = String(statement || '').trim();
  if (!original) return original;
  const compacted = original
    .replace(
      /^(?:Para|Con el fin de|Con la finalidad de|Con el prop[oó]sito de)\s+(?:la\s+|el\s+|los\s+|las\s+)?(?:acondicionar|adecuar|equipar|organizar|promover|prevenir|mejorar|remodelar|rehabilitar|construir|dise[ñn]ar|impulsar|fortalecer|apoyar|celebrar|ambientar|adornar|fondear|financiar|implementar|evaluar)\b[^,.\d$]{4,95}\s+(?:se\s+cuenta\s+con|se\s+dispone\s+de)\s+(?:un\s+)?(?:presupuesto|fondo)(?:\s+(?:total|exacto|disponible))?\s+de\s+(\$[\d.,]+)\.\s+([A-ZÁÉÍÓÚÑ])/i,
      (_m, amount: string, nextCh: string) => `Con fondo de ${amount}, ${nextCh.toLowerCase()}`
    )
    .replace(
      /^(?:Para|Con el fin de|Con la finalidad de|Con el prop[oó]sito de)\s+(?:la\s+|el\s+|los\s+|las\s+)?(?:acondicionar|adecuar|organizar|promover|prevenir|mejorar|remodelar|rehabilitar|construir|dise[ñn]ar|impulsar|fortalecer|apoyar|celebrar|ambientar|adornar|fondear|financiar|implementar|evaluar)\b[^,]{0,110},\s*/i,
      ''
    )
    .replace(/^En\s+(?:una|un|el|la)\s+[^,]{8,95},\s*(?=[A-ZÁÉÍÓÚÑa-záéíóúñ])/i, '')
    .replace(/\s+destinad[oa]s?\s+a\s+[^,.]{3,65}(?=[,.]|$)/gi, '')
    .replace(/\bcon el (?:fin|prop[oó]sito|objetivo) de\s+[^,.]{3,65}(?=[,.]|$)/gi, '')
    .replace(/\bpara modelar (?:la situaci[oó]n|este escenario|el caso|el fenómeno)\b/gi, 'para modelar')
    .replace(/\bcon tu calculadora cient[ií]fica\b/gi, 'con calculadora')
    .replace(/\bredacta tus observaciones t[eé]cnicas\b/gi, 'redacta tus observaciones')
    .replace(/\bredacta las conclusiones t[eé]cnicas de viabilidad\b/gi, 'concluye su viabilidad')
    .replace(/\by redacta una breve interpretaci[oó]n de(?:l)?\b/gi, 'e interpreta')
    .replace(/\bdetermina si la soluci[oó]n final es [a-záéíóúñ]+mente correcta\b/gi, 'determina si la solución es correcta')
    .replace(/\bverifica tu resultado mediante sustituci[oó]n\b/gi, 'verifica por sustitución')
    .replace(
      /^Realiza la revisi[oó]n cruzada del siguiente procedimiento desarrollado por un[a]? compa[ñn]er[oa] para resolver\b/i,
      'Revisa el procedimiento para resolver'
    )
    .replace(/\bEn su reporte,\s*(?:el|la) compa[ñn]er[oa] afirma que al agrupar [^,]+ obtuvo\b/gi, 'El reporte indica que obtuvo')
    .replace(/\blo que resulta en\b/gi, 'y obtiene')
    .replace(/\butilizando las propiedades de\b/gi, 'con las propiedades de')
    .replace(
      /\bAudita el reporte t[eé]cnico de un[a]? compa[ñn]er[oa] que modela [^.]*? mediante\b/gi,
      'Audita el reporte modelado mediante'
    )
    .replace(/\b(?:El|La) compa[ñn]er[oa] indica que\b/gi, 'Se indica que')
    .replace(
      /\bVerifica si el procedimiento cumple con el rigor [a-záéíóúñ]+ y redacta tu retroalimentaci[oó]n en la bit[aá]cora\./gi,
      'Verifica el procedimiento y redacta tu retroalimentación.'
    )
    .replace(/\bElabora la tabla de progresi[oó]n [a-záéíóúñ]+ para validar los datos en tu [^.]+\./gi, 'Tabula la progresión para validar los datos.')
    .replace(/\b(?:Construye|Utiliza) una matriz de comprobaci[oó]n evaluando (?:valores de )?/gi, 'Evalúa ')
    .replace(/\bpara verificar en qu[eé] momento exacto los costos se cruzan y cu[aá]l opci[oó]n conviene para un evento de\b/gi, 'para determinar cuándo se igualan costos y qué conviene para')
    .replace(/\bpara determinar el punto de equilibrio y verificar los costos\b/gi, 'para hallar el equilibrio y verificar costos')
    .replace(/\bcobra un dep[oó]sito fijo de\b/gi, 'cobra fijo')
    .replace(/\by una renta de\b/gi, 'más')
    .replace(
      /\b(Determina|Calcula)\s+el\s+([^.]{3,35})\s+que\s+(?:tu equipo|el grupo|la comunidad|el comit[eé])[^.]{0,30}?(?:deber[aá]|tendr[aá] que|puede)\s+([a-záéíóúñ]+r)\b/gi,
      '$1 el $2 a $3'
    )
    .replace(/(\$[\d.,]+)\s+pesos\b/gi, '$1')
    .replace(/\s*\([^)\d=]{14,90}\)/g, '')
    .replace(/\bElabora un guion de exposici[oó]n que incluya\b/gi, 'Elabora un guion con')
    .replace(/\bExplica ante el grupo por qu[eé]\b/gi, 'Explica por qué')
    .replace(/\bpara su centro comunitario\b/gi, '')
    .replace(/\bpara cubrir ambos conceptos\b/gi, '')
    .replace(/\butilizando el principio de la balanza algebraica\b/gi, 'con la balanza algebraica')
    .replace(/\bSi las proyecciones socioecon[oó]micas indican que la poblaci[oó]n crecer[aá] a una tasa anual constante del\b/gi, 'Con crecimiento anual del')
    .replace(/\bdebido a la llegada de nuevas familias,?\s*/gi, '')
    .replace(/\butilizando el modelo exponencial\b/gi, 'con')
    .replace(/\be interpreta(?: el)? impacto en los servicios p[uú]blicos\b/gi, 'e interpreta el impacto')
    .replace(/\bSi se implementa un programa comunitario de retenci[oó]n escolar y bienestar,\s*se espera que la tasa de crecimiento poblacional moderado se mantenga en\b/gi, 'Con tasa moderada del')
    .replace(/\bdurante los pr[oó]ximos\b/gi, 'en')
    .replace(/\bal t[eé]rmino de este periodo\b/gi, 'al cierre')
    .replace(/,\s*construye una tabla de valores(?:\s+rigurosa)?(?:\s+asignando\s+a|\s+para)\s+/gi, ', tabula para ')
    .replace(/\btomando los valores\b/gi, 'con')
    .replace(/\bdetermina los cinco pares ordenados resultantes y redacta una conclusi[oó]n sobre el comportamiento financiero\b/gi, 'determina los cinco pares y concluye')
    .replace(/\bque se pueden realizar con un fondo fijo cumplen la ecuaci[oó]n lineal\b/gi, 'cumplen')
    .replace(/\bmodela el costo de mantenimiento de un espacio deportivo recreativo mediante la ecuaci[oó]n lineal con dos inc[oó]gnitas\b/gi, 'modela el mantenimiento con')
    .replace(/\bestablece que el costo semanal de operaci[oó]n \(([^)]+)\) de un taller de artes pl[aá]sticas depende de una tarifa fija de servicios de\b/gi, 'modela el costo semanal ($1) con tarifa fija de')
    .replace(/\bSi las pol[ií]ticas de desarrollo comunitario y la implementaci[oó]n de programas de bienestar generan una tasa de crecimiento anual estimada de\b/gi, 'Con tasa de crecimiento anual')
    .replace(/\bUna localidad rural del estado de Puebla registra actualmente una poblaci[oó]n juvenil base de\b/gi, 'Una localidad registra población base')
    .replace(/\bSe aplica un modelo de crecimiento demogr[aá]fico discreto\b/gi, 'Con el modelo')
    .replace(/\bcon una tasa de crecimiento anual\b/gi, 'y tasa anual')
    .replace(/\by elabora la gr[aá]fica en papel milim[eé]trico\b/gi, 'y grafícalo')
    .replace(/\bConstruye la tabla de valores a[ñn]o por a[ñn]o desde\b/gi, 'Tabula de')
    .replace(/\bUn centro comunitario juvenil en Puebla\b/gi, 'Un centro comunitario')
    .replace(/\bUn comit[eé] vecinal en Puebla\b/gi, 'Un comité vecinal')
    .replace(/\bUn comit[eé] pro-construcci[oó]n de un parque recreativo en Puebla solicita\b/gi, 'Un comité solicita')
    .replace(/\ba una instituci[oó]n de desarrollo social con una tasa de inter[eé]s simple del\b/gi, 'a interés simple del')
    .replace(/\bSi el pr[eé]stamo se liquidar[aá] en un plazo de\b/gi, 'A un plazo de')
    .replace(/\bcalcula el inter[eé]s total generado y el monto acumulado\b/gi, 'calcula el interés y monto acumulado')
    .replace(/\by plasma el procedimiento algebraico completo en tu dossier\b/gi, 'y registra el procedimiento')
    .replace(/\by valida los datos para incorporarlos en la secci[oó]n anal[ií]tica de tu portafolio\b/gi, 'y valida los datos')
    .replace(/\bubicados en uno de los v[eé]rtices principales de la techumbre est[aá]n representados algebraicamente por las expresiones\b/gi, 'se expresan como')
    .replace(/\bsabiendo por definici[oó]n geom[eé]trica que los [aá]ngulos colaterales internos entre paralelas son suplementarios \(su suma = 180°\)/gi, '(colaterales internos: suman 180°)')
    .replace(/\bTeniendo en cuenta que por definici[oó]n dos [aá]ngulos complementarios suman\b/gi, 'Como los complementarios suman')
    .replace(/\bcalcula el valor num[eé]rico de la inc[oó]gnita ([a-z]), determina la medida (?:exacta|angular exacta) de cada (?:[aá]ngulo|componente)\b/gi, 'calcula $1 y cada ángulo')
    .replace(/\bcalcula el valor de ([a-z]), determina la medida angular exacta de cada componente\b/gi, 'calcula $1 y cada ángulo')
    .replace(/\bpara organizar un torneo rel[aá]mpago seg[uú]n la expresi[oó]n\b/gi, 'de un torneo con')
    .replace(/\ben funci[oó]n de las horas de asesor[ií]a 'x' impartidas est[aá] modelado por la ecuaci[oó]n\b/gi, "según horas de asesoría 'x' sigue")
    .replace(/,\s*donde\s+'x'\s+representa\s+el\s+n[uú]mero\s+de\s+equipos\s+inscritos/gi, ' (x = equipos)')
    .replace(/\bSe calcula que el costo total \(y\) de premiaci[oó]n y arbitraje est[aá] dado por\b/gi, 'El costo (y) de premiación y arbitraje es')
    .replace(/\by elabora la tabulaci[oó]n para\b/gi, 'y tabula para')
    .replace(/\bdonde el n[uú]mero de j[oó]venes asistentes \(y\) a un taller de arte depende de la inversi[oó]n en publicidad \(x\) en cientos de pesos,\s*dado por\b/gi, 'de asistentes (y) según inversión en publicidad (x, en cientos de pesos):')
    .replace(/\ben una escala del 1 al 100,\s*definido por\b/gi, '(escala 1 a 100):')
    .replace(/\bsu representaci[oó]n gr[aá]fica y una breve conclusi[oó]n metacognitiva\b/gi, 'su gráfica y conclusión')
    .replace(/\ben el contexto del espacio recreativo\b/gi, 'en contexto')
    .replace(/\ben el contexto de la asistencia inicial\b/gi, 'en contexto')
    .replace(/\ben el contexto de la jornada\b/gi, 'en contexto')
    .replace(/\bpara determinar el costo unitario de cada tipo de bal[oó]n,\s*y elabora la matriz de comprobaci[oó]n num[eé]rica que valide tus resultados algebraicos\b/gi, 'para hallar el costo de cada balón y comprobarlo')
    .replace(/\bde dichos\b/gi, 'de esos')
    .replace(/\bcorrespondiente\s+a\b/gi, 'de')
    .replace(/\b(?:paso a paso|exactamente|posteriormente|rigurosamente)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim();
  const normalizedStart =
    /^[a-záéíóúñ]/.test(compacted) && /^[A-ZÁÉÍÓÚÑ]/.test(original)
      ? compacted.charAt(0).toUpperCase() + compacted.slice(1)
      : compacted;
  const digits = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const originalDigits = digits(original).sort().join('|');
  const compactedDigits = digits(normalizedStart).sort().join('|');
  if (!normalizedStart || originalDigits !== compactedDigits) return original;
  return normalizedStart;
}

export function hasActivityTask(value: string): boolean {
  return validatePracticeActivity(value, '', { strict: false }).valid;
}

const SPANISH_PREDICATE_VERB_RE =
  /\b(?:es|son|fue|fueron|est[aá]n?|constituye[ns]?|permite[ns]?|posibilita[ns]?|consiste[ns]?|facilita[ns]?|modela[ns]?|representa[ns]?|transforma[ns]?|integra[ns]?|garantiza[ns]?|asegura[ns]?|utiliza[ns]?|emplea[ns]?|requiere[ns]?|exige[ns]?|describe[ns]?|detalla[ns]?|calcula[ns]?|mide[ns]?|demuestra[ns]?|relaciona[ns]?|vincula[ns]?|organiza[ns]?|ordena[ns]?|resuelve[ns]?|soluciona[ns]?|simplifica[ns]?|elimina[ns]?|despeja[ns]?|contrasta[ns]?|traduce[ns]?|proyecta[ns]?|consolida[ns]?|comunica[ns]?|muestra[ns]?|expone[ns]?|expresa[ns]?|determina[ns]?|establece[ns]?|fija[ns]?|identifica[ns]?|reconoce[ns]?|explica[ns]?|analiza[ns]?|examina[ns]?|eval[úu]a[ns]?|valora[ns]?|valida[ns]?|compara[ns]?|ayuda[ns]?|sirve[ns]?|ofrece[ns]?|presenta[ns]?|aplica[ns]?|estudia[ns]?|define[ns]?|verifica[ns]?|comprueba[ns]?|controla[ns]?|regula[ns]?|previene[ns]?|protege[ns]?|optimiza[ns]?|mejora[ns]?|produce[ns]?|genera[ns]?|opera[ns]?|funciona[ns]?|distribuye[ns]?|conecta[ns]?|soporta[ns]?|sostiene[ns]?|transmite[ns]?|convierte[ns]?|sustituye[ns]?|construye[ns]?|elabora[ns]?|prepara[ns]?|dise[ñn]a[ns]?|logra[ns]?|obtiene[ns]?|sustenta[ns]?|fundamenta[ns]?|se[ñn]ala[ns]?|contiene[ns]?|incluye[ns]?|abarca[ns]?|comprende[ns]?|implica[ns]?|involucra[ns]?|depende[ns]?|var[ií]a[ns]?|cambia[ns]?|aumenta[ns]?|disminuye[ns]?|crece[ns]?|reduce[ns]?|forma[ns]?|crea[ns]?|mantiene[ns]?|evita[ns]?|causa[ns]?|provoca[ns]?|busca[ns]?|tiende[ns]?|corresponde[ns]?|equilibra[ns]?|divide[ns]?|multiplica[ns]?|suma[ns]?|resta[ns]?|deriva[ns]?|re[uú]ne[ns]?|agrupa[ns]?|clasifica[ns]?|registra[ns]?|anota[ns]?|documenta[ns]?|instala[ns]?|configura[ns]?|actualiza[ns]?|repara[ns]?|limpia[ns]?|inspecciona[ns]?|acota[ns]?|traza[ns]?|dibuja[ns]?|interpreta[ns]?|argumenta[ns]?|concluye[ns]?|narra[ns]?|relata[ns]?|refleja[ns]?|promueve[ns]?|fomenta[ns]?|impulsa[ns]?|fortalece[ns]?|contribuye[ns]?|participa[ns]?|ejerce[ns]?|tutela[ns]?|vigila[ns]?|sanciona[ns]?|respeta[ns]?|cumple[ns]?|tiene[ns]?|posee[ns]?|cuenta[ns]?|usa[ns]?|toma[ns]?|hace[ns]?|lleva[ns]?|pasa[ns]?|sigue[ns]?|surge[ns]?|ocurre[ns]?|sucede[ns]?|existe[ns]?|se\s+[a-záéíóúñ]{3,})\b/i;

export function hasSpanishPredicateVerb(value: string): boolean {
  return SPANISH_PREDICATE_VERB_RE.test(value);
}

function capitalizeProseStart(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (/^[a-z](?:[0-9₀-₉²³]|\([^)]+\))?\s*(?:[=<>≤≥≠≈+\-*/·×^]|²|³)/.test(trimmed)) return trimmed;
  return /^[a-záéíóúñ]/.test(trimmed) ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
}

export function hasIncompleteConditionalEnding(value: string): boolean {
  const sentences = value
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return false;
  const last = sentences[sentences.length - 1]!;
  if (!/^Si\s+/i.test(last)) return false;
  const outsideParens = last.replace(/\([^)]*\)/g, '');
  if (!/[,?]/.test(outsideParens)) return true;
  return !hasActivityTask(last);
}

export function ensureActivityClosure(statement: string): string {
  const cleaned = capitalizeProseStart(
    String(statement || '')
      .replace(/^[:;.\-–—\s]+/, '')
      .replace(/\.,/g, ',')
      .replace(/,\./g, '.')
      .replace(/(\?\s+[^¿?]{6,140})\?$/g, '$1.')
      .replace(/\b([a-z]),\s*([a-z])\s*\.(?=\s|$)/gi, '$1 y $2.')
      .replace(/(?<=[.?!]\s+)([a-záéíóúñ])/g, (_, ch: string) => ch.toUpperCase())
      .trim()
  );
  if (!cleaned) return '';
  return /[.?!]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

const HEADLESS_ANAPHORIC_START_RE =
  /^(?:Para\s+[a-záéíóúñ]+(?:lo|la|los|las)\b|Esto\b|Esta\b|Este\b|Estos\b|Estas\b|Ello\b|Por\s+ello\b|Por\s+lo\s+tanto\b|En\s+consecuencia\b|Sin\s+embargo\b|Adem[aá]s\b|Asimismo\b|De\s+este\s+modo\b|De\s+esta\s+manera\b)/i;

export function isHeadlessAnaphoricStart(value: string | undefined): boolean {
  return Boolean(value && HEADLESS_ANAPHORIC_START_RE.test(value.trim()));
}

function requiresStrictNumericPreservation(reference: string): boolean {
  return (
    /=/.test(reference) ||
    /\b(?:opci[oó]n\s*[ab]|proveedor|tarifa|compara|cu[aá]l\s+(?:opci[oó]n\s+)?conviene|frente\s+a|audita|revisa|compa[ñn]er[oa]|procedimiento|reporte|obtuvo|afirma)\b/i.test(
      reference
    )
  );
}

export function compactActivityPreservingTaskAndData(
  rawStatement: string,
  maxChars: number,
  maxWords: number,
  allowPartialNumbers = false,
  sourceStatement = rawStatement
): string {
  const originalSource = ensureActivityClosure(sourceStatement);
  const base = ensureActivityClosure(compactActivityStatement(rawStatement));
  if (!base) return originalSource;
  const mathTokens = (text: string): string[] =>
    (text.match(/\d+(?:[.,]\d+)?|=/g) ?? []).map((t) => t.replace(/,/g, ''));
  const isValidActivity = (candidate: string, reference: string): boolean => {
    const c = candidate.trim();
    const minLen = Math.min(55, reference.trim().length);
    if (c.length < minLen) return false;
    if (/^[a-záéíóúñ]/.test(c)) return false;
    if (!hasActivityTask(c) || hasIncompleteConditionalEnding(c) || hasDanglingEnding(c)) return false;
    if (!isPublishablePedagogicalText(c, 'activity', originalSource)) return false;
    if (isTruncatedAgainstSource(c, originalSource)) return false;
    if (/\.,|,\.|;\.|\.\s*\./.test(c) || /,\s*[a-zA-ZÁÉÍÓÚáéíóúñÑ]\.$/.test(c)) return false;
    if (/=/.test(reference) && !/=/.test(c)) return false;
    const uniqueRef = new Set(mathTokens(reference));
    if (uniqueRef.size > 0) {
      const candSet = new Set(mathTokens(c));
      const strictNumbers = !allowPartialNumbers || requiresStrictNumericPreservation(reference) || uniqueRef.size <= 2;
      if (strictNumbers) {
        for (const tok of uniqueRef) {
          if (!candSet.has(tok)) return false;
        }
      } else if (candSet.size < Math.min(2, uniqueRef.size)) {
        return false;
      }
    }
    return true;
  };

  const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;
  if (base.length <= maxChars && wordCount(base) <= maxWords && isValidActivity(base, base)) {
    return base;
  }

  const directFit = fitPedagogicalText(base, { maxChars, maxWords, role: 'activity' });
  if (
    directFit &&
    directFit.length <= maxChars &&
    wordCount(directFit) <= maxWords &&
    isValidActivity(directFit, base)
  ) {
    return directFit;
  }

  const sentences = splitSpanishSentences(base);
  if (sentences.length > 1) {
    // Descartar oraciones administrativas finales ("Registra en tu bitácora...", "Muestra tus pasos...")
    // solo si las oraciones previas conservan TODOS los datos numéricos/ecuaciones y una consigna válida.
    const ADMIN_TAIL_RE =
      /^(?:Registra|Anota|Documenta|Muestra|Comparte|Presenta|Aseg[uú]rate|Verifica|Comprueba|Justifica|Reflexiona|Integra|Incorpora)\b[^?]{0,140}(?:bit[aá]cora|cuaderno|libreta|portafolio|pasos|claridad|profesional|tu\s+elecci[oó]n|procedimientos?|desarrollo|grupo|equipo|conclusi[oó]n|t[eé]cnica)\.?$/i;
    const withoutAdminTails = [...sentences];
    while (
      withoutAdminTails.length > 1 &&
      ADMIN_TAIL_RE.test(withoutAdminTails[withoutAdminTails.length - 1]!) &&
      mathTokens(withoutAdminTails[withoutAdminTails.length - 1]!).length === 0
    ) {
      withoutAdminTails.pop();
    }
    if (withoutAdminTails.length < sentences.length) {
      const cleanedNoAdmin = withoutAdminTails.join(' ').trim();
      if (isValidActivity(cleanedNoAdmin, base)) {
        if (cleanedNoAdmin.length <= maxChars && wordCount(cleanedNoAdmin) <= maxWords) {
          return cleanedNoAdmin;
        }
      }
    }

    let taskIdx = -1;
    for (let i = sentences.length - 1; i >= 0; i--) {
      if (hasActivityTask(sentences[i]!)) {
        taskIdx = i;
        break;
      }
    }
    if (taskIdx === -1) taskIdx = sentences.length - 1;

    const dataOnly = sentences.filter((s) => mathTokens(s).length > 0);
    const dataOnlyJoined = dataOnly.join(' ').trim();
    if (
      dataOnly.length > 0 &&
      dataOnly.length < sentences.length &&
      hasActivityTask(dataOnlyJoined) &&
      dataOnlyJoined.length < base.length - 12 &&
      isValidActivity(dataOnlyJoined, base)
    ) {
      if (dataOnlyJoined.length <= maxChars && wordCount(dataOnlyJoined) <= maxWords) {
        return dataOnlyJoined;
      }
      const fittedDataOnly = fitPedagogicalText(dataOnlyJoined, {
        maxChars,
        maxWords,
        role: 'activity',
      });
      if (
        fittedDataOnly &&
        fittedDataOnly.length <= maxChars &&
        wordCount(fittedDataOnly) <= maxWords &&
        isValidActivity(fittedDataOnly, base)
      ) {
        return fittedDataOnly;
      }
      return dataOnlyJoined;
    }

    if (sentences.length >= 3) {
      const withoutTrailing = sentences.slice(0, -1).join(' ').trim();
      if (
        withoutTrailing.length < base.length - 12 &&
        isValidActivity(withoutTrailing, base)
      ) {
        if (withoutTrailing.length <= maxChars && wordCount(withoutTrailing) <= maxWords) {
          return withoutTrailing;
        }
        const fittedWithoutTrailing = fitPedagogicalText(withoutTrailing, {
          maxChars,
          maxWords,
          role: 'activity',
        });
        if (
          fittedWithoutTrailing &&
          fittedWithoutTrailing.length <= maxChars &&
          wordCount(fittedWithoutTrailing) <= maxWords &&
          isValidActivity(fittedWithoutTrailing, base)
        ) {
          return fittedWithoutTrailing;
        }
        return withoutTrailing;
      }
    }

    const essential = sentences.filter((s, idx) => mathTokens(s).length > 0 || idx === taskIdx);
    const essentialJoined = essential.join(' ').trim();
    if (essentialJoined && isValidActivity(essentialJoined, base)) {
      if (essentialJoined.length <= maxChars && wordCount(essentialJoined) <= maxWords) {
        return essentialJoined;
      }
      const fittedEssential = fitPedagogicalText(essentialJoined, {
        maxChars,
        maxWords,
        role: 'activity',
      });
      if (fittedEssential && isValidActivity(fittedEssential, base)) {
        return fittedEssential;
      }
    }

    const taskSentence = sentences[taskIdx]!;
    const taskNormPrefix = taskSentence.toLowerCase().slice(0, 32);
    const dataSentences = sentences.filter(
      (s, idx) =>
        idx !== taskIdx &&
        mathTokens(s).length > 0 &&
        !taskSentence.toLowerCase().includes(s.toLowerCase().slice(0, Math.min(32, s.length))) &&
        !s.toLowerCase().startsWith(taskNormPrefix)
    );
    if (dataSentences.length > 0) {
      const dataPart = dataSentences
        .map((s) =>
          capitalizeProseStart(
            s
              .replace(/^(?:En|Para|Durante|Tras|Al|Con|Seg[uú]n)\b[^,:\d=()]{8,80},\s+(?=[A-ZÁÉÍÓÚÑa-záéíóúñ\d])/u, '')
              .trim()
          )
        )
        .join(' ')
        .replace(/[.!?]+$/, '')
        .trim();
      const rawShortTask =
        fitPedagogicalText(taskSentence, {
          maxChars: Math.max(48, maxChars - dataPart.length - 2),
          maxWords: Math.max(8, maxWords - wordCount(dataPart)),
          role: 'activity',
        }) || taskSentence;
      const shortTask =
        hasIncompleteConditionalEnding(rawShortTask) || !hasActivityTask(rawShortTask)
          ? compactActivityStatement(taskSentence)
          : rawShortTask;
      const combined = ensureActivityClosure(`${dataPart}. ${shortTask}`.replace(/\s{2,}/g, ' ').trim());
      if (isValidActivity(combined, base)) {
        if (combined.length <= maxChars && wordCount(combined) <= maxWords) {
          return combined;
        }
        const shortData =
          fitPedagogicalText(dataPart, {
            maxChars: Math.max(65, maxChars - shortTask.length - 2),
            maxWords: Math.max(11, maxWords - wordCount(shortTask)),
            role: 'problem',
          }) || dataPart;
        const tighterCombined = ensureActivityClosure(
          `${capitalizeProseStart(shortData).replace(/[.!?]+$/, '')}. ${shortTask}`
            .replace(/\s{2,}/g, ' ')
            .trim()
        );
        if (isValidActivity(tighterCombined, base)) {
          return tighterCombined;
        }
        return combined;
      }
    }
  }

  return base.replace(/(\?\s+[^¿?]{6,140})\?$/g, '$1.');
}

export function isValidEvaluationCriterionItem(value: string | undefined): value is string {
  if (!value) return false;
  const clean = value.trim();
  if (clean.length < 22) return false;
  if (clean.split(/\s+/).filter(Boolean).length < 3) return false;
  if (hasDanglingEnding(clean)) return false;
  return true;
}

export function enforceLessonGuideSlideBudget(slide: SacrintSlide): SacrintSlide {
  const fitShort = (
    value: string | undefined,
    maxChars: number,
    maxWords: number,
    role: 'concept' | 'problem' | 'step' | 'conclusion' | 'activity' | 'application' | 'hint' | 'general',
    minChars = 18
  ): string | undefined => {
    if (!value) return value;
    const fitted = fitPedagogicalText(value, { maxChars, maxWords, role });
    const pubRole = role === 'general' ? 'concept' : role;
    if (
      !fitted ||
      fitted.trim().length < Math.min(minChars, value.trim().length) ||
      hasDanglingEnding(fitted) ||
      !isPublishablePedagogicalText(fitted, pubRole, value)
    ) {
      return value;
    }
    return fitted;
  };
  const compactMathStep = (step: string, maxChars: number, maxWords: number): string => {
    if (/[=+\-*/^]|\d/.test(step)) return step;
    const distilled = distillStepPreservingMath(step, maxChars, maxWords);
    return distilled && distilled.trim().length >= 12 && !hasDanglingEnding(distilled) ? distilled : step;
  };

  if (slide.kind === 'concept') {
    const cs = slide as SacrintConceptSlide;
    const problemCapChars = cs.diagram?.available ? 215 : 250;
    const problemCapWords = cs.diagram?.available ? 34 : 40;
    const rawProblem = cs.workedExample?.problemStatement || '';
    const fitProblemForBox = (raw: string): string => {
      if (!raw || raw.length <= problemCapChars) return raw;
      // Eliminar oraciones puramente narrativas sin datos numéricos ni ecuación cuando el planteamiento rebasa la caja
      const rawSentences = raw
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const dataOrTaskSentences =
        rawSentences.length > 1
          ? rawSentences.filter((s) => /\d|=|\$|%|\?|\b(?:calcula|determina|encuentra|resuelve|construye|tabula|plantea|utiliza|compara)\b/i.test(s))
          : rawSentences;
      const cleanedBase = (dataOrTaskSentences.length > 0 ? dataOrTaskSentences.join(' ') : raw)
        .replace(/,\s*donde\s+['"]?[a-z]['"]?\s+(?:es|representa)\s+[^.;]+?(?=[.;]|$)/gi, '')
        .replace(/\butilizando tu regla graduada y un sistema de coordenadas\b/gi, '')
        .replace(/\by presentar el argumento cuantitativo correspondiente\b/gi, '')
        .replace(/\by construir una matriz de comprobaci[oó]n para verificar el resultado(?:\s+en un rango de [^.]+)?\b/gi, '')
        .replace(/\bPreparas la defensa de tu proyecto ante el comit[eé] evaluador y necesitas argumentar\b/gi, 'Se estima')
        .replace(/\bTras analizar las tendencias demogr[aá]ficas locales,\s*se estima una tasa de crecimiento anual constante del\b/gi, 'Con tasa anual constante')
        .replace(/\bEl presupuesto operativo establece que el costo total en miles de pesos se modela exactamente mediante la ecuaci[oó]n lineal con dos inc[oó]gnitas:\s*/gi, 'Costo operativo (miles de pesos): ')
        .replace(/\bEl costo total 'y' \(en pesos\) para adecuar un espacio recreativo juvenil y comprar 'x' paquetes de material deportivo est[aá] modelado por la ecuaci[oó]n lineal\b/gi, 'El costo total y de x paquetes sigue')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.;])/g, '$1')
        .trim();
      const pre = compactProblemPreamble(cleanedBase);
      if (pre.length <= problemCapChars && !hasDanglingEnding(pre)) return pre;
      const fitted = fitPedagogicalText(pre, {
        maxChars: problemCapChars,
        maxWords: problemCapWords,
        role: 'problem',
      });
      const eqPreserved = !/=/.test(pre) || /=/.test(fitted);
      if (fitted && fitted.length >= 42 && !hasDanglingEnding(fitted) && eqPreserved) {
        return fitted;
      }
      return pre;
    };
    return {
      ...cs,
      explanation: fitShort(cs.explanation, 235, 38, 'concept', 55) || cs.explanation,
      analogy: fitShort(cs.analogy, 70, 11, 'hint', 18),
      misconception: cs.misconception,
      keyTakeaways: (cs.keyTakeaways ?? [])
        .slice(0, 1)
        .map((item) => fitShort(item, 60, 10, 'concept', 18))
        .filter((item): item is string => Boolean(item)),
      workedExample: cs.workedExample
        ? {
            problemStatement: fitProblemForBox(rawProblem),
            steps: cs.workedExample.steps
              .slice(0, 3)
              .map((step) => compactMathStep(step, 60, 9))
              .filter(Boolean),
            interpretation:
              cs.workedExample.interpretation.length <= 165 &&
              /\d\.\s+[A-ZÁÉÍÓÚÑ]/.test(cs.workedExample.interpretation) &&
              !hasDanglingEnding(cs.workedExample.interpretation)
                ? cs.workedExample.interpretation
                : fitShort(cs.workedExample.interpretation, 116, 18, 'conclusion', 18) ||
                  cs.workedExample.interpretation,
          }
        : cs.workedExample,
      variables: (cs.variables ?? []).slice(0, 3).map((variable) => ({
        ...variable,
        meaning: fitShort(variable.meaning, 32, 5, 'concept', 8) || variable.meaning,
      })),
      facts: (cs.facts ?? []).slice(0, 1),
    } as unknown as SacrintConceptSlide;
  }
  if (slide.kind === 'practice') {
    const ps = slide as SacrintPracticeSlide;
    const validCriteria = (ps.evaluationCriteria ?? [])
      .slice(0, 2)
      .map((item) => fitShort(compactEvaluationCriterion(item), 108, 18, 'general', 22))
      .filter(isValidEvaluationCriterionItem);
    return {
      ...ps,
      activities: (ps.activities ?? []).slice(0, 2).map((activity) => {
        const fittedHint = fitShort(compactHintText(activity.hint), 100, 16, 'hint', 22);
        const cleanHint =
          fittedHint && fittedHint.trim().length >= 18 && !hasDanglingEnding(fittedHint)
            ? fittedHint
            : undefined;
        return {
          ...activity,
          statement: compactActivityPreservingTaskAndData(activity.statement, 220, 36),
          hint: cleanHint,
        };
      }),
      applicationText: fitShort(ps.applicationText, 116, 18, 'application', 44),
      practiceText: fitShort(ps.practiceText, 116, 18, 'application', 44),
      objectiveBullets: (ps.objectiveBullets ?? [])
        .slice(0, 1)
        .map((item) => normalizeLearningObjective(item, { title: ps.title, maxWords: 14, strict: false }) || item)
        .filter((item): item is string => Boolean(item)),
      evaluationCriteria:
        validCriteria.length > 0
          ? validCriteria
          : ['Procedimiento ordenado y conclusión coherente con el planteamiento.'],
      exitChecks: (ps.exitChecks ?? [])
        .slice(0, 2)
        .map((item) => fitShort(compactEvaluationCriterion(item), 86, 14, 'general', 22))
        .filter(isValidEvaluationCriterionItem),
      artifactName: fitShort(ps.artifactName, 40, 6, 'concept', 10),
      artifactStep: fitShort(ps.artifactStep, 106, 16, 'application', 34),
      facts: (ps.facts ?? []).slice(0, 1),
    } as unknown as SacrintPracticeSlide;
  }
  return slide;
}

const MECHANICAL_SLIDE_CORRUPTION_FAST_RE =
  /\bhacia\s+[a-záéíóúñ]{3,}(?:ar|er|ir)\b|\btal\s+tal\b|\bdicha\s+(?:funcionando|siendo|teniendo|haciendo|operando|trabajando)\b|\b(?:en\s+la|una|esta|esa|dicha)\s+expone\b|\bun\s+lado\s+al\s+de\b|\bmediante\s+forma\b|\ba\s+partir\.|\by\s+considera\.|\binstrumento\b|\b(?:una|la)\s+(?:largo|alto)\b|\?['"»”’]\?|\bestimar\s+objetos\b/i;

export const INCOHERENT_APLICAR_PREFIX_RE =
  /^Aplicar\s+(?:(?:entre|sobre|hacia|desde|contra|bajo|seg[uú]n)\b|[a-záéíóúñ]{3,}(?:ar|er|ir)\b|[a-záéíóúñ]+(?:as|es)\s+(?:y\s+|con\s+|el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)|pulsera\b|texto\b|[a-záéíóúñ]+\s+(?:es|son)\s+)/i;

export function sanitizeMechanicalSlideCorruption(value: string | undefined): string {
  if (!value) return '';
  if (!MECHANICAL_SLIDE_CORRUPTION_FAST_RE.test(value)) return value.trim();
  return value
    .replace(/\bhacia\s+([a-záéíóúñ]{3,}(?:ar|er|ir))\b/gi, 'para $1')
    .replace(/\btal\s+tal\b/gi, 'tal')
    .replace(/\bdicha\s+(funcionando|siendo|teniendo|haciendo|operando|trabajando)\b/gi, 'continúa $1')
    .replace(/\b(?:en\s+la|una|esta|esa|dicha)\s+expone\b/gi, 'se expone')
    .replace(/\bun\s+lado\s+al\s+de\b/gi, 'un lado respecto al de')
    .replace(/\bmediante\s+forma\b/gi, 'de forma')
    .replace(/\ba\s+partir\.(?=["'\s,}\]]|$)/gi, '.')
    .replace(/\by\s+considera\.(?=["'\s,}\]]|$)/gi, '.')
    .replace(/\b(una|la|esta|esa|dicha)\s+instrumento\b/gi, (_m, det: string) => {
      const map: Record<string, string> = { una: 'un', la: 'el', esta: 'este', esa: 'ese', dicha: 'dicho' };
      const low = det.toLowerCase();
      const repl = map[low] || 'un';
      return /^[A-ZÁÉÍÓÚÑ]/.test(det) ? `${repl.charAt(0).toUpperCase()}${repl.slice(1)} instrumento` : `${repl} instrumento`;
    })
    .replace(/\binstrumento\s+(digital\s+|t[eé]cnico\s+)?preferida\b/gi, 'instrumento $1preferido')
    .replace(/\b(una|la)\s+(largo|alto)\b/gi, (_m, det: string, noun: string) => {
      const repl = det.toLowerCase() === 'una' ? 'un' : 'el';
      return /^[A-Z]/.test(det) ? `${repl.charAt(0).toUpperCase()}${repl.slice(1)} ${noun}` : `${repl} ${noun}`;
    })
    .replace(/\?(['"»”’])\?/g, '$1?')
    .replace(/\bestimar\s+objetos\b/gi, 'estimar dimensiones de objetos')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function hasSlideIntegrityDefect(value: string | undefined): boolean {
  const clean = (value || '').trim();
  if (!clean) return false;
  return (
    GENERIC_FILLER_RE.test(clean) ||
    NODE_TRUNCATION_RE.test(clean) ||
    TEMPLATE_PHRASE_RE.test(clean) ||
    GENERIC_CONCLUSION_RE.test(clean) ||
    NUMERIC_ONLY_STEP_RE.test(clean)
  );
}

export function sanitizeDiagramPostBudget(
  diagram: SacrintDiagramSpec,
  safeCenterFallback: string
): SacrintDiagramSpec {
  if (!diagram.available) return diagram;
  const fixNodeDetail = (detail: string | undefined, isCenter = false): string => {
    const cleaned = sanitizeMechanicalSlideCorruption(detail);
    if (!cleaned) return isCenter ? safeCenterFallback : '';
    if (hasSlideIntegrityDefect(cleaned) || (isCenter && OBJECTIVE_CENTER_VERB_RE.test(cleaned))) {
      return isCenter ? safeCenterFallback : '';
    }
    return cleaned;
  };
  switch (diagram.kind) {
    case 'concept':
      return {
        ...diagram,
        center: { ...diagram.center, detail: fixNodeDetail(diagram.center.detail, true) },
        nodes: diagram.nodes.map((n) => ({ ...n, detail: fixNodeDetail(n.detail) })),
      };
    case 'system-map':
      return {
        ...diagram,
        center: { ...diagram.center, detail: fixNodeDetail(diagram.center.detail, true) },
        components: diagram.components.map((c) => ({ ...c, detail: fixNodeDetail(c.detail) })),
        environment: { ...diagram.environment, detail: fixNodeDetail(diagram.environment.detail) },
      };
    case 'block-diagram':
      return {
        ...diagram,
        input: { ...diagram.input, detail: fixNodeDetail(diagram.input.detail) },
        process: { ...diagram.process, detail: fixNodeDetail(diagram.process.detail) },
        output: { ...diagram.output, detail: fixNodeDetail(diagram.output.detail) },
        feedback: { ...diagram.feedback, detail: fixNodeDetail(diagram.feedback.detail) },
      };
    case 'timeline':
      return {
        ...diagram,
        events: diagram.events.map((e) => ({ ...e, detail: fixNodeDetail(e.detail) })),
      };
    case 'language':
      return {
        ...diagram,
        input: { ...diagram.input, detail: fixNodeDetail(diagram.input.detail) },
        rule: { ...diagram.rule, detail: fixNodeDetail(diagram.rule.detail) },
        output: { ...diagram.output, detail: fixNodeDetail(diagram.output.detail) },
        context: { ...diagram.context, detail: fixNodeDetail(diagram.context.detail) },
      };
    case 'argument':
      return {
        ...diagram,
        thesis: { ...diagram.thesis, detail: fixNodeDetail(diagram.thesis.detail, true) },
        premises: diagram.premises.map((p) => ({ ...p, detail: fixNodeDetail(p.detail) })),
        objection: { ...diagram.objection, detail: fixNodeDetail(diagram.objection.detail) },
        conclusion: { ...diagram.conclusion, detail: fixNodeDetail(diagram.conclusion.detail) },
      };
    case 'sop-flow':
      return {
        ...diagram,
        steps: diagram.steps.map((s) => ({ ...s, detail: fixNodeDetail(s.detail) })),
      };
    case 'creative-cycle':
      return {
        ...diagram,
        phases: diagram.phases.map((ph) => ({ ...ph, detail: fixNodeDetail(ph.detail) })),
        statement: diagram.statement ? fixNodeDetail(diagram.statement) : '',
      };
    case 'training-cycle':
      return {
        ...diagram,
        phases: diagram.phases.map((ph) => ({ ...ph, detail: fixNodeDetail(ph.detail) })),
        principle: diagram.principle ? fixNodeDetail(diagram.principle) : '',
      };
    case 'regulation-flow':
      return {
        ...diagram,
        stages: diagram.stages.map((st) => ({ ...st, detail: fixNodeDetail(st.detail) })),
        anchor: diagram.anchor ? fixNodeDetail(diagram.anchor) : '',
      };
    case 'clinical-flow':
      return {
        ...diagram,
        stages: diagram.stages.map((st) => ({ ...st, detail: fixNodeDetail(st.detail) })),
        note: diagram.note ? fixNodeDetail(diagram.note) : '',
      };
    default:
      return diagram;
  }
}
