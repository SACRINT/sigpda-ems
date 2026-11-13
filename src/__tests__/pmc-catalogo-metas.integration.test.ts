import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import {
  CANONICAL_NORMATIVA_REFS,
  matchArticuloExacto,
} from '../lib/catalogo-metas-pmc';

const dbUrl =
  process.env.DATABASE_URL ||
  (() => {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        const line = lines.find((l) => l.trim().startsWith('DATABASE_URL='));
        if (line) {
          return line.replace(/^DATABASE_URL=/, '').trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      return undefined;
    }
    return undefined;
  })();

describe('PMC Catálogo de Metas — Integración DB', () => {
  it.skipIf(!dbUrl)(
    '9.b [Integración DB] El diccionario canónico CANONICAL_NORMATIVA_REFS se mantiene sincronizado con normativa_documentos (vigente=true) y normativa_articulos de Neon DB',
    async () => {
      const sql = neon(dbUrl!);

      // 1. Obtener documentos vigentes de la BD
      const docsVigentes = await sql`
        SELECT id, titulo, vigente
        FROM normativa_documentos
        WHERE vigente = TRUE
      `;
      const docsVigentesMap = new Map<number, { id: number; titulo: string }>();
      for (const d of docsVigentes) {
        docsVigentesMap.set(Number(d.id), { id: Number(d.id), titulo: String(d.titulo) });
      }

      // 2. Obtener artículos registrados de la BD
      const articulosDb = await sql`
        SELECT id, documento_id, numero
        FROM normativa_articulos
      `;

      const articulosPorDoc = new Map<number, string[]>();
      for (const a of articulosDb) {
        const docId = Number(a.documento_id);
        const list = articulosPorDoc.get(docId) || [];
        list.push(String(a.numero));
        articulosPorDoc.set(docId, list);
      }

      // 3. Validar cada entrada en CANONICAL_NORMATIVA_REFS contra la BD viva
      const refKeys = Object.keys(CANONICAL_NORMATIVA_REFS);
      expect(refKeys.length).toBeGreaterThanOrEqual(15);

      for (const key of refKeys) {
        const ref = CANONICAL_NORMATIVA_REFS[key];

        // El documento DEBE existir en la base de datos y tener vigente = true
        const docEnDb = docsVigentesMap.get(ref.docId);
        expect(
          docEnDb,
          `El documento normativo con ID ${ref.docId} ("${key}": "${ref.titulo}") referenciado en el diccionario canónico debe existir en la BD y tener vigente = true`
        ).toBeDefined();

        // H-120: Validar concordancia de títulos entre diccionario canónico y BD (vigilando el acuerdo MCCEMS)
        const dbTitulo = docEnDb!.titulo;
        const refTitulo = ref.titulo;
        const fechaRef = refTitulo.match(/\d{2}\/\d{2}\/\d{2}/)?.[0];
        const fechaDb = dbTitulo.match(/\d{2}\/\d{2}\/\d{2}/)?.[0];
        if (fechaRef || fechaDb) {
          expect(
            fechaDb,
            `El acuerdo en BD ("${dbTitulo}") debe tener la misma fecha/código que el diccionario ("${refTitulo}") para ${key}`
          ).toBe(fechaRef);
        }

        const coincideTitulo =
          refTitulo === dbTitulo ||
          refTitulo.includes(dbTitulo) ||
          dbTitulo.includes(refTitulo) ||
          (refTitulo.includes('09/08/23') && dbTitulo.includes('09/08/23'));

        expect(
          coincideTitulo,
          `El título del documento en BD ("${dbTitulo}") y en CANONICAL_NORMATIVA_REFS ("${refTitulo}") deben coincidir para docId ${ref.docId}`
        ).toBe(true);

        if (ref.docId === 4) {
          expect(dbTitulo).not.toContain('14/08/22');
          expect(dbTitulo).toContain('09/08/23');
        }

        // Obtener los artículos en BD para este documento
        const articulosEnDb = articulosPorDoc.get(ref.docId) || [];
        expect(
          articulosEnDb.length,
          `El documento con ID ${ref.docId} ("${key}") debe tener artículos registrados en la BD`
        ).toBeGreaterThan(0);

        // Cada artículo válido listado en el diccionario debe resolver de forma exacta contra al menos un artículo registrado en BD
        for (const artValido of ref.articulosValidos) {
          const coincide = articulosEnDb.some((dbNum) => matchArticuloExacto(artValido, dbNum));

          expect(
            coincide,
            `El artículo/sección "${artValido}" de "${key}" (Doc ID ${ref.docId}) debe existir exactamente en la base de datos. Encontrados en BD: [${articulosEnDb.join(', ')}]`
          ).toBe(true);
        }
      }
    }
  );
});
