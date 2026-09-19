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
    RETURNING id, name, email, school_name, municipality, subsystem, created_at
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
