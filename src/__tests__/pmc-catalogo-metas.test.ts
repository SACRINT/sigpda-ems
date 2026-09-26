import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import {
  CATALOGO_METAS_CANONICO,
  SUBCATEGORIAS_OFICIALES_52,
  CATEGORIAS_OFICIALES_52,
  getCatalogoMetasPmc,
  getMetasByCategoria,
  getMetasBySubcategoria,
  formatMetasContextForPrompt,
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
});
