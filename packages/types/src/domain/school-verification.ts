import type { EntityId, Timestamp } from "./common";

export type SchoolVerificationStatus =
  | "code_requested"
  | "pending_review"
  | "verified"
  | "rejected"
  | "expired";

export type SchoolVerification = {
  id: number;
  userId: EntityId;
  universityId: EntityId | null;
  schoolEmail: string;
  status: SchoolVerificationStatus;
  verificationCodeHash: string | null;
  codeRequestedAt: Timestamp | null;
  codeExpiresAt: Timestamp | null;
  verifiedAt: Timestamp | null;
  reviewerId: EntityId | null;
  reviewedAt: Timestamp | null;
  rejectionReason: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
