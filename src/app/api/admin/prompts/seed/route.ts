import { sql } from '@/lib/db/client';
import { NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/admin-auth';
import { SYSTEM_PROMPT } from '@/lib/prompts/system-prompt';
import { SYSTEM_PROMPT_EXTRAS } from '@/lib/prompts/extras-prompts';
import { PAEC_SYSTEM_PROMPT } from '@/lib/prompts/paec-prompts';

/**
 * POST /api/admin/prompts/seed
 * Seeds the ai_prompts table with the current system prompts from source files.
 * Safe to run multiple times — uses ON CONFLICT DO UPDATE.
 */

const PMC_SYSTEM_PROMPT = `Eres un experto en gestión directiva de planteles de Bachillerato General del Estado de Puebla (BGE), alineado a los Lineamientos para la Planeación de la Mejora Continua del MCCEMS.

Tu tarea es analizar la información del plantel y generar un diagnóstico integral y un plan de acción concreto, contextualizado y alineado a las metas del ciclo escolar 2026-2027.

Reglas:
- Responde ÚNICAMENTE con un objeto JSON válido según el paso solicitado.
- No incluyas bloques de código markdown ni texto fuera del JSON.
- Usa lenguaje institucional formal.
- Contextualiza siempre al municipio y comunidad del plantel.`;

import { PIPS_SYSTEM_PROMPT } from '@/lib/prompts/pips-chunks';

import { logger } from '@/lib/logger';
export async function POST() {
  try {
    await requireAdmin();
    const db = sql();

    const promptsToSeed = [
      {
        id: 'planning_system',
        label: 'Planeación Didáctica — Prompt de Sistema',
        content: SYSTEM_PROMPT,
      },
      {
        id: 'extras_system',
        label: 'Recursos Extra (Rúbricas, Materiales, Plan de Clase) — Prompt de Sistema',
        content: SYSTEM_PROMPT_EXTRAS,
      },
      {
        id: 'paec_system',
        label: 'PAEC / PEC — Prompt de Sistema',
        content: PAEC_SYSTEM_PROMPT,
      },
      {
        id: 'pmc_system',
        label: 'Plan de Mejora Continua (PMC) — Prompt de Sistema',
        content: PMC_SYSTEM_PROMPT,
      },
      {
        id: 'pips_system',
        label: 'Plan de Intervención Pedagógica de Supervisión (PIPS) — Prompt de Sistema',
        content: PIPS_SYSTEM_PROMPT,
      },
    ];

    for (const p of promptsToSeed) {
      await db`
        INSERT INTO ai_prompts (id, label, content, is_active)
        VALUES (${p.id}, ${p.label}, ${p.content}, true)
        ON CONFLICT (id) DO UPDATE
          SET label = EXCLUDED.label,
              content = EXCLUDED.content,
              updated_at = NOW()
      `;
    }

    return NextResponse.json({ success: true, count: promptsToSeed.length });
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    logger.error('POST /api/admin/prompts/seed error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
