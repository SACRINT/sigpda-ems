/**
 * pmc-partitioner.ts
 *
 * Fachada canónica del motor determinista de particionado y extracción de PMC previo (H-216).
 */

export {
  findPlanActionSection,
  countPlanTableRows,
  countDeterministicExpectedActivities,
  checkRawIsTruncated,
  partitionMarkdownDocument,
} from './partitioner/document-scanner';

export {
  deduplicatePlanElements,
  deduplicateMetasPrevias,
  deduplicateStaffData,
  extractDeterministicSupervisorAndZone,
  salvagePlanElementsFromRaw,
} from './partitioner/salvage-and-dedupe';

export {
  extractPmcPreviousWithPartitioning,
  type PartitionedExtractionResult,
} from './partitioner/orchestrator';
