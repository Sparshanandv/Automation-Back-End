import { FeatureStatus } from './feature.model'

const NEXT_STATUS: Partial<Record<FeatureStatus, FeatureStatus>> = {
  CREATED:      'QA',
  QA:           'QA_APPROVED',
  QA_APPROVED:  'DEV',
  DEV:          'PLAN_APPROVED',
  PLAN_APPROVED:'CODE_GEN',
  CODE_GEN:     'PR_CREATED',
  PR_CREATED:   'DONE',
}

export function isValidTransition(from: FeatureStatus, to: FeatureStatus): boolean {
  return NEXT_STATUS[from] === to
}

export function getNextStatus(current: FeatureStatus): FeatureStatus | null {
  return NEXT_STATUS[current] ?? null
}
