import { describe, it, expect } from 'vitest';
import {
  isGenericSearchUrl,
  sanitizeWorkbookResourceUrls,
} from '@/lib/resources/workbook-sanitizer';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

describe('Workbook Sanitizer (P0 / Fase A.1)', () => {
  describe('isGenericSearchUrl', () => {
    it('detecta URLs de búsqueda de YouTube y Google', () => {
      expect(isGenericSearchUrl('https://www.youtube.com/results?search_query=instalaciones+electricas')).toBe(true);
      expect(isGenericSearchUrl('https://www.google.com/search?q=calculo+integral')).toBe(true);
      expect(isGenericSearchUrl('https://google.com.mx/search?q=ley+de+ohm')).toBe(true);
      expect(isGenericSearchUrl('https://bing.com/search?q=cisco+packet+tracer')).toBe(true);
      expect(isGenericSearchUrl('https://duckduckgo.com/?q=quimica')).toBe(true);
    });

    it('detecta placeholders y cadenas vacías o inválidas', () => {
      expect(isGenericSearchUrl('')).toBe(true);
      expect(isGenericSearchUrl(null as any)).toBe(true);
      expect(isGenericSearchUrl(undefined as any)).toBe(true);
      expect(isGenericSearchUrl('#')).toBe(true);
      expect(isGenericSearchUrl('javascript:void(0)')).toBe(true);
      expect(isGenericSearchUrl('https://example.com/placeholder')).toBe(true);
    });

    it('permite URLs institucionales legítimas y curadas', () => {
      expect(isGenericSearchUrl('https://www.geogebra.org/')).toBe(false);
      expect(isGenericSearchUrl('https://phet.colorado.edu/es/simulations/filter?subjects=physics')).toBe(false);
      expect(isGenericSearchUrl('https://www.khanacademy.org/')).toBe(false);
      expect(isGenericSearchUrl('https://www.netacad.com/')).toBe(false);
      expect(isGenericSearchUrl('https://www.inegi.org.mx/')).toBe(false);
      expect(isGenericSearchUrl('https://www.tinkercad.com/')).toBe(false);
    });
  });

  describe('sanitizeWorkbookResourceUrls', () => {
    const mockWorkbook: ActiveWorkTextbook = {
      id: 'wb-1',
      planningId: 'plan-123',
      blockIndex: 1,
      blockName: 'Bloque I — Circuitos Eléctricos Básicos',
      version: 1,
      subsystem: 'bge',
      targetPages: 45,
      totalPages: 45,
      totalWords: 15000,
      generatedAt: '2026-11-12T00:00:00Z',
      qualityScore: 90,
      qualityWarning: false,
      coverData: {
        title: 'Libro de Trabajo',
        subtitle: 'Instalaciones Eléctricas',
        subjectName: 'Instalaciones Residenciales',
        semester: 3,
        blockNumber: 1,
        teacherName: 'Docente Test',
        schoolName: 'Bachillerato Oficial',
      },
      tableOfContents: [],
      missions: [
        {
          missionIndex: 1,
          title: 'Misión 1: Ley de Ohm y Seguridad en el Taller',
          coveredSessions: [1, 2],
          sessionTopic: 'Circuitos y Mediciones de Corriente y Voltaje',
          sessionFocus: 'Medición con Multímetro',
          phenomenonHook: { story: 'Corte de energía en el taller', detonatingQuestion: '¿Por qué falló?' },
          conceptZero: { physicalAnalogy: 'Tubería de agua', coreExplanation: 'Voltaje es presión' },
          iDoSection: { stepByStepDemo: 'Medición paso a paso' },
          weDoSection: { guidedPractice: 'Práctica guiada', workbookElements: [] },
          youDoSection: { autonomousChallenge: 'Reto individual', workbookElements: [] },
          troubleshooting: [],
          formativeCheckpoint: { question: '¿Qué es voltaje?', reflectionPrompts: [], criteriaChecklist: [] },
          wordCount: 2500,
          sessionPlans: [
            {
              sessionNumber: 1,
              objetivo: 'Calcular resistencia usando la ley de Ohm',
              motivacion: 'Un taller sin luz',
              saberesPrevios: 'Electricidad básica',
              contenido: 'Fórmulas V=I*R y unidades de medida',
              ejemploResuelto: 'Cálculo para un foco de 60W',
              practica: [],
              aplicacion: 'Instalación residencial',
              autoevaluacion: [],
              productoIntegrador: 'Diagrama del circuito',
              recursos: [
                {
                  titulo: 'Video de búsqueda de YouTube sobre ley de ohm',
                  url: 'https://www.youtube.com/results?search_query=ley+de+ohm+experimento',
                  tipo: 'video',
                },
                {
                  titulo: 'Simulador PhET Circuitos (legítimo)',
                  url: 'https://phet.colorado.edu/es/simulations/filter?subjects=physics',
                  tipo: 'web',
                },
              ],
            },
            {
              sessionNumber: 2,
              objetivo: 'Uso de multímetro digital y normas NOM STPS',
              motivacion: 'Riesgos de cortocircuito',
              saberesPrevios: 'Medición de voltaje',
              contenido: 'Normas de seguridad eléctrica STPS',
              ejemploResuelto: 'Medición en tomacorriente',
              practica: [],
              aplicacion: 'Verificación en casa',
              autoevaluacion: [],
              productoIntegrador: 'Tabla de mediciones',
              recursos: [
                {
                  titulo: 'Búsqueda en Google de manual de multímetro',
                  url: 'https://www.google.com/search?q=manual+multimetro+digital+stps',
                  tipo: 'lectura',
                },
              ],
            },
          ],
        },
      ],
      projectSection: {
        artifactName: 'Tablero Eléctrico',
        communityUtility: 'Instalación comunitaria',
        phases: [],
        technicalSpecs: [],
        acceptanceCriteria: [],
      },
      evaluationSection: {
        source: 'generated_fresh',
        rubric: [],
        checklist: [],
        criticalThinkingQuiz: [],
        metacognitiveReflection: { prompts: [] },
      },
    };

    it('sustituye URLs de búsqueda por recursos curados institucionales y preserva URLs válidas', () => {
      const { sanitized, replacedCount } = sanitizeWorkbookResourceUrls(mockWorkbook);

      expect(replacedCount).toBe(2);

      const s1Recursos = sanitized.missions[0].sessionPlans![0].recursos;
      // Primer recurso reemplazado
      expect(s1Recursos[0].url).not.toContain('youtube.com/results');
      expect(s1Recursos[0].url.startsWith('https://')).toBe(true);
      expect(s1Recursos[0].titulo).not.toContain('búsqueda');

      // Segundo recurso preservado inalterado
      expect(s1Recursos[1].url).toBe('https://phet.colorado.edu/es/simulations/filter?subjects=physics');

      // Tercer recurso (sesión 2) reemplazado
      const s2Recursos = sanitized.missions[0].sessionPlans![1].recursos;
      expect(s2Recursos[0].url).not.toContain('google.com/search');
      expect(s2Recursos[0].url.startsWith('https://')).toBe(true);
    });

    it('garantiza idempotencia: una segunda ejecución produce 0 reemplazos', () => {
      const { sanitized: pass1, replacedCount: count1 } = sanitizeWorkbookResourceUrls(mockWorkbook);
      expect(count1).toBe(2);

      const { sanitized: pass2, replacedCount: count2 } = sanitizeWorkbookResourceUrls(pass1);
      expect(count2).toBe(0);
      expect(pass2).toEqual(pass1);
    });

    it('maneja con elegancia workbooks sin misiones o sin sessionPlans', () => {
      const emptyWb = { ...mockWorkbook, missions: [] };
      const { sanitized, replacedCount } = sanitizeWorkbookResourceUrls(emptyWb);
      expect(replacedCount).toBe(0);
      expect(sanitized.missions).toEqual([]);
    });
  });
});
