import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const sample = await sql`
  SELECT 
    p.id, 
    p.teacher_id, 
    p.uac_name, 
    p.semester, 
    p.component, 
    p.curriculum_name,
    p.status,
    p.created_at,
    t.name as teacher_name,
    t.email as teacher_email,
    t.school_name,
    a.id as audit_id,
    a.overall_score,
    a.compliance_level,
    a.dimension_scores,
    a.created_at as audited_at
  FROM plannings p
  LEFT JOIN teachers t ON p.teacher_id = t.id
  LEFT JOIN audit_results a ON a.planning_id = p.id
  LIMIT 5
`;
console.log('Sample plannings:', JSON.stringify(sample, null, 2));
