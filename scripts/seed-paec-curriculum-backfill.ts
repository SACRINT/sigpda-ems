/**
 * Script de Backfill Curricular para PAEC en Neon DB (H-309)
 * 
 * Reglas de Operación Segura:
 * 1. Opera en modo --dry-run por defecto.
 * 2. Solo ejecuta modificaciones si se pasa la bandera explícita --apply.
 * 3. Sentencia SQL con guardia: AND contenidos_formativos IS NULL.
 * 4. No sobreescribe datos ya validados ni altera learning_outcome.
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

interface ExtractedCurriculumItem {
  semester: number;
  uac_name: string;
  model_type: 'propositos_contenidos' | 'progresiones';
  contenidos_formativos: Array<{
    numero: number;
    proposito?: string | null;
    progresion?: string | null;
    contenidos?: string[];
  }>;
}

interface DbCatalogRow {
  id: string;
  uac_name: string;
  semester: number;
  component: string;
  model_type: string | null;
  contenidos_formativos: unknown | null;
}

// Mapeo normativo canónico MCCEMS: Nombres genéricos en BD vs Nombres temáticos oficiales
const MCCEMS_ALIASES: Record<string, string[]> = {
  // Semestre 1
  'humanidades i': ['pensamiento filosofico y humanidades', 'humanidades i'],
  'ciencias sociales i': ['ciencias sociales', 'ciencias sociales i'],
  // Semestre 2
  'humanidades ii': ['pensamiento filosofico y humanidades i', 'humanidades ii'],
  // Semestre 3
  'ciencias naturales experimentales y tecnologia iii': [
    'ecosistemas interacciones energia y dinamica',
    'la materia y sus interacciones',
    'ciencias naturales experimentales y tecnologia iii'
  ],
  // Semestre 4
  'ciencias naturales experimentales y tecnologia iv': [
    'reacciones quimicas',
    'conservacion de la energia y sus interacciones con la materia',
    'ciencias naturales experimentales y tecnologia iv'
  ],
  'pensamiento matematico iv': ['temas selectos de matematicas i', 'pensamiento matematico iv'],
  'ciencias sociales iii': ['espacio y sociedad', 'ciencias sociales iii'],
  // Semestre 5
  'ciencias naturales experimentales y tecnologia v': [
    'la energia en los procesos de la vida diaria',
    'ciencias naturales experimentales y tecnologia v'
  ],
  'pensamiento matematico v': ['pensamiento matematico v', 'temas selectos de matematicas ii'],
  // Semestre 6
  'ciencias naturales experimentales y tecnologia vi': [
    'organismos estructuras y procesos herencia y evolucion biologica',
    'ciencias naturales experimentales y tecnologia vi'
  ],
  'pensamiento matematico vi': ['pensamiento matematico vi', 'temas selectos de matematicas iii'],
  'cultura digital iii': ['taller de cultura digital', 'cultura digital iii'],
};

function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  // Comprobar si b coincide con algún alias conocido de a
  const aliases = MCCEMS_ALIASES[normA] || [];
  for (const alias of aliases) {
    if (normB === alias || normB.includes(alias) || alias.includes(normB)) {
      return 0.95;
    }
  }

  if (normA.includes(normB) || normB.includes(normA)) return 0.9;
  const dist = levenshtein(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return 1 - dist / maxLen;
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const isDryRun = !isApply;

  console.log('========================================================================');
  console.log(`PAEC CURRICULUM BACKFILL (H-309) — Modo: ${isDryRun ? '🔍 DRY-RUN (Simulación sin cambios)' : '🚀 APPLY (Escritura en Neon DB)'}`);
  console.log('========================================================================\n');

  const jsonPath = path.join(__dirname, 'paec-curriculum-extracted.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: No se encontró el archivo de extracción: ${jsonPath}`);
    console.error('Ejecuta primero: python scripts/extract-paec-curriculum.py');
    process.exit(1);
  }

  const extracted: ExtractedCurriculumItem[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`Cargadas ${extracted.length} asignaturas oficiales desde la extracción.\n`);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Error: DATABASE_URL no está definida en el entorno.');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  console.log('Consultando programas fundamentales de semestres 1 a 6 en Neon DB...');
  const dbRows = (await sql`
    SELECT id, uac_name, semester, component, model_type, contenidos_formativos
    FROM programs_catalog
    WHERE component = 'fundamental' AND semester BETWEEN 1 AND 6
    ORDER BY semester, uac_name
  `) as DbCatalogRow[];

  console.log(`Encontradas ${dbRows.length} materias fundamentales en BD.\n`);

  let matchedCount = 0;
  let skippedAlreadyHasCf = 0;
  let updateCandidates = 0;

  console.log('------------------------------------------------------------------------');
  console.log('REPORTE DE COINCIDENCIAS (Matching Levenshtein / Exacto)');
  console.log('------------------------------------------------------------------------');

  for (const row of dbRows) {
    const hasExisting = row.contenidos_formativos !== null &&
      Array.isArray(row.contenidos_formativos) &&
      row.contenidos_formativos.length > 0;

    // Buscar mejor coincidencia en el mismo semestre
    const candidates = extracted.filter((e) => e.semester === row.semester);
    let bestMatch: ExtractedCurriculumItem | null = null;
    let highestSim = 0;

    for (const c of candidates) {
      const sim = similarity(row.uac_name, c.uac_name);
      if (sim > highestSim) {
        highestSim = sim;
        bestMatch = c;
      }
    }

    if (bestMatch && highestSim >= 0.70) {
      matchedCount++;
      if (hasExisting) {
        skippedAlreadyHasCf++;
        console.log(`[PRESERVADA] Sem ${row.semester} | BD: "${row.uac_name}" (Ya tiene ${row.contenidos_formativos.length} elementos)`);
      } else {
        updateCandidates++;
        console.log(
          `[CANDIDATA]  Sem ${row.semester} | BD: "${row.uac_name}" <--> Doc: "${bestMatch.uac_name}" (Sim: ${(highestSim * 100).toFixed(1)}%) -> ${bestMatch.contenidos_formativos.length} contenidos`
        );

        if (isApply) {
          await sql`
            UPDATE programs_catalog
            SET contenidos_formativos = ${JSON.stringify(bestMatch.contenidos_formativos)}
            WHERE id = ${row.id}
              AND contenidos_formativos IS NULL
          `;
        }
      }
    } else {
      console.log(`[SIN FUENTE] Sem ${row.semester} | BD: "${row.uac_name}" -> Permanecerá en NULL (Regla B-001)`);
    }
  }

  console.log('\n------------------------------------------------------------------------');
  console.log('RESUMEN DE AUDITORÍA');
  console.log('------------------------------------------------------------------------');
  console.log(`• Total materias fundamentales analizadas: ${dbRows.length}`);
  console.log(`• Materias que ya contaban con CF validado: ${skippedAlreadyHasCf}`);
  console.log(`• Materias candidatas a actualización:    ${updateCandidates}`);
  console.log(`• Materias coincidentes con fuente oficial: ${matchedCount}`);
  console.log(`• Acción ejecutada:                       ${isApply ? '✅ UPDATES APLICADOS CON GUARDIA EN BD' : 'ℹ️ NINGUNA (Modo Dry-Run completado)'}`);
  console.log('------------------------------------------------------------------------\n');
}

main().catch((err) => {
  console.error('Error fatal durante backfill:', err);
  process.exit(1);
});
