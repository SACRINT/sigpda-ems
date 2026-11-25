// src/lib/pmc-docx-maestro-builder.ts
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Header,
  Footer,
} from 'docx';
import {
  BRAND,
  MARGIN,
  parseJsonField,
  resolveMaestroRejection,
  resolvePersonalForMaestro,
  type PmcMetasInstitucionalesItem,
  type PmcMetasPersonalesItem,
  type MaestroRejectionResult,
  type PmcDiagnosticoGenerado,
  type PmcPlanAccion,
  type PmcProjectMasterData,
  type PmcPersonalItem,
  type PmcCatalogoMetaItem,
  type PmcDocxMaestroOptions,
  type PmcMaestroContext,
  type SqlQueryable,
} from './pmc/maestro/helpers';
import { buildMaestroChapters1To4 } from './pmc/maestro/chapters-1-4';
import { buildMaestroChapters5To8 } from './pmc/maestro/chapters-5-8';

export {
  resolveMaestroRejection,
  resolvePersonalForMaestro,
  type PmcMetasInstitucionalesItem,
  type PmcMetasPersonalesItem,
  type MaestroRejectionResult,
  type PmcDiagnosticoGenerado,
  type PmcPlanAccion,
  type PmcProjectMasterData,
  type PmcPersonalItem,
  type PmcCatalogoMetaItem,
  type PmcDocxMaestroOptions,
  type SqlQueryable,
};

export async function generatePmcDocxMaestro(
  project: PmcProjectMasterData,
  options: PmcDocxMaestroOptions = {}
): Promise<Buffer> {
  const diag = parseJsonField<PmcDiagnosticoGenerado>(project.diagnostico_generado, {});
  const plan = parseJsonField<PmcPlanAccion>(project.plan_accion, {});
  const metasInst = plan.metas_institucionales || [];
  const metasPers = plan.metas_personales || [];

  const schoolName = project.school_name || 'Plantel Educativo';
  const cct = project.school_cct || 'CCT Pendiente';
  const municipio = project.municipality || 'No capturado';
  const localidad = project.locality || 'No capturado';
  const zona = project.school_zone || 'No capturado';
  const ciclo = project.ciclo_escolar || '2025-2026';
  const subsistema = project.subsystem || 'No capturado';
  const director = project.director_name || 'No capturado';
  const supervisor = project.supervisor_name || 'No capturado';

  const ctx: PmcMaestroContext = {
    project,
    options,
    diag,
    metasInst,
    metasPers,
    schoolName,
    cct,
    municipio,
    localidad,
    zona,
    ciclo,
    subsistema,
    director,
    supervisor,
  };

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${schoolName} — Programa de Mejora Continua ${ciclo}`,
                    size: 16,
                    color: BRAND.textoMuted,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Documento Maestro Oficial PMC 5.2 — DBEPA Puebla',
                    size: 16,
                    color: BRAND.textoMuted,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...buildMaestroChapters1To4(ctx),
          ...buildMaestroChapters5To8(ctx),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
