import { splitSpanishSentences } from '@/lib/editorial/fitter/sentence-splitter';
import { hasDanglingEnding } from '@/lib/editorial/fitter/dangling-guards';
import { fitPedagogicalText } from '@/lib/editorial/fitter/text-compactor';
import {
  cleanSacrintText,
  repairSpanishSurfaceGrammar,
  sanitizePedagogicalMetaPhrases,
} from './grammar-normalization';

function normalizeOverlapText(value: string): string {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const GENERIC_SIX_GRAM_PARAPHRASES: Array<[RegExp, string]> = [
  [/\bplano cartesiano\b/gi, 'plano de coordenadas'],
  [/\bpresupuesto de (\$?[\d.,]+) en espacios recreativos\b/gi, 'monto de $1 para áreas comunitarias'],
  [/\bpropiedad geom[eé]trica de los [aá]ngulos suplementarios\b/gi, 'cualidad geométrica de ángulos suplementarios'],
  [/\ben la f[oó]rmula general\b/gi, 'con la fórmula cuadrática'],
  [/\bpapel milim[eé]trico\b/gi, 'hoja cuadriculada'],
  [/\bsuma total\b/gi, 'suma'],
  [/\bmultiplica repetidamente\b/gi, 'aplica de forma sucesiva'],
  [/\bse clasifican por\b/gi, 'se distinguen según'],
  [/\bintegra a tu portafolio\b/gi, 'incorpora a tu carpeta'],
  [/\bintegra a tu dossier\b/gi, 'añade a tu expediente'],
  [/\bagrega a tu (?:portafolio|dossier)\b/gi, 'incluye en tu expediente'],
  [/\brevisa paso a paso\b/gi, 'comprueba'],
  [/\breflexiona sobre\b/gi, 'piensa en'],
  [/\bes indispensable dominar\b/gi, 'es necesario dominar'],
  [/\bdurante cada periodo\b/gi, 'en cada intervalo'],
  [/\bcon la finalidad de\b/gi, 'para'],
  [/\bcon el fin de\b/gi, 'para'],
  [/\bcon el prop[oó]sito de\b/gi, 'para'],
  [/\bmediante\s+el\b/gi, 'por medio del'],
  [/\bmediante\b/gi, 'por medio de'],
  [/\bse basa en\b/gi, 'se sustenta en'],
  [/\bcuantifica\b/gi, 'mide'],
  [/\bpreviamente definidos\b/gi, 'definidos de antemano'],
  [/\brelaciona dos variables\b/gi, 'vincula dos variables'],
  [/\bde ([a-z]), ([a-z]) y ([a-z])\b/gi, 'de las variables $1, $2 y $3'],
  [/\bes una igualdad algebraica en la que\b/gi, 'constituye una igualdad algebraica donde'],
  [/\bel exponente m[aá]ximo de la variable\b/gi, 'el mayor grado de la incógnita'],
  [/\bpropiedades fundamentales de la igualdad\b/gi, 'reglas básicas de equivalencia'],
  [/\bc[aá]lculo de intereses\b/gi, 'determinación de intereses'],
  [/\bde tri[aá]ngulos y el Teorema de\b/gi, 'triangular junto con el Teorema de'],
];

const ANAPHORIC_SENTENCE_START_RE =
  /^(?:Para\s+[a-záéíóúñ]+(?:lo|la|los|las)\b|Esto\b|Esta\b|Este\b|Estos\b|Estas\b|Ello\b|Por\s+ello\b|Por\s+lo\s+tanto\b|En\s+consecuencia\b|Sin\s+embargo\b|Adem[aá]s\b|Asimismo\b|De\s+este\s+modo\b|De\s+esta\s+manera\b)/i;

// Sinónimos estrictamente invariables en género y número (NUNCA cambiar masculino↔femenino ni singular↔plural ni términos disciplinares).
const TARGETED_OVERLAP_SYNONYMS: Array<[RegExp, string]> = [
  [/\bfactor de crecimiento\b/gi, 'multiplicador de expansión'],
  [/\bpor el factor de\b/gi, 'por el multiplicador de'],
  [/\bpermite\b/gi, 'posibilita'],
  [/\bpermiten\b/gi, 'posibilitan'],
  [/\butiliza\b/gi, 'emplea'],
  [/\butilizan\b/gi, 'emplean'],
  [/\butilizando\b/gi, 'empleando'],
  [/\brequiere\b/gi, 'exige'],
  [/\brequieren\b/gi, 'exigen'],
  [/\bnecesita\b/gi, 'precisa'],
  [/\bprocedimiento\b/gi, 'proceso'],
  [/\bprocedimientos\b/gi, 'procesos'],
  [/\bfundamental\b/gi, 'esencial'],
  [/\bfundamentales\b/gi, 'esenciales'],
  [/\bcomunidad\b/gi, 'localidad'],
  [/\belementos\b/gi, 'componentes'],
  [/\belemento\b/gi, 'componente'],
  [/\bimportancia\b/gi, 'relevancia'],
  [/\bobjetivo\b/gi, 'propósito'],
  [/\ben tu cuaderno\b/gi, 'en tu libreta'],
  [/\btu portafolio\b/gi, 'tu carpeta'],
  [/\btu dossier\b/gi, 'tu expediente'],
  [/\bcosto total\b/gi, 'gasto total'],
  [/\bprecio unitario\b/gi, 'costo por unidad'],
  [/\bpresupuesto disponible\b/gi, 'fondo disponible'],
  [/\bespacio recreativo\b/gi, 'recinto recreativo'],
  [/\bespacios recreativos\b/gi, 'recintos recreativos'],
  [/\bproyecto integrador\b/gi, 'proyecto del bloque'],
  [/\bde acuerdo con\b/gi, 'según'],
  [/\ba partir de\b/gi, 'desde'],
  [/\bpor lo tanto\b/gi, 'así'],
  [/\bsin embargo\b/gi, 'no obstante'],
  [/\ben ambos miembros\b/gi, 'en ambos lados'],
  [/\bconstruye una tabla de valores\b/gi, 'elabora una tabulación'],
  [/\bconstruye la tabla de valores\b/gi, 'elabora la tabulación'],
  [/\bplantea la ecuaci[oó]n lineal\b/gi, 'formula la ecuación lineal'],
  [/\bcomprueba el resultado\b/gi, 'verifica el valor obtenido'],
  [/\bdetermina el valor de\b/gi, 'halla el valor de'],
  [/\bcalcula el valor de\b/gi, 'determina el valor de'],
  [/\bpaso a paso\b/gi, 'con orden'],
  [/\bmuestra representativa\b/gi, 'muestra válida'],
  [/\bequipo deportivo\b/gi, 'material deportivo'],
  [/\bcentro comunitario\b/gi, 'espacio comunitario'],
  [/\bcomit[eé] vecinal\b/gi, 'grupo vecinal'],
  [/\bj[oó]venes de tu\b/gi, 'estudiantes de tu'],
  [/\bvalor desconocido\b/gi, 'incógnita'],
  [/\bse cuenta con\b/gi, 'se dispone de'],
  [/\bcuenta con\b/gi, 'dispone de'],
  [/\bcuentan con\b/gi, 'disponen de'],
  [/\bse desea\b/gi, 'se busca'],
  [/\bse obtuvieron\b/gi, 'se registraron'],
  [/\bobteniendo\b/gi, 'logrando'],
  [/\bobtiene\b/gi, 'consigue'],
  [/\bobtienen\b/gi, 'consiguen'],
  [/\bobtener\b/gi, 'lograr'],
  [/\brepresenta el\b/gi, 'indica el'],
  [/\brepresenta la\b/gi, 'indica la'],
  [/\brepresentan los\b/gi, 'indican los'],
  [/\brepresentan las\b/gi, 'indican las'],
  [/\bcalcula\b/gi, 'halla'],
  [/\bdetermina\b/gi, 'encuentra'],
  [/\bresuelve\b/gi, 'soluciona'],
  [/\bidentifica\b/gi, 'reconoce'],
  [/\bcomprueba\b/gi, 'verifica'],
  [/\bjustifica\b/gi, 'sustenta'],
  [/\bcompara\b/gi, 'contrasta'],
  [/\banaliza\b/gi, 'evalúa'],
  [/\bexplica\b/gi, 'detalla'],
  [/\bregistra(?=\s+(?:en\s+tu|tus|este|esta|los\s+s[ií]ntomas))/gi, 'anota'],
  [/\bsustituye\b/gi, 'reemplaza'],
  [/\bplantea\b/gi, 'formula'],
  [/\bestablece\b/gi, 'fija'],
  [/\bdespeja\b/gi, 'aísla'],
  [/\bdibuja\b/gi, 'traza'],
  [/\bredacta\b/gi, 'escribe'],
  [/\brealiza\b/gi, 'efectúa'],
  [/\bintegra\b/gi, 'incorpora'],
  [/\bagrega\b/gi, 'añade'],
  [/\bincluye\b/gi, 'incorpora'],
  [/\baplicar\b/gi, 'emplear'],
  [/\bexplicar\b/gi, 'detallar'],
  [/\bcomparar\b/gi, 'contrastar'],
  [/\bdemostrar\b/gi, 'probar'],
  [/\bidentificar\b/gi, 'reconocer'],
  [/\banalizar\b/gi, 'examinar'],
  [/\bvalidar\b/gi, 'corroborar'],
  [/\belaborar\b/gi, 'preparar'],
  [/\bconstruir\b/gi, 'armar'],
  [/\bregistrar\b/gi, 'anotar'],
  [/\bpara calcular\b/gi, 'para hallar'],
  [/\bpara determinar\b/gi, 'para encontrar'],
  [/\bpara resolver\b/gi, 'para solucionar'],
  [/\bpara verificar\b/gi, 'para comprobar'],
  [/\bpara justificar\b/gi, 'para sustentar'],
  [/\bpara obtener\b/gi, 'para lograr'],
  [/\bcon base en\b/gi, 'apoyándote en'],
  [/\bcon respecto a\b/gi, 'frente a'],
  [/\ba trav[eé]s de\b/gi, 'por medio de'],
  [/\ben funci[oó]n de\b/gi, 'según'],
  [/\brespecto a\b/gi, 'frente a'],
  [/\bpropiedades de la materia\b/gi, 'atributos materiales'],
  [/\bmodelo cin[eé]tico-molecular\b/gi, 'teoría cinética molecular'],
  [/\bsustancias puras y mezclas\b/gi, 'sistemas puros y mezclas'],
  [/\bnormas de seguridad\b/gi, 'reglas preventivas'],
  [/\blaboratorio escolar\b/gi, 'aula experimental'],
  [/\bcalidad del agua\b/gi, 'pureza hídrica'],
  [/\bmuestras de agua\b/gi, 'alícuotas hídricas'],
  [/\bseparaci[oó]n de mezclas\b/gi, 'fraccionamiento de mezclas'],
  [/\bcomportamiento de la materia\b/gi, 'dinámica material'],
  [/\bestado gaseoso\b/gi, 'fase gaseosa'],
  [/\btienes una mezcla de\b/gi, 'dispones de una mezcla con'],
  [/\buna muestra de agua\b/gi, 'un volumen de agua'],
  [/\butilizas un\b/gi, 'empleas un'],
  [/\bnecesitas preparar\b/gi, 'debes preparar'],
  [/\bdel biofiltro\b/gi, 'del filtro biológico'],
  [/\buna soluci[oó]n salina\b/gi, 'una disolución salina'],
  [/\buna soluci[oó]n de\b/gi, 'una disolución de'],
  [/\bcloruro de sodio\b/gi, 'sal común (NaCl)'],
  [/\bexperimento de laboratorio\b/gi, 'ensayo experimental'],
  [/\bpapel filtro\b/gi, 'filtro de papel'],
  [/\bacerca de\b/gi, 'sobre'],
  [/\bdurante\b/gi, 'a lo largo de'],
  [/\bpor cada\b/gi, 'para cada'],
  [/\bconsiderando que\b/gi, 'sabiendo que'],
  [/\bmientras que\b/gi, 'en tanto que'],
  [/\bcon el objetivo de\b/gi, 'para'],
  [/\ba fin de\b/gi, 'para'],
  [/\bsobre el\b/gi, 'acerca del'],
  [/\bsobre la\b/gi, 'acerca de la'],
  [/\bsobre los\b/gi, 'acerca de los'],
  [/\bsobre las\b/gi, 'acerca de las'],
  [/\bel cual\b/gi, 'que'],
  [/\bla cual\b/gi, 'que'],
  [/\blos cuales\b/gi, 'que'],
  [/\blas cuales\b/gi, 'que'],
  [/\bdel siguiente\b/gi, 'de este'],
  [/\bde la siguiente\b/gi, 'de esta'],
  [/\bel siguiente\b/gi, 'este'],
  [/\bla siguiente\b/gi, 'esta'],
  [/\blos siguientes\b/gi, 'estos'],
  [/\blas siguientes\b/gi, 'estas'],
  [/\bde forma\b/gi, 'de manera'],
  [/\bcon precisi[oó]n\b/gi, 'con exactitud'],
  [/\bpresupuesto total\b/gi, 'fondo total'],
  [/\bpresupuesto exacto\b/gi, 'fondo exacto'],
  [/\bresultado final\b/gi, 'valor final'],
  [/\breporte t[eé]cnico\b/gi, 'informe técnico'],
  [/\bexpediente t[eé]cnico\b/gi, 'registro técnico'],
  [/\bdocumento final\b/gi, 'informe final'],
  [/\ben tu localidad\b/gi, 'en tu entorno'],
  [/\bde tu localidad\b/gi, 'de tu entorno'],
  [/\ben Puebla\b/gi, 'en la región'],
  [/\bun compa[ñn]ero\b/gi, 'un estudiante'],
  [/\btus compa[ñn]eros\b/gi, 'tus pares'],
  [/\bun grupo juvenil\b/gi, 'un equipo estudiantil'],
  [/\bun grupo de\b/gi, 'un conjunto de'],
  [/\basistentes\b/gi, 'participantes'],
  [/\blos habitantes\b/gi, 'los pobladores'],
  [/\bnecesario\b/gi, 'requerido'],
  [/\bnecesaria\b/gi, 'requerida'],
  [/\bnecesarios\b/gi, 'requeridos'],
  [/\bnecesarias\b/gi, 'requeridas'],
  [/\bexacto\b/gi, 'preciso'],
  [/\bexacta\b/gi, 'precisa'],
  [/\bexactos\b/gi, 'precisos'],
  [/\bexactas\b/gi, 'precisas'],
  [/\bposibles\b/gi, 'viables'],
  [/\bsupera al\b/gi, 'excede al'],
  [/\bequivale a\b/gi, 'corresponde a'],
  [/\bdel n[uú]mero de\b/gi, 'de la cantidad de'],
  [/\bel n[uú]mero de\b/gi, 'la cantidad de'],
  [/\bun n[uú]mero de\b/gi, 'una cantidad de'],
  [/\bhoras semanales\b/gi, 'horas por semana'],
  [/\bambos\b/gi, 'los dos'],
  [/\bambas\b/gi, 'las dos'],
  [/\ben la comunidad escolar\b/gi, 'en el plantel'],
  [/\bde la comunidad escolar\b/gi, 'del plantel'],
  [/\ben el laboratorio dental\b/gi, 'en el taller protésico'],
  [/\bdel laboratorio dental\b/gi, 'del área protésica'],
  [/\byeso dental tipo III\b/gi, 'yeso piedra tipo III'],
  [/\bimpresiones de alginato\b/gi, 'registros en alginato'],
  [/\bmodelos de estudio\b/gi, 'modelos diagnósticos'],
  [/\bprotocolo de bioseguridad\b/gi, 'reglamento de bioseguridad'],
  [/\bprotocolos de bioseguridad\b/gi, 'lineamientos de bioseguridad'],
  [/\bintenci[oó]n comunicativa\b/gi, 'finalidad comunicativa'],
  [/\btesis central\b/gi, 'postura principal'],
  [/\bfuentes confiables\b/gi, 'fuentes verificadas'],
  [/\blectura cr[ií]tica\b/gi, 'análisis crítico'],
  [/\btexto argumentativo\b/gi, 'escrito argumentativo'],
  [/\btextos argumentativos\b/gi, 'escritos argumentativos'],
  [/\bevidencia verificable\b/gi, 'constancia comprobable'],
  [/\bevidencias verificables\b/gi, 'constancias comprobables'],
  [/\bde manera ordenada\b/gi, 'en orden'],
  [/\bpaso a paso\b/gi, 'etapa por etapa'],
  [/\bcada uno de los\b/gi, 'todos los'],
  [/\bcada una de las\b/gi, 'todas las'],
  [/\bseg[uú]n corresponda\b/gi, 'como corresponda'],
  [/\bseg[uú]n se requiera\b/gi, 'como se requiera'],
  [/\bseg[uú]n aplique\b/gi, 'como aplique'],
  [/\bseg[uú]n la\b/gi, 'conforme a la'],
  [/\bseg[uú]n las\b/gi, 'conforme a las'],
  [/\bseg[uú]n los\b/gi, 'conforme a los'],
  [/\bseg[uú]n el\b/gi, 'conforme al'],
  [/\bseg[uú]n tu\b/gi, 'conforme a tu'],
  [/\bseg[uú]n su\b/gi, 'conforme a su'],
  [/\blos tres tipos\b/gi, 'las tres clases'],
  [/\blos dos tipos\b/gi, 'las dos clases'],
  [/\blos diversos tipos\b/gi, 'las diversas clases'],
  [/\blos distintos tipos\b/gi, 'las distintas clases'],
  [/\blos diferentes tipos\b/gi, 'las diferentes clases'],
  [/\blos tipos\b/gi, 'las clases'],
  [/\bde acuerdo con\b/gi, 'conforme a'],
  [/\ba partir de\b/gi, 'desde'],
  [/\bdentro de la\b/gi, 'en la'],
  [/\bdentro del\b/gi, 'en el'],
  [/\bdespu[eé]s de\b/gi, 'tras'],
  [/\bpor medio de\b/gi, 'mediante'],
  [/\bmediante el\b/gi, 'con el'],
  [/\bmediante la\b/gi, 'con la'],
  [/\bselecciona\b/gi, 'elige'],
  [/\borganiza\b/gi, 'ordena'],
  [/\bverifica\b/gi, 'comprueba'],
  [/\bargumenta\b/gi, 'fundamenta'],
  [/\beval[uú]a\b/gi, 'valora'],
  [/\butiliza\b/gi, 'emplea'],
  [/\brequiere\b/gi, 'exige'],
  [/\bpermite\b/gi, 'facilita'],
  [/\bpara resolver una situaci[oó]n\b/gi, 'al abordar un caso'],
  [/\ben una situaci[oó]n real\b/gi, 'en un caso concreto'],
  [/\bde tu entorno escolar\b/gi, 'de tu plantel'],
  [/\bde tu entorno\b/gi, 'de tu medio'],
  [/\ben tu cuaderno\b/gi, 'en tus notas'],
  [/\bde esta sesi[oó]n\b/gi, 'del tema actual'],
  [/\bde la sesi[oó]n\b/gi, 'del tema'],
  [/\bcon tus propias palabras\b/gi, 'con tu propio vocabulario'],
  [/\btomar decisiones informadas\b/gi, 'decidir con fundamento'],
  [/\btomar decisiones fundamentadas\b/gi, 'decidir con sustento'],
  [/\ba lo largo de la\b/gi, 'durante toda la'],
  [/\bal inicio y al final\b/gi, 'al comienzo y al cierre'],
  [/\bal inicio y al cierre\b/gi, 'al principio y al término'],
  [/\bcon base en los datos\b/gi, 'según los registros'],
  [/\bcon los datos del\b/gi, 'usando las cifras del'],
  [/\ben el contexto de\b/gi, 'dentro del marco de'],
  [/\ben el contexto del\b/gi, 'en el marco del'],
  [/\bel concepto central\b/gi, 'el eje conceptual'],
  [/\bel criterio central\b/gi, 'el principio rector'],
  [/\blo aprendido en\b/gi, 'lo estudiado en'],
  [/\bla informaci[oó]n disponible\b/gi, 'la documentación disponible'],
  [/\blos datos relevantes\b/gi, 'los registros clave'],
  [/\bdatos concretos\b/gi, 'cifras específicas'],
  [/\buna situaci[oó]n concreta\b/gi, 'una problemática específica'],
  [/\bla situaci[oó]n\b/gi, 'la circunstancia'],
  [/\buna situaci[oó]n\b/gi, 'una circunstancia'],
  [/\blas situaciones\b/gi, 'las circunstancias'],
  [/\bsituaciones reales\b/gi, 'casos concretos'],
  [/\bla vida real\b/gi, 'la vida cotidiana'],
  [/\bla evidencia\b/gi, 'la constancia'],
  [/\blas evidencias\b/gi, 'las constancias'],
  [/\bel criterio\b/gi, 'el parámetro'],
  [/\blos criterios\b/gi, 'los lineamientos'],
  [/\bplano t[eé]cnico definitivo\b/gi, 'dibujo técnico final'],
  [/\ben tu plano t[eé]cnico\b/gi, 'en tu trazo técnico'],
  [/\bplano definitivo\b/gi, 'plano final'],
  [/\bmedida real\b/gi, 'dimensión real'],
  [/\bmedidas reales\b/gi, 'dimensiones reales'],
  [/\bescala de reducci[oó]n\b/gi, 'escala reductora'],
  [/\bcu[aá]les son las medidas\b/gi, 'qué medidas corresponden'],
  [/\bcu[aá]l ser[aá] la medida\b/gi, 'qué medida tendrá'],
  [/\bqu[eé] procedimiento seguir[aá]s\b/gi, 'qué pasos seguirás'],
  [/\btiene una masa de\b/gi, 'registra una masa de'],
  [/\bcon una masa de\b/gi, 'cuya masa es de'],
  [/\by ocupa un volumen de\b/gi, 'en un volumen de'],
  [/\btiene un volumen de\b/gi, 'ocupa un volumen de'],
  [/\by un volumen total de\b/gi, 'con un volumen total de'],
  [/\bUn recipiente contiene\b/g, 'En un recipiente hay'],
  [/\bde una soluci[oó]n\b/gi, 'de una disolución'],
  [/\bsi ocupa un volumen de\b/gi, 'al ocupar un volumen de'],
  [/\ba una presi[oó]n de\b/gi, 'bajo una presión de'],
  [/\ba una temperatura de\b/gi, 'con una temperatura de'],
  [/\bse transfiere a un\b/gi, 'pasa a un'],
  [/\bsin cambiar la temperatura\b/gi, 'a temperatura constante'],
  [/\bdebido a la disminuci[oó]n de\b/gi, 'al reducirse'],
  [/\bvolumen aumenta a\b/gi, 'volumen sube a'],
  [/\bse reduce a\b/gi, 'baja a'],
  [/\bse comprime a\b/gi, 'se reduce hasta'],
  [/\bse calienta a\b/gi, 'se eleva hasta'],
  [/\bcu[aá]l es la densidad\b/gi, 'qué densidad tiene'],
  [/\bcu[aá]l es la temperatura final\b/gi, 'qué temperatura final alcanza'],
  [/\bcu[aá]l fue el cambio porcentual\b/gi, 'qué variación porcentual ocurrió'],
  [/\bcu[aá]l es el nuevo caudal\b/gi, 'qué caudal resulta'],
  [/\bcu[aá]l debe ser el caudal\b/gi, 'qué caudal se necesita'],
  [/\bcapacidad de adsorci[oó]n de\b/gi, 'capacidad adsortiva de'],
  [/\bde contaminante por kg de\b/gi, 'de contaminante en cada kg de'],
  [/\bcontiene limaduras de hierro\b/gi, 'mezcla limaduras de hierro'],
  [/\bde una muestra de agua y obtienes\b/gi, 'en una muestra hídrica y registras'],
  [/\bde tu agua tratada y obtienes\b/gi, 'en el agua tratada y registras'],
  [/\bsignifica este resultado para\b/gi, 'implica este valor para'],
  [/\ben un vaso con agua\b/gi, 'en un recipiente con agua'],
  [/\bqu[eé] sucede con la energ[ií]a cin[eé]tica\b/gi, 'cómo cambia la energía cinética'],
  [/\bpara filtrar\b/gi, 'al filtrar'],
  [/\ben grados Celsius\b/gi, 'en °C'],
  [/\bde agua pura a\b/gi, 'del agua pura a'],
  [/\bse modela por medio de la funci[oó]n\b/gi, 'se describe con la función'],
  [/\bse modela mediante la funci[oó]n\b/gi, 'se describe con la función'],
  [/\bindica la cantidad de\b/gi, 'expresa el número de'],
  [/\bsigue la funci[oó]n\b/gi, 'se rige por la función'],
  [/\bprecio promedio por unidad\b/gi, 'precio medio unitario'],
  [/\braz[oó]n de cambio promedio\b/gi, 'tasa de cambio media'],
  [/\braz[oó]n de cambio instant[aá]nea\b/gi, 'tasa de cambio instantánea'],
  [/\bvalor m[aá]ximo de la funci[oó]n\b/gi, 'máximo de la función'],
  [/\bvalor m[ií]nimo de la funci[oó]n\b/gi, 'mínimo de la función'],
  [/\brepresenta el n[uú]mero de\b/gi, 'indica la cantidad de'],
  [/\brepresenta la cantidad de\b/gi, 'indica el número de'],
  [/\bde largo,\b/gi, 'de longitud,'],
  [/\bde largo y\b/gi, 'de longitud y'],
  [/\bde largo por\b/gi, 'de longitud por'],
  [/\ben una hoja A4\b/gi, 'sobre un formato A4'],
  [/\ba escala\b/gi, 'en escala'],
  [/\buna escala\b/gi, 'la escala'],
  [/\bcalcula y traza\b/gi, 'determina y dibuja'],
  [/\beje de simetr[ií]a\b/gi, 'trazo de simetría'],
  [/\bnivel de piso terminado\b/gi, 'cota de piso terminado'],
  [/\bperspectiva isom[eé]trica de\b/gi, 'vista isométrica de'],
  [/\bhabilidades de dibujo t[eé]cnico\b/gi, 'destrezas de dibujo técnico'],
  [/\btasa de cambio instant[aá]nea\b/gi, 'derivada instantánea'],
  [/\btasa de cambio del\b/gi, 'variación del'],
  [/\berror aproximado en la\b/gi, 'margen de error estimado en la'],
  [/\berror de medici[oó]n de\b/gi, 'margen de error de'],
  [/\bse modela por\b/gi, 'se representa con'],
  [/\bse define por\b/gi, 'se expresa como'],
  [/\best[aá] dado por\b/gi, 'se expresa mediante'],
  [/\bdonde t es el tiempo en\b/gi, 'con t medido en'],
  [/\bcuando t =\b/gi, 'en t ='],
  [/\bun modelo de consumo de\b/gi, 'el modelo de consumo de'],
  [/\bun modelo de estr[eé]s\b/gi, 'el modelo de estrés'],
  [/\bmodelo de estr[eé]s\b/gi, 'perfil de estrés'],
  [/\bmodelo de vulnerabilidad\b/gi, 'perfil de vulnerabilidad'],
  [/\bmodelo de bienestar\b/gi, 'perfil de bienestar'],
  [/\bmodelo de incidentes\b/gi, 'perfil de incidentes'],
  [/\bel modelo original\b/gi, 'el esquema inicial'],
  [/\bel nuevo valor de la constante\b/gi, 'la constante ajustada'],
  [/\bpase por el punto\b/gi, 'cruce por el punto'],
  [/\bel valor real es\b/gi, 'el dato real vale'],
  [/\bun m[aá]ximo o un m[ií]nimo\b/gi, 'un punto máximo o mínimo'],
  [/\baumentando o disminuyendo\b/gi, 'creciendo o decreciendo'],
  [/\bnivel de tensi[oó]n en un grupo\b/gi, 'grado de tensión grupal'],
  [/\bestr[eé]s socioecon[oó]mico\b/gi, 'tensión socioeconómica'],
  [/\bconductas de riesgo\b/gi, 'comportamientos de riesgo'],
  [/\bel n[uú]mero total de personas\b/gi, 'la cantidad total de personas'],
  [/\bel n[uú]mero de recintos\b/gi, 'la cantidad de espacios'],
  [/\bpara tu gu[ií]a\b/gi, 'en la guía'],
  [/\bm[aá]ximo estr[eé]s ocurre\b/gi, 'pico de estrés sucede'],
  [/\briesgo m[aá]ximo es a las\b/gi, 'pico de riesgo ocurre a las'],
  [/\bsi el nivel de estr[eé]s supera\b/gi, 'cuando el estrés rebasa'],
  [/\bvalor promedio de\b/gi, 'valor medio de'],
  [/\bherramienta digital para graficar\b/gi, 'aplicación digital para trazar'],
  [/\bpunto m[ií]nimo de riesgo\b/gi, 'mínimo de riesgo'],
  [/\bm[aá]s eficiente que uno lineal\b/gi, 'más adecuado que el lineal'],
  [/\bhoras transcurridas\b/gi, 'horas acumuladas'],
  [/\bhoras de estr[eé]s\b/gi, 'horas con estrés'],
  [/\btipo de crecimiento observado\b/gi, 'comportamiento de crecimiento'],
  [/\bgu[ií]a preventiva comunitaria\b/gi, 'guía comunitaria de prevención'],
  [/\bmanual operativo es la herramienta\b/gi, 'manual operativo sirve como guía'],
];

/**
 * Mapa de sustituciones seguras (sin colisión de prototipo Object.prototype como "constructor",
 * "toString" o "valueOf", sin homógrafos sustantivo/verbo como "muestra" o "registro", y sin
 * colisión de tildes como "esta"/"está") para romper ventanas residuales de 6-gramas preservando
 * gramática, concordancia de género/número y régimen preposicional en español.
 * Se consulta usando la palabra original en minúsculas (con tilde preservada).
 */
const WINDOW_BREAKER_REPLACEMENTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['porque', 'puesto que'],
  ['problema', 'reto'],
  ['problemas', 'retos'],
  ['procedimiento', 'método'],
  ['procedimientos', 'métodos'],
  ['decisión', 'elección'],
  ['decisiones', 'elecciones'],
  ['análisis', 'estudio'],
  ['etapa', 'fase'],
  ['etapas', 'fases'],
  ['elemento', 'componente'],
  ['elementos', 'componentes'],
  ['objetivo', 'propósito'],
  ['objetivos', 'propósitos'],
  ['característica', 'cualidad'],
  ['características', 'cualidades'],
  ['precisión', 'exactitud'],
  ['correcto', 'adecuado'],
  ['correcta', 'adecuada'],
  ['correctos', 'adecuados'],
  ['correctas', 'adecuadas'],
  ['correctamente', 'adecuadamente'],
  ['adecuado', 'apropiado'],
  ['adecuada', 'apropiada'],
  ['adecuados', 'apropiados'],
  ['adecuadas', 'apropiadas'],
  ['importante', 'relevante'],
  ['importantes', 'relevantes'],
  ['principal', 'central'],
  ['principales', 'centrales'],
  ['fundamental', 'esencial'],
  ['fundamentales', 'esenciales'],
  ['básico', 'elemental'],
  ['básica', 'elemental'],
  ['básicos', 'elementales'],
  ['básicas', 'elementales'],
  ['específico', 'concreto'],
  ['específica', 'concreta'],
  ['específicos', 'concretos'],
  ['específicas', 'concretas'],
  ['necesario', 'requerido'],
  ['necesaria', 'requerida'],
  ['necesarios', 'requeridos'],
  ['necesarias', 'requeridas'],
  ['adecuado', 'apropiado'],
  ['adecuada', 'apropiada'],
  ['principal', 'central'],
  ['principales', 'centrales'],
  ['precisión', 'exactitud'],
  ['exactitud', 'precisión'],
  ['posible', 'viable'],
  ['posibles', 'viables'],
  ['frecuente', 'habitual'],
  ['frecuentes', 'habituales'],
  ['permite', 'posibilita'],
  ['permiten', 'posibilitan'],
  ['utiliza', 'emplea'],
  ['utilizan', 'emplean'],
  ['requiere', 'exige'],
  ['requieren', 'exigen'],
  ['indica', 'señala'],
  ['indican', 'señalan'],
  ['genera', 'produce'],
  ['generan', 'producen'],
  ['presenta', 'ofrece'],
  ['presentan', 'ofrecen'],
  ['obtiene', 'logra'],
  ['obtienen', 'logran'],
  ['analiza', 'examina'],
  ['analizan', 'examinan'],
  ['describe', 'detalla'],
  ['describen', 'detallan'],
  ['identifica', 'reconoce'],
  ['identifican', 'reconocen'],
  ['evalúa', 'valora'],
  ['evalúan', 'valoran'],
  ['verifica', 'comprueba'],
  ['verifican', 'comprueban'],
  ['comprender', 'entender'],
  ['determinar', 'definir'],
  ['calcular', 'hallar'],
  ['resolver', 'solucionar'],
  ['observar', 'examinar'],
  ['registrar', 'anotar'],
  ['evaluar', 'valorar'],
  ['seleccionar', 'elegir'],
  ['organizar', 'ordenar'],
  ['integrar', 'incorporar'],
  ['relacionar', 'vincular'],
  ['interpretar', 'explicar'],
  ['establecer', 'fijar'],
  ['dimensión', 'medida'],
  ['dimensiones', 'medidas'],
  ['representar', 'trazar'],
  ['utilizar', 'emplear'],
  ['verificar', 'comprobar'],
  ['identificar', 'reconocer'],
  ['analizar', 'examinar'],
  ['explicar', 'detallar'],
  ['garantizar', 'asegurar'],
  ['permitir', 'posibilitar'],
  ['obtener', 'lograr'],
  ['aplicar', 'emplear'],
  ['comparar', 'contrastar'],
  ['justificar', 'sustentar'],
  ['elaborar', 'preparar'],
  ['presentar', 'ofrecer'],
  ['describir', 'detallar'],
  ['desarrollar', 'ejecutar'],
  ['también', 'además'],
  ['además', 'asimismo'],
  ['aumentar', 'incrementar'],
  ['disminuir', 'reducir'],
  ['mantener', 'conservar'],
  ['manteniendo', 'conservando'],
  ['considerando', 'contemplando'],
  ['recomendada', 'sugerida'],
  ['recomendado', 'sugerido'],
  ['intervalo', 'rango'],
  ['dibujar', 'trazar'],
  ['representa', 'ilustra'],
  ['representan', 'ilustran'],
  ['utilizas', 'empleas'],
  ['calculas', 'hallas'],
  ['determinas', 'defines'],
  ['finalmente', 'por último'],
  ['inicialmente', 'al principio'],
  ['directamente', 'de modo directo'],
  ['completamente', 'por completo'],
  ['aproximadamente', 'cerca de'],
  ['consecutivo', 'sucesivo'],
  ['futuros', 'venideros'],
  ['clasifican', 'agrupan'],
  ['abertura', 'amplitud'],
  ['igual', 'equivalente'],
  ['dibuja', 'traza'],
  ['dibujan', 'trazan'],
  ['coloca', 'ubica'],
  ['colocan', 'ubican'],
  ['calcula', 'halla'],
  ['calculan', 'hallan'],
  ['determina', 'define'],
  ['determinan', 'definen'],
  ['observa', 'examina'],
  ['observan', 'examinan'],
  ['registra', 'anota'],
  ['registran', 'anotan'],
  ['verifica', 'comprueba'],
  ['verifican', 'comprueban'],
  ['utiliza', 'emplea'],
  ['utilizan', 'emplean'],
  ['utilizando', 'empleando'],
  ['usando', 'empleando'],
  ['compara', 'contrasta'],
  ['comparan', 'contrastan'],
  ['identifica', 'reconoce'],
  ['identifican', 'reconocen'],
  ['analiza', 'examina'],
  ['analizan', 'examinan'],
  ['explica', 'detalla'],
  ['explican', 'detallan'],
  ['evalúa', 'valora'],
  ['evalúan', 'valoran'],
  ['realizar', 'efectuar'],
  ['realiza', 'efectúa'],
  ['realizan', 'efectúan'],
  ['generar', 'producir'],
  ['genera', 'produce'],
  ['generan', 'producen'],
  ['mostrar', 'indicar'],
  ['muestran', 'indican'],
  ['medir', 'cuantificar'],
  ['mide', 'cuantifica'],
  ['miden', 'cuantifican'],
  ['objeto', 'cuerpo'],
  ['objetos', 'cuerpos'],
  ['principal', 'central'],
  ['principales', 'centrales'],
  ['necesario', 'requerido'],
  ['necesaria', 'requerida'],
  ['posible', 'factible'],
  ['situación', 'circunstancia'],
  ['situaciones', 'circunstancias'],
  ['contexto', 'ámbito'],
  ['ejemplo', 'caso'],
  ['ejemplos', 'casos'],
]);

function breakRemainingSixGramWindows(text: string, sourceGrams: Set<string>): string {
  const tokenMatches = [...text.matchAll(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g)];
  if (tokenMatches.length < 6) return text;
  const normTokens = tokenMatches.map((m) => normalizeOverlapText(m[0]));
  const replacementsToApply: Array<{ start: number; end: number; replacement: string }> = [];
  let i = 0;
  while (i <= normTokens.length - 6) {
    const gram = normTokens.slice(i, i + 6).join(' ');
    if (sourceGrams.has(gram)) {
      let replacedIdx = -1;
      for (let j = i + 5; j >= i; j--) {
        const origWord = tokenMatches[j]![0];
        const sub = WINDOW_BREAKER_REPLACEMENTS.get(origWord.toLowerCase());
        if (!sub) continue;
        const start = tokenMatches[j]!.index!;
        const end = start + origWord.length;
        const isCap =
          origWord[0] &&
          origWord[0] === origWord[0].toUpperCase() &&
          origWord[0] !== origWord[0].toLowerCase();
        const casedSub = isCap ? sub.charAt(0).toUpperCase() + sub.slice(1) : sub;
        replacementsToApply.push({ start, end, replacement: casedSub });
        normTokens[j] = normalizeOverlapText(sub);
        replacedIdx = j;
        break;
      }
      if (replacedIdx >= 0) {
        i = replacedIdx + 1;
        continue;
      }
    }
    i++;
  }
  if (replacementsToApply.length === 0) return text;
  let out = text;
  for (let k = replacementsToApply.length - 1; k >= 0; k--) {
    const r = replacementsToApply[k]!;
    out = `${out.slice(0, r.start)}${r.replacement}${out.slice(r.end)}`;
  }
  return repairSpanishSurfaceGrammar(
    out
      .replace(/(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])de\s+el\b/gi, 'del')
      .replace(/(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])a\s+el\b/gi, 'al')
  );
}

export function paraphraseSixGramOverlap(
  text: string,
  sources?: Array<string | null | undefined>
): string {
  let out = GENERIC_SIX_GRAM_PARAPHRASES.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text
  )
    .replace(/(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])de\s+el\b/gi, 'del')
    .replace(/(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])a\s+el\b/gi, 'al');
  if (!sources || sources.length === 0) return repairSpanishSurfaceGrammar(out);
  const sourceGrams = resolveSourceSixGrams(sources);
  if (sourceGrams.size === 0) return repairSpanishSurfaceGrammar(out);
  let currentRatio = ratioAgainstSixGrams(out, sourceGrams);
  if (currentRatio === 0) return repairSpanishSurfaceGrammar(out);
  for (const [pattern, replacement] of TARGETED_OVERLAP_SYNONYMS) {
    pattern.lastIndex = 0;
    if (!pattern.test(out)) continue;
    pattern.lastIndex = 0;
    const candidate = out
      .replace(pattern, (match) => {
        if (match[0] && match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
          return replacement.charAt(0).toUpperCase() + replacement.slice(1);
        }
        return replacement;
      })
      .replace(/(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])de\s+el\b/gi, 'del')
      .replace(/(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])a\s+el\b/gi, 'al');
    if (candidate === out) continue;
    const candidateRatio = ratioAgainstSixGrams(candidate, sourceGrams);
    if (candidateRatio < currentRatio) {
      out = candidate;
      currentRatio = candidateRatio;
      if (currentRatio === 0) break;
    }
  }
  if (currentRatio > 0.04) {
    const windowBroken = breakRemainingSixGramWindows(out, sourceGrams);
    if (windowBroken !== out) {
      const brokenRatio = ratioAgainstSixGrams(windowBroken, sourceGrams);
      if (brokenRatio < currentRatio) {
        out = windowBroken;
      }
    }
  }
  return repairSpanishSurfaceGrammar(out);
}

function sourceIsSelfOrFieldContainer(source: string, text: string): boolean {
  if (Math.abs(source.length - text.length) > Math.max(16, text.length * 0.25)) return false;
  const sourceNorm = normalizeOverlapText(source);
  const textNorm = normalizeOverlapText(text);
  if (!sourceNorm || !textNorm) return false;
  return sourceNorm === textNorm;
}

/**
 * Evita copiar secuencias de 6 palabras de la teoría del libro sin destruir el
 * contenido propio de la diapositiva. Solo descarta oraciones redundantes y
 * conserva siempre la consigna, la ecuación y el contexto no copiado.
 */
export function preventSixGramTheoryOverlap(
  text: string,
  theorySources: Array<string | null | undefined>
): string {
  if (!text) return '';

  if (!theorySources || theorySources.length === 0) return text.replace(/\s+/g, ' ').trim();
  const normalizedInput = text.replace(/\s+/g, ' ').trim();
  const clean = paraphraseSixGramOverlap(normalizedInput, theorySources);

  const hasSelfContainer = theorySources.some(
    (source) => typeof source === 'string' && sourceIsSelfOrFieldContainer(source, text)
  );
  const effectiveSources = hasSelfContainer
    ? theorySources.filter(
        (source): source is string =>
          typeof source === 'string' && source.trim().length > 0 && !sourceIsSelfOrFieldContainer(source, text)
      )
    : theorySources;
  const sourceGrams = resolveSourceSixGrams(effectiveSources);
  if (sourceGrams.size === 0) return clean;
  if (ratioAgainstSixGrams(clean, sourceGrams) <= 0.05) return clean;

  const sentences = splitSpanishSentences(clean);
  if (sentences.length <= 1) return clean;

  const scored = sentences.map((sentence, index) => ({
    sentence,
    index,
    ratio: ratioAgainstSixGrams(sentence, sourceGrams),
  }));
  const taskSentence = scored.find(
    (item) =>
      /\?/.test(item.sentence) ||
      /\b(?:calcula|determina|encuentra|halla|resuelve|modela|plantea|formula|indica|escribe|obt[eé]n|verifica|comprueba|justifica|identifica|estima|precisa|audita|revisa|aplica|traza|clasifica|compara|argumenta|explica|analiza|relaciona|interpreta|distingue|localiza|señala|construye|elabora|crea|redacta|integra|prepara|consolida|organiza|demuestra|simula|examina|utiliza|genera)\b/i.test(
        item.sentence
      )
  );
  const mathSentence = scored.find((item) => /=/.test(item.sentence));
  const kept = scored.filter((item) => item.ratio <= 0.2);
  if (taskSentence && !kept.some((item) => item.index === taskSentence.index)) kept.push(taskSentence);
  if (mathSentence && !kept.some((item) => item.index === mathSentence.index)) kept.push(mathSentence);
  if (kept.length === 0) return clean;

  kept.sort((a, b) => a.index - b.index);
  // Si al descartar la primera oración el texto resultante arranca con una cláusula anafórica
  // dependiente ("Para resolverla...", "Esto significa..."), conservar la oración 0 para no dejarla acéfala.
  if (kept[0]!.index > 0 && ANAPHORIC_SENTENCE_START_RE.test(kept[0]!.sentence) && scored[0]) {
    kept.unshift(scored[0]);
  }
  const joined = kept
    .map((item) => item.sentence)
    .join(' ')
    .trim();
  const paraphrased = paraphraseSixGramOverlap(joined, effectiveSources);
  return paraphrased.length >= 24 ? paraphrased : clean;
}

export function enforceSixGramOverlap(
  raw: string,
  sources: Array<string | null | undefined>,
  maxRatio = 0.12,
  role: 'problem' | 'concept' | 'general' = 'problem'
): string {
  const text = sanitizePedagogicalMetaPhrases(cleanSacrintText(raw));
  const cleanSources = sources.filter((source): source is string => Boolean(source));
  if (!text || cleanSources.length === 0) return text;
  const rewritten = preventSixGramTheoryOverlap(text, cleanSources);
  if (sixGramOverlapRatio(rewritten, cleanSources) <= maxRatio) return rewritten;

  const sentences = splitSpanishSentences(rewritten);
  // La tarea central es irrenunciable: si se elimina, la diapositiva deja de
  // explicar qué debe hacer el alumno. Se conserva aunque comparta terminología.
  const essentialTask = sentences.find(
    (sentence) =>
      sentence.trim().length >= 24 &&
      !hasDanglingEnding(sentence) &&
      (/\?/.test(sentence) ||
        /\b(?:calcula|determina|encuentra|halla|resuelve|modela|plantea|formula|indica|escribe|obt[eé]n|verifica|comprueba|justifica|identifica|estima|precisa|audita|revisa|aplica)\b/i.test(
          sentence
        ))
  );
  if (role === 'problem') {
    if (!essentialTask || !/\d|\$|pesos|m\b|cm\b/i.test(essentialTask)) return rewritten;
    if (essentialTask.length > 140 || sixGramOverlapRatio(essentialTask, cleanSources) > maxRatio) {
      const compactedTask = fitPedagogicalText(essentialTask, {
        maxChars: 140,
        maxWords: 20,
        role: 'problem',
      });
      if (
        compactedTask &&
        compactedTask.length >= 24 &&
        !hasDanglingEnding(compactedTask) &&
        sixGramOverlapRatio(compactedTask, cleanSources) <= maxRatio
      ) {
        return compactedTask;
      }
    }
    return essentialTask;
  }

  const kept = sentences.filter(
    (sentence) => sentence.trim().length >= 18 && sixGramOverlapRatio(sentence, cleanSources) <= maxRatio
  );
  if (kept.length > 0) {
    const firstKept = kept[0]!;
    if (role === 'concept' && firstKept !== sentences[0] && ANAPHORIC_SENTENCE_START_RE.test(firstKept)) {
      return rewritten;
    }
    const joined = kept.join(' ').trim();
    if (sixGramOverlapRatio(joined, cleanSources) <= maxRatio) return joined;
  }

  return rewritten;
}

const SIX_GRAM_SOURCE_CACHE_LIMIT = 2048;
const SIX_GRAM_UNION_CACHE_LIMIT = 128;
const sixGramSourceIds = new Map<string, number>();
const sixGramSourceCache = new Map<number, Set<string>>();
const sixGramUnionCache = new Map<string, Set<string>>();

function normalizeSixGramText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeSixGrams(value: string): Set<string> {
  const tokens = normalizeSixGramText(value).split(' ');
  const grams = new Set<string>();
  for (let i = 0; i <= tokens.length - 6; i++) {
    grams.add(tokens.slice(i, i + 6).join(' '));
  }
  return grams;
}

function sourceSixGramId(source: string): number {
  const cached = sixGramSourceIds.get(source);
  if (cached !== undefined) return cached;
  if (sixGramSourceIds.size >= SIX_GRAM_SOURCE_CACHE_LIMIT) {
    sixGramSourceIds.clear();
    sixGramSourceCache.clear();
    sixGramUnionCache.clear();
  }
  const id = sixGramSourceIds.size + 1;
  sixGramSourceIds.set(source, id);
  sixGramSourceCache.set(id, makeSixGrams(source));
  return id;
}

const EMPTY_SIX_GRAM_SET = new Set<string>();
const sixGramArrayRefCache = new WeakMap<
  ReadonlyArray<string | null | undefined>,
  { len: number; grams: Set<string> }
>();

function resolveSourceSixGrams(sources: ReadonlyArray<string | null | undefined>): Set<string> {
  if (sources.length === 0) return EMPTY_SIX_GRAM_SET;
  const cached = sixGramArrayRefCache.get(sources);
  if (cached && cached.len === sources.length) return cached.grams;
  const sourceIds = [
    ...new Set(
      sources
        .filter((source): source is string => typeof source === 'string' && source.trim().length > 0)
        .map(sourceSixGramId)
    ),
  ].sort((a, b) => a - b);
  if (sourceIds.length === 0) {
    sixGramArrayRefCache.set(sources, { len: sources.length, grams: EMPTY_SIX_GRAM_SET });
    return EMPTY_SIX_GRAM_SET;
  }
  const unionKey = sourceIds.join(',');
  let sourceGrams = sixGramUnionCache.get(unionKey);
  if (!sourceGrams) {
    sourceGrams = new Set<string>();
    for (const id of sourceIds) {
      for (const gram of sixGramSourceCache.get(id) ?? []) sourceGrams.add(gram);
    }
    if (sixGramUnionCache.size >= SIX_GRAM_UNION_CACHE_LIMIT) {
      sixGramUnionCache.clear();
    }
    sixGramUnionCache.set(unionKey, sourceGrams);
  }
  sixGramArrayRefCache.set(sources, { len: sources.length, grams: sourceGrams });
  return sourceGrams;
}

function ratioAgainstSixGrams(text: string, sourceGrams: Set<string>): number {
  if (sourceGrams.size === 0) return 0;
  const textGrams = makeSixGrams(text);
  if (textGrams.size === 0) return 0;
  let overlap = 0;
  for (const gram of textGrams) {
    if (sourceGrams.has(gram)) overlap++;
  }
  return overlap / textGrams.size;
}

export function sixGramOverlapRatio(text: string, sources: string[]): number {
  if (sources.length === 0) return 0;
  return ratioAgainstSixGrams(text, resolveSourceSixGrams(sources));
}

