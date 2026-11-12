import { loadEnvLocal } from './lib/load-env';
loadEnvLocal();
import { sql } from '../src/lib/db/client';

// Generador de Metas, Categorías y Subcategorías para Optativas FFE bajo el MCCEMS
function getOptativaTaxonomy(uacName: string, progresion: string, num: number) {
  const name = uacName.toLowerCase();

  let categorias: string[] = [];
  let subcategorias: string[] = [];
  let metas: string[] = [];
  let contenidos: string[] = [];

  if (name.includes('derecho')) {
    categorias = ['C1. El Estado y el orden jurídico', 'C2. Derechos fundamentales y garantías sociales'];
    subcategorias = ['S1. Origen y evolución del derecho', 'S2. Normatividad y orden social', 'S3. Derechos humanos y justicia'];
    metas = [
      `M1. Reconoce la función del derecho como instrumento regulador de la convivencia social y garante de la dignidad humana en el marco de la progresión ${num}.`,
      `M2. Analiza críticamente los marcos normativos vigentes y su impacto en la resolución de controversias ciudadanas y equidad social.`
    ];
    contenidos = ['Evolución histórica de los sistemas jurídicos', 'Jerarquía de normas constitucionales', 'Derechos humanos y debido proceso'];
  } else if (name.includes('economía')) {
    categorias = ['C1. Dinámica económica y mercados', 'C2. Política fiscal y desarrollo sostenible'];
    subcategorias = ['S1. Escasez y asignación de recursos', 'S2. Estructuras de mercado', 'S3. Política macroeconómica nacional'];
    metas = [
      `M1. Analiza las variables macroeconómicas fundamentales (PIB, inflación, desempleo) para interpretar la realidad socioeconómica mexicana.`,
      `M2. Evalúa las políticas públicas de distribución del ingreso y su contribución al bienestar social y sustentabilidad regional.`
    ];
    contenidos = ['Flujo circular de la economía', 'Oferta, demanda y equilibrio de mercado', 'Política monetaria y fiscal en México'];
  } else if (name.includes('filosófico') || name.includes('filosofía') || name.includes('lógica')) {
    categorias = ['C1. Pensamiento crítico y argumentación', 'C2. Ética, existencia y sentido'];
    subcategorias = ['S1. Estructura lógica del razonamiento', 'S2. Falacias y diálogo racional', 'S3. Dilemas éticos contemporáneos'];
    metas = [
      `M1. Emplea las reglas de la lógica formal e informal para evaluar la validez de argumentos en debates filosóficos y cotidianos.`,
      `M2. Reflexiona sobre los dilemas ontológicos y éticos de la condición humana, fundamentando posturas reflexivas con apertura dialógica.`
    ];
    contenidos = ['Proposiciones y tablas de verdad', 'Identificación de falacias formales y no formales', 'Corrientes éticas clásicas y aplicadas'];
  } else if (name.includes('estética') || name.includes('arte')) {
    categorias = ['C1. Percepción estética y sensibilidad', 'C2. Manifestaciones artísticas y sociedad'];
    subcategorias = ['S1. Belleza, experiencia y juicio estético', 'S2. Lenguajes artísticos', 'S3. Arte y memoria cultural'];
    metas = [
      `M1. Desarrolla la sensibilidad y el juicio estético a través de la contemplación y análisis crítico de diversas expresiones artísticas.`,
      `M2. Vincula la experiencia estética personal con los contextos socioculturales de su comunidad, reconociendo el arte como transformador social.`
    ];
    contenidos = ['Conceptos de estética y categorías estéticas', 'El arte como forma de conocimiento humano', 'Patrimonio cultural y artes comunitarias'];
  } else if (name.includes('psicología')) {
    categorias = ['C1. Procesos cognitivos y afectivos', 'C2. Desarrollo biopsicosocial humano'];
    subcategorias = ['S1. Bases biológicas de la conducta', 'S2. Aprendizaje, memoria y emoción', 'S3. Identidad e interacción social'];
    metas = [
      `M1. Identifica las bases neurobiológicas y psicológicas que modulan la cognición, el afecto y el comportamiento interpersonal.`,
      `M2. Aplica estrategias de autorregulación emocional y resiliencia para el fortalecimiento de la salud mental personal y comunitaria.`
    ];
    contenidos = ['Estructura del sistema nervioso y neurotransmisores', 'Teorías del aprendizaje y desarrollo cognitivo', 'Dinámicas de grupo y conducta prosocial'];
  } else if (name.includes('raíces') || name.includes('etimológicas')) {
    categorias = ['C1. Morfología y léxico grecolatino', 'C2. Evolución del español y terminología científica'];
    subcategorias = ['S1. Prefijos, sufijos y raíces griegas', 'S2. Declinaciones y raíces latinas', 'S3. Tecnicismos científicos y humanísticos'];
    metas = [
      `M1. Analiza la estructura morfológica de las palabras del español reconociendo componentes griegos y latinos en textos científicos y literarios.`,
      `M2. Enriquece su competencia léxica y ortográfica mediante el conocimiento de la etimología de tecnicismos y neologismos del lenguaje formal.`
    ];
    contenidos = ['Alfabeto griego y transliteración fonética', 'Familias léxicas de origen latino', 'Composición y derivación de términos especializados'];
  } else if (name.includes('comunicación') && name.includes('sociedad')) {
    categorias = ['C1. Medios de comunicación y opinión pública', 'C2. Sociedad digital y participación'];
    subcategorias = ['S1. Teorías de la comunicación de masas', 'S2. Discursos hegemónicos y alternativos', 'S3. Alfabetización digital crítica'];
    metas = [
      `M1. Analiza de manera crítica los discursos emitidos por los medios masivos de comunicación y plataformas digitales, identificando intencionalidades.`,
      `M2. Diseña estrategias de comunicación social orientadas a la visibilización de problemáticas comunitarias y el fortalecimiento de la ciudadanía.`
    ];
    contenidos = ['Modelos de comunicación y persuasión mediática', 'Sesgos informativos y fake news', 'Nuevos medios y movimientos sociales en red'];
  } else if (name.includes('biología') || name.includes('biológico') || name.includes('materia y energía en los organismos')) {
    categorias = ['C1. Sistemas vivos y homeostasis', 'C2. Flujo energético y biodiversidad'];
    subcategorias = ['S1. Metabolismo celular (respiración y fotosíntesis)', 'S2. Genética y herencia molecular', 'S3. Dinámica de ecosistemas'];
    metas = [
      `M1. Explica los mecanismos de transducción energética celular y homeostasis que permiten el mantenimiento de la vida en los organismos.`,
      `M2. Evalúa las relaciones de interdependencia ecológica entre los seres vivos y su entorno, proponiendo acciones de conservación de la biodiversidad.`
    ];
    contenidos = ['Rutas metabólicas de catabolismo y anabolismo', 'Estructura del ADN y síntesis proteica', 'Ciclos biogeoquímicos y redes tróficas'];
  } else if (name.includes('físic') || name.includes('fenómenos físicos')) {
    categorias = ['C1. Mecánica clásica y electromagnetismo', 'C2. Ondas, termodinámica y energía'];
    subcategorias = ['S1. Leyes de Newton y gravitación', 'S2. Conservación de energía mecánica', 'S3. Fenómenos ondulatorios y óptica'];
    metas = [
      `M1. Modela cuantitativa y conceptualmente el movimiento de los cuerpos y las interacciones gravitacionales y electromagnéticas.`,
      `M2. Aplica los principios de conservación de la energía y mecánica ondulatoria para resolver situaciones experimentales y tecnológicas situadas.`
    ];
    contenidos = ['Cinemática y dinámica vectorial', 'Trabajo, energía cinética y potencial', 'Reflexión, refracción e interferencia de ondas'];
  } else if (name.includes('salud integral')) {
    categorias = ['C1. Determinantes de la salud comunitaria', 'C2. Estilos de vida y prevención de enfermedades'];
    subcategorias = ['S1. Nutrición y salud metabólica', 'S2. Salud sexual y reproductiva', 'S3. Prevención de adicciones y salud mental'];
    metas = [
      `M1. Analiza los determinantes sociales, biológicos y ambientales de la salud para diseñar planes de prevención de factores de riesgo individuales.`,
      `M2. Promueve prácticas de autocuidado, nutrición balanceada y bienestar integral en el ámbito escolar y comunitario.`
    ];
    contenidos = ['Epidemiología de enfermedades crónico-degenerativas', 'Guías alimentarias y balance calórico', 'Salud mental y redes de apoyo comunitario'];
  } else if (name.includes('finanzas') || name.includes('probabilidad') || name.includes('contables')) {
    categorias = ['C1. Pensamiento probabilístico e inferencial', 'C2. Modelación matemática de decisiones financieras'];
    subcategorias = ['S1. Distribuciones de probabilidad y muestreo', 'S2. Interés simple y compuesto', 'S3. Presupuesto e inversión sostenible'];
    metas = [
      `M1. Aplica modelos de probabilidad y cálculo financiero para evaluar escenarios de incertidumbre y optimizar la toma de decisiones económicas.`,
      `M2. Diseña planes financieros personales y proyectos de inversión comunitaria considerando tasas de rendimiento, inflación y valor del dinero en el tiempo.`
    ];
    contenidos = ['Distribución normal y teorema del límite central', 'Fórmulas de amortización y valor presente neto', 'Elaboración de presupuestos y gestión del crédito'];
  } else if (name.includes('inglés')) {
    categorias = ['C1. Comunicación oral y escrita avanzada (B1 CEFR)', 'C2. Interculturalidad y discurso global'];
    subcategorias = ['S1. Estructuras gramaticales complejas (tiempos perfectos y condicionales)', 'S2. Comprensión de textos auténticos', 'S3. Producción dialógica'];
    metas = [
      `M1. Expresa ideas complejas, opiniones justificadas y proyectos futuros con fluidez en lengua inglesa tanto en formato oral como escrito.`,
      `M2. Comprende textos académicos, artículos informativos y material audiovisual auténtico, reconociendo matices socioculturales y pragmáticos.`
    ];
    contenidos = ['Present and Past Perfect, Conditionals 1, 2, 3', 'Modal verbs of deduction and obligation', 'Idiomatic expressions and formal academic writing'];
  } else {
    // Categoría general de ciencias sociales / humanidades
    categorias = ['C1. Análisis social y pensamiento crítico', 'C2. Participación ciudadana y entorno'];
    subcategorias = ['S1. Métodos de indagación situada', 'S2. Transformación social', 'S3. Ética y comunidad'];
    metas = [
      `M1. Desarrolla competencias de análisis crítico e interpretación fundamentada de fenómenos socioculturales contemporáneos.`,
      `M2. Articula saberes disciplinares en propuestas de intervención orientadas al bienestar común y al desarrollo regional sostenible.`
    ];
    contenidos = ['Metodologías cualitativas y cuantitativas', 'Estructuras de participación comunitaria', 'Evaluación de proyectos de impacto social'];
  }

  return { categorias, subcategorias, metas, contenidos };
}

async function main() {
  console.log('========================================================================');
  console.log('  ENRIQUECIMIENTO DE METAS Y CATEGORÍAS EN TODAS LAS OPTATIVAS (FASE 4) ');
  console.log('  Eliminación de metas: [] y categorias: [] en las 40 Optativas FFE     ');
  console.log('========================================================================\n');

  const db = sql();

  const rows = await db`
    SELECT id, uac_name, semester, activities, contenidos_formativos
    FROM programs_catalog
    WHERE component = 'ffe_optativa'
    ORDER BY semester, uac_name
  `;

  console.log(`Total Optativas FFE evaluadas: ${rows.length}`);
  let updatedCount = 0;

  for (const r of rows) {
    const cfs = Array.isArray(r.contenidos_formativos) ? r.contenidos_formativos : [];
    const acts = Array.isArray(r.activities) ? r.activities : [];

    // Enriquecer contenidos formativos con metas, categorias y subcategorias reales
    const enrichedCfs = cfs.map((cf: any, idx: number) => {
      const prog = cf.progresion || cf.actividad || cf.contenidoFormativo || acts[idx]?.name || `Progresión ${idx + 1}`;
      const { categorias, subcategorias, metas, contenidos } = getOptativaTaxonomy(r.uac_name, prog, idx + 1);

      return {
        ...cf,
        numero: cf.numero || idx + 1,
        progresion: prog,
        metas: (Array.isArray(cf.metas) && cf.metas.length > 0) ? cf.metas : metas,
        categorias: (Array.isArray(cf.categorias) && cf.categorias.length > 0) ? cf.categorias : categorias,
        subcategorias: (Array.isArray(cf.subcategorias) && cf.subcategorias.length > 0) ? cf.subcategorias : subcategorias,
        contenidos: (Array.isArray(cf.contenidos) && cf.contenidos.length > 0) ? cf.contenidos : contenidos
      };
    });

    // Enriquecer activities con horas y subcategorías
    const enrichedActs = acts.map((a: any, idx: number) => {
      const cf = enrichedCfs[idx] || {};
      return {
        ...a,
        hours: a.hours || 7,
        order: a.order || idx + 1,
        categorias: cf.categorias,
        subcategorias: cf.subcategorias,
        metas: cf.metas
      };
    });

    await db`
      UPDATE programs_catalog
      SET contenidos_formativos = ${JSON.stringify(enrichedCfs)},
          activities = ${JSON.stringify(enrichedActs)}
      WHERE id = ${r.id}
    `;

    updatedCount++;
    console.log(`  ✓ Optativa actualizada: [Sem ${r.semester}] "${r.uac_name}" (${enrichedCfs.length} progresiones con metas/categorías completas)`);
  }

  console.log('\n========================================================================');
  console.log(`Total Optativas actualizadas exitosamente: ${updatedCount}/40`);
  console.log('========================================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('[enrich-optativas-metas-categorias] Error:', err);
  process.exit(1);
});
