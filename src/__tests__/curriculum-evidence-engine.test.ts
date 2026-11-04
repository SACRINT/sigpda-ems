/**
 * src/__tests__/curriculum-evidence-engine.test.ts
 * Pruebas del motor determinista de Evidencias Formativas Disciplinares
 * y Producto Integrador Situado (curriculum-evidence-engine.ts).
 *
 * Requisitos verificados:
 * - Derivación funcional de evidencias a partir de progresiones reales (cero lookup estático).
 * - Ninguna evidencia generada es "Ensayo crítico..." para UACs técnicas.
 * - Stemming en español: traza/calcula/modela/argumenta → raíz léxica.
 * - Composición funcional situada: ABP vs STEAM vs Aprendizaje-Servicio producen artefactos y fases distintos.
 * - ID determinista de ProductoIntegrador (sin Date.now()).
 * - DocenteOverride: eliminados, editadas, nuevas.
 * - Módulo puro: sin dependencias de Node.js.
 */

import { describe, it, expect } from 'vitest';
import {
  derivarEvidenciasDisciplinares,
  componerProductoIntegrador,
  normalizarEvidenciasPaso2,
  construirProgresionesResumidas,
  esEvidenciaGenerica,
  requiereDerivacionEvidencias,
} from '@/lib/curriculum-evidence-engine';
import type {
  EvidenciaDisciplinar,
  DocenteOverride,
  ProblemaPAEC,
  MetodologíaActiva,
  ProgresiónResumida,
} from '@/lib/curriculum-evidence-engine';

const problemaPAEC: ProblemaPAEC = {
  texto: 'Falta de áreas verdes y deterioro de espacios de convivencia en el plantel.',
  comunidad: 'Colonel Tito Hernández',
  alcance: 'plantel',
};

const metodologiaABP: MetodologíaActiva = { id: 'abp', nombre: 'Aprendizaje Basado en Proyectos' };
const metodologiaSTEAM: MetodologíaActiva = { id: 'steam', nombre: 'STEAM' };
const metodologiaAS: MetodologíaActiva = { id: 'aprendizaje_servicio', nombre: 'Aprendizaje-Servicio' };

const progresionesDibujoTecnicoI: ProgresiónResumida[] = [
  {
    orden: 1,
    nombre: 'Progresión 1',
    descripcion: 'Traza líneas y formas regulares a mano alzada aplicando la normatividad básica del dibujo técnico.',
    metas: ['Traza líneas rectas y curvas con instrumentos de dibujo', 'Aplica escalas y simbología normalizada'],
    categorias: ['Procedural'],
    subcategorias: ['Elementos de trazo'],
  },
  {
    orden: 2,
    nombre: 'Progresión 2',
    descripcion: 'Realiza dibujos aplicando la normatividad básica a través de la creación de representaciones en dos y tres dimensiones.',
    metas: ['Elabora croquis acotados a escala', 'Proyecciones ortogonales de objetos geométricos'],
    categorias: ['Procedural'],
    subcategorias: ['Representación gráfica'],
  },
];

const progresionesVariacionalI: ProgresiónResumida[] = [
  {
    orden: 1,
    nombre: 'Progresión 1',
    descripcion: 'Modela funciones algebraicas y aplica técnicas aritméticas y funcionales.',
    metas: ['Modela fenómenos de cambio mediante funciones polinomiales', 'Calcula razones de cambio instantáneo'],
    categorias: ['Procedural'],
    subcategorias: ['Modelado matemático'],
  },
  {
    orden: 2,
    nombre: 'Progresión 2',
    descripcion: 'Analiza gráficas y resuelve problemas de optimización de áreas y volúmenes.',
    metas: ['Grafica funciones derivadas', 'Optimiza funciones de costo y beneficio'],
    categorias: ['Procedural'],
    subcategorias: ['Análisis gráfico'],
  },
];

function buildOverride(
  eliminados: string[] = [],
  editadas: Record<string, Partial<EvidenciaDisciplinar>> = {},
  nuevas: EvidenciaDisciplinar[] = []
): DocenteOverride {
  return { eliminados, editadas, nuevas };
}

// ---------------------------------------------------------------------------
// 1. Stemming y derivación: Dibujo Técnico I (no debe haber genéricos)
// ---------------------------------------------------------------------------

describe('Derivación disciplinar — Dibujo Técnico I', () => {
  it('NO genera evidencia genérica tipo "Ensayo crítico" para una UAC técnica', () => {
    const evidencias = derivarEvidenciasDisciplinares(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa');

    const textoConcat = evidencias.map((e) => e.producto + ' ' + e.descripcion).join(' ').toLowerCase();
    expect(textoConcat).not.toContain('ensayo crítico');
    expect(textoConcat).not.toContain('portafolio de evidencias de aprendizaje');
  });

  it('Genera al menos una evidencia tipo croquis o modelo para Dibujo Técnico I', () => {
    const evidencias = derivarEvidenciasDisciplinares(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa');

    const tieneCroquisOModelo = evidencias.some((e) => e.tipo === 'croquis' || e.tipo === 'modelo');
    expect(tieneCroquisOModelo).toBe(true);
  });

  it('Detecta el verbo operativo "trazar" a partir de la conjugación "Traza"', () => {
    const evidencias = derivarEvidenciasDisciplinares(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa');

    const tieneTrazar = evidencias.some((e) => e.verboDisciplinar === 'trazar');
    expect(tieneTrazar).toBe(true);
  });

  it('El producto contiene artefacto concreto de dibujo técnico', () => {
    const evidencias = derivarEvidenciasDisciplinares(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa');

    const productoConcreto = evidencias.some((e) =>
      /lámina|plano|croquis|proyección|trazado/i.test(e.producto)
    );
    expect(productoConcreto).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Derivación disciplinar — Pensamiento Variacional I
// ---------------------------------------------------------------------------

describe('Derivación disciplinar — Pensamiento Variacional I', () => {
  it('Genera al menos una evidencia tipo modelo o reporte', () => {
    const evidencias = derivarEvidenciasDisciplinares(progresionesVariacionalI, 'Taller Pensamiento Variacional I', 'ffeo');

    const tieneModeloOReporte = evidencias.some((e) => e.tipo === 'modelo' || e.tipo === 'reporte');
    expect(tieneModeloOReporte).toBe(true);
  });

  it('Detecta verbos "modelar" y "calcular" a partir de conjugaciones en tercera persona', () => {
    const evidencias = derivarEvidenciasDisciplinares(progresionesVariacionalI, 'Taller Pensamiento Variacional I', 'ffeo');

    const verbos = evidencias.map((e) => e.verboDisciplinar);
    expect(verbos).toContain('modelar');
    expect(verbos).toContain('calcular');
  });
});

// ---------------------------------------------------------------------------
// 3. DocenteOverride
// ---------------------------------------------------------------------------

describe('DocenteOverride', () => {
  it('Elimina evidencias cuyo id esté en eliminados', () => {
    const base = derivarEvidenciasDisciplinares(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa');
    const idAEliminar = base[0].id;

    const override = buildOverride([idAEliminar]);
    const resultado = derivarEvidenciasDisciplinares(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa', override);

    expect(resultado.some((e) => e.id === idAEliminar)).toBe(false);
    expect(resultado.length).toBe(base.length - 1);
  });

  it('Edita el producto de una evidencia existente sin duplicarla', () => {
    const base = derivarEvidenciasDisciplinares(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa');
    const idAEditar = base[0].id;

    const override = buildOverride([], { [idAEditar]: { producto: 'Producto editado por el docente' } });
    const resultado = derivarEvidenciasDisciplinares(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa', override);

    const editada = resultado.find((e) => e.id === idAEditar);
    expect(editada?.producto).toBe('Producto editado por el docente');
    expect(resultado.length).toBe(base.length);
  });

  it('Agrega evidencias nuevas del docente al final con fuente "docente"', () => {
    const base = derivarEvidenciasDisciplinares(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa');
    const nueva: EvidenciaDisciplinar = {
      id: 'nueva-evidencia-docente-1',
      orden: 99,
      tipo: 'bitácora',
      nivelCognitivo: 'aplicar',
      verboDisciplinar: 'registrar',
      producto: 'Bitácora de campo del estudiante',
      descripcion: 'Evidencia agregada por el docente.',
      criterios: ['Registro completo', 'Coherencia con el problema'],
      fuente: 'docente',
      progresionOrigen: 99,
    };

    const override = buildOverride([], {}, [nueva]);
    const resultado = derivarEvidenciasDisciplinares(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa', override);

    expect(resultado.some((e) => e.id === 'nueva-evidencia-docente-1')).toBe(true);
    expect(resultado.some((e) => e.fuente === 'docente')).toBe(true);
    expect(resultado.length).toBe(base.length + 1);
  });
});

// ---------------------------------------------------------------------------
// 4. Composición funcional del Producto Integrador
// ---------------------------------------------------------------------------

describe('Composición funcional — Producto Integrador', () => {
  const evidenciasBase: EvidenciaDisciplinar[] = [
    {
      id: 'dibujo-1-trazar',
      orden: 1,
      tipo: 'croquis',
      nivelCognitivo: 'aplicar',
      verboDisciplinar: 'trazar',
      producto: 'Croquis acotado y dibujo a escala de líneas y formas regulares',
      descripcion: 'Estudiante traza líneas y formas regulares a mano alzada dentro del área dibujo_tecnico.',
      criterios: ['Calidad del trazo', 'Aplicación de escalas'],
      fuente: 'derivada',
      progresionOrigen: 1,
    },
    {
      id: 'dibujo-2-proyectar',
      orden: 2,
      tipo: 'modelo',
      nivelCognitivo: 'crear',
      verboDisciplinar: 'proyectar',
      producto: 'Lámina de proyecciones ortogonales y vistas diédricas de objetos geométricos',
      descripcion: 'Estudiante proyecta representaciones en dos y tres dimensiones.',
      criterios: ['Rigor geométrico', 'Normalización DIN/ISO'],
      fuente: 'derivada',
      progresionOrigen: 2,
    },
  ];

  it('ABP produce artefacto y fases distintos a STEAM con los mismos inputs', () => {
    const pABP = componerProductoIntegrador(evidenciasBase, problemaPAEC, metodologiaABP);
    const pSTEAM = componerProductoIntegrador(evidenciasBase, problemaPAEC, metodologiaSTEAM);

    expect(pABP.artefacto).not.toBe(pSTEAM.artefacto);
    expect(pABP.fases.length).toBe(3);
    expect(pSTEAM.fases.length).toBe(3);
    expect(pABP.fases[0].actividad).not.toBe(pSTEAM.fases[0].actividad);
  });

  it('Aprendizaje-Servicio produce artefacto distinto a ABP y STEAM', () => {
    const pAS = componerProductoIntegrador(evidenciasBase, problemaPAEC, metodologiaAS);
    const pABP = componerProductoIntegrador(evidenciasBase, problemaPAEC, metodologiaABP);

    expect(pAS.artefacto).not.toBe(pABP.artefacto);
    expect(pAS.metodologia.id).toBe('aprendizaje_servicio');
  });

  it('El ID del Producto Integrador es determinista (mismos inputs → mismo id)', () => {
    const p1 = componerProductoIntegrador(evidenciasBase, problemaPAEC, metodologiaABP);
    const p2 = componerProductoIntegrador(evidenciasBase, problemaPAEC, metodologiaABP);

    expect(p1.id).toBe(p2.id);
    expect(p1.id).not.toContain('date');
    expect(p1.id).not.toMatch(/\d{13,}/); // no contiene timestamp de milisegundos
  });

  it('Referencia las IDs de las evidencias usadas', () => {
    const p = componerProductoIntegrador(evidenciasBase, problemaPAEC, metodologiaABP);

    expect(p.evidenciasReferenciadas).toContain('dibujo-1-trazar');
    expect(p.evidenciasReferenciadas).toContain('dibujo-2-proyectar');
    expect(p.criteriosIntegracion.length).toBe(evidenciasBase.length);
  });
});

// ---------------------------------------------------------------------------
// 5. Detección general de evidencias genéricas
// ---------------------------------------------------------------------------

describe('Detección de evidencias genéricas', () => {
  it.each([
    '',
    'Ensayo crítico en la UAC',
    'Portafolio de evidencias de aprendizaje y evaluación formativa',
    'Portafolio de evidencias',
    'Reporte de práctica / Demostración técnica de Administra redes de una organización',
    'Portafolio de desempeño en Redes y Mantenimiento',
    'Portafolio de evidencias de prácticas técnicas y de laboratorio',
    'Reporte técnico de ejecución de competencias laborales',
    'Guía de observación / Rúbrica de desempeño técnico profesional',
    'Evidencia de aprendizaje / Producto',
  ])('Marca como genérica: "%s"', (evidencia) => {
    expect(esEvidenciaGenerica(evidencia)).toBe(true);
  });

  it.each([
    'Proyecto de investigación sobre problemáticas ambientales locales y propuesta de solución',
    'Portafolio de análisis de fuentes históricas documentales e iconográficas',
    'Reporte de práctica de laboratorio de análisis de suelos',
    'Infografía de ciclos biogeoquímicos y su impacto en la comunidad',
  ])('No marca como genérica una evidencia disciplinar: "%s"', (evidencia) => {
    expect(esEvidenciaGenerica(evidencia)).toBe(false);
  });

  it('Requiere derivación si faltan evidencias o alguna es genérica', () => {
    expect(requiereDerivacionEvidencias([])).toBe(true);
    expect(requiereDerivacionEvidencias(undefined)).toBe(true);
    expect(requiereDerivacionEvidencias(['', '   '])).toBe(true);
    expect(requiereDerivacionEvidencias([
      'Proyecto comunitario de alimentación consciente',
      'Portafolio de desempeño en Redes y Mantenimiento',
    ])).toBe(true);
  });

  it('No requiere derivación cuando todas las evidencias son específicas', () => {
    expect(requiereDerivacionEvidencias([
      'Proyecto comunitario de alimentación consciente',
      'Campaña escolar de prevención de adicciones',
    ])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Construcción de progresiones desde contenidos BGE y BT
// ---------------------------------------------------------------------------

describe('construirProgresionesResumidas', () => {
  it('Usa proposito/progresion del formato BGE', () => {
    const progresiones = construirProgresionesResumidas([
      {
        order: 1,
        proposito: 'Analiza el entorno comunitario',
        progresion: 'Progresión 1: Analiza el entorno comunitario y sus problemáticas.',
        metas: ['Analiza datos del entorno'],
      },
    ], []);

    expect(progresiones).toHaveLength(1);
    expect(progresiones[0].descripcion).toContain('Analiza el entorno comunitario');
    expect(progresiones[0].metas).toEqual(['Analiza datos del entorno']);
  });

  it('Usa actividad/saberes del formato de Bachillerato Técnico', () => {
    const progresiones = construirProgresionesResumidas([
      {
        order: 1,
        actividad: 'Administra redes de acuerdo con los requerimientos de la organización',
        saberes: ['Topologías de red', 'Configuración de switches'],
      },
    ], []);

    expect(progresiones[0].descripcion).toContain('Administra redes');
    expect(progresiones[0].descripcion).not.toContain('Progresión 1');
  });

  it('Cae a las actividades clave cuando los contenidos no tienen texto aprovechable', () => {
    const progresiones = construirProgresionesResumidas(
      [{ order: 1, contenidos: [], metas: [] }],
      [{ order: 1, name: 'Elabora un reporte técnico de mantenimiento' }]
    );

    expect(progresiones[0].descripcion).toBe('Elabora un reporte técnico de mantenimiento');
  });

  it('No repite productos cuando varias progresiones comparten metas', () => {
    const progresiones = [
      {
        orden: 1,
        descripcion: 'Realiza representaciones geométricas de objetos',
        metas: ['C1M1. Realiza representaciones geométricas de objetos'],
      },
      {
        orden: 2,
        descripcion: 'Realiza representaciones geométricas de objetos',
        metas: ['C1M1. Realiza representaciones geométricas de objetos'],
      },
    ];
    const evidencias = derivarEvidenciasDisciplinares(progresiones, 'Dibujo Técnico I', 'ffe_optativa');
    const productos = evidencias.map((e) => e.producto.toLowerCase());

    expect(new Set(productos).size).toBe(productos.length);
  });

  it('No confunde palabras cortas como "redes" con el verbo "redactar"', () => {
    const progresiones = construirProgresionesResumidas([
      { actividad: 'Administra redes de una organización' },
    ], []);
    const evidencias = derivarEvidenciasDisciplinares(progresiones, 'Administra redes', 'laboral');

    expect(evidencias[0].verboDisciplinar).not.toBe('redactar');
    expect(evidencias[0].producto).not.toContain('texto argumentativo');
  });

  it('Deriva evidencias específicas para una actividad laboral BT', () => {
    const progresiones = construirProgresionesResumidas([
      { actividad: 'Administra redes de acuerdo con los requerimientos de la organización' },
      { actividad: 'Configura servicios de red para una organización' },
    ], []);
    const evidencias = derivarEvidenciasDisciplinares(progresiones, 'Administra redes', 'laboral');

    expect(evidencias).toHaveLength(2);
    expect(evidencias[0].producto).toContain('redes');
    expect(evidencias[1].producto).toContain('servicios de red');
    expect(evidencias[0].producto).not.toBe(evidencias[1].producto);
  });
});

// ---------------------------------------------------------------------------
// 7. normalizarEvidenciasPaso2
// ---------------------------------------------------------------------------

describe('normalizarEvidenciasPaso2', () => {
  it('Devuelve estructura { evidencias, resumen } con total igual a longitud del arreglo', () => {
    const resultado = normalizarEvidenciasPaso2(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa');

    expect(resultado.evidencias.length).toBeGreaterThan(0);
    expect(resultado.resumen.total).toBe(resultado.evidencias.length);
    expect(resultado.resumen.derivadas).toBe(resultado.evidencias.length);
    expect(resultado.resumen.docente).toBe(0);
    expect(Array.isArray(resultado.resumen.familias)).toBe(true);
  });

  it('Cuenta correctamente evidencias derivadas vs docente con override', () => {
    const base = derivarEvidenciasDisciplinares(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa');
    const nueva: EvidenciaDisciplinar = {
      id: 'docente-nueva-1',
      orden: 99,
      tipo: 'portafolio',
      nivelCognitivo: 'crear',
      verboDisciplinar: 'compilar',
      producto: 'Portafolio de evidencia agregada por docente',
      descripcion: 'Nueva evidencia del docente.',
      criterios: ['Organización', 'Presentación'],
      fuente: 'docente',
      progresionOrigen: 99,
    };

    const override = buildOverride([], {}, [nueva]);
    const resultado = normalizarEvidenciasPaso2(progresionesDibujoTecnicoI, 'Dibujo Técnico I', 'ffe_optativa', override);

    expect(resultado.resumen.total).toBe(base.length + 1);
    expect(resultado.resumen.docente).toBe(1);
    expect(resultado.resumen.derivadas).toBe(base.length);
  });
});
