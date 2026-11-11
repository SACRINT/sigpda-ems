import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';
import {
  CATALOGO_INSTRUMENTOS_EVALUACION,
  obtenerInstrumentoPorId,
  type InstrumentoEvaluacionOficial
} from '../src/lib/catalogo-instrumentos';

const envContent = readFileSync('.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=['"]?([^'"\r\n]+)['"]?/);
if (!match) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}
const sql = neon(match[1]);

const isDryRun = process.argv.includes('--dry-run');

interface PlanningConfig {
  id: string;
  name: string;
  blocks: [string, string, string]; // instrument IDs for Block 1, 2, 3
}

const PLANNING_CONFIGS: PlanningConfig[] = [
  {
    id: 'dfd5e2d6-6a84-4a3d-a4a9-8e128e523fa4',
    name: 'Pensamiento Matemático III',
    blocks: [
      'bitacora_registro_experimental',
      'guia_analisis_estudio_caso',
      'rubrica_holistica_defensa_oral'
    ]
  },
  {
    id: 'c1c61383-0976-46cb-8999-595985044b39',
    name: 'Taller de Pensamiento Variacional I',
    blocks: [
      'bitacora_registro_experimental',
      'guia_analisis_estudio_caso',
      'matriz_validacion_prototipo_steam'
    ]
  },
  {
    id: '9eac6ffc-54b8-44a3-8ab2-b207eb140fc5',
    name: 'Dibujo Técnico I',
    blocks: [
      'guia_observacion_laboratorio_taller',
      'matriz_validacion_prototipo_steam',
      'portafolio_evidencias_corte'
    ]
  },
  {
    id: '166f816d-7a66-46dc-b5b6-b1ccda273353',
    name: 'Interpreta croquis de diferentes instalaciones básicas de una vivienda',
    blocks: [
      'cuestionario_diagnostico_saberes',
      'guia_observacion_laboratorio_taller',
      'rubrica_holistica_defensa_oral'
    ]
  },
  {
    id: '7d59944d-939e-4f21-9cf4-386f97dfa763',
    name: 'Prepara materiales en cantidad y calidad especificada...',
    blocks: [
      'guia_observacion_laboratorio_taller',
      'bitacora_registro_experimental',
      'matriz_validacion_prototipo_steam'
    ]
  },
  {
    id: '9fcc6660-fb0f-40ac-8601-c99279f83ed1',
    name: 'Coloca elementos constructivos básicos de una vivienda',
    blocks: [
      'guia_observacion_laboratorio_taller',
      'escala_estimativa_colaboracion',
      'matriz_validacion_prototipo_steam'
    ]
  },
  {
    id: '4a3335eb-99f3-47f8-a3d0-c83297fe488b',
    name: 'Limpia muebles, tuberías y conexiones...',
    blocks: [
      'guia_observacion_laboratorio_taller',
      'bitacora_registro_experimental',
      'matriz_validacion_prototipo_steam'
    ]
  }
];

function buildInstrumentMarkdown(
  inst: InstrumentoEvaluacionOficial,
  uacName: string,
  blockNum: number,
  blockTitle: string,
  schoolName: string,
  paecProject: string
): string {
  const parts: string[] = [];
  parts.push(`# ${inst.nombre.toUpperCase()}`);
  parts.push(`**Asignatura / UAC:** ${uacName} | **Corte / Bloque:** ${blockNum} (${blockTitle})`);
  parts.push(`**Plantel:** ${schoolName || 'Bachillerato General Estatal Héroes de la Patria'}`);
  if (paecProject) {
    parts.push(`**Proyecto PAEC Comunitario:** ${paecProject}`);
  }
  parts.push(`**Categoría Normativa:** ${inst.categoria.toUpperCase()} | **Definición:** ${inst.definicionPedagogica}`);
  parts.push('\n---\n');

  // Tabla del instrumento
  const headers = inst.columnasTabla;
  parts.push(`| ${headers.join(' | ')} |`);
  parts.push(`| ${headers.map(() => '---').join(' | ')} |`);

  // Desglose de filas por dimensiones base
  for (let idx = 0; idx < inst.dimensionesBase.length; idx++) {
    const dim = inst.dimensionesBase[idx];
    const rowCells: string[] = [];
    
    // Primera columna (dimensión / criterio)
    rowCells.push(`**${dim}**`);

    // Columnas intermedias (niveles de escala o opciones)
    const remainingCols = headers.length - 1;
    for (let c = 0; c < remainingCols; c++) {
      if (headers[c + 1].toLowerCase().includes('observacion') || headers[c + 1].toLowerCase().includes('accion') || headers[c + 1].toLowerCase().includes('compromiso')) {
        rowCells.push(`Registro docente para ${uacName.slice(0, 30)}...`);
      } else if (inst.escalaValoracion && inst.escalaValoracion[c]) {
        rowCells.push(`Demuestra ${inst.escalaValoracion[c].toLowerCase()} en la ejecución de la actividad situada del Bloque ${blockNum}.`);
      } else if (headers[c + 1].includes('Cumple') || headers[c + 1].includes('Sí')) {
        rowCells.push('[  ] Sí   [  ] No');
      } else {
        rowCells.push(`Criterio de logro nivel ${c + 1} alcanzado plenamente.`);
      }
    }
    parts.push(`| ${rowCells.join(' | ')} |`);
  }

  parts.push('\n### Pautas de Mediación y Retroalimentación Formativa');
  parts.push(`1. **Heteroevaluación y Coevaluación:** Aplicar este instrumento durante el desarrollo y cierre del Bloque ${blockNum} para retroalimentar el producto y desempeño.`);
  parts.push(`2. **Alineación con el PAEC:** Verificar que los indicadores de impacto y servicio comunitario se reflejen en la evidencia física o documental.`);
  parts.push(`3. **Escala de acreditación:** La valoración cuantitativa/cualitativa obtenida se asienta en la evaluación parcial oficial del semestre.\n`);

  return parts.join('\n');
}

async function main() {
  console.log(`=== INICIANDO FASE 3: GENERACIÓN DE INSTRUMENTOS ESPECIALIZADOS ===`);
  console.log(`Modo de ejecución: ${isDryRun ? 'DRY-RUN (Simulación sin escrituras)' : 'PRODUCCIÓN (Escritura real)'}\n`);

  for (const cfg of PLANNING_CONFIGS) {
    console.log(`------------------------------------------------------------------`);
    console.log(`Procesando [${cfg.id}] ${cfg.name}...`);

    const pRow = await sql`
      SELECT id, uac_name, content_json, workbooks_json
      FROM plannings
      WHERE id = ${cfg.id}
    `;
    if (!pRow || pRow.length === 0) {
      console.warn(`No se encontró la planeación ${cfg.id}`);
      continue;
    }
    const p = pRow[0];
    const uacName = p.uac_name;
    const content = p.content_json || {};
    const schoolName = content.sectionI?.schoolName || 'Bachillerato General Estatal Héroes de la Patria';
    const paecProject = content.sectionI?.paecOperationalActivity?.actividad || 'Proyecto Comunitario PAEC';

    // Para cada uno de los 3 bloques
    for (let bIdx = 0; bIdx < 3; bIdx++) {
      const instId = cfg.blocks[bIdx];
      const inst = obtenerInstrumentoPorId(instId);
      if (!inst) {
        console.warn(`No se encontró instrumento con ID ${instId}`);
        continue;
      }

      const blockNum = bIdx + 1;
      const blockKey = `block_${bIdx}`;
      const wbCurrent = p.workbooks_json?.[blockKey]?.current;
      const blockTitle = wbCurrent?.blockName || `Bloque ${blockNum}`;

      const title = `${inst.nombre} · Bloque ${blockNum}: ${blockTitle}`;
      const mdContent = buildInstrumentMarkdown(inst, uacName, blockNum, blockTitle, schoolName, paecProject);

      console.log(`  Bloque ${blockNum} (key_index ${bIdx}): ${inst.id} -> "${title}" (${mdContent.length} chars)`);

      if (!isDryRun) {
        // Eliminar versión previa del mismo instrumento especializado en este bloque si existiera
        await sql`
          DELETE FROM planning_extras
          WHERE planning_id = ${cfg.id}::uuid
            AND key_index = ${bIdx}
            AND type = 'evaluation'
        `;

        // Insertar en planning_extras con type = 'evaluation'
        await sql`
          INSERT INTO planning_extras (planning_id, type, title, key_index, content_text)
          VALUES (
            ${cfg.id}::uuid,
            'evaluation',
            ${title},
            ${bIdx},
            ${mdContent}
          )
        `;
      }
    }

    // Actualizar sectionV.evaluations en content_json
    // Diagnóstica: cuestionario diagnóstico (5%)
    // Formativa: Instrumento del Bloque 2 (55%)
    // Sumativa: Instrumento del Bloque 3 (40%)
    const instDiag = obtenerInstrumentoPorId(cfg.blocks[0])!;
    const instForm = obtenerInstrumentoPorId(cfg.blocks[1])!;
    const instSum = obtenerInstrumentoPorId(cfg.blocks[2])!;

    const newEvaluations = [
      {
        moment: 'Diagnóstica',
        type: 'Diagnóstica',
        instrument: instDiag.nombre,
        evidence: 'Cuestionario diagnóstico de saberes previos y exploración contextual',
        weighting: 5,
        agent: 'Heteroevaluación / Autoevaluación',
        blockIndex: 0
      },
      {
        moment: 'Formativa',
        type: 'Formativa',
        instrument: instForm.nombre,
        evidence: 'Reportes analíticos de práctica, bitácora formativa y avance procedimental',
        weighting: 55,
        agent: 'Heteroevaluación / Coevaluación',
        blockIndex: 1
      },
      {
        moment: 'Sumativa',
        type: 'Sumativa',
        instrument: instSum.nombre,
        evidence: 'Dossier de resolución técnica, producto integrador y defensa pública',
        weighting: 40,
        agent: 'Heteroevaluación',
        blockIndex: 2
      }
    ];

    content.sectionV = content.sectionV || {};
    content.sectionV.evaluations = newEvaluations;

    if (!isDryRun) {
      await sql`
        UPDATE plannings
        SET content_json = ${JSON.stringify(content)}::jsonb,
            updated_at = NOW()
        WHERE id = ${cfg.id}
      `;
      console.log(`  ✓ sectionV.evaluations actualizada (5%/55%/40%).`);
    } else {
      console.log(`  [DRY-RUN] sectionV.evaluations simularía actualización (5%/55%/40%).`);
    }
  }

  console.log(`\n=== FASE 3 COMPLETADA ${isDryRun ? '(SIMULACIÓN)' : 'CON ÉXITO'} ===`);
}

main().catch(err => {
  console.error('Error en Fase 3:', err);
  process.exit(1);
});

