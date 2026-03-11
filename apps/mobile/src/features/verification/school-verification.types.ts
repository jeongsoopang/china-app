import type { DbSchoolVerificationStatus } from "@foryou/types";

export type UniversityPreview = {
  id: string;
  name: string;
  shortName: string | null;
};

export type SchoolVerificationRequestResult = {
  verificationId: number;
  schoolEmail: string;
  codeExpiresAt: string | null;
  university: UniversityPreview | null;
  debugCode: string | null;
  emailDeliverySkipped: boolean;
  developmentWarning: string | null;
};

export type SchoolVerificationConfirmResult = {
  success: boolean;
  status: DbSchoolVerificationStatus | null;
  message: string | null;
};
