import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';
import { extractMaterialsFromWorkbook } from '../src/lib/guide-engine/material-extractor';
import { formatPlanDeClaseMarkdown } from '../src/lib/guide-engine/cascade-block-materials';
import type { ActiveWorkTextbook } from '../src/types/work-textbook';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
if (!match) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}
const sql = neon(match[1]);

const PROBLEM_STATEMENT = 'La vulnerabilidad de los jóvenes ante conductas de riesgo, derivada de la falta de espacios recreativos, hábitos de vida poco saludables y un entorno con factores de estrés socioeconómico, así como la normalización del consumo temprano de alcohol en eventos sociales.';

const UAC_COLOCA = 'Coloca elementos constructivos básicos de una vivienda';
const UAC_LIMPIA = 'Limpia muebles, tuberías y conexiones para llevar a cabo diferentes instalaciones de una vivienda';
const UAC_PM3 = 'Pensamiento Matemático III. Pensamientos algebraico e introducción a geometría plana';

async function main() {
  console.log('=== INICIANDO FASE 2: REPARACIÓN DE COLOCA, LIMPIA Y PM III ===');

  // 1. Respaldo de seguridad en base de datos
  console.log('1. Creando tabla de respaldo plannings_backup_phase2...');
  await sql`
    CREATE TABLE IF NOT EXISTS plannings_backup_phase2 AS
    SELECT * FROM plannings
    WHERE id IN (
      '4a3335eb-99f3-47f8-a3d0-c83297fe488b',
      '9fcc6660-fb0f-40ac-8601-c99279f83ed1',
      'dfd5e2d6-6a84-4a3d-a4a9-8e128e523fa4'
    )
  `;
  console.log('✓ Respaldo de plannings creado.');

  // 2. Cargar las 3 planeaciones
  const rows = await sql`
    SELECT id, uac_name, semester, component, paec_context, content_json, sequence_json, extracted_data, workbooks_json
    FROM plannings
    WHERE id IN (
      '4a3335eb-99f3-47f8-a3d0-c83297fe488b',
      '9fcc6660-fb0f-40ac-8601-c99279f83ed1',
      'dfd5e2d6-6a84-4a3d-a4a9-8e128e523fa4'
    )
  `;

  const plan4a = rows.find(r => r.id === '4a3335eb-99f3-47f8-a3d0-c83297fe488b'); // Ahora será LIMPIA
  const plan9f = rows.find(r => r.id === '9fcc6660-fb0f-40ac-8601-c99279f83ed1'); // Ahora será COLOCA
  const planPM = rows.find(r => r.id === 'dfd5e2d6-6a84-4a3d-a4a9-8e128e523fa4'); // PM III

  // -------------------------------------------------------------
  // 2.1 Ajustar 4a3335eb... -> LIMPIA MUEBLES
  // -------------------------------------------------------------
  console.log('2.1 Ajustando 4a3335eb... para ser LIMPIA MUEBLES...');
  let content4a = plan4a.content_json || {};
  let seq4a = plan4a.sequence_json || {};
  let wb4a = plan4a.workbooks_json || {};
  let extData4a = plan4a.extracted_data || {};

  // Reemplazo de texto verbatim del nombre anterior por el nuevo
  content4a = JSON.parse(JSON.stringify(content4a).split(UAC_COLOCA).join(UAC_LIMPIA));
  seq4a = JSON.parse(JSON.stringify(seq4a).split(UAC_COLOCA).join(UAC_LIMPIA));
  wb4a = JSON.parse(JSON.stringify(wb4a).split(UAC_COLOCA).join(UAC_LIMPIA));
  extData4a = JSON.parse(JSON.stringify(extData4a).split(UAC_COLOCA).join(UAC_LIMPIA));

  content4a.sectionI = content4a.sectionI || {};
  content4a.sectionI.uacName = UAC_LIMPIA;
  content4a.sectionI.paecOperationalActivity = {
    fase: 'Fase 3 y Fase 4',
    actividad: 'Actividad Clave 1: Mantenimiento preventivo, desazolve, limpieza y acondicionamiento de redes hidráulicas, sanitarias y mobiliario urbano fijo.',
    asignatura: UAC_LIMPIA,
    isPrescheduled: true,
    propositoFormativo: 'Mantenimiento preventivo, desazolve, limpieza y acondicionamiento de redes hidráulicas, sanitarias y mobiliario urbano fijo.',
    estrategiaDidactica: 'Aprendizaje en el Servicio (ApS) / Práctica Situada'
  };
  extData4a.uacName = UAC_LIMPIA;

  await sql`
    UPDATE plannings
    SET uac_name = ${UAC_LIMPIA},
        paec_context = ${PROBLEM_STATEMENT},
        content_json = ${JSON.stringify(content4a)}::jsonb,
        sequence_json = ${JSON.stringify(seq4a)}::jsonb,
        workbooks_json = ${JSON.stringify(wb4a)}::jsonb,
        extracted_data = ${JSON.stringify(extData4a)}::jsonb,
        updated_at = NOW()
    WHERE id = '4a3335eb-99f3-47f8-a3d0-c83297fe488b'
  `;

  // Actualizar títulos en planning_extras de 4a
  await sql`
    UPDATE planning_extras
    SET title = REPLACE(title, ${UAC_COLOCA}, ${UAC_LIMPIA}),
        content_text = REPLACE(content_text, ${UAC_COLOCA}, ${UAC_LIMPIA})
    WHERE planning_id = '4a3335eb-99f3-47f8-a3d0-c83297fe488b'
  `;
  console.log('✓ 4a3335eb... renombrada y reorientada a LIMPIA.');

  // -------------------------------------------------------------
  // 2.2 Ajustar 9fcc6660... -> COLOCA ELEMENTOS
  // -------------------------------------------------------------
  console.log('2.2 Ajustando 9fcc6660... para ser COLOCA ELEMENTOS...');
  let content9f = plan9f.content_json || {};
  let seq9f = plan9f.sequence_json || {};
  let wb9f = plan9f.workbooks_json || {};
  let extData9f = plan9f.extracted_data || {};

  content9f = JSON.parse(JSON.stringify(content9f).split(UAC_LIMPIA).join(UAC_COLOCA));
  seq9f = JSON.parse(JSON.stringify(seq9f).split(UAC_LIMPIA).join(UAC_COLOCA));
  wb9f = JSON.parse(JSON.stringify(wb9f).split(UAC_LIMPIA).join(UAC_COLOCA));
  extData9f = JSON.parse(JSON.stringify(extData9f).split(UAC_LIMPIA).join(UAC_COLOCA));

  content9f.sectionI = content9f.sectionI || {};
  content9f.sectionI.uacName = UAC_COLOCA;
  content9f.sectionI.paecOperationalActivity = {
    fase: 'Fase 4 y Fase 5',
    actividad: 'Actividad Clave 1: Construcción física de bancas, muretes de contención y bases para los aparatos del Circuito Comunitario de Bienestar Juvenil.',
    asignatura: UAC_COLOCA,
    isPrescheduled: true,
    propositoFormativo: 'Construcción física de bancas, muretes de contención y bases para los aparatos del Circuito Comunitario de Bienestar Juvenil.',
    estrategiaDidactica: 'Aprendizaje-Servicio (ApS) en Campo'
  };
  content9f.sectionII = content9f.sectionII || {};
  content9f.sectionII.purpose = 'Reunir, trasladar e instalar elementos constructivos básicos, muebles y accesorios en el sitio de la obra de acuerdo con las especificaciones del plano arquitectónico y las normas de seguridad del plantel.';
  extData9f.uacName = UAC_COLOCA;

  await sql`
    UPDATE plannings
    SET uac_name = ${UAC_COLOCA},
        paec_context = ${PROBLEM_STATEMENT},
        content_json = ${JSON.stringify(content9f)}::jsonb,
        sequence_json = ${JSON.stringify(seq9f)}::jsonb,
        workbooks_json = ${JSON.stringify(wb9f)}::jsonb,
        extracted_data = ${JSON.stringify(extData9f)}::jsonb,
        updated_at = NOW()
    WHERE id = '9fcc6660-fb0f-40ac-8601-c99279f83ed1'
  `;

  // Actualizar títulos en planning_extras de 9f
  await sql`
    UPDATE planning_extras
    SET title = REPLACE(title, ${UAC_LIMPIA}, ${UAC_COLOCA}),
        content_text = REPLACE(content_text, ${UAC_LIMPIA}, ${UAC_COLOCA})
    WHERE planning_id = '9fcc6660-fb0f-40ac-8601-c99279f83ed1'
  `;
  console.log('✓ 9fcc6660... renombrada y reorientada a COLOCA.');

  // -------------------------------------------------------------
  // 2.3 Reparación de Pensamiento Matemático III
  // -------------------------------------------------------------
  console.log('2.3 Reparando Pensamiento Matemático III (paec_context y asignatura)...');
  let contentPM = planPM.content_json || {};
  if (contentPM.sectionI?.paecOperationalActivity) {
    contentPM.sectionI.paecOperationalActivity.asignatura = UAC_PM3;
  }

  await sql`
    UPDATE plannings
    SET paec_context = ${PROBLEM_STATEMENT},
        content_json = ${JSON.stringify(contentPM)}::jsonb,
        updated_at = NOW()
    WHERE id = 'dfd5e2d6-6a84-4a3d-a4a9-8e128e523fa4'
  `;
  console.log('✓ Pensamiento Matemático III reparado.');

  // -------------------------------------------------------------
  // 2.4 Repersistir Bloque 1 faltante en 4a3335eb... (Limpia)
  // -------------------------------------------------------------
  console.log('2.4 Extrayendo y persistiendo Bloque 1 faltante para 4a3335eb... (Limpia)...');
  const wbBlock1 = wb4a?.block_1?.current as ActiveWorkTextbook;
  if (!wbBlock1) {
    throw new Error('No se encontró workbooks_json.block_1.current en 4a3335eb...');
  }

  const seqBlock1 = seq4a?.['1'] || seq4a?.[1] || null;
  const curricularAnchor = {
    metaEducativa: content4a.sectionII?.learningOutcomes?.[1] || 'Aplica técnicas de mantenimiento e instalación.',
    propositoFormativo: content4a.sectionII?.purpose || 'Mantenimiento preventivo y limpieza de tuberías y conexiones.',
    contenidoFormativo: 'Instalaciones hidráulicas y sanitarias en la vivienda.'
  };

  const extracted = extractMaterialsFromWorkbook(wbBlock1, seqBlock1, curricularAnchor);
  console.log(`   Planes de clase extraídos: ${extracted.planesDeClase.length}`);

  const blockNum = 2; // Bloque 2 (key_index = 1)
  const blockTitle = wbBlock1.blockName || 'Bloque II';

  // Eliminar cualquier residuo previo de key_index = 1 antes de insertar
  await sql`
    DELETE FROM planning_extras
    WHERE planning_id = '4a3335eb-99f3-47f8-a3d0-c83297fe488b' AND key_index = 1
  `;

  // 1. Rúbrica
  if (extracted.rubricaEvaluacion) {
    await sql`
      INSERT INTO planning_extras (planning_id, type, title, key_index, content_text)
      VALUES (
        '4a3335eb-99f3-47f8-a3d0-c83297fe488b'::uuid,
        'rubric',
        ${'Rúbrica Analítica de Evaluación · Bloque ' + blockNum + ': ' + blockTitle},
        1,
        ${extracted.rubricaEvaluacion}
      )
    `;
  }

  // 2. Lista de cotejo
  if (extracted.listaCotejo) {
    await sql`
      INSERT INTO planning_extras (planning_id, type, title, key_index, content_text)
      VALUES (
        '4a3335eb-99f3-47f8-a3d0-c83297fe488b'::uuid,
        'checklist',
        ${'Lista de Cotejo Formativa · Bloque ' + blockNum + ': ' + blockTitle},
        1,
        ${extracted.listaCotejo}
      )
    `;
  }

  // 3. Guía del estudiante (practice_guide)
  if (extracted.guiaDelBloque) {
    await sql`
      INSERT INTO planning_extras (planning_id, type, title, key_index, content_text)
      VALUES (
        '4a3335eb-99f3-47f8-a3d0-c83297fe488b'::uuid,
        'practice_guide',
        ${'Fichas de Trabajo Imprimibles · Bloque ' + blockNum + ': ' + blockTitle},
        1,
        ${extracted.guiaDelBloque}
      )
    `;
  }

  // 4. Solucionario docente (teacher_guide)
  if (extracted.solucionarioDocente) {
    await sql`
      INSERT INTO planning_extras (planning_id, type, title, key_index, content_text)
      VALUES (
        '4a3335eb-99f3-47f8-a3d0-c83297fe488b'::uuid,
        'teacher_guide',
        ${'Solucionario y Guía Pedagógica del Docente · Bloque ' + blockNum + ': ' + blockTitle},
        1,
        ${extracted.solucionarioDocente}
      )
    `;
  }

  // 5. Material didáctico
  if (extracted.materialDidactico) {
    await sql`
      INSERT INTO planning_extras (planning_id, type, title, key_index, content_text)
      VALUES (
        '4a3335eb-99f3-47f8-a3d0-c83297fe488b'::uuid,
        'material',
        ${'Materiales Didácticos e Insumos del Docente · Bloque ' + blockNum + ': ' + blockTitle},
        1,
        ${extracted.materialDidactico}
      )
    `;
  }

  // 6. Planes de clase individuales (18 sesiones)
  for (const plan of extracted.planesDeClase) {
    const formattedMarkdown = formatPlanDeClaseMarkdown(plan, wbBlock1, null);
    await sql`
      INSERT INTO planning_extras (planning_id, type, title, key_index, content_text)
      VALUES (
        '4a3335eb-99f3-47f8-a3d0-c83297fe488b'::uuid,
        'lesson_plan',
        ${'Plan de Clase: Sesión ' + plan.numeroSesion + ' · ' + plan.tituloSesion},
        1,
        ${formattedMarkdown}
      )
    `;
  }

  // Verificar conteo total de extras en 4a3335eb...
  const totalExtras4a = await sql`
    SELECT key_index, count(*) as cnt
    FROM planning_extras
    WHERE planning_id = '4a3335eb-99f3-47f8-a3d0-c83297fe488b'
    GROUP BY key_index
    ORDER BY key_index
  `;
  console.log('✓ Extras de 4a3335eb... por key_index:', totalExtras4a);
  console.log('=== FASE 2 COMPLETADA CON ÉXITO ===');
}

main().catch(err => {
  console.error('Error en Fase 2:', err);
  process.exit(1);
});

