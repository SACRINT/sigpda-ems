import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

interface ExtractedCurriculumItem {
  semester: number;
  uac_name: string;
  model_type: 'propositos_contenidos' | 'progresiones';
  meta_educativa?: string;
  contenidos_formativos: Array<{
    numero: number;
    proposito?: string | null;
    progresion?: string | null;
    contenidos?: string[];
  }>;
}

describe('H-309: Parser y Extractor de Currículo Oficial PAEC', () => {
  const jsonPath = path.resolve(process.cwd(), 'scripts', 'paec-curriculum-extracted.json');

  it('el archivo JSON extraído existe y es un JSON válido', () => {
    expect(fs.existsSync(jsonPath)).toBe(true);
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(70);
  });

  it('cubre asignaturas desde el 1.º hasta el 6.º semestre', () => {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data: ExtractedCurriculumItem[] = JSON.parse(raw);
    const semesters = new Set(data.map((d) => d.semester));

    for (let sem = 1; sem <= 6; sem++) {
      expect(semesters.has(sem)).toBe(true);
    }
  });

  it('no contiene "Meta educativa" como propósito formativo numerado', () => {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data: ExtractedCurriculumItem[] = JSON.parse(raw);

    for (const item of data) {
      for (const cf of item.contenidos_formativos) {
        expect((cf.proposito || '').toLowerCase()).not.toContain('meta educativa');
      }
    }
  });

  it('cada elemento de contenidos_formativos tiene número válido y descripción no vacía', () => {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data: ExtractedCurriculumItem[] = JSON.parse(raw);

    for (const item of data) {
      expect(item.contenidos_formativos.length).toBeGreaterThan(0);
      for (const cf of item.contenidos_formativos) {
        expect(typeof cf.numero).toBe('number');
        expect(cf.numero).toBeGreaterThan(0);
        const text = (cf.proposito || cf.progresion || '').trim();
        expect(text.length).toBeGreaterThan(5);
      }
    }
  });
});
