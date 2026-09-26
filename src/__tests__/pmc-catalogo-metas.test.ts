import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { neon } from '@neondatabase/serverless';
import {
  CATALOGO_METAS_CANONICO,
  SUBCATEGORIAS_OFICIALES_52,
  CATEGORIAS_OFICIALES_52,
  getCatalogoMetasPmc,
  getMetasByCategoria,
  getMetasBySubcategoria,
  formatMetasContextForPrompt,
  resolveNormativaCitation,
  CANONICAL_NORMATIVA_REFS,
  matchArticuloExacto,
} from '../lib/catalogo-metas-pmc';

describe('FASE 2: Catálogo Normativo y de Metas Institucionales (5.2 Formato Oficial)', () => {
  it('1. Todas las subcategorías del catálogo canónico pertenecen estrictamente al listado oficial del formato 5.2', () => {
    expect(CATALOGO_METAS_CANONICO.length).toBeGreaterThanOrEqual(17);

    for (const meta of CATALOGO_METAS_CANONICO) {
      expect(SUBCATEGORIAS_OFICIALES_52).toContain(meta.subcategoria);
      expect(CATEGORIAS_OFICIALES_52).toContain(meta.categoria);
    }
  });

  it('2. Integridad de identificadores: sin duplicados y con claves kebab-case', () => {
    const ids = CATALOGO_METAS_CANONICO.map((m) => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    for (const id of ids) {
      expect(id).toMatch(/^meta-[a-z0-9-]+$/);
    }
  });

  it('3. Ficha de aplicabilidad normativa (Criterio C3) presente en el 100% de las metas', () => {
    for (const meta of CATALOGO_METAS_CANONICO) {
      expect(meta.aplicabilidad_pmc).toBeDefined();
      expect(['obligatoria', 'recomendada', 'contextual']).toContain(meta.aplicabilidad_pmc.nivel);
      expect(meta.aplicabilidad_pmc.justificacion.trim().length).toBeGreaterThan(30);
      expect(meta.articulos.length).toBeGreaterThan(0);
      expect(meta.evidencia).toBeDefined();
    }
  });

  it('4. Filtros por categoría y subcategoría operan correctamente', () => {
    expect(getCatalogoMetasPmc().length).toBeGreaterThanOrEqual(17);
    const academicas = getMetasByCategoria('Desarrollo académico y aprendizaje');
    expect(academicas.length).toBe(9);

    const gestion = getMetasByCategoria('Gestión y administración escolar');
    expect(gestion.length).toBe(5);

    const socioemocional = getMetasByCategoria('Desarrollo socioemocional y prevención de la violencia en la escuela');
    expect(socioemocional.length).toBe(3);

    const tutoria = getMetasBySubcategoria('ORIENTACIÓN Y TUTORÍA');
    expect(tutoria.length).toBe(1);
    expect(tutoria[0].id).toBe('meta-orientacion-tutoria-integral');
  });

  it('5. Inyección en prompt genera bloque estructurado sin romper sintaxis', () => {
    const promptSnippet = formatMetasContextForPrompt();
    expect(promptSnippet).toContain('CATÁLOGO CANÓNICO DE METAS OFICIALES');
    expect(promptSnippet).toContain('FORMACIÓN Y ACTUALIZACIÓN DOCENTE');
    expect(promptSnippet).toContain('Fundamento Normativo:');
    expect(promptSnippet).toContain('Aplicabilidad en el PMC');
  });

  // Golden Test contra el archivo físico original del formato 5.2
  const docxOfficialPath = path.resolve(
    __dirname,
    '../../../documentos_referencia/[05] Proyectos_PAEC_y_PMC/ORIENTACIONES PMC 2025-2026/5.2 FORMATO FINAL PARA PLANEACIÓN DE LA MEJORA CONTINUA 2025-2026.docx'
  );

  it.skipIf(!fs.existsSync(docxOfficialPath))(
    '6. [Golden Test] Subcategorías literales verificadas contra el archivo físico oficial 5.2 FORMATO FINAL',
    async () => {
      const extracted = await mammoth.extractRawText({ path: docxOfficialPath });
      const docxText = extracted.value.toUpperCase();

      for (const subcat of SUBCATEGORIAS_OFICIALES_52) {
        expect(docxText).toContain(subcat);
      }
    }
  );

  it('7. Integridad de citas jurídicas: 100% de los artículos resuelven contra la Normateca Oficial y rechazan refs inventadas', () => {
    expect(Object.keys(CANONICAL_NORMATIVA_REFS).length).toBeGreaterThanOrEqual(15);

    // 1. Validar que cada una de las 17 metas contiene citas válidas y resolubles
    let totalCitas = 0;
    for (const meta of CATALOGO_METAS_CANONICO) {
      expect(meta.articulos.length).toBeGreaterThan(0);
      for (const artRef of meta.articulos) {
        totalCitas++;
        const resolved = resolveNormativaCitation(artRef);
        expect(resolved.ok, `Fallo en cita: "${artRef}" de meta "${meta.id}": ${resolved.error}`).toBe(true);
        expect(resolved.documentoId).toBeDefined();
        expect(resolved.documentoTitulo).toBeDefined();
        expect(resolved.articulo).toBeDefined();
      }
    }
    expect(totalCitas).toBeGreaterThanOrEqual(17);

    // 2. Comprobar que rechaza refs inventadas / derogadas (regla de oro de auditoría)
    const refInexistente1 = resolveNormativaCitation('Acuerdo-449-PerfilDirector');
    expect(refInexistente1.ok).toBe(false);
    expect(refInexistente1.error).toContain('no reconocido o no vigente');

    const refInexistente2 = resolveNormativaCitation('LGE-Art.9999');
    expect(refInexistente2.ok).toBe(false);
    expect(refInexistente2.error).toContain('no existe en');

    const refInexistente3 = resolveNormativaCitation('LGSCMM-Art.999');
    expect(refInexistente3.ok).toBe(false);
  });

  // Golden Test contra la carpeta física de documentos_referencia/[08] Normateca
  const normatecaDir = path.resolve(__dirname, '../../../documentos_referencia/[08] Normateca');

  it.skipIf(!fs.existsSync(normatecaDir))(
    '8. [Golden Test] Cotejo físico de las referencias normativas contra el acervo documental de [08] Normateca',
    () => {
      expect(fs.existsSync(normatecaDir)).toBe(true);

      const requiredCategories = [
        'Constituciones Políticas',
        'Ley Local - Ley Federal  - Ley General',
        'Acuerdos',
        'Lineamientos',
      ];

      for (const cat of requiredCategories) {
        const catPath = path.join(normatecaDir, cat);
        expect(fs.existsSync(catPath), `Categoría jurídica "${cat}" debe existir físicamente`).toBe(true);
      }

      // Acuerdo 06/06/15 de formación dual existe en Acuerdos
      const acuerdoDualPath = path.join(normatecaDir, 'Acuerdos', 'a06_06_15.pdf');
      expect(fs.existsSync(acuerdoDualPath)).toBe(true);

      // Comprobar ausencia de Acuerdo 449 (derogado / no vigente)
      const allFiles = fs.readdirSync(normatecaDir, { recursive: true })
        .map((f) => (typeof f === 'string' ? f : String(f)).toLowerCase());

      const hasAcuerdo449 = allFiles.some((f) => f.includes('449') && f.includes('acuerdo'));
      expect(hasAcuerdo449, 'El derogado Acuerdo 449 no debe existir en la Normateca oficial vigente').toBe(false);
    }
  );

  // 9. [Integración DB] Gate por DATABASE_URL: validación de sincronización del diccionario canónico contra Neon DB
  // Requisito de entorno: Este test de integración requiere DATABASE_URL configurada en el entorno o en el archivo .env.local
  // para verificar la sincronización viva con Neon DB. En CI o entornos sin credenciales, se omite de forma segura vía it.skipIf(!dbUrl).
  const dbUrl =
    process.env.DATABASE_URL ||
    (() => {
      try {
        const envPath = path.resolve(__dirname, '../../.env.local');
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

  it('9.a [Unitario] Verificación estricta de matchArticuloExacto: prevención de falsos positivos por subcadenas (H-070)', () => {
    // Tests negativos obligatorios: Art.1 NO debe validar con Articulo 10 ni Articulo 100
    expect(matchArticuloExacto('Art.1', 'Artículo 10')).toBe(false);
    expect(matchArticuloExacto('Art.1', 'ARTÍCULO 10')).toBe(false);
    expect(matchArticuloExacto('Art.1', 'Artículo 100')).toBe(false);
    expect(matchArticuloExacto('Art.2', 'Artículo 21')).toBe(false);
    expect(matchArticuloExacto('Obj.1', 'Objetivo 10')).toBe(false);
    expect(matchArticuloExacto('Lineamiento1', 'Lineamiento 10')).toBe(false);

    // Tests positivos legítimos:
    expect(matchArticuloExacto('Art.1', 'Artículo 1')).toBe(true);
    expect(matchArticuloExacto('Art.1', 'Artículo 1°')).toBe(true);
    expect(matchArticuloExacto('Art.1', 'ARTÍCULO 1')).toBe(true);
    expect(matchArticuloExacto('Art.14', 'Artículo 14')).toBe(true);
    expect(matchArticuloExacto('Obj.1', 'Objetivo 1')).toBe(true);
    expect(matchArticuloExacto('Lineamiento1', 'Lineamiento 1')).toBe(true);
    expect(matchArticuloExacto('LineamientoGeneral', 'Lineamiento General')).toBe(true);
    expect(matchArticuloExacto('ComponenteCurricular', 'Componente Curricular')).toBe(true);
  });

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
