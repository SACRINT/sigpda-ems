/**
 * Pruebas de Invariantes del Catálogo de Estrategias Didácticas — SIGPDA-EMS
 *
 * Valida los 5 invariantes pedagógicos de dominio real consensuados en las
 * 3 fases de revisión por pares (OpenCode + Antigravity Staff Architect).
 *
 * Distribución esperada: 4 Apertura · 6 Desarrollo · 4 Cierre (14 total)
 */

import { describe, it, expect } from 'vitest';
import {
  CATALOGO_ESTRATEGIAS,
  obtenerEstrategiaPorId,
  obtenerEstrategiasPorMomento,
  obtenerEstrategiasCompatibles,
  formatearEstrategiasParaPrompt,
  type MomentoDidactico,
} from '@/lib/catalogo-estrategias';
import { CATALOGO_METODOLOGIAS_ACTIVAS } from '@/lib/catalogo-metodologias';

const MOMENTOS: MomentoDidactico[] = ['apertura', 'desarrollo', 'cierre'];
const MIN_ESTRATEGIAS_POR_MOMENTO = 4;
const MIN_ESTRATEGIAS_POR_METODOLOGIA = 3;
const MIN_OFFLINE_LENGTH = 20;
const MIN_FRACTION_CIERRE_CON_INSTRUMENTO = 0.5;

describe('Catálogo de Estrategias Didácticas — Invariantes de Dominio', () => {

  // ─── Invariante 1: Cobertura de Momentos ──────────────────────────────────

  describe('Invariante 1: Cobertura de Momentos', () => {
    it.each(MOMENTOS)(
      'el momento "%s" debe tener >= 4 estrategias asignables',
      (momento: MomentoDidactico) => {
        const estrategias = obtenerEstrategiasPorMomento(momento);
        expect(estrategias.length).toBeGreaterThanOrEqual(MIN_ESTRATEGIAS_POR_MOMENTO);
      }
    );

    it('el catálogo debe tener exactamente 14 estrategias en total', () => {
      expect(CATALOGO_ESTRATEGIAS).toHaveLength(14);
    });
  });

  // ─── Invariante 2: Asignación Válida ──────────────────────────────────────

  describe('Invariante 2: Asignación Válida', () => {
    it('toda estrategia debe pertenecer a al menos 1 momento didáctico', () => {
      for (const estrategia of CATALOGO_ESTRATEGIAS) {
        expect(estrategia.momentosAplicables.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('momentosAplicables solo debe contener momentos válidos', () => {
      const momentosValidos = new Set<string>(MOMENTOS);
      for (const estrategia of CATALOGO_ESTRATEGIAS) {
        for (const momento of estrategia.momentosAplicables) {
          expect(momentosValidos.has(momento)).toBe(true);
        }
      }
    });

    it('momentoPrincipal debe estar incluido en momentosAplicables', () => {
      for (const estrategia of CATALOGO_ESTRATEGIAS) {
        expect(estrategia.momentosAplicables).toContain(estrategia.momentoPrincipal);
      }
    });
  });

  // ─── Invariante 3: Afinidad Metodológica ──────────────────────────────────

  describe('Invariante 3: Afinidad Metodológica', () => {
    it('cada metodología activa debe tener >= 3 estrategias compatibles', () => {
      for (const metodologia of CATALOGO_METODOLOGIAS_ACTIVAS) {
        const compatibles = obtenerEstrategiasCompatibles(metodologia.id);
        expect(compatibles.length).toBeGreaterThanOrEqual(MIN_ESTRATEGIAS_POR_METODOLOGIA);
      }
    });

    it('el catálogo debe tener exactamente 10 metodologías activas', () => {
      expect(CATALOGO_METODOLOGIAS_ACTIVAS).toHaveLength(10);
    });

    it('abproblemas e indagacion deben existir en el catálogo de metodologías', () => {
      const ids = CATALOGO_METODOLOGIAS_ACTIVAS.map(m => m.id);
      expect(ids).toContain('abproblemas');
      expect(ids).toContain('indagacion');
    });

    it('abproblemas debe tener nombreCorto ABProblemas (nunca ABP)', () => {
      const met = CATALOGO_METODOLOGIAS_ACTIVAS.find(m => m.id === 'abproblemas');
      expect(met).toBeDefined();
      expect(met!.nombreCorto).toBe('ABProblemas');
      expect(met!.nombreCorto).not.toBe('ABP');
    });

    it('indagacion debe tener nombreCorto que contenga ABI', () => {
      const met = CATALOGO_METODOLOGIAS_ACTIVAS.find(m => m.id === 'indagacion');
      expect(met).toBeDefined();
      expect(met!.nombreCorto).toContain('ABI');
    });
  });

  // ─── Invariante 4: Garantía Dual Offline ──────────────────────────────────

  describe('Invariante 4: Garantía Dual Offline', () => {
    it('el 100% de las estrategias debe documentar una alternativa offline >= 20 chars', () => {
      for (const estrategia of CATALOGO_ESTRATEGIAS) {
        expect(estrategia.garantiaDualOffline).toBeDefined();
        expect(typeof estrategia.garantiaDualOffline).toBe('string');
        expect(estrategia.garantiaDualOffline.trim().length).toBeGreaterThanOrEqual(MIN_OFFLINE_LENGTH);
      }
    });
  });

  // ─── Invariante 5: Evaluación Formal en Cierre ────────────────────────────

  describe('Invariante 5: Evaluación Formal en Cierre', () => {
    it('>= 50% de las estrategias de cierre deben tener instrumentoSugerido', () => {
      const estrategiasDeCierre = obtenerEstrategiasPorMomento('cierre');
      const conInstrumento = estrategiasDeCierre.filter(
        e => e.instrumentoSugerido && e.instrumentoSugerido.trim().length > 0
      );
      expect(estrategiasDeCierre.length).toBeGreaterThan(0);
      const fraccion = conInstrumento.length / estrategiasDeCierre.length;
      expect(fraccion).toBeGreaterThanOrEqual(MIN_FRACTION_CIERRE_CON_INSTRUMENTO);
    });
  });

  // ─── Tests de funciones Helper ─────────────────────────────────────────────

  describe('Funciones Helper del Catálogo', () => {
    it('obtenerEstrategiaPorId debe encontrar una estrategia por slug', () => {
      const est = obtenerEstrategiaPorId('cuestionamiento_socratico');
      expect(est).toBeDefined();
      expect(est!.id).toBe('cuestionamiento_socratico');
    });

    it('obtenerEstrategiaPorId debe normalizar minúsculas y trim', () => {
      const est = obtenerEstrategiaPorId('  Cuestionamiento_Socratico  ');
      expect(est).toBeDefined();
    });

    it('obtenerEstrategiaPorId debe retornar undefined para ID inexistente', () => {
      const est = obtenerEstrategiaPorId('no_existe_esta_estrategia');
      expect(est).toBeUndefined();
    });

    it('obtenerEstrategiasPorMomento debe filtrar estrategias correctamente', () => {
      const apertura = obtenerEstrategiasPorMomento('apertura');
      apertura.forEach(e => {
        expect(e.momentosAplicables).toContain('apertura');
      });
    });

    it('obtenerEstrategiasCompatibles debe incluir estrategias universales (*)', () => {
      const compatibles = obtenerEstrategiasCompatibles('cualquier_id_inexistente');
      const universales = CATALOGO_ESTRATEGIAS.filter(e => e.metodologiasCompatibles.includes('*'));
      universales.forEach(u => {
        expect(compatibles.some(c => c.id === u.id)).toBe(true);
      });
    });

    it('formatearEstrategiasParaPrompt debe retornar una cadena no vacía para ABP/Apertura', () => {
      const resultado = formatearEstrategiasParaPrompt('apertura', 'abp');
      expect(typeof resultado).toBe('string');
      expect(resultado.trim().length).toBeGreaterThan(0);
    });

    it('formatearEstrategiasParaPrompt debe funcionar para todas las 10 metodologías y 3 momentos', () => {
      for (const metodologia of CATALOGO_METODOLOGIAS_ACTIVAS) {
        for (const momento of MOMENTOS) {
          const resultado = formatearEstrategiasParaPrompt(momento, metodologia.id);
          expect(typeof resultado).toBe('string');
        }
      }
    });

    it('formatearEstrategiasParaPrompt no debe generar "undefined" ni "null" en la salida de cierre', () => {
      for (const metodologia of CATALOGO_METODOLOGIAS_ACTIVAS) {
        const salida = formatearEstrategiasParaPrompt('cierre', metodologia.id);
        expect(salida).not.toContain('undefined');
        expect(salida).not.toContain('null');
      }
    });
  });

});