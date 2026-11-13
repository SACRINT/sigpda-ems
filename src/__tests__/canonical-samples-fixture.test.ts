/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

interface CanonicalFixtureSample {
  id: string;
  shortName: string;
  uac_name: string;
  semester: number;
  component: 'fundamental' | 'laboral';
  hours: number;
  content_json: Record<string, any>;
  sequence_json: Record<string, any>;
  workbooks_json: Record<string, any>;
  lesson_plans: Array<{ key_index: number; title: string; content_text: string }>;
  latest_version: {
    version_number: number;
    sha256_hash: string;
    anexo12_score: number;
    dbepa_score: number;
  };
}

function loadCanonicalSamplesFixture(): CanonicalFixtureSample[] {
  const fixturePath = path.resolve(
    process.cwd(),
    'src',
    '__tests__',
    'fixtures',
    'canonical-samples.json'
  );
  const parsed = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
    samples: CanonicalFixtureSample[];
  };
  return parsed.samples;
}

const fixtureSamples = loadCanonicalSamplesFixture();

describe('5. Muestras Canónicas (Fixture JSON): 270 Sesiones Reales (54/72/36/54/54) y 270 Planes Diarios', () => {
  it('Las 5 muestras canónicas del fixture tienen paridad exacta de 270 sesiones, Anexo 12 = 100 y DBEPA verde', () => {
    expect(fixtureSamples).toHaveLength(5);
    let totalSessionsSum = 0;

    for (const sample of fixtureSamples) {
      const content = sample.content_json;
      const totalHours = Number(content.sectionI?.totalHours || content.totalHours);
      expect(totalHours).toBe(sample.hours);

      const seq = sample.sequence_json;
      const seqSessions =
        (seq['0']?.sessions?.length || 0) +
        (seq['1']?.sessions?.length || 0) +
        (seq['2']?.sessions?.length || 0);
      expect(seqSessions).toBe(sample.hours);
      totalSessionsSum += seqSessions;

      const wb = sample.workbooks_json;
      const countWbSessions = (blockObj: any) => {
        if (!blockObj?.current?.missions) return 0;
        return blockObj.current.missions.reduce(
          (acc: number, m: any) => acc + (m.sessionPlans?.length || 0),
          0
        );
      };
      const wbSessions =
        countWbSessions(wb.block_0) +
        countWbSessions(wb.block_1) +
        countWbSessions(wb.block_2);
      expect(wbSessions).toBe(sample.hours);

      expect(content.anexo12Audit.score).toBe(100);
      expect(content.anexo12Audit.criticalFailures).toBe(0);
      expect(content.dbepaAudit.semaforo).toBe('verde');
    }

    expect(totalSessionsSum).toBe(270);
  });

  it('Existen exactamente 270 planes de clase individuales en el fixture (54/72/36/54/54)', () => {
    let totalExtrasPlans = 0;

    for (const sample of fixtureSamples) {
      expect(sample.lesson_plans).toHaveLength(sample.hours);
      totalExtrasPlans += sample.lesson_plans.length;
    }

    expect(totalExtrasPlans).toBe(270);
  });

  it('0 URLs de búsqueda genéricas en workbooks_json de las 5 muestras del fixture', () => {
    for (const sample of fixtureSamples) {
      const wbStr = JSON.stringify(sample.workbooks_json);
      expect(wbStr.includes('youtube.com/results')).toBe(false);
      expect(wbStr.includes('google.com/search')).toBe(false);
    }
  });

  it('0 textos genéricos de modelado docente en workbooks_json de las 5 muestras del fixture', () => {
    const genericModelado = 'El docente realiza el modelado procedimental explícito ante el grupo';

    for (const sample of fixtureSamples) {
      const wbStr = JSON.stringify(sample.workbooks_json);
      expect(wbStr.includes(genericModelado)).toBe(false);
    }
  });

  it('0 plantillas genéricas en los planes de clase de las 5 muestras del fixture', () => {
    const genericApertura = 'Activación de conocimientos previos y presentación de la consigna';
    const genericDesarrollo = 'Trabajo colaborativo guiado y aplicación práctica';
    const genericCierre = 'Evaluación formativa, síntesis y retroalimentación colectiva';

    for (const sample of fixtureSamples) {
      for (const plan of sample.lesson_plans) {
        const text = plan.content_text || '';
        expect(text.includes(genericApertura)).toBe(false);
        expect(text.includes(genericDesarrollo)).toBe(false);
        expect(text.includes(genericCierre)).toBe(false);
      }
    }
  });
});

describe('7. Muestras canónicas (Fixture JSON): 270 sesiones y 270 planes únicos', () => {
  it('Cada sesión tiene título y actividades docentes/didácticas/evaluativas únicas', () => {
    let totalSessions = 0;

    for (const sample of fixtureSamples) {
      const sessions = Object.values(sample.sequence_json).flatMap(
        (block: any) => block.sessions || []
      );
      expect(sessions.length).toBe(sample.hours);
      totalSessions += sessions.length;

      expect(new Set(sessions.map((s: any) => s.title)).size).toBe(sample.hours);
      for (const key of ['teachingActivity', 'learningActivity', 'evaluation']) {
        expect(new Set(sessions.map((s: any) => s[key])).size).toBe(sample.hours);
      }

      const wbSessions: any[] = [];
      let emptyIDo = 0;
      for (const block of Object.values(sample.workbooks_json)) {
        for (const mission of (block as any)?.current?.missions || []) {
          const demo = mission?.iDoSection?.stepByStepDemo;
          if (typeof demo !== 'string' || demo.trim().length < 40) emptyIDo++;
          wbSessions.push(...(mission?.sessionPlans || []));
        }
      }

      expect(emptyIDo).toBe(0);
      expect(wbSessions.length).toBe(sample.hours);
      expect(new Set(wbSessions.map((s: any) => s.objetivo)).size).toBe(sample.hours);
    }

    expect(totalSessions).toBe(270);
  });

  it('Los 270 planes de clase del fixture son únicos e incluyen el título de su sesión', () => {
    let totalPlans = 0;

    for (const sample of fixtureSamples) {
      const titles = Object.values(sample.sequence_json)
        .flatMap((block: any) => block.sessions || [])
        .map((session: any) => String(session.title || '').trim());

      expect(sample.lesson_plans.length).toBe(sample.hours);
      expect(new Set(sample.lesson_plans.map((p) => p.content_text)).size).toBe(sample.hours);
      totalPlans += sample.lesson_plans.length;

      for (const plan of sample.lesson_plans) {
        const text = String(plan.content_text || '');
        const match = text.match(/\*\*Tema específico:\*\*\s*(.+)/);
        expect(match).not.toBeNull();
        expect(titles).toContain(match![1].trim());
        expect(text.includes('\uFFFD')).toBe(false);
      }
    }

    expect(totalPlans).toBe(270);
  });
});

describe('8. Trazabilidad de versiones (Fixture JSON)', () => {
  it('Cada muestra del fixture conserva versión >= 1, SHA-256 de 64 caracteres y Anexo 12 = 100', () => {
    for (const sample of fixtureSamples) {
      expect(sample.latest_version.version_number).toBeGreaterThanOrEqual(1);
      expect(sample.latest_version.sha256_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(sample.latest_version.anexo12_score).toBe(100);
    }
  });
});
