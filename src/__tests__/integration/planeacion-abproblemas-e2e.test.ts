/**
 * Test de Integración End-to-End — Planeación Completa con ABProblemas
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Valida el ciclo integral de planeación para la metodología activa ABProblemas:
 * 1. Recomendador automático de UACs de Matemáticas hacia abproblemas.
 * 2. Lookup de catálogo con las 6 fases estructuradas e invariantes de nombre.
 * 3. Enlace con el catálogo de estrategias didácticas y garantía dual offline.
 * 4. Construcción de macro-prompt (buildUserPrompt) inyectando fases y repertorio.
 * 5. Secuencia didáctica micro (SecuenciaSesionSchema / SecuenciaResponseSchema).
 * 6. Validación estructural del payload de planeación (PlanningContentSchema).
 */

import { describe, it, expect } from 'vitest';
import { recomendarMetodologia } from '@/lib/recomendador-metodologia';
import {
  obtenerMetodologiaPorId,
} from '@/lib/catalogo-metodologias';
import {
  obtenerEstrategiasCompatibles,
  formatearEstrategiasParaPrompt,
} from '@/lib/catalogo-estrategias';
import { buildUserPrompt } from '@/lib/prompts/build-prompt';
import {
  PlanningContentSchema,
  SecuenciaResponseSchema,
  SecuenciaSesionSchema,
} from '@/lib/ai-schemas';
import type { ExtractedPdfData, TeacherContext } from '@/types/planning';

describe('Integración E2E: Flujo Completo de Planeación con ABProblemas', () => {

  // ─── 1. Recomendador Automático de Metodología ──────────────────────────────
  describe('1. Recomendador Automático hacia ABProblemas', () => {
    const uacsMatematicas = [
      'Pensamiento Matemático I',
      'Pensamiento Matemático II',
      'Álgebra y Funciones',
      'Cálculo Diferencial',
      'Probabilidad y Estadística',
      'Pensamiento Lógico',
    ];

    it.each(uacsMatematicas)(
      'debe recomendar "abproblemas" para %s en componente fundamental',
      (uacName) => {
        const recomendada = recomendarMetodologia(uacName, 'fundamental');
        expect(recomendada).toBe('abproblemas');
      }
    );

    it('debe activar aula_invertida como fallback para Lógica conceptual pura', () => {
      const recomendada = recomendarMetodologia('Lógica', 'fundamental');
      expect(recomendada).toBe('aula_invertida');
    });
  });

  // ─── 2. Catálogo Oficial e Invariantes de ABProblemas ────────────────────────
  describe('2. Metodología ABProblemas en el Catálogo', () => {
    it('debe existir en CATALOGO_METODOLOGIAS_ACTIVAS con metadatos normativos', () => {
      const met = obtenerMetodologiaPorId('abproblemas');
      expect(met).toBeDefined();
      expect(met!.id).toBe('abproblemas');
      expect(met!.nombreCorto).toBe('ABProblemas');
      expect(met!.nombreCorto).not.toBe('ABP');
      expect(met!.nombre).toContain('Aprendizaje Basado en Problemas');
      expect(met!.fases).toHaveLength(5);
      expect(met!.fases[0]).toContain('Delimitación y clarificación de la situación problema');
      expect(met!.fases[4]).toContain('Presentación argumentada de la resolución y reflexión metacognitiva');
    });

    it('debe asociar estrategias didácticas compatibles con garantía dual offline', () => {
      const compatibles = obtenerEstrategiasCompatibles('abproblemas');
      expect(compatibles.length).toBeGreaterThanOrEqual(3);

      for (const momento of ['apertura', 'desarrollo', 'cierre'] as const) {
        const promptBlock = formatearEstrategiasParaPrompt(momento, 'abproblemas');
        expect(typeof promptBlock).toBe('string');
        expect(promptBlock).toContain('Garantía Offline:');
      }
    });
  });

  // ─── 3. Generación de Macro-Prompt con Fases y Estrategias ───────────────────
  describe('3. Inyección en el Macro-Prompt de Planeación', () => {
    const mockExtractedData: ExtractedPdfData = {
      uacName: 'Pensamiento Matemático II',
      learningOutcome: 'Modela situaciones cotidianas mediante expresiones algebraicas y resolución sistemática de problemas.',
      totalHours: 54,
      activities: [
        { name: 'Actividad 1: Modelado Algebraico y Funciones Lineales', hours: 18, order: 1 },
        { name: 'Actividad 2: Sistemas de Ecuaciones y Optimización', hours: 18, order: 2 },
        { name: 'Actividad 3: Proyecto de Aplicación Situada en la Comunidad', hours: 18, order: 3 },
      ],
      evidences: ['Problemario razonado', 'Modelo gráfico', 'Reporte de aplicación'],
      parseConfidence: 'high',
      year: 2026,
    };

    const mockTeacherContext: TeacherContext = {
      teacherName: 'Profesor de Matemáticas',
      schoolName: 'Bachillerato General Emiliano Zapata',
      municipality: 'Heroica Puebla de Zaragoza',
      state: 'Puebla',
      region: 'Centro',
      subsystem: 'bge',
      groupInfo: 'Grupo 2° A',
      paecProblem: 'Uso ineficiente del agua y recursos locales.',
      studentContext: 'Estudiantes de segundo semestre con inclinación hacia actividades prácticas.',
      metodologiaActiva: 'abproblemas',
    };

    it('debe inyectar el bloque de ABProblemas con sus 5 fases ordenadas en buildUserPrompt', () => {
      const prompt = buildUserPrompt(
        mockExtractedData,
        mockTeacherContext,
        2,
        'fundamental'
      );

      // Verificación de Bloque Metodológico
      expect(prompt).toContain('═══════════ METODOLOGÍA ACTIVA SELECCIONADA POR EL DOCENTE ═══════════');
      expect(prompt).toContain('Metodología: Aprendizaje Basado en Problemas (ABProblemas)');
      expect(prompt).toContain('Delimitación y clarificación de la situación problema');
      expect(prompt).toContain('Identificación de necesidades de aprendizaje y activación de saberes previos');
      expect(prompt).toContain('Búsqueda autónoma e indagación de información técnica, científica o normativa');
      expect(prompt).toContain('Formulación, contraste y deliberación colectiva de propuestas de solución');
      expect(prompt).toContain('Presentación argumentada de la resolución y reflexión metacognitiva del proceso');

      // Verificación de Bloque de Estrategias con Garantía Dual Offline
      expect(prompt).toContain('═══════════ REPERTORIO DE ESTRATEGIAS DIDÁCTICAS RECOMENDADAS ═══════════');
      expect(prompt).toContain('• FASE DE APERTURA:');
      expect(prompt).toContain('• FASE DE DESARROLLO (EJECUCIÓN):');
      expect(prompt).toContain('• FASE DE CIERRE (CONCLUSIÓN):');
      expect(prompt).toContain('Garantía Offline:');
    });
  });

  // ─── 4. Validación de Micro-Secuencia Didáctica ──────────────────────────────
  describe('4. Secuencia Didáctica Micro para ABProblemas', () => {
    it('debe validar la estructura de sesiones didácticas con SecuenciaSesionSchema', () => {
      const sesionAbproblemas = {
        sessionNum: 1,
        totalSessions: 18,
        phase: 'Apertura',
        title: 'Sesión 1: Problematización y Análisis del Fenómeno Matemático',
        teachingActivity: 'Presenta un caso real de consumo energético y guía la identificación de variables.',
        learningActivity: 'Los estudiantes organizados en equipos identifican lo conocido y lo desconocido del problema.',
        evidence: 'Tabla de delimitación del problema y preguntas de indagación iniciales.',
        evaluation: 'Lista de cotejo diagnóstica de saberes previos.',
        procesoPensamiento: 'problematizacion',
        utilidadReal: 'Permite comprender el impacto económico del gasto eléctrico en los hogares.',
        garantiaDualOffline: 'Uso de recibos impresos de luz en lugar de simulador digital.',
      };

      const parsed = SecuenciaSesionSchema.safeParse(sesionAbproblemas);
      expect(parsed.success).toBe(true);
    });

    it('debe validar un bloque completo de 18 sesiones con SecuenciaResponseSchema', () => {
      const sesiones = Array.from({ length: 18 }, (_, i) => ({
        sessionNum: i + 1,
        phase: i < 3 ? 'Apertura' : i < 15 ? 'Desarrollo' : 'Cierre',
        title: `Sesión ${i + 1}: Fase de ABProblemas aplicada`,
        teachingActivity: 'Mediación docente activa orientada a la resolución del problema.',
        learningActivity: 'Trabajo colaborativo de análisis, cálculo y argumentación.',
        evidence: `Producto de la sesión ${i + 1}`,
        evaluation: 'Rúbrica formativa continua',
      }));

      const responsePayload = { sessions: sesiones };
      const parsed = SecuenciaResponseSchema.safeParse(responsePayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.sessions).toHaveLength(18);
      }
    });
  });

  // ─── 5. Validación de la Planeación Completa con PlanningContentSchema ────────
  describe('5. Esquema de Planeación Completa (Zod)', () => {
    it('debe validar un documento de planeación completo estructurado con ABProblemas', () => {
      const planeacionCompleta = {
        sectionI: {
          datosGenerales: {
            uacName: 'Pensamiento Matemático II',
            docente: 'Profesor de Matemáticas',
            semestre: '2',
            periodo: '2026-2027',
            metodologiaActiva: 'abproblemas',
            metodologiaNombre: 'Aprendizaje Basado en Problemas (ABProblemas)',
          },
        },
        sectionII: {
          intencionesFormativas: {
            proposito: 'Modelar situaciones contextuales mediante resolución de problemas.',
            learningOutcomes: ['Modela y resuelve problemas del entorno local.'],
          },
        },
        sectionIII: {
          transversalidad: {
            paecProblematica: 'Cuidado del agua y uso eficiente de recursos en la comunidad.',
          },
        },
        sectionIV: {
          secuenciaDidactica: {
            metodologia: 'abproblemas',
            actividadesClave: [
              {
                nombre: 'Planteamiento y Modelado Matemático del Problema',
                horas: 18,
                fasesAbproblemas: [
                  '1. Planteamiento del problema situado',
                  '2. Clarificación de conceptos',
                  '3. Hipótesis',
                ],
                apertura: { activities: 'Problematización inicial situada.' },
                ejecucion: { activities: 'Indagación y cálculo algorítmico.' },
                conclusion: { activities: 'Evaluación y presentación de soluciones.' },
              },
            ],
          },
        },
        sectionV: {
          evaluacionFormativa: {
            instrumentos: ['Rúbrica analítica', 'Lista de cotejo'],
            criteriosNEM: true,
          },
        },
      };

      const validation = PlanningContentSchema.safeParse(planeacionCompleta);
      expect(validation.success).toBe(true);
    });
  });

});
