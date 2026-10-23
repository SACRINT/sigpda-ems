import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveSchoolIdentity,
  resolverIdentidadEscolar,
  supervisionLabel,
  PLANTEL_NO_REGISTRADO,
  CCT_NO_REGISTRADO,
  MUNICIPIO_NO_REGISTRADO,
  SUPERVISION_SIN_ZONA,
} from '@/lib/school-identity';
import { buscarPlantelPorNombre } from '@/lib/catalogo-escuelas';

describe('Identidad escolar — plantel / CCT / zona supervisión', () => {
  it('resuelve Héroes de la Patria con su CCT, municipio y zona oficiales del catálogo', () => {
    const ficha = buscarPlantelPorNombre('Héroes de la Patria');
    expect(ficha?.cct).toBe('21EBH0200X');
    expect(ficha?.municipio).toBe('Venustiano Carranza');
    expect(ficha?.zonaEscolar).toBe('Zona Escolar 086');
    expect(ficha?.subsistema).toBe('BGE');
  });

  it('la precedencia es sectionI (Paso 3) > coverData > perfil docente', () => {
    const identidad = resolveSchoolIdentity({
      sectionI: { schoolName: 'Plantel capturado', cct: '21AAA0001A' },
      cover: { schoolName: 'Plantel de portada', cct: '21BBB0002B' },
      teacher: { schoolName: 'Plantel del perfil', cct: '21CCC0003C' },
    });
    expect(identidad.schoolName).toBe('Plantel capturado');
    expect(identidad.cct).toBe('21AAA0001A');
  });

  it('corrige un CCT heredado cuando el nombre del plantel sí está en el catálogo', () => {
    const identidad = resolveSchoolIdentity({
      sectionI: { schoolName: 'Héroes de la Patria', cct: '21ECT0017T' },
    });
    expect(identidad.cct).toBe('21EBH0200X');
    expect(identidad.municipality).toBe('Venustiano Carranza');
    expect(identidad.schoolZone).toBe('Zona Escolar 086');
    expect(identidad.supervision).toBe('SUPERVISIÓN DE BACHILLERATOS 086');
  });

  it('la zona capturada por el docente tiene precedencia sobre el catálogo (bug 004→086)', () => {
    const identidad = resolveSchoolIdentity({
      sectionI: { schoolName: 'Héroes de la Patria', schoolZone: 'Zona Escolar 086' },
    });
    expect(identidad.schoolZone).toBe('Zona Escolar 086');
    expect(identidad.supervision).toBe('SUPERVISIÓN DE BACHILLERATOS 086');

    const payload = resolverIdentidadEscolar({
      schoolName: 'Héroes de la Patria',
      schoolZone: 'Zona Escolar 086',
    });
    expect(payload.schoolZone).toBe('Zona Escolar 086');
  });

  it('nunca inventa plantel ni CCT: degrada a marcadores honestos', () => {
    const identidad = resolveSchoolIdentity({});
    expect(identidad.schoolName).toBe(PLANTEL_NO_REGISTRADO);
    expect(identidad.cct).toBe(CCT_NO_REGISTRADO);
    expect(identidad.municipality).toBe(MUNICIPIO_NO_REGISTRADO);
    expect(identidad.schoolZone).toBeNull();
    expect(identidad.supervision).toBe(SUPERVISION_SIN_ZONA);
  });

  it('la etiqueta de supervisión deriva siempre de la zona real (nunca de un default 004)', () => {
    expect(supervisionLabel('086')).toBe('SUPERVISIÓN DE BACHILLERATOS 086');
    expect(supervisionLabel('Zona 086')).toBe('SUPERVISIÓN DE BACHILLERATOS 086');
    expect(supervisionLabel('Zona Escolar 001')).toBe('SUPERVISIÓN DE BACHILLERATOS 001');
    expect(supervisionLabel('')).toBe(SUPERVISION_SIN_ZONA);
    expect(supervisionLabel(null)).toBe(SUPERVISION_SIN_ZONA);
  });

  it('resolverIdentidadEscolar completa municipio y zona desde el catálogo al persistir', () => {
    const payload = resolverIdentidadEscolar({
      schoolName: 'Héroes de la Patria',
      municipality: 'Dato equivocado',
    });
    expect(payload.cct).toBe('21EBH0200X');
    expect(payload.municipality).toBe('Venustiano Carranza');
    expect(payload.schoolZone).toBe('Zona Escolar 086');

    const desconocido = resolverIdentidadEscolar({ schoolName: 'Escuela Inexistente' });
    expect(desconocido.cct).toBeNull();
    expect(desconocido.schoolZone).toBeNull();
    expect(desconocido.schoolName).toBe('Escuela Inexistente');
  });

  it('un municipio no puede confundirse con el nombre de un plantel (perfil corrupto)', () => {
    const identidad = resolveSchoolIdentity({
      teacher: { schoolName: 'Francisco Z. Mena', cct: null },
    });
    expect(identidad.schoolName).toBe('Francisco Z. Mena');
    expect(identidad.cct).toBe(CCT_NO_REGISTRADO);
  });
});

describe('Anti-hardcode: ningún renderer puede fabricar plantel/CCT/supervisión', () => {
  const srcDir = path.resolve(__dirname, '..');
  const prohibido: Array<{ archivo: string; patron: RegExp; motivo: string }> = [
    { archivo: 'lib/planning-pdf-renderer.ts', patron: /Bachillerato General Oficial/, motivo: 'plantel falso en PDF de planeación' },
    { archivo: 'lib/planning-pdf-renderer.ts', patron: /SUPERVISIÓN DE BACHILLERATOS 004/, motivo: 'supervisión 004 por defecto' },
    { archivo: 'lib/pdf-workbook-renderer.ts', patron: /21ECT0017T/, motivo: 'CCT ajeno hardcodeado en libros PDF' },
    { archivo: 'lib/docx-workbook-renderer.ts', patron: /21ECT0017T/, motivo: 'CCT ajeno hardcodeado en libros DOCX' },
    { archivo: 'lib/docx-workbook-renderer.ts', patron: /Bachillerato del Estado de Puebla/, motivo: 'plantel falso en libros DOCX' },
    { archivo: 'lib/visual-engine/cover-generator.ts', patron: /21ECT0017T/, motivo: 'CCT ajeno en portadas' },
    { archivo: 'lib/visual-engine/cover-generator.ts', patron: /Bachillerato General Oficial/, motivo: 'plantel falso en portadas' },
    { archivo: 'lib/guide-engine/block-guide-orchestrator.ts', patron: /21ECT0017T/, motivo: 'CCT ajeno en coverData' },
    { archivo: 'lib/prompts/build-prompt.ts', patron: /'Venustiano Carranza'/, motivo: 'municipio fijo en prompt' },
    { archivo: 'lib/prompts/build-prompt.ts', patron: /'CORDE 01 Huauchinango'/, motivo: 'CORDE fija en prompt' },
    { archivo: 'lib/prompts/build-prompt.ts', patron: /'21EBH0200X'/, motivo: 'CCT ajeno como default del prompt' },
    { archivo: 'lib/planning/quality-pipeline.ts', patron: /21EBH0200X/, motivo: 'CCT ajeno como fallback del sanitizador' },
    { archivo: 'lib/planning-integrity-system.ts', patron: /21EBH0000X/, motivo: 'CCT comodín en extracto de integridad' },
    { archivo: 'lib/document-branding.ts', patron: /21EBH0000X/, motivo: 'CCT comodín institucional' },
    { archivo: 'components/common/DocumentA4Viewer.tsx', patron: /SUPERVISIÓN ESCOLAR 004/, motivo: 'supervisión 004 fija en la vista A4' },
    { archivo: 'components/common/DocumentA4Viewer.tsx', patron: /Bachillerato General Oficial/, motivo: 'plantel falso en la vista A4' },
    { archivo: 'lib/planning-pdf-renderer.ts', patron: /Zona 004|Zona Escolar 004/, motivo: 'zona 004 hardcodeada en PDF de planeación' },
    { archivo: 'lib/planning-integrity-system.ts', patron: /Supervisión Escolar 004|Zona Escolar 004/, motivo: 'zona 004 hardcodeada en extracto de integridad' },
    { archivo: 'lib/paec-pdf-generator.ts', patron: /Zona 004|Zona Escolar 004|Supervisión Escolar Zona 004/, motivo: 'zona 004 hardcodeada en PDF PAEC' },
    { archivo: 'lib/paec-docx-generator.ts', patron: /Zona Escolar 004|Supervisión Escolar Zona 004/, motivo: 'zona 004 hardcodeada en DOCX PAEC' },
    { archivo: 'lib/paec-quality-gate.ts', patron: /ZONA 004/, motivo: 'zona 004 hardcodeada en dictamen PAEC' },
    { archivo: 'lib/horarios/exportador.ts', patron: /ZONA 004/, motivo: 'zona 004 hardcodeada en exportación de horarios' },
    { archivo: 'lib/pmc-docx-generator.ts', patron: /'Zona Escolar 004'/, motivo: 'zona 004 como fallback en DOCX PMC' },
    { archivo: 'lib/analytics/aggregations.ts', patron: /'Zona Escolar 004'/, motivo: 'zona 004 como fallback en analítica' },
    { archivo: 'lib/prompts/pips-chunks.ts', patron: /Zona Escolar 004|la zona 004|ZONA 004/, motivo: 'zona 004 fija en prompts PIPS' },
    { archivo: 'lib/prompts/paec-prompts.ts', patron: /Supervisión Escolar 004/, motivo: 'supervisión 004 fija en prompts PAEC' },
    { archivo: 'lib/zone-sync-service.ts', patron: /'21FMS0004Z'|\|\| '004'/, motivo: 'zona 004 como fallback en zone-sync' },
    { archivo: 'lib/cartografia-context-builder.ts', patron: /'21FMS0004Z'|\|\| '004'/, motivo: 'zona 004 como fallback en context-builder' },
    { archivo: 'lib/cartografia-zona-docx-generator.ts', patron: /\|\| '004'/, motivo: 'zona 004 como fallback en DOCX de cartografía' },
    { archivo: 'app/api/admin/catalogo-escuelas/route.ts', patron: /'Zona Escolar 004'/, motivo: 'zona 004 como fallback en búsqueda de catálogo' },
    { archivo: 'app/api/pdf/libro-editorial/[id]/route.ts', patron: /'Zona Escolar 004'/, motivo: 'zona 004 como fallback en portada editorial' },
  ];

  it('ningún archivo de render/prompt contiene plantel, CCT o supervisión fabricados', () => {
    const violaciones: string[] = [];
    for (const regla of prohibido) {
      const contenido = fs.readFileSync(path.join(srcDir, regla.archivo), 'utf-8');
      if (regla.patron.test(contenido)) {
        violaciones.push(`${regla.archivo}: ${regla.motivo}`);
      }
    }
    expect(violaciones).toEqual([]);
  });
});
