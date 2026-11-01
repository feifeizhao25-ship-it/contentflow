/**
 * Referral codes and anti-abuse evaluation (pure functions; storage is supplied by the caller).
 * - the invitee's reward is certain and fixed; the inviter's reward is a fixed amount too (no lottery);
 * - a reward is only released after a qualifying action AND a hold period;
 * - idempotent: one reward per (inviter, invitee) pair;
 * - caps, velocity limits, self-referral and shared-device/payment checks; flagged claims go to manual review, never silently paid.
 * Server-side only (uses node:crypto). The secret must come from server config, never from the repo.
 */
import { createHmac } from 'crypto';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function makeReferralCode(userId: string, secret: string | Buffer, length = 8): string {
  if (!secret || secret.length === 0) throw new Error('secret required');
  const digest = createHmac('sha256', secret).update(`ref:${userId}`).digest();
  let n = digest.readBigUInt64BE(0);
  const base = BigInt(CODE_ALPHABET.length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Number(n % base)];
    n = n / base;
  }
  return out;
}

/** Salted hash of a device or payment-instrument id, so the ledger never stores raw identifiers. */
export function fingerprint(value: string, secret: string | Buffer): string {
  return createHmac('sha256', secret).update(`fp:${value}`).digest('hex').slice(0, 32);
}

export interface Policy {
  maxInvitesPerDay: number;
  maxRewardedLifetime: number;
  holdDays: number;
  inviteeMustBeNew: boolean;
  rewardInviter: number; // fixed units; never random
  rewardInvitee: number; // fixed units; certain
}
export const DEFAULT_POLICY: Policy = { maxInvitesPerDay: 20, maxRewardedLifetime: 50, holdDays: 14, inviteeMustBeNew: true, rewardInviter: 1, rewardInvitee: 1 };

export interface Claim {
  inviterId: string;
  inviteeId: string;
  claimedAt: Date;
  inviteeCreatedAt: Date;
  inviterDeviceFp?: string;
  inviteeDeviceFp?: string;
  inviterPaymentFp?: string;
  inviteePaymentFp?: string;
  qualifiedAt?: Date | null; // when the invitee completed the qualifying action
}
export interface History {
  claimsLast24h: number;
  rewardedLifetime: number;
  paired: Set<string>; // `${inviter}|${invitee}` already rewarded or pending
}
export type Status = 'pending' | 'release' | 'reject' | 'review';
export interface Decision {
  status: Status;
  reasons: string[];
  releaseAt?: Date;
  inviterUnits: number;
  inviteeUnits: number;
}

export const pairKey = (inviter: string, invitee: string): string => `${inviter}|${invitee}`;
const DAY = 86_400_000;
const d = (status: Status, reasons: string[], extra: Partial<Decision> = {}): Decision => ({ status, reasons, inviterUnits: 0, inviteeUnits: 0, ...extra });

export function evaluateReferral(claim: Claim, hist: History, pol: Policy = DEFAULT_POLICY, now: Date = new Date()): Decision {
  const reasons: string[] = [];
  if (claim.inviterId === claim.inviteeId) return d('reject', ['self_referral']);
  if (hist.paired.has(pairKey(claim.inviterId, claim.inviteeId))) return d('reject', ['duplicate_pair']);
  if (pol.inviteeMustBeNew && claim.inviteeCreatedAt.getTime() < claim.claimedAt.getTime() - DAY) return d('reject', ['invitee_not_new']);
  if (hist.rewardedLifetime >= pol.maxRewardedLifetime) return d('reject', ['lifetime_cap']);
  if (hist.claimsLast24h >= pol.maxInvitesPerDay) reasons.push('velocity');
  if (claim.inviterDeviceFp && claim.inviterDeviceFp === claim.inviteeDeviceFp) reasons.push('shared_device');
  if (claim.inviterPaymentFp && claim.inviterPaymentFp === claim.inviteePaymentFp) reasons.push('shared_payment');
  if (reasons.length) return d('review', reasons); // humans decide; nothing is paid automatically
  if (!claim.qualifiedAt) return d('pending', ['awaiting_qualifying_action']);
  const releaseAt = new Date(claim.qualifiedAt.getTime() + pol.holdDays * DAY);
  if (now.getTime() < releaseAt.getTime()) return d('pending', ['hold_period'], { releaseAt });
  return d('release', [], { releaseAt, inviterUnits: pol.rewardInviter, inviteeUnits: pol.rewardInvitee });
}
