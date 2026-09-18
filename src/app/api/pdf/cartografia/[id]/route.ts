import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generateCartografiaPDF } from '@/lib/cartografia-pdf-generator';
import { auditCartografiaProject } from '@/lib/cartografia-quality-gate';
import type {
  CartografiaZonaProject,
  CartografiaPlantelItem,
  CartografiaMomento1Conocer,
  CartografiaMomento2Organizar,
  CartografiaMomento3Ubicar,
  CartografiaMomento4Analizar,
  CartografiaMomento5Decidir,
  CartografiaMemoriaPedagogica,
} from '@/types/cartografia';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    const { id } = await params;
    const db = sql();
    const [row] = await db`
      SELECT * FROM pips_projects
      WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
    `;

    if (!row) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Mapeo defensivo a CartografiaZonaProject
    const atpsList = Array.isArray(row.atps)
      ? row.atps
      : typeof row.atps === 'string'
      ? row.atps.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const rawPlanteles = Array.isArray(row.planteles_json) ? (row.planteles_json as Record<string, unknown>[]) : [];
    const planteles: CartografiaPlantelItem[] = rawPlanteles.map((p, idx) => ({
      no: idx + 1,
      cct: String(p.cct || `CCT-${idx + 1}`),
      nombre: String(p.nombre || `Bachillerato ${idx + 1}`),
      localidad: String(p.localidad || 'Comunidad escolar'),
      municipio: String(p.municipio || row.municipio_sede || 'Zona Escolar'),
      turno: String(p.turno || 'MATUTINO'),
      matricula: Number(p.matricula) || Number(p.total) || 0,
      egresados: Number(p.egresados) || 0,
      bajasDefinitivas: Number(p.bajasDefinitivas) || 0,
      eficienciaTerminal: Number(p.eficienciaTerminal) || 85,
      abandono: Number(p.abandono) || 5,
      reprobacion: Number(p.reprobacion) || 8,
      promedioGeneral: Number(p.promedioGeneral) || Number(p.promedioCalificaciones) || 8.0,
      paecProyecto: String(p.paecProyecto || 'Proyecto Comunitario Integrador en proceso'),
      paecProblematica: String(p.paecProblematica || 'Reto socioformativo del entorno local'),
    }));

    const matriculaTotalZona = planteles.reduce((sum, p) => sum + p.matricula, 0);
    const plantelesConMatricula = planteles.filter((p) => p.matricula > 0);
    const divisor = plantelesConMatricula.length > 0 ? plantelesConMatricula.length : (planteles.length || 1);

    const promAbandono = parseFloat((plantelesConMatricula.reduce((a, b) => a + b.abandono, 0) / divisor).toFixed(2));
    const promEficiencia = parseFloat((plantelesConMatricula.reduce((a, b) => a + b.eficienciaTerminal, 0) / divisor).toFixed(2));
    const promAprovechamiento = parseFloat((plantelesConMatricula.reduce((a, b) => a + b.promedioGeneral, 0) / divisor).toFixed(2));
    const promReprobacion = parseFloat((plantelesConMatricula.reduce((a, b) => a + b.reprobacion, 0) / divisor).toFixed(2));

    const plantelesAtencionPrioritaria = planteles
      .filter((p) => p.abandono > promAbandono + 3 || p.eficienciaTerminal < promEficiencia - 5)
      .map((p) => `${p.nombre} (Abandono: ${p.abandono}%, ET: ${p.eficienciaTerminal}%)`);

    const rawProblems = Array.isArray(row.problematicas_json) ? (row.problematicas_json as Record<string, unknown>[]) : [];
    const problematicasComunes = rawProblems.map((pr) => String(pr.titulo || pr.descripcion || '')).filter(Boolean);

    const momento1Conocer: CartografiaMomento1Conocer = {
      planteles,
      matriculaTotalZona,
      municipiosCobertura: [String(row.municipio_sede || 'Puebla'), String(row.municipios_atiende || 'Región Escolar')].filter(Boolean),
      sedesPlanteles: planteles.map((p) => `${p.nombre} [${p.cct}]`),
      caracterizacionInicial: row.diagnostico_contexto || `Zona escolar integrada por ${planteles.length} planteles con una matrícula total atendida de ${matriculaTotalZona} estudiantes.`,
    };

    const momento2Organizar: CartografiaMomento2Organizar = {
      capaCuantitativa: {
        promedioAbandonoZona: promAbandono,
        promedioEficienciaZona: promEficiencia,
        promedioAprovechamientoZona: promAprovechamiento,
        promedioReprobacionZona: promReprobacion,
        matriculaTotal: matriculaTotalZona,
        plantelesAtencionPrioritaria,
        resumenEstadistico911F11: `Análisis consolidado de la Zona Escolar: Abandono ${promAbandono}%, Eficiencia Terminal ${promEficiencia}%, Aprovechamiento ${promAprovechamiento}, Reprobación ${promReprobacion}%.`,
      },
      capaCualitativa: {
        problematicasComunes: problematicasComunes.length > 0 ? problematicasComunes : [
          'Vulnerabilidad económica que impulsa el trabajo estudiantil estacional.',
          'Dificultades de transporte y dispersión geográfica entre comunidades y planteles.',
          'Brechas de conectividad digital e infraestructura tecnológica en hogares rurales.',
        ],
        factoresContextuales: ['Actividades agropecuarias y comerciales predominantes en la región.'],
        vinculacionPaecZona: planteles.map((p) => `${p.nombre}: ${p.paecProyecto} (${p.paecProblematica})`),
        desafiosSocioeconomicos: 'Dispersión territorial y tiempos prolongados de traslado que afectan la permanencia escolar.',
      },
    };

    const momento3Ubicar: CartografiaMomento3Ubicar = (row.momento3_ubicar as CartografiaMomento3Ubicar) || {
      descripcionTerritorial: 'Mapeo contextual en proceso de integración territorial.',
      comunidadesProcedencia: ['Comunidades de influencia de la zona escolar'],
      movilidadTransporte: 'Rutas de transporte terrestre con tiempos variables de traslado.',
      conectividadInfraestructura: 'Conectividad básica disponible en centros escolares.',
      recursosAliados: [
        {
          nombre: 'Centro Comunitario de Salud',
          tipo: 'salud',
          ubicacion: String(row.municipio_sede || 'Cabecera Municipal'),
          vinculacionPedagogica: 'Prevención de riesgos y hábitos saludables',
        },
      ],
      mapaContextual: `Distribución territorial de los ${planteles.length} planteles de la zona.`,
    };

    const momento4Analizar: CartografiaMomento4Analizar = (row.momento4_analizar as CartografiaMomento4Analizar) || {
      triangulacion: {
        directivos: 'Gestión directiva orientada a la permanencia y clima armónico.',
        docentes: 'Retos pedagógicos centrados en la contextualización de progresiones.',
        alumnosFamilias: 'Necesidad de pertinencia social y apoyo a trayectorias educativas.',
        supervisionAtp: 'Acompañamiento situado y asesoría pedagógica continua.',
      },
      patronesRecurrentes: ['Dispersión y necesidades de flexibilización curricular.'],
      retosPedagogicosCreaa: ['Abatir el rezago en habilidades fundamentales de pensamiento.'],
      acuerdosAutonomiaConsejo: ['Intercambio de planeaciones y proyectos integradores situados.'],
    };

    const momento5Decidir: CartografiaMomento5Decidir = (row.momento5_decidir as CartografiaMomento5Decidir) || {
      metaGeneralZona: `Incrementar en 3.5% la permanencia escolar de los estudiantes de la Zona Escolar mediante acompañamiento situado durante el ciclo ${row.ciclo_escolar || '2026-2027'}.`,
      indicadoresCreaaAsociados: ['Eficiencia terminal', 'Abandono escolar', 'Aprobación general'],
      lineasAccion: [
        {
          numero: 1,
          titulo: 'Acompañamiento a la autonomía docente y curricular situada',
          accionesEspecificas: ['Talleres de codiseño curricular y observación dialógica'],
          recursos: ['Fichas formativas DBEPA'],
          responsables: 'Supervisión y Asesores Técnicos',
          entregables: 'Portafolio de secuencias didácticas',
          estrategiaSeguimiento: 'Cortes bimestrales en Consejo Técnico',
          periodoEjecucion: 'Ciclo Escolar 2026-2027',
        },
        {
          numero: 2,
          titulo: 'Acompañamiento directivo para la gestión participativa y clima escolar',
          accionesEspecificas: ['Círculos de liderazgo pedagógico y protocolos de permanencia'],
          recursos: ['Guías de gestión directiva'],
          responsables: 'Supervisión y Directores',
          entregables: 'Diagnóstico de clima escolar y actas de acuerdos',
          estrategiaSeguimiento: 'Reuniones de zona',
          periodoEjecucion: 'Ciclo Escolar 2026-2027',
        },
        {
          numero: 3,
          titulo: 'Acompañamiento integral a las trayectorias formativas y proyectos comunitarios',
          accionesEspecificas: ['Tutoría y seguimiento nominal de estudiantes en riesgo'],
          recursos: ['Formatos PAEC y sistema de alerta'],
          responsables: 'Tutores escolares y comités de vinculación',
          entregables: 'Padrón de seguimiento a trayectorias',
          estrategiaSeguimiento: 'Evaluaciones parciales',
          periodoEjecucion: 'Ciclo Escolar 2026-2027',
        },
      ],
      compromisosSupervision: ['Visitas de acompañamiento situado al 100% de los planteles.'],
    };

    const memoriaPedagogica: CartografiaMemoriaPedagogica | undefined = row.memoria_pedagogica as CartografiaMemoriaPedagogica | undefined;

    const cartografiaProject: CartografiaZonaProject = {
      id,
      zonaNumero: String(row.zona_nombre || '004').replace(/[^0-9]/g, '') || '004',
      zonaClave: String(row.zona_clave || '21FMS0004Z'),
      supervisorName: String(row.supervisor_name || teacher.name || 'Supervisor(a) Escolar'),
      municipioSede: String(row.municipio_sede || 'Puebla'),
      municipiosAtiende: String(row.municipios_atiende || 'Región Escolar'),
      subsistema: String(row.subsistema || 'Bachilleratos Estatales'),
      cicloEscolar: String(row.ciclo_escolar || '2026-2027'),
      atps: atpsList,
      momento1Conocer,
      momento2Organizar,
      momento3Ubicar,
      momento4Analizar,
      momento5Decidir,
      memoriaPedagogica,
      status: (row.status === 'completed' ? 'completed' : 'draft') as 'draft' | 'completed',
    };

    const audit = auditCartografiaProject(cartografiaProject);
    logger.info(`[Cartografia PDF Export] Quality Gate: ${audit.percentage}% (${audit.status}) para proyecto ${id}`);

    const buffer = await generateCartografiaPDF(cartografiaProject);

    const zonaSanitized = (cartografiaProject.zonaNumero || '004').replace(/\s+/g, '_');
    const cicloSanitized = (cartografiaProject.cicloEscolar || '2026-2027').replace(/\s+/g, '_');
    const filename = `Cartografia_Zona_${zonaSanitized}_${cicloSanitized}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'X-Quality-Score': String(audit.percentage),
        'X-Quality-Status': audit.status,
      },
    });
  } catch (error: unknown) {
    logger.error('[API-Cartografia-PDF] Error generando PDF de Cartografía:', error);
    const message = error instanceof Error ? error.message : 'Error al generar el documento PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
