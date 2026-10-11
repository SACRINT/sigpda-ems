import { describe, it, expect } from 'vitest';
import {
  FORBIDDEN_PM3_TERMINOLOGY_REGEX,
  lintPedagogicalTerminology,
  runPedagogicalAudit,
} from '@/lib/guide-engine/pedagogical-quality-gate';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

describe('F-63: Pedagogical Quality Gate - Terminology Linting', () => {
  it('detecta balanza romana en strings y objetos con acentos y variaciones', () => {
    expect(FORBIDDEN_PM3_TERMINOLOGY_REGEX.test('Usamos una balanza romana para comparar.')).toBe(true);
    expect(FORBIDDEN_PM3_TERMINOLOGY_REGEX.test('Utilizamos balanza   romana antigua.')).toBe(true);
    expect(FORBIDDEN_PM3_TERMINOLOGY_REGEX.test('Una báscula de dos platillos en equilibrio.')).toBe(true);
    expect(FORBIDDEN_PM3_TERMINOLOGY_REGEX.test('Una bascula de dos platillo para medir.')).toBe(true);
  });

  it('no detecta falsos positivos en balanza analítica, digital o algebraica', () => {
    expect(FORBIDDEN_PM3_TERMINOLOGY_REGEX.test('Balanza analítica de precisión')).toBe(false);
    expect(FORBIDDEN_PM3_TERMINOLOGY_REGEX.test('Báscula digital de laboratorio')).toBe(false);
    expect(FORBIDDEN_PM3_TERMINOLOGY_REGEX.test('Balanza algebraica de equilibrio')).toBe(false);
  });

  it('lintPedagogicalTerminology reporta hasForbiddenTerminology y lista las coincidencias', () => {
    const textWithForbidden = 'El modelo se ilustra con una balanza romana y luego una báscula de dos platillos.';
    const result = lintPedagogicalTerminology(textWithForbidden);

    expect(result.hasForbiddenTerminology).toBe(true);
    expect(result.forbiddenMatches.length).toBeGreaterThanOrEqual(2);
    expect(result.recommendation).toContain('Sustituir instrumental');
  });

  it('runPedagogicalAudit añade recomendación cuando el libro contiene términos prohibidos', () => {
    const mockBook = {
      missions: [
        {
          missionIndex: 1,
          title: 'Misión 1',
          sessionFocus: 'Enfoque',
          conceptZero: {
            physicalAnalogy: 'Imaginemos una balanza romana en el mercado tradicional.',
            coreExplanation: 'Explicación formal de equilibrio.',
          },
          iDoSection: { stepByStepDemo: 'Demo' },
          weDoSection: { guidedPractice: 'Práctica' },
          youDoSection: { autonomousChallenge: 'Reto' },
        },
      ],
      projectSection: { artifactName: 'Proyecto', communityUtility: 'Utilidad comunitaria amplia' },
      evaluationSection: { rubric: [] },
    } as unknown as ActiveWorkTextbook;

    const audit = runPedagogicalAudit(mockBook);
    expect(audit.terminologyLint?.hasForbiddenTerminology).toBe(true);
    expect(audit.bapRecommendations.some((r) => r.includes('balanza romana'))).toBe(true);
  });
});
