import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import { createDecipheriv } from 'crypto';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageBreak, Header, Footer, PageNumber
} from 'docx';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
const encMatch = envContent.match(/ADMIN_ENCRYPTION_KEY=['"]?([^'"\r\n]+)['"]?/);

if (!match || !encMatch) {
  console.error('Configuraciones faltantes en .env.local');
  process.exit(1);
}

const sql = neon(match[1]);
const encKeyStr = encMatch[1];

function decryptKey(encrypted) {
  const encKey = Buffer.from(encKeyStr);
  const [ivHex, data] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', encKey, iv);
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function getActiveGeminiKey() {
  const keys = await sql`
    SELECT label, key_encrypted FROM api_keys 
    WHERE provider = 'gemini' AND is_active = true 
    ORDER BY priority ASC
  `;
  for (const k of keys) {
    try {
      const dec = decryptKey(k.key_encrypted);
      const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${dec}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'OK' }] }] })
      });
      if (testRes.ok) {
        console.log(`✓ Usando llave activa del pool: ${k.label}`);
        return { key: dec, model: 'gemini-3.5-flash-lite' };
      }
      const testRes2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${dec}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'OK' }] }] })
      });
      if (testRes2.ok) {
        console.log(`✓ Usando llave activa del pool: ${k.label} con gemini-3.1-flash-lite`);
        return { key: dec, model: 'gemini-3.1-flash-lite' };
      }
    } catch (e) {
      // continuar
    }
  }
  throw new Error('No se encontró ninguna llave funcional de Gemini en el pool');
}

// ── Palette DBEPA ─────────────────────────────────────────────────────────────
const C = {
  dark:   '1A3A5C',
  mid:    '2E6DA4',
  light:  'D6E4F0',
  alt:    'EBF3FA',
  accent: 'E8A020',
  white:  'FFFFFF',
  gray:   'F0F4F8',
  text:   '1A1A1A',
};
const PAGE_W = 12240;
const MARGIN = 720;
const CONTENT = PAGE_W - MARGIN * 2;

function bdr(color = 'AAAAAA') {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
}
const CELLMRG = { top: 80, bottom: 80, left: 140, right: 140 };

function tc(text, opts = {}) {
  const { w, span = 1, bold = false, fill = C.white, color = C.text,
    size = 18, align = AlignmentType.LEFT, valign = VerticalAlign.CENTER,
    italics = false } = opts;

  return new TableCell({
    columnSpan: span,
    width: w ? { size: w, type: WidthType.DXA } : undefined,
    shading: { fill, type: ShadingType.CLEAR },
    borders: bdr(),
    margins: CELLMRG,
    verticalAlign: valign,
    children: [new Paragraph({
      alignment: align,
      spacing: { before: 50, after: 50 },
      children: [new TextRun({ text: String(text || ''), bold, italics, size, color, font: 'Arial' })],
    })],
  });
}

function secHeading(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 180, after: 60 },
    children: [
      new TextRun({ text, bold: true, size: 22, color: C.dark, font: 'Arial' }),
    ],
  });
}

function sp() {
  return new Paragraph({ spacing: { before: 100, after: 100 }, children: [] });
}

function pb() {
  return new Paragraph({ children: [new PageBreak()] });
}

function buildDocx(content) {
  const s1 = content.sectionI;
  const s2 = content.sectionII;
  const s3 = content.sectionIII;
  const s4 = content.sectionIV;
  const s5 = content.sectionV;
  const s6 = content.sectionVI;
  const s7 = content.sectionVII;

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: 15840 },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            spacing: { before: 0, after: 60 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 1 } },
            children: [new TextRun({ text: `DBEPA Puebla 2026-2027 | ${s1.uacName} | ${s1.semester}° Semestre`, size: 14, color: '777777', font: 'Arial' })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 1 } },
            spacing: { before: 60 },
            children: [
              new TextRun({ text: 'Página ', size: 14, color: '777777', font: 'Arial' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '777777', font: 'Arial' }),
              new TextRun({ text: ' de ', size: 14, color: '777777', font: 'Arial' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '777777', font: 'Arial' }),
              new TextRun({ text: ' | NEM · MCCEMS · Lineamientos DBEPA 2026-2027', size: 14, color: '777777', font: 'Arial' }),
            ],
          })],
        }),
      },
      children: [
        // Portada institucional
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 60 },
          children: [new TextRun({ text: 'GOBIERNO DEL ESTADO DE PUEBLA · SECRETARÍA DE EDUCACIÓN', bold: true, size: 20, color: C.dark, font: 'Arial' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 120 },
          children: [new TextRun({ text: 'SUBSECRETARÍA DE EDUCACIÓN MEDIA SUPERIOR · DBEPA', bold: true, size: 18, color: C.mid, font: 'Arial' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 200 },
          children: [new TextRun({ text: 'PLANEACIÓN DIDÁCTICA OFICIAL', bold: true, size: 32, color: C.dark, font: 'Arial' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 150 },
          children: [new TextRun({ text: `${s1.uacName} · ${s1.semester}° SEMESTRE · CICLO ESCOLAR 2026-2027`, bold: true, size: 22, color: C.accent, font: 'Arial' })],
        }),
        sp(),

        // SECCIÓN I
        secHeading('SECCIÓN I — DATOS GENERALES Y ADMINISTRATIVOS'),
        new Table({
          width: { size: CONTENT, type: WidthType.DXA },
          rows: [
            new TableRow({ children: [tc('Docente:', { w: 2000, bold: true, fill: C.alt }), tc(s1.teacherName || 'Docente', { w: 4000 }), tc('Ciclo escolar:', { w: 2000, bold: true, fill: C.alt }), tc(s1.schoolYear || '2026-2027', { w: 2800 })] }),
            new TableRow({ children: [tc('UAC:', { bold: true, fill: C.alt }), tc(s1.uacName), tc('Semestre / Grupos:', { bold: true, fill: C.alt }), tc(`${s1.semester}° Semestre · ${s1.groups || 'A'}`)] }),
            new TableRow({ children: [tc('Componente:', { bold: true, fill: C.alt }), tc(s1.component), tc('Carga horaria:', { bold: true, fill: C.alt }), tc(`${s1.totalHours} horas (${s1.estimatedSessions || '4 h/sem'})`)] }),
            new TableRow({ children: [tc('Subsistema:', { bold: true, fill: C.alt }), tc(s1.subsystem, { span: 3 })] }),
          ]
        }),
        sp(),

        // SECCIÓN II
        secHeading('SECCIÓN II — INTENCIONALIDAD FORMATIVA Y DOSIFICACIÓN'),
        new Table({
          width: { size: CONTENT, type: WidthType.DXA },
          rows: [
            new TableRow({ children: [tc('Propósito General de la UAC:', { bold: true, fill: C.mid, color: C.white, span: 4 })] }),
            new TableRow({ children: [tc(s2.generalPurpose || '', { span: 4 })] }),
            new TableRow({ children: [tc('Vinculación con el PAEC:', { bold: true, fill: C.alt, span: 4 })] }),
            new TableRow({ children: [tc(s2.paecArticulation || '', { span: 4 })] }),
          ]
        }),
        sp(),
        new Table({
          width: { size: CONTENT, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: [
                tc('Corte', { w: 1200, bold: true, fill: C.dark, color: C.white, align: AlignmentType.CENTER }),
                tc('Propósito Formativo / Actividad', { w: 5600, bold: true, fill: C.dark, color: C.white }),
                tc('Horas', { w: 1000, bold: true, fill: C.dark, color: C.white, align: AlignmentType.CENTER }),
                tc('Resultado de Aprendizaje', { w: 3000, bold: true, fill: C.dark, color: C.white }),
              ]
            }),
            ...(s2.keyActivities || []).map((act, i) => new TableRow({
              children: [
                tc(act.corte || `Corte ${Math.min(3, Math.floor(i / 2) + 1)}`, { align: AlignmentType.CENTER, bold: true, fill: C.alt }),
                tc(act.name, { bold: true }),
                tc(`${act.hours} h`, { align: AlignmentType.CENTER }),
                tc(act.learningOutcome || ''),
              ]
            }))
          ]
        }),
        pb(),

        // SECCIÓN III
        secHeading('SECCIÓN III — TRANSVERSALIDAD CURRICULAR'),
        new Table({
          width: { size: CONTENT, type: WidthType.DXA },
          rows: [
            new TableRow({ children: [tc('Área Curricular', { w: 3500, bold: true, fill: C.dark, color: C.white }), tc('Articulación y Aplicación Contextualizada', { w: 7300, bold: true, fill: C.dark, color: C.white })] }),
            ...(s3.fundamentalCurriculum || []).map(f => new TableRow({
              children: [tc(f.area, { bold: true, fill: C.alt }), tc(f.description)]
            })),
            ...(s3.expandedCurriculum || []).map(e => new TableRow({
              children: [tc(e.area, { bold: true, fill: C.gray }), tc(e.description)]
            })),
          ]
        }),
        pb(),

        // SECCIÓN IV
        secHeading('SECCIÓN IV — SECUENCIA DIDÁCTICA POR PROPÓSITOS FORMATIVOS'),
        ...(s4.activities || []).map((sec, idx) => {
          return new Table({
            width: { size: CONTENT, type: WidthType.DXA },
            rows: [
              new TableRow({ children: [tc(`PROPÓSITO FORMATIVO ${idx + 1}: ${sec.name} (${sec.hours} Horas)`, { bold: true, fill: C.mid, color: C.white, span: 4 })] }),
              new TableRow({ children: [tc('Contenido Temático:', { bold: true, fill: C.alt }), tc(sec.contenidoFormativo || 'Sistemas de Ecuaciones y Modelación Algebraica', { span: 3 })] }),
              new TableRow({ children: [tc('Metodología Activa:', { bold: true, fill: C.alt }), tc(sec.metodologia || 'Aprendizaje Basado en Proyectos (ABP)', { span: 3, bold: true, color: C.dark })] }),
              new TableRow({ children: [tc('Fase', { w: 1800, bold: true, fill: C.dark, color: C.white, align: AlignmentType.CENTER }), tc('Procesos y Actividades de Aprendizaje', { w: 5500, bold: true, fill: C.dark, color: C.white }), tc('Materiales y Recursos', { w: 2000, bold: true, fill: C.dark, color: C.white }), tc('Evidencias y Productos', { w: 1500, bold: true, fill: C.dark, color: C.white })] }),
              new TableRow({ children: [tc('Apertura', { bold: true, align: AlignmentType.CENTER, fill: C.alt }), tc(sec.apertura?.processes || ''), tc(sec.apertura?.materials || ''), tc(sec.apertura?.evidence || 'Diagnóstico previo')] }),
              new TableRow({ children: [tc('Desarrollo', { bold: true, align: AlignmentType.CENTER, fill: C.alt }), tc(sec.desarrollo?.processes || ''), tc(sec.desarrollo?.materials || ''), tc(sec.desarrollo?.evidence || 'Ejercicios y modelación')] }),
              new TableRow({ children: [tc('Cierre', { bold: true, align: AlignmentType.CENTER, fill: C.alt }), tc(sec.cierre?.processes || ''), tc(sec.cierre?.materials || ''), tc(sec.cierre?.evidence || 'Producto integrador')] }),
            ]
          });
        }),
        pb(),

        // SECCIÓN V
        secHeading('SECCIÓN V — EVALUACIÓN FORMATIVA'),
        new Table({
          width: { size: CONTENT, type: WidthType.DXA },
          rows: [
            new TableRow({ children: [tc('Tipo', { w: 1800, bold: true, fill: C.dark, color: C.white }), tc('Momento', { w: 2000, bold: true, fill: C.dark, color: C.white }), tc('Agente', { w: 1800, bold: true, fill: C.dark, color: C.white }), tc('Instrumento / Evidencia', { w: 5200, bold: true, fill: C.dark, color: C.white })] }),
            ...(s5.evaluations || []).map(ev => new TableRow({
              children: [tc(ev.type, { bold: true, fill: C.alt }), tc(ev.moment), tc(ev.agent), tc(ev.evidence)]
            }))
          ]
        }),
        sp(),

        // SECCIÓN VI & VII
        secHeading('SECCIÓN VI — RECURSOS Y FUENTES DE CONSULTA'),
        new Paragraph({ children: [new TextRun({ text: 'Bibliografía básica y recursos digitales recomendados:', bold: true, size: 18, color: C.dark, font: 'Arial' })] }),
        ...(s6.resources || []).map(r => new Paragraph({ children: [new TextRun({ text: `• ${r.title} — ${r.type}`, size: 18, font: 'Arial' })] })),
        sp(),
        secHeading('SECCIÓN VII — FIRMAS DE VALIDACIÓN'),
        new Table({
          width: { size: CONTENT, type: WidthType.DXA },
          rows: [
            new TableRow({ children: [tc('ELABORÓ\n\n\n_______________________________\n' + (s1.teacherName || 'Docente Titular'), { w: 5400, align: AlignmentType.CENTER, bold: true }), tc('REVISÓ Y AUTORIZÓ\n\n\n_______________________________\nDirector(a) / Subdirector(a) Académico(a)', { w: 5400, align: AlignmentType.CENTER, bold: true })] })
          ]
        })
      ]
    }]
  });

  return Packer.toBuffer(doc);
}

async function run() {
  console.log('===============================================================');
  console.log('REGENERACIÓN AUTÉNTICA DE PLANEACIÓN: PENSAMIENTO MATEMÁTICO III');
  console.log('Docente Nemesio / Bachillerato General · Semestre 3');
  console.log('===============================================================\n');

  // 1. Obtener programa oficial de programs_catalog
  console.log('1. Consultando programa canónico en programs_catalog...');
  const rows = await sql`
    SELECT id, uac_name, semester, subsystem, total_hours, learning_outcome, activities, contenidos_formativos
    FROM programs_catalog
    WHERE uac_name ILIKE '%Pensamiento Matemático III%' AND semester = 3 AND subsystem = 'bge'
    LIMIT 1;
  `;

  if (rows.length === 0) {
    throw new Error('Programa canónico Pensamiento Matemático III no encontrado en DB');
  }

  const prog = rows[0];
  console.log(`✓ Programa oficial: ${prog.uac_name} (${prog.total_hours} hrs, ${prog.activities.length} propósitos formativos)`);
  prog.activities.forEach(a => console.log(`  - PF ${a.order}: ${a.name}`));

  // 2. Obtener planning existente
  const plannings = await sql`
    SELECT id, teacher_id, uac_name, semester, component, paec_context, extracted_data, content_json
    FROM plannings
    WHERE id = '8e7f29af-f124-4c99-b4bc-388ebc430309'::uuid;
  `;

  const planning = plannings[0];
  console.log(`\n2. Planeación a regenerar: ID ${planning.id} (UAC: ${planning.uac_name})`);

  // 3. Preparar prompt para Gemini
  const { key, model } = await getActiveGeminiKey();

  const prompt = `Eres un diseñador curricular experto en la Nueva Escuela Mexicana y MCCEMS de Puebla (DBEPA 2026-2027).
Genera una planeación didáctica completa en formato JSON exacto para la siguiente UAC auténtica oficial:

DATOS CURRICULARES OFICIALES OBLIGATORIOS:
- UAC: Pensamiento Matemático III
- Semestre: 3er Semestre
- Componente: Currículum Fundamental
- Carga horaria total: 72 horas (4 horas semanales, 18 semanas de clase, 24 horas por Corte de evaluación)
- Subsistema: Bachillerato General Estatal (BGE)
- Docente: BGE Nemesio 23
- Escuela: Bachillerato General Estatal Nemesio
- Ciclo Escolar: 2026-2027
- PAEC: Proyecto Comunitario de Educación Financiera y Optimización de Recursos en la Comunidad

LOS 6 PROPÓSITOS FORMATIVOS OFICIALES DE LA SEP (OBLIGATORIO: DEBES USAR EXACTAMENTE ESTOS 6 Y NINGÚN OTRO):
1. Aplica la aritmética y el manejo del álgebra para encontrar el valor de una incógnita, reconociendo el significado de una variable y de un parámetro.
2. Aplica la aritmética y el manejo del álgebra para resolver ecuaciones lineales, formulando modelos que expresan relaciones de causa-efecto o de equivalencia.
3. Aplica la aritmética, el manejo del álgebra y el método gráfico para resolver sistemas de ecuaciones lineales de dos incógnitas, modelando situaciones problemáticas con dos restricciones simultáneas.
4. Aplica la aritmética y el manejo del álgebra para resolver ecuaciones cuadráticas y determinar sus raíces mediante factorización, fórmula general (Bhaskara) y completación de cuadrados.
5. Expresa y resuelve diversas situaciones de interés a través de distintos tipos de ecuaciones (lineales, sistemas 2x2, cuadráticas) aplicadas a problemas financieros y de optimización cotidiana.
6. Revisa el teorema del triángulo de Napoleón, considerándolo como un problema-meta que integra la geometría analítica básica y la modelación algebraica.

REGLA CRÍTICA: QUEDA ESTRICTAMENTE PROHIBIDO INCLUIR TRIGONOMETRÍA O GEOMETRÍA PLANA BÁSICA (ESO PERTENECE A OTROS PROGRAMAS O MOCKS VIEJOS). EL FOCO ES ÁLGEBRA, ECUACIONES LINEALES, SISTEMAS DE ECUACIONES 2x2 Y ECUACIONES CUADRÁTICAS.

Responde ÚNICAMENTE con el siguiente objeto JSON válido, sin bloques de código ni texto adicional:

{
  "sectionI": {
    "teacherName": "BGE Nemesio 23",
    "schoolName": "Bachillerato General Estatal Nemesio",
    "uacName": "Pensamiento Matemático III",
    "semester": 3,
    "groups": "3° A, B",
    "schoolYear": "2026-2027",
    "totalHours": 72,
    "component": "Currículum Fundamental",
    "subsystem": "Bachillerato General Estatal (BGE)",
    "applicationPeriod": "Ciclo Escolar 2026-2027 (Semestre A)",
    "estimatedSessions": "72 sesiones de 50 minutos (4 h/semana en 18 semanas)"
  },
  "sectionII": {
    "generalPurpose": "El estudiantado consolida y aplica el pensamiento algebraico mediante la modelación y resolución de ecuaciones lineales, sistemas de ecuaciones lineales 2x2 y ecuaciones cuadráticas, interpretando sus soluciones analíticas y gráficas para resolver problemáticas de su entorno social y del proyecto PAEC.",
    "paecArticulation": "Articulación directa con el PAEC mediante la formulación de sistemas de ecuaciones y modelos algebraicos para optimizar presupuestos, calcular costos de producción comunitaria y planear proyectos de emprendimiento escolar sostenible.",
    "keyActivities": [
      {
        "order": 1,
        "name": "Aplica la aritmética y el manejo del álgebra para encontrar el valor de una incógnita, reconociendo el significado de una variable y de un parámetro.",
        "hours": 12,
        "corte": "Corte 1",
        "learningOutcome": "Distingue entre incógnitas, variables y constantes en contextos algebraicos reales."
      },
      {
        "order": 2,
        "name": "Aplica la aritmética y el manejo del álgebra para resolver ecuaciones lineales, formulando modelos que expresan relaciones de causa-efecto o de equivalencia.",
        "hours": 12,
        "corte": "Corte 1",
        "learningOutcome": "Formula y resuelve ecuaciones lineales de primer grado para modelar situaciones de equivalencia cotidiana."
      },
      {
        "order": 3,
        "name": "Aplica la aritmética, el manejo del álgebra y el método gráfico para resolver sistemas de ecuaciones lineales de dos incógnitas, modelando situaciones problemáticas con dos restricciones simultáneas.",
        "hours": 12,
        "corte": "Corte 2",
        "learningOutcome": "Resuelve sistemas de ecuaciones 2x2 por métodos analíticos (suma/resta, sustitución, igualación) y gráfico para conciliar dos condiciones en problemas de la comunidad."
      },
      {
        "order": 4,
        "name": "Aplica la aritmética y el manejo del álgebra para resolver ecuaciones cuadráticas y determinar sus raíces mediante factorización, fórmula general y completación de cuadrados.",
        "hours": 12,
        "corte": "Corte 2",
        "learningOutcome": "Determina las raíces reales de ecuaciones cuadráticas aplicando la fórmula general (Bhaskara) y métodos algebraicos directos."
      },
      {
        "order": 5,
        "name": "Expresa y resuelve diversas situaciones de interés a través de distintos tipos de ecuaciones aplicadas a problemas financieros y de optimización cotidiana.",
        "hours": 12,
        "corte": "Corte 3",
        "learningOutcome": "Modela problemas económicos y comunitarios utilizando familias de ecuaciones algebraicas combinadas."
      },
      {
        "order": 6,
        "name": "Revisa el teorema del triángulo de Napoleón, considerándolo como un problema-meta que integra la geometría analítica básica y la modelación algebraica.",
        "hours": 12,
        "corte": "Corte 3",
        "learningOutcome": "Integra relaciones geométricas y algebraicas en la resolución del problema-meta de Napoleón."
      }
    ]
  },
  "sectionIII": {
    "fundamentalCurriculum": [
      { "area": "Lengua y Comunicación", "description": "Argumentación oral y escrita en la justificación de procedimientos matemáticos y reporte técnico de resultados." },
      { "area": "Cultura Digital", "description": "Uso de software de cálculo y graficación (GeoGebra, hojas de cálculo) para representar rectas y sistemas de ecuaciones." },
      { "area": "Ciencias Sociales", "description": "Interpretación de datos socioeconómicos locales mediante modelos lineales de costo-beneficio." },
      { "area": "Ciencias Naturales y Tecnología", "description": "Aplicación de ecuaciones en leyes de equilibrio físico y proporciones químicas." },
      { "area": "Humanidades", "description": "Reflexión ética sobre el uso responsable de la información financiera y las decisiones económicas personales." }
    ],
    "expandedCurriculum": [
      { "area": "Habilidades para la Vida y el Trabajo (HVyT)", "description": "Trabajo colaborativo, perseverancia en la resolución de problemas abstractos y pensamiento analítico." },
      { "area": "Conceptos Centrales para el Desarrollo Sostenible (CoCEDS)", "description": "Optimización del uso de recursos y fomento del consumo responsable mediante la modelación de presupuestos sustentables." }
    ]
  },
  "sectionIV": {
    "activities": [
      {
        "order": 1,
        "name": "Aplica la aritmética y el manejo del álgebra para encontrar el valor de una incógnita",
        "hours": 12,
        "contenidoFormativo": "Variables, parámetros e incógnitas en la representación simbólica",
        "metodologia": "Aprendizaje Basado en Problemas (ABP)",
        "apertura": {
          "processes": "El docente presenta una situación de balance financiero en una cooperativa escolar donde falta un dato de egreso. Mediante lluvia de ideas guiada, el estudiantado distingue entre valores conocidos y valores desconocidos.",
          "materials": "Pizarrón, calculadora, situaciones problema impresas.",
          "evidence": "Diagnóstico inicial y mapa mental de conceptos algebraicos básicos."
        },
        "desarrollo": {
          "processes": "En equipos de cuatro integrantes, los estudiantes analizan expresiones algebraicas formales, sustituyen parámetros contextuales y despejan la incógnita aplicando propiedades de igualdad en las operaciones aritméticas.",
          "materials": "Cuaderno de trabajo, hojas de cálculo simples o dispositivos móviles.",
          "evidence": "Problemario resuelto con ejercicios de despeje y justificación paso a paso."
        },
        "cierre": {
          "processes": "Plenaria grupal donde un relator de cada equipo expone el significado del valor hallado y cómo la variación de un parámetro modifica la solución del problema.",
          "materials": "Rúbrica de coevaluación de argumentación matemática.",
          "evidence": "Conclusión escrita individual sobre la diferencia entre variable y parámetro."
        }
      },
      {
        "order": 2,
        "name": "Aplica la aritmética y el manejo del álgebra para resolver ecuaciones lineales",
        "hours": 12,
        "contenidoFormativo": "Ecuaciones lineales de una variable y relaciones de equivalencia",
        "metodologia": "Aula Invertida (Flipped Classroom)",
        "apertura": {
          "processes": "Revisión previa de video tutorial sobre transposición de términos. En el aula, se inicia con un reto rápido: equilibrar una balanza digital simbólica determinando el peso desconocido de un producto.",
          "materials": "Proyector o infografía digital, reto de balanza interactiva.",
          "evidence": "Registro de hipótesis y solución rápida del reto de apertura."
        },
        "desarrollo": {
          "processes": "Resolución estructurada de ecuaciones de primer grado ax + b = c y ax + b = cx + d aplicadas a situaciones de compras compartidas, cobros de servicios y mediciones de terrenos comunitarios.",
          "materials": "Guía didáctica de ejercicios contextualizados, software GeoGebra.",
          "evidence": "Taller práctico de 10 problemas situados resueltos con comprobación aritmética."
        },
        "cierre": {
          "processes": "Demostración cruzada entre pares: cada estudiante formula una ecuación lineal basada en un gasto de su vida cotidiana para que su compañero la resuelva y verifique.",
          "materials": "Lista de cotejo para evaluación entre pares.",
          "evidence": "Problema contextualizado formulado y validado por pares."
        }
      },
      {
        "order": 3,
        "name": "Aplica la aritmética, el manejo del álgebra y el método gráfico para resolver sistemas de ecuaciones lineales de dos incógnitas",
        "hours": 12,
        "contenidoFormativo": "Sistemas de ecuaciones lineales 2x2: Métodos de sustitución, reducción, igualación y solución gráfica",
        "metodologia": "Aprendizaje Basado en Retos (Challenge-Based)",
        "apertura": {
          "processes": "Presentación del Gran Reto PAEC: determinar la cantidad exacta de dos tipos de árboles frutales que pueden plantarse en una parcela escolar conociendo el costo total y el espacio disponible (dos restricciones simultáneas).",
          "materials": "Ficha del reto PAEC con datos de costos y dimensiones de la parcela.",
          "evidence": "Planteamiento del sistema de dos ecuaciones con dos incógnitas (x, y)."
        },
        "desarrollo": {
          "processes": "Modelación y resolución del sistema empleando de forma comparativa los métodos de reducción y sustitución. Posteriormente, graficación de ambas rectas en GeoGebra para identificar el punto de intersección como la solución única (x, y).",
          "materials": "GeoGebra en celular/computadora, papel milimétrico, regla, calculadora.",
          "evidence": "Reporte técnico del sistema 2x2 con resolución analítica y gráfico impreso o digital."
        },
        "cierre": {
          "processes": "Análisis de casos con rectas paralelas (sin solución) y coincidentes (infinitas soluciones) en problemas de oferta y demanda. Los estudiantes debaten el significado práctico de la ausencia de intersección.",
          "materials": "Rúbrica para proyectos de modelación matemática.",
          "evidence": "Dictamen técnico final del reto PAEC con la recomendación de siembra fundamentada."
        }
      },
      {
        "order": 4,
        "name": "Aplica la aritmética y el manejo del álgebra para resolver ecuaciones cuadráticas y determinar sus raíces",
        "hours": 12,
        "contenidoFormativo": "Ecuaciones cuadráticas completas e incompletas: Factorización y Fórmula General de Bhaskara",
        "metodologia": "Enfoque STEAM",
        "apertura": {
          "processes": "Lanzamiento de un proyectil o balón en el patio escolar. Medición del tiempo de vuelo y cálculo de la altura máxima para deducir por qué la trayectoria corresponde a un polinomio de segundo grado ax² + bx + c = 0.",
          "materials": "Balón, cronómetro, cinta métrica, tabla de registro de datos físicos.",
          "evidence": "Tabla empírica de tiempo y altura con deducción del modelo cuadrático."
        },
        "desarrollo": {
          "processes": "Estudio formal de los métodos de solución: factorización por trinomio cuadrado perfecto y aplicación rigurosa del discriminante D = b² - 4ac en la fórmula general (Bhaskara) para predecir si existen dos raíces reales, una o ninguna.",
          "materials": "Formulario oficial de álgebra, tarjetas de ejercicios clasificados por discriminante.",
          "evidence": "Portafolio de ejercicios cuadráticos con cálculo e interpretación del discriminante."
        },
        "cierre": {
          "processes": "Construcción de la parábola representativa e identificación de los puntos de corte con el eje x como las raíces de la ecuación cuadrática en el contexto del movimiento o cálculo de áreas.",
          "materials": "Rúbrica de evaluación formativa de procedimientos algebraicos.",
          "evidence": "Gráfica de la parábola con raíces señaladas y reporte de aplicación práctica."
        }
      },
      {
        "order": 5,
        "name": "Expresa y resuelve diversas situaciones de interés a través de distintos tipos de ecuaciones aplicadas a problemas financieros",
        "hours": 12,
        "contenidoFormativo": "Modelación matemática integrada y optimización de funciones económicas básicas",
        "metodologia": "Aprendizaje Basado en Proyectos (ABP)",
        "apertura": {
          "processes": "Análisis de caso financiero comunitario: cálculo del punto de equilibrio para una microempresa familiar de conservas o panadería local.",
          "materials": "Estudio de caso financiero simplificado con costos fijos y variables.",
          "evidence": "Identificación de variables de costo, ingreso y utilidad."
        },
        "desarrollo": {
          "processes": "Los equipos formulan la ecuación lineal de ingresos y la ecuación de costos, calculan el punto de equilibrio algebraico e introducen ecuaciones cuadráticas para modelar la maximización de ganancias según el precio de venta.",
          "materials": "Hojas de cálculo, guía del proyecto de finanzas personales del PAEC.",
          "evidence": "Modelo financiero matemático de la microempresa con punto de equilibrio calculado."
        },
        "cierre": {
          "processes": "Feria de proyectos matemáticos en el aula: presentación del plan financiero a los compañeros evaluando la viabilidad económica basada en el rigor algebraico de los cálculos.",
          "materials": "Guía de observación y rúbrica holística de proyectos integradores.",
          "evidence": "Folleto o cartel de educación financiera para la comunidad escolar."
        }
      },
      {
        "order": 6,
        "name": "Revisa el teorema del triángulo de Napoleón como problema-meta integrador",
        "hours": 12,
        "contenidoFormativo": "Geometría analítica básica, distancias entre puntos y relaciones métrico-algebraicas",
        "metodologia": "Estudio de Casos Situados y Demostración Matemática",
        "apertura": {
          "processes": "Narración histórica del Teorema de Napoleón y construcción visual interactiva en GeoGebra: construir triángulos equiláteros sobre los lados de cualquier triángulo arbitrario y unir sus baricentros.",
          "materials": "Software GeoGebra, computadoras o celulares de los estudiantes.",
          "evidence": "Construcción digital del triángulo equilátero generado por los baricentros."
        },
        "desarrollo": {
          "processes": "Traducción analítica del teorema: asignación de coordenadas a los vértices, cálculo de baricentros mediante promedios aritméticos y comprobación algebraica de la igualdad de distancias entre baricentros.",
          "materials": "Guía demostrativa paso a paso, hojas milimétricas.",
          "evidence": "Desarrollo algebraico formal que comprueba la igualdad de las longitudes de los lados."
        },
        "cierre": {
          "processes": "Metacognición sobre el semestre: síntesis de cómo la aritmética, el álgebra y la geometría analítica se articulan armónicamente para resolver problemas matemáticos complejos.",
          "materials": "Cuestionario de autoevaluación semestral de la UAC.",
          "evidence": "Ensayo reflexivo final de una cuartilla sobre la utilidad del pensamiento algebraico."
        }
      }
    ]
  },
  "sectionV": {
    "evaluations": [
      { "type": "Diagnóstica", "moment": "Inicio del semestre y de cada corte", "agent": "Heteroevaluación", "evidence": "Cuestionario de conocimientos aritméticos y noción de variable" },
      { "type": "Formativa", "moment": "Durante las 18 semanas de desarrollo", "agent": "Coevaluación y Autoevaluación", "evidence": "Problemarios resueltos, bitácoras de GeoGebra y rúbricas analíticas por corte" },
      { "type": "Sumativa", "moment": "Cierre de los Cortes 1, 2 y 3", "agent": "Heteroevaluación", "evidence": "Reporte del Reto PAEC de sistemas 2x2, portafolio de evidencias y examen de resolución algebraica" }
    ]
  },
  "sectionVI": {
    "resources": [
      { "title": "Programa de Estudio Oficial de Pensamiento Matemático III - SEP MCCEMS 2025-2028", "type": "Documento Normativo SEP" },
      { "title": "Baldor, A. Álgebra con aplicaciones contextualizadas", "type": "Libro de texto" },
      { "title": "GeoGebra Geometry and Graphing Calculator Suite", "type": "Software educativo interactivo" },
      { "title": "Khan Academy: Sistemas de Ecuaciones Lineales y Ecuaciones Cuadráticas", "type": "Plataforma digital interactiva" }
    ]
  },
  "sectionVII": {
    "validation": "Planeación didáctica validada conforme a los lineamientos oficiales vigentes del MCCEMS y la DBEPA Puebla 2026-2027."
  }
}`;

  console.log('\n3. Solicitando generación con IA (Gemini)...');
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const aiRes = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    })
  });

  if (!aiRes.ok) {
    const errBody = await aiRes.text();
    throw new Error(`Error en llamada Gemini (${aiRes.status}): ${errBody}`);
  }

  const aiData = await aiRes.json();
  const rawJsonText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJsonText) {
    throw new Error('Respuesta vacía de Gemini');
  }

  console.log('✓ Respuesta generada por Gemini recibida.');
  const newContent = JSON.parse(rawJsonText.trim());

  // Validar contenido generado
  const s4Names = newContent.sectionIV?.activities?.map(a => a.name).join(' ') || '';
  console.log('\n4. Verificando calidad pedagógica del contenido generado:');
  console.log(`   - Contiene "ecuaciones": ${s4Names.toLowerCase().includes('ecuaciones')}`);
  console.log(`   - Contiene "sistemas de ecuaciones": ${s4Names.toLowerCase().includes('sistemas de ecuaciones')}`);
  console.log(`   - Contiene "cuadráticas": ${s4Names.toLowerCase().includes('cuadráticas')}`);
  console.log(`   - Contiene "trigonometría": ${s4Names.toLowerCase().includes('trigonometría')}`);

  // 4. Actualizar base de datos
  console.log('\n5. Actualizando registro en la tabla plannings de Neon PostgreSQL...');
  await sql`
    UPDATE plannings
    SET 
      content_json = ${JSON.stringify(newContent)}::jsonb,
      extracted_data = ${JSON.stringify({
        uacName: prog.uac_name,
        semester: prog.semester,
        totalHours: prog.total_hours,
        learningOutcome: prog.learning_outcome,
        activities: prog.activities,
        contenidosFormativos: prog.contenidos_formativos,
        parseConfidence: 'high',
        year: 2025
      })}::jsonb,
      status = 'downloaded',
      updated_at = NOW()
    WHERE id = ${planning.id}::uuid;
  `;
  console.log('✓ Registro en base de datos actualizado con éxito.');

  // 5. Generar archivo DOCX
  console.log('\n6. Compilando documento Word editable oficial (.docx)...');
  const docxBuffer = await buildDocx(newContent);

  const docxOutputPath = 'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\Planeacion_Pensamiento_Matemático_III_3Semestre_2026-2027.docx';
  writeFileSync(docxOutputPath, docxBuffer);
  console.log(`✅ Archivo DOCX oficial generado y guardado exitosamente en:\n   ${docxOutputPath}`);

  console.log('\n===============================================================');
  console.log('🎉 REGENERACIÓN DE NEMESIO CONCLUIDA AL 100%');
  console.log('===============================================================');
}

run().catch(err => {
  console.error('❌ Error fatal en regeneración:', err);
  process.exit(1);
});
