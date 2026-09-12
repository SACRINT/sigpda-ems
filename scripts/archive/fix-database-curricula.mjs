import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    }
  });
}

const sql = neon(process.env.DATABASE_URL);

async function fixDatabaseCurricula() {
  console.log('=== 1. CORRIGIENDO FORMACIONES LABORALES: EXACTAMENTE 3 ACTIVIDADES CLAVE ===');

  const laborales = await sql`
    SELECT id, uac_name, semester, curriculum_name, total_hours
    FROM programs_catalog
    WHERE component = 'laboral'
  `;

  console.log(`Procesando ${laborales.length} UACs de Formación Laboral...`);

  for (const lab of laborales) {
    const uacName = lab.uac_name;
    const hoursTotal = lab.total_hours || 54;
    const hPerAct = Math.round(hoursTotal / 3);

    const act1Name = `Actividad Clave 1: Diagnóstico técnico, fundamentación y preparación de procesos en ${uacName}`;
    const act2Name = `Actividad Clave 2: Operación técnica, ejecución práctica y procedimientos situados de ${uacName}`;
    const act3Name = `Actividad Clave 3: Aseguramiento de calidad, aplicación normativa y entrega de resultados en ${uacName}`;

    const activities = [
      { name: act1Name, hours: hPerAct, order: 1 },
      { name: act2Name, hours: hPerAct, order: 2 },
      { name: act3Name, hours: hoursTotal - (hPerAct * 2), order: 3 }
    ];

    const contenidos_formativos = [
      {
        proposito: act1Name,
        contenidos: [
          `Fundamentos técnicos y marco conceptual de ${uacName}`,
          `Herramientas, equipos, materiales y diagnóstico situacional`,
          `Planificación del trabajo y medidas de seguridad e higiene laboral`
        ]
      },
      {
        proposito: act2Name,
        contenidos: [
          `Procedimientos operativos estándar y ejecución práctica`,
          `Técnicas especializadas aplicadas al entorno laboral real`,
          `Resolución de incidencias y optimización de procesos operativos`
        ]
      },
      {
        proposito: act3Name,
        contenidos: [
          `Control de calidad, verificación de especificaciones y entregables`,
          `Normatividad laboral, ambiental y estándares de la industria`,
          `Evaluación del desempeño, reporte de resultados y mejora continua`
        ]
      }
    ];

    const evidences = [
      `Reporte de diagnóstico y plan de trabajo operativo`,
      `Bitácora de ejecución técnica y demostración práctica`,
      `Portafolio de evidencias de desempeño laboral y producto final verificado`
    ];

    const outcome = `Desarrollar y aplicar las competencias laborales y actividades clave de ${uacName}, ejecutando procedimientos técnicos con apego a estándares de calidad, seguridad y normatividad vigente.`;

    await sql`
      UPDATE programs_catalog SET
        learning_outcome = ${outcome},
        activities = ${JSON.stringify(activities)}::jsonb,
        contenidos_formativos = ${JSON.stringify(contenidos_formativos)}::jsonb,
        evidences = ${JSON.stringify(evidences)}::jsonb,
        model_type = 'actividades_clave'
      WHERE id = ${lab.id}::uuid
    `;
  }
  console.log(`✓ ${laborales.length} UACs laborales actualizadas con exactamente 3 Actividades Clave.`);

  console.log('\n=== 2. CORRIGIENDO COMPONENTE AMPLIADO (ARTÍSTICAS, DEPORTIVAS Y SOCIOEMOCIONAL) ===');

  await sql`
    UPDATE programs_catalog SET component = 'ampliado'
    WHERE uac_name ILIKE '%artística%'
       OR uac_name ILIKE '%deportiva%'
       OR uac_name ILIKE '%socioemocional%'
       OR component = 'socioemocional'
  `;
  console.log('✓ Componentes actualizados a "ampliado".');

  console.log('\n=== 3. REGISTRANDO FORMACIONES SOCIOEMOCIONALES EN SEMESTRES 3, 4, 5 Y 6 ===');

  const socioemocionales = [
    {
      name: 'Educación para la Salud',
      hours: 36,
      learning_outcome: 'Promover estilos de vida saludables, autocuidado, nutrición balanceada y prevención de enfermedades físicas y mentales en la comunidad escolar y su contexto.',
      activities: [
        { name: 'Propósito Formativo 1: Autocuidado, hábitos saludables y bienestar físico y emocional', hours: 12, order: 1 },
        { name: 'Propósito Formativo 2: Prevención de adicciones, salud mental y gestión del estrés', hours: 12, order: 2 },
        { name: 'Propósito Formativo 3: Promoción de la salud comunitaria y proyectos de vida activa', hours: 12, order: 3 }
      ],
      contenidos_formativos: [
        {
          proposito: 'Propósito Formativo 1: Autocuidado, hábitos saludables y bienestar físico y emocional',
          contenidos: [
            'Dimensiones de la salud: física, mental, emocional y social',
            'Nutrición consciente, hidratación y descanso reparador',
            'Higiene personal y prevención de enfermedades transmisibles y no transmisibles'
          ]
        },
        {
          proposito: 'Propósito Formativo 2: Prevención de adicciones, salud mental y gestión del estrés',
          contenidos: [
            'Factores de riesgo y de protección ante sustancias psicoactivas',
            'Identificación y manejo de emociones, ansiedad y estrés escolar',
            'Redes de apoyo, primeros auxilios psicológicos y autocontrol'
          ]
        },
        {
          proposito: 'Propósito Formativo 3: Promoción de la salud comunitaria y proyectos de vida activa',
          contenidos: [
            'Diagnóstico de salud en la familia, escuela y comunidad',
            'Diseño de campañas de concientización y prevención en el plantel',
            'Establecimiento de metas personales para un estilo de vida saludable duradero'
          ]
        }
      ],
      evidences: [
        'Plan individual de autocuidado y salud integral',
        'Campaña escolar de prevención y promoción de la salud',
        'Portafolio de registro de hábitos y bienestar físico-emocional'
      ]
    },
    {
      name: 'Educación Integral en Sexualidad y Género',
      hours: 36,
      learning_outcome: 'Desarrollar una vivencia responsable, informada y libre de violencia de la sexualidad, basada en el respeto a los derechos humanos, la equidad de género y la afectividad.',
      activities: [
        { name: 'Propósito Formativo 1: Derechos sexuales y reproductivos, afectividad y toma de decisiones informada', hours: 12, order: 1 },
        { name: 'Propósito Formativo 2: Prevención de ITS, embarazos no planeados y consentimiento consciente', hours: 12, order: 2 },
        { name: 'Propósito Formativo 3: Igualdad de género, diversidad, prevención de la violencia y relaciones saludables', hours: 12, order: 3 }
      ],
      contenidos_formativos: [
        {
          proposito: 'Propósito Formativo 1: Derechos sexuales y reproductivos, afectividad y toma de decisiones informada',
          contenidos: [
            'Marco de derechos sexuales y reproductivos en la juventud',
            'Vínculos afectivos, comunicación asertiva y respeto a la intimidad',
            'Autonomía corporal y toma de decisiones libre de coacción'
          ]
        },
        {
          proposito: 'Propósito Formativo 2: Prevención de ITS, embarazos no planeados y consentimiento consciente',
          contenidos: [
            'Métodos anticonceptivos, eficacia y uso correcto',
            'Infecciones de Transmisión Sexual (ITS): prevención, detección y atención',
            'La cultura del consentimiento y prevención de conductas de riesgo'
          ]
        },
        {
          proposito: 'Propósito Formativo 3: Igualdad de género, diversidad, prevención de la violencia y relaciones saludables',
          contenidos: [
            'Perspectiva de género, roles tradicionales y desconstrucción de estereotipos',
            'Identificación y erradicación de la violencia de género, noviazgo tóxico y acoso',
            'Diversidad, no discriminación e inclusión en la convivencia escolar'
          ]
        }
      ],
      evidences: [
        'Infografía informativa sobre derechos sexuales y métodos de protección',
        'Protocolo juvenil de prevención de violencia en el noviazgo y consentimiento',
        'Proyecto reflexivo sobre equidad de género y relaciones afectivas respetuosas'
      ]
    },
    {
      name: 'Práctica y Colaboración Ciudadana',
      hours: 36,
      learning_outcome: 'Fomentar el compromiso cívico, la participación democrática, la solidaridad y la transformación comunitaria mediante proyectos de impacto social situado.',
      activities: [
        { name: 'Propósito Formativo 1: Identidad comunitaria, cultura de paz y derechos humanos', hours: 12, order: 1 },
        { name: 'Propósito Formativo 2: Diagnóstico participativo y detección de necesidades sociales', hours: 12, order: 2 },
        { name: 'Propósito Formativo 3: Ejecución de proyectos ciudadanos de impacto comunitario y PAEC', hours: 12, order: 3 }
      ],
      contenidos_formativos: [
        {
          proposito: 'Propósito Formativo 1: Identidad comunitaria, cultura de paz y derechos humanos',
          contenidos: [
            'Principios cívicos, legalidad y responsabilidad social en la NEM',
            'Cultura de paz, resolución pacífica de conflictos y mediación escolar',
            'Preservación del patrimonio cultural, ecológico y social de la comunidad'
          ]
        },
        {
          proposito: 'Propósito Formativo 2: Diagnóstico participativo y detección de necesidades sociales',
          contenidos: [
            'Metodologías de diagnóstico comunitario y mapeo de actores sociales',
            'Identificación de problemáticas locales (medio ambiente, inclusión, seguridad)',
            'Formulación de objetivos y metas de acción colectiva situada'
          ]
        },
        {
          proposito: 'Propósito Formativo 3: Ejecución de proyectos ciudadanos de impacto comunitario y PAEC',
          contenidos: [
            'Diseño e implementación de proyectos de servicio comunitario y PAEC',
            'Trabajo colaborativo, alianzas comunitarias y liderazgo social juvenil',
            'Evaluación del impacto social y rendición de cuentas a la comunidad'
          ]
        }
      ],
      evidences: [
        'Árbol de problemas y diagnóstico comunitario participativo',
        'Plan de intervención ciudadana articulado con el PAEC',
        'Informe final de impacto comunitario con evidencias fotográficas y testimonios'
      ]
    }
  ];

  const targetSemesters = [3, 4, 5, 6];
  const targetSubsystems = ['bge', 'tecnologico', 'cbtis', 'cbta', 'cecyte', 'digital', 'emsad'];

  for (const sem of targetSemesters) {
    for (const sub of targetSubsystems) {
      for (const socio of socioemocionales) {
        await sql`
          INSERT INTO programs_catalog (
            uac_name, semester, component, curriculum_name, year, total_hours,
            learning_outcome, activities, evidences, contenidos_formativos, subsystem, model_type
          ) VALUES (
            ${socio.name},
            ${sem},
            'ampliado',
            'Currículum Ampliado - Formación Socioemocional',
            2026,
            ${socio.hours},
            ${socio.learning_outcome},
            ${JSON.stringify(socio.activities)}::jsonb,
            ${JSON.stringify(socio.evidences)}::jsonb,
            ${JSON.stringify(socio.contenidos_formativos)}::jsonb,
            ${sub},
            ${sem >= 5 ? 'progresiones' : 'propositos_contenidos'}
          )
          ON CONFLICT (uac_name, semester, component, subsystem)
          DO UPDATE SET
            total_hours = EXCLUDED.total_hours,
            learning_outcome = EXCLUDED.learning_outcome,
            activities = EXCLUDED.activities,
            evidences = EXCLUDED.evidences,
            contenidos_formativos = EXCLUDED.contenidos_formativos,
            model_type = EXCLUDED.model_type
        `;
      }
    }
  }

  console.log('✓ Formaciones socioemocionales de Semestres 3, 4, 5 y 6 insertadas/actualizadas para todos los subsistemas.');

  // Contar totales finales
  const total = await sql`SELECT COUNT(*) as count FROM programs_catalog`;
  const countLaboral = await sql`SELECT COUNT(*) as count FROM programs_catalog WHERE component = 'laboral'`;
  const countAmpliado = await sql`SELECT COUNT(*) as count FROM programs_catalog WHERE component = 'ampliado'`;
  console.log(`\n=== ESTADÍSTICAS FINALES EN BD ===`);
  console.log(`Total registros en programs_catalog: ${total[0].count}`);
  console.log(`Total Laborales: ${countLaboral[0].count}`);
  console.log(`Total Ampliados: ${countAmpliado[0].count}`);
}

fixDatabaseCurricula().catch(console.error);
