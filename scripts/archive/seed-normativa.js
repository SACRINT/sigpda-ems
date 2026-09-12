// scripts/seed-normativa.js
// Carga el catálogo normativo curado en la BD.
// Run with: cmd /c "node --env-file=.env.local scripts/seed-normativa.js"
//
// IMPORTANTE: Este script es IDEMPOTENTE (usa ON CONFLICT DO NOTHING en documentos
// y verifica existencia antes de insertar artículos). Se puede ejecutar varias veces.

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

// ─── Catálogo normativo curado ────────────────────────────────────────────────
// aplicable_a: ['pmc','paec','pips','planeacion']
const DOCUMENTOS = [
  {
    titulo: 'Constitución Política de los Estados Unidos Mexicanos',
    tipo: 'constitucion',
    fuente: 'DOF última reforma 2023',
    orden_display: 1,
    articulos: [
      {
        numero: 'Artículo 3°',
        texto: 'Toda persona tiene derecho a la educación. El Estado -Federación, Estados, Ciudad de México y Municipios- impartirá y garantizará la educación inicial, preescolar, primaria, secundaria, media superior y superior. La educación inicial, preescolar, primaria y secundaria, conforman la educación básica; ésta y la media superior serán obligatorias... La educación que imparta el Estado tenderá a desarrollar armónicamente todas las facultades del ser humano y fomentará en él, a la vez, el amor a la Patria, el respeto a los derechos humanos y la conciencia de la solidaridad internacional, en la independencia y en la justicia. El Estado garantizará la calidad en la educación obligatoria de manera que los materiales y métodos educativos, la organización escolar, la infraestructura educativa y la idoneidad de los docentes y los directivos garanticen el máximo logro de aprendizaje de los educandos.',
        aplicable_a: ['pmc', 'paec', 'pips', 'planeacion'],
        orden_en_doc: 1,
      },
    ],
  },
  {
    titulo: 'Ley General de Educación (2019)',
    tipo: 'ley_general',
    fuente: 'DOF 30-09-2019',
    orden_display: 2,
    articulos: [
      {
        numero: 'Artículo 14',
        texto: 'El Estado está obligado a prestar servicios educativos con equidad y excelencia. La educación media superior tendrá carácter obligatorio. Las autoridades educativas adoptarán las medidas necesarias para hacer efectivo el principio de obligatoriedad en la educación media superior.',
        aplicable_a: ['pmc', 'paec', 'pips'],
        orden_en_doc: 1,
      },
      {
        numero: 'Artículo 16',
        texto: 'La educación que imparta el Estado, sus organismos descentralizados y los particulares con autorización o con reconocimiento de validez oficial de estudios, es el medio fundamental para adquirir, transmitir y acrecentar la cultura; es proceso permanente que contribuye al desarrollo del individuo y a la transformación de la sociedad. Los criterios que orientarán a la educación son: democrática, nacional, humanista, equitativa, inclusiva, intercultural, integral, de excelencia y laica.',
        aplicable_a: ['pmc', 'paec', 'pips', 'planeacion'],
        orden_en_doc: 2,
      },
      {
        numero: 'Artículo 18',
        texto: 'El Estado proporcionará a niñas, niños, adolescentes y jóvenes una educación inclusiva, equitativa y de excelencia. Las autoridades educativas en el ámbito de sus responsabilidades establecerán políticas incluyentes y con perspectiva de género que garanticen las condiciones de inclusión, equidad y excelencia de todos los educandos.',
        aplicable_a: ['pmc', 'paec', 'pips', 'planeacion'],
        orden_en_doc: 3,
      },
      {
        numero: 'Artículo 44',
        texto: 'Las autoridades educativas establecerán los mecanismos necesarios para la supervisión de los servicios educativos. Los supervisores tendrán funciones de orientación, asesoría técnico-pedagógica, seguimiento y evaluación de los planteles, directivos y docentes bajo su responsabilidad.',
        aplicable_a: ['pips'],
        orden_en_doc: 4,
      },
      {
        numero: 'Artículo 46',
        texto: 'La supervisión escolar tendrá por objeto asegurar la buena marcha, el funcionamiento regular y el mejoramiento de los servicios de educación. Las autoridades educativas establecerán los mecanismos de apoyo, asesoría y capacitación a los supervisores para el mejor desempeño de sus funciones.',
        aplicable_a: ['pips'],
        orden_en_doc: 5,
      },
    ],
  },
  {
    titulo: 'Ley General del Sistema para la Carrera de las Maestras y los Maestros (LGSCMM, 2019)',
    tipo: 'ley_general',
    fuente: 'DOF 30-09-2019',
    orden_display: 3,
    articulos: [
      {
        numero: 'Artículo 4°',
        texto: 'La función docente es una actividad de interés público. La función directiva comprende las actividades de planeación, organización, administración, supervisión, evaluación y rendición de cuentas en los planteles educativos. La mejora continua de la educación requiere del esfuerzo y la participación de las autoridades educativas, de los docentes y de la comunidad escolar.',
        aplicable_a: ['pmc', 'pips'],
        orden_en_doc: 1,
      },
      {
        numero: 'Artículo 69',
        texto: 'Las autoridades educativas federales y locales establecerán en el ámbito de sus respectivas competencias mecanismos de apoyo, asesoría y acompañamiento a los directivos y docentes de educación media superior para el mejor desempeño de sus funciones. Los directivos de los planteles tendrán la obligación de elaborar el Plan de Mejora Continua de su plantel y dar seguimiento a su cumplimiento.',
        aplicable_a: ['pmc', 'pips'],
        orden_en_doc: 2,
      },
    ],
  },
  {
    titulo: 'Acuerdo Secretarial 14/08/22 — Marco Curricular Común de la Educación Media Superior (MCCEMS)',
    tipo: 'acuerdo',
    fuente: 'DOF 14-08-2022',
    orden_display: 4,
    articulos: [
      {
        numero: 'Lineamiento General',
        texto: 'El Marco Curricular Común de la Educación Media Superior (MCCEMS) define los aprendizajes fundamentales para el egreso de la EMS. Establece que la gestión educativa se organiza en 8 categorías de mejora continua: (1) Desarrollo académico y del aprendizaje, (2) Convivencia escolar y formación integral, (3) Gestión escolar y liderazgo directivo, (4) Planta docente y desarrollo profesional, (5) Vinculación con la comunidad, (6) Infraestructura y recursos educativos, (7) Atención y permanencia del alumnado, (8) Salud, bienestar y vida saludable.',
        aplicable_a: ['pmc', 'paec', 'pips', 'planeacion'],
        orden_en_doc: 1,
      },
      {
        numero: 'Componente Curricular',
        texto: 'El currículo de la EMS se organiza en: (a) Componente de Formación Básica: Matemáticas, Lenguaje y Comunicación, Ciencias Naturales Experimentales, Ciencias Sociales y Humanidades; (b) Componente de Formación Propedéutica; (c) Componente de Formación para el Trabajo. Los programas de estudio definen Propósitos Formativos (1° a 4° semestre) y Progresiones de Aprendizaje (5° a 6° semestre) para el ciclo 2026-2027.',
        aplicable_a: ['paec', 'planeacion'],
        orden_en_doc: 2,
      },
    ],
  },
  {
    titulo: 'Lineamientos para la Planeación de la Mejora Continua 2025-2026 — DBEPA Puebla',
    tipo: 'lineamiento',
    fuente: 'DBEPA 2025',
    orden_display: 5,
    articulos: [
      {
        numero: 'Lineamiento 1 — Definición del PMC',
        texto: 'El Plan de Mejora Continua (PMC) es el instrumento de planeación mediante el cual el directivo del plantel establece metas institucionales e individuales para el personal, con el propósito de superar las problemáticas detectadas a través del diagnóstico y el análisis FODA, alineando las acciones a las categorías de gestión del MCCEMS.',
        aplicable_a: ['pmc'],
        orden_en_doc: 1,
      },
      {
        numero: 'Lineamiento 2 — Estructura del PMC',
        texto: 'El PMC se integra por: (I) Marco Normativo, (II) Diagnóstico del Plantel (incluyendo contexto comunitario, indicadores académicos y FODA), (III) Metas Institucionales SMART por categoría priorizada, (IV) Metas Individuales SMART por trabajador. Cada meta debe incluir: objetivo, estrategia, línea base, indicador cuantitativo, responsable, evidencia cualitativa y periodo.',
        aplicable_a: ['pmc'],
        orden_en_doc: 2,
      },
      {
        numero: 'Lineamiento 3 — Categorías priorizables',
        texto: 'Los directivos deben seleccionar entre 1 y 4 categorías a trabajar durante el ciclo escolar, priorizando aquellas con mayor impacto en los indicadores de abandono, reprobación y eficiencia terminal. Las categorías son: (1) Desarrollo académico y del aprendizaje, (2) Convivencia escolar y formación integral, (3) Gestión escolar y liderazgo directivo, (4) Planta docente y desarrollo profesional, (5) Vinculación con la comunidad, (6) Infraestructura y recursos educativos, (7) Atención y permanencia del alumnado, (8) Salud, bienestar y vida saludable.',
        aplicable_a: ['pmc'],
        orden_en_doc: 3,
      },
      {
        numero: 'Lineamiento 4 — Criterios de calidad',
        texto: 'El PMC será evaluado conforme a estos criterios de supervisión: (a) Coherencia estadística entre línea base y metas; (b) Vinculación explícita con hallazgos del FODA; (c) Entregables técnicos cualitativos (no evidencias superficiales); (d) Hitos de evaluación parcial bimestral; (e) Metas SMART con verbo en infinitivo, indicador cuantitativo y plazo definido.',
        aplicable_a: ['pmc'],
        orden_en_doc: 4,
      },
    ],
  },
  {
    titulo: 'Lineamientos PAEC-PEC 2026-2027 — DBEPA Puebla',
    tipo: 'lineamiento',
    fuente: 'DBEPA 2026',
    orden_display: 6,
    articulos: [
      {
        numero: 'Lineamiento 1 — Definición del PAEC-PEC',
        texto: 'El Proyecto Escolar Comunitario (PEC) es un instrumento de planeación pedagógica participativa que articula las Unidades de Aprendizaje Curricular (UAC) en torno a una problemática social real de la comunidad. Su objetivo es desarrollar aprendizajes situados, con perspectiva comunitaria y crítica, que posicionen al estudiante como agente activo de transformación social.',
        aplicable_a: ['paec'],
        orden_en_doc: 1,
      },
      {
        numero: 'Lineamiento 2 — Estructura del PAEC-PEC',
        texto: 'El PAEC-PEC se integra por 6 fases: (I) Diagnóstico Colectivo y Metodología de Análisis, (II) Definición y Justificación del Proyecto, (III) Mapeo Curricular Transversal, (IV) Cronograma de Implementación, (V) Plan Operativo por UAC, (VI) Seguimiento, Evaluación y Anexos. Cada fase tiene criterios de evaluación en la Rúbrica PAEC 2026-2027.',
        aplicable_a: ['paec'],
        orden_en_doc: 2,
      },
      {
        numero: 'Lineamiento 3 — Transversalidad curricular',
        texto: 'El principio de transversalidad exige que las UAC participantes estén articuladas mediante una "cadena de valor pedagógica": el producto de aprendizaje de una UAC es el insumo indispensable de la siguiente. Se prohíbe la multidisciplinariedad superficial donde las asignaturas realizan actividades paralelas sin conexión real.',
        aplicable_a: ['paec'],
        orden_en_doc: 3,
      },
    ],
  },
  {
    titulo: 'Lineamientos PIPS 2026-2027 — DBEPA Puebla',
    tipo: 'lineamiento',
    fuente: 'DBEPA 2026',
    orden_display: 7,
    articulos: [
      {
        numero: 'Lineamiento 1 — Definición del PIPS',
        texto: 'El Plan de Intervención Pedagógica de Supervisión (PIPS) es el instrumento de planeación mediante el cual el supervisor escolar establece las estrategias de acompañamiento técnico-pedagógico a los planteles de su zona, con el propósito de mejorar los indicadores educativos y fortalecer la gestión directiva y docente, en correspondencia con los PMC y PAEC-PEC de cada plantel.',
        aplicable_a: ['pips'],
        orden_en_doc: 1,
      },
      {
        numero: 'Lineamiento 2 — Contenido del PIPS',
        texto: 'El PIPS debe contener: (I) Presentación institucional del supervisor, (II) Fundamentación normativa, (III) Reflexión sobre el PIPS del ciclo anterior, (IV) Diagnóstico de la Zona (con datos cuantitativos por plantel), (V) Análisis FODA de la zona, (VI) Objetivos, Metas e Indicadores SMART, (VII) Líneas de Acción y Cronograma mensual, (VIII) Estrategias de seguimiento y evaluación.',
        aplicable_a: ['pips'],
        orden_en_doc: 2,
      },
    ],
  },
  {
    titulo: 'Ley de Educación del Estado de Puebla',
    tipo: 'ley_local',
    fuente: 'Gobierno del Estado de Puebla',
    orden_display: 8,
    articulos: [
      {
        numero: 'Artículo Relevante — Supervisión EMS',
        texto: 'Las autoridades educativas del Estado de Puebla, a través de la Dirección de Bachillerato y Educación Para Adultos (DBEPA), ejercerán funciones de supervisión, asesoría técnica y evaluación sobre los planteles del Bachillerato General Estatal (BGE), Bachillerato Digital (BD) y EMSAD, con el propósito de garantizar la calidad educativa, la permanencia del alumnado y el desarrollo profesional continuo del personal.',
        aplicable_a: ['pmc', 'pips'],
        orden_en_doc: 1,
      },
    ],
  },
  {
    titulo: 'Plan Sectorial de Educación 2020-2024 / 2025-2030 — SEP',
    tipo: 'otro',
    fuente: 'SEP 2020 / 2025',
    orden_display: 9,
    articulos: [
      {
        numero: 'Objetivo 1',
        texto: 'Garantizar el derecho a la educación inclusiva, equitativa y de calidad para todas las personas, con especial atención a los grupos históricamente excluidos. Reducir el abandono escolar en la educación media superior mediante estrategias de acompañamiento tutoral, becas y atención a las causas de deserción.',
        aplicable_a: ['pmc', 'paec', 'pips'],
        orden_en_doc: 1,
      },
      {
        numero: 'Objetivo 3',
        texto: 'Fortalecer la gestión educativa y la participación social en los procesos de mejora continua de los planteles. Las escuelas elaborarán sus planes de mejora con participación de la comunidad escolar y los someterán a supervisión técnica de la autoridad educativa correspondiente.',
        aplicable_a: ['pmc', 'pips'],
        orden_en_doc: 2,
      },
    ],
  },
];

// ─── Inserción ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding catálogo normativo...\n');

  let totalDocs = 0;
  let totalArts = 0;
  let skippedDocs = 0;

  for (const doc of DOCUMENTOS) {
    // Verifica si ya existe (idempotente por título)
    const existing = await sql`
      SELECT id FROM normativa_documentos WHERE titulo = ${doc.titulo} LIMIT 1
    `;

    let docId;

    if (existing.length > 0) {
      docId = existing[0].id;
      console.log(`  ⏭️  Documento ya existe: "${doc.titulo.substring(0, 60)}..." (id=${docId})`);
      skippedDocs++;
    } else {
      const [inserted] = await sql`
        INSERT INTO normativa_documentos (titulo, tipo, fuente, vigente, orden_display)
        VALUES (${doc.titulo}, ${doc.tipo}, ${doc.fuente}, TRUE, ${doc.orden_display})
        RETURNING id
      `;
      docId = inserted.id;
      console.log(`  ✅ Documento creado: "${doc.titulo.substring(0, 60)}..." (id=${docId})`);
      totalDocs++;
    }

    // Inserta artículos que no existan aún (idempotente por documento_id + numero)
    for (const art of doc.articulos) {
      const artExists = await sql`
        SELECT id FROM normativa_articulos
        WHERE documento_id = ${docId} AND numero = ${art.numero}
        LIMIT 1
      `;

      if (artExists.length > 0) {
        // Actualiza el texto si cambió
        await sql`
          UPDATE normativa_articulos
          SET texto = ${art.texto},
              aplicable_a = ${art.aplicable_a},
              orden_en_doc = ${art.orden_en_doc}
          WHERE documento_id = ${docId} AND numero = ${art.numero}
        `;
        console.log(`     ♻️  Artículo actualizado: ${art.numero}`);
      } else {
        await sql`
          INSERT INTO normativa_articulos
            (documento_id, numero, texto, aplicable_a, orden_en_doc)
          VALUES
            (${docId}, ${art.numero}, ${art.texto}, ${art.aplicable_a}, ${art.orden_en_doc})
        `;
        console.log(`     ➕ Artículo insertado: ${art.numero}`);
        totalArts++;
      }
    }
  }

  // ── Resumen ─────────────────────────────────────────────────────────────────
  console.log(`\n📊 Resumen del seed:`);
  console.log(`   - Documentos nuevos:   ${totalDocs}`);
  console.log(`   - Documentos omitidos: ${skippedDocs}`);
  console.log(`   - Artículos insertados/actualizados: ${totalArts + (DOCUMENTOS.reduce((s, d) => s + d.articulos.length, 0) - totalArts)}`);

  // ── Verificación final ───────────────────────────────────────────────────────
  const [countDocs] = await sql`SELECT COUNT(*) as total FROM normativa_documentos WHERE vigente = TRUE`;
  const [countArts] = await sql`SELECT COUNT(*) as total FROM normativa_articulos`;
  console.log(`\n✅ BD actualizada:`);
  console.log(`   - Total documentos vigentes: ${countDocs.total}`);
  console.log(`   - Total artículos: ${countArts.total}`);

  // ── Muestra distribución por generador ──────────────────────────────────────
  for (const gen of ['pmc', 'paec', 'pips', 'planeacion']) {
    const [cnt] = await sql`
      SELECT COUNT(*) as total FROM normativa_articulos
      WHERE ${gen} = ANY(aplicable_a)
    `;
    console.log(`   - Artículos para ${gen.toUpperCase().padEnd(10)}: ${cnt.total}`);
  }

  console.log('\n🎉 Seed normativa completado.\n');
}

main().catch(err => {
  console.error('❌ Error en seed:', err.message);
  process.exit(1);
});
