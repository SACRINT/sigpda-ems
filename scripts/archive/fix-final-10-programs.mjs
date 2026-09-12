import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
let dbUrl = '';
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
    if (m) {
      let val = m[1].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      dbUrl = val;
    }
  });
}

const sql = neon(dbUrl);

const FINAL_10_DEFINITIONS = [
  {
    nameMatch: 'Taller de Ciencias I',
    sem: 2,
    meta: 'Desarrolla el pensamiento experimental y el método científico a través de proyectos de laboratorio aplicados a fenómenos físicos y químicos.',
    propositos: [
      'Aplica el método científico y protocolos de seguridad en el laboratorio escolar.',
      'Diseña experimentos controlados para comprobar leyes físicas y transformaciones químicas.',
      'Elabora reportes de investigación con análisis cuantitativo y cualitativo de datos.'
    ],
    contenidos: [
      ['Normas de seguridad en el laboratorio', 'Instrumentos de medición y calibración'],
      ['Diseño experimental y variables', 'Registro sistemático y errores de medición'],
      ['Análisis de resultados', 'Elaboración de informes y conclusiones científicas']
    ]
  },
  {
    nameMatch: 'Taller de Ciencias II',
    sem: 3,
    meta: 'Profundiza en la indagación experimental orientada a la biotecnología, ecología y química ambiental.',
    propositos: [
      'Implementa técnicas de análisis biológico y microbiológico básico.',
      'Evalúa la calidad del agua, suelo y aire mediante bioindicadores y ensayos químicos.',
      'Propone soluciones científicas a problemáticas ambientales de su entorno.'
    ],
    contenidos: [
      ['Técnicas de muestreo ambiental', 'Manejo de microscopía y reactivos'],
      ['Análisis fisicoquímico de muestras', 'Bioindicadores ecológicos'],
      ['Proyectos de remediación ambiental', 'Divulgación científica comunitaria']
    ]
  },
  {
    nameMatch: 'Espacio y Sociedad',
    sem: 4,
    meta: 'Analiza las relaciones espaciales, la geografía humana y la conformación socioeconómica del territorio.',
    propositos: [
      'Comprende la organización territorial, el espacio geográfico y la demografía en México y Puebla.',
      'Analiza las dinámicas urbanas, rurales y los flujos migratorios contemporáneos.',
      'Evalúa el impacto de las actividades económicas en el ordenamiento territorial sustentable.'
    ],
    contenidos: [
      ['Conceptos de espacio geográfico', 'Cartografía y sistemas de información geográfica'],
      ['Dinámica demográfica y migración', 'Procesos de urbanización y ruralidad'],
      ['Desarrollo regional y sustentabilidad', 'Planificación territorial comunitaria']
    ]
  },
  {
    nameMatch: 'Pensamiento Literario',
    sem: 4,
    meta: 'Fomenta la apreciación estética, el análisis crítico y la creación de textos literarios universales y mexicanos.',
    propositos: [
      'Analiza los géneros literarios (narrativo, lírico, dramático y ensayístico) en su contexto histórico.',
      'Interpreta obras literarias clásicas e hispanoamericanas desde una perspectiva crítica y dialógica.',
      'Produce textos literarios propios aplicando recursos retóricos, poéticos y narrativos.'
    ],
    contenidos: [
      ['Teoría y géneros literarios', 'Figuras retóricas y análisis estilístico'],
      ['Literatura mexicana y latinoamericana contemporánea', 'Perspectiva de género en la literatura'],
      ['Taller de creación literaria', 'Publicación y recital de textos propios']
    ]
  },
  {
    nameMatch: 'Taller de Cultura Digital I',
    sem: 4,
    meta: 'Aplica herramientas avanzadas de diseño web, bases de datos y desarrollo de proyectos digitales comunitarios.',
    propositos: [
      'Diseña páginas web y plataformas digitales utilizando estándares de accesibilidad y usabilidad.',
      'Gestiona bases de datos relacionales para la sistematización de información escolar o comunitaria.',
      'Desarrolla proyectos digitales colaborativos orientados a la solución de problemas del entorno.'
    ],
    contenidos: [
      ['Estructura HTML5, CSS y diseño web responsivo'],
      ['Fundamentos de bases de datos y consultas estructuradas (SQL básico)'],
      ['Gestión de proyectos digitales, marketing social y vinculación comunitaria']
    ]
  },
  {
    nameMatch: 'Temas Selectos de Matemáticas I',
    sem: 4,
    meta: 'Profundiza en álgebra superior, trigonometría avanzada y precálculo para carreras STEM.',
    propositos: [
      'Resuelve sistemas de ecuaciones no lineales y operaciones con matrices y determinantes.',
      'Aplica identidades trigonométricas avanzadas y coordenadas polares.',
      'Modela funciones complejas como preparación para el cálculo superior.'
    ],
    contenidos: [
      ['Matrices, determinantes y sistemas de ecuaciones lineales de orden n'],
      ['Trigonometría analítica, identidades y ecuaciones trigonométricas'],
      ['Coordenadas polares, números complejos y precálculo']
    ]
  },
  {
    nameMatch: 'Taller Pensamiento Variacional I',
    sem: 5,
    meta: 'Modela procesos de cambio continuo y optimización matemática en contextos científicos e ingenieriles.',
    propositos: [
      'Comprende el concepto de variación instantánea y razón de cambio promedio.',
      'Modela fenómenos dinámicos utilizando ecuaciones diferenciales y funciones de varias variables.',
      'Aplica criterios de optimización en situaciones de física, economía e ingeniería.'
    ],
    contenidos: [
      ['Pensamiento variacional y modelación del cambio'],
      ['Comportamiento de funciones y aproximaciones lineales'],
      ['Optimización y análisis de fenómenos no lineales']
    ]
  },
  {
    nameMatch: 'Arte y Cultura II',
    sem: 6,
    meta: 'Consolida la producción y gestión de proyectos artísticos y culturales comunitarios.',
    propositos: [
      'Diseña y monta exposiciones, obras o recitales artísticos con enfoque comunitario.',
      'Analiza las vanguardias artísticas contemporáneas y el arte digital interactivo.',
      'Gestiona espacios culturales y preservación del patrimonio tangible e intangible.'
    ],
    contenidos: [
      ['Gestión cultural y curaduría de proyectos artísticos'],
      ['Vanguardias contemporáneas y expresiones multidisciplinarias'],
      ['Montaje, producción y difusión comunitaria']
    ]
  },
  {
    nameMatch: 'Economía II. Política Económica y Política Pública Mexicana',
    sem: 6,
    meta: 'Examina la política fiscal, monetaria y las políticas públicas del desarrollo económico en México.',
    propositos: [
      'Comprende el funcionamiento del Banco de México, la política monetaria y la inflación.',
      'Analiza el presupuesto de egresos, la recaudación fiscal y el gasto público en México.',
      'Evalúa el impacto de los tratados de libre comercio y las políticas de bienestar social.'
    ],
    contenidos: [
      ['Política monetaria, tasas de interés y sistema financiero mexicano'],
      ['Política fiscal, deuda pública y presupuesto de egresos'],
      ['Comercio internacional, globalización y políticas de inclusión económica']
    ]
  },
  {
    nameMatch: 'Taller Pensamiento Variacional II',
    sem: 6,
    meta: 'Aplica el modelado variacional avanzado y cálculo integral en sistemas complejos.',
    propositos: [
      'Aplica métodos de integración y series matemáticas en la modelación de fenómenos continuos.',
      'Resuelve problemas de acumulación y áreas en ingeniería y física aplicada.',
      'Desarrolla proyectos de modelación matemática interdisciplinaria.'
    ],
    contenidos: [
      ['Métodos avanzados de integración y cálculo de volúmenes de revolución'],
      ['Modelación variacional en física, biología y finanzas'],
      ['Simulación computacional de modelos matemáticos']
    ]
  }
];

async function main() {
  console.log('🚀 Completando enriquecimiento del 100% de los programas oficiales...');

  for (const def of FINAL_10_DEFINITIONS) {
    const rows = await sql`
      SELECT id, uac_name, semester, total_hours
      FROM programs_catalog
      WHERE semester = ${def.sem} AND (uac_name ILIKE ${'%' + def.nameMatch + '%'} OR uac_name = ${def.nameMatch})
    `;

    for (const r of rows) {
      const totH = r.total_hours || (def.propositos.length * 18);
      const hPerProp = Math.round(totH / def.propositos.length);
      const acts = def.propositos.map((p, i) => ({ order: i + 1, name: p, hours: hPerProp }));
      const cfs = def.propositos.map((p, i) => ({
        order: i + 1,
        proposito: p,
        hours: hPerProp,
        contenidos: def.contenidos[i]
      }));

      // Adjust sum
      const sumH = acts.reduce((acc, a) => acc + (a.hours || 0), 0);
      if (sumH !== totH && acts.length > 0) {
        const diff = totH - sumH;
        acts[acts.length - 1].hours += diff;
        cfs[cfs.length - 1].hours += diff;
      }

      await sql`
        UPDATE programs_catalog
        SET
          learning_outcome = ${def.meta},
          activities = ${JSON.stringify(acts)},
          contenidos_formativos = ${JSON.stringify(cfs)},
          evidences = ${JSON.stringify([
            "Portafolio de evidencias de aprendizaje",
            "Rúbrica de evaluación continua",
            "Proyecto integrador comunitario"
          ])}
        WHERE id = ${r.id}
      `;
      console.log(`  ✓ Actualizado: ${r.uac_name} (Sem ${r.semester})`);
    }
  }

  console.log('🎉 Todos los programas han sido enriquecidos al 100%.');
}

main().catch(console.error);
