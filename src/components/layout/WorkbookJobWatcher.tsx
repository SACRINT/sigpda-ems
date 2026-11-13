'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  clearActiveWorkbookJob,
  readActiveWorkbookJobs,
  WORKBOOK_JOBS_CHANGED_EVENT,
  type ActiveWorkbookJob,
} from '@/lib/workbook-job-watch';

const BACKGROUND_POLL_MS = 50_000;
const PLANNING_ROUTE_PATTERN = /\/planeacion\/([^/?#]+)/;

interface WatchedJob {
  planningId: string;
  blockIndex: number;
  jobId: string;
  progress: number;
  currentStep?: string;
  nextRetryAt?: string;
}

function planningIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  return pathname.match(PLANNING_ROUTE_PATTERN)?.[1] ?? null;
}

function jobsHandledByPlanningView(
  jobs: ActiveWorkbookJob[],
  pathname: string | null
): ActiveWorkbookJob[] {
  const currentPlanningId = planningIdFromPath(pathname);
  if (!currentPlanningId) return jobs;
  return jobs.filter((job) => job.planningId !== currentPlanningId);
}

export default function WorkbookJobWatcher({ locale }: { locale: string }) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const lastKnownRef = useRef<Record<string, WatchedJob>>({});
  const [visibleJobs, setVisibleJobs] = useState<WatchedJob[]>([]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;
    let rerunRequested = false;
    let controller: AbortController | null = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      if (stopped) return;
      clearTimer();
      if (jobsHandledByPlanningView(readActiveWorkbookJobs(), pathnameRef.current).length === 0) {
        return;
      }

      let nextDelay = BACKGROUND_POLL_MS;
      for (const job of Object.values(lastKnownRef.current)) {
        if (!job.nextRetryAt) continue;
        const retryAtMs = Date.parse(job.nextRetryAt);
        if (!Number.isFinite(retryAtMs)) continue;
        nextDelay = Math.min(
          nextDelay,
          Math.max(1500, retryAtMs - Date.now() + 1000)
        );
      }

      timer = setTimeout(() => {
        void poll();
      }, nextDelay);
    };

    const poll = async () => {
      if (stopped) return;
      if (running) {
        rerunRequested = true;
        return;
      }

      const jobs = jobsHandledByPlanningView(
        readActiveWorkbookJobs(),
        pathnameRef.current
      );
      if (jobs.length === 0) {
        lastKnownRef.current = {};
        setVisibleJobs([]);
        schedule();
        return;
      }

      running = true;
      controller = new AbortController();

      await Promise.all(
        jobs.map(async (job) => {
          try {
            const response = await fetch(
              `/api/planeaciones/${job.planningId}/libro-bloque/status?jobId=${job.jobId}`,
              { signal: controller?.signal, cache: 'no-store' }
            );
            if (response.status === 404) {
              delete lastKnownRef.current[job.jobId];
              clearActiveWorkbookJob(job.jobId);
              return;
            }
            if (!response.ok) return;

            const data = await response.json();
            if (
              !data?.found ||
              data.status === 'completed' ||
              data.status === 'failed' ||
              data.status === 'not_found'
            ) {
              delete lastKnownRef.current[job.jobId];
              clearActiveWorkbookJob(job.jobId);
              return;
            }

            const previous = lastKnownRef.current[job.jobId];
            lastKnownRef.current[job.jobId] = {
              planningId: job.planningId,
              blockIndex: job.blockIndex,
              jobId: job.jobId,
              progress:
                typeof data.progress === 'number' ? data.progress : previous?.progress ?? 0,
              currentStep:
                typeof data.currentStep === 'string'
                  ? data.currentStep
                  : previous?.currentStep,
              nextRetryAt:
                typeof data.nextRetryAt === 'string'
                  ? data.nextRetryAt
                  : undefined,
            };
          } catch {
            // Red intermitente: se conserva el job para el siguiente latido.
          }
        })
      );

      running = false;
      controller = null;

      if (stopped) return;
      const activeJobIds = new Set(jobs.map((job) => job.jobId));
      for (const jobId of Object.keys(lastKnownRef.current)) {
        if (!activeJobIds.has(jobId)) delete lastKnownRef.current[jobId];
      }
      setVisibleJobs(Object.values(lastKnownRef.current));

      if (rerunRequested) {
        rerunRequested = false;
        void poll();
        return;
      }
      schedule();
    };

    const wake = () => {
      if (stopped) return;
      clearTimer();
      void poll();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') wake();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('sigpda:active-workbook-jobs')) {
        wake();
      }
    };

    window.addEventListener(WORKBOOK_JOBS_CHANGED_EVENT, wake);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', onVisibilityChange);

    void poll();

    return () => {
      stopped = true;
      clearTimer();
      controller?.abort();
      window.removeEventListener(WORKBOOK_JOBS_CHANGED_EVENT, wake);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [pathname]);

  if (visibleJobs.length === 0) return null;

  const primary = visibleJobs[0];
  const extraCount = visibleJobs.length - 1;

  return (
    <Link
      prefetch={false}
      href={`/${locale}/planeacion/${primary.planningId}`}
      title={primary.currentStep || 'Libro de bloque en generación'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        maxWidth: 230,
        padding: '5px 10px',
        borderRadius: 999,
        border: '1px solid rgba(59, 130, 246, 0.35)',
        background: 'rgba(59, 130, 246, 0.12)',
        color: '#bfdbfe',
        fontSize: 11,
        fontWeight: 700,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">📘</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        Bloque {primary.blockIndex + 1}: {Math.max(0, Math.min(100, primary.progress))}%
      </span>
      {extraCount > 0 && <span style={{ color: '#93c5fd' }}>+{extraCount}</span>}
    </Link>
  );
}
