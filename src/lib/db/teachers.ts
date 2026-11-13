import { sql } from './client';

// ─── Teacher queries ────────────────────────────────────────────────────────

export async function getTeacherByEmail(email: string) {
  const rows = await sql()`
    SELECT id, name, email, school_name, municipality, subsystem, cct,
           custom_api_key, custom_api_provider, role, created_at,
           profile_completed, school_locked, is_blocked, is_premium, password_hash
    FROM teachers
    WHERE email = ${email.toLowerCase().trim()}
    LIMIT 1
  `;
  const teacher = rows[0] || null;
  if (teacher && teacher.custom_api_key) {
    const { decryptKey } = await import('@/lib/ai-provider/key-rotator');
    teacher.custom_api_key = decryptKey(teacher.custom_api_key);
  }
  return teacher;
}

/**
 * Zona escolar del docente: horario_config.zona_escolar → custom_preferences.zonaEscolar/zona.
 * Devuelve el valor crudo ('086', 'Zona 086', …) o null si no está configurado.
 */
export async function getTeacherSchoolZone(teacherId: string): Promise<string | null> {
  try {
    const rows = await sql()`
      SELECT h.zona_escolar AS horario_zone,
             t.custom_preferences->>'zonaEscolar' AS prefs_zone,
             t.custom_preferences->>'zona' AS prefs_zona
      FROM teachers t
      LEFT JOIN horario_config h ON h.teacher_id = t.id
      WHERE t.id = ${teacherId}::uuid
      LIMIT 1
    `;
    const r = rows[0];
    return r?.horario_zone || r?.prefs_zone || r?.prefs_zona || null;
  } catch {
    return null;
  }
}

export async function getTeacherById(id: string) {
  const rows = await sql()`
    SELECT id, name, email, school_name, municipality, subsystem, cct,
           custom_api_key, custom_api_provider, role, created_at,
           profile_completed, school_locked, is_blocked, is_premium
    FROM teachers
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  const teacher = rows[0] || null;
  if (teacher && teacher.custom_api_key) {
    const { decryptKey } = await import('@/lib/ai-provider/key-rotator');
    teacher.custom_api_key = decryptKey(teacher.custom_api_key);
  }
  return teacher;
}

export async function createTeacherWithPassword(data: {
  name: string;
  email: string;
  passwordHash: string;
  schoolName?: string;
  cct?: string;
  municipality?: string;
  subsystem?: string;
  role?: string;
}) {
  const cleanEmail = data.email.toLowerCase().trim();
  const rows = await sql()`
    INSERT INTO teachers (
      name, email, password_hash, school_name, cct,
      municipality, subsystem, role, profile_completed
    ) VALUES (
      ${data.name.trim()},
      ${cleanEmail},
      ${data.passwordHash},
      ${data.schoolName?.trim() || null},
      ${data.cct?.toUpperCase().trim() || null},
      ${data.municipality?.trim() || null},
      ${data.subsystem?.toLowerCase().trim() || 'bge'},
      ${data.role || 'docente'},
      TRUE
    )
    RETURNING id, name, email, role, school_name, cct, subsystem, created_at
  `;
  return rows[0];
}

export async function setTeacherResetToken(email: string, token: string, expires: Date) {
  const rows = await sql()`
    UPDATE teachers
    SET reset_token = ${token}, reset_token_expires = ${expires.toISOString()}
    WHERE email = ${email.toLowerCase().trim()}
    RETURNING id, email
  `;
  return rows[0] || null;
}

export async function verifyAndResetPassword(token: string, newPasswordHash: string) {
  const rows = await sql()`
    UPDATE teachers
    SET
      password_hash = ${newPasswordHash},
      reset_token = NULL,
      reset_token_expires = NULL,
      updated_at = NOW()
    WHERE reset_token = ${token}
      AND reset_token_expires > NOW()
    RETURNING id, email, name
  `;
  return rows[0] || null;
}

export async function updateTeacherKey(teacherId: string, customApiKey: string | null, customApiProvider: string | null) {
  let encryptedKey = customApiKey;
  if (customApiKey) {
    const { encryptKey } = await import('@/lib/ai-provider/key-rotator');
    encryptedKey = encryptKey(customApiKey);
  }
  const rows = await sql()`
    UPDATE teachers
    SET
      custom_api_key = ${encryptedKey},
      custom_api_provider = ${customApiProvider}
    WHERE id = ${teacherId}::uuid
    RETURNING id, email, custom_api_provider
  `;
  return rows[0];
}

export async function createTeacher(data: {
  name: string;
  email: string;
  schoolName?: string;
  municipality?: string;
  subsystem?: string;
}) {
  const rows = await sql()`
    INSERT INTO teachers (name, email, school_name, municipality, subsystem)
    VALUES (${data.name}, ${data.email.toLowerCase().trim()}, ${data.schoolName || null}, ${data.municipality || null}, ${data.subsystem || null})
    RETURNING id, name, email, school_name, municipality, subsystem, created_at
  `;
  return rows[0];
}

export async function upsertTeacher(data: {
  name: string;
  email: string;
}) {
  const cleanEmail = data.email.toLowerCase().trim();
  const rows = await sql()`
    INSERT INTO teachers (name, email)
    VALUES (${data.name}, ${cleanEmail})
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, name, email, school_name, municipality, subsystem, is_blocked, created_at
  `;
  return rows[0];
}

export async function updateTeacherProfile(teacherId: string, data: {
  schoolName?: string;
  municipality?: string;
  subsystem?: string;
  cct?: string;
}) {
  const rows = await sql()`
    UPDATE teachers
    SET
      school_name = COALESCE(${data.schoolName || null}, school_name),
      municipality = COALESCE(${data.municipality || null}, municipality),
      subsystem = COALESCE(${data.subsystem || null}, subsystem),
      cct = COALESCE(${data.cct || null}, cct),
      profile_completed = TRUE,
      updated_at = NOW()
    WHERE id = ${teacherId}::uuid
    RETURNING *
  `;
  return rows[0];
}

export interface TeacherAuthSnapshot {
  id: string;
  email: string;
  role: string;
  school_name: string | null;
  cct: string | null;
  subsystem: string | null;
  profile_completed: boolean;
  is_blocked: boolean;
  is_premium: boolean;
  has_active_subscription: boolean;
  is_admin: boolean;
  planning_count: number;
}

/**
 * Snapshot ligero para hidratar el JWT sin descifrar custom_api_key.
 * Se ejecuta como máximo una vez por TTL de sesión o tras update().
 */
export async function getTeacherAuthSnapshot(email: string): Promise<TeacherAuthSnapshot | null> {
  const rows = await sql()`
    SELECT t.id, t.email, t.role, t.school_name, t.cct, t.subsystem,
           t.profile_completed, t.is_blocked, t.is_premium,
           EXISTS (
             SELECT 1 FROM subscriptions s
             WHERE s.teacher_id = t.id AND s.status IN ('active', 'trialing')
           ) AS has_active_subscription,
           (
             t.role IN ('administrador', 'admin')
             OR EXISTS (SELECT 1 FROM admins a WHERE LOWER(a.email) = LOWER(t.email))
           ) AS is_admin,
           (SELECT COUNT(*)::int FROM plannings p WHERE p.teacher_id = t.id) AS planning_count
    FROM teachers t
    WHERE t.email = ${email.toLowerCase().trim()}
    LIMIT 1
  `;
  return (rows[0] as TeacherAuthSnapshot) || null;
}

export async function getTeacherIdByEmail(email: string): Promise<string | null> {
  const rows = await sql()`
    SELECT id FROM teachers
    WHERE email = ${email.toLowerCase().trim()}
    LIMIT 1
  `;
  return (rows[0]?.id as string) || null;
}

/**
 * Actualiza la última actividad real del docente (login / acciones relevantes).
 * No se invoca por latido periódico.
 */
export async function touchTeacherLastSeen(teacherId: string): Promise<void> {
  if (!teacherId) return;
  await sql()`
    UPDATE teachers SET last_seen_at = NOW()
    WHERE id = ${teacherId}::uuid
  `;
}
