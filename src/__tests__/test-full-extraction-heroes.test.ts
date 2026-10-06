import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ingestDocument } from '@/lib/document-ingestion';
import {
  findPlanActionSection,
  partitionMarkdownDocument,
  salvagePlanElementsFromRaw,
} from '@/lib/pmc/pmc-partitioner';
import { PmcPreviousExtractSchema } from '@/lib/prompts/pmc-extraction';
import { parseAIResponse } from '@/lib/ai-response-parser';

describe('Test partition sizes and structure for Heroes de la Patria and large 15-15-15 schools', () => {
  const cand1 = path.resolve(process.cwd(), '..', 'documentos_referencia', '[02]PMC', '911 y F11', 'Heroes', 'PMC 2026-Heroes de la Patria.docx');
  const cand2 = path.resolve(process.cwd(), '..', 'documentos_referencia', '[05] Proyectos_PAEC_y_PMC', '911 y F11', 'Heroes', 'PMC 2026-Heroes de la Patria.docx');
  const fixturePath = fs.existsSync(cand1) ? cand1 : cand2;

  it('partitions planText into balanced sub-chunks (< 10,000 chars) for high fidelity', async () => {
    const buffer = fs.readFileSync(fixturePath);
    const ingested = await ingestDocument(buffer, { filename: 'PMC 2026-Heroes de la Patria.docx' });
    const documentText = ingested.markdown || ingested.fullText || '';

    const { planText } = findPlanActionSection(documentText);
    expect(planText.length).toBeGreaterThan(15000);

    const planChunks = partitionMarkdownDocument(planText, 5000, 9500);
    for (let i = 0; i < planChunks.length; i++) {
      expect(planChunks[i].length).toBeLessThanOrEqual(10000);
      expect(planChunks[i].length).toBeGreaterThan(0);
    }
  });

  it('handles simulated 15-15-15 school (60,000 chars table) without overflowing 10,000 char chunks', () => {
    const header = '| N° | Categoría | Meta | Responsable | Fecha |\n|---|---|---|---|---|\n';
    let rowText = '';
    for (let i = 1; i <= 250; i++) {
      rowText += `| ${i} | Desarrollo académico y aprendizaje | Meta institucional ${i} con meta de aprobación del 85% y retención escolar | DOCENTE RESPONSABLE ${i} | 2026-2027 |\n`;
    }
    const largeTable = header + rowText;
    expect(largeTable.length).toBeGreaterThan(20000);

    const chunks = partitionMarkdownDocument(largeTable, 5000, 9500);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(10500);
      expect(c.includes('| N° | Categoría |')).toBe(true); // Table header propagated
    }
  }, 15000);

  it('parses LLM responses with string arrays in participantes and metas_individuales without Zod error', () => {
    const rawAiOutput = JSON.stringify({
      schoolName: 'Bachillerato Héroes de la Patria',
      schoolCct: '21EBH0200X',
      directorName: 'ADRIAN HERNÁNDEZ CRUZ',
      participantes: [
        'LIC. ADRIAN HERNANDEZ CRUZ',
        'ING. MOISES FLORES VAZQUEZ'
      ],
      staffData: [
        {
          nombre: 'ADRIAN HERNÁNDEZ CRUZ',
          cargo: 'Director',
          meta_individual: 'Supervisar el 100% de las metas institucionales',
          metas_individuales: [
            'Meta 1: Monitorear el aprovechamiento escolar al 85%',
            'Meta 2: Implementar 3 reuniones colegiadas por semestre'
          ]
        },
        {
          nombre: 'ALEJANDRA MARTINEZ LUNA',
          cargo: 'Docente',
          metas_individuales: [
            'Aprobar al 85% de los alumnos en Física II'
          ]
        }
      ],
      elementos_plan: [
        {
          tipo: 'actividad',
          numero_origen: 1,
          texto_original: 'Realizar un concentrado de calificaciones grupal',
          texto_normalizado: 'Realizar un concentrado de calificaciones grupal',
          categoria: 'Desarrollo académico y aprendizaje',
          tema: 'Reprobación',
          responsable: 'Docente',
          periodo: '2026-2027',
          motivos_revision: 'Texto de prueba'
        }
      ],
      metas_institucionales_previas: [
        'Alcanzar 85% de aprobación general en el plantel'
      ]
    });

    const parsed = parseAIResponse(rawAiOutput, PmcPreviousExtractSchema, { contextName: 'test-resilient' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.participantes?.length).toBe(2);
      expect(parsed.data.participantes?.[0].nombre).toBe('LIC. ADRIAN HERNANDEZ CRUZ');
      expect(parsed.data.staffData?.[0].metas_individuales?.length).toBe(2);
      expect(parsed.data.staffData?.[0].metas_individuales?.[0].meta).toBe('Meta 1: Monitorear el aprovechamiento escolar al 85%');
      expect(parsed.data.metas_institucionales_previas?.length).toBe(1);
      expect(parsed.data.metas_institucionales_previas?.[0].meta).toBe('Alcanzar 85% de aprobación general en el plantel');
      expect(parsed.data.elementos_plan?.length).toBe(1);
    }
  });

  it('salvages elements from unclosed/truncated JSON', () => {
    const truncatedRaw = `\`\`\`json
    {
      "elementos_plan": [
        {
          "tipo": "actividad",
          "texto_original": "Actividad 1 salvada",
          "texto_normalizado": "Actividad 1 salvada",
          "responsable": "Docente A"
        },
        {
          "tipo": "meta",
          "texto_original": "Meta 2 salvada con 85% de aprobación",
          "texto_normalizado": "Meta 2 salvada con 85% de aprobación",
          "responsable": "Docente B"
        },
        {
          "tipo": "actividad",
          "texto_original": "Actividad 3 corta
    `;

    const salvaged = salvagePlanElementsFromRaw(truncatedRaw);
    expect(salvaged.elementos.length).toBeGreaterThanOrEqual(2);
    expect(salvaged.elementos[0].texto_original).toBe('Actividad 1 salvada');
    expect(salvaged.elementos[1].texto_original).toBe('Meta 2 salvada con 85% de aprobación');
  });
});
