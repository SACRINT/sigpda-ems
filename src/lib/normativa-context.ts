// src/lib/normativa-context.ts
//
// Proveedor de contexto normativo para los generadores de IA.
// Lee artículos curados de la BD y los inyecta como texto plano
// en los prompts de PMC, PAEC, PIPS y Planeaciones.

import { neon } from '@neondatabase/serverless';
import { logger } from '@/lib/logger';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type GeneratorType = 'pmc' | 'paec' | 'pips' | 'planeacion';

interface NormativaArticulo {
  numero: string;
  texto: string;
  titulo_documento: string;
  tipo: string;
  fuente: string | null;
  orden_display: number;
}

// ─── Normativa de respaldo (fallback estático) ────────────────────────────────
// Se usa si la BD no tiene artículos cargados todavía.
const FALLBACK_NORMATIVA: Record<GeneratorType, string> = {
  pmc: `--- MARCO NORMATIVO OFICIAL (PMC) ---
• Artículo 3° Constitucional — derecho a la educación de calidad, inclusiva y en condiciones de equidad.
• Ley General de Educación (2019), Art. 14 — obligatoriedad EMS; Art. 16 — criterios orientadores; Art. 18 — inclusión y excelencia.
• Ley General SCMM (2019), Art. 4° — función directiva; Art. 69 — atribuciones en EMS.
• Acuerdo Secretarial 14/08/22 (MCCEMS) — 8 categorías de gestión educativa para la mejora continua.
• Lineamientos PMC DBEPA 2025-2026 — metodología PMC para planteles BGE del Estado de Puebla.
--- FIN MARCO NORMATIVO ---`,

  paec: `--- MARCO NORMATIVO OFICIAL (PAEC-PEC) ---
• Artículo 3° Constitucional — educación integral con participación comunitaria activa.
• Ley General de Educación (2019), Art. 18 — inclusión, equidad y excelencia educativa.
• MCCEMS (Acuerdo 14/08/22) — aprendizajes situados, comunitarios y críticos.
• Lineamientos PAEC-PEC DBEPA 2026-2027 — estructura y criterios del Proyecto Escolar Comunitario.
--- FIN MARCO NORMATIVO ---`,

  pips: `--- MARCO NORMATIVO OFICIAL (PIPS) ---
• Artículo 3° Constitucional — garantía del derecho a la educación y función de supervisión.
• Ley General de Educación (2019), Arts. 14, 16, 44, 46 — obligatoriedad y funciones supervisoras.
• Ley de Educación del Estado de Puebla — atribuciones de la supervisión en EMS.
• Lineamientos PIPS DBEPA — elaboración, seguimiento y evaluación del Plan de Supervisión.
--- FIN MARCO NORMATIVO ---`,

  planeacion: `--- MARCO NORMATIVO OFICIAL (Planeación Didáctica) ---
• Artículo 3° Constitucional — educación de calidad, laica y gratuita.
• MCCEMS (Acuerdo 14/08/22) — Marcos Curriculares por componente.
• Lineamientos de planeación DBEPA — estructura de la planeación didáctica BGE.
--- FIN MARCO NORMATIVO ---`,
};

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Obtiene el contexto normativo para un generador específico.
 * Retorna un bloque de texto listo para inyectar en el prompt.
 * Si no hay artículos en BD, retorna el fallback estático.
 */
export async function getNormativaForGenerator(
  generador: GeneratorType
): Promise<string> {
  try {
    const db = neon(process.env.DATABASE_URL!);

    // Busca artículos vigentes aplicables a este generador
    const rows = await db`
      SELECT
        a.numero,
        a.texto,
        d.titulo  AS titulo_documento,
        d.tipo,
        d.fuente,
        d.orden_display
      FROM normativa_articulos a
      JOIN normativa_documentos d ON d.id = a.documento_id
      WHERE d.vigente = TRUE
        AND ${generador} = ANY(a.aplicable_a)
      ORDER BY d.orden_display ASC, a.orden_en_doc ASC
    `;

    if (!rows || rows.length === 0) {
      // Sin datos en BD → usa fallback
      return FALLBACK_NORMATIVA[generador];
    }

    return buildNormativaBlock(rows as unknown as NormativaArticulo[], generador);
  } catch (error) {
    logger.error('[normativa-context] Error obteniendo normativa de BD:', error);
    // Si hay error de BD, usa fallback sin bloquear la generación
    return FALLBACK_NORMATIVA[generador];
  }
}

/**
 * Construye el bloque de texto de normativa para inyectar en el prompt.
 */
function buildNormativaBlock(rows: NormativaArticulo[], generador: GeneratorType): string {
  const generadorLabel: Record<GeneratorType, string> = {
    pmc:        'Plan de Mejora Continua (PMC)',
    paec:       'Proyecto Escolar Comunitario (PAEC-PEC)',
    pips:       'Plan de Intervención Pedagógica de Supervisión (PIPS)',
    planeacion: 'Planeación Didáctica',
  };

  let block = `--- MARCO NORMATIVO OFICIAL APLICABLE AL ${generadorLabel[generador].toUpperCase()} ---\n`;
  block += 'El documento debe fundamentarse en la siguiente normativa vigente:\n\n';

  // Agrupa artículos por documento
  const byDoc = new Map<string, NormativaArticulo[]>();
  for (const row of rows) {
    const key = row.titulo_documento;
    if (!byDoc.has(key)) byDoc.set(key, []);
    byDoc.get(key)!.push(row);
  }

  for (const [titulo, articulos] of byDoc) {
    const fuente = articulos[0].fuente ? ` (${articulos[0].fuente})` : '';
    block += `📌 ${titulo}${fuente}\n`;
    for (const art of articulos) {
      // Limita cada artículo a 400 caracteres para no saturar el prompt
      const texto = art.texto.length > 400
        ? art.texto.substring(0, 397) + '...'
        : art.texto;
      block += `   • ${art.numero}: ${texto}\n`;
    }
    block += '\n';
  }

  block += '--- FIN DEL MARCO NORMATIVO ---\n';
  return block;
}

/**
 * Obtiene la normativa estructurada para los generadores de DOCX y UI,
 * omitiendo el texto largo de los artículos y listando solo los números.
 */
export async function getStructuredNormativaForGenerator(
  generador: GeneratorType
): Promise<Array<{ orden: number; titulo: string; articulos: string[] }>> {
  try {
    const db = neon(process.env.DATABASE_URL!);

    const rows = await db`
      SELECT
        a.numero,
        d.titulo  AS titulo_documento,
        d.orden_display
      FROM normativa_articulos a
      JOIN normativa_documentos d ON d.id = a.documento_id
      WHERE d.vigente = TRUE
        AND ${generador} = ANY(a.aplicable_a)
      ORDER BY d.orden_display ASC, a.orden_en_doc ASC
    `;

    if (!rows || rows.length === 0) {
      return getStructuredFallback(generador);
    }

    const byDoc = new Map<string, { orden: number; articulos: string[] }>();
    for (const row of rows) {
      const key = row.titulo_documento;
      if (!byDoc.has(key)) {
        byDoc.set(key, { orden: row.orden_display, articulos: [] });
      }
      byDoc.get(key)!.articulos.push(row.numero);
    }

    const result = Array.from(byDoc.entries()).map(([titulo, data]) => ({
      orden: data.orden,
      titulo,
      articulos: data.articulos,
    }));

    result.sort((a, b) => a.orden - b.orden);

    // Reasignar orden secuencial para la presentación
    return result.map((doc, idx) => ({ ...doc, orden: idx + 1 }));
  } catch (error) {
    logger.error('[normativa-context] Error obteniendo normativa estructurada de BD:', error);
    return getStructuredFallback(generador);
  }
}

/**
 * Fallback estructurado para cuando la BD falla o está vacía.
 */
function getStructuredFallback(generador: GeneratorType): Array<{ orden: number; titulo: string; articulos: string[] }> {
  const fallbacks: Record<GeneratorType, Array<{ orden: number; titulo: string; articulos: string[] }>> = {
    pmc: [
      { orden: 1, titulo: "Constitución Política de los Estados Unidos Mexicanos", articulos: ["Artículo 3°"] },
      { orden: 2, titulo: "Ley General de Educación (2019)", articulos: ["Artículo 14", "Artículo 16", "Artículo 18"] },
      { orden: 3, titulo: "Ley General del Sistema para la Carrera de las Maestras y los Maestros (2019)", articulos: ["Artículo 4°", "Artículo 69"] },
      { orden: 4, titulo: "Acuerdo Secretarial 14/08/22 (MCCEMS)", articulos: ["8 categorías de gestión educativa para la mejora continua"] },
      { orden: 5, titulo: "Lineamientos para la Planeación de la Mejora Continua 2025-2026 de la DBEPA", articulos: ["Metodología PMC para planteles BGE"] }
    ],
    paec: [
      { orden: 1, titulo: "Constitución Política de los Estados Unidos Mexicanos", articulos: ["Artículo 3°"] },
      { orden: 2, titulo: "Ley General de Educación (2019)", articulos: ["Artículo 18"] },
      { orden: 3, titulo: "Acuerdo Secretarial 14/08/22 (MCCEMS)", articulos: ["Aprendizajes situados, comunitarios y críticos"] },
      { orden: 4, titulo: "Lineamientos PAEC-PEC DBEPA 2026-2027", articulos: ["Estructura y criterios del Proyecto Escolar Comunitario"] }
    ],
    pips: [
      { orden: 1, titulo: "Constitución Política de los Estados Unidos Mexicanos", articulos: ["Artículo 3°"] },
      { orden: 2, titulo: "Ley General de Educación (2019)", articulos: ["Artículo 14", "Artículo 16", "Artículo 44", "Artículo 46"] },
      { orden: 3, titulo: "Ley de Educación del Estado de Puebla", articulos: ["Atribuciones de la supervisión en EMS"] },
      { orden: 4, titulo: "Lineamientos PIPS DBEPA", articulos: ["Elaboración, seguimiento y evaluación del Plan de Supervisión"] }
    ],
    planeacion: [
      { orden: 1, titulo: "Constitución Política de los Estados Unidos Mexicanos", articulos: ["Artículo 3°"] },
      { orden: 2, titulo: "Acuerdo Secretarial 14/08/22 (MCCEMS)", articulos: ["Marcos Curriculares por componente"] },
      { orden: 3, titulo: "Lineamientos de planeación DBEPA", articulos: ["Estructura de la planeación didáctica BGE"] }
    ]
  };
  return fallbacks[generador] || fallbacks.pmc;
}

