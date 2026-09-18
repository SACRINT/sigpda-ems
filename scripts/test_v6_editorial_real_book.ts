import path from "path";
import fs from "fs";
import { renderWorkbookToPdf } from "@/lib/pdf-workbook-renderer";
import { renderWorkbookToDocx } from "@/lib/docx-workbook-renderer";
import type { ActiveWorkTextbook, MissionSection } from "@/types/work-textbook";
import type { Planning } from "@/types/planning";

const misionCompleta: MissionSection = {
  missionIndex: 1,
  title: "Mision 1: Circuitos Electricos y Seguridad en el Hogar",
  coveredSessions: [1, 2],
  sessionTopic: "Electricidad residencial y seguridad electrica",
  sessionFocus: "Comprension de circuitos en serie y paralelo con aplicacion domestica",
  phenomenonHook: {
    story: "En la colonia Lomas de Angelopolis, durante el periodo de lluvias, la familia Reyes noto que al encender el microondas y la estufa electrica al mismo tiempo, el interruptor termomagnetico se disparaba. El tecnico explico que la instalacion tenia capacidad de 20 amperios por circuito y que la suma de las potencias superaba ese limite. Esta situacion, comun en hogares de Puebla, ilustra los conceptos de circuitos electricos: corriente, voltaje, resistencia y potencia.",
    detonatingQuestion: "Por que conectar demasiados aparatos electricos al mismo tiempo puede provocar que se vaya la luz en una casa, y como podria resolverse de forma segura para una familia de escasos recursos?",
  },
  conceptZero: {
    physicalAnalogy: "Imagina que la instalacion electrica es como una tuberia de agua: el voltaje es la presion del agua, la corriente electrica es el caudal, y la resistencia es el ancho de la tuberia. Cuando conectas muchos aparatos, es como abrir muchas llaves y el sistema se satura.",
    coreExplanation: "La electricidad es el flujo ordenado de electrones. Los parametros fundamentales son: voltaje (V) en Voltios, corriente (I) en Amperios, y resistencia (R) en Ohmios. La Ley de Ohm: V = I x R. En circuito en serie la corriente es igual en todos. En paralelo el voltaje es igual pero la corriente se divide.",
    narrativeExplanation: "En Mexico el voltaje residencial estandar es 127 V. Cada circuito derivado esta protegido por interruptor termomagnetico (10, 15 o 20 A). La potencia electrica P = V x I en Watts. Estos conceptos permiten calcular si la instalacion soporta los electrodomesticos y planificar el consumo con impacto en seguridad y economia.",
    solvedExample: {
      problemStatement: "El circuito de la cocina tiene capacidad de 20 A a 127 V. Microondas: 1200 W. Estufa: 1500 W. Pueden funcionar juntos?",
      solutionSteps: [
        "Corriente del microondas: I1 = 1200 / 127 = 9.45 A",
        "Corriente de la estufa: I2 = 1500 / 127 = 11.81 A",
        "Corriente total: I_total = 9.45 + 11.81 = 21.26 A",
        "Comparar: 21.26 A > 20 A -- el interruptor se dispara",
      ],
      interpretation: "La corriente total supera la capacidad del interruptor. Solucion: conectar la estufa a otro circuito o usar aparatos de menor potencia.",
    },
    contrastTable: [
      {
        correctConcept: "El interruptor se dispara por exceso de corriente (sobreintensidad)",
        commonMisconception: "Se fue la luz porque el voltaje es insuficiente",
        reasoning: "El voltaje domiciliario es fijo (127 V). El problema es siempre exceso de corriente.",
      },
    ],
  },
  iDoSection: {
    stepByStepDemo: "1. Desconecta el circuito y verifica con multimetro que no hay tension (NOM-001-SEDE-2012). Usa guantes dielectricos.\n2. Conecta dos resistencias (R1=100 Ohm, R2=220 Ohm) en serie con fuente de 9V.\n3. Mide el voltaje en cada resistencia.\n4. Mide la corriente total con amperimetro en serie.\n5. Reconfigura en paralelo y mide corriente en cada rama.\n6. Compara con Ley de Ohm.",
  },
  weDoSection: {
    guidedPractice: "En equipo de 3 personas, disenen el plan electrico de una habitacion. Identifiquen: aparatos y potencia en Watts, tipo de circuito, corriente total, calibre del interruptor necesario.",
    workbookElements: [
      { type: "data_table", label: "Tabla: Aparatos y Potencias", rows: 4, columns: ["Aparato", "Potencia (W)", "Corriente (A)", "Observaciones"] },
    ],
  },
  youDoSection: {
    autonomousChallenge: "Reto de Vida Real: Identifica todos los aparatos electricos de una habitacion de tu casa. Calcula: corriente de cada aparato a 127 V, corriente total si todos estan encendidos, seguridad de la configuracion. Presenta un reporte escrito.",
    workbookElements: [],
  },
  troubleshooting: [
    {
      symptom: "El interruptor se dispara frecuentemente",
      rootCause: "Sobreintensidad por exceso de aparatos en el mismo circuito",
      solutionSteps: ["Desconectar aparatos", "Calcular corriente total", "Redistribuir carga", "Consultar electricista certificado"],
      preventionTip: "Nunca superar el 80% de la capacidad nominal del interruptor (NOM-001)",
    },
  ],
  formativeCheckpoint: {
    question: "Como explicarias a un familiar la diferencia entre voltaje y corriente usando una analogia cotidiana?",
    reflectionPrompts: ["En que momento del dia tu hogar consume mas energia? Como podrias reducirlo?"],
    criteriaChecklist: [
      "Calculo correctamente la corriente de al menos 3 aparatos electricos",
      "Explico que ocurre cuando se supera la capacidad del interruptor",
      "Identifico 2 medidas de seguridad electrica para mi hogar",
    ],
  },
  wordCount: 1100,
  diagnosticEvaluation: {
    context: "Reflexiona sobre tu experiencia con la electricidad en tu vida cotidiana antes de comenzar.",
    questions: [
      "Has visto que se va la luz solo en un cuarto? Que crees que causo eso?",
      "Sabes para que sirve ese cajon con palancas que hay en las casas (tablero electrico)?",
      "Si un aparato dice 1200 W en su etiqueta, que crees que significa ese numero?",
    ],
  },
  realLifeConnection: {
    context: "La electricidad esta en cada rincon de tu hogar. Entender como funciona te da poder para ahorrar dinero y proteger tu familia.",
    householdApplication: "Esta semana revisa el recibo de luz de tu hogar. Mide la potencia de 3 aparatos que usas frecuentemente y calcula cuantas horas de uso acumulan 1 kWh.",
    communityImpact: "Con estos conocimientos puedes ayudar a vecinos a diagnosticar por que se dispara su interruptor y proponer soluciones seguras.",
  },
  metacognitiveTrafficLight: {
    green: "Comprendo la Ley de Ohm y calculo voltaje, corriente y potencia. Disene circuitos simples y verifique la seguridad en un caso real.",
    yellow: "Entiendo la diferencia entre serie y paralelo pero necesito mas practica para calcular con confianza.",
    red: "Tengo dudas sobre voltaje o corriente. Necesito revision del Concepto Cero y asesoria del docente.",
  },
  safetyOrWorkshopTip: "SEGURIDAD OBLIGATORIA: Nunca trabajes con circuitos de 127 V sin supervision. En practicas escolares usa fuentes de maximo 12 V DC. Si observas chispas o calor anormal, desconecta inmediatamente (NOM-001-SEDE-2012).",
};

const misionMinima: MissionSection = {
  missionIndex: 2,
  title: "Mision 2: Fundamentos del Magnetismo y Electroimanes",
  coveredSessions: [3, 4],
  sessionTopic: "Magnetismo e induccion electromagnetica",
  sessionFocus: "Comprender el campo magnetico y sus aplicaciones tecnologicas cotidianas",
  phenomenonHook: {
    story: "En la Preparatoria Benito Juarez de Tehuacan, una estudiante demostro como un clavo enrollado con cable conductor y conectado a una pila levantaba clips metalicos. El mismo clavo sin pila no atraia nada. Este fenomeno es la base del electromagnetismo que hace funcionar motores, generadores y cientos de dispositivos cotidianos.",
    detonatingQuestion: "Por que un clavo se convierte en iman cuando pasa corriente por el cable que lo rodea, y pierde esa capacidad al desconectar la pila?",
  },
  conceptZero: {
    physicalAnalogy: "Cada electron en movimiento lleva un pequeno escudo magnetico invisible. Cuando viajan ordenados (corriente electrica), sus escudos se alinean y crean un campo magnetico colectivo. Es como personas en manifestacion levantando letreros en la misma direccion.",
    coreExplanation: "El magnetismo es una de las cuatro fuerzas fundamentales. Los materiales magneticos tienen dominios donde los momentos magneticos estan alineados. Un campo externo o corriente electrica alinea esos dominios, produciendo efecto magnetico observable. La relacion electricidad-magnetismo fue descubierta por Orsted en 1820: una corriente siempre genera campo magnetico circular (electromagnetismo). La Regla de la Mano Derecha: pulgar en direccion de corriente, dedos curvados dan el sentido del campo.",
  },
  iDoSection: {
    stepByStepDemo: "1. Enrolla 30 vueltas de cable de cobre calibre 22 alrededor de un clavo de 10 cm.\n2. Conecta los extremos a una pila de 9V.\n3. Acerca el electroiman a clips metalicos y cuenta cuantos levanta.\n4. Desconecta la pila y observa.\n5. Duplica las vueltas a 60 y repite. Cambia la capacidad de atraccion?",
  },
  weDoSection: {
    guidedPractice: "En parejas investiguen como funciona el altavoz de un celular. Identifiquen donde interviene el electromagnetismo. Elaboren un diagrama con: iman permanente, bobina de voz, membrana y senal electrica.",
    workbookElements: [],
  },
  youDoSection: {
    autonomousChallenge: "Disena y construye un electroiman con materiales de tu hogar. Prueba cuantos clips levanta variando: numero de vueltas, voltaje (6V vs 9V), tipo de nucleo. Presenta tus hallazgos con tabla comparativa.",
    workbookElements: [],
  },
  troubleshooting: [
    {
      symptom: "El electroiman no atrae objetos",
      rootCause: "Circuito abierto: cable no conectado correctamente o bateria agotada",
      solutionSteps: ["Verificar continuidad con multimetro", "Reemplazar pila si voltaje menor a 7V", "Lijar extremos del cable para quitar esmalte"],
      preventionTip: "Antes de enrollar el cable, verifica continuidad electrica en ambos extremos.",
    },
  ],
  formativeCheckpoint: {
    question: "Que cambios harias al electroiman para que sea mas potente? Argumenta usando conceptos aprendidos.",
    reflectionPrompts: ["En que aparatos cotidianos que usas diariamente interviene el electromagnetismo?"],
    criteriaChecklist: [
      "Construyo un electroiman funcional con materiales simples",
      "Explico por que aumentar el numero de vueltas incrementa la potencia",
      "Identifico 3 aplicaciones cotidianas del electromagnetismo",
    ],
  },
  wordCount: 750,
};

const testWorkbook: ActiveWorkTextbook = {
  blockName: "Bloque 2: Electricidad y Magnetismo en la Vida Cotidiana",
  blockIndex: 2,
  subsystem: "BGE",
  coverData: {
    title: "Electricidad, Magnetismo y Sociedad",
    subtitle: "Cuaderno de Aprendizaje Activo NEM 2026-2027",
    schoolName: "Bachillerato General Oficial Lazaro Cardenas",
    cct: "21ECT0017T",
    subjectName: "Fisica II",
    semester: "Tercer Semestre",
    teacherName: "Ing. Maria de los Angeles Soto Reyes",
    paecProjectName: "Diagnostico Energetico Comunitario en Tehuacan",
  },
  missions: [misionCompleta, misionMinima],
  projectSection: {
    communityUtility: "Reduccion de accidentes electricos en hogares vulnerables de Tehuacan, Puebla.",
    artifactName: "Guia de Auditoria Energetica Domiciliaria",
    phases: [],
  },
  evaluationSection: {
    source: "generated_fresh",
    rubric: [
      {
        criterion: "Dominio Conceptual: Ley de Ohm y Circuitos",
        weightPercent: 40,
        levels: [
          { levelName: "Excelente", points: 10, descriptor: "Aplica Ley de Ohm con precision en contextos reales y disena circuitos seguros de manera autonoma." },
          { levelName: "Bueno", points: 8, descriptor: "Calcula voltaje, corriente y potencia con minimos errores de procedimiento." },
          { levelName: "Suficiente", points: 6, descriptor: "Comprende conceptos basicos pero comete errores sistematicos en los calculos." },
          { levelName: "Requiere Apoyo", points: 4, descriptor: "Confunde voltaje con corriente y no puede aplicar la Ley de Ohm." },
        ],
      },
      {
        criterion: "Aplicacion Practica y Seguridad Electrica",
        weightPercent: 35,
        levels: [
          { levelName: "Excelente", points: 10, descriptor: "Construye y verifica circuitos respetando todas las normas NOM-001 de forma autonoma." },
          { levelName: "Bueno", points: 8, descriptor: "Sigue los protocolos de seguridad con minima supervision y obtiene mediciones precisas." },
          { levelName: "Suficiente", points: 6, descriptor: "Requiere recordatorio para aplicar medidas de seguridad basicas." },
          { levelName: "Requiere Apoyo", points: 4, descriptor: "No aplica medidas de seguridad; pone en riesgo el equipo durante la practica." },
        ],
      },
      {
        criterion: "Vinculacion Comunitaria (PAEC): Auditoria Energetica",
        weightPercent: 25,
        levels: [
          { levelName: "Excelente", points: 10, descriptor: "Presenta auditoria energetica completa con datos reales del hogar y propuestas de mejora fundamentadas." },
          { levelName: "Bueno", points: 8, descriptor: "Presenta auditoria con datos reales pero con propuestas de mejora limitadas." },
          { levelName: "Suficiente", points: 6, descriptor: "Presenta auditoria parcial con algunos datos reales." },
          { levelName: "Requiere Apoyo", points: 4, descriptor: "No entrego la auditoria o los datos no son reales." },
        ],
      },
    ],
    checklistItems: [
      "Entrego auditoria energetica con datos reales",
      "Construyo el electroiman y documento resultados comparativos",
      "Participo en diseno de circuito en equipo",
    ],
    tieredExercises: [],
  },
};

const testPlanning = {
  id: "test-v6-001",
  uacName: "Fisica II",
  paecContext: "Diagnostico energetico y seguridad electrica comunitaria en Tehuacan, Puebla",
  contentJson: {
    sectionI: { schoolName: "Bachillerato General Oficial Lazaro Cardenas", cct: "21ECT0017T", teacherName: "Ing. Maria de los Angeles Soto Reyes", subsystem: "BGE" },
    sectionII: { paecConnection: "Vinculacion con diagnostico energetico comunitario PAEC" },
  },
} as unknown as Planning;

async function runV6Test() {
  console.log("\nSIGPDA-EMS - TEST V6 - Maquetacion Editorial con Sidebar\n");
  const outputDir = path.resolve("scripts/output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log("Generando PDF con layout V6 (2 columnas + sidebar)...");
  try {
    const pdfBuffer = await renderWorkbookToPdf(testWorkbook, testPlanning, { forceFallbackCover: true });
    const pdfPath = path.join(outputDir, "v6_editorial_real_book.pdf");
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log("OK PDF: " + pdfPath + " | " + Math.round(fs.statSync(pdfPath).size / 1024) + " KB");
  } catch (err) { console.error("ERROR PDF:", err); }

  console.log("Generando DOCX...");
  try {
    const docxBuffer = await renderWorkbookToDocx(testWorkbook, testPlanning);
    const docxPath = path.join(outputDir, "v6_editorial_real_book.docx");
    fs.writeFileSync(docxPath, docxBuffer);
    console.log("OK DOCX: " + docxPath + " | " + Math.round(fs.statSync(docxPath).size / 1024) + " KB");
  } catch (err) { console.error("ERROR DOCX:", err); }

  console.log("\nVerificar visualmente:");
  console.log("  [1] Banner editorial con numero 01 / 02 grande");
  console.log("  [2] Sidebar visible a la derecha (28% del ancho)");
  console.log("  [3] Sidebar con Glosario, Vida Real, Pista de Seguridad, QR");
  console.log("  [4] Evaluacion Diagnostica al inicio de M1 y M2");
  console.log("  [5] Semaforo metacognitivo al cierre de cada mision");
  console.log("  [6] M2 (minima): extraccion automatica sin errores");
}

runV6Test().catch((err) => { console.error("ERROR inesperado:", err); process.exit(1); });