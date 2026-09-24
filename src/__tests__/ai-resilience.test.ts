/**
 * ai-resilience.test.ts
 * 
 * Tests unitarios para el módulo transversal de resiliencia (src/lib/ai-resilience.ts).
 * Verifica la detección estricta de fallos de IA (isUpstreamAIError), el manejo
 * del presupuesto de tiempo seguro (withTimeoutBudget) y los mensajes de saturación.
 */

import { describe, it, expect } from 'vitest';
import {
  isUpstreamAIError,
  withTimeoutBudget,
  AI_OUTAGE_USER_MESSAGE,
} from '@/lib/ai-resilience';

describe('ai-resilience.ts — Módulo Transversal de Resiliencia', () => {
  describe('isUpstreamAIError', () => {
    it('reconoce códigos de estado HTTP 429, 503, 504 en objetos de error', () => {
      expect(isUpstreamAIError({ status: 503 })).toBe(true);
      expect(isUpstreamAIError({ statusCode: 504 })).toBe(true);
      expect(isUpstreamAIError({ status: 429 })).toBe(true);
    });

    it('reconoce firmas canónicas de proveedores de IA', () => {
      expect(isUpstreamAIError(new Error('GoogleGenerativeAIError: [503 Service Unavailable] UNAVAILABLE'))).toBe(true);
      expect(isUpstreamAIError(new Error('This model is currently experiencing high demand.'))).toBe(true);
      expect(isUpstreamAIError(new Error('[ai-provider] All AI providers exhausted. Primary: gemini.'))).toBe(true);
      expect(isUpstreamAIError(new Error('Rate-limit exceeded for tier'))).toBe(true);
      expect(isUpstreamAIError(new Error('upstream rate limit reached'))).toBe(true);
      expect(isUpstreamAIError(new Error('RESOURCE_EXHAUSTED'))).toBe(true);
      expect(isUpstreamAIError(new Error('MODEL_CAPACITY_EXCEEDED'))).toBe(true);
      expect(isUpstreamAIError(new Error('Request aborted due to timeout'))).toBe(true);
    });

    it('reconoce errores crudos de proxies HTTP 503 y Service Unavailable (D-004)', () => {
      expect(isUpstreamAIError(new Error('HTTP 503: upstream backend connection dropped'))).toBe(true);
      expect(isUpstreamAIError(new Error('503 Service Unavailable from openrouter'))).toBe(true);
      expect(isUpstreamAIError(new Error('upstream service unavailable during peak load'))).toBe(true);
    });

    it('NO clasifica como IA errores de base de datos o validaciones genéricas (test negativo)', () => {
      expect(isUpstreamAIError(new Error('Connection timeout to Neon DB'))).toBe(false);
      expect(isUpstreamAIError(new Error('Database query timed out'))).toBe(false);
      expect(isUpstreamAIError(new Error('Postgres error 503001 relation not found'))).toBe(false);
      expect(isUpstreamAIError(new Error('Constraint violation code 42901'))).toBe(false);
      expect(isUpstreamAIError(new Error('HTTP 500: Internal Server Error'))).toBe(false);
      expect(isUpstreamAIError(new Error('Validation error: text is too short'))).toBe(false);
      expect(isUpstreamAIError(null)).toBe(false);
      expect(isUpstreamAIError(undefined)).toBe(false);
    });
  });

  describe('withTimeoutBudget', () => {
    it('resuelve normalmente si la promesa concluye antes del timeout', async () => {
      const result = await withTimeoutBudget(Promise.resolve('éxito seguro'), 500);
      expect(result).toBe('éxito seguro');
    });

    it('aborta y rechaza con status 503 cuando se excede el presupuesto de tiempo', async () => {
      const hungPromise = new Promise<string>(() => {
        // Promesa intencionalmente colgada
      });

      const budgetPromise = withTimeoutBudget(hungPromise, 50, 'Timeout simulado excedido');

      await expect(budgetPromise).rejects.toThrow('Timeout simulado excedido');
      await expect(budgetPromise).rejects.toMatchObject({ status: 503 });
    });

    it('rechaza con status 503 inmediatamente si el presupuesto restante es <= 0 (D-001)', async () => {
      const hungPromise = new Promise<string>(() => {});
      const budgetPromise = withTimeoutBudget(hungPromise, 0);

      await expect(budgetPromise).rejects.toThrow(/límite seguro/);
      await expect(budgetPromise).rejects.toMatchObject({ status: 503 });
    });

    it('respeta un deadline global encadenado entre dos etapas (D-001)', async () => {
      const startTime = Date.now();
      const deadline = startTime + 100;

      // Etapa 1: rápida (5ms)
      const stage1Budget = Math.max(1, deadline - Date.now());
      const stage1Result = await withTimeoutBudget(
        new Promise((resolve) => setTimeout(() => resolve('etapa1_ok'), 5)),
        stage1Budget
      );
      expect(stage1Result).toBe('etapa1_ok');

      // Etapa 2: colgada, su presupuesto restante es lo que queda del deadline global
      const remainingBudget = Math.max(1, deadline - Date.now());
      expect(remainingBudget).toBeLessThanOrEqual(100);

      const hungStage2 = new Promise<string>(() => {});
      await expect(
        withTimeoutBudget(hungStage2, remainingBudget, 'Etapa 2 excedió deadline')
      ).rejects.toMatchObject({ status: 503 });

      const totalElapsed = Date.now() - startTime;
      // El tiempo transcurrido total no debe superar sustancialmente el deadline original (+ márgenes de timer)
      expect(totalElapsed).toBeLessThan(250);
    });
  });

  describe('AI_OUTAGE_USER_MESSAGE', () => {
    it('contiene mensaje empático e institucional para el usuario', () => {
      expect(AI_OUTAGE_USER_MESSAGE).toContain('alta demanda o saturación temporal');
      expect(AI_OUTAGE_USER_MESSAGE).toContain('Tu documento es válido');
    });
  });
});
