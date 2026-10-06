// src/__tests__/material-extractor-tokens.test.ts
import { describe, it, expect } from 'vitest';
import { extractMaterialsFromWorkbook } from '@/lib/guide-engine/material-extractor';
import type { ActiveWorkTextbook } from '@/types/work-textbook';
import type { SecuenciaBloque } from '@/types/planning';

describe('T-IMG-04: Integración de Tokens en Extractor de Materiales', () => {
  const baseWorkbook = {
    blockIndex: 0,
    blockName: 'Bloque 1: Cinemática y Electrónica',
    coverData: {
      title: 'Cuaderno de Trabajo Activo',
      subjectName: 'Física y Circuitos',
      blockNumber: 1,
    },
    projectSection: {
      artifactName: 'Medidor de Parámetros Eléctricos',
      communityUtility: 'Instalaciones comunitarias seguras',
      requiredMaterials: [
        '[[material:multimetro|Multímetro digital autorango]]',
        '[[material:cable-red]]',
        'Cinta aislante de uso rudo (material local sin token)',
      ],
      executionSteps: ['Paso 1: Medición', 'Paso 2: Registro'],
      learningObjectives: ['Aprender mediciones eléctricas'],
    },
    missions: [
      {
        missionIndex: 1,
        title: 'Medición de Resistencia y Voltaje',
        coveredSessions: [1],
        sessionTopic: 'Magnitudes Eléctricas',
        sessionFocus: 'Uso del multímetro digital',
        phenomenonHook: { story: 'Caso eléctrico', detonatingQuestion: '¿Por qué hay caída?' },
        conceptZero: { physicalAnalogy: 'Tubería de agua', coreExplanation: 'V = I * R' },
        iDoSection: { stepByStepDemo: 'Demo multímetro' },
        weDoSection: { guidedPractice: 'Práctica guiada' },
        youDoSection: { autonomousChallenge: 'Reto autónomo' },
        troubleshooting: [],
        formativeCheckpoint: {
          question: '¿Qué mide el óhmetro?',
          reflectionPrompts: [],
          criteriaChecklist: [],
        },
        wordCount: 500,
      },
    ],
  };

  const sequenceWithTokens: SecuenciaBloque = {
    blockIndex: 0,
    blockName: 'Bloque 1',
    hours: 2,
    sessions: [
      {
        sessionNum: 1,
        totalSessions: 2,
        phase: 'Desarrollo',
        title: 'Práctica de Laboratorio Eléctrico',
        teachingActivity: 'El docente explica la conexión en serie.',
        learningActivity: 'El alumno mide con el instrumento.',
        evidence: 'Tabla de mediciones',
        evaluation: 'Cotejo',
        garantiaDualOffline: '[[material:multimetro]] y [[material:contactos-electricos]] para el armado.',
      },
      {
        sessionNum: 2,
        totalSessions: 2,
        phase: 'Cierre',
        title: 'Sesión Teórica de Síntesis',
        teachingActivity: 'El docente coordina la plenaria.',
        learningActivity: 'El alumno elabora mapa mental.',
        evidence: 'Mapa conceptual',
        evaluation: 'Rúbrica',
        garantiaDualOffline: 'Libreta de apuntes y lápiz sin equipo técnico.',
      },
    ],
  };

  it('resuelve tokens en requiredMaterials de la sección de proyecto', () => {
    const extracted = extractMaterialsFromWorkbook(baseWorkbook as unknown as ActiveWorkTextbook);

    // Debe resolver la etiqueta visible del token
    expect(extracted.guiaDelBloque).toContain('- [ ] Multímetro digital autorango');
    // Debe resolver el nombre oficial cuando no hay etiqueta visible
    expect(extracted.guiaDelBloque).toContain('- [ ] Cable de Red Ethernet UTP Cat 6 con Conectores RJ45');
    // Material sin token permanece intacto
    expect(extracted.guiaDelBloque).toContain('- [ ] Cinta aislante de uso rudo (material local sin token)');
  });

  it('construye la tabla de materiales con las columnas Token, Imagen, EPP y Equivalente Virtual', () => {
    const extracted = extractMaterialsFromWorkbook(
      baseWorkbook as unknown as ActiveWorkTextbook,
      sequenceWithTokens
    );

    // Cabecera enriquecida de 8 columnas
    expect(extracted.materialDidactico).toContain(
      '| Sesión | Misión / Práctica | Materiales e Insumos Didácticos | Token | Imagen | EPP | Equivalente Virtual | Espacio Requerido |'
    );

    // Sesión 1 con tokens detectados
    expect(extracted.materialDidactico).toContain('`[[material:multimetro]]`');
    expect(extracted.materialDidactico).toContain('/images/materiales/multimetro.png');
    expect(extracted.materialDidactico).toContain('Gafas de seguridad');
    expect(extracted.materialDidactico).toContain('Falstad CircuitJS');

    // Sesión 2 sin tokens: valores de fallback
    expect(extracted.materialDidactico).toContain('| Sesión 2 |');
    expect(extracted.materialDidactico).toContain('| - | - | No requerido | - |');
  });
});
