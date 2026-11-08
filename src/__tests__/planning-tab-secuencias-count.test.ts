import { describe, it, expect } from 'vitest';
import { resolveCurricularBlocks } from '@/lib/curricular-blocks';
import { generateCurricularBlockSessions } from '@/lib/session-progression-engine';
import type { GeneratedPlanningContent, PlanningExtra } from '@/types/planning';

describe('PlanningTabSecuencias - Conteo dinámico de planes generados', () => {
  // Simulamos Pensamiento Matemático III: 72 horas, 3 bloques con 2 actividades de 12 horas cada uno
  const pm3Content: GeneratedPlanningContent = {
    sectionI: {
      uacName: 'Pensamiento Matemático III',
      totalHours: 72,
      component: 'Fundamental',
    },
    sectionIV: {
      activities: [
        { name: 'Actividad 1 Bloque 1', hours: 12 },
        { name: 'Actividad 2 Bloque 1', hours: 12 },
        { name: 'Actividad 1 Bloque 2', hours: 12 },
        { name: 'Actividad 2 Bloque 2', hours: 12 },
        { name: 'Actividad 1 Bloque 3', hours: 12 },
        { name: 'Actividad 2 Bloque 3', hours: 12 },
      ],
    },
  } as unknown as GeneratedPlanningContent;

  it('calcula exactamente 72 planes generados para 3 bloques de 24 sesiones (no cae a 36)', () => {
    const curricularBlocks = resolveCurricularBlocks(pm3Content);
    expect(curricularBlocks).toHaveLength(3);

    const blockSessionsMap = curricularBlocks.map((block) =>
      generateCurricularBlockSessions(block, false, null)
    );

    const allDetailedSessions = blockSessionsMap.flat();
    expect(allDetailedSessions).toHaveLength(72);

    // Simulamos 72 planes persistidos canónicamente en DB (key_index = 0, 1, 2)
    const dbExtras: PlanningExtra[] = [];
    for (let b = 0; b < 3; b++) {
      for (let s = 1; s <= 24; s++) {
        dbExtras.push({
          id: `extra-b${b}-s${s}`,
          planningId: 'test-plan',
          type: 'lesson_plan',
          title: `Plan de Clase: Sesión ${s} · Tema`,
          keyIndex: b,
          contentText: 'Contenido sesión',
        } as unknown as PlanningExtra);
      }
    }

    const findExtra = (type: string, keyIndex: number | null, _title?: string, sessionNum?: number) => {
      return dbExtras.find((ex) => {
        if (ex.type !== type) return false;
        const exKey = (ex as any).keyIndex ?? (ex as any).key_index;
        if (keyIndex !== null && Number(exKey) !== Number(keyIndex)) return false;
        if (sessionNum !== undefined) {
          return ex.title.includes(`Sesión ${sessionNum} `) || ex.title.includes(`Sesión ${sessionNum}:`);
        }
        return true;
      });
    };

    // La lógica corregida de PlanningTabSecuencias:
    const generatedLessonPlans = curricularBlocks.reduce((total, block, actIdx) => {
      const blockSessions = blockSessionsMap[actIdx] || [];
      const count = blockSessions.filter(
        (s) =>
          !!findExtra('lesson_plan', block.blockIndex, undefined, s.sessionNum) ||
          !!findExtra('lesson_plan', s.activityIndex, undefined, s.sessionNum)
      ).length;
      return total + count;
    }, 0);

    // DEBE ser 72, NUNCA 36
    expect(generatedLessonPlans).toBe(72);
  });

  it('calcula 36 para asignaturas de 36 horas', () => {
    const content36 = {
      sectionI: { totalHours: 36, component: 'Fundamental' },
      sectionIV: {
        activities: [
          { name: 'Act 1', hours: 12 },
          { name: 'Act 2', hours: 12 },
          { name: 'Act 3', hours: 12 },
        ],
      },
    } as unknown as GeneratedPlanningContent;

    const curricularBlocks = resolveCurricularBlocks(content36);
    const blockSessionsMap = curricularBlocks.map((block) =>
      generateCurricularBlockSessions(block, false, null)
    );

    const dbExtras: PlanningExtra[] = [];
    for (let b = 0; b < 3; b++) {
      for (let s = 1; s <= 12; s++) {
        dbExtras.push({
          id: `extra36-b${b}-s${s}`,
          planningId: 'test-36',
          type: 'lesson_plan',
          title: `Plan de Clase: Sesión ${s} - Tema`,
          keyIndex: b,
          contentText: 'c',
        } as unknown as PlanningExtra);
      }
    }

    const findExtra = (type: string, keyIndex: number | null, _title?: string, sessionNum?: number) => {
      return dbExtras.find((ex) => {
        if (ex.type !== type) return false;
        const exKey = (ex as any).keyIndex ?? (ex as any).key_index;
        if (keyIndex !== null && Number(exKey) !== Number(keyIndex)) return false;
        if (sessionNum !== undefined) {
          return ex.title.includes(`Sesión ${sessionNum} `) || ex.title.includes(`Sesión ${sessionNum}-`);
        }
        return true;
      });
    };

    const count = curricularBlocks.reduce((total, block, actIdx) => {
      const blockSessions = blockSessionsMap[actIdx] || [];
      return total + blockSessions.filter(
        (s) =>
          !!findExtra('lesson_plan', block.blockIndex, undefined, s.sessionNum) ||
          !!findExtra('lesson_plan', s.activityIndex, undefined, s.sessionNum)
      ).length;
    }, 0);

    expect(count).toBe(36);
  });
});
