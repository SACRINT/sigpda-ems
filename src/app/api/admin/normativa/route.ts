import { sql } from '@/lib/db/client';
// src/app/api/admin/normativa/route.ts
// Admin CRUD para el catálogo normativo (documentos y artículos)
// Protegido por requireAdmin (rol 'administrador' o ADMIN_EMAIL)

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/admin-auth';

import { logger } from '@/lib/logger';
export const runtime = 'nodejs';

function getDb() { return sql(); }

// ─── GET — Lista todo el catálogo normativo ────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const db = getDb();
  const { searchParams } = new URL(request.url);
  const generador = searchParams.get('generador');
  const actionParam = searchParams.get('action');

  try {
    // ── Modo especial: leer snapshot predeterminado
    if (actionParam === 'get_default') {
      const rows = await db`SELECT value FROM platform_config WHERE key = 'normativa_default_snapshot'`;
      if (!rows.length) return NextResponse.json({ snapshot: null });
      const snap = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
      return NextResponse.json({ snapshot: snap });
    }

    // Lee documentos con sus artículos agrupados
    const documentos = await db`
      SELECT
        d.id,
        d.titulo,
        d.tipo,
        d.fuente,
        d.vigente,
        d.orden_display,
        d.created_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id',          a.id,
              'numero',      a.numero,
              'texto',       a.texto,
              'aplicable_a', a.aplicable_a,
              'orden_en_doc', a.orden_en_doc
            ) ORDER BY a.orden_en_doc
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'
        ) AS articulos
      FROM normativa_documentos d
      LEFT JOIN normativa_articulos a ON a.documento_id = d.id
        ${generador ? db`AND ${generador} = ANY(a.aplicable_a)` : db``}
      GROUP BY d.id
      ORDER BY d.orden_display ASC, d.id ASC
    `;

    // Estadísticas
    const stats = await db`
      SELECT
        COUNT(DISTINCT d.id) AS total_documentos,
        COUNT(a.id)           AS total_articulos,
        COUNT(CASE WHEN 'pmc'       = ANY(a.aplicable_a) THEN 1 END) AS arts_pmc,
        COUNT(CASE WHEN 'paec'      = ANY(a.aplicable_a) THEN 1 END) AS arts_paec,
        COUNT(CASE WHEN 'pips'      = ANY(a.aplicable_a) THEN 1 END) AS arts_pips,
        COUNT(CASE WHEN 'planeacion' = ANY(a.aplicable_a) THEN 1 END) AS arts_planeacion
      FROM normativa_documentos d
      LEFT JOIN normativa_articulos a ON a.documento_id = d.id
      WHERE d.vigente = TRUE
    `;

    return NextResponse.json({ documentos, stats: stats[0] || {} });
  } catch (error: any) {
    logger.error('[admin/normativa] Error en GET:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener normativa' }, { status: 500 });
  }
}

// ─── POST — Crea documento, artículo o ejecuta acciones ───────────────────────
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const db = getDb();
  const body = await request.json();

  try {
    // ── Crear documento
    if (body.action === 'create_documento') {
      const { titulo, tipo, fuente, orden_display, vigente = true } = body;
      if (!titulo || !tipo) {
        return NextResponse.json({ error: 'titulo y tipo son requeridos' }, { status: 400 });
      }
      const [doc] = await db`
        INSERT INTO normativa_documentos (titulo, tipo, fuente, vigente, orden_display)
        VALUES (${titulo}, ${tipo}, ${fuente || null}, ${vigente}, ${orden_display || 0})
        RETURNING *
      `;
      return NextResponse.json({ success: true, documento: doc });
    }

    // ── Crear artículo
    if (body.action === 'create_articulo') {
      const { documento_id, numero, texto, aplicable_a, orden_en_doc } = body;
      if (!documento_id || !numero || !texto || !aplicable_a) {
        return NextResponse.json(
          { error: 'documento_id, numero, texto y aplicable_a son requeridos' },
          { status: 400 }
        );
      }
      if (!Array.isArray(aplicable_a) || aplicable_a.length === 0) {
        return NextResponse.json({ error: 'aplicable_a debe ser un array no vacío' }, { status: 400 });
      }
      const [art] = await db`
        INSERT INTO normativa_articulos (documento_id, numero, texto, aplicable_a, orden_en_doc)
        VALUES (${documento_id}, ${numero}, ${texto}, ${aplicable_a}, ${orden_en_doc || 0})
        RETURNING *
      `;
      return NextResponse.json({ success: true, articulo: art });
    }

    // ── Activar todos los documentos
    if (body.action === 'activate_all') {
      await db`UPDATE normativa_documentos SET vigente = TRUE`;
      return NextResponse.json({ success: true, message: 'Todos los documentos han sido marcados como vigentes' });
    }

    // ── Guardar configuración predeterminada (snapshot del estado actual de vigencia)
    if (body.action === 'save_default') {
      const allDocs = await db`SELECT id, vigente FROM normativa_documentos`;
      const snapshot = {
        saved_at: new Date().toISOString(),
        total: allDocs.length,
        vigentes: allDocs.filter((d: any) => d.vigente).map((d: any) => d.id),
        no_vigentes: allDocs.filter((d: any) => !d.vigente).map((d: any) => d.id),
      };
      const snapshotJson = JSON.stringify(snapshot);
      await db`
        INSERT INTO platform_config (key, value, updated_at)
        VALUES ('normativa_default_snapshot', ${snapshotJson}, NOW())
        ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value,
              updated_at = NOW()
      `;
      return NextResponse.json({ success: true, snapshot });
    }

    // ── Restablecer al estado predeterminado guardado
    if (body.action === 'reset_to_default') {
      const rows = await db`SELECT value FROM platform_config WHERE key = 'normativa_default_snapshot'`;
      if (!rows.length) {
        return NextResponse.json(
          { error: 'No existe una configuración predeterminada guardada. Usa "Guardar Predeterminado" primero.' },
          { status: 404 }
        );
      }
      let snapshot: { vigentes: any[]; no_vigentes: any[]; saved_at?: string; updated_at?: string; total?: number };
      try {
        snapshot = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
      } catch {
        return NextResponse.json({ error: 'El snapshot guardado está corrupto.' }, { status: 500 });
      }

      const vigentesIds = (snapshot.vigentes || []).map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));

      if (vigentesIds.length > 0) {
        await db`UPDATE normativa_documentos SET vigente = TRUE WHERE id = ANY(${vigentesIds}::int[])`;
        await db`UPDATE normativa_documentos SET vigente = FALSE WHERE NOT (id = ANY(${vigentesIds}::int[]))`;
      } else if (snapshot.no_vigentes?.length > 0) {
        const noVigentesIds = snapshot.no_vigentes.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
        await db`UPDATE normativa_documentos SET vigente = FALSE WHERE id = ANY(${noVigentesIds}::int[])`;
      }

      return NextResponse.json({
        success: true,
        message: `🔄 Configuración restablecida: ${vigentesIds.length} vigentes`,
        restored: {
          vigentes: vigentesIds.length,
          saved_at: snapshot.saved_at || snapshot.updated_at,
        },
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    logger.error('[admin/normativa] Error en POST:', error);
    return NextResponse.json({ error: error.message || 'Error procesando solicitud' }, { status: 500 });
  }
}

// ─── PATCH — Actualiza documento o artículo ───────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const db = getDb();
  const body = await request.json();

  try {
    // ── Actualizar documento
    if (body.action === 'update_documento') {
      const { id, vigente, fuente, orden_display, titulo, tipo } = body;
      if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
      const [doc] = await db`
        UPDATE normativa_documentos
        SET
          vigente       = COALESCE(${vigente ?? null}, vigente),
          fuente        = COALESCE(${fuente ?? null}, fuente),
          orden_display = COALESCE(${orden_display ?? null}, orden_display),
          titulo        = COALESCE(${titulo ?? null}, titulo),
          tipo          = COALESCE(${tipo ?? null}, tipo)
        WHERE id = ${id}
        RETURNING *
      `;
      return NextResponse.json({ success: true, documento: doc });
    }

    // ── Toggle vigencia rápido
    if (body.action === 'toggle_vigente') {
      const { id, vigente } = body;
      if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
      const [doc] = await db`
        UPDATE normativa_documentos
        SET vigente = ${Boolean(vigente)}
        WHERE id = ${id}
        RETURNING *
      `;
      return NextResponse.json({ success: true, documento: doc });
    }

    // ── Actualizar artículo
    if (body.action === 'update_articulo') {
      const { id, numero, texto, aplicable_a, orden_en_doc } = body;
      if (!id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
      const [art] = await db`
        UPDATE normativa_articulos
        SET
          numero      = COALESCE(${numero ?? null}, numero),
          texto       = COALESCE(${texto ?? null}, texto),
          aplicable_a = COALESCE(${aplicable_a ?? null}, aplicable_a),
          orden_en_doc = COALESCE(${orden_en_doc ?? null}, orden_en_doc)
        WHERE id = ${id}
        RETURNING *
      `;
      return NextResponse.json({ success: true, articulo: art });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    logger.error('[admin/normativa] Error en PATCH:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar' }, { status: 500 });
  }
}

// ─── DELETE — Elimina artículo o documento ─────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') return adminUnauthorized();
    if (e.message === 'FORBIDDEN') return adminForbidden();
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const db = getDb();
  const { searchParams } = new URL(request.url);
  const articuloId = searchParams.get('articulo_id');
  const documentoId = searchParams.get('documento_id');

  try {
    if (articuloId) {
      await db`DELETE FROM normativa_articulos WHERE id = ${articuloId}`;
      return NextResponse.json({ success: true, deleted: 'articulo', id: articuloId });
    }

    if (documentoId) {
      await db`DELETE FROM normativa_documentos WHERE id = ${documentoId}`;
      return NextResponse.json({ success: true, deleted: 'documento', id: documentoId });
    }

    return NextResponse.json({ error: 'Debes proporcionar articulo_id o documento_id' }, { status: 400 });
  } catch (error: any) {
    logger.error('[admin/normativa] Error en DELETE:', error);
    return NextResponse.json({ error: error.message || 'Error al eliminar' }, { status: 500 });
  }
}
