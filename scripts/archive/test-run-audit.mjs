import { runPedagogicalAudit } from '../src/lib/audit-engine.ts';

console.log('Testing pedagogical audit on planning: 5c91f1ad-c114-46be-a64f-315591bed656');
try {
  const result = await runPedagogicalAudit('5c91f1ad-c114-46be-a64f-315591bed656', {
    isPremium: true
  });
  console.log('AUDIT RESULT SCORE:', result.overall_score);
  console.log('COMPLIANCE LEVEL:', result.compliance_level);
  console.log('DIMENSIONS:', JSON.stringify(result.dimension_scores, null, 2));
  console.log('FINDINGS:', JSON.stringify(result.findings, null, 2));
  console.log('RECOMMENDATIONS:', JSON.stringify(result.recommendations, null, 2));
} catch (err) {
  console.error('Audit test failed:', err);
}
