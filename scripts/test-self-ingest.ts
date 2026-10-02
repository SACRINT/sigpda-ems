import { generatePmcDocxMaestro } from '../src/lib/pmc-docx-maestro-builder';
import { ingestDocument } from '../src/lib/document-ingestion';
import { findPlanActionSection, countPlanTableRows, extractDeterministicSupervisorAndZone } from '../src/lib/pmc/pmc-partitioner';

async function test() {
  const mockCompleteProject = {
    id: 'pmc-test-uuid-001',
    teacher_id: 'teacher-uuid-123',
    school_name: 'Bachillerato General Oficial Licenciado Moisés Sáenz Garza',
    school_cct: '21EBH0004Z',
    municipality: 'Puebla',
    locality: 'San Jerónimo Caleras',
    school_zone: '004',
    ciclo_escolar: '2025-2026',
    subsystem: 'Bachillerato General Estatal',
    director_name: 'Dr. Roberto Mendoza Herrera',
    supervisor_name: 'Mtra. Patricia González Morales',
    diagnostico_generado: {
      presentacion: 'Presentacion del PMC de prueba.',
      contexto: 'Contexto del plantel.',
      analisis_indicadores: 'Aprobacion 89%, reprobacion 11%, abandono 5%.',
      sintesis_foda: 'Fortalezas: Docentes comprometidos. Debilidades: Equipo.',
      priorizacion: 'Priorizar comprension lectora.',
    },
    plan_accion: {
      metas_institucionales: [
        {
          tema: 'Aprovechamiento Académico',
          diagnostico_meta: 'Bajo desempeno en matematicas.',
          meta: 'Alcanzar el 92% de aprobación general.',
          estrategia: 'Implementación de talleres.',
          linea_base: '89.4% inicial.',
          personal_designado: 'Ing. Nemesio Loyda López',
          entregable: 'Listas de cotejo',
          periodo_inicio: 'Agosto 2025',
          periodo_fin: 'Diciembre 2025',
        },
      ],
      metas_individuales: [
        {
          docente: 'Ing. Nemesio Loyda López',
          cargo: 'Docente',
          meta: 'Realizar una instalación eléctrica en la bodega.',
          estrategia: 'Cuantificación y compra de material.',
          entregable: 'Reporte fotográfico.',
          periodo: 'Agosto 2025 - Junio 2026',
        }
      ],
      personal_plantel: [
        {
          nombre: 'Dr. Roberto Mendoza Herrera',
          cargo: 'Director(a)',
          horas_base: 40,
        },
        {
          nombre: 'Ing. Nemesio Loyda López',
          cargo: 'Docente',
          horas_base: 20,
        }
      ]
    }
  };

  const buffer = await generatePmcDocxMaestro(mockCompleteProject);
  console.log('1. Generated DOCX buffer length:', buffer.length);

  const ingested = await ingestDocument(buffer, { filename: 'PMC_Moises_Saenz.docx' });
  console.log('2. Ingested markdown length:', ingested.markdown.length);
  console.log('3. Contains Moisés Sáenz Garza?', ingested.markdown.includes('Moisés') || ingested.markdown.includes('Moises'));
  console.log('4. Contains Nemesio Loyda?', ingested.markdown.includes('Nemesio'));
  console.log('5. Contains CCT (21EBH0004Z)?', ingested.markdown.includes('21EBH0004Z'));
  
  const plan = findPlanActionSection(ingested.markdown);
  console.log('6. Plan de Accion found?', plan.startIndex !== -1, 'length:', plan.planText.length);
  
  const tableRows = countPlanTableRows(ingested.markdown);
  console.log('7. Table rows counted in Plan:', tableRows);

  const supZone = extractDeterministicSupervisorAndZone(ingested.markdown, mockCompleteProject.director_name);
  console.log('8. Extracted Supervisor & Zone:', supZone);
}

test().catch(console.error);
