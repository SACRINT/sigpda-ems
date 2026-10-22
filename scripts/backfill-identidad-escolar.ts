/**
 * backfill-identidad-escolar.ts
 * Backfill de identidad escolar (plantel / CCT / municipio / zona de supervisión)
 * en datos YA persistidos, para eliminar plantel/CCT/supervisión falsos de los
 * documentos generados (PDF/DOCX de planeación, libros, extras didácticos).
 *
 * Corrige 4 frentes:
 *   1. teachers.school_name / municipality / cct / subsystem   (perfil docente)
 *   2. plannings.content_json -> sectionI                      (fuente autoritativa de render)
 *   3. plannings.workbooks_json -> coverData                   (portadas de libros)
 *   4. planning_extras.content_text                            (**Plantel:** en markdown de extras)
 *
 * Regla: NUNCA inventa. Si no hay plantel conocido, deja el dato ausente para que
 * el runtime degrade a los marcadores honestos ("Plantel no registrado" / "CCT no registrado").
 *
 * Uso:
 *   npx tsx scripts/backfill-identidad-escolar.ts --dry-run   (solo reporta)
 *   npx tsx scripts/backfill-identidad-escolar.ts             (aplica + verifica)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { resolveSchoolIdentity } from '../src/lib/school-identity';
import type { SchoolIdentitySource } from '../src/lib/school-identity';

/** Perfiles corregidos a mano (decisión de producto 2026-10-22). */
interface PerfilObjetivo {
  schoolName: string;
  cct: string;
  municipality: string;
  subsystem: string;
}

const PERFILES_OBJETIVO: Record<string, PerfilObjetivo> = {
  'sci211270@gmail.com': {
    schoolName: 'Héroes de la Patria',
    cct: '21EBH0200X',
    municipality: 'Venustiano Carranza',
    subsystem: 'Bachillerato General Estatal (BGE)',
  },
};

const PLANTAS_LIMPIAS = /(\*\*Plantel:\*\*)\s+[^\n|]*/g;

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      const value = m[2].trim().replace(/^['"]|['"]$/g, '');
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* .env.local es opcional: DATABASE_URL puede venir del entorno */
  }
}

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  loadEnvLocal();

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL no disponible.');
    process.exit(1);
  }
  const sql = neon(url);

  console.log(dryRun ? '🔎 BACKFILL (dry-run, sin escrituras)' : '🛠  BACKFILL identidad escolar');
  console.log('');

  // ── 1. Perfiles docentes ───────────────────────────────────────────────────
  const docentes = await sql`
    SELECT id, email, school_name, municipality, cct, subsystem
    FROM teachers
    ORDER BY email
  `;

  const identidadPorTeacher = new Map<string, ReturnType<typeof resolveSchoolIdentity>>();

  for (const docente of docentes) {
    const objetivo = PERFILES_OBJETIVO[docente.email];

    const source: SchoolIdentitySource = {
      schoolName: objetivo?.schoolName ?? docente.school_name,
      cct: objetivo?.cct ?? docente.cct,
      municipality: objetivo?.municipality ?? docente.municipality,
    };

    const identidad = resolveSchoolIdentity({ sectionI: source });
    const plantelConocido = !isBlank(source.schoolName);

    if (plantelConocido) {
      identidadPorTeacher.set(docente.id, identidad);
    }

    const cambios: string[] = [];
    if (objetivo && docente.school_name !== objetivo.schoolName) cambios.push(`school_name ${j(docente.school_name)} -> ${j(objetivo.schoolName)}`);
    if (objetivo && docente.municipality !== objetivo.municipality) cambios.push(`municipality ${j(docente.municipality)} -> ${j(objetivo.municipality)}`);
    if (objetivo && docente.cct !== objetivo.cct) cambios.push(`cct ${j(docente.cct)} -> ${j(objetivo.cct)}`);
    if (objetivo && docente.subsystem !== objetivo.subsystem) cambios.push(`subsystem ${j(docente.subsystem)} -> ${j(objetivo.subsystem)}`);

    if (cambios.length > 0) {
      console.log(`👤 ${docente.email}`);
      for (const cambio of cambios) console.log(`     ${cambio}`);
      if (!dryRun && objetivo) {
        await sql`
          UPDATE teachers
          SET school_name = ${objetivo.schoolName},
              municipality = ${objetivo.municipality},
              cct = ${objetivo.cct},
              subsystem = ${objetivo.subsystem}
          WHERE id = ${docente.id}
        `;
      }
    } else if (plantelConocido) {
      console.log(`👤 ${docente.email}: perfil OK (${identidad.schoolName} · ${identidad.cct})`);
    }
  }

  const teacherIds = [...identidadPorTeacher.keys()];
  if (teacherIds.length === 0) {
    console.log('\n⚠️  Ningún docente con plantel conocido. Nada que corregir.');
    return;
  }

  // ── 2. sectionI de las planeaciones ────────────────────────────────────────
  console.log('\n📄 plannings.content_json -> sectionI');
  const plannings = await sql`
    SELECT id, teacher_id, uac_name,
           content_json -> 'sectionI' ->> 'schoolName' AS school_name,
           content_json -> 'sectionI' ->> 'cct'         AS cct,
           content_json -> 'sectionI' ->> 'municipality' AS municipality,
           content_json -> 'sectionI' ->> 'schoolZone'  AS school_zone,
           workbooks_json -> 'coverData' AS cover_data
    FROM plannings
    WHERE teacher_id = ANY(${teacherIds}::uuid[])
    ORDER BY created_at
  `;

  let planningsCorregidos = 0;
  for (const planning of plannings) {
    const identidad = identidadPorTeacher.get(planning.teacher_id);
    if (!identidad) continue;

    const faltante =
      isBlank(planning.school_name) ||
      isBlank(planning.cct) ||
      isBlank(planning.municipality) ||
      isBlank(planning.school_zone);

    if (faltante) {
      planningsCorregidos += 1;
      console.log(`   · ${planning.uac_name}`);
      console.log(`       sectionI -> ${identidad.schoolName} · ${identidad.cct} · ${identidad.municipality} · ${identidad.schoolZone ?? '(sin zona)'}`);
      if (!dryRun) {
        await sql`
          UPDATE plannings
          SET content_json = jsonb_set(
                COALESCE(content_json, '{}'::jsonb),
                '{sectionI}',
                COALESCE(content_json -> 'sectionI', '{}'::jsonb) || ${JSON.stringify({
                  schoolName: identidad.schoolName,
                  cct: identidad.cct,
                  municipality: identidad.municipality,
                  schoolZone: identidad.schoolZone,
                })}::jsonb
              )
          WHERE id = ${planning.id}
        `;
      }
    }

    // ── 3. coverData de los libros ───────────────────────────────────────────
    const cover = planning.cover_data as { schoolName?: string; cct?: string } | null;
    if (cover && (cover.schoolName !== identidad.schoolName || cover.cct !== identidad.cct)) {
      console.log(`   · coverData (${planning.uac_name}): ${j(cover.schoolName)}/${j(cover.cct)} -> ${identidad.schoolName}/${identidad.cct}`);
      if (!dryRun) {
        await sql`
          UPDATE plannings
          SET workbooks_json = jsonb_set(
                jsonb_set(
                  COALESCE(workbooks_json, '{}'::jsonb),
                  '{coverData,schoolName}',
                  to_jsonb(${identidad.schoolName}::text)
                ),
                '{coverData,cct}',
                to_jsonb(${identidad.cct}::text)
              )
          WHERE id = ${planning.id}
        `;
      }
    }
  }
  if (planningsCorregidos === 0) console.log('   · sectionI completo en todas las planeaciones afectadas.');

  // ── 4. planning_extras.content_text (**Plantel:**) ─────────────────────────
  console.log('\n🧩 planning_extras.content_text -> **Plantel:**');
  const extras = await sql`
    SELECT e.id, e.planning_id, e.type, e.key_index, e.title, e.content_text, e.created_at
    FROM planning_extras e
    WHERE e.content_text LIKE '%**Plantel:**%'
      AND e.planning_id IN (
        SELECT id FROM plannings WHERE teacher_id = ANY(${teacherIds}::uuid[])
      )
    ORDER BY e.created_at
  `;

  let extrasCorregidos = 0;
  for (const extra of extras) {
    const planning = plannings.find((p) => p.id === extra.planning_id);
    const identidad = planning ? identidadPorTeacher.get(planning.teacher_id) : undefined;
    if (!identidad || typeof extra.content_text !== 'string') continue;

    const plantelActual = extra.content_text.match(PLANTAS_LIMPIAS)?.[0] ?? '';
    const plantelCorrecto = `**Plantel:** ${identidad.schoolName}`;
    const normalizado = plantelActual.replace(/\s+/g, ' ').trim();
    if (normalizado === plantelCorrecto) continue;

    extrasCorregidos += 1;
    const nuevo = extra.content_text.replace(
      /\*\*Plantel:\*\*[^\n|]*/,
      `**Plantel:** ${identidad.schoolName}`
    );
    console.log(`   · [${extra.type} #${extra.key_index}] ${plantelActual.trim()}  ->  ${plantelCorrecto}`);
    if (!dryRun) {
      await sql`UPDATE planning_extras SET content_text = ${nuevo} WHERE id = ${extra.id}`;
    }
  }
  if (extrasCorregidos === 0) console.log('   · Todos los **Plantel:** ya coinciden.');

  // ── Verificación ───────────────────────────────────────────────────────────
  if (dryRun) {
    console.log('\n✅ Dry-run terminado (no se escribió nada). Repite sin --dry-run para aplicar.');
    return;
  }

  const verificacion = await sql`
    SELECT t.email,
           t.school_name, t.municipality, t.cct, t.subsystem,
           COUNT(p.id)::int AS plannings,
           COUNT(p.id) FILTER (
             WHERE p.content_json -> 'sectionI' ->> 'cct' IS NOT NULL
           )::int AS section_i_ok
    FROM teachers t
    LEFT JOIN plannings p ON p.teacher_id = t.id
    GROUP BY t.id, t.email, t.school_name, t.municipality, t.cct, t.subsystem
    ORDER BY t.email
  `;

  console.log('\n🔎 Verificación post-backfill:');
  for (const row of verificacion) {
    console.log(
      `   ${row.email}: ${row.school_name ?? '(sin plantel)'} · ${row.cct ?? '-'} · ${row.municipality ?? '-'} · ${row.subsystem ?? '-'} · sectionI ${row.section_i_ok}/${row.plannings}`
    );
  }

  const pendientes = await sql`
    SELECT COUNT(*)::int AS n
    FROM plannings
    WHERE teacher_id = ANY(${teacherIds}::uuid[])
      AND (content_json -> 'sectionI' ->> 'schoolName' IS NULL
           OR content_json -> 'sectionI' ->> 'cct' IS NULL
           OR content_json -> 'sectionI' ->> 'schoolZone' IS NULL)
  `;
  const conPlantelFalso = await sql`
    SELECT COUNT(*)::int AS n
    FROM planning_extras
    WHERE content_text LIKE '%Francisco Z. Mena%'
       OR content_text LIKE '%21ECT0017T%'
  `;

  if ((pendientes[0]?.n ?? 0) > 0 || (conPlantelFalso[0]?.n ?? 0) > 0) {
    console.error(`❌ Verificación falló: sectionI incompleto=${pendientes[0]?.n}, plantel falso en extras=${conPlantelFalso[0]?.n}`);
    process.exit(1);
  }

  console.log('\n✅ Backfill de identidad escolar completado y verificado.');
}

function j(valor: unknown): string {
  return valor === null || valor === undefined || valor === '' ? '(vacío)' : String(valor);
}

main().catch((err) => {
  console.error('❌ Error ejecutando backfill:', err);
  process.exit(1);
});
