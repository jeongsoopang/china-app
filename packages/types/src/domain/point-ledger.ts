import type { BaseEntity, EntityId, Timestamp } from "./common";

export type PointLedgerReason =
  | "post_created"
  | "comment_created"
  | "verification_approved"
  | "moderation_penalty"
  | "manual_adjustment";

export type PointLedgerEntry = BaseEntity & {
  userId: EntityId;
  amount: number;
  reason: PointLedgerReason;
  referenceId: EntityId | null;
  note: string | null;
  issuedAt: Timestamp;
  availableAt: Timestamp;
  balanceAfter: number;
};
