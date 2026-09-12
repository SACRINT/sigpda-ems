/**
 * Phase 6B: Ingesta de Embeddings Curriculares (Controlada)
 * Generates and stores 768-dim embeddings for all 449 SEP official programs.
 *
 * Características:
 * - Llamada controlada secuencial a Gemini Embedding API
 * - Pausa de 500ms entre llamadas (respeto de cuota / sin saturación)
 * - Reintentos automáticos con espera de 2s (máx 3 reintentos)
 * - Rotación automática entre claves activas de la BD / env
 * - Progreso visible cada 10 programas
 * - Inserción idempotente con ON CONFLICT (program_id) DO UPDATE
 *
 * Run: node --env-file=.env.local scripts/ingest-curriculum-embeddings.mjs
 */

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const sql = neon(process.env.DATABASE_URL);

const RATE_LIMIT_MS = 500;
const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decryptKey(encrypted) {
  const encKey = process.env.ADMIN_ENCRYPTION_KEY;
  if (!encKey || encKey.length !== 32) return null;
  try {
    const [ivHex, data] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encKey), iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

async function getAvailableKeys() {
  const keys = [];
  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
  }
  try {
    const rows = await sql`
      SELECT key_encrypted FROM api_keys 
      WHERE provider = 'gemini' AND is_active = true 
      ORDER BY priority ASC, error_count ASC
    `;
    for (const r of rows) {
      const plain = decryptKey(r.key_encrypted);
      if (plain && !keys.includes(plain)) {
        keys.push(plain);
      }
    }
  } catch (err) {
    console.warn('⚠️ No se pudieron cargar keys de BD:', err.message);
  }
  return keys;
}

let keyIndex = 0;

export async function generateEmbedding(text, availableKeys) {
  if (!availableKeys || availableKeys.length === 0) {
    throw new Error('No hay claves de Gemini disponibles (GEMINI_API_KEY o tabla api_keys)');
  }

  const modelsToTry = ['gemini-embedding-001', 'gemini-embedding-2', 'text-embedding-004'];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const apiKey = availableKeys[keyIndex % availableKeys.length];

    for (const model of modelsToTry) {
      try {
        const bodyPayload = {
          model: `models/${model}`,
          content: { parts: [{ text }] },
          taskType: 'RETRIEVAL_DOCUMENT',
        };

        if (model.includes('gemini-embedding')) {
          bodyPayload.outputDimensionality = 768;
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
          }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.embedding?.values) {
            return data.embedding.values;
          }
        }

        if (res.status === 404) {
          // Modelo no disponible en este endpoint/cuenta, probar siguiente modelo
          continue;
        }

        if (res.status === 429 || res.status === 401 || res.status === 403) {
          // Límite de tasa o credencial con error: rotar clave
          keyIndex = (keyIndex + 1) % availableKeys.length;
          break;
        }
      } catch (err) {
        keyIndex = (keyIndex + 1) % availableKeys.length;
        break;
      }
    }

    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw new Error(`Error al generar embedding después de ${MAX_RETRIES} reintentos`);
}

export function buildChunkText(program) {
  const parts = [];

  parts.push(`UAC: ${program.uac_name}`);
  parts.push(`Semestre: ${program.semester}°`);
  parts.push(`Componente: ${program.component}`);
  parts.push(`Subsistema: ${program.subsystem || 'General'}`);
  parts.push(`Horas totales: ${program.total_hours || 'N/D'}`);

  if (program.learning_outcome) {
    parts.push(`Resultado de aprendizaje: ${program.learning_outcome}`);
  }

  if (program.purpose) {
    parts.push(`Propósito formativo: ${program.purpose}`);
  }

  if (program.activities && Array.isArray(program.activities) && program.activities.length > 0) {
    parts.push('Actividades sugeridas:');
    program.activities.forEach((a, i) => {
      const name = typeof a === 'string' ? a : a.name || a.actividad_clave || `Actividad ${i + 1}`;
      const hours = typeof a === 'object' ? (a.hours || a.horas || '') : '';
      parts.push(`  ${i + 1}. ${name}${hours ? ` (${hours}h)` : ''}`);
    });
  }

  if (program.evidences && Array.isArray(program.evidences) && program.evidences.length > 0) {
    parts.push('Evidencias: ' + program.evidences.join('; '));
  }

  if (program.contenidos_formativos && Array.isArray(program.contenidos_formativos) && program.contenidos_formativos.length > 0) {
    parts.push('Contenidos formativos:');
    program.contenidos_formativos.forEach((cf) => {
      const tema = cf.tema || cf.proposito || '';
      const items = cf.contenidos || cf.subtemas || [];
      if (tema) parts.push(`  - ${tema}: ${Array.isArray(items) ? items.join(', ') : items}`);
    });
  }

  return parts.join('\n');
}

async function main() {
  console.log('🎓 Ingesta de Embeddings Curriculares (Fase 6B)');
  console.log('═══════════════════════════════════════════════════════════');

  const availableKeys = await getAvailableKeys();
  console.log(`🔑 Claves Gemini disponibles para rotación: ${availableKeys.length}`);

  if (availableKeys.length === 0) {
    console.error('❌ Error: No se encontraron claves válidas de Gemini.');
    process.exit(1);
  }

  // 1. Asegurar índice único en program_id para idempotencia
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_curriculum_embeddings_program_id_unique 
      ON curriculum_embeddings(program_id)
    `;
  } catch (err) {
    console.warn('⚠️ Nota sobre índice único:', err.message);
  }

  // 2. Obtener los 449 programas del catálogo oficial
  const programs = await sql`
    SELECT * FROM programs_catalog 
    ORDER BY semester ASC, component ASC, uac_name ASC
  `;

  const total = programs.length;
  console.log(`📚 Catálogo oficial: ${total} programas cargados.`);
  console.log(`⏱️  Control de tasa: ${RATE_LIMIT_MS}ms entre llamadas (~${Math.round((total * RATE_LIMIT_MS) / 60000)} min estimados).\n`);

  let processed = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < total; i++) {
    const program = programs[i];
    const chunkText = buildChunkText(program);

    try {
      // Generar embedding con Gemini
      const embedding = await generateEmbedding(chunkText, availableKeys);

      // Guardar en Neon DB con ON CONFLICT para no duplicar
      await sql`
        INSERT INTO curriculum_embeddings (
          program_id, uac_name, semester, component, subsystem,
          chunk_type, chunk_text, embedding, metadata
        )
        VALUES (
          ${program.id},
          ${program.uac_name},
          ${program.semester},
          ${program.component},
          ${program.subsystem || 'bge'},
          'full_program',
          ${chunkText},
          ${JSON.stringify(embedding)}::vector,
          ${JSON.stringify({
            total_hours: program.total_hours,
            learning_outcome: program.learning_outcome,
            source: 'programs_catalog'
          })}::jsonb
        )
        ON CONFLICT (program_id) DO UPDATE SET
          uac_name = EXCLUDED.uac_name,
          semester = EXCLUDED.semester,
          component = EXCLUDED.component,
          subsystem = EXCLUDED.subsystem,
          chunk_text = EXCLUDED.chunk_text,
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata
      `;

      processed++;

      // Notificar progreso cada 10 programas o al finalizar
      if (processed % 10 === 0 || processed === total) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ ${processed}/${total} programas procesados (${elapsed}s transcurridos)`);
      }
    } catch (err) {
      errors++;
      console.error(`❌ Error en programa [${i + 1}/${total}] ${program.uac_name}: ${err.message}`);
    }

    // Pausa controlada para no saturar la API
    await sleep(RATE_LIMIT_MS);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`🎉 Ingesta Curricular Finalizada en ${totalTime}s`);
  console.log(`   ✅ Procesados con éxito: ${processed}`);
  console.log(`   ❌ Errores: ${errors}`);

  // Verificación final en la base de datos
  try {
    const countCheck = await sql`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(embedding) as non_null_embeddings
      FROM curriculum_embeddings
    `;
    console.log(`\n🗄️  Estado de curriculum_embeddings en Neon DB:`);
    console.log(`   - Total registros: ${countCheck[0].total_rows}`);
    console.log(`   - Embeddings no nulos: ${countCheck[0].non_null_embeddings}`);

    if (parseInt(countCheck[0].non_null_embeddings, 10) >= 449) {
      console.log(`✨ VERIFICACIÓN EXITOSA: La base vectorial cuenta con los 449 programas indexados.`);
    }
  } catch (err) {
    console.error('⚠️ Error al verificar tabla:', err.message);
  }
}

main().catch((err) => {
  console.error('Fatal error en main:', err);
  process.exit(1);
});
