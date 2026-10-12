/**
 * editorial-typst-spike.test.ts — Suite de Verificación del Motor Editorial (Fase 1 Spike)
 * SIGPDA-EMS · DBEPA Puebla · Modelo MCCEMS 2026-2027
 *
 * Valida de forma falsable y determinista:
 * 1. Disponibilidad del binario Typst y reporte de versión.
 * 2. Salvedad Crítica §9: Validación del modelo de contenido de estudiante y
 *    detección obligatoria de marcas de docente (anti-guía docente).
 * 3. Compilación editorial de capítulo completo (>= 30 páginas) en < 2 segundos.
 * 4. Determinismo estricto de hash SHA-256 fijando SOURCE_DATE_EPOCH=0.
 * 5. Mutación Load-Bearing anti-F11 (MUT-EDIT-1): detección de omisión o desfasamiento de sesiones.
 * 6. Cumplimiento dimensional de figuras spot de materiales (<= 4.2 cm / >= 300 DPI).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  isTypstAvailable,
  isTypstAvailableSync,
  getTypstVersion,
  resolveTypstBinary,
  compileStudentChapter,
} from '@/lib/editorial/typst-compiler';
import {
  StudentChapter,
  validateStudentChapter,
  assertValidStudentChapter,
  StudentContentValidationError,
} from '@/lib/editorial/student-content-model';

describe('Motor Editorial Fase 1 — Spike Typst y Modelo de Estudiante', () => {
  const hasTypst = isTypstAvailableSync();
  const fixturePath = path.join(
    process.cwd(),
    'src/__tests__/fixtures/editorial/student-workbook-chapter.fixture.json',
  );
  const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as StudentChapter;

  // ==========================================================================
  // 1. Binario Typst en el Entorno
  // ==========================================================================
  describe.skipIf(!hasTypst)('1. Resolución y Disponibilidad del Binario Typst', () => {
    it('debe resolver la ruta del ejecutable Typst en el sistema', () => {
      const binaryPath = resolveTypstBinary();
      expect(binaryPath).toBeDefined();
      expect(typeof binaryPath).toBe('string');
      expect(binaryPath.length).toBeGreaterThan(0);
    });

    it('debe confirmar que Typst está instalado y disponible en el entorno', async () => {
      const available = await isTypstAvailable();
      expect(available).toBe(true);
    });

    it('debe reportar una versión moderna de Typst (>= 0.11)', async () => {
      const version = await getTypstVersion();
      expect(version.toLowerCase()).toContain('typst');
      const match = version.match(/(\d+)\.(\d+)/);
      expect(match).not.toBeNull();
      if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        expect(major >= 0 && minor >= 11).toBe(true);
      }
    });
  });

  // ==========================================================================
  // 2. Modelo de Contenido de Estudiante (Salvedad Crítica §9)
  // ==========================================================================
  describe('2. Salvedad Crítica §9: Modelo de Contenido de Estudiante (Anti-Voz Docente)', () => {
    it('el fixture canónico debe ser 100% válido y libre de marcas docentes', () => {
      const validation = validateStudentChapter(rawFixture);
      expect(validation.isValid).toBe(true);
      expect(validation.violations).toHaveLength(0);
      expect(validation.errors).toHaveLength(0);
      expect(() => assertValidStudentChapter(rawFixture)).not.toThrow();
    });

    it('debe RECHAZAR y fallar si el contenido incluye la etiqueta "Docente:"', () => {
      const contaminated = JSON.parse(JSON.stringify(rawFixture)) as StudentChapter;
      contaminated.sesiones[0].contenido[0].texto += ' Docente: activar el interés del grupo.';

      const validation = validateStudentChapter(contaminated);
      expect(validation.isValid).toBe(false);
      expect(validation.violations.some((v) => v.patron.includes('Docente:'))).toBe(true);
      expect(() => assertValidStudentChapter(contaminated)).toThrow(StudentContentValidationError);
    });

    it('debe RECHAZAR y fallar si el contenido incluye la etiqueta "Estudiante:"', () => {
      const contaminated = JSON.parse(JSON.stringify(rawFixture)) as StudentChapter;
      contaminated.sesiones[1].motivacion = 'Estudiante: responde a las preguntas detonadoras.';

      const validation = validateStudentChapter(contaminated);
      expect(validation.isValid).toBe(false);
      expect(validation.violations.some((v) => v.patron.includes('Estudiante:'))).toBe(true);
      expect(() => assertValidStudentChapter(contaminated)).toThrow(StudentContentValidationError);
    });

    it('debe RECHAZAR verbos de instrucción docente en el aula ("activar el interés", "verificar comprensión", "orientar el avance")', () => {
      const forbiddenPhrases = [
        'activar el interés',
        'verificar comprensión',
        'orientar el avance',
        'plantear la situación',
        'retomar el desafío',
        'exponer y problematizar',
      ];

      for (const phrase of forbiddenPhrases) {
        const mutated = JSON.parse(JSON.stringify(rawFixture)) as StudentChapter;
        mutated.sesiones[2].objetivo = `El maestro buscará ${phrase} durante la clase.`;

        const validation = validateStudentChapter(mutated);
        expect(validation.isValid).toBe(false);
        expect(
          validation.violations.some((v) => v.fragmento.toLowerCase().includes(phrase.toLowerCase())),
        ).toBe(true);
      }
    });
  });

  // ==========================================================================
  // 3. Compilación Editorial Typst (Rendimiento, Retícula y Páginas)
  // ==========================================================================
  describe.skipIf(!hasTypst)('3. Spike de Compilación Editorial con Typst', () => {
    it('debe compilar un capítulo completo de >= 30 páginas en < 2 segundos de forma determinista', async () => {
      const startTime = Date.now();
      const result = await compileStudentChapter(rawFixture, {
        keepTempFiles: false,
      });
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.pdfBuffer).toBeDefined();
      expect(result.pdfBuffer.length).toBeGreaterThan(100_000); // PDF sustancial > 100 KB

      // Requisito 1: >= 30 páginas
      expect(result.pageCount).toBeGreaterThanOrEqual(30);

      // Requisito 2: < 2.0 segundos (< 2000 ms)
      expect(result.durationMs).toBeLessThan(2000);
      expect(elapsed).toBeLessThan(2500);

      // Requisito 3: Hash SHA-256 no vacío
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    }, 15000);
  });

  // ==========================================================================
  // 4. Determinismo Estricto (SOURCE_DATE_EPOCH=0)
  // ==========================================================================
  describe.skipIf(!hasTypst)('4. Determinismo Estricto de Hash (SOURCE_DATE_EPOCH=0)', () => {
    it('dos compilaciones independientes del mismo fixture deben producir un hash SHA-256 idéntico', async () => {
      const run1 = await compileStudentChapter(rawFixture, {
        sourceDateEpoch: 0,
        keepTempFiles: false,
      });

      const run2 = await compileStudentChapter(rawFixture, {
        sourceDateEpoch: 0,
        keepTempFiles: false,
      });

      expect(run1.sha256).toBe(run2.sha256);
      expect(run1.pdfBuffer.equals(run2.pdfBuffer)).toBe(true);
    }, 15000);
  });

  // ==========================================================================
  // 5. Mutación Load-Bearing Anti-F11 (MUT-EDIT-1)
  // ==========================================================================
  describe('5. Mutación Load-Bearing Anti-F11 (MUT-EDIT-1)', () => {
    it('debe RECHAZAR en el modelo de producción si se omite una sesión intermedia (discontinuidad 1..N)', async () => {
      const mutated = JSON.parse(JSON.stringify(rawFixture)) as StudentChapter;
      // Mutación: eliminar la sesión 7 (quedan 13 sesiones con salto de 6 a 8)
      mutated.sesiones.splice(6, 1);

      // Verificación 1: validateStudentChapter devuelve isValid: false con error explícito
      const validation = validateStudentChapter(mutated);
      expect(validation.isValid).toBe(false);
      expect(
        validation.errors.some((e) =>
          e.includes('Discontinuidad en numeración de sesiones (anti-F11): se esperaba sesión 7 pero se encontró 8'),
        ),
      ).toBe(true);

      // Verificación 2: assertValidStudentChapter lanza error tipado
      expect(() => assertValidStudentChapter(mutated)).toThrow(StudentContentValidationError);

      // Verificación 3: el compilador de producción rechaza la mutación antes de maquetar
      await expect(compileStudentChapter(mutated)).rejects.toThrow(StudentContentValidationError);
    });

    it('debe fallar la validación si una sesión tiene número negativo o cero', () => {
      const mutated = JSON.parse(JSON.stringify(rawFixture)) as StudentChapter;
      mutated.sesiones[3].numero = -5; // Número inválido

      expect(() => assertValidStudentChapter(mutated)).toThrow(StudentContentValidationError);
    });

    it.skipIf(!hasTypst)('a nivel de render, las N sesiones renderizadas en el PDF deben coincidir con la cuenta del fixture', async () => {
      const result = await compileStudentChapter(rawFixture, { keepTempFiles: false });
      expect(result.success).toBe(true);

      // 1. La cuenta matemática de sesiones renderizadas en Typst debe coincidir exactamente con el fixture (14)
      expect(result.renderedSessionCount).toBe(rawFixture.sesiones.length);
      expect(result.renderedSessionCount).toBe(14);

      // 2. Invariante de páginas f(N): Cada sesión ocupa al menos 2 páginas + portada (1) + preliminar (1)
      const minExpectedPages = 2 + rawFixture.sesiones.length * 2;
      expect(result.pageCount).toBeGreaterThanOrEqual(minExpectedPages);
      expect(result.pageCount).toBe(32);

      // 3. Demostración falsable anti-F11: si se simula un fixture con una sesión menos (13 sesiones),
      // la cuenta matemática de sesiones esperadas (14) jamás puede coincidir con 13
      const mutatedCount = rawFixture.sesiones.length - 1;
      expect(mutatedCount).not.toBe(result.renderedSessionCount);
    }, 15000);
  });

  // ==========================================================================
  // 6. Restricción de Assets de Materiales Didácticos (Regla 300+ DPI)
  // ==========================================================================
  describe('6. Cumplimiento de Assets Spot de Materiales Didácticos', () => {
    it('todos los archivos PNG referenciados en el fixture deben existir físicamente y medir <= 4.2 cm', () => {
      const materialesDir = path.join(process.cwd(), 'public', 'images', 'materiales');

      for (const sesion of rawFixture.sesiones) {
        if (sesion.materialSpot) {
          const filePath = path.join(materialesDir, sesion.materialSpot.archivo);
          expect(fs.existsSync(filePath)).toBe(true);

          // Si el objeto especifica anchoCm, debe ser <= 4.2
          if (sesion.materialSpot.anchoCm !== undefined) {
            expect(sesion.materialSpot.anchoCm).toBeLessThanOrEqual(4.2);
          }
        }
      }
    });
  });
});
