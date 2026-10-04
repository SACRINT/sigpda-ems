import { describe, it, expect } from 'vitest';
import {
  UACS_LABORALES_OFICIALES_BGE,
} from '@/lib/capacitaciones-data';
import {
  FORMACIONES_LABORALES,
  FFE_PAIRS,
  FFE_CONTINUIDAD_5_A_6,
  obtenerFfeSemestre6,
  areGroupTrackConfigsEqual,
  deriveSelectedLaboralUacs,
  deriveSelectedFfeUacs,
} from '@/lib/escuela-grupos';
import {
  getMissingStep1Fields,
  buildPaecExtractionPrompt,
  buildPaecChunkExtractionPrompt,
  partitionPaecDocument,
  mergePaecExtracts,
  sanitizeSchoolUpdates,
} from '@/lib/prompts/paec-extraction';
import type { GroupTrackConfig } from '@/types/paec';

describe('F-A08: Verificación de Derivación Curricular e Invariantes del Wizard PAEC', () => {

  // Test 1: Invariante F-A01/F-A08 — Guard de igualdad estructural areGroupTrackConfigsEqual importado
  describe('Test 1: Guard de Igualdad Estructural (F-A01/F-A08)', () => {
    it('mantiene la referencia previa si los grupos no sufren cambios estructurales con areGroupTrackConfigsEqual', () => {
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

      // Verificación directa de la función importada de producción
      expect(areGroupTrackConfigsEqual(prev, updated)).toBe(true);

      // Evaluación del guard en el hook de estado
      const result = areGroupTrackConfigsEqual(prev, updated) ? prev : updated;
      expect(Object.is(result, prev)).toBe(true);
    });

    it('emite false y genera nueva referencia si se modifica alguna asignación curricular', () => {
      const prev: GroupTrackConfig[] = [
        { groupId: '3-A', groupName: '3° A', semester: 3, trackId: 'Contabilidad', trackName: 'Contabilidad' },
      ];
      const updated: GroupTrackConfig[] = [
        { groupId: '3-A', groupName: '3° A', semester: 3, trackId: 'Administración', trackName: 'Administración' },
      ];

      expect(areGroupTrackConfigsEqual(prev, updated)).toBe(false);

      const result = areGroupTrackConfigsEqual(prev, updated) ? prev : updated;
      expect(Object.is(result, prev)).toBe(false);
      expect(result).toBe(updated);
    });

    it('retorna false si cambian las asignaciones de optativas FFE', () => {
      const prev: GroupTrackConfig[] = [
        { groupId: '5-A', groupName: '5° A', semester: 5, ffeSelections: ['Inglés V'] },
      ];
      const updated: GroupTrackConfig[] = [
        { groupId: '5-A', groupName: '5° A', semester: 5, ffeSelections: ['Inglés V', 'Dibujo Técnico I'] },
      ];

      expect(areGroupTrackConfigsEqual(prev, updated)).toBe(false);
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

    it('partitionPaecDocument divide un documento largo en fragmentos respetando el tamaño máximo', () => {
      const longText = 'A'.repeat(80000) + '\n\n' + 'B'.repeat(40000);
      const chunks = partitionPaecDocument(longText, 65000);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBeLessThanOrEqual(65000 + 3000);
    });

    it('mergePaecExtracts consolida datos de múltiples fragmentos sin duplicación', () => {
      const base = {
        projectName: 'Proyecto Vida Saludable',
        problemStatement: 'Problemática de nutrición',
        cycleType: 'A' as const,
        schoolType: 'general' as const,
        school: { schoolName: 'BGE Héroes', cct: '21EBH0200X' },
        community: { location: 'Puebla', context: 'Contexto territorial fase 1' },
        selectedLaboral: ['Administración'],
        selectedFfe: ['Inglés V'],
        foda: { fortalezas: 'Docentes capacitados' },
      };

      const addition = {
        projectName: '',
        problemStatement: 'Ampliación en fase 2 comunitaria',
        cycleType: 'A' as const,
        schoolType: 'general' as const,
        selectedLaboral: ['Administración', 'Contabilidad'],
        selectedFfe: ['Inglés V', 'Salud Integral I'],
        foda: { fortalezas: 'Docentes capacitados', debilidades: 'Falta de equipo' },
      };

      const merged = mergePaecExtracts(base, addition);

      expect(merged.projectName).toBe('Proyecto Vida Saludable');
      expect(merged.selectedLaboral).toEqual(['Administración', 'Contabilidad']);
      expect(merged.selectedFfe).toEqual(['Inglés V', 'Salud Integral I']);
      expect(merged.foda?.fortalezas).toBe('Docentes capacitados');
      expect(merged.foda?.debilidades).toBe('Falta de equipo');
      expect(merged.community?.location).toBe('Puebla');
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

  // Test 5: Sanitización de metadatos escolares ante extracciones con strings vacíos (F-R3-05 / F-R4-02)
  describe('Test 5: Preservación de Matrícula y Plantilla ante Extracciones Vacías (F-R3-05 / F-R4-02)', () => {
    it('ignora strings vacíos y valores nulos para no sobrescribir matrícula de 911/F11 preexistente', () => {
      const existingSchool = {
        cct: '21EBH0001A',
        schoolName: 'Bachillerato Oficial Lázaro Cárdenas',
        enrollment: '345',
        teacherCount: '18',
        groupCount: '12',
      };

      const parsedSchoolAI: Record<string, string | undefined> = {
        cct: '',
        schoolName: 'Bachillerato Oficial Lázaro Cárdenas',
        enrollment: '', // la IA no lo encontró y puso string vacío según prompt
        teacherCount: '   ', // espacios en blanco
      };

      // Invocación directa a la función pura de producción
      const cleanSchoolUpdates = sanitizeSchoolUpdates(parsedSchoolAI);

      expect(cleanSchoolUpdates.enrollment).toBeUndefined();
      expect(cleanSchoolUpdates.teacherCount).toBeUndefined();
      expect(cleanSchoolUpdates.cct).toBeUndefined();
      expect(cleanSchoolUpdates.schoolName).toBe('Bachillerato Oficial Lázaro Cárdenas');

      const mergedSchool = {
        ...existingSchool,
        ...cleanSchoolUpdates,
      };

      expect(mergedSchool.enrollment).toBe('345');
      expect(mergedSchool.teacherCount).toBe('18');
      expect(mergedSchool.cct).toBe('21EBH0001A');
      expect(mergedSchool.schoolName).toBe('Bachillerato Oficial Lázaro Cárdenas');
    });
  });

  // Test 6: Derivación Resiliente y Fallback de UACs Laborales y FFE (F-R3-03 / F-R4-05)
  describe('Test 6: Derivación Resiliente y Fallback de UACs Laborales y FFE (F-R3-03 / F-R4-05)', () => {
    const adminUacs = [
      'Entrega recursos materiales a otras áreas de una organización',
      'Organiza recursos materiales a solicitud de un superior',
      'Captura información solicitada por un superior',
      'Registra entrada y salida del personal de una organización',
      'Aplica encuesta de clima laboral',
      'Registra el desarrollo de eventos',
      'Aplica cuestionario de evaluación del desempeño',
      'Controla expedientes del personal',
    ];

    const contaUacs = [
      'Elabora pólizas de ingresos, egresos y diario',
      'Registra operaciones en libros de contabilidad',
      'Formula estados financieros básicos',
      'Elabora conciliaciones bancarias',
    ];

    it('retorna 100% de UACs asignadas si la selección customizada está vacía (por defecto)', () => {
      const derived = deriveSelectedLaboralUacs(adminUacs, []);
      expect(derived).toEqual(adminUacs);
      expect(derived).toHaveLength(8);
    });

    it('retorna exactamente el subconjunto interactivo elegido por el docente en Multi-PAEC', () => {
      const customSelection = [
        'Entrega recursos materiales a otras áreas de una organización',
        'Organiza recursos materiales a solicitud de un superior',
      ];
      const derived = deriveSelectedLaboralUacs(adminUacs, customSelection);
      expect(derived).toEqual(customSelection);
      expect(derived).toHaveLength(2);
    });

    it('aplica fallback automático al 100% si el usuario cambia de capacitación y la selección previa queda desfasada', () => {
      // El usuario tenía seleccionadas materias de Contabilidad, pero ahora el grupo se configuró con Administración
      const staleContaSelection = [...contaUacs];

      // Al no haber intersección con las UACs asignadas de Administración, aplica fallback a todas las de Administración
      const derived = deriveSelectedLaboralUacs(adminUacs, staleContaSelection);
      expect(derived).toEqual(adminUacs);
      expect(derived).toHaveLength(8);
    });

    it('retorna arreglo vacío si no existen formaciones laborales asignadas en ningún grupo', () => {
      const derived = deriveSelectedLaboralUacs([], ['Cualquier UAC']);
      expect(derived).toEqual([]);
    });

    it('deriva FFE con idéntica resiliencia ante selecciones vacías o desfasadas', () => {
      const ffeUacs = ['Inglés V', 'Inglés VI', 'Dibujo Técnico I', 'Dibujo Técnico II'];
      
      // Vacía -> 100%
      expect(deriveSelectedFfeUacs(ffeUacs, [])).toEqual(ffeUacs);

      // Selección válida
      expect(deriveSelectedFfeUacs(ffeUacs, ['Inglés V'])).toEqual(['Inglés V']);

      // Selección obsoleta sin intersección -> fallback al 100%
      expect(deriveSelectedFfeUacs(ffeUacs, ['Biología Molecular'])).toEqual(ffeUacs);

      // Sin asignaciones -> []
      expect(deriveSelectedFfeUacs([], ['Inglés V'])).toEqual([]);
    });
  });
});



