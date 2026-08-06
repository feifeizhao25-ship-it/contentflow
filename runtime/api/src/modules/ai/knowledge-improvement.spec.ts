import {
  ImprovementCandidate,
  transitionCandidate,
} from './knowledge-improvement';

describe('knowledge improvement governance', () => {
  it('requires a named reviewer before approval', () => {
    const candidate: ImprovementCandidate = {
      id: 'candidate-1',
      sourceUrl: 'https://example.test',
      state: 'evaluated',
      evidenceScore: 0.92,
      safetyScore: 0.91,
    };
    expect(() => transitionCandidate(candidate, 'approved')).toThrow(
      'Human reviewer',
    );
    expect(transitionCandidate(candidate, 'approved', 'reviewer').state).toBe(
      'approved',
    );
  });

  it('rejects candidates below the release threshold', () => {
    const candidate: ImprovementCandidate = {
      id: 'candidate-2',
      sourceUrl: 'https://example.test',
      state: 'evaluated',
      evidenceScore: 0.84,
      safetyScore: 0.99,
    };
    expect(() =>
      transitionCandidate(candidate, 'approved', 'reviewer'),
    ).toThrow('0.85');
  });
});
