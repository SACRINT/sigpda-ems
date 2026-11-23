import { describe, expect, it } from 'vitest';

import {
  cleanSacrintText,
  repairSpanishSurfaceGrammar,
  sanitizePedagogicalMetaPhrases,
} from '@/lib/visual-engine/sacrint/content-distiller';
import {
  extractDisciplinaryConceptPhrase,
  resolveChalkboardTopicTitle,
  resolveInfographicConceptTitle,
} from '@/lib/editorial/topic-title-resolver';
import { scanEditorialDefects } from '../../scripts/qa-sacrint-materials';

describe('calidad superficial editorial — concordancia y títulos corruptos', () => {
  it('repara concordancias visibles sin alterar términos disciplinares', () => {
    expect(repairSpanishSurfaceGrammar('Incorpora todas los respaldos de la sesión.')).toBe(
      'Incorpora todos los respaldos de la sesión.'
    );
    expect(repairSpanishSurfaceGrammar('Revisa todas los inspecciones del bloque.')).toBe(
      'Revisa todas las inspecciones del bloque.'
    );
    expect(repairSpanishSurfaceGrammar('Incluye todos las pautas de aceptación requeridos.')).toBe(
      'Incluye todas las pautas de aceptación requeridas.'
    );
    expect(repairSpanishSurfaceGrammar('¿He aplicado las pautas técnicos de la norma?')).toBe(
      '¿He aplicado las pautas técnicas de la norma?'
    );
    expect(repairSpanishSurfaceGrammar('Emplea los tres clases de líneas normalizadas.')).toBe(
      'Emplea las tres clases de líneas normalizadas.'
    );
    expect(repairSpanishSurfaceGrammar('Procede conforme a corresponda.')).toBe(
      'Procede conforme corresponda.'
    );
    expect(repairSpanishSurfaceGrammar('Entrega los respaldos de aprendizaje firmadas.')).toBe(
      'Entrega los respaldos de aprendizaje firmados.'
    );
    expect(repairSpanishSurfaceGrammar('Entrega los respaldos requeridas.')).toBe(
      'Entrega los respaldos requeridos.'
    );
  });

  it('aplica la reparación en los dos embudos de texto visibles', () => {
    expect(cleanSacrintText('Revisa todas los inspecciones del bloque.')).toContain(
      'todas las inspecciones'
    );
    expect(sanitizePedagogicalMetaPhrases('Incorpora todos las pautas de aceptación requeridos.')).toBe(
      'Incorpora todas las pautas de aceptación requeridas.'
    );
  });

  it('rechaza fragmentos de sesión y paréntesis incompletos en títulos', () => {
    expect(
      extractDisciplinaryConceptPhrase(
        ') — Sesión 22: Session 22: Negative forms: There isn\'t / There aren\'t and'
      )
    ).toBe('');
    expect(extractDisciplinaryConceptPhrase('(Ciencias Naturales')).toBe('');
    expect(extractDisciplinaryConceptPhrase('Digitalizas planos técnicos')).toBe('');
  });

  it('recorta la segunda persona incrustada en lugar de publicarla', () => {
    expect(
      extractDisciplinaryConceptPhrase(
        'Sistemas de unidades SI y anglosajón, identificas sus magnitudes esenciales'
      )
    ).toBe('Sistemas de unidades SI y anglosajón');
    expect(
      extractDisciplinaryConceptPhrase('Fundamentos de la igualdad algebraica, identificas variables')
    ).toBe('Fundamentos de la igualdad algebraica');
    expect(
      extractDisciplinaryConceptPhrase(
        'Evolución histórica del dibujo técnico, comprendes las normas ISO y NOM vigentes'
      )
    ).toBe('Evolución histórica del dibujo técnico');
    expect(
      extractDisciplinaryConceptPhrase('Memoria técnica descriptiva y realizas la defensa grupal')
    ).toBe('Memoria técnica descriptiva');
  });

  it('repara el título ungramatical de resultados sin dejar la frase rota', () => {
    expect(
      extractDisciplinaryConceptPhrase('Resultados obtenidos y a jerarquizar las problemáticas')
    ).toBe('Jerarquización de problemáticas');
  });

  it('resuelve títulos válidos cuando el candidato principal está corrupto', () => {
    const cnet = resolveChalkboardTopicTitle({
      sectionTitle: '(Ciencias Naturales',
      sessionObjective: 'Comprender la diferencia entre masa y peso',
      missionSessionTopic: 'Diferencia entre masa y peso',
    });
    expect(cnet).toBe('Diferencia entre masa y peso');

    const i1 = resolveChalkboardTopicTitle({
      sectionTitle: ") — Sesión 22: Session 22: Negative forms: There isn't / There aren't and",
      sessionObjective: 'Expresar la inexistencia de objetos en lugares concretos',
    });
    expect(i1).not.toMatch(/^\)/);
    expect(i1.toLowerCase()).not.toContain('sesión');

    const pmcc = resolveInfographicConceptTitle({
      sectionTitle: 'Digitalizas planos técnicos',
      sessionObjective: 'Digitalizar planos técnicos utilizando herramientas CAD',
    });
    expect(pmcc).not.toMatch(/^Digitalizas\b/i);
    expect(pmcc.toLowerCase()).toContain('planos');
  });

  it('QA detecta concordancias y títulos estructuralmente corruptos', () => {
    const concordance = scanEditorialDefects(
      'Revisa todas los inspecciones y entrega los respaldos requeridas.'
    );
    expect(concordance.surface_concordance?.length).toBeGreaterThan(0);

    const malformed = scanEditorialDefects(
      'Título del tema\n) — Sesión 22: Session 22: Negative forms\n(Ciencias Naturales'
    );
    expect(malformed.corrupt_title_fragment?.length).toBeGreaterThan(0);
    expect(malformed.corrupt_title_paren?.length).toBeGreaterThan(0);

    const broken = scanEditorialDefects('Resultados obtenidos y a jerarquizar las problemáticas');
    expect(broken.broken_nominal_title?.length).toBeGreaterThan(0);
  });
});
