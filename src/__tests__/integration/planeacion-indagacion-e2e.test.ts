/**
 * Test de Integración End-to-End — Planeación Completa con Indagación (ABI)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Valida el ciclo integral de planeación para la metodología activa Indagación (ABI):
 * 1. Recomendador automático de UACs de Ciencias Naturales y Experimentales hacia indagacion.
 * 2. Lookup de catálogo con las 5 fases de investigación científica escolar e invariantes de nombre.
 * 3. Enlace con el catálogo de estrategias didácticas y garantía dual offline.
 * 4. Construcción de macro-prompt (buildUserPrompt) inyectando fases y repertorio.
 * 5. Secuencia didáctica micro (SecuenciaSesionSchema / SecuenciaResponseSchema).
 * 6. Validación estructural del payload de planeación (PlanningContentSchema).
 */

import { describe, it, expect } from 'vitest';
import { recomendarMetodologia } from '@/lib/recomendador-metodologia';
import { obtenerMetodologiaPorId } from '@/lib/catalogo-metodologias';
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

describe('Integración E2E: Flujo Completo de Planeación con Indagación (ABI)', () => {

  // ─── 1. Recomendador Automático de Metodología ──────────────────────────────
  describe('1. Recomendador Automático hacia Indagación (ABI)', () => {
    const uacsCiencias = [
      'Química I',
      'Física Experimental',
      'Biología General',
      'La Materia y sus Interacciones',
      'Ecosistema y Biodiversidad',
      'Ciencias Naturales y Experimentales',
    ];

    it.each(uacsCiencias)(
      'debe recomendar "indagacion" para %s en componente fundamental',
      (uacName) => {
        const recomendada = recomendarMetodologia(uacName, 'fundamental');
        expect(recomendada).toBe('indagacion');
      }
    );

    it('debe activar steam como fallback para Ingeniería y Prototipado', () => {
      const recomendada = recomendarMetodologia('Robótica y Prototipos', 'fundamental');
      expect(recomendada).toBe('steam');
    });
  });

  // ─── 2. Catálogo Oficial e Invariantes de Indagación ────────────────────────
  describe('2. Metodología Indagación en el Catálogo', () => {
    it('debe existir en CATALOGO_METODOLOGIAS_ACTIVAS con metadatos normativos', () => {
      const met = obtenerMetodologiaPorId('indagacion');
      expect(met).toBeDefined();
      expect(met!.id).toBe('indagacion');
      expect(met!.nombreCorto).toContain('ABI');
      expect(met!.nombre).toContain('Aprendizaje Basado en Indagación');
      expect(met!.fases).toHaveLength(5);
      expect(met!.fases[0]).toContain('Focalización: formulación de preguntas investigables');
      expect(met!.fases[4]).toContain('Comunicación de conclusiones científicas');
    });

    it('debe asociar estrategias didácticas compatibles con garantía dual offline', () => {
      const compatibles = obtenerEstrategiasCompatibles('indagacion');
      expect(compatibles.length).toBeGreaterThanOrEqual(3);

      for (const momento of ['apertura', 'desarrollo', 'cierre'] as const) {
        const promptBlock = formatearEstrategiasParaPrompt(momento, 'indagacion');
        expect(typeof promptBlock).toBe('string');
        expect(promptBlock).toContain('Garantía Offline:');
      }
    });
  });

  // ─── 3. Generación de Macro-Prompt con Fases y Estrategias ───────────────────
  describe('3. Inyección en el Macro-Prompt de Planeación', () => {
    const mockExtractedData: ExtractedPdfData = {
      uacName: 'La Materia y sus Interacciones',
      learningOutcome: 'Explica las transformaciones de la materia a partir del análisis empírico y experimental de fenómenos cotidianos.',
      totalHours: 54,
      activities: [
        { name: 'Actividad 1: Estructura de la materia y estados de agregación', hours: 18, order: 1 },
        { name: 'Actividad 2: Reacciones químicas y leyes de conservación', hours: 18, order: 2 },
        { name: 'Actividad 3: Proyecto experimental de indagación ambiental', hours: 18, order: 3 },
      ],
      evidences: ['Bitácora experimental', 'Gráficas de datos', 'Reporte de indagación científica'],
      parseConfidence: 'high',
      year: 2026,
    };

    const mockTeacherContext: TeacherContext = {
      teacherName: 'Docente de Ciencias Naturales',
      schoolName: 'Bachillerato General Emiliano Zapata',
      municipality: 'San Pedro Cholula',
      state: 'Puebla',
      region: 'Valle de Puebla',
      subsystem: 'bge',
      groupInfo: 'Grupo 1° B',
      paecProblem: 'Contaminación de afluentes y acumulación de residuos plásticos.',
      studentContext: 'Estudiantes de primer semestre con alto interés en experimentación de laboratorio escolar.',
      metodologiaActiva: 'indagacion',
    };

    it('debe inyectar el bloque de Indagación con sus 5 fases ordenadas en buildUserPrompt', () => {
      const prompt = buildUserPrompt(
        mockExtractedData,
        mockTeacherContext,
        1,
        'fundamental'
      );

      // Verificación de Bloque Metodológico
      expect(prompt).toContain('═══════════ METODOLOGÍA ACTIVA SELECCIONADA POR EL DOCENTE ═══════════');
      expect(prompt).toContain('Metodología: Aprendizaje Basado en Indagación (ABI)');
      expect(prompt).toContain('Focalización: formulación de preguntas investigables');
      expect(prompt).toContain('Diseño del plan de indagación o protocolo experimental');
      expect(prompt).toContain('Experimentación, recolección y registro sistemático de datos');
      expect(prompt).toContain('Análisis de resultados, contrastación empírica de hipótesis');
      expect(prompt).toContain('Comunicación de conclusiones científicas');

      // Verificación de Bloque de Estrategias con Garantía Dual Offline
      expect(prompt).toContain('═══════════ REPERTORIO DE ESTRATEGIAS DIDÁCTICAS RECOMENDADAS ═══════════');
      expect(prompt).toContain('• FASE DE APERTURA:');
      expect(prompt).toContain('• FASE DE DESARROLLO (EJECUCIÓN):');
      expect(prompt).toContain('• FASE DE CIERRE (CONCLUSIÓN):');
      expect(prompt).toContain('Garantía Offline:');
    });
  });

  // ─── 4. Validación de Micro-Secuencia Didáctica ──────────────────────────────
  describe('4. Secuencia Didáctica Micro para Indagación (ABI)', () => {
    it('debe validar la estructura de sesiones didácticas con SecuenciaSesionSchema', () => {
      const sesionIndagacion = {
        sessionNum: 1,
        totalSessions: 18,
        phase: 'Apertura',
        title: 'Sesión 1: Focalización y Pregunta Investigable sobre el pH del Agua Local',
        teachingActivity: 'Presenta muestras de agua de dos afluentes locales y orienta la formulación de hipótesis científicas.',
        learningActivity: 'Los estudiantes en brigadas de laboratorio definen variables independientes y dependientes a medir.',
        evidence: 'Protocolo de indagación inicial y tabla de predicciones en bitácora.',
        evaluation: 'Rúbrica de formulación de hipótesis científicas.',
        procesoPensamiento: 'indagacion',
        utilidadReal: 'Permite evaluar si el agua de riego cumple con condiciones seguras para cultivos locales.',
        garantiaDualOffline: 'Uso de tiras reactivas de col morada en caso de no contar con pHmetro digital.',
      };

      const parsed = SecuenciaSesionSchema.safeParse(sesionIndagacion);
      expect(parsed.success).toBe(true);
    });

    it('debe validar un bloque completo de 18 sesiones con SecuenciaResponseSchema', () => {
      const sesiones = Array.from({ length: 18 }, (_, i) => ({
        sessionNum: i + 1,
        phase: i < 3 ? 'Apertura' : i < 15 ? 'Desarrollo' : 'Cierre',
        title: `Sesión ${i + 1}: Fase de Indagación ABI aplicada`,
        teachingActivity: 'Guía de experimentación y supervisión de protocolos de seguridad en laboratorio.',
        learningActivity: 'Ejecución experimental, toma de datos y contraste empírico de variables.',
        evidence: `Evidencia experimental de sesión ${i + 1}`,
        evaluation: 'Lista de cotejo procedimental',
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
    it('debe validar un documento de planeación completo estructurado con Indagación (ABI)', () => {
      const planeacionCompleta = {
        sectionI: {
          datosGenerales: {
            uacName: 'La Materia y sus Interacciones',
            docente: 'Docente de Ciencias Naturales',
            semestre: '1',
            periodo: '2026-2027',
            metodologiaActiva: 'indagacion',
            metodologiaNombre: 'Aprendizaje Basado en Indagación (ABI)',
          },
        },
        sectionII: {
          intencionesFormativas: {
            proposito: 'Construir explicaciones sobre las propiedades de la materia mediante indagación científica.',
            learningOutcomes: ['Analiza y contrasta empíricamente transformaciones físicas y químicas.'],
          },
        },
        sectionIII: {
          transversalidad: {
            paecProblematica: 'Manejo sustentable del agua y reducción de contaminantes en la cuenca.',
          },
        },
        sectionIV: {
          secuenciaDidactica: {
            metodologia: 'indagacion',
            actividadesClave: [
              {
                nombre: 'Indagación Experimental sobre Reacciones Químicas',
                horas: 18,
                fasesIndagacion: [
                  '1. Focalización y formulación de preguntas investigables',
                  '2. Diseño del plan de indagación o protocolo experimental',
                  '3. Experimentación y recolección de datos',
                ],
                apertura: { activities: 'Focalización con fenómeno observable de efervescencia.' },
                ejecucion: { activities: 'Toma de datos volumétricos y temperatura con bitácora.' },
                conclusion: { activities: 'Comunicación de hallazgos mediante póster científico.' },
              },
            ],
          },
        },
        sectionV: {
          evaluacionFormativa: {
            instrumentos: ['Rúbrica de reporte de indagación', 'Lista de cotejo de bitácora'],
            criteriosNEM: true,
          },
        },
      };

      const validation = PlanningContentSchema.safeParse(planeacionCompleta);
      expect(validation.success).toBe(true);
    });
  });

});
