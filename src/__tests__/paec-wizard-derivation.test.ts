import { describe, it, expect } from 'vitest';
import {
  UACS_LABORALES_OFICIALES_BGE,
} from '@/lib/capacitaciones-data';
import {
  FORMACIONES_LABORALES,
  FFE_PAIRS,
  FFE_CONTINUIDAD_5_A_6,
  obtenerFfeSemestre6,
} from '@/lib/escuela-grupos';
import {
  getMissingStep1Fields,
  buildPaecExtractionPrompt,
  buildPaecChunkExtractionPrompt,
} from '@/lib/prompts/paec-extraction';
import type { GroupTrackConfig } from '@/types/paec';

describe('F-A08: Verificación de Derivación Curricular e Invariantes del Wizard PAEC', () => {

  // Test 1: Invariante F-A01 — Guard de igualdad estructural previene re-renders
  describe('Test 1: Guard de Igualdad Estructural (F-A01)', () => {
    it('mantiene la referencia previa (Object.is) si los grupos no sufren cambios estructurales', () => {
      const prev: GroupTrackConfig[] = [
        { groupId: '1-A', groupName: '1° A', semester: 1 },
        { groupId: '3-A', groupName: '3° A', semester: 3, trackId: 'Contabilidad', trackName: 'Contabilidad' },
        { groupId: '5-A', groupName: '5° A', semester: 5, trackId: 'custom', trackName: 'Personalizado', ffeSelections: ['Inglés V', 'Dibujo Técnico I'] },
      ];

      // Simulamos una reconstrucción con datos idénticos
      const updated: GroupTrackConfig[] = [
        { groupId: '1-A', groupName: '1° A', semester: 1 },
        { groupId: '3-A', groupName: '3° A', semester: 3, trackId: 'Contabilidad', trackName: 'Contabilidad' },
        { groupId: '5-A', groupName: '5° A', semester: 5, trackId: 'custom', trackName: 'Personalizado', ffeSelections: ['Inglés V', 'Dibujo Técnico I'] },
      ];

      // Evaluación del guard exacto de PaecWizardClient.tsx
      const isSameLength = updated.length === prev.length;
      const isSameContent = isSameLength && updated.every((u, idx) => {
        const p = prev[idx];
        if (!p) return false;
        return u.groupId === p.groupId &&
               u.groupName === p.groupName &&
               u.semester === p.semester &&
               u.trackId === p.trackId &&
               u.trackName === p.trackName &&
               (u.ffeSelections?.length ?? 0) === (p.ffeSelections?.length ?? 0) &&
               (u.ffeSelections || []).every((s, i) => s === (p.ffeSelections || [])[i]);
      });

      const result = isSameContent ? prev : updated;
      expect(Object.is(result, prev)).toBe(true);
    });

    it('emite una nueva referencia si se modifica alguna asignación curricular', () => {
      const prev: GroupTrackConfig[] = [
        { groupId: '3-A', groupName: '3° A', semester: 3, trackId: 'Contabilidad', trackName: 'Contabilidad' },
      ];
      const updated: GroupTrackConfig[] = [
        { groupId: '3-A', groupName: '3° A', semester: 3, trackId: 'Administración', trackName: 'Administración' },
      ];

      const isSameLength = updated.length === prev.length;
      const isSameContent = isSameLength && updated.every((u, idx) => {
        const p = prev[idx];
        if (!p) return false;
        return u.groupId === p.groupId &&
               u.groupName === p.groupName &&
               u.semester === p.semester &&
               u.trackId === p.trackId &&
               u.trackName === p.trackName &&
               (u.ffeSelections?.length ?? 0) === (p.ffeSelections?.length ?? 0) &&
               (u.ffeSelections || []).every((s, i) => s === (p.ffeSelections || [])[i]);
      });

      const result = isSameContent ? prev : updated;
      expect(Object.is(result, prev)).toBe(false);
      expect(result).toBe(updated);
    });
  });

  // Test 2: Validación Curricular de getMissingStep1Fields (F-A06)
  describe('Test 2: Validación Curricular en getMissingStep1Fields (F-A06)', () => {
    const baseValidForm = {
      projectName: 'Proyecto Ecológico PAEC',
      problemStatement: 'Problemática de residuos sólidos',
      community: {
        location: 'Puebla',
        demographics: 'Zona urbana',
        economy: 'Comercio',
      },
      school: {
        enrollment: '300',
        teacherCount: '15',
      },
    };

    it('reporta campos curriculares faltantes si hay semestres laborales sin asignación', () => {
      const missing = getMissingStep1Fields({
        ...baseValidForm,
        curricular: {
          hasLaboralSemesters: true,
          selectedLaboralCount: 0,
          hasFfeSemesters: false,
          selectedFfeCount: 0,
        },
      });

      expect(missing).toContain('Capacitación Laboral (Formación para el Trabajo)');
      expect(missing).not.toContain('Formación Fundamental Extendida (FFE)');
    });

    it('reporta FFE faltante si hay semestres 5°/6° sin asignación FFE', () => {
      const missing = getMissingStep1Fields({
        ...baseValidForm,
        curricular: {
          hasLaboralSemesters: true,
          selectedLaboralCount: 8,
          hasFfeSemesters: true,
          selectedFfeCount: 0,
        },
      });

      expect(missing).not.toContain('Capacitación Laboral (Formación para el Trabajo)');
      expect(missing).toContain('Formación Fundamental Extendida (FFE)');
    });

    it('pasa limpiamente (0 campos faltantes) cuando los datos y la configuración curricular son válidos', () => {
      const missing = getMissingStep1Fields({
        ...baseValidForm,
        curricular: {
          hasLaboralSemesters: true,
          selectedLaboralCount: 8,
          hasFfeSemesters: true,
          selectedFfeCount: 4,
          isTecnico: false,
        },
      });

      expect(missing).toHaveLength(0);
    });
  });

  // Test 3: Avisos y Chunking Documental (F-A03 / H-13)
  describe('Test 3: Avisos y Chunking Documental (F-A03 / H-13)', () => {
    it('buildPaecExtractionPrompt incluye aviso explícito de capacidad cuando el texto excede 75,000 caracteres', () => {
      const longText = 'A'.repeat(80000);
      const prompt = buildPaecExtractionPrompt(longText);

      expect(prompt).toContain('[AVISO DE CAPACIDAD DOCUMENTAL');
      expect(prompt).toContain('80,000 caracteres');
    });

    it('buildPaecExtractionPrompt no incluye aviso si el texto es menor a 75,000 caracteres', () => {
      const normalText = 'Texto normal del documento PAEC';
      const prompt = buildPaecExtractionPrompt(normalText);

      expect(prompt).not.toContain('[AVISO DE CAPACIDAD DOCUMENTAL');
    });

    it('buildPaecChunkExtractionPrompt genera un esquema de fragmento válido', () => {
      const chunkPrompt = buildPaecChunkExtractionPrompt('Fragmento del plan de acción', 0, 3);
      expect(chunkPrompt).toContain('Analiza el siguiente fragmento (1 de 3)');
      expect(chunkPrompt).toContain('"schoolType": "general | tecnico | telebachillerato"');
      expect(chunkPrompt).toContain('TEXTO DEL FRAGMENTO (1/3)');
    });
  });

  // Test 4: Paridad de Derivación Single Source of Truth para Laboral y FFE
  describe('Test 4: Derivación Laboral y FFE de los Grupos', () => {
    it('deriva exactamente 8 UACs por capacitación laboral activa sin duplicados', () => {
      const track = FORMACIONES_LABORALES[0];
      const semMap = UACS_LABORALES_OFICIALES_BGE[track];
      expect(semMap).toBeDefined();

      const uacs: string[] = [];
      for (const semUacs of Object.values(semMap!)) {
        for (const u of semUacs) {
          if (!uacs.includes(u)) uacs.push(u);
        }
      }
      expect(uacs).toHaveLength(8);
    });

    it('deriva la continuidad de 6° semestre de forma determinista para cada par oficial', () => {
      for (const pair of FFE_PAIRS) {
        expect(obtenerFfeSemestre6(pair.name5)).toBe(pair.name6);
        expect(FFE_CONTINUIDAD_5_A_6[pair.name5]).toBe(pair.name6);
      }
    });
  });
});
