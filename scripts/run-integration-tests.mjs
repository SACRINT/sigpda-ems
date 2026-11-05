import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Cargar variables de entorno desde .env.local si no están en process.env
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[match[1]] = val;
    }
  }
}

if (!process.env.DATABASE_URL || !process.env.ADMIN_ENCRYPTION_KEY) {
  console.error('\n❌ [test:integration] ERROR CRÍTICO: Variables DATABASE_URL o ADMIN_ENCRYPTION_KEY no encontradas.');
  console.error('El test de integración requiere credenciales reales de Neon DB para ejecutarse de forma segura.\n');
  process.exit(1);
}

process.env.RUN_DB_INTEGRATION = '1';

try {
  execSync('npx vitest run --config vitest.integration.config.mts', {
    stdio: 'inherit',
    env: process.env,
  });
} catch (err) {
  process.exit(err.status || 1);
}
