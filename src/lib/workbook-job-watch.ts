export const ACTIVE_WORKBOOK_JOBS_KEY = 'sigpda:active-workbook-jobs:v1';
export const WORKBOOK_JOBS_CHANGED_EVENT = 'sigpda:workbook-jobs-changed';
export const ACTIVE_WORKBOOK_JOB_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export interface ActiveWorkbookJob {
  planningId: string;
  blockIndex: number;
  jobId: string;
  startedAt?: string;
  registeredAt: string;
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isActiveWorkbookJob(value: unknown): value is ActiveWorkbookJob {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.planningId === 'string' &&
    candidate.planningId.length > 0 &&
    typeof candidate.blockIndex === 'number' &&
    Number.isInteger(candidate.blockIndex) &&
    typeof candidate.jobId === 'string' &&
    candidate.jobId.length > 0 &&
    typeof candidate.registeredAt === 'string'
  );
}

function writeJobs(jobs: ActiveWorkbookJob[]): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(ACTIVE_WORKBOOK_JOBS_KEY, JSON.stringify(jobs));
  window.dispatchEvent(new Event(WORKBOOK_JOBS_CHANGED_EVENT));
}

function readRawJobs(): ActiveWorkbookJob[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(ACTIVE_WORKBOOK_JOBS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isActiveWorkbookJob);
  } catch {
    return [];
  }
}

export function readActiveWorkbookJobs(now = Date.now()): ActiveWorkbookJob[] {
  return readRawJobs().filter((job) => {
    const registeredAtMs = Date.parse(job.registeredAt);
    return Number.isFinite(registeredAtMs) && now - registeredAtMs < ACTIVE_WORKBOOK_JOB_MAX_AGE_MS;
  });
}

export function registerActiveWorkbookJob(
  job: Omit<ActiveWorkbookJob, 'registeredAt'>
): void {
  if (!hasStorage()) return;

  const current = readActiveWorkbookJobs();
  const existing = current.find((item) => item.jobId === job.jobId);
  const registeredAt = existing?.registeredAt ?? new Date().toISOString();

  const next = current
    .filter(
      (item) =>
        item.jobId !== job.jobId &&
        !(item.planningId === job.planningId && item.blockIndex === job.blockIndex)
    )
    .concat({
      planningId: job.planningId,
      blockIndex: job.blockIndex,
      jobId: job.jobId,
      ...(job.startedAt ? { startedAt: job.startedAt } : {}),
      registeredAt,
    });

  writeJobs(next);
}

export function clearActiveWorkbookJob(jobId: string): void {
  if (!hasStorage()) return;
  const current = readRawJobs();
  const next = current.filter((item) => item.jobId !== jobId);
  if (next.length !== current.length) writeJobs(next);
}

export function clearActiveWorkbookJobForBlock(
  planningId: string,
  blockIndex: number,
  jobId?: string
): void {
  if (!hasStorage()) return;
  const current = readRawJobs();
  const next = current.filter((item) => {
    if (jobId && item.jobId !== jobId) return true;
    return !(item.planningId === planningId && item.blockIndex === blockIndex);
  });
  if (next.length !== current.length) writeJobs(next);
}
