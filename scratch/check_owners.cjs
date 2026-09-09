const fs = require('fs');
const { neon } = require('@neondatabase/serverless');

const envContent = fs.readFileSync('c:/Proyectos_SACRINT/Proyecto_SIGPDA_EMS/SIGPDA_EMS/.env.local', 'utf-8');
const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
const sql = neon(match[1]);

async function main() {
  await sql`
    UPDATE plannings 
    SET teacher_id = 'd6af9fe9-5256-46a2-a160-7ee6afa63fb8' 
    WHERE id = '6a025380-c019-4f2a-84ec-3a6f098b874f'
  `;
  console.log('Updated planning teacher_id to Samuel CI');
  const plannings = await sql`
    SELECT p.id, p.uac_name, p.teacher_id, t.email, t.name 
    FROM plannings p 
    JOIN teachers t ON t.id = p.teacher_id
    ORDER BY p.created_at DESC
  `;
  console.log(JSON.stringify(plannings, null, 2));
}

main().catch(console.error);
