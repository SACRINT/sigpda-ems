import { describe, it, expect } from 'vitest';
import {
  formatUacCurricularContent,
  formatCurricularCatalogForPrompt,
  matchCurricularContent,
} from '@/lib/paec-curricular-helper';
import type { PaecCatalogItem } from '@/lib/db/programs-catalog';

describe('H-308: Inyección Curricular Real desde Neon DB', () => {
  const mockFundamentalSem1: PaecCatalogItem = {
    uac_name: 'Pensamiento Matemático I',
    semester: 1,
    component: 'fundamental',
    model_type: 'propositos_contenidos',
    contenidos_formativos: [
      {
        numero: 1,
        proposito: 'Discute conceptualmente la necesidad de la toma de decisiones basada en datos.',
        contenidos: ['Concepto de variable', 'Datos cuantitativos y cualitativos'],
      },
      {
        numero: 2,
        proposito: 'Identifica la incertidumbre como consecuencia de la variabilidad.',
        contenidos: ['Muestreo aleatorio', 'Frecuencias'],
      },
    ],
  };

  const mockFundamentalSem5: PaecCatalogItem = {
    uac_name: 'La Energía en los Procesos de la Vida Diaria',
    semester: 5,
    component: 'fundamental',
    model_type: 'progresiones',
    contenidos_formativos: [
      {
        numero: 1,
        progresion: 'Relación entre energía y fuerzas en interacciones materiales cotidianas.',
        contenidos: [],
      },
      {
        numero: 2,
        progresion: 'El movimiento de un objeto está determinado por la suma de las fuerzas que actúan sobre él.',
        contenidos: [],
      },
    ],
  };

  const mockLaboral: PaecCatalogItem = {
    uac_name: 'INSTALACIONES RESIDENCIALES',
    semester: 3,
    component: 'laboral',
    model_type: 'competencias_laborales',
    contenidos_formativos: [
      {
        numero: 1,
        actividad: 'Instala circuitos eléctricos básicos conforme a la NOM-001-SEDE.',
        saberes: ['Seguridad eléctrica', 'Diagramas unifilares', 'Canalización'],
      },
      {
        numero: 2,
        actividad: 'Realiza el mantenimiento correctivo a sistemas de iluminación.',
        saberes: ['Multímetro', 'Aislamiento', 'Normas de protección'],
      },
    ],
  };

  const mockWithoutCf: PaecCatalogItem = {
    uac_name: 'Materia Sin Contenido Aún',
    semester: 4,
    component: 'fundamental',
    contenidos_formativos: null,
  };

  it('formatea asignaturas de 1.º a 4.º fundamental usando "Propósitos Formativos"', () => {
    const formatted = formatUacCurricularContent(mockFundamentalSem1);
    expect(formatted).toContain('Pensamiento Matemático I (Semestre 1, Propósitos Formativos):');
    expect(formatted).toContain('* Propósito 1: Discute conceptualmente la necesidad');
    expect(formatted).toContain('[Contenidos: Concepto de variable, Datos cuantitativos y cualitativos]');
    expect(formatted).toContain('* Propósito 2: Identifica la incertidumbre');
    expect(formatted).not.toContain('Progresión');
    expect(formatted).not.toContain('Actividad Clave');
  });

  it('formatea asignaturas de 5.º y 6.º fundamental usando "Progresiones de Aprendizaje"', () => {
    const formatted = formatUacCurricularContent(mockFundamentalSem5);
    expect(formatted).toContain('La Energía en los Procesos de la Vida Diaria (Semestre 5, Progresiones de Aprendizaje):');
    expect(formatted).toContain('* Progresión 1: Relación entre energía y fuerzas');
    expect(formatted).toContain('* Progresión 2: El movimiento de un objeto está determinado');
    expect(formatted).not.toContain('Propósito');
    expect(formatted).not.toContain('Actividad Clave');
  });

  it('formatea asignaturas de formación laboral usando "Actividades Clave y Saberes"', () => {
    const formatted = formatUacCurricularContent(mockLaboral);
    expect(formatted).toContain('INSTALACIONES RESIDENCIALES (Semestre 3, Formación Laboral — Actividades Clave):');
    expect(formatted).toContain('* Actividad Clave 1: Instala circuitos eléctricos básicos');
    expect(formatted).toContain('(Saberes: Seguridad eléctrica; Diagramas unifilares; Canalización)');
    expect(formatted).toContain('* Actividad Clave 2: Realiza el mantenimiento correctivo');
  });

  it('emite guardia técnica anti-alucinación B-001 si los contenidos formativos son nulos o vacíos', () => {
    const formatted = formatUacCurricularContent(mockWithoutCf);
    expect(formatted).toContain('[DATO CURRICULAR PENDIENTE DE VALIDACIÓN — CITAR TEMAS GENERALES DEL PROGRAMA VIGENTE]');
  });

  it('empaqueta el catálogo curricular completo con encabezado de restricción estricta', () => {
    const catalog = [mockFundamentalSem1, mockFundamentalSem5, mockLaboral];
    const promptBlock = formatCurricularCatalogForPrompt(catalog);

    expect(promptBlock).toContain('### CATÁLOGO CURRICULAR OFICIAL VERIFICADO (NEON DB):');
    expect(promptBlock).toContain('Utiliza OBLIGATORIAMENTE los siguientes propósitos formativos, progresiones o actividades clave REALES');
    expect(promptBlock).toContain('Pensamiento Matemático I');
    expect(promptBlock).toContain('La Energía en los Procesos de la Vida Diaria');
    expect(promptBlock).toContain('INSTALACIONES RESIDENCIALES');
  });

  it('hace matching insensible a mayúsculas, acentos y espacios', () => {
    const catalog = [mockFundamentalSem1, mockFundamentalSem5, mockLaboral];

    // Con acento vs sin acento
    const match1 = matchCurricularContent('pensamiento matematico i', 1, catalog);
    expect(match1?.uac_name).toBe('Pensamiento Matemático I');

    // Mayúsculas vs minúsculas
    const match2 = matchCurricularContent('LA ENERGÍA EN LOS PROCESOS DE LA VIDA DIARIA', 5, catalog);
    expect(match2?.uac_name).toBe('La Energía en los Procesos de la Vida Diaria');

    // Coincidencia parcial
    const match3 = matchCurricularContent('Instalaciones Residenciales', 3, catalog);
    expect(match3?.uac_name).toBe('INSTALACIONES RESIDENCIALES');
  });
});
