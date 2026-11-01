import * as fs from 'fs';
import * as path from 'path';
import { sql } from '../src/lib/db/client';
import { getProgramByUacAndSemester } from '../src/lib/db/programs-catalog';
import {
  buildCanonicalProgresionesList,
  repairExtractedDataWithCatalog,
  enforceOfficialProgresiones,
  type CanonicalProgressionItem,
} from '../src/lib/planning/progresiones-enforcer';
import { generatePlanningPDF, generateSecuenciaPDF } from '../src/lib/planning-pdf-renderer';
import type { Planning, ExtractedPdfData, SecuenciaBloque } from '../src/types/planning';

function buildDetailedBlockActivities(
  uacName: string,
  prog: CanonicalProgressionItem,
  methodology: string
) {
  const isVariacional = uacName.toLowerCase().includes('variacional');
  const catStr = prog.categorias.join('; ');
  const subcatStr = prog.subcategorias.join('; ');
  const metaPrimary = prog.metas[0] || prog.description;

  const saberes = {
    saber: `Progresión ${prog.order} (${catStr}): ${prog.description} Subcategorías abordadas: ${subcatStr}.`,
    saberHacer: isVariacional
      ? `Resolución analítica, algebraica y gráfica vinculada a la Progresión ${prog.order} para cumplir la meta oficial: ${metaPrimary}`
      : `Trazo técnico, representación geométrica y aplicación normativa vinculada a la Progresión ${prog.order} para cumplir la meta oficial: ${metaPrimary}`,
    saberSer: `Rigor metodológico, precisión técnica, ética colaborativa e inclusión en el desarrollo del proyecto comunitario PAEC en Coronel Tito Hernández, Venustiano Carranza.`,
  };

  const apertura = {
    processes: 'asombro, problematizacion',
    materials: isVariacional
      ? 'Cuaderno cuadriculado, datos sociodemográficos locales del PAEC y pizarrón.'
      : 'Croquis comunitarios, fotografías del entorno de Coronel Tito Hernández y pizarrón.',
    activities: `Problematización situada de la Progresión ${prog.order}: Activación de saberes previos en torno a "${prog.description}". Vinculación diagnóstica con el proyecto PAEC "Comunidad Resiliente: Vida Saludable" en Coronel Tito Hernández, Venustiano Carranza, analizando cómo ${subcatStr} permite modelar y transformar el entorno escolar y comunitario.`,
  };

  const ejecucion = {
    processes: 'traduccion, conceptualizacion, razonamiento, indagacion',
    materials: isVariacional
      ? 'Cuaderno de trabajo, calculadora científica, hojas milimétricas y GeoGebra / Desmos (con garantía dual impresa).'
      : 'Block de dibujo Din A3, lápices graduados (2H, HB, 2B), juego de escuadras, escalímetro y compás de precisión.',
    activities: `Desarrollo activo (${methodology}) de la Progresión ${prog.order}: Trabajo colaborativo con roles definidos para abordar "${prog.description}". Aplicación de ${catStr} y ${subcatStr} mediante ejercicios graduados, modelación de casos reales de la comunidad y verificación entre pares orientados al logro de: ${prog.metas.join(' ')}`,
  };

  const conclusion = {
    processes: 'reflexion, transferencia',
    materials: 'Portafolio de evidencias, lista de cotejo y rúbrica formativa.',
    activities: `Cierre y transferencia metacognitiva de la Progresión ${prog.order}: Socialización en plenaria de los hallazgos, modelos o láminas generadas; validación de resultados frente a las metas (${prog.metas.map(m => m.split('.')[0]).join(', ')}) y retroalimentación formativa para el entregable del Corte.`,
  };

  return { saberes, apertura, ejecucion, conclusion };
}

function buildSessionsForProgression(
  uacName: string,
  prog: CanonicalProgressionItem,
  blockIdx: number,
  methodology: string
): SecuenciaBloque {
  const totalSessions = prog.hours;
  const sessions: SecuenciaBloque['sessions'] = [];
  const catLabel = prog.categorias[0] || 'Categoría MCCEMS';
  const subcatLabel = prog.subcategorias[0] || 'Subcategoría MCCEMS';
  const metaLabel = prog.metas[0] || prog.description;

  for (let s = 1; s <= totalSessions; s++) {
    const phase: 'Apertura' | 'Desarrollo' | 'Cierre' =
      s === 1 ? 'Apertura' : s === totalSessions ? 'Cierre' : 'Desarrollo';

    const title =
      phase === 'Apertura'
        ? `Sesión ${s}/${totalSessions} (Apertura): Diagnóstico y Problematización Situada — Progresión ${prog.order} (${subcatLabel})`
        : phase === 'Cierre'
          ? `Sesión ${s}/${totalSessions} (Cierre): Socialización, Evaluación Formativa y Transferencia PAEC — Progresión ${prog.order}`
          : `Sesión ${s}/${totalSessions} (Desarrollo ${s - 1}): Construcción Práctica y Modelación (${methodology}) — Progresión ${prog.order}`;

    const teachingActivity =
      phase === 'Apertura'
        ? `Presenta el detonador situado vinculado al PAEC en Coronel Tito Hernández e introduce la Progresión ${prog.order}: "${prog.description}". Facilita preguntas generadoras para activar saberes previos sobre ${catLabel} y ${subcatLabel}.`
        : phase === 'Cierre'
          ? `Coordina la plenaria de socialización de evidencias de la Progresión ${prog.order}, guía la verificación de las metas de aprendizaje (${prog.metas.map(m => m.split('.')[0]).join(', ')}) y aplica el instrumento de evaluación formativa y ticket de salida.`
          : `Modela los procedimientos clave de la Progresión ${prog.order} (${subcatLabel}), acompaña el trabajo en equipos bajo ${methodology} y brinda andamiaje diferenciado para alcanzar la meta: "${metaLabel}".`;

    const learningActivity =
      phase === 'Apertura'
        ? `Analiza la problemática situada de su comunidad, participa en la lluvia de ideas diagnóstica e identifica las variables o elementos geométricos/variacionales de la Progresión ${prog.order} en su cuaderno de trabajo.`
        : phase === 'Cierre'
          ? `Expone y argumenta ante sus pares los resultados, modelos o representaciones obtenidas en la Progresión ${prog.order}, realiza coevaluación con rúbrica e integra su producto al portafolio del ${prog.corte}.`
          : `Resuelve en equipo los retos y ejercicios aplicados de la Progresión ${prog.order} articulando ${ prog.categorias.join(' y ') } (${ prog.subcategorias.join(', ') }), registrando cálculos, trazos y justificaciones técnicas.`;

    const evidence =
      phase === 'Apertura'
        ? `Registro diagnóstico y planteamiento inicial de la Progresión ${prog.order}`
        : phase === 'Cierre'
          ? `Producto integrador validado de la Progresión ${prog.order} (${subcatLabel})`
          : `Avance práctico verificable S${s} de la Progresión ${prog.order}`;

    sessions.push({
      sessionNum: s,
      totalSessions,
      phase,
      title,
      teachingActivity,
      learningActivity,
      evidence,
      evaluation: phase === 'Cierre' ? 'Rúbrica formativa / Lista de cotejo' : 'Observación formativa en bitácora',
    });
  }

  return {
    blockIndex: blockIdx,
    blockName: prog.name,
    hours: prog.hours,
    sessions,
  };
}

async function main() {
  const client = sql();

  const targets = [
    {
      id: 'ae26ba48-9972-4bde-95e3-f565e9c402b3',
      canonicalUac: 'Taller de Pensamiento Variacional I',
      planPdfName: 'Planeacion_Taller_Pensamiento_Variacional_I_Semestre_5.pdf',
      secPdfName: 'Secuencia_Didactica_Taller_Pensamiento_Variacional_I_Semestre_5.pdf',
    },
    {
      id: '0990f504-f316-41b2-8e9b-91ad3a82b742',
      canonicalUac: 'Dibujo Técnico I',
      planPdfName: 'Planeacion_Dibujo_Técnico_I_Semestre_5.pdf',
      secPdfName: 'Secuencia_Didactica_Dibujo_Técnico_I_Semestre_5.pdf',
    },
  ];

  const outDir = path.resolve(
    'C:\\Proyectos_SACRINT\\Proyecto_SIGPDA_EMS\\documentos_referencia\\[01]Planeaciones-Secuencias-Plan_de_Clase\\Libros Planeaciones 2026'
  );

  for (const t of targets) {
    const rows = await client`
      SELECT * FROM plannings WHERE id = ${t.id}::uuid
    `;
    if (rows.length === 0) {
      throw new Error(`No se encontró la planeación ${t.id}`);
    }
    const row = rows[0];
    const officialProgram = await getProgramByUacAndSemester(
      t.canonicalUac,
      Number(row.semester),
      row.component
    );
    if (!officialProgram) {
      throw new Error(`No se encontró programa oficial en catálogo para ${t.canonicalUac}`);
    }

    const canonicalProgs = buildCanonicalProgresionesList(officialProgram, row.extracted_data as ExtractedPdfData);
    console.log(`[REPAIR] ${t.canonicalUac}: ${canonicalProgs.length} progresiones oficiales cargadas.`);

    // 1. Reparar extracted_data
    const repairedExtracted = repairExtractedDataWithCatalog(
      (row.extracted_data || {}) as ExtractedPdfData,
      officialProgram,
      Number(row.semester),
      row.component
    );

    // 2. Reparar content_json
    const contentJson = (row.content_json || {}) as Record<string, any>;
    if (contentJson.sectionI) {
      contentJson.sectionI.uacName = t.canonicalUac;
    }
    const defaultMethodology =
      contentJson.sectionIV?.activities?.[0]?.methodology ||
      (t.canonicalUac.includes('Variacional') ? 'Enfoque STEAM' : 'Enfoque STEAM / Aprendizaje-Servicio (ApS)');

    enforceOfficialProgresiones(
      contentJson,
      officialProgram,
      repairedExtracted,
      Number(row.semester),
      row.component
    );

    // Enriquecer cada bloque de sectionIV.activities con saberes y momentos específicos por progresión
    contentJson.sectionIV.activities = canonicalProgs.map((prog) => {
      const details = buildDetailedBlockActivities(t.canonicalUac, prog, defaultMethodology);
      return {
        order: prog.order,
        name: prog.name,
        description: prog.description,
        hours: prog.hours,
        corte: prog.corte,
        methodology: defaultMethodology,
        categorias: prog.categorias,
        subcategorias: prog.subcategorias,
        metas: prog.metas,
        contenidoFormativo: prog.contenidoFormativo,
        saberes: details.saberes,
        apertura: details.apertura,
        ejecucion: details.ejecucion,
        conclusion: details.conclusion,
        evidence: `Producto integrador de la Progresión ${prog.order} (${prog.subcategorias[0] || prog.categorias[0]})`,
      };
    });

    // 3. Construir sequence_json con 1 bloque por Progresión (8 para Variacional I, 7 para Dibujo I)
    const newSequenceJson: Record<number, SecuenciaBloque> = {};
    canonicalProgs.forEach((prog, idx) => {
      newSequenceJson[idx] = buildSessionsForProgression(t.canonicalUac, prog, idx, defaultMethodology);
    });

    // 4. Actualizar en Neon DB (limpiando workbooks_json obsoletos de 3 bloques para evitar sobreescritura)
    await client`
      UPDATE plannings
      SET
        uac_name = ${t.canonicalUac},
        extracted_data = ${JSON.stringify(repairedExtracted)}::jsonb,
        content_json = ${JSON.stringify(contentJson)}::jsonb,
        sequence_json = ${JSON.stringify(newSequenceJson)}::jsonb,
        workbooks_json = NULL,
        updated_at = NOW()
      WHERE id = ${t.id}::uuid
    `;
    console.log(`[DB UPDATED] Planeación ${t.id} (${t.canonicalUac}) actualizada con ${canonicalProgs.length} bloques.`);

    // 5. Regenerar los 2 PDFs de esta UAC
    const updatedPlanningObj = {
      ...row,
      uacName: t.canonicalUac,
      uac_name: t.canonicalUac,
      semester: Number(row.semester),
      component: row.component,
      paecContext: row.paec_context,
      paec_context: row.paec_context,
      contentJson,
      content_json: contentJson,
      sequenceJson: newSequenceJson,
      sequence_json: newSequenceJson,
      workbooks_json: null,
      workbooksJson: null,
    } as unknown as Planning;

    const planDoc = await generatePlanningPDF(updatedPlanningObj);
    const planPath = path.join(outDir, t.planPdfName);
    fs.writeFileSync(planPath, Buffer.from(planDoc.output('arraybuffer')));
    console.log(`[PDF OK] ${planPath} (${planDoc.getNumberOfPages()} páginas)`);

    const secDoc = await generateSecuenciaPDF(updatedPlanningObj);
    const secPath = path.join(outDir, t.secPdfName);
    fs.writeFileSync(secPath, Buffer.from(secDoc.output('arraybuffer')));
    console.log(`[PDF OK] ${secPath} (${secDoc.getNumberOfPages()} páginas)`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Error en repair-and-regenerate-ffe-plannings:', err);
  process.exit(1);
});

