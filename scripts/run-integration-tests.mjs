import { execSync } from 'child_process';

process.env.RUN_DB_INTEGRATION = '1';

try {
  execSync('npx vitest run --config vitest.integration.config.mts', {
    stdio: 'inherit',
    env: process.env,
  });
} catch (err) {
  process.exit(err.status || 1);
}
