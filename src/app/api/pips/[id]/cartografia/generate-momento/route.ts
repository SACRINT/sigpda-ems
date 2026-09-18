import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTeacherByEmail, sql } from '@/lib/db';
import { getSubscriptionStatus } from '@/lib/subscription-gate';
import { generateWithRotation, logActivity } from '@/lib/ai-provider';
import { getUserLibraryContext } from '@/lib/context-extractor';
import { parseAIResponse } from '@/lib/ai-response-parser';
import {
  CartografiaMomento3Schema,
  CartografiaMomento4Schema,
  CartografiaMomento5Schema,
  CartografiaMemoriaSchema,
  type CartografiaMomento3DTO,
  type CartografiaMomento4DTO,
  type CartografiaMomento5DTO,
  type CartografiaMemoriaDTO,
} from '@/lib/ai-schemas';
import {
  CARTOGRAFIA_SYSTEM_PROMPT,
  buildMomento3UbicarPrompt,
  buildMomento4AnalizarPrompt,
  buildMomento5DecidirPrompt,
  buildMemoriaPedagogicaPrompt,
  type CartografiaIdentificacion,
} from '@/lib/prompts/cartografia-prompts';
import type {
  CartografiaMomento1Conocer,
  CartografiaMomento2Organizar,
  CartografiaPlantelItem,
} from '@/types/cartografia';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 180;

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteCtx) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const teacher = await getTeacherByEmail(session.user.email);
    if (!teacher) {
      return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });
    }

    // 1. Subscription Gate
    const subStatus = await getSubscriptionStatus(teacher.id, teacher.email);
    if (!subStatus.hasActiveSubscription && !subStatus.isAdmin) {
      return NextResponse.json(
        {
          error:
            'Se requiere una suscripción activa o institucional para generar componentes de la Cartografía de Zona con IA.',
        },
        { status: 403 }
      );
    }

    // 2. Obtener parámetro ?momento=3|4|5|memoria
    const searchParams = req.nextUrl.searchParams;
    const momento = searchParams.get('momento') || '3';

    if (!['3', '4', '5', 'memoria'].includes(momento)) {
      return NextResponse.json(
        { error: `Momento "${momento}" no válido. Valores permitidos: 3, 4, 5, memoria.` },
        { status: 400 }
      );
    }

    const db = sql();
    const [project] = await db`
      SELECT * FROM pips_projects
      WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
    `;

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // 3. Reconstruir datos base de la zona (Momentos 1 y 2)
    const atpsList = Array.isArray(project.atps)
      ? project.atps
      : typeof project.atps === 'string'
      ? project.atps.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const identificacion: CartografiaIdentificacion = {
      zonaNumero: String(project.zona_nombre || '004').replace(/[^0-9]/g, '') || '004',
      zonaClave: project.zona_clave || '21FMS0004Z',
      supervisorName: project.supervisor_name || teacher.name || 'Supervisor Escolar',
      municipioSede: project.municipio_sede || 'Venustiano Carranza',
      municipiosAtiende: project.municipios_atiende || 'Venustiano Carranza, Francisco Z. Mena, Pantepec, Jalpan',
      subsistema: project.subsistema || 'Bachilleratos Estatales',
      cicloEscolar: project.ciclo_escolar || '2026-2027',
      atps: atpsList,
    };

    const rawPlanteles = Array.isArray(project.planteles_json) ? (project.planteles_json as Record<string, unknown>[]) : [];
    const planteles: CartografiaPlantelItem[] = rawPlanteles.map((p, idx: number) => ({
      no: idx + 1,
      cct: String(p.cct || `CCT-${idx + 1}`),
      nombre: String(p.nombre || `Bachillerato ${idx + 1}`),
      localidad: String(p.localidad || 'Comunidad escolar'),
      municipio: String(p.municipio || identificacion.municipioSede),
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

    const rawProblems = Array.isArray(project.problematicas_json) ? (project.problematicas_json as Record<string, unknown>[]) : [];
    const problematicasComunes = rawProblems.map((pr) => String(pr.titulo || pr.descripcion || '')).filter(Boolean);

    const momento1: CartografiaMomento1Conocer = {
      planteles,
      matriculaTotalZona,
      municipiosCobertura: [identificacion.municipioSede, identificacion.municipiosAtiende],
      sedesPlanteles: planteles.map((p) => `${p.nombre} [${p.cct}]`),
      caracterizacionInicial: project.diagnostico_contexto || `Zona escolar ${identificacion.zonaNumero} con ${planteles.length} planteles.`,
    };

    const momento2: CartografiaMomento2Organizar = {
      capaCuantitativa: {
        promedioAbandonoZona: promAbandono,
        promedioEficienciaZona: promEficiencia,
        promedioAprovechamientoZona: promAprovechamiento,
        promedioReprobacionZona: promReprobacion,
        matriculaTotal: matriculaTotalZona,
        plantelesAtencionPrioritaria,
        resumenEstadistico911F11: `Consolidado 911/F11: Abandono ${promAbandono}%, Eficiencia ${promEficiencia}%, Aprovechamiento ${promAprovechamiento}, Reprobación ${promReprobacion}%.`,
      },
      capaCualitativa: {
        problematicasComunes: problematicasComunes.length > 0 ? problematicasComunes : [
          'Vulnerabilidad económica y trabajo estudiantil vespertino o por temporadas.',
          'Dificultades de transporte y dispersión geográfica en comunidades de origen.',
          'Brechas de conectividad digital en planteles y hogares rurales.',
        ],
        factoresContextuales: ['Actividades agropecuarias y comerciales locales predominantes.'],
        vinculacionPaecZona: planteles.map((p) => `${p.nombre}: ${p.paecProyecto}`),
        desafiosSocioeconomicos: 'Dispersión territorial y traslados prolongados que elevan el riesgo de deserción en primeros semestres.',
      },
    };

    // 4. Contexto pedagógico de biblioteca docente
    let libraryContext: string | undefined;
    try {
      libraryContext = await getUserLibraryContext(teacher.id);
    } catch {
      // no-op fallback
    }

    // 5. Construir Prompt según Momento seleccionado
    let prompt = '';
    if (momento === '3') {
      prompt = buildMomento3UbicarPrompt(identificacion, momento1, momento2, libraryContext);
    } else if (momento === '4') {
      prompt = buildMomento4AnalizarPrompt(identificacion, momento1, momento2, project.momento3_ubicar, libraryContext);
    } else if (momento === '5') {
      prompt = buildMomento5DecidirPrompt(
        identificacion,
        momento1,
        momento2,
        project.momento3_ubicar,
        project.momento4_analizar,
        libraryContext
      );
    } else {
      // memoria
      prompt = buildMemoriaPedagogicaPrompt(
        identificacion,
        momento1,
        momento2,
        project.momento5_decidir,
        libraryContext
      );
    }

    logger.info(`[Cartografia-Gen] Iniciando generación de Momento ${momento} para proyecto ${id}...`);

    // 6. Generación con rotación de llaves y reintento
    const rawAiOutput = await generateWithRotation(CARTOGRAFIA_SYSTEM_PROMPT, prompt, teacher.id);

    if (!rawAiOutput || !rawAiOutput.trim()) {
      throw new Error(`La IA no devolvió contenido para el Momento ${momento}.`);
    }

    // 7. Validación defensiva con Zod
    let validatedData: CartografiaMomento3DTO | CartografiaMomento4DTO | CartografiaMomento5DTO | CartografiaMemoriaDTO;

    if (momento === '3') {
      const parsed = parseAIResponse<CartografiaMomento3DTO>(rawAiOutput, CartografiaMomento3Schema, {
        contextName: 'Cartografia Momento 3 (Ubicar)',
      });
      if (!parsed.success) {
        logger.error(`[Cartografia-Gen] Error validando Momento 3: ${parsed.error}`);
        return NextResponse.json({ error: `Validación fallida en Momento 3: ${parsed.error}` }, { status: 422 });
      }
      validatedData = parsed.data;

      // Checkpoint en BD
      await db`
        UPDATE pips_projects
        SET momento3_ubicar = ${JSON.stringify(validatedData)}::jsonb, updated_at = NOW()
        WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
      `;
    } else if (momento === '4') {
      const parsed = parseAIResponse<CartografiaMomento4DTO>(rawAiOutput, CartografiaMomento4Schema, {
        contextName: 'Cartografia Momento 4 (Analizar)',
      });
      if (!parsed.success) {
        logger.error(`[Cartografia-Gen] Error validando Momento 4: ${parsed.error}`);
        return NextResponse.json({ error: `Validación fallida en Momento 4: ${parsed.error}` }, { status: 422 });
      }
      validatedData = parsed.data;

      // Checkpoint en BD
      await db`
        UPDATE pips_projects
        SET momento4_analizar = ${JSON.stringify(validatedData)}::jsonb, updated_at = NOW()
        WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
      `;
    } else if (momento === '5') {
      const parsed = parseAIResponse<CartografiaMomento5DTO>(rawAiOutput, CartografiaMomento5Schema, {
        contextName: 'Cartografia Momento 5 (Decidir)',
      });
      if (!parsed.success) {
        logger.error(`[Cartografia-Gen] Error validando Momento 5: ${parsed.error}`);
        return NextResponse.json({ error: `Validación fallida en Momento 5: ${parsed.error}` }, { status: 422 });
      }
      validatedData = parsed.data;

      // Checkpoint en BD
      await db`
        UPDATE pips_projects
        SET momento5_decidir = ${JSON.stringify(validatedData)}::jsonb, updated_at = NOW()
        WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
      `;
    } else {
      // memoria
      const parsed = parseAIResponse<CartografiaMemoriaDTO>(rawAiOutput, CartografiaMemoriaSchema, {
        contextName: 'Cartografia Memoria Pedagógica',
      });
      if (!parsed.success) {
        logger.error(`[Cartografia-Gen] Error validando Memoria Pedagógica: ${parsed.error}`);
        return NextResponse.json({ error: `Validación fallida en Memoria Pedagógica: ${parsed.error}` }, { status: 422 });
      }
      validatedData = parsed.data;

      // Checkpoint en BD
      await db`
        UPDATE pips_projects
        SET memoria_pedagogica = ${JSON.stringify(validatedData)}::jsonb, updated_at = NOW()
        WHERE id = ${id}::uuid AND teacher_id = ${teacher.id}::uuid
      `;
    }

    // 8. Log de auditoría
    await logActivity({
      teacherEmail: teacher.email,
      action: 'generate_cartografia_momento',
      entityType: 'cartografia_momento',
      entityId: `${id}:${momento}`,
    });

    logger.info(`[Cartografia-Gen] Momento ${momento} generado y persistido con éxito para proyecto ${id}.`);

    return NextResponse.json({
      success: true,
      momento,
      data: validatedData,
    });
  } catch (error: unknown) {
    logger.error('[Cartografia-Gen] Error procesando generación modular:', error);
    const message = error instanceof Error ? error.message : 'Error interno al generar el momento de Cartografía.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
