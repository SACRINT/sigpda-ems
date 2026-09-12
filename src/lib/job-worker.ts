/**
 * Background Job Worker para Generación de Libros de Bloque
 * SIGPDA-EMS · DBEPA Puebla MCCEMS 2026-2027
 *
 * Desacopla la orquestación editorial pesada de los límites de tiempo HTTP:
 * 1. Reclama el trabajo atómicamente.
 * 2. Ejecuta el pipeline completo de agentes sin restricción de corte HTTP.
 * 3. Notifica telemetría y persistencia en tiempo real en Neon PostgreSQL.
 * 4. Maneja fallas de forma segura con diagnóstico auditable.
 */

import {
  getGenerationJobById,
  updateGenerationJobProgress,
  completeGenerationJob,
  failGenerationJob,
  saveBlockWorkbook,
  type GenerationJob,
} from '@/lib/db';
import { generateBlockWorkTextbook } from './guide-engine/block-guide-orchestrator';

export async function processGenerationJob(jobId: string): Promise<GenerationJob | null> {
  const job = await getGenerationJobById(jobId);
  if (!job) {
    console.error(`[job-worker] Job ${jobId} no encontrado`);
    return null;
  }

  // Si ya terminó satisfactoriamente, no re-procesar
  if (job.status === 'completed') {
    return job;
  }

  // Marcar en running si estaba en pending
  if (job.status === 'pending') {
    await updateGenerationJobProgress(jobId, {
      status: 'running',
      progress: 5,
      current_phase: 'analyzing',
      current_step: 'Iniciando pipeline de agentes curriculares...',
    });
  }

  console.log(`[job-worker] Procesando job ${jobId} (Planeación: ${job.planning_id}, Bloque: ${job.block_index})...`);

  try {
    // Ejecutar el orquestador editorial completo
    const workbook = await generateBlockWorkTextbook(
      job.planning_id,
      job.block_index,
      {
        jobId,
      }
    );

    // Persistir el workbook en la planeación (versionamiento histórico)
    await saveBlockWorkbook(job.planning_id, job.block_index, workbook).catch((err) =>
      console.warn(`[job-worker] Advertencia al persistir en plannings:`, err?.message)
    );

    // Cascada automática de materiales derivados a planning_extras (24 planes, rúbricas, materiales)
    const { cascadeBlockMaterials } = await import('@/lib/guide-engine/cascade-block-materials');
    await cascadeBlockMaterials(job.planning_id, job.block_index, workbook, job.teacher_id).catch((cascadeErr) =>
      console.warn(`[job-worker] Advertencia en cascada de materiales:`, cascadeErr?.message)
    );

    // Marcar el job como completado
    await completeGenerationJob(jobId, workbook);

    console.log(`[job-worker] Job ${jobId} completado exitosamente con ${workbook.totalWords} palabras.`);

    return await getGenerationJobById(jobId);
  } catch (error: any) {
    const errorMsg = error?.message || String(error) || 'Error desconocido durante la generación';
    console.error(`[job-worker] Falló job ${jobId}:`, error);

    await failGenerationJob(jobId, errorMsg).catch((failErr) =>
      console.error(`[job-worker] No se pudo marcar job como fallido:`, failErr)
    );

    throw error;
  }
}
