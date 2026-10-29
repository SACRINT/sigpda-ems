/**
 * Script de siembra canónica oficial para el Currículum Ampliado (Formación Socioemocional)
 * conforme a las directivas actualizadas de la SEP para el Mapa Curricular MCCEMS (2025-2028):
 *
 * - 1.er Semestre: Únicamente "Actividades Físicas y Deportivas" (sin "I").
 * - 2.° Semestre: Únicamente "Actividades Artísticas y Culturales" (sin "II").
 * - 3.er a 6.° Semestre: Disponibles las 3 asignaturas rotativas con nombres oficiales sin números romanos:
 *     1. "Educación para la Salud"
 *     2. "Educación Integral en Sexualidad y Género"
 *     3. "Práctica y Colaboración Ciudadana"
 *
 * Ejecución:
 *   npx tsx --env-file=.env.local scripts/seed-curriculum-ampliado.ts
 */

import { neon } from '@neondatabase/serverless';

interface AmbitoDefinition {
  uac_name: string;
  learning_outcome: string;
  total_hours: number;
  evidences: string[];
  propositos: Array<{
    order: number;
    proposito: string;
    hours: number;
    contenidos: string[];
  }>;
}

export const AMBITOS_CURRICULUM_AMPLIADO_2025: Record<string, AmbitoDefinition> = {
  'Actividades Físicas y Deportivas': {
    uac_name: 'Actividades Físicas y Deportivas',
    learning_outcome:
      'Desarrolle hábitos conscientes y reflexivos en torno a la actividad física y deportiva, como medio para el desarrollo integral, una conciencia crítica y el compromiso con el bienestar colectivo.',
    total_hours: 36,
    evidences: [
      'Registro de experiencias lúdicas y circuitos de juegos tradicionales comunitarios',
      'Propuesta y organización de evento deportivo inclusivo escolar',
      'Bitácora de introspección motriz, autorregulación emocional y juego limpio',
    ],
    propositos: [
      {
        order: 1,
        proposito:
          'Participa en situaciones de juego y actividad física lúdica como una manifestación cultural y expresión de libertad, valorando también el juego como una experiencia formativa y una fuente de disfrute personal que promueve el bienestar y la creatividad.',
        hours: 8,
        contenidos: [
          'El juego como derecho humano',
          'El deporte y el juego',
          'Juegos tradicionales',
        ],
      },
      {
        order: 2,
        proposito:
          'Participa en actividades deportivas como un derecho humano fundamental que favorece su desarrollo físico y emocional, y promueve la convivencia respetuosa en la diversidad y otras formas de vinculación y disfrute de su propio cuerpo.',
        hours: 7,
        contenidos: [
          'Derecho a participar en actividades físicas y deportivas',
          'Beneficios del deporte para la salud y la convivencia',
          'Diversidad corporal, étnica, cultural y sexogenérica como elementos enriquecedores en el deporte',
        ],
      },
      {
        order: 3,
        proposito:
          'Explora las emociones y las posibilidades motrices que experimenta en la práctica deportiva, y la identifica como oportunidad para la toma de decisiones saludables, la capacidad de sentir y reconocer emociones y razonar sobre ellas, al tiempo que desarrolla sus potencialidades psicomotrices.',
        hours: 7,
        contenidos: [
          'Emociones que se identifican durante la práctica deportiva',
          'Importancia de las reglas y el respeto para canalizar emociones',
          'Uso del deporte para prevenir riesgos y tomar decisiones saludables',
          'Potencialidades psicomotrices de la corporalidad',
        ],
      },
      {
        order: 4,
        proposito:
          'Identifica y cuestiona las prácticas discriminatorias y de violencia en el deporte por razones de género o corporalidad, para establecer relaciones empáticas, justas y libres de violencia, y desarrolla la capacidad de afiliación y respeto por la dignidad de cada persona.',
        hours: 7,
        contenidos: [
          'Discriminación en el deporte',
          'Respeto a las diversidades corporales e identidades sexogenéricas',
          'Comunicación asertiva para resolver conflictos y crear ambientes inclusivos',
        ],
      },
      {
        order: 5,
        proposito:
          'Promueve la igualdad de oportunidades y la inclusión de todas las personas en el ámbito deportivo, especialmente de mujeres, diversidades sexogenéricas y personas en situación de discapacidad, cultivando una conciencia crítica que impulse el bienestar colectivo y el ejercicio pleno de sus capacidades humanas.',
        hours: 7,
        contenidos: [
          'Inclusión en el deporte: personas de la diversidad sexogenérica o en situación de discapacidad',
          'Crítica a las normas y estereotipos que limitan la participación en ciertos grupos deportivos',
          'Prácticas deportivas incluyentes como herramientas de transformación social',
        ],
      },
    ],
  },
  'Actividades Artísticas y Culturales': {
    uac_name: 'Actividades Artísticas y Culturales',
    learning_outcome:
      'Desarrolle sensibilidad estética y ética mediante el disfrute y el goce del arte como forma de comunicar ideas, experiencias, emociones y necesidades, así como para reconocerse junto con otros como personas que comparten un contexto.',
    total_hours: 36,
    evidences: [
      'Muestra artística comunitaria o performance escolar de transformación social',
      'Mural colaborativo o collage de memorias e identidad colectiva',
      'Bitácora artística de exploración emocional, lenguajes simbólicos y autoconocimiento',
    ],
    propositos: [
      {
        order: 1,
        proposito:
          'Participa de diversas expresiones artísticas para comunicar emociones, ideas y experiencias personales y del colectivo al que pertenece.',
        hours: 9,
        contenidos: [
          'Experimentación con formas de expresión artística y su vínculo con emociones, ideas y experiencias',
          'La memoria como vínculo colectivo de identidad y posibilidad de transformación social',
        ],
      },
      {
        order: 2,
        proposito:
          'Genera manifestaciones artísticas variadas como formas de expresión política frente a los problemas que afectan a su comunidad y entorno.',
        hours: 9,
        contenidos: [
          'Las expresiones artísticas como vínculos con la realidad social, política y cultural',
          'Formas de interacción social a través del arte',
        ],
      },
      {
        order: 3,
        proposito:
          'Recrea la obra de artistas cuyas creaciones buscaron problematizar la realidad y dar cuenta de un posicionamiento político, y formaron parte de procesos colectivos de transformación social.',
        hours: 9,
        contenidos: [
          'Expresiones artísticas y su contexto histórico, social, económico y político para visibilizar o denunciar alguna problemática o situación de la realidad',
          'Enfoque interseccional (conciencia de sí y para apreciar la otredad en sus distintas manifestaciones en los fenómenos socioculturales)',
          'Expresiones artísticas de su comunidad con el objetivo de preservar su patrimonio histórico-cultural, así como lograr una reconfiguración que atienda a la diversidad sociocultural',
        ],
      },
      {
        order: 4,
        proposito:
          'Experimenta el arte como un espacio para el autodescubrimiento y el autoconocimiento en el marco de la complejidad de su contexto y momento histórico.',
        hours: 9,
        contenidos: [
          'Experimentación libre con expresiones artísticas: movimiento o danza, dibujo, interpretación vocal, sonora o musical, artes escénicas o alguna otra de su entorno cultural',
          'Elementos que conforman su identidad cultural y personal (emociones, valores y tradiciones)',
          'El cuerpo como herramienta de comunicación de la persona para relacionarse consigo misma y con su entorno',
        ],
      },
    ],
  },
  'Educación para la Salud': {
    uac_name: 'Educación para la Salud',
    learning_outcome:
      'Cuide su salud a partir de la reflexión y transformación de prácticas cotidianas vinculadas con la alimentación, las relaciones interpersonales y la prevención de riesgos, para convertirse en agente activo del bienestar personal y colectivo, capaz de ejercer su libertad con responsabilidad y compromiso hacia una vida digna.',
    total_hours: 36,
    evidences: [
      'Bitácora reflexiva de hábitos cotidianos, salud mental y cuidado de sí',
      'Proyecto comunitario de alimentación consciente y soberanía alimentaria',
      'Campaña escolar de prevención de adicciones y construcción de entornos protectores',
    ],
    propositos: [
      {
        order: 1,
        proposito:
          'Desarrolla, junto con la comunidad estudiantil a la que pertenece, una conciencia crítica y reflexiva sobre los hábitos que configuran su existencia, y promueve el cuidado de sí como una práctica ética que articula el bienestar físico, emocional, mental y social.',
        hours: 9,
        contenidos: [
          'Autoconocimiento y cuidado de sí',
          'El cuerpo como lugar del cuidado, del pensamiento y de la acción',
          'Prácticas cotidianas de autocuidado como expresión de una vida reflexiva',
          'Relaciones entre salud personal y condiciones ambientales, sociales y culturales',
          'La salud mental y emocional como pilares de una vida digna',
          'El cuidado colectivo',
        ],
      },
      {
        order: 2,
        proposito:
          'Desarrolla la capacidad de discernir y elegir prácticas alimenticias que expresen un cuidado consciente de sí, del cuerpo y del entorno, para fomentar una relación ética con la alimentación que reconozca su dimensión cultural, ecológica y política, y que contribuya a una vida más justa y sostenible.',
        hours: 9,
        contenidos: [
          'La alimentación como un acto de cuidado de sí y de los otros',
          'Prácticas alimenticias conscientes y responsables',
          'Cultura del consumo y sus efectos en la salud',
          'Soberanía alimentaria y acceso equitativo a la nutrición',
          'Sostenibilidad y ética en la producción y consumo de alimentos',
        ],
      },
      {
        order: 3,
        proposito:
          'Identifica, analiza y transforma los factores que afectan el bienestar, a partir del ejercicio del cuidado de sí —con autoconocimiento, autodominio y libertad ética—, para convertirse en agente activo de la salud que reconoce su poder de decisión ante prácticas riesgosas.',
        hours: 9,
        contenidos: [
          'El cuidado de sí como resistencia frente a las prácticas destructivas',
          'Reconocimiento y regulación de los hábitos que afectan la salud',
          'Juego, descanso y recreación como dimensiones del bienestar',
          'Prevención de adicciones desde una ética de la autonomía y la responsabilidad',
          'Construcción de entornos protectores para una vida digna',
        ],
      },
      {
        order: 4,
        proposito:
          'Impulsa la construcción de las relaciones interpersonales, basadas en el respeto, el diálogo y el reconocimiento de las diferencias entre personas, entendiendo que el cuidado de sí, incluye la manera de vincularse con las demás personas, para promover una ética de la convivencia que contribuya al bienestar común y a la transformación de dinámicas violentas.',
        hours: 9,
        contenidos: [
          'El vínculo entre el cuidado de sí y los demás',
          'Relaciones afectivas como espacios de crecimiento',
          'Reconocimiento de los tipos de relaciones y su impacto en el bienestar',
          'Identificación y transformación de dinámicas violentas',
          'Prácticas de diálogo y resolución de conflictos',
        ],
      },
    ],
  },
  'Educación Integral en Sexualidad y Género': {
    uac_name: 'Educación Integral en Sexualidad y Género',
    learning_outcome:
      'Cuide su salud y proteja su integridad al desarrollar relaciones sociales y sexuales constructivas e igualitarias, fincadas en conductas de respeto e inclusión, advirtiendo cómo sus elecciones y decisiones afectan su propio bienestar y el de las demás personas. Entienda, proteja y ejerza su sexualidad con libertad y responsabilidad para la construcción de su proyecto de vida.',
    total_hours: 36,
    evidences: [
      'Cartografía afectiva y análisis de derechos sexuales y reproductivos',
      'Taller vivencial y periódico mural sobre desmitificación de roles de género y prevención de violencias',
      'Proyecto de vida integral con perspectiva de género y relaciones afectivas saludables',
    ],
    propositos: [
      {
        order: 1,
        proposito:
          'Comprende la identidad y orientación sexual, así como la construcción de vínculos afectivos saludables, mediante habilidades de comunicación, diálogo y responsabilidad afectiva en relaciones sociales.',
        hours: 8,
        contenidos: [
          'Diversidad sexogenérica (sexo, identidad de género y orientación sexual)',
          'Derechos de la Comunidad LGBTIQ+',
          'Relaciones de poder y responsabilidad afectiva',
        ],
      },
      {
        order: 2,
        proposito:
          'Reconoce las dimensiones de la sexualidad desde un enfoque de derechos humanos y sexuales, desmitificando creencias, hábitos y estereotipos, y valorando la diversidad sexual como parte de la identidad y expresión colectiva.',
        hours: 7,
        contenidos: [
          'Dimensiones de la sexualidad',
          'Cartilla de los Derechos Sexuales y Reproductivos',
          'Mitos, tabúes y hábitos culturales',
        ],
      },
      {
        order: 3,
        proposito:
          'Analiza la influencia de los roles de género en la toma de decisiones sobre la vida sexual y reproductiva, y promueve tanto la prevención de embarazos no planificados como el ejercicio informado y corresponsable de la sexualidad.',
        hours: 7,
        contenidos: [
          'Roles de género y toma de decisiones',
          'Masculinidad tradicional',
          'Masculinidades no hegemónicas',
          'Relaciones afectivas',
          'Embarazos no planificados',
          'Protocolos de acción y derechos sexuales',
        ],
      },
      {
        order: 4,
        proposito:
          'Desarrolla una conciencia crítica sobre el cuerpo, la autonomía y el placer, al cuestionar las normas sociales, culturales y de género que propician la discriminación y la violencia.',
        hours: 7,
        contenidos: [
          'Diversidad sexogenérica',
          'Binarismo',
          'Normas sociales y culturales',
          'Violencia y discriminación sexual',
          'Equidad, placer y autonomía corporal',
        ],
      },
      {
        order: 5,
        proposito:
          'Ejerce una ciudadanía sexual crítica e informada, que integra el cuidado de sí, el acceso a la salud sexual y reproductiva, y la construcción de un proyecto de vida con perspectiva de género, libre de estereotipos, violencias y jerarquías.',
        hours: 7,
        contenidos: [
          'Prevención, cuidado y atención de Infecciones de Transmisión Sexual (ITS), Enfermedades de Transmisión Sexual (ETS) y Virus de Inmunodeficiencia Humana (VIH)',
          'Derechos de las personas gestantes; derechos de las personas menstruantes',
          'Servicios de salud y orientación sexual',
          'Proyecto de vida con equidad y diversidad',
          'Ciudadanía sexual',
          'Entornos seguros y derechos sexuales',
        ],
      },
    ],
  },
  'Práctica y Colaboración Ciudadana': {
    uac_name: 'Práctica y Colaboración Ciudadana',
    learning_outcome:
      'Valore la importancia de la construcción de ciudadanía a partir del análisis de las condiciones de vida de su comunidad, para involucrarse como agente de transformación social en la atención de necesidades y problemas desde un enfoque de derechos humanos y perspectiva de juventudes.',
    total_hours: 36,
    evidences: [
      'Plan de acción colectivo sobre problemáticas comunitarias y derechos humanos',
      'Diagnóstico y cartografía social de espacios seguros y cultura de paz',
      'Debate y foro deliberativo escolar sobre desarrollo sustentable y alternativas locales',
    ],
    propositos: [
      {
        order: 1,
        proposito:
          'Reconoce los principales instrumentos que tutelan los derechos humanos en general, y específicamente de las infancias, adolescencias y juventudes.',
        hours: 8,
        contenidos: [
          'Concepto y características de los Derechos Humanos',
          'Principales instrumentos normativos nacionales e internacionales sobre los derechos humanos',
          'Relación entre los derechos humanos y las políticas, programas y acciones dirigidas a jóvenes, de los gobiernos federal, estatal y municipal',
          'Selección de un tema o problema para definir un plan de acción colectivo',
        ],
      },
      {
        order: 2,
        proposito:
          'Analiza las causas de las situaciones de inseguridad y violencia existentes en su entorno familiar, escolar o comunitario y que afectan su bienestar físico, mental, emocional o social, para promover acciones colectivas de autocuidado y una cultura de paz.',
        hours: 7,
        contenidos: [
          'Identificación de tipos y causas de violencia en el ámbito familiar, escolar y comunitario',
          'Diferencia entre delitos del fuero común y aquellos del fuero federal',
          'Incidencia delictiva del fuero común que afecta la vida y la integridad, la libertad personal, la libertad y seguridad sexuales, el patrimonio, a la familia y a la sociedad',
          'Consumo de sustancias psicoactivas (alcohol, cafeína, nicotina, mariguana, cocaína, anfetaminas, entre otras) y sus implicaciones',
          'Participación ciudadana y prevención del delito',
          'Acciones para la creación de espacios seguros',
        ],
      },
      {
        order: 3,
        proposito:
          'Reflexiona desde la perspectiva de género sobre las dimensiones de la violencia de género contra las mujeres y contra las diversidades sexogenéricas, para promover relaciones de respeto a partir del reconocimiento de los derechos humanos.',
        hours: 7,
        contenidos: [
          'Roles y estereotipos de género y su impacto en las relaciones sociales',
          'Diagnóstico sobre la violencia de género en la comunidad estudiantil',
        ],
      },
      {
        order: 4,
        proposito:
          'Investiga la forma en que los hábitos de consumo, formas de producción en la comunidad, y prácticas y comportamientos en la vida cotidiana influyen en el medio ambiente, el cambio climático y el bienestar personal y colectivo a nivel local, nacional e internacional.',
        hours: 7,
        contenidos: [
          '¿Qué es el desarrollo sustentable?',
          '¿Cómo se define el cambio climático y cuáles son los compromisos de México en relación con ese tema?',
          'Somos naturaleza',
          'Formas de contaminación en el medio rural y el medio urbano',
          'Actividades de producción de alimentos basadas en Sistemas Agroforestales (SAF), Milpa Intercalada con Árboles Frutales (MIAF) y Huertos Familiares',
        ],
      },
      {
        order: 5,
        proposito:
          'Desarrolla las habilidades de diálogo y escucha activa para la construcción de grupos de trabajo colaborativo durante la identificación y solución de problemas de su entorno.',
        hours: 7,
        contenidos: [
          'Relaciones intrapersonales e interpersonales',
          'Aprendizaje colaborativo (desarrollo de actividades que fomenten el trabajo en equipo)',
          'Diálogo y mediación como herramientas de creación de significados compartidos (escucha activa, intercambio de ideas, comunicación asertiva)',
          'Selección de un tema de la comunidad estudiantil y organización de un debate',
        ],
      },
    ],
  },
};

/**
 * Malla Curricular Oficial de Currículum Ampliado por Semestre (SEP 2025-2028):
 * - Semestre 1: Solo "Actividades Físicas y Deportivas"
 * - Semestre 2: Solo "Actividades Artísticas y Culturales"
 * - Semestres 3, 4, 5 y 6: Las 3 asignaturas rotativas con nombre limpio:
 *     "Educación para la Salud",
 *     "Educación Integral en Sexualidad y Género",
 *     "Práctica y Colaboración Ciudadana"
 */
export const MALLA_AMPLIADO_POR_SEMESTRE: Record<number, string[]> = {
  1: ['Actividades Físicas y Deportivas'],
  2: ['Actividades Artísticas y Culturales'],
  3: [
    'Educación para la Salud',
    'Educación Integral en Sexualidad y Género',
    'Práctica y Colaboración Ciudadana',
  ],
  4: [
    'Educación para la Salud',
    'Educación Integral en Sexualidad y Género',
    'Práctica y Colaboración Ciudadana',
  ],
  5: [
    'Educación para la Salud',
    'Educación Integral en Sexualidad y Género',
    'Práctica y Colaboración Ciudadana',
  ],
  6: [
    'Educación para la Salud',
    'Educación Integral en Sexualidad y Género',
    'Práctica y Colaboración Ciudadana',
  ],
};

async function seed() {
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL o POSTGRES_URL no encontrada en las variables de entorno.');
  }

  const sql = neon(dbUrl);

  console.log('=== SIEMBRA OFICIAL CURRÍCULUM AMPLIADO SEGÚN MAPA CURRICULAR SEP 2025 ===');

  // 1. Limpiar todos los registros previos de ampliado / socioemocional
  await sql`
    DELETE FROM programs_catalog
    WHERE component IN ('ampliado', 'socioemocional')
       OR curriculum_name = 'Currículum Ampliado';
  `;
  console.log('✓ Registros anteriores de Currículum Ampliado limpiados con éxito.');

  let totalInsertados = 0;

  // 2. Insertar estrictamente las asignaturas oficiales por semestre
  for (let semester = 1; semester <= 6; semester++) {
    const materiasPermitidas = MALLA_AMPLIADO_POR_SEMESTRE[semester];
    console.log(`\n--- Semestre ${semester}: ${materiasPermitidas.length} asignatura(s) permitida(s) ---`);

    for (const nombreUac of materiasPermitidas) {
      const ambito = AMBITOS_CURRICULUM_AMPLIADO_2025[nombreUac];
      if (!ambito) {
        throw new Error(`Ámbito no encontrado: ${nombreUac}`);
      }

      const activities = ambito.propositos.map(p => ({
        order: p.order,
        name: p.proposito,
        hours: p.hours,
      }));

      const contenidosFormativos = ambito.propositos.map(p => ({
        order: p.order,
        proposito: p.proposito,
        contenidos: p.contenidos,
      }));

      await sql`
        INSERT INTO programs_catalog (
          uac_name,
          semester,
          component,
          curriculum_name,
          year,
          total_hours,
          learning_outcome,
          activities,
          evidences,
          contenidos_formativos,
          subsystem,
          model_type
        ) VALUES (
          ${ambito.uac_name},
          ${semester},
          'ampliado',
          'Currículum Ampliado',
          2025,
          ${ambito.total_hours},
          ${ambito.learning_outcome},
          ${JSON.stringify(activities)}::jsonb,
          ${JSON.stringify(ambito.evidences)}::jsonb,
          ${JSON.stringify(contenidosFormativos)}::jsonb,
          'bge',
          'propositos_contenidos'
        );
      `;

      console.log(`  ✓ [Semestre ${semester}] ${ambito.uac_name} (36h, ${ambito.propositos.length} propósitos)`);
      totalInsertados++;
    }
  }

  console.log(`\n✅ Proceso completado exitosamente: ${totalInsertados} registros oficiales sembrados.`);
}

seed().catch(err => {
  console.error('Error durante la siembra de Currículum Ampliado:', err);
  process.exit(1);
});
