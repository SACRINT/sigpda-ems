/**
 * Script de Verificación de Integridad Curricular en Neon DB (H-309)
 * 
 * Verifica que las asignaturas fundamentales de semestres 1 a 6 en `programs_catalog`
 * cuenten con contenidos_formativos válidos, estructurados y no nulos.
 */

import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

// Cargar .env.local si DATABASE_URL no está en process.env
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...v] = trimmed.split('=');
        if (k.trim() === 'DATABASE_URL') {
          process.env.DATABASE_URL = v.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  }
}

async function verify() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Error: DATABASE_URL no encontrada en el entorno ni en .env.local');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  console.log('========================================================================');
  console.log('VERIFICACIÓN DE INTEGRIDAD: programs_catalog (Semestres 1 a 6 Fundamental)');
  console.log('========================================================================\n');

  const rows = (await sql`
    SELECT id, uac_name, semester, component, model_type, contenidos_formativos
    FROM programs_catalog
    WHERE component = 'fundamental' AND semester BETWEEN 1 AND 6
    ORDER BY semester, uac_name
  `) as Array<{
    id: string;
    uac_name: string;
    semester: number;
    component: string;
    model_type: string | null;
    contenidos_formativos: Array<Record<string, unknown>> | null;
  }>;

  let validCount = 0;
  let nullCount = 0;
  let emptyCount = 0;

  for (const r of rows) {
    const cf = r.contenidos_formativos;
    const isNull = cf === null || cf === undefined;
    const isEmpty = Array.isArray(cf) && cf.length === 0;

    if (isNull) {
      nullCount++;
      console.log(`❌ Sem ${r.semester} | "${r.uac_name}" -> contenidos_formativos es NULL`);
    } else if (isEmpty) {
      emptyCount++;
      console.log(`⚠️ Sem ${r.semester} | "${r.uac_name}" -> contenidos_formativos está vacío []`);
    } else {
      validCount++;
      const len = Array.isArray(cf) ? cf.length : 1;
      console.log(`✅ Sem ${r.semester} | "${r.uac_name}" (${r.model_type || 'default'}) -> ${len} contenidos formativos`);
    }
  }

  console.log('\n------------------------------------------------------------------------');
  console.log('RESUMEN DE VERIFICACIÓN');
  console.log('------------------------------------------------------------------------');
  console.log(`• Total UACs fundamentales analizadas: ${rows.length}`);
  console.log(`• UACs con contenidos formativos válidos: ${validCount}`);
  console.log(`• UACs con contenidos nulos:             ${nullCount}`);
  console.log(`• UACs con contenidos vacíos:            ${emptyCount}`);
  console.log('------------------------------------------------------------------------\n');

  if (nullCount > 0 || emptyCount > 0) {
    console.warn(`[ALERTA] Existen ${nullCount + emptyCount} materias sin contenidos formativos completos.`);
  } else {
    console.log('🎉 100% de UACs fundamentales cuentan con contenidos formativos estructurados.');
  }
}

verify().catch((err) => {
  console.error('Error fatal durante verificación:', err);
  process.exit(1);
});
