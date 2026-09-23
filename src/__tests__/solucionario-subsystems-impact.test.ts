// src/__tests__/solucionario-subsystems-impact.test.ts
/**
 * Evaluación de Calidad e Impacto del Solucionario Docente en Múltiples Subsistemas (Fase 29)
 * SIGPDA-EMS · SEMS Puebla MCCEMS 2026-2027
 *
 * Evalúa la calidad, profundidad técnica y contextualización de los solucionarios
 * docentes generados para diferentes subsistemas educativos:
 * 1. BGE (Bachillerato General Estatal):
 *    - UACs formativas fundamentales (Conciencia Histórica, Ecosistemas, Pensamiento Matemático).
 *    - Contextualización territorial comunitaria situada (PAEC Puebla).
 * 2. BT (Bachillerato Tecnológico / Formación Laboral):
 *    - UACs tecnológicas y de laboratorio (Cultura Digital, Mantenimiento, Conservación de la Energía).
 *    - Pautas operativas de taller, normas de seguridad y árboles de troubleshooting.
 * 3. Ausencia absoluta de texto genérico ("Lorem ipsum", "Pendiente", respuestas vacías).
 */

import { describe, it, expect } from 'vitest';
import { extractMaterialsFromWorkbook, extractSpecificMaterial } from '@/lib/guide-engine/material-extractor';
import type { ActiveWorkTextbook } from '@/types/work-textbook';

function makeBgeWorkbook(uacName: string, paecTopic: string): ActiveWorkTextbook {
  return {
    uacName,
    blockName: 'Bloque I: Identidad y Saberes Comunitarios',
    blockNumber: 1,
    coverData: {
      schoolName: 'BACHILLERATO GENERAL ESTATAL HEROES DE PUEBLA',
      subjectName: uacName,
      semester: 1,
      paecProjectName: paecTopic,
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Diagnóstico Participativo de Saberes Tradicionales',
        coveredSessions: [1, 2, 3],
        sessionTopic: 'Memoria colectiva y transformaciones socioculturales',
        sessionFocus: 'Recuperación de testimonios orales de personas mayores de la junta auxiliar',
        phenomenonHook: {
          story: 'En San Pedro Cholula, las ladrilleras artesanales y la agricultura de traspatio conviven con el desarrollo inmobiliario acelerado.',
          detonatingQuestion: '¿De qué manera los saberes bioculturales locales pueden ofrecer alternativas sustentables frente a la gentrificación?',
        },
        conceptZero: {
          physicalAnalogy: 'Las capas de un suelo fértil donde cada estrato conserva huellas de épocas pasadas.',
          coreExplanation: 'La conciencia histórica permite comprender el presente como resultado de tensiones y acuerdos comunitarios.',
          narrativeExplanation: 'Analizar las fuentes orales con rigor crítico rescata la perspectiva de sectores tradicionalmente marginados.',
          solvedExample: {
            problemStatement: 'Analizar la validez histórica del relato oral comparado con un acta de cabildo municipal de 1940.',
            solutionSteps: [
              'Paso 1: Identificar la intencionalidad y contexto del testimonio oral.',
              'Paso 2: Contrastar datos cronológicos con documentos del archivo municipal.',
              'Paso 3: Sintetizar puntos de convergencia y explicar discrepancias desde la subjetividad social.',
            ],
            interpretation: 'Ambas fuentes son complementarias: el documento aporta fechas legales y el testimonio explica el impacto humano cotidiano.',
          },
          contrastTable: [
            {
              correctConcept: 'La historia comunitaria integra múltiples voces y fuentes materiales, orales y escritas.',
              commonMisconception: 'Creer que la historia sólo existe en los libros de texto oficiales.',
              reasoning: 'La memoria viva local es fuente primaria indispensable para el MCCEMS.',
            },
          ],
        },
        iDoSection: {
          stepByStepDemo: 'El facilitador muestra una ficha de entrevista semiestructurada validada por la academia de Humanidades.',
        },
        weDoSection: {
          guidedPractice: 'En equipos de tres, seleccionen una festividad o técnica artesanal y diseñen un cuestionario de campo.',
        },
        youDoSection: {
          autonomousChallenge: 'Reto autónomo: Realiza una entrevista grabada o transcrita de 10 minutos y redacta una crónica reflexiva.',
        },
      },
    ],
  } as unknown as ActiveWorkTextbook;
}

function makeBtWorkbook(uacName: string, paecTopic: string): ActiveWorkTextbook {
  return {
    uacName,
    blockName: 'Bloque I: Arquitectura y Mantenimiento de Sistemas Digitales',
    blockNumber: 1,
    coverData: {
      schoolName: 'BACHILLERATO TECNOLÓGICO AGROPECUARIO Y FORESTAL',
      subjectName: uacName,
      semester: 3,
      paecProjectName: paecTopic,
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Diagnóstico y Reparación de Fuentes Conmutadas',
        coveredSessions: [1, 2, 3],
        sessionTopic: 'Circuitos de conversión AC/DC en equipos agroindustriales',
        sessionFocus: 'Medición con osciloscopio y reemplazo de condensadores degradados',
        phenomenonHook: {
          story: 'La despulpadora de café del ejido sufrió una interrupción súbita por fallo en la tarjeta de control tras una sobretensión en la red eléctrica rural.',
          detonatingQuestion: '¿Cómo identificar la etapa dañada en la fuente de alimentación sin comprometer la integridad del operario?',
        },
        conceptZero: {
          physicalAnalogy: 'Una presa hidráulica con compuertas reguladas que estabiliza el caudal de salida ante crecidas del río.',
          coreExplanation: 'La modulación por ancho de pulso (PWM) conmuta transistores MOSFET a alta frecuencia para minimizar pérdidas de calor.',
          narrativeExplanation: 'El aislamiento galvánico protege la lógica de control frente a transitorios de alta tensión.',
          solvedExample: {
            problemStatement: 'Calcular el rizado de voltaje permitido si Vout = 12V y el fabricante exige un rizado menor al 2%.',
            solutionSteps: [
              'Paso 1: Aplicar fórmula de rizado porcentual: Vripple = Vout * 0.02.',
              'Paso 2: Calcular: Vripple = 12V * 0.02 = 0.24V (240 mV pico a pico).',
              'Paso 3: Configurar el osciloscopio en acoplamiento AC y escala de 50 mV/div para medir.',
            ],
            interpretation: 'Si la señal en pantalla excede los 240 mVpp, los capacitores de filtrado deben reemplazarse.',
          },
        },
        iDoSection: {
          stepByStepDemo: 'Demostración de protocolo de descarga de condensadores de alta tensión con resistencia de 1k ohm 10W.',
        },
        weDoSection: {
          guidedPractice: 'En parejas, realicen el desarmado seguro del gabinete siguiendo la norma de protección ESD.',
        },
        youDoSection: {
          autonomousChallenge: 'Reto autónomo: Diagnosticar una tarjeta con fallo inducido y documentar la medición de voltajes de prueba.',
        },
        troubleshooting: [
          {
            id: 'tb-bt-01',
            symptom: 'El fusible principal se funde instantáneamente al encender.',
            rootCause: 'Cortocircuito en el puente rectificador o en el transistor MOSFET de conmutación primaria.',
            solutionSteps: [
              'Desconectar de la red eléctrica y verificar condensadores descargados.',
              'Comprobar diodos del puente en escala de prueba de diodos del multímetro.',
              'Reemplazar MOSFET y verificar resistencia de compuerta (gate).',
            ],
            preventionTip: 'Usar lámpara en serie como limitador de corriente durante la primera prueba de energización.',
          },
        ],
      },
    ],
  } as unknown as ActiveWorkTextbook;
}

describe('Fase 29 — Evaluación de Calidad e Impacto del Solucionario Docente en BGE y BT', () => {
  describe('Subsistema BGE (Bachillerato General Estatal)', () => {
    it('genera solucionarios con alta pertinencia territorial y mediación dialéctica en Humanidades y Ciencias Sociales', () => {
      const uacs = [
        { name: 'CONCIENCIA HISTÓRICA I', paec: 'Patrimonio Biocultural de Cholula' },
        { name: 'CIENCIAS SOCIALES I', paec: 'Redes de Solidaridad Comunitaria' },
      ];

      for (const item of uacs) {
        const workbook = makeBgeWorkbook(item.name, item.paec);
        const materials = extractMaterialsFromWorkbook(workbook);
        const solucionario = materials.solucionarioDocente;

        // 1. Confidencialidad y formato oficial
        expect(solucionario).toContain('DOCUMENTO CONFIDENCIAL DE USO EXCLUSIVO PARA EL DOCENTE');
        expect(solucionario).toContain('Área Humanidades / Ciencias Sociales');

        // 2. Mediación docente de saberes previos
        expect(solucionario).toContain('Mediación de Saberes Previos (Apertura)');
        expect(solucionario).toContain('¿De qué manera los saberes bioculturales locales');

        // 3. Resolución pedagógica estructurada
        expect(solucionario).toContain('Paso 1: Identificar la intencionalidad');
        expect(solucionario).toContain('Paso 2: Contrastar datos cronológicos');
        expect(solucionario).toContain('Paso 3: Sintetizar puntos de convergencia');

        // 4. Pauta de evaluación argumentativa humanística
        expect(solucionario).toContain('Pauta de Evaluación Argumentativa / Humanística');
        expect(solucionario).toContain('Evaluar la postura crítica del estudiante');

        // 5. Tabla de contraste de concepciones erróneas
        expect(solucionario).toContain('Tabla de Contraste y Corrección de Errores Comunes');
        expect(solucionario).toContain('La memoria viva local es fuente primaria indispensable');

        // 6. Ausencia total de texto basura o placeholders
        expect(solucionario).not.toContain('Lorem ipsum');
        expect(solucionario).not.toContain('Pendiente de redacción');
        expect(solucionario).not.toContain('undefined');
        expect(solucionario).not.toContain('null');
      }
    });
  });

  describe('Subsistema BT (Bachillerato Tecnológico / Formación Laboral)', () => {
    it('genera solucionarios con rigor procedimental, mediciones y matriz de troubleshooting operativo', () => {
      const uacs = [
        { name: 'MANTENIMIENTO DE EQUIPO DE CÓMPUTO', paec: 'Tecnificación de Maquinaria Agroindustrial' },
        { name: 'ELECTRÓNICA APLICADA', paec: 'Automatización del Riego Ejidal' },
      ];

      for (const item of uacs) {
        const workbook = makeBtWorkbook(item.name, item.paec);
        const materials = extractMaterialsFromWorkbook(workbook);
        const solucionario = materials.solucionarioDocente;

        // 1. Confidencialidad y clasificación laboral/tecnológica
        expect(solucionario).toContain('DOCUMENTO CONFIDENCIAL DE USO EXCLUSIVO PARA EL DOCENTE');
        expect(solucionario).toContain('Formación Fundamental');

        // 2. Clave técnica con variables y cálculos operativos
        expect(solucionario).toContain('Calcular el rizado de voltaje permitido');
        expect(solucionario).toContain('Paso 1: Aplicar fórmula de rizado porcentual: Vripple = Vout * 0.02');
        expect(solucionario).toContain('Vripple = 12V * 0.02 = 0.24V (240 mV pico a pico)');
        expect(solucionario).toContain('los capacitores de filtrado deben reemplazarse');

        // 3. Guía de Intervención ante Errores Operativos (Troubleshooting)
        expect(solucionario).toContain('Guía de Intervención ante Errores Operativos (Troubleshooting)');
        expect(solucionario).toContain('El fusible principal se funde instantáneamente al encender');
        expect(solucionario).toContain('Cortocircuito en el puente rectificador');
        expect(solucionario).toContain('Desconectar de la red eléctrica y verificar condensadores descargados');

        // 4. Extracción bajo demanda
        const isolatedSol = extractSpecificMaterial(workbook, 'solucionario');
        expect(isolatedSol).toBe(solucionario);
        expect(isolatedSol.length).toBeGreaterThan(1200);
      }
    });

    it('clasifica Cultura Digital y Ciencias Naturales correctamente como STEM en el subsistema tecnológico', () => {
      const stemTechWorkbook = makeBtWorkbook('CULTURA DIGITAL I', 'Sistemas de Información Agrícola');
      const materials = extractMaterialsFromWorkbook(stemTechWorkbook);
      expect(materials.solucionarioDocente).toContain('Área STEM / Ciencias Exactas');
      expect(materials.solucionarioDocente).toContain('**Pauta de Resolución STEM:** Verificar el planteamiento de datos o variables');
    });
  });
});
