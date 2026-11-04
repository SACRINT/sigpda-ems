import type { PaecOperationalActivity } from '@/types/planning';
import { normalizeUnicode } from '@/lib/utils/normalize';

function cleanSubject(value: string): string {
  return normalizeUnicode(value || '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePaecSubjectKey(value: string): string {
  return cleanSubject(value)
    .replace(/\b(de|del|la|el|los|las|y|en)\b/g, ' ')
    .replace(/\bvi\b/g, '6')
    .replace(/\bv\b/g, '5')
    .replace(/\biv\b/g, '4')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bi\b/g, '1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchPaecSubject(targetUac: string, paecSubject: string): boolean {
  if (!targetUac || !paecSubject) return false;

  const tNorm = cleanSubject(targetUac);
  const pNorm = cleanSubject(paecSubject);
  if (!tNorm || !pNorm) return false;
  if (tNorm === pNorm || tNorm.includes(pNorm) || pNorm.includes(tNorm)) return true;

  const tKey = normalizePaecSubjectKey(targetUac);
  const pKey = normalizePaecSubjectKey(paecSubject);
  if (!tKey || !pKey) return false;
  if (tKey === pKey || tKey.includes(pKey) || pKey.includes(tKey)) return true;

  const tWords = tKey.split(' ').filter((w) => w.length > 3);
  const pWords = pKey.split(' ').filter((w) => w.length > 3);
  if (tWords.length > 0 && pWords.length > 0) {
    const common = tWords.filter((w) => pWords.includes(w));
    if (common.length >= Math.min(2, tWords.length)) return true;
  }

  return false;
}

export function isActivityAnotherSubjectName(
  activity: string,
  subjectNames: string[]
): boolean {
  const activityKey = normalizePaecSubjectKey(activity);
  if (!activityKey) return false;
  return subjectNames.some((subject) => {
    const subjectKey = normalizePaecSubjectKey(subject);
    return Boolean(subjectKey) && subjectKey === activityKey;
  });
}

export function selectPaecOperationalActivity(
  uacName: string,
  planOperativo: PaecOperationalActivity[] | null | undefined
): PaecOperationalActivity | null {
  if (!uacName || !Array.isArray(planOperativo) || planOperativo.length === 0) {
    return null;
  }

  const subjectNames = planOperativo
    .map((item) => (item.asignatura || '').trim())
    .filter(Boolean);

  return (
    planOperativo.find((item) => {
      if (!matchPaecSubject(uacName, item.asignatura)) return false;

      const actividad = (item.actividad || '').trim();
      if (!actividad) return false;
      if (normalizePaecSubjectKey(actividad) === normalizePaecSubjectKey(item.asignatura)) {
        return false;
      }
      if (isActivityAnotherSubjectName(actividad, subjectNames)) return false;

      return true;
    }) || null
  );
}
