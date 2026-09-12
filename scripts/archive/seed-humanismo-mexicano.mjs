import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function seedHumanismo() {
  console.log('Seeding Humanismo Mexicano into programs_catalog...');

  const learningOutcome = 'Analice los principios históricos, filosóficos, éticos y sociales del Humanismo Mexicano mediante la reflexión, el análisis de problemáticas de su contexto y la participación comunitaria, para contribuir a la construcción de una sociedad justa, democrática, incluyente y solidaria, fortaleciendo su formación como estudiante de Bachillerato Tecnológico y promoviendo una actuación ética, responsable y comprometida con el desarrollo sostenible, la justicia social y el bienestar colectivo en los diversos ámbitos de desempeño técnico y profesional.';

  const activities = [
    {
      name: 'Bloque I: Fundamentos históricos, cosmovisiones de los pueblos originarios y transformaciones nacionales del Humanismo Mexicano',
      hours: 12,
      order: 1,
    },
    {
      name: 'Bloque II: Principios éticos, problemáticas sociales contemporáneas y determinantes de la salud comunitaria',
      hours: 12,
      order: 2,
    },
    {
      name: 'Bloque III: Metodología ABP, investigación contextual y proyectos de intervención orientados al bienestar colectivo',
      hours: 12,
      order: 3,
    },
  ];

  const evidences = [
    'Portafolio de evidencias de aprendizaje y análisis documental',
    'Árbol de problemas y matriz de análisis contextual comunitario',
    'Proyecto integrador comunitario basado en ABP: Propuesta de intervención social',
    'Rúbrica de evaluación continua y formativa',
  ];

  const contenidosFormativos = [
    {
      order: 1,
      hours: 4,
      proposito: 'Analiza los fundamentos históricos, filosóficos y sociales del Humanismo Mexicano mediante la revisión crítica de procesos históricos, corrientes de pensamiento, experiencias comunitarias y textos especializados, para comprender su relevancia en la construcción de la identidad nacional, la justicia social y el bienestar colectivo.',
      contenidos: [
        'Concepto de humanismo.',
        'Humanismo clásico y contemporáneo.',
        'Humanismo universal y Humanismo Mexicano.',
        'Dignidad humana.',
        'Comunidad y bien común.',
        'Orígenes históricos del Humanismo Mexicano.',
        'Principios fundamentales del Humanismo Mexicano.',
        'Persona y sociedad.',
        'Solidaridad como valor social.',
      ],
    },
    {
      order: 2,
      hours: 4,
      proposito: 'Reconoce las aportaciones históricas, culturales y comunitarias de los pueblos originarios mediante el análisis de sus cosmovisiones, formas de organización y saberes tradicionales, para valorar la diversidad cultural e intercultural que caracteriza a la nación mexicana.',
      contenidos: [
        'Civilizaciones originarias.',
        'Organización comunitaria.',
        'Trabajo colectivo.',
        'Comunalidad.',
        'Cosmovisiones indígenas.',
        'Relación ser humano-naturaleza.',
        'Diversidad cultural.',
        'Diversidad lingüística.',
        'Patrimonio biocultural.',
        'Patrimonio cultural inmaterial.',
      ],
    },
    {
      order: 3,
      hours: 4,
      proposito: 'Examina los procesos históricos de transformación nacional mediante el análisis de acontecimientos, movimientos sociales y documentos históricos fundamentales, para comprender la construcción de la soberanía nacional, la democracia y los derechos sociales en México.',
      contenidos: [
        'Independencia de México.',
        'Sentimientos de la Nación.',
        'Reforma Liberal.',
        'Constitución de 1857.',
        'Revolución Mexicana.',
        'Constitución de 1917.',
        'Derechos sociales.',
        'Soberanía nacional.',
        'Participación popular.',
        'Movimientos sociales.',
        'Justicia agraria.',
        'Derechos laborales.',
        'Transformaciones contemporáneas.',
      ],
    },
    {
      order: 4,
      hours: 4,
      proposito: 'Analiza los principios éticos que sustentan el Humanismo Mexicano mediante la reflexión crítica sobre problemáticas sociales y situaciones de la vida pública, para fortalecer una actuación responsable, honesta y comprometida con el bienestar colectivo.',
      contenidos: [
        'Responsabilidad social.',
        'Honestidad.',
        'Integridad.',
        'Servicio público.',
        'Transparencia.',
        'Rendición de cuentas.',
        'Corrupción y sus impactos sociales.',
        'Igualdad.',
        'Equidad.',
        'Inclusión.',
        'Cultura de paz.',
        'Derechos humanos.',
      ],
    },
    {
      order: 5,
      hours: 5,
      proposito: 'Analiza problemáticas sociales contemporáneas mediante la observación de su entorno, la revisión de información especializada y el estudio de casos, para identificar desafíos relacionados con la desigualdad, la exclusión y el desarrollo humano.',
      contenidos: [
        'Pobreza.',
        'Marginación.',
        'Exclusión social.',
        'Violencia.',
        'Discriminación.',
        'Migración.',
        'Desarrollo sostenible.',
        'Objetivos de Desarrollo Sostenible.',
        'Ciudadanía global.',
        'Participación ciudadana.',
      ],
    },
    {
      order: 6,
      hours: 5,
      proposito: 'Examina la relación entre comunidad, salud y bienestar mediante el análisis de los determinantes sociales de la salud y de experiencias comunitarias, para reconocer la importancia de la acción colectiva en la construcción de comunidades saludables.',
      contenidos: [
        'Salud comunitaria.',
        'Derecho a la salud.',
        'Determinantes sociales de la salud.',
        'Promoción de la salud.',
        'Prevención de enfermedades.',
        'Atención primaria de la salud.',
        'Redes de apoyo social.',
        'Vulnerabilidad social.',
        'Justicia sanitaria.',
        'Participación comunitaria.',
        'Bienestar social.',
        'Calidad de vida.',
      ],
    },
    {
      order: 7,
      hours: 5,
      proposito: 'Desarrolla habilidades de análisis crítico e investigación social mediante la observación, el trabajo colaborativo y el uso ético de fuentes de información, para comprender la complejidad de las problemáticas presentes en su comunidad.',
      contenidos: [
        'Observación social.',
        'Problematización de la realidad.',
        'Investigación documental.',
        'Investigación comunitaria.',
        'Fuentes de información.',
        'Pensamiento crítico.',
        'Construcción de argumentos.',
        'Debate.',
        'Deliberación.',
        'Estudios de caso.',
        'Cartografía social.',
        'Narrativas comunitarias.',
      ],
    },
    {
      order: 8,
      hours: 5,
      proposito: 'Propone acciones orientadas al bienestar colectivo mediante el diseño de proyectos comunitarios y estrategias de participación social, para contribuir al fortalecimiento de comunidades más justas, democráticas, incluyentes y solidarias.',
      contenidos: [
        'Diagnóstico comunitario.',
        'Participación social.',
        'Ciudadanía activa.',
        'Liderazgo participativo.',
        'Gestión comunitaria.',
        'Innovación social.',
        'Trabajo colaborativo.',
        'Servicio comunitario.',
        'Cultura democrática.',
        'Intervención social.',
        'Proyectos comunitarios.',
        'Construcción del bien común.',
      ],
    },
  ];

  // 1. Eliminar cualquier registro erróneo en semestre 3
  const deleted = await sql`
    DELETE FROM programs_catalog
    WHERE uac_name = 'Humanismo Mexicano' AND semester = 3
    RETURNING id, uac_name, semester, subsystem
  `;
  console.log(`✓ Eliminados ${deleted.length} registros erróneos de semestre 3.`);

  // 2. Insertar en semestre 1 oficial
  const subsystems = ['tecnologico', 'cbtis', 'cbta', 'cecyte'];

  for (const sub of subsystems) {
    await sql`
      INSERT INTO programs_catalog (
        uac_name, semester, component, curriculum_name, year, total_hours,
        learning_outcome, activities, evidences, contenidos_formativos, subsystem, model_type
      ) VALUES (
        'Humanismo Mexicano',
        1,
        'fundamental',
        'MCCEMS Puebla Oficial',
        2026,
        36,
        ${learningOutcome},
        ${JSON.stringify(activities)}::jsonb,
        ${JSON.stringify(evidences)}::jsonb,
        ${JSON.stringify(contenidosFormativos)}::jsonb,
        ${sub},
        'propositos_contenidos'
      )
      ON CONFLICT (uac_name, semester, component, subsystem)
      DO UPDATE SET
        curriculum_name = EXCLUDED.curriculum_name,
        year = EXCLUDED.year,
        total_hours = EXCLUDED.total_hours,
        learning_outcome = EXCLUDED.learning_outcome,
        activities = EXCLUDED.activities,
        evidences = EXCLUDED.evidences,
        contenidos_formativos = EXCLUDED.contenidos_formativos,
        model_type = EXCLUDED.model_type
    `;
    console.log(`✓ Insertado/Actualizado Humanismo Mexicano para 1er Semestre en subsistema: ${sub}`);
  }

  console.log('Seeding completed successfully!');
}

seedHumanismo().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
