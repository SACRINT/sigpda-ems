import { describe, expect, it } from 'vitest';
import {
  resolveCheckpoint,
  resolveConceptZero,
  resolveGuidedPractice,
  resolvePhenomenonHook,
} from '@/lib/guide-engine/writers/mission-narrative';
import type { SessionPlan } from '@/types/work-textbook';

const plan = {
  objetivo: 'Ejecutar una prueba de estanqueidad en una tubería de PVC.',
  motivacion: 'En la colonia La Esperanza, una fuga de agua deteriora el muro de una vivienda.',
  autoevaluacion: ['¿Qué presión aplicaste y por qué?'],
  contenido: 'La prueba hidrostática verifica la hermeticidad de una instalación sometiéndola a presión controlada.',
  ejemploResuelto: 'Planteamiento: se aplica 6 kg/cm² durante 10 minutos.',
  practica: [
    { enunciado: 'Calcula la presión de prueba para una tubería de 1 pulgada.', pista: 'Usa la norma.' },
    { enunciado: 'Diseña el protocolo de verificación para el muro de contención.', pista: 'Revisa tolerancias.' },
  ],
  productoIntegrador: 'Reporte de prueba con lecturas y dictamen.',
  aplicacion: 'Documenta la fuga real de tu comunidad.',
} as unknown as SessionPlan;

describe('narrativa de misión derivada de contenido real', () => {
  it('usa la motivación real de la sesión y no un hook fijo', () => {
    const hook = resolvePhenomenonHook({
      uacName: 'Limpia muebles, tuberías y conexiones',
      paecContext: 'Falta de espacios recreativos seguros',
      sessionPlans: [plan],
    });
    expect(hook.story).toContain('La Esperanza');
    expect(hook.story).not.toContain('Durante esta práctica en el aula o taller');
    expect(hook.detonatingQuestion).toContain('presión');
  });

  it('usa la analogía o la primera oración real del contenido', () => {
    const concept = resolveConceptZero({
      uacName: 'Limpia muebles, tuberías y conexiones',
      paecContext: 'Fuga comunitaria',
      sessionPlans: [plan],
    });
    expect(concept.coreExplanation).toContain('prueba hidrostática');
    expect(concept.physicalAnalogy).not.toContain('mapa de navegación');
  });

  it('deriva la práctica guiada del ejercicio real', () => {
    const guided = resolveGuidedPractice({
      uacName: 'Limpia muebles, tuberías y conexiones',
      paecContext: 'Fuga comunitaria',
      sessionPlans: [plan],
    });
    expect(guided).toContain('presión de prueba');
  });

  it('deriva el checkpoint de la autoevaluación y criterios reales', () => {
    const checkpoint = resolveCheckpoint({
      uacName: 'Limpia muebles, tuberías y conexiones',
      paecContext: 'Fuga comunitaria',
      sessionPlans: [plan],
    });
    expect(checkpoint.question).toContain('presión');
    expect(checkpoint.criteriaChecklist.length).toBeGreaterThan(0);
    expect(checkpoint.criteriaChecklist.join(' ')).not.toContain('Registré todas las lecturas');
  });
});
