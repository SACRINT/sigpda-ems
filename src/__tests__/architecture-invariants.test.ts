import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { featureFlags, type KnownFeatureFlag } from '@/lib/platform/feature-flags';

describe('C-02 Suite Transversal de Invariantes de Plataforma (SIGPDA-EMS)', () => {
  const rootDir = path.resolve(__dirname, '..');
  const promptsDir = path.join(rootDir, 'lib', 'prompts');

  // ── INVARIANTE 1: CONTRATOS NULL-SAFE EN PROMPTS / SCHEMAS LLM ────────────
  it('Invariante 1: Ninguna ocurrencia de z.string().optional().default(\'\') en src/lib/prompts/', () => {
    const files = fs.readdirSync(promptsDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    expect(files.length).toBeGreaterThan(0);

    const violations: { file: string; line: number; match: string }[] = [];

    const fragilePattern = /z\.string\(\)\.optional\(\)\.default\(['"]['"]\)/;

    for (const file of files) {
      const filePath = path.join(promptsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        if (fragilePattern.test(lineText)) {
          violations.push({
            file,
            line: idx + 1,
            match: lineText.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Se detectaron ${violations.length} ocurrencias del patrón frágil z.string().optional().default('') en src/lib/prompts/. Deben migrarse a nullableString():\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  // ── INVARIANTE 2: RESILIENCIA EN RUTAS DE EXTRACCIÓN PMC / PAEC ───────────
  it('Invariante 2: Toda llamada parseAIResponse en rutas de extracción de PMC y PAEC usa repairNullStrings:true', () => {
    const extractionFiles = [
      path.join(rootDir, 'app', 'api', 'pmc', 'estadistica-911', 'route.ts'),
      path.join(rootDir, 'app', 'api', 'pmc', 'f11', 'route.ts'),
      path.join(rootDir, 'app', 'api', 'pmc', 'parse-previous', 'route.ts'),
      path.join(rootDir, 'app', 'api', 'paec', 'parse-previous', 'route.ts'),
      path.join(rootDir, 'app', 'api', 'pdf', 'parse-paec', 'route.ts'),
      path.join(rootDir, 'lib', 'pmc', 'orchestrator.ts'),
      path.join(rootDir, 'lib', 'paec', 'orchestrator.ts'),
    ];

    const violations: { file: string; calls: number; repairs: number; reason: string }[] = [];

    for (const filePath of extractionFiles) {
      const relPath = path.relative(rootDir, filePath);
      if (!fs.existsSync(filePath)) {
        violations.push({ file: relPath, calls: 0, repairs: 0, reason: 'El archivo de extracción esperado no existe.' });
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const parseMatches = content.match(/parseAIResponse\s*\(/g) || [];
      const repairMatches = content.match(/repairNullStrings\s*:\s*true/g) || [];

      if (parseMatches.length > 0 && repairMatches.length < parseMatches.length) {
        violations.push({
          file: relPath,
          calls: parseMatches.length,
          repairs: repairMatches.length,
          reason: `Se detectaron ${parseMatches.length} llamadas a parseAIResponse pero solo ${repairMatches.length} con repairNullStrings: true.`,
        });
      }
    }

    expect(
      violations,
      `Se detectaron llamadas de extracción sin repairNullStrings: true:\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  // ── INVARIANTE 3: CERO IMPORTS CRUZADOS EN PROMPTS ─────────────────────────
  it('Invariante 3: src/lib/prompts/ no importa módulos de dominio de otros programas (cero imports cruzados)', () => {
    const files = fs.readdirSync(promptsDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

    // Definición de programas aislados y sus rutas prohibidas para imports cruzados
    const programDomains: Record<string, string[]> = {
      pmc: ['paec', 'planeaciones', 'cartografia', 'horarios', 'schedules', 'pips'],
      paec: ['pmc', 'planeaciones', 'cartografia', 'horarios', 'schedules', 'pips'],
      cartografia: ['pmc', 'planeaciones', 'horarios', 'schedules'],
      pips: ['pmc', 'planeaciones', 'horarios', 'schedules'],
    };

    const violations: { file: string; line: number; forbiddenImport: string }[] = [];

    for (const file of files) {
      const filePath = path.join(promptsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Determinar a qué programa pertenece el archivo de prompts
      const lower = file.toLowerCase();
      let matchedProgram: string | undefined = undefined;
      for (const prog of Object.keys(programDomains)) {
        if (lower.startsWith(prog)) {
          matchedProgram = prog;
          break;
        }
      }

      if (!matchedProgram) continue;
      const forbiddenList = programDomains[matchedProgram];

      lines.forEach((lineText, idx) => {
        const trimmed = lineText.trim();
        if (trimmed.startsWith('import ') || trimmed.startsWith('import type ')) {
          for (const forbidden of forbiddenList) {
            // Detecta imports exactos o subdirectorios de dominio: '@/lib/<dom>', '@/lib/<dom>/...', '@/lib/prompts/<dom>...'
            const regex = new RegExp(`from\\s+['"]@/lib/(?:${forbidden}(?:[/\\w-]*)|prompts/${forbidden}(?:[/\\w-]*))['"]`);
            if (regex.test(trimmed)) {
              violations.push({
                file,
                line: idx + 1,
                forbiddenImport: trimmed,
              });
            }
          }
        }
      });
    }

    expect(
      violations,
      `Se detectaron imports cruzados entre programas en src/lib/prompts/:\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  // ── INVARIANTE 4: FLAGS N1 EN FALSE POR DEFECTO ───────────────────────────
  it('Invariante 4: Todos los feature flags N1 de orquestadores permanecen en false por defecto', () => {
    const n1Flags: KnownFeatureFlag[] = [
      'PMC_ORCHESTRATOR_V2',
      'PAEC_ORCHESTRATOR_V2',
      'PLANEACION_ORCHESTRATOR_V2',
      'CARTOGRAFIA_ORCHESTRATOR_V2',
      'HORARIOS_ORCHESTRATOR_V2',
    ];

    for (const flag of n1Flags) {
      const isEnabled = featureFlags.isEnabled(flag);
      expect(
        isEnabled,
        `El feature flag N1 '${flag}' está activo. La regla R2 exige que todos los flags N1 permanezcan en false sin aprobación explícita.`
      ).toBe(false);
    }
  });
});
