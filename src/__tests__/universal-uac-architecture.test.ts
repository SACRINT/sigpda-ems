import { describe, it, expect } from 'vitest';
import { generateObjectBlueprintSvg } from '@/lib/visual-engine/object-svg-generator';
import { resolveMultipleDigitalToolsForMission } from '@/lib/visual-engine/digital-tools-registry';
import {
  resolveEquipmentVisualForMission,
  resolveVisualForMission,
} from '@/lib/visual-engine/visual-asset-manager';
import { autoTokenizeMaterials } from '@/lib/materials/auto-tokenize';
import { isStemSubject } from '@/lib/visual-engine/visual-dispatcher';
import { extractCalloutBox } from '@/lib/visual-engine/callout-box';
import { extractComparisonTable } from '@/lib/visual-engine/comparison-table';
import { sanitizeEducationalResourceUrl } from '@/lib/pdf-workbook-renderer';
import {
  getDisciplinaryAdapter,
  buildDisciplinaryPromptBlock,
} from '@/lib/prompts/disciplinary-adapters';
import {
  extractMaterialsFromWorkbook,
  resolveTargetSessionsForWorkbook,
} from '@/lib/guide-engine/material-extractor';
import type { ActiveWorkTextbook, MissionSection } from '@/types/work-textbook';
import type { SecuenciaBloque } from '@/types/planning';

describe('Arquitectura Universal Multi-UAC (Fases 1 a 6)', () => {
  describe('Fase 1: Motor Visual SVG, PNG Local 512x512 y Herramientas Digitales', () => {
    it('dibuja SVG dedicado para cronómetro, flexómetro y escalímetro (cero llave inglesa genérica)', () => {
      const cronoSvg = generateObjectBlueprintSvg('cronometro', 'Cronómetro Digital');
      expect(cronoSvg).toContain('00:12.48');
      expect(cronoSvg).toContain('CHRONO · SPORT');

      const flexoSvg = generateObjectBlueprintSvg('flexometro', 'Flexómetro de Cinta Metálica');
      expect(flexoSvg).toContain('5m');

      const escalimetroSvg = generateObjectBlueprintSvg('escalimetro', 'Escalímetro Triangular Profesional');
      expect(escalimetroSvg).toContain('1:100');
      expect(escalimetroSvg).toContain('1:50');
    });

    it('prioriza PNG local 512x512 en resolveEquipmentVisualForMission cuando existe en public/images/materiales', async () => {
      const mockMission = {
        missionIndex: 1,
        title: 'Misión 1: El juego tradicional y la velocidad de reacción',
        coveredSessions: [1, 2, 3],
        sessionTopic: 'Velocidad y agilidad',
        sessionFocus: 'Medición de tiempos en cancha',
        phenomenonHook: {
          story: 'En la cancha escolar medimos el tiempo de reacción con un cronómetro digital.',
          detonatingQuestion: '¿Cómo mejora nuestro tiempo en el circuito?',
        },
        conceptZero: {
          physicalAnalogy: 'Un cronómetro registra centésimas de segundo.',
          coreExplanation: 'Medición deportiva de tiempos de reacción con cronómetro.',
        },
        iDoSection: { stepByStepDemo: 'Usamos el cronómetro para tomar tiempos.' },
        weDoSection: { guidedPractice: 'Registra tiempos con cronómetro.', workbookElements: [] },
        youDoSection: { autonomousChallenge: 'Mide 3 recorridos con cronómetro.', workbookElements: [] },
        troubleshooting: [],
        formativeCheckpoint: { question: '', reflectionPrompts: [], criteriaChecklist: [] },
        wordCount: 500,
      } as unknown as MissionSection;

      const res = await resolveEquipmentVisualForMission(
        mockMission,
        'Actividades Físicas y Deportivas'
      );
      expect(res).not.toBeNull();
      expect(res?.detected.name.toLowerCase()).toContain('cronómetro');
      expect(res?.format).toBe('PNG');
      expect(res?.buffer.byteLength).toBeGreaterThan(10000);
    });

    it('asigna Kinovea y Tabata Timer a Actividades Físicas y Deportivas (nunca GeoGebra ni Scratch)', () => {
      const tools = resolveMultipleDigitalToolsForMission(
        'Actividades Físicas y Deportivas',
        'Misión 1: Acondicionamiento físico y frecuencia cardíaca en cancha',
        'Medición de ritmo cardíaco en ppm, circuito deportivo, agilidad y juego tradicional',
        4
      );
      const ids = tools.map((t) => t.id);
      expect(ids).toContain('tabata_timer');
      expect(ids).not.toContain('geogebra');
      expect(ids).not.toContain('scratch');
      expect(ids).not.toContain('phet');
    });

    it('asigna LibreCAD a Dibujo Técnico I', () => {
      const tools = resolveMultipleDigitalToolsForMission(
        'Dibujo Técnico I',
        'Misión 1: Trazado de planos a escala y proyecciones ortogonales',
        'Acotación normalizada ISO, vistas en alzado, planta y perfil e isométrico CAD',
        3
      );
      const ids = tools.map((t) => t.id);
      expect(ids).toContain('librecad');
    });
  });

  describe('Fase 2: Erradicación de Falsos Positivos en Auto-Tokenize y Clasificación STEM', () => {
    it('nunca tokeniza "tabla de" como [[material:tabla-cortar]] ni "juego de" como [[material:juego-dados]]', () => {
      const sample =
        'Completa la tabla de registro de frecuencia cardíaca durante el juego de Bote Pateado usando una fuente de información confiable.';
      const tokenized = autoTokenizeMaterials(sample);
      expect(tokenized).not.toContain('tabla-cortar');
      expect(tokenized).not.toContain('juego-dados');
      expect(tokenized).not.toContain('fuente-poder');
    });

    it('clasifica Actividades Físicas y Deportivas como NO STEM y Taller de Pensamiento Variacional I como STEM', () => {
      expect(isStemSubject('Actividades Físicas y Deportivas')).toBe(false);
      expect(isStemSubject('Actividades Físicas y Deportivas I')).toBe(false);
      expect(isStemSubject('Educación Física')).toBe(false);
      expect(isStemSubject('Taller de Pensamiento Variacional I')).toBe(true);
      expect(isStemSubject('Física I')).toBe(true);
    });

    it('bloquea materiales culinarios (tabla-cortar) en asignaturas deportivas o de dibujo técnico', async () => {
      const res = await resolveVisualForMission({
        uacName: 'Actividades Físicas y Deportivas',
        blockIndex: 0,
        missionIndex: 1,
        missionTitle: 'Misión 1: El juego tradicional',
        contextText: 'Usa [[material:tabla-cortar]] y [[material:cronometro]] en la cancha.',
        preferOpenverseMedia: false,
      });
      expect(res).not.toBeNull();
      expect(res?.type).toBe('material_png');
      if (res?.type === 'material_png') {
        expect(res.materialSlug).not.toBe('tabla-cortar');
        expect(res.materialSlug).toBe('cronometro');
      }
    });
  });

  describe('Fase 3: Cero Truncamiento Tipográfico (...)', () => {
    it('no trunca keyTakeaway con ... a los 80 caracteres ni duplica el cuerpo del callout', () => {
      const box = extractCalloutBox(
        'Idea clave: Piensa en el juego tradicional y la actividad física como el sistema operativo básico de un teléfono celular avanzado que coordina cuerpo y mente.'
      );
      expect(box).not.toBeNull();
      expect(box?.body).not.toContain('...');
      expect(box?.keyTakeaway ?? '').not.toContain('...');
    });

    it('no trunca el título del Cuadro Comparativo con ... a los 60 caracteres', () => {
      const table = extractComparisonTable(
        '| Aspecto Cotidiano | Concepto Técnico |\n|---|---|\n| Jugar sin orden | Práctica motriz lúdica |\n| Correr rápido | Velocidad de desplazamiento |',
        'Fundamentación e Intuición — Sesión 1: Exploración Diagnóstica y Problematización',
        'Actividades Físicas y Deportivas'
      );
      expect(table).not.toBeNull();
      expect(table?.title).not.toContain('...');
      expect(table?.title).toContain('Exploración Diagnóstica y Problematización');
    });
  });

  describe('Fase 4: Enlaces Educativos Resilientes (Cero 404)', () => {
    it('convierte enlaces watch?v= alucinados en búsquedas educativas válidas de YouTube', () => {
      const safe = sanitizeEducationalResourceUrl(
        'https://www.youtube.com/watch?v=ejemplo_cir',
        'Circuitos de activación neuromuscular',
        'video'
      );
      expect(safe).toContain('https://www.youtube.com/results?search_query=');
      expect(safe).not.toContain('watch?v=ejemplo_cir');
    });
  });

  describe('Fase 5: Matriz de 14 Estrategias Disciplinares Dinámicas', () => {
    it('resuelve el adaptador correcto para Actividades Físicas, Dibujo Técnico y Pensamiento Variacional', () => {
      const dep = getDisciplinaryAdapter('Actividades Físicas y Deportivas', 'Formación Socioemocional');
      expect(dep.id).toBe('actividades_fisicas_deportivas_salud');

      const dib = getDisciplinaryAdapter('Dibujo Técnico I', 'Componente Propedéutico');
      expect(dib.id).toBe('dibujo_tecnico_diseno_arquitectura');

      const varMat = getDisciplinaryAdapter('Taller de Pensamiento Variacional I', 'Fundamental Extendido');
      expect(varMat.id).toBe('pensamiento_matematico');

      const block = buildDisciplinaryPromptBlock('Actividades Físicas y Deportivas');
      expect(block).toContain('Cronómetro deportivo digital');
      expect(block).toContain('tabla de cortar');
    });
  });

  describe('Fase 6: Dinamismo de Sesiones por Bloque (12, 18 y 24 sesiones)', () => {
    it('extrae exactamente 12 planes de clase para bloques de 12 horas (Actividades Físicas 36h)', () => {
      const seq12: SecuenciaBloque = {
        blockIndex: 0,
        blockName: 'Bloque 1',
        hours: 12,
        sessions: Array.from({ length: 12 }, (_, i) => ({
          sessionNum: i + 1,
          totalSessions: 12,
          phase: i < 2 ? 'Apertura' : i < 10 ? 'Desarrollo' : 'Cierre',
          title: `Sesión ${i + 1}`,
          teachingActivity: `Mediación docente S${i + 1}`,
          learningActivity: `Práctica estudiantil S${i + 1}`,
          evidence: `Evidencia S${i + 1}`,
          evaluation: 'Lista de cotejo',
        })),
      };
      const wb12 = {
        blockIndex: 0,
        blockName: 'Bloque 1',
        coverData: { subjectName: 'Actividades Físicas y Deportivas', schoolName: 'Plantel' },
        missions: [
          { missionIndex: 1, title: 'M1', coveredSessions: [1, 2, 3], phenomenonHook: {}, conceptZero: {}, iDoSection: {}, weDoSection: {}, youDoSection: {}, formativeCheckpoint: {} },
          { missionIndex: 2, title: 'M2', coveredSessions: [4, 5, 6], phenomenonHook: {}, conceptZero: {}, iDoSection: {}, weDoSection: {}, youDoSection: {}, formativeCheckpoint: {} },
          { missionIndex: 3, title: 'M3', coveredSessions: [7, 8, 9], phenomenonHook: {}, conceptZero: {}, iDoSection: {}, weDoSection: {}, youDoSection: {}, formativeCheckpoint: {} },
          { missionIndex: 4, title: 'M4', coveredSessions: [10, 11, 12], phenomenonHook: {}, conceptZero: {}, iDoSection: {}, weDoSection: {}, youDoSection: {}, formativeCheckpoint: {} },
        ],
      } as unknown as ActiveWorkTextbook;

      expect(resolveTargetSessionsForWorkbook(wb12, seq12)).toBe(12);
      expect(resolveTargetSessionsForWorkbook(wb12, null)).toBe(12);

      const extracted = extractMaterialsFromWorkbook(wb12, seq12);
      expect(extracted.planesDeClase.length).toBe(12);
      expect(extracted.coherencia?.ok).toBe(true);
    });

    it('extrae exactamente 18 planes de clase para bloques de 18 horas (54h semestrales)', () => {
      const wb18 = {
        blockIndex: 0,
        blockName: 'Bloque 1',
        coverData: { subjectName: 'Dibujo Técnico I', schoolName: 'Plantel' },
        missions: [
          { missionIndex: 1, title: 'M1', coveredSessions: [1, 2, 3, 4], phenomenonHook: {}, conceptZero: {}, iDoSection: {}, weDoSection: {}, youDoSection: {}, formativeCheckpoint: {} },
          { missionIndex: 2, title: 'M2', coveredSessions: [5, 6, 7, 8, 9], phenomenonHook: {}, conceptZero: {}, iDoSection: {}, weDoSection: {}, youDoSection: {}, formativeCheckpoint: {} },
          { missionIndex: 3, title: 'M3', coveredSessions: [10, 11, 12, 13, 14], phenomenonHook: {}, conceptZero: {}, iDoSection: {}, weDoSection: {}, youDoSection: {}, formativeCheckpoint: {} },
          { missionIndex: 4, title: 'M4', coveredSessions: [15, 16, 17, 18], phenomenonHook: {}, conceptZero: {}, iDoSection: {}, weDoSection: {}, youDoSection: {}, formativeCheckpoint: {} },
        ],
      } as unknown as ActiveWorkTextbook;

      expect(resolveTargetSessionsForWorkbook(wb18, null)).toBe(18);
    });
  });
});
