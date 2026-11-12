import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Cargar DATABASE_URL desde process.env o .env.local
const dbUrl = (() => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      const line = lines.find((l) => l.trim().startsWith('DATABASE_URL='));
      if (line) {
        return line.replace(/^DATABASE_URL=/, '').trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
})();

describe('Auditoría Integral de Calidad y Cierre en Base de Datos Real (Neon DB)', () => {
  let sql: NeonQueryFunction<false, false>;

  beforeAll(() => {
    if (!dbUrl) {
      throw new Error('DATABASE_URL no configurada para live-database-quality-audit.test.ts');
    }
    sql = neon(dbUrl);
  });

  // --------------------------------------------------------------------------
  // 1. Verificación BGE Laboral: 15 Carreras, 120 UACs
  // --------------------------------------------------------------------------
  describe('1. BGE Laboral: 120 UACs sin saberes vacíos y sin plantillas genéricas', () => {
    it('Existen exactamente 120 UACs laborales de BGE en programs_catalog', async () => {
      const rows = await sql`
        SELECT id, uac_name, contenidos_formativos, activities
        FROM programs_catalog
        WHERE subsystem = 'bge' AND component = 'laboral'
      `;
      expect(rows.length).toBe(120);
    });

    it('0 UACs de BGE laboral contienen la plantilla genérica en temas', async () => {
      const rows = await sql`
        SELECT id, uac_name
        FROM programs_catalog
        WHERE subsystem = 'bge' AND component = 'laboral'
          AND (
            contenidos_formativos::text LIKE '%Fundamentos técnicos y normativos de%'
            OR activities::text LIKE '%Fundamentos técnicos y normativos de%'
            OR contenidos_formativos::text LIKE '%Prácticas estándar de aplicación para%'
          )
      `;
      expect(rows.length).toBe(0);
    });

    it('0 UACs de BGE laboral tienen saberes vacíos ([]) en contenidos_formativos o activities', async () => {
      const rows = await sql`
        SELECT id, uac_name, contenidos_formativos, activities
        FROM programs_catalog
        WHERE subsystem = 'bge' AND component = 'laboral'
      `;

      let emptySaberesContenidos = 0;
      let emptySaberesActivities = 0;

      for (const row of rows) {
        const contenidos = typeof row.contenidos_formativos === 'string'
          ? JSON.parse(row.contenidos_formativos)
          : row.contenidos_formativos;

        if (Array.isArray(contenidos)) {
          for (const c of contenidos) {
            if (Array.isArray(c.saberes) && c.saberes.length === 0) emptySaberesContenidos++;
            if (!c.saberes || (!c.saberes.saber && !c.saberes.conceptual)) emptySaberesContenidos++;
          }
        }

        const activities = typeof row.activities === 'string'
          ? JSON.parse(row.activities)
          : row.activities;

        if (Array.isArray(activities)) {
          for (const a of activities) {
            if (Array.isArray(a.saberes) && a.saberes.length === 0) emptySaberesActivities++;
            if (!a.saberes || (!a.saberes.saber && !a.saberes.conceptual)) emptySaberesActivities++;
          }
        }
      }

      expect(emptySaberesContenidos).toBe(0);
      expect(emptySaberesActivities).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Verificación FFEO: 8 UACs
  // --------------------------------------------------------------------------
  describe('2. FFEO: 8 UACs sin plantillas genéricas epistemológicas', () => {
    it('Existen exactamente 8 UACs en component = ffeo', async () => {
      const rows = await sql`
        SELECT id, uac_name
        FROM programs_catalog
        WHERE component = 'ffeo'
      `;
      expect(rows.length).toBe(8);
    });

    it('0 UACs de FFEO contienen "Fundamentos epistemológicos y conceptuales de"', async () => {
      const rows = await sql`
        SELECT id, uac_name
        FROM programs_catalog
        WHERE component = 'ffeo'
          AND (
            contenidos_formativos::text LIKE '%Fundamentos epistemológicos y conceptuales de%'
            OR activities::text LIKE '%Fundamentos epistemológicos y conceptuales de%'
          )
      `;
      expect(rows.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Verificación FFE Optativas: 40 UACs con metas y categorías pobladas
  // --------------------------------------------------------------------------
  describe('3. FFE Optativas: 40 UACs con metas y categorías MCCEMS', () => {
    it('Existen 40 UACs en component = ffe_optativa', async () => {
      const rows = await sql`
        SELECT id, uac_name, contenidos_formativos, activities
        FROM programs_catalog
        WHERE component = 'ffe_optativa'
      `;
      expect(rows.length).toBe(40);
    });

    it('0 UACs de optativas tienen metas o categorías vacías ([]) en sus progresiones', async () => {
      const rows = await sql`
        SELECT id, uac_name, contenidos_formativos, activities
        FROM programs_catalog
        WHERE component = 'ffe_optativa'
      `;

      let emptyMetas = 0;
      let emptyCategorias = 0;

      for (const row of rows) {
        const cfs = typeof row.contenidos_formativos === 'string'
          ? JSON.parse(row.contenidos_formativos)
          : (row.contenidos_formativos || []);

        for (const cf of cfs) {
          if (!Array.isArray(cf.metas) || cf.metas.length === 0) emptyMetas++;
          if (!Array.isArray(cf.categorias) || cf.categorias.length === 0) emptyCategorias++;
        }
      }

      expect(emptyMetas).toBe(0);
      expect(emptyCategorias).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Verificación Bachillerato Tecnológico: 38 Submódulos
  // --------------------------------------------------------------------------
  describe('4. Bachillerato Tecnológico: 0 submódulos con saberes vacíos', () => {
    it('0 submódulos laborales tecnológicos tienen saberes: []', async () => {
      const rows = await sql`
        SELECT id, uac_name, contenidos_formativos
        FROM programs_catalog
        WHERE subsystem = 'tecnologico' AND component = 'laboral'
      `;

      let emptySaberesCount = 0;

      for (const row of rows) {
        const contenidos = typeof row.contenidos_formativos === 'string'
          ? JSON.parse(row.contenidos_formativos)
          : row.contenidos_formativos;

        if (Array.isArray(contenidos)) {
          for (const c of contenidos) {
            if (Array.isArray(c.saberes) && c.saberes.length === 0) emptySaberesCount++;
          }
        }
      }

      expect(emptySaberesCount).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Verificación de las 5 Muestras Canónicas y sus 270 Sesiones
  // --------------------------------------------------------------------------
  describe('5. Muestras Canónicas: 270 Sesiones Reales (54/72/36/54/54) y 270 Planes Diarios', () => {
    const canonicalUACs = [
      { name: 'Lenguaje y Comunicación I. Leer y escribir para pensar juntos', hours: 54 },
      { name: 'Ciencias Naturales, Experimentales y Tecnología I. Invitación a la Ciencia. Naturaleza de la materia', hours: 72 },
      { name: 'Ciencias sociales I. Estado, ciudadanía y relaciones de poder', hours: 36 },
      { name: 'Inglés I. To Be, or Not to be, That is the Question', hours: 54 },
      { name: 'Actualiza equipos de cómputo de acuerdo con especificaciones del fabricante', hours: 54 },
    ];

    it('Las 5 planeaciones canónicas existen en la tabla plannings con paridad exacta de sesiones', async () => {
      let totalSessionsSum = 0;

      for (const sample of canonicalUACs) {
        const rows = await sql`
          SELECT id, uac_name, content_json, sequence_json, workbooks_json
          FROM plannings
          WHERE uac_name = ${sample.name}
          ORDER BY updated_at DESC
          LIMIT 1
        `;

        expect(rows.length).toBe(1);
        const p = rows[0];

        // Content JSON
        const content = typeof p.content_json === 'string' ? JSON.parse(p.content_json) : p.content_json;
        const totalHours = Number(content.sectionI?.totalHours || content.totalHours);
        expect(totalHours).toBe(sample.hours);

        // Sequence JSON sessions (bloques 0, 1, 2)
        const seq = typeof p.sequence_json === 'string' ? JSON.parse(p.sequence_json) : p.sequence_json;
        const seqSessions =
          (seq['0']?.sessions?.length || 0) +
          (seq['1']?.sessions?.length || 0) +
          (seq['2']?.sessions?.length || 0);
        expect(seqSessions).toBe(sample.hours);
        totalSessionsSum += seqSessions;

        // Workbooks JSON sessions (block_0, block_1, block_2 -> missions -> sessionPlans)
        const wb = typeof p.workbooks_json === 'string' ? JSON.parse(p.workbooks_json) : p.workbooks_json;
        const countWbSessions = (blockObj: any) => {
          if (!blockObj?.current?.missions) return 0;
          return blockObj.current.missions.reduce((acc: number, m: any) => acc + (m.sessionPlans?.length || 0), 0);
        };
        const wbSessions =
          countWbSessions(wb.block_0) +
          countWbSessions(wb.block_1) +
          countWbSessions(wb.block_2);
        expect(wbSessions).toBe(sample.hours);

        // Anexo 12 Audit: 100 y 0 críticas
        const anexo12 = content.anexo12Audit;
        expect(anexo12.score).toBe(100);
        expect(anexo12.criticalFailures).toBe(0);

        // DBEPA Audit: semáforo verde
        const dbepa = content.dbepaAudit;
        expect(dbepa.semaforo).toBe('verde');
      }

      expect(totalSessionsSum).toBe(270);
    });

    it('Existen exactamente 270 planes de clase individuales en planning_extras (54/72/36/54/54)', async () => {
      let totalExtrasPlans = 0;

      for (const sample of canonicalUACs) {
        const pRows = await sql`
          SELECT id FROM plannings WHERE uac_name = ${sample.name} ORDER BY updated_at DESC LIMIT 1
        `;
        const planningId = pRows[0].id;

        const extraRows = await sql`
          SELECT COUNT(*)::int as count
          FROM planning_extras
          WHERE planning_id = ${planningId} AND type = 'lesson_plan'
        `;

        const planCount = Number(extraRows[0].count);
        expect(planCount).toBe(sample.hours);
        totalExtrasPlans += planCount;
      }

      expect(totalExtrasPlans).toBe(270);
    });

    it('0 URLs de búsqueda genéricas en workbooks_json de las 5 muestras', async () => {
      for (const sample of canonicalUACs) {
        const rows = await sql`
          SELECT workbooks_json::text as wb_str
          FROM plannings
          WHERE uac_name = ${sample.name}
          ORDER BY updated_at DESC
          LIMIT 1
        `;
        const wbStr = rows[0].wb_str;
        expect(wbStr.includes('youtube.com/results')).toBe(false);
        expect(wbStr.includes('google.com/search')).toBe(false);
      }
    });

    it('0 textos genéricos de modelado docente en workbooks_json de las 5 muestras', async () => {
      const genericModelado = 'El docente realiza el modelado procedimental explícito ante el grupo';

      for (const sample of canonicalUACs) {
        const rows = await sql`
          SELECT workbooks_json::text as wb_str
          FROM plannings
          WHERE uac_name = ${sample.name}
          ORDER BY updated_at DESC
          LIMIT 1
        `;
        const wbStr = rows[0].wb_str;
        expect(wbStr.includes(genericModelado)).toBe(false);
      }
    });

    it('0 plantillas genéricas en los planes de clase de planning_extras', async () => {
      const genericApertura = 'Activación de conocimientos previos y presentación de la consigna';
      const genericDesarrollo = 'Trabajo colaborativo guiado y aplicación práctica';
      const genericCierre = 'Evaluación formativa, síntesis y retroalimentación colectiva';

      for (const sample of canonicalUACs) {
        const pRows = await sql`
          SELECT id FROM plannings WHERE uac_name = ${sample.name} ORDER BY updated_at DESC LIMIT 1
        `;
        const planningId = pRows[0].id;

        const rows = await sql`
          SELECT content_text
          FROM planning_extras
          WHERE planning_id = ${planningId} AND type = 'lesson_plan'
        `;

        for (const r of rows) {
          const text = r.content_text || '';
          expect(text.includes(genericApertura)).toBe(false);
          expect(text.includes(genericDesarrollo)).toBe(false);
          expect(text.includes(genericCierre)).toBe(false);
        }
      }
    });
  });
});
