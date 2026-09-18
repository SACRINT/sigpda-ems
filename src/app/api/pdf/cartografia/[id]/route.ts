import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { generateCartografiaPDF } from '@/lib/cartografia-pdf-generator';
import { auditCartografiaProject } from '@/lib/cartografia-quality-gate';
import { buildCartografiaBaseContext } from '@/lib/cartografia-context-builder';
import type {
  CartografiaZonaProject,
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

    // Mapeo defensivo a CartografiaZonaProject (Momentos 1 y 2 e Identificación)
    const {
      identificacion,
      planteles,
      momento1: momento1Conocer,
      momento2: momento2Organizar,
    } = buildCartografiaBaseContext(row, teacher);

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
      zonaNumero: identificacion.zonaNumero,
      zonaClave: identificacion.zonaClave,
      supervisorName: identificacion.supervisorName,
      municipioSede: identificacion.municipioSede,
      municipiosAtiende: identificacion.municipiosAtiende,
      subsistema: identificacion.subsistema,
      cicloEscolar: identificacion.cicloEscolar,
      atps: identificacion.atps,
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
