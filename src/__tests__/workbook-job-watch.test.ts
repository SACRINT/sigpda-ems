// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_WORKBOOK_JOBS_KEY,
  ACTIVE_WORKBOOK_JOB_MAX_AGE_MS,
  clearActiveWorkbookJob,
  clearActiveWorkbookJobForBlock,
  readActiveWorkbookJobs,
  registerActiveWorkbookJob,
  WORKBOOK_JOBS_CHANGED_EVENT,
} from '@/lib/workbook-job-watch';

describe('workbook-job-watch - persistencia de jobs activos', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it('registra un job y lo recupera con su bloque y planning', () => {
    registerActiveWorkbookJob({
      planningId: 'plan-1',
      blockIndex: 2,
      jobId: 'job-1',
    });

    expect(readActiveWorkbookJobs()).toEqual([
      expect.objectContaining({
        planningId: 'plan-1',
        blockIndex: 2,
        jobId: 'job-1',
      }),
    ]);
  });

  it('reemplaza el job anterior del mismo bloque en lugar de duplicarlo', () => {
    registerActiveWorkbookJob({
      planningId: 'plan-1',
      blockIndex: 0,
      jobId: 'job-old',
    });
    registerActiveWorkbookJob({
      planningId: 'plan-1',
      blockIndex: 0,
      jobId: 'job-new',
    });

    expect(readActiveWorkbookJobs().map((job) => job.jobId)).toEqual(['job-new']);
  });

  it('conserva el registeredAt original al re-registrar el mismo job', () => {
    registerActiveWorkbookJob({
      planningId: 'plan-1',
      blockIndex: 0,
      jobId: 'job-1',
    });
    const firstRegisteredAt = readActiveWorkbookJobs()[0].registeredAt;

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5_000);
    registerActiveWorkbookJob({
      planningId: 'plan-1',
      blockIndex: 0,
      jobId: 'job-1',
    });

    expect(readActiveWorkbookJobs()[0].registeredAt).toBe(firstRegisteredAt);
  });

  it('descarta jobs con más de 2 horas de antigüedad', () => {
    window.localStorage.setItem(
      ACTIVE_WORKBOOK_JOBS_KEY,
      JSON.stringify([
        {
          planningId: 'plan-stale',
          blockIndex: 0,
          jobId: 'job-stale',
          registeredAt: new Date(Date.now() - ACTIVE_WORKBOOK_JOB_MAX_AGE_MS - 1).toISOString(),
        },
        {
          planningId: 'plan-fresh',
          blockIndex: 0,
          jobId: 'job-fresh',
          registeredAt: new Date().toISOString(),
        },
      ])
    );

    expect(readActiveWorkbookJobs().map((job) => job.jobId)).toEqual(['job-fresh']);
  });

  it('ignora JSON inválido o entradas incompletas', () => {
    window.localStorage.setItem(ACTIVE_WORKBOOK_JOBS_KEY, '{invalid');
    expect(readActiveWorkbookJobs()).toEqual([]);

    window.localStorage.setItem(
      ACTIVE_WORKBOOK_JOBS_KEY,
      JSON.stringify([{ planningId: 'plan-1', jobId: 'job-1' }])
    );
    expect(readActiveWorkbookJobs()).toEqual([]);
  });

  it('limpia por jobId y emite el evento de cambio', () => {
    registerActiveWorkbookJob({
      planningId: 'plan-1',
      blockIndex: 0,
      jobId: 'job-1',
    });
    registerActiveWorkbookJob({
      planningId: 'plan-1',
      blockIndex: 1,
      jobId: 'job-2',
    });

    const onChange = vi.fn();
    window.addEventListener(WORKBOOK_JOBS_CHANGED_EVENT, onChange);
    clearActiveWorkbookJob('job-1');
    window.removeEventListener(WORKBOOK_JOBS_CHANGED_EVENT, onChange);

    expect(readActiveWorkbookJobs().map((job) => job.jobId)).toEqual(['job-2']);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('limpia por bloque solo cuando el jobId coincide', () => {
    registerActiveWorkbookJob({
      planningId: 'plan-1',
      blockIndex: 0,
      jobId: 'job-1',
    });

    clearActiveWorkbookJobForBlock('plan-1', 0, 'job-other');
    expect(readActiveWorkbookJobs()).toHaveLength(1);

    clearActiveWorkbookJobForBlock('plan-1', 0, 'job-1');
    expect(readActiveWorkbookJobs()).toHaveLength(0);
  });
});
