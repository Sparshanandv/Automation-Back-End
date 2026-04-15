import { FeatureStatus, FeatureStatusEnum } from './feature.model'

const NEXT_STATUS: Partial<Record<FeatureStatus, FeatureStatus>> = {
    [FeatureStatusEnum.CREATED]: FeatureStatusEnum.QA,
    [FeatureStatusEnum.QA]: FeatureStatusEnum.QA_APPROVED,
    [FeatureStatusEnum.QA_APPROVED]: FeatureStatusEnum.DEV,
    [FeatureStatusEnum.DEV]: FeatureStatusEnum.PLAN_APPROVED,
    [FeatureStatusEnum.PLAN_APPROVED]: FeatureStatusEnum.CODE_GEN,
    [FeatureStatusEnum.CODE_GEN]: FeatureStatusEnum.PR_CREATED,
    [FeatureStatusEnum.PR_CREATED]: FeatureStatusEnum.DONE,
}

// Backward transitions allowed only for explicit rejection flows.
// Kept separate from NEXT_STATUS so forward transitions are never accidentally reversed.
const REJECTION_MAP: Partial<Record<FeatureStatus, FeatureStatus>> = {
    [FeatureStatusEnum.DEV]: FeatureStatusEnum.QA_APPROVED,
}

export function isValidTransition(from: FeatureStatus, to: FeatureStatus): boolean {
    return NEXT_STATUS[from] === to
}

export function isValidRejection(from: FeatureStatus, to: FeatureStatus): boolean {
    return REJECTION_MAP[from] === to
}

export function getNextStatus(current: FeatureStatus): FeatureStatus | null {
    return NEXT_STATUS[current] ?? null
}
