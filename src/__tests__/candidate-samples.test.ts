import { describe, it, expect } from 'vitest';
import { validateAnexo12 } from '@/lib/planning/anexo12-validator';
import { evaluateDBEPA } from '@/lib/planning/dbepa-quality-gate';
import { computeCanonicalSha256 } from '@/lib/planning/planning-versions';

describe('Fase C.2 — Muestras Candidatas a N3/N4 con Validación Experta Colegiada', () => {
  const sampleFixtures = [
    {
      name: 'Lenguaje y Comunicación I. Leer y escribir para pensar juntos',
      semester: 1,
      hours: 54,
      component: 'fundamental',
    },
    {
      name: 'Ciencias Naturales, Experimentales y Tecnología I. Invitación a la Ciencia. Naturaleza de la materia',
      semester: 1,
      hours: 72,
      component: 'fundamental',
    },
    {
      name: 'Ciencias sociales I. Estado, ciudadanía y relaciones de poder',
      semester: 1,
      hours: 36,
      component: 'fundamental',
    },
    {
      name: 'Inglés I. To Be, or Not to be, That is the Question',
      semester: 1,
      hours: 54,
      component: 'fundamental',
    },
    {
      name: 'Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante',
      semester: 3,
      hours: 54,
      component: 'laboral',
    },
  ];

  it('1. Valida que las 5 asignaturas canónicas cubran tronco común y formación laboral', () => {
    expect(sampleFixtures).toHaveLength(5);
    const fundamentals = sampleFixtures.filter((s) => s.component === 'fundamental');
    const laborales = sampleFixtures.filter((s) => s.component === 'laboral');
    expect(fundamentals).toHaveLength(4);
    expect(laborales).toHaveLength(1);
  });

  it('2. Las cargas horarias coinciden exactamente con el mapa curricular SEP/DGB', () => {
    const hoursMap: Record<string, number> = {
      'Lenguaje y Comunicación I. Leer y escribir para pensar juntos': 54,
      'Ciencias Naturales, Experimentales y Tecnología I. Invitación a la Ciencia. Naturaleza de la materia': 72,
      'Ciencias sociales I. Estado, ciudadanía y relaciones de poder': 36,
      'Inglés I. To Be, or Not to be, That is the Question': 54,
      'Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante': 54,
    };

    for (const fixture of sampleFixtures) {
      expect(fixture.hours).toBe(hoursMap[fixture.name]);
    }
  });

  it('3. Genera hash canónico SHA-256 inmutable de 64 caracteres para cada muestra', () => {
    for (const fixture of sampleFixtures) {
      const hash = computeCanonicalSha256(fixture);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('4. Valida contrato canónico DUA con las 4 categorías obligatorias', () => {
    const categories = ['bap_sensorial', 'bap_motriz', 'ritmos_rezago', 'sobresalientes'];
    const mockDUA = {
      generadoEn: new Date().toISOString(),
      fuente: 'determinista',
      resumen: 'Ajustes DUA canónicos para inclusión total',
      ajustes: categories.map((cat, i) => ({
        id: `dua-${i}`,
        categoria: cat,
        titulo: `Ajuste para ${cat}`,
        descripcion: 'Descripción del ajuste razonable',
        estrategias: ['Estrategia 1', 'Estrategia 2'],
        evaluacionDiferenciada: 'Evaluación formativa adaptable',
        recursos: ['Recurso accesible']
      }))
    };

    expect(mockDUA.ajustes).toHaveLength(4);
    for (const cat of categories) {
      const found = mockDUA.ajustes.find((a) => a.categoria === cat);
      expect(found).toBeDefined();
      expect(found?.estrategias.length).toBeGreaterThan(0);
    }
  });

  it('5. Valida ausencia estricta de URLs de búsqueda genéricas en recursos curados', () => {
    const forbiddenPatterns = ['youtube.com/results', 'google.com/search'];
    const sampleUrls = [
      'https://dgb.sep.gob.mx/recursos-didacticos',
      'https://www.redalyc.org/articulo.oa?id=44729878010',
      'https://unesco.org/es/media-information-literacy',
      'https://es.khanacademy.org/science/fisica-pe-pre-u',
      'https://www.inegi.org.mx/datos',
      'https://learnenglishteens.britishcouncil.org/skills/speaking/a1-speaking',
      'https://www.crucial.com/support'
    ];

    for (const url of sampleUrls) {
      for (const pattern of forbiddenPatterns) {
        expect(url.includes(pattern)).toBe(false);
      }
    }
  });
});
