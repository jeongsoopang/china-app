import {
  createReport,
  type CreateReportInput,
  type CreateReportResult,
  type ReportReasonCode
} from "@foryou/supabase";
import { supabase } from "../../lib/supabase/client";

export const REPORT_REASON_OPTIONS: ReadonlyArray<{
  code: ReportReasonCode;
  label: string;
}> = [
  { code: "spam", label: "Spam" },
  { code: "abusive", label: "Abusive" },
  { code: "hate", label: "Hate" },
  { code: "harassment", label: "Harassment" },
  { code: "misleading", label: "Misleading" },
  { code: "other", label: "Other" }
];

export async function submitReport(input: CreateReportInput): Promise<CreateReportResult> {
  return createReport(supabase, input);
}

export function mapReportError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unable to submit report right now.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("permission") || message.includes("not allowed")) {
    return "You do not have permission to report this content.";
  }

  if (message.includes("duplicate") || message.includes("already")) {
    return "You already reported this content.";
  }

  return error.message || "Unable to submit report right now.";
}
