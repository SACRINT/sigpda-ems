/**
 * sacrint-manifest-exporter.ts — Exportador de Manifiesto de Curso Institucional
 * SIGPDA-EMS · MCCEMS 2026-2027
 *
 * Genera el archivo `sacrint_course_manifest.json` estandarizado para la ingestión
 * automatizada de cursos, misiones, proyectos e instrumentos de evaluación en las
 * aulas virtuales y plataformas del ecosistema SACRINT_SYSTEMS.
 */

import type { Planning } from '@/types/planning';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import { runPedagogicalAudit } from '@/lib/guide-engine/pedagogical-quality-gate';
import { SCHOOL_YEAR } from '@/lib/config';

export interface SacrintManifestModule {
  blockIndex: number;
  blockName: string;
  hours: number;
  learningOutcomes: string[];
  pedagogicalGrade: string;
  missionsCount: number;
  missions: Array<{
    missionNumber: number;
    title: string;
    sessionTopic: string;
    sessionFocus: string;
    visualOrDiagram?: string;
    phenomenonHook: {
      story: string;
      detonatingQuestion: string;
    };
    conceptZero: {
      physicalAnalogy: string;
      coreExplanation: string;
    };
    activities: {
      iDo: string;
      weDo: string;
      youDo: string;
    };
    checkpoint: {
      question: string;
      criteria: string[];
    };
  }>;
  projectIntegrador?: {
    artifactName: string;
    communityUtility: string;
    learningObjectives: string[];
    executionSteps: string[];
    deliveryCriteria: string[];
  };
  evaluationInstruments: {
    rubricCriteriaCount: number;
    checklistItemsCount: number;
    tieredLevelsCount: number;
  };
}

export interface SacrintCourseManifest {
  manifestVersion: string;
  generator: string;
  exportedAt: string;
  course: {
    planningId: string;
    uacName: string;
    semester: number;
    component: string;
    curriculumName: string;
    paecContext?: string;
  };
  institution: {
    authority: string;
    schoolName: string;
    cct?: string;
    subsystem?: string;
    teacherName?: string;
  };
  globalPedagogicalAudit?: {
    healthGrade: string;
    hotsPercentage: number;
    bapInclusivityScore: number;
    summary: string;
  };
  modules: SacrintManifestModule[];
}

/**
 * Compila y exporta el manifiesto del curso para SACRINT_SYSTEMS
 */
export function exportSacrintCourseManifest(
  planning: Planning,
  workbooks: ActiveWorkTextbook[]
): SacrintCourseManifest {
  const content = planning.contentJson;
  const activities = content?.sectionIV?.activities || [];
  const ext = planning.extractedData as Record<string, unknown> | null;
  const schoolName = content?.sectionI?.schoolName || (typeof ext?.schoolName === 'string' ? ext.schoolName : undefined) || 'Plantel de Educación Media Superior';
  const cct = content?.sectionI?.cct || (typeof ext?.cct === 'string' ? ext.cct : undefined);
  const subsystem = content?.sectionI?.subsystem || (typeof ext?.subsystem === 'string' ? ext.subsystem : undefined) || 'BGE';
  const teacherName = content?.sectionI?.teacherName || (typeof ext?.teacherName === 'string' ? ext.teacherName : undefined);

  // Realizar auditoría pedagógica global sobre el primer libro representativo
  let globalAudit: SacrintCourseManifest['globalPedagogicalAudit'];
  if (workbooks.length > 0 && workbooks[0]) {
    const audit = runPedagogicalAudit(workbooks[0]);
    globalAudit = {
      healthGrade: audit.pedagogicalHealthGrade,
      hotsPercentage: audit.bloomDistribution.hotsPercentage,
      bapInclusivityScore: audit.bapInclusivityScore,
      summary: audit.summary,
    };
  }

  const modules: SacrintManifestModule[] = workbooks.map((wb) => {
    const bIdx = wb.blockIndex ?? 0;
    const act = activities[bIdx] || {};
    const audit = runPedagogicalAudit(wb);

    return {
      blockIndex: bIdx + 1,
      blockName: wb.blockName || act.name || `Bloque ${bIdx + 1}`,
      hours: act.hours || 12,
      learningOutcomes: content?.sectionII?.learningOutcomes?.[bIdx]
        ? [content.sectionII.learningOutcomes[bIdx]]
        : [],
      pedagogicalGrade: audit.pedagogicalHealthGrade,
      missionsCount: (wb.missions || []).length,
      missions: (wb.missions || []).map((m, mIdx) => ({
        missionNumber: m.missionIndex || mIdx + 1,
        title: m.title,
        sessionTopic: m.sessionTopic || '',
        sessionFocus: m.sessionFocus || '',
        visualOrDiagram: m.iDoSection?.visualOrDiagram || undefined,
        phenomenonHook: {
          story: m.phenomenonHook?.story || '',
          detonatingQuestion: m.phenomenonHook?.detonatingQuestion || '',
        },
        conceptZero: {
          physicalAnalogy: m.conceptZero?.physicalAnalogy || '',
          coreExplanation: m.conceptZero?.coreExplanation || '',
        },
        activities: {
          iDo: m.iDoSection?.stepByStepDemo || '',
          weDo: m.weDoSection?.guidedPractice || '',
          youDo: m.youDoSection?.autonomousChallenge || '',
        },
        checkpoint: {
          question: m.formativeCheckpoint?.question || '',
          criteria: m.formativeCheckpoint?.criteriaChecklist || [],
        },
      })),
      projectIntegrador: wb.projectSection
        ? {
            artifactName: wb.projectSection.artifactName,
            communityUtility: wb.projectSection.communityUtility,
            learningObjectives: wb.projectSection.learningObjectives || [],
            executionSteps: wb.projectSection.executionSteps || [],
            deliveryCriteria: wb.projectSection.deliveryCriteria || [],
          }
        : undefined,
      evaluationInstruments: {
        rubricCriteriaCount: wb.evaluationSection?.rubric?.length || 0,
        checklistItemsCount: wb.evaluationSection?.checklist?.length || 0,
        tieredLevelsCount: wb.evaluationSection?.tieredExercises?.length || 0,
      },
    };
  });

  return {
    manifestVersion: '2026.1',
    generator: 'SIGPDA-EMS Deep Editorial Engine (Puebla MCCEMS)',
    exportedAt: new Date().toISOString(),
    course: {
      planningId: planning.id,
      uacName: planning.uacName,
      semester: planning.semester,
      component: planning.component,
      curriculumName: planning.curriculumName || `MCCEMS ${SCHOOL_YEAR}`,
      paecContext: planning.paecContext,
    },
    institution: {
      authority: 'Dirección de Educación Media Superior (SEMS / MCCEMS)',
      schoolName,
      cct,
      subsystem,
      teacherName,
    },
    globalPedagogicalAudit: globalAudit,
    modules,
  };
}
