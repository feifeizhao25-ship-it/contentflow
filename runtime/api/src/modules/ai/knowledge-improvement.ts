export type ImprovementState =
  | 'discovered'
  | 'license_checked'
  | 'quarantined'
  | 'evaluated'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'rolled_back';

export interface ImprovementCandidate {
  id: string;
  sourceUrl: string;
  state: ImprovementState;
  evidenceScore?: number;
  safetyScore?: number;
  approvedBy?: string;
}

const transitions: Record<ImprovementState, ImprovementState[]> = {
  discovered: ['license_checked', 'rejected'],
  license_checked: ['quarantined', 'rejected'],
  quarantined: ['evaluated', 'rejected'],
  evaluated: ['approved', 'rejected'],
  approved: ['published', 'rejected'],
  published: ['rolled_back'],
  rejected: [],
  rolled_back: [],
};

export function transitionCandidate(
  candidate: ImprovementCandidate,
  target: ImprovementState,
  actor?: string,
): ImprovementCandidate {
  if (!transitions[candidate.state].includes(target)) {
    throw new Error(`Invalid improvement transition: ${candidate.state} -> ${target}`);
  }
  if (target === 'approved') {
    if (!actor) throw new Error('Human reviewer is required before approval');
    if (
      candidate.evidenceScore === undefined ||
      candidate.safetyScore === undefined ||
      Math.min(candidate.evidenceScore, candidate.safetyScore) < 0.85
    ) {
      throw new Error('Candidate does not meet the 0.85 release threshold');
    }
  }
  return {
    ...candidate,
    state: target,
    approvedBy: target === 'approved' ? actor : candidate.approvedBy,
  };
}
