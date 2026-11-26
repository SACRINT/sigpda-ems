import { getProgramsCatalogForPaec } from '@/lib/db';
import {
  buildPrompt1Diagnostico,
  buildPrompt2Justificacion,
  buildPrompt3Mapeo,
  buildPrompt4Cronograma,
  buildPrompt5DetalleCurricular,
  type PaecAcademicBaseline,
} from '@/lib/prompts/paec-prompts';
import { getZoneContextForSchool } from '@/lib/zone-sync-service';
import { formatCurricularCatalogForPrompt, matchCurricularContent, resolveAuthoritativeUacComponent } from '@/lib/paec-curricular-helper';
import { generateWithRotation } from '@/lib/ai-provider';
import { logger } from '@/lib/logger';
import { parseAIResponse } from '@/lib/ai-response-parser';
import { PaecPaso3Schema, PaecPaso5Schema } from '@/lib/ai-schemas';
import type { MapeoRow, DetalleCurricularRow, UniqueUacItem, SchoolType, GroupTrackConfig } from '@/types/paec';
import { consolidarUacsUnicasPlantel } from '@/lib/escuela-grupos';
import { type PaecStepHandlerContext, type PaecStepHandlerResult } from './types';

export async function handlePaecSteps1To5(ctx: PaecStepHandlerContext): Promise<PaecStepHandlerResult> {
  const { step, project, teacherId, stepSystemPrompt, libraryContext } = ctx;
  let userPrompt = '';
  let fieldName = '';
  let stepResultData: object | null = null;

  switch (step) {
      case 1: {
        fieldName = 'fase1_diagnostico';
        const comm = JSON.stringify(project.community_context);
        const school = JSON.stringify(project.school_context);

        // Línea base estadística oficial (911/F11 y Cartografía de Zona)
        const schoolCtx = project.school_context as Record<string, unknown> | undefined;
        let baseline: PaecAcademicBaseline | null = (schoolCtx?.academicBaseline as PaecAcademicBaseline | undefined) ?? null;

        if (!baseline) {
          const cct = (schoolCtx?.cct as string | undefined) || (schoolCtx?.schoolCct as string | undefined);
          if (cct) {
            try {
              const zoneRes = await getZoneContextForSchool(cct);
              if (zoneRes.found) {
                baseline = {
                  abandono: zoneRes.plantel?.abandono,
                  eficienciaTerminal: zoneRes.plantel?.eficienciaTerminal,
                  reprobacion: zoneRes.plantel?.reprobacion,
                  promAbandonoZona: zoneRes.zona?.averages?.promAbandono,
                  promEficienciaZona: zoneRes.zona?.averages?.promEficiencia,
                  problematicasComunesZona: zoneRes.zona?.problematicasComunes,
                };
              }
            } catch (err) {
              logger.warn(`[PAEC Paso 1] Error obteniendo contexto estadístico de zona para ${cct}:`, err);
            }
          }
        }

        userPrompt = buildPrompt1Diagnostico(comm, school, (project.problem_statement || project.problemStatement), baseline);
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 2: Justificación y Diseño General
      // ----------------------------------------------------------------------
      case 2: {
        fieldName = 'fase2_justificacion';
        if (!project.fase1_diagnostico) {
          return { fieldName, userPrompt, stepResultData, errorResponse: { error: ({ error: 'Debes completar el Paso 1 (Diagnóstico) primero' }).error, status: 400 } };
        }
        const diagStr = JSON.stringify(project.fase1_diagnostico);
        userPrompt = buildPrompt2Justificacion(diagStr, (project.project_name || project.projectName), (project.problem_statement || project.problemStatement));
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 3: Mapeo Curricular de UACs (100% Cobertura)
      // ----------------------------------------------------------------------
      case 3: {
        fieldName = 'fase2_mapeo';
        if (!project.fase2_justificacion) {
          return { fieldName, userPrompt, stepResultData, errorResponse: { error: ({ error: 'Debes completar el Paso 2 (Justificación) primero' }).error, status: 400 } };
        }
        const justStr = JSON.stringify(project.fase2_justificacion);

        let semesters: number[] = [];
        if (project.cycle_type === 'A') {
          semesters = [1, 3, 5];
        } else if (project.cycle_type === 'B') {
          semesters = [2, 4, 6];
        } else {
          semesters = [1, 2, 3, 4, 5, 6];
        }

        const allUacs = (await getProgramsCatalogForPaec(semesters)) as {
          uac_name: string;
          semester: number;
          component: string;
        }[];

        // Regla de Oro Curricular: Cero Duplicados a nivel Plantel
        const schoolCtx = (project.school_context || {}) as {
          schoolType?: SchoolType;
          activeLaboralUacs?: string[];
          activeFfeUacs?: string[];
          activeBtCarreras?: string[];
          activeFundamentalUacs?: string[];
          groupStructure?: {
            semestersConfig: Record<number, number>;
            groupAssignments: GroupTrackConfig[];
          };
          uniqueUacsList?: UniqueUacItem[];
        };

        const uacsItems: UniqueUacItem[] = (schoolCtx.uniqueUacsList && schoolCtx.uniqueUacsList.length > 0)
          ? schoolCtx.uniqueUacsList
          : consolidarUacsUnicasPlantel({
              semesters,
              schoolType: schoolCtx.schoolType,
              groupAssignments: schoolCtx.groupStructure?.groupAssignments,
              activeLaboralUacs: schoolCtx.activeLaboralUacs,
              activeFfeUacs: schoolCtx.activeFfeUacs,
              activeBtCarreras: schoolCtx.activeBtCarreras,
              activeFundamentalUacs: schoolCtx.activeFundamentalUacs,
              dbFundamentalUacs: allUacs,
            });

        const uacs = uacsItems.map((u) => ({
          uac_name: u.uacName,
          semester: u.semester,
        }));

        // Chunking anti-timeout si supera 16 UACs (ej. 27 UACs en escuelas multi-grupo)
        if (uacs.length > 16) {
          const CHUNK_SIZE = 12;
          const chunks: { uac_name: string; semester: number }[][] = [];
          for (let i = 0; i < uacs.length; i += CHUNK_SIZE) {
            chunks.push(uacs.slice(i, i + CHUNK_SIZE));
          }

          const allMapeoRows: MapeoRow[] = [];
          for (let i = 0; i < chunks.length; i++) {
            const blockNum = i + 1;
            const blockPrompt = buildPrompt3Mapeo(justStr, chunks[i]);
            const matchedCatalog = chunks[i].map((u) =>
              matchCurricularContent(u.uac_name, u.semester, allUacs) || {
                uac_name: u.uac_name,
                semester: u.semester,
                component: 'fundamental',
                contenidos_formativos: null,
              }
            );
            const curricularBlock = formatCurricularCatalogForPrompt(matchedCatalog);
            let chunkPrompt = `${blockPrompt}\n\n${curricularBlock}`;
            if (libraryContext) {
              chunkPrompt = `${chunkPrompt}\n\n${libraryContext}`;
            }

            logger.info(`[PAEC-Step3] Generando bloque de Mapeo ${blockNum}/${chunks.length} (${chunks[i].length} UACs)...`);
            const blockText = await generateWithRotation(stepSystemPrompt, chunkPrompt, teacherId);
            if (!blockText) {
              throw new Error(`Respuesta vacía del proveedor en bloque de Mapeo ${blockNum}`);
            }

            const parseResult = parseAIResponse(blockText, PaecPaso3Schema, {
              contextName: `paec_step_3_block_${blockNum}`,
            });

            if (!parseResult.success) {
              throw new Error(`Error de formato en bloque de Mapeo ${blockNum}: ${parseResult.error}`);
            }

            const enrichedChunkRows = (parseResult.data as MapeoRow[]).map((row) => {
              const catMatch = matchCurricularContent(row.uacName, Number(row.semester), allUacs);
              return {
                ...row,
                component: resolveAuthoritativeUacComponent(catMatch?.component, row.component),
              };
            });
            allMapeoRows.push(...enrichedChunkRows);
          }

          stepResultData = allMapeoRows;
        } else {
          const matchedCatalog = uacs.map((u) =>
            matchCurricularContent(u.uac_name, u.semester, allUacs) || {
              uac_name: u.uac_name,
              semester: u.semester,
              component: 'fundamental',
              contenidos_formativos: null,
            }
          );
          const curricularBlock = formatCurricularCatalogForPrompt(matchedCatalog);
          userPrompt = `${buildPrompt3Mapeo(justStr, uacs)}\n\n${curricularBlock}`;
        }
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 4: Cronograma General de Implementación (6 Fases / 5 Columnas)
      // ----------------------------------------------------------------------
      case 4: {
        fieldName = 'fase2_cronograma';
        if (!project.fase2_mapeo) {
          return { fieldName, userPrompt, stepResultData, errorResponse: { error: ({ error: 'Debes completar el Paso 3 (Mapeo Curricular) primero' }).error, status: 400 } };
        }
        const mapeoStr = JSON.stringify(project.fase2_mapeo);
        userPrompt = buildPrompt4Cronograma(mapeoStr, (project.cycle_type || project.cycleType));
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 5: Matriz de Detalle Curricular por Semestre
      // ----------------------------------------------------------------------
      case 5: {
        fieldName = 'fase2_detalle_curricular';
        if (!project.fase2_mapeo || !project.fase2_cronograma) {
          return { fieldName, userPrompt, stepResultData, errorResponse: { error: ({ error: 'Debes completar el Paso 3 (Mapeo) y el Paso 4 (Cronograma) primero' }).error, status: 400 } };
        }
        const mapeo = project.fase2_mapeo as MapeoRow[];
        const mapeoStr = JSON.stringify(mapeo);
        const cronStr = JSON.stringify(project.fase2_cronograma);

        const step5Semesters = project.cycle_type === 'A' ? [1, 3, 5] : project.cycle_type === 'B' ? [2, 4, 6] : [1, 2, 3, 4, 5, 6];
        const allUacsStep5 = await getProgramsCatalogForPaec(step5Semesters);

        // Chunking anti-timeout si el mapeo supera 14 UACs
        if (mapeo.length > 14) {
          const CHUNK_SIZE = 10;
          const chunks: MapeoRow[][] = [];
          for (let i = 0; i < mapeo.length; i += CHUNK_SIZE) {
            chunks.push(mapeo.slice(i, i + CHUNK_SIZE));
          }

          const allDetalleRows: DetalleCurricularRow[] = [];
          for (let i = 0; i < chunks.length; i++) {
            const blockNum = i + 1;
            const blockPrompt = buildPrompt5DetalleCurricular(
              JSON.stringify(chunks[i]),
              cronStr,
              (project.cycle_type || project.cycleType)
            );
            const matchedCatalog = chunks[i].map((u) =>
              matchCurricularContent(u.uacName, Number(u.semester), allUacsStep5) || {
                uac_name: u.uacName,
                semester: Number(u.semester),
                component: 'fundamental',
                contenidos_formativos: null,
              }
            );
            const curricularBlock = formatCurricularCatalogForPrompt(matchedCatalog);
            let chunkPrompt = `${blockPrompt}\n\n${curricularBlock}`;
            if (libraryContext) {
              chunkPrompt = `${chunkPrompt}\n\n${libraryContext}`;
            }

            logger.info(`[PAEC-Step5] Generando bloque de Detalle Curricular ${blockNum}/${chunks.length} (${chunks[i].length} UACs)...`);
            const blockText = await generateWithRotation(stepSystemPrompt, chunkPrompt, teacherId);
            if (!blockText) {
              throw new Error(`Respuesta vacía del proveedor en bloque de Detalle ${blockNum}`);
            }

            const parseResult = parseAIResponse(blockText, PaecPaso5Schema, {
              contextName: `paec_step_5_block_${blockNum}`,
            });

            if (!parseResult.success) {
              throw new Error(`Error de formato en bloque de Detalle ${blockNum}: ${parseResult.error}`);
            }

            allDetalleRows.push(...(parseResult.data as DetalleCurricularRow[]));
          }

          stepResultData = allDetalleRows;
        } else {
          const matchedCatalog = mapeo.map((u) =>
            matchCurricularContent(u.uacName, Number(u.semester), allUacsStep5) || {
              uac_name: u.uacName,
              semester: Number(u.semester),
              component: 'fundamental',
              contenidos_formativos: null,
            }
          );
          const curricularBlock = formatCurricularCatalogForPrompt(matchedCatalog);
          userPrompt = `${buildPrompt5DetalleCurricular(mapeoStr, cronStr, (project.cycle_type || project.cycleType))}\n\n${curricularBlock}`;
        }
        break;
      }

      // ----------------------------------------------------------------------
      // PASO 6: Plan Operativo Semestre A (Fases 1, 2 y 3: Semanas 1 a 16)
      // ----------------------------------------------------------------------
  }

  return { fieldName, userPrompt, stepResultData };
}
