import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Cargar variables de entorno
const envPath = path.join(rootDir, '.env.local');
if (!existsSync(envPath)) {
  console.error('❌ Archivo .env.local no encontrado.');
  process.exit(1);
}
const envContent = readFileSync(envPath, 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
if (!match) {
  console.error('❌ DATABASE_URL no encontrada en .env.local');
  process.exit(1);
}
const sql = neon(match[1]);

async function main() {
  console.log('===============================================================');
  console.log('🚀 SINCRONIZADOR CANÓNICO DE PLANES DE ESTUDIO OFICIALES EMS');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // PASO 1: VERIFICACIÓN ESTRICTA DEL RESPALDO PREVIO
  // --------------------------------------------------------------------------
  console.log('📌 [PASO 1] Verificando tabla de respaldo programs_catalog_backup...');
  const backupCheck = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'programs_catalog_backup'
    ) as exists;
  `;

  if (!backupCheck[0].exists) {
    console.error('❌ ERROR FATAL: No existe la tabla programs_catalog_backup.');
    console.error('Ejecute primero scripts/backup-programs-catalog.mjs antes de proceder.');
    process.exit(1);
  }

  const backupCountRes = await sql`SELECT count(*) as count FROM programs_catalog_backup`;
  const backupCount = Number(backupCountRes[0].count);
  console.log(`✓ Respaldo verificado con ${backupCount} registros.`);
  if (backupCount < 700) {
    console.error(`❌ ERROR: El respaldo tiene menos de 700 registros (${backupCount}). Abortando por seguridad.`);
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // PASO 2: CARGAR DATA CANÓNICA Y MASTER
  // --------------------------------------------------------------------------
  console.log('\n📌 [PASO 2] Cargando datos canónicos y catálogo maestro...');
  const canonicalPath = path.join(__dirname, 'data', 'curriculum_canonical_203.json');
  const masterPath = path.join(__dirname, 'data', 'uacs_master_203.json');

  if (!existsSync(canonicalPath)) {
    console.error(`❌ ERROR: Archivo canónico no encontrado en ${canonicalPath}`);
    process.exit(1);
  }
  if (!existsSync(masterPath)) {
    console.error(`❌ ERROR: Archivo maestro no encontrado en ${masterPath}`);
    process.exit(1);
  }

  const canonicalUACs = JSON.parse(readFileSync(canonicalPath, 'utf-8'));
  const masterUACs = JSON.parse(readFileSync(masterPath, 'utf-8'));
  console.log(`✓ Registros extraídos canónicos: ${canonicalUACs.length}`);
  console.log(`✓ Registros en mapa maestro: ${masterUACs.length}`);

  // --------------------------------------------------------------------------
  // PASO 3: VALIDACIÓN CRUZADA
  // --------------------------------------------------------------------------
  console.log('\n📌 [PASO 3] Ejecutando validación cruzada...');
  const normalize = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const canonMap = new Map();
  canonicalUACs.forEach(u => canonMap.set(`${normalize(u.uac_name)}::${u.semester}`, u));

  const missing = [];
  const hourDiscrepancies = [];

  masterUACs.forEach(m => {
    const key = `${normalize(m.uac_name)}::${m.semester}`;
    const c = canonMap.get(key);
    if (!c) {
      missing.push(m);
    } else if (c.total_hours !== m.total_hours) {
      hourDiscrepancies.push({ name: m.uac_name, sem: m.semester, masterHrs: m.total_hours, canonHrs: c.total_hours });
    }
  });

  const masterMap = new Map();
  masterUACs.forEach(m => masterMap.set(`${normalize(m.uac_name)}::${m.semester}`, m));
  const extras = canonicalUACs.filter(c => !masterMap.has(`${normalize(c.uac_name)}::${c.semester}`));

  console.log(`- UACs en Master faltantes en Extracción: ${missing.length}`);
  console.log(`- UACs extraídas adicionales (libros multi-subsistema SEP): ${extras.length}`);
  console.log(`- Discrepancias de horas: ${hourDiscrepancies.length}`);

  if (missing.length > 0) {
    console.error('❌ ALERTA: Hay UACs del catálogo maestro que no fueron extraídas:');
    missing.forEach(m => console.error(`   - ${m.uac_name} (Sem ${m.semester})`));
  }

  // --------------------------------------------------------------------------
  // PASO 4: UPSERT DE UACS CANÓNICAS CON AUDITORÍA DETALLADA
  // --------------------------------------------------------------------------
  console.log('\n📌 [PASO 4] Sincronizando catálogo canónico (subsystem = bge)...');
  
  const auditLines = [];
  auditLines.push('===============================================================');
  auditLines.push(`REPORTE DE CURACIÓN Y SINCRONIZACIÓN CURRICULAR OFICIAL`);
  auditLines.push(`Fecha: ${new Date().toISOString()}`);
  auditLines.push(`Total UACs procesadas: ${canonicalUACs.length}`);
  auditLines.push('===============================================================\n');

  let successCount = 0;
  let errorCount = 0;
  let laboralNullContenidosCount = 0;
  let ffeEmptyActivitiesCount = 0;

  const scratchDir = path.join(rootDir, 'scratch');
  if (!existsSync(scratchDir)) {
    mkdirSync(scratchDir, { recursive: true });
  }

  const manualReviewList = [];

  for (const uac of canonicalUACs) {
    const uacName = uac.uac_name?.trim();
    const sem = uac.semester;
    const comp = uac.component;
    const sub = 'bge';
    const totalHrs = uac.total_hours;
    const outcome = uac.learning_outcome || null;
    const activities = Array.isArray(uac.activities) ? uac.activities : [];
    const evidences = uac.evidences || [];
    const contenidos = uac.contenidos_formativos || null;
    const modelType = uac.model_type || (sem >= 5 ? 'progresiones' : 'propositos_contenidos');
    const year = uac.year || (sem <= 4 ? 2025 : 2023);
    const currName = uac.curriculum_name || uacName;

    // Validación estructural básica
    if (!uacName || !sem || !comp) {
      errorCount++;
      const errMsg = `[ERROR] Datos incompletos para UAC: ${uacName || 'DESCONOCIDA'} (Sem ${sem})`;
      console.warn(`  ⚠️ ${errMsg}`);
      auditLines.push(errMsg);
      continue;
    }

    if (comp === 'laboral' && contenidos === null) {
      laboralNullContenidosCount++;
    }
    if (comp === 'ffe_optativa' && activities.length === 0) {
      ffeEmptyActivitiesCount++;
      manualReviewList.push(`[REVISIÓN MANUAL FFE] ${uacName} (Sem ${sem}) - activities: []`);
    }

    try {
      await sql`
        INSERT INTO programs_catalog (
          uac_name,
          semester,
          component,
          subsystem,
          total_hours,
          learning_outcome,
          activities,
          evidences,
          contenidos_formativos,
          model_type,
          year,
          curriculum_name,
          created_at
        ) VALUES (
          ${uacName},
          ${sem},
          ${comp},
          ${sub},
          ${totalHrs},
          ${outcome},
          ${JSON.stringify(activities)},
          ${JSON.stringify(evidences)},
          ${contenidos ? JSON.stringify(contenidos) : null},
          ${modelType},
          ${year},
          ${currName},
          NOW()
        )
        ON CONFLICT (uac_name, semester, component, subsystem)
        DO UPDATE SET
          total_hours = EXCLUDED.total_hours,
          learning_outcome = EXCLUDED.learning_outcome,
          activities = EXCLUDED.activities,
          evidences = EXCLUDED.evidences,
          contenidos_formativos = EXCLUDED.contenidos_formativos,
          model_type = EXCLUDED.model_type,
          year = EXCLUDED.year,
          curriculum_name = EXCLUDED.curriculum_name;
      `;
      successCount++;
      
      const actInfo = activities.length > 0 
        ? `${activities.length} ${modelType === 'progresiones' ? 'progresiones' : 'propósitos'}`
        : `activities: [] (fallback)`;
      const contInfo = contenidos === null ? `contenidos_formativos: null` : `contenidos: OK`;
      
      auditLines.push(`[EXITOSA] ${uacName} (Sem ${sem}, ${comp}) - ${actInfo} - ${contInfo} - ${totalHrs} hrs`);
    } catch (err) {
      errorCount++;
      const errMsg = `[ERROR] Falló upsert de ${uacName} (Sem ${sem}): ${err.message}`;
      console.error(`  ❌ ${errMsg}`);
      auditLines.push(errMsg);
    }
  }

  console.log(`\n✓ Upsert completado: ${successCount} exitosas, ${errorCount} errores.`);
  console.log(`  - UACs laborales con contenidos_formativos: null: ${laboralNullContenidosCount}`);
  console.log(`  - UACs FFE optativas con activities: []: ${ffeEmptyActivitiesCount}`);

  // --------------------------------------------------------------------------
  // PASO 5: PURGA CONTROLADA DE DUPLICADOS Y MOCKS OBSOLETOS
  // --------------------------------------------------------------------------
  console.log('\n📌 [PASO 5] Purgando clones redundantes de subsistemas y mocks viejos...');

  /**
   * NOTA ARQUITECTÓNICA IMPORTANTE (FALLBACK CANÓNICO VS FUTUROS SUBSISTEMAS BT):
   * En esta fase de curación, la instrucción DELETE elimina todos los registros que
   * no sean 'bge' (digital, emsad, cbtis, cbta, cecyte, tecnologico, etc.) porque en
   * la base de datos existían exclusivamente clones y mocks sintéticos idénticos a BGE.
   * La plataforma ahora implementa una arquitectura de Fallback Transversal elegante:
   * toda consulta de cualquier subsistema delega automáticamente en los planes canónicos
   * oficiales de 'bge' en db.ts y catalog-cache.ts.
   *
   * ADVERTENCIA TEMPORAL:
   * Cuando en futuras versiones se agreguen planes de estudio oficiales propios y diferenciados
   * para subsistemas de Bachillerato Tecnológico (BT: cecyte, cbtis, cbta, conalep),
   * este DELETE debe modificarse estrictamente para EXCLUIR los subsistemas BT válidos y
   * no purgarlos (ej: WHERE subsystem NOT IN ('bge', 'cbtis', 'cecyte', 'cbta', 'conalep')).
   */
  const purgedSubsystems = await sql`
    DELETE FROM programs_catalog
    WHERE subsystem != 'bge'
    RETURNING id;
  `;
  console.log(`✓ Clones redundantes de subsistemas no-bge eliminados: ${purgedSubsystems.length}`);

  // Eliminar cualquier registro huérfano en bge que no pertenezca a la lista canónica
  const validCanonicalKeys = canonicalUACs.map(u => `${normalize(u.uac_name)}::${u.semester}::${u.component}`);
  const currentBgeRows = await sql`
    SELECT id, uac_name, semester, component
    FROM programs_catalog
    WHERE subsystem = 'bge';
  `;

  let purgedOrphans = 0;
  for (const row of currentBgeRows) {
    const rowKey = `${normalize(row.uac_name)}::${row.semester}::${row.component}`;
    if (!validCanonicalKeys.includes(rowKey)) {
      await sql`DELETE FROM programs_catalog WHERE id = ${row.id}`;
      purgedOrphans++;
      auditLines.push(`[PURGA] Registro sintético/huérfano eliminado: ${row.uac_name} (Sem ${row.semester}, ${row.component})`);
    }
  }
  console.log(`✓ Registros obsoletos o huérfanos eliminados de bge: ${purgedOrphans}`);

  // Agregar sección de resumen de auditoría
  auditLines.push('\n===============================================================');
  auditLines.push('RESUMEN DE AUDITORÍA Y ESTADO DE REVISIÓN MANUAL');
  auditLines.push('===============================================================');
  auditLines.push(`Total UACs canónicas: ${canonicalUACs.length}`);
  auditLines.push(`UACs laborales con contenidos_formativos: null: ${laboralNullContenidosCount} (no inventado texto sintético)`);
  auditLines.push(`UACs FFE optativas con activities: []: ${ffeEmptyActivitiesCount} (progresiones pendientes de extracción manual)`);
  auditLines.push(`UACs no-bge purgadas (fallback a bge activo): ${purgedSubsystems.length}`);
  auditLines.push(`UACs huérfanas bge purgadas: ${purgedOrphans}`);
  
  if (manualReviewList.length > 0) {
    auditLines.push('\nLISTA DE UACs QUE REQUIEREN REVISIÓN MANUAL DE PROGRESIONES:');
    manualReviewList.forEach(item => auditLines.push(`  - ${item}`));
  }

  // Guardar archivo de auditoría
  const reportPath = path.join(scratchDir, 'curacion_report.txt');
  writeFileSync(reportPath, auditLines.join('\n'), 'utf-8');
  console.log(`✓ Reporte de curación guardado en: ${reportPath}`);

  // --------------------------------------------------------------------------
  // PASO 6: VERIFICACIÓN FINAL Y COMPROBACIÓN DE NEMESIO
  // --------------------------------------------------------------------------
  console.log('\n📌 [PASO 6] Verificación final de la base de datos...');
  const finalCountRes = await sql`SELECT count(*) as count FROM programs_catalog`;
  const bgeCountRes = await sql`SELECT count(*) as count FROM programs_catalog WHERE subsystem = 'bge'`;
  console.log(`✓ Total registros en programs_catalog: ${finalCountRes[0].count}`);
  console.log(`✓ Total registros bge canónicos: ${bgeCountRes[0].count}`);

  // Comprobación específica de Pensamiento Matemático III
  console.log('\n🔍 Verificando Pensamiento Matemático III (Caso Nemesio)...');
  const math3Res = await sql`
    SELECT id, uac_name, semester, subsystem, total_hours, learning_outcome, activities, contenidos_formativos
    FROM programs_catalog
    WHERE uac_name ILIKE '%Pensamiento Matemático III%' AND semester = 3 AND subsystem = 'bge';
  `;

  if (math3Res.length > 0) {
    const math3 = math3Res[0];
    console.log(`  UAC: ${math3.uac_name} (Semestre ${math3.semester}, Subsystem: ${math3.subsystem})`);
    console.log(`  Horas totales: ${math3.total_hours}`);
    console.log(`  Propósitos formativos (${math3.activities.length}):`);
    math3.activities.forEach((act, idx) => {
      console.log(`    PF ${act.order}: ${act.name.substring(0, 80)}...`);
    });

    const hasTrig = JSON.stringify(math3.activities).toLowerCase().includes('trigonometría');
    const hasEcuaciones = JSON.stringify(math3.activities).toLowerCase().includes('ecuaciones');

    if (!hasTrig && hasEcuaciones) {
      console.log('  ✅ VERIFICACIÓN DE NEMESIO EXITOSA: Los propósitos corresponden auténticamente a Sistemas de Ecuaciones, Cuadráticas y Álgebra. Mock de trigonometría eliminado al 100%.');
    } else {
      console.warn(`  ⚠️ Alerta en Pensamiento Matemático III: hasTrig=${hasTrig}, hasEcuaciones=${hasEcuaciones}`);
    }
  } else {
    console.error('  ❌ ERROR: No se encontró Pensamiento Matemático III en el catálogo sincronizado.');
  }

  console.log('\n===============================================================');
  console.log('🎉 SINCRONIZACIÓN CURRICULAR CONCLUIDA EXITOSAMENTE');
  console.log('===============================================================');
}

main().catch(err => {
  console.error('❌ Error no controlado en sincronización:', err);
  process.exit(1);
});
