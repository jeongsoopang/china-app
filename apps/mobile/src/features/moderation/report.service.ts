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
  try {
    return await createReport(supabase, input);
  } catch (error) {
    console.error("[submitReport] failed", {
      input,
      error
    });
    throw error;
  }
}

function extractErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message || null;
  }

  if (error && typeof error === "object") {
    if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }

    if ("error_description" in error && typeof (error as { error_description?: unknown }).error_description === "string") {
      return (error as { error_description: string }).error_description;
    }

    if ("details" in error && typeof (error as { details?: unknown }).details === "string") {
      return (error as { details: string }).details;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return null;
    }
  }

  return null;
}

export function mapReportError(error: unknown): string {
  const rawMessage = (extractErrorMessage(error) ?? "").toLowerCase();

  if (rawMessage.includes("permission") || rawMessage.includes("not allowed")) {
    return "You do not have permission to report this content.";
  }

  if (rawMessage.includes("duplicate") || rawMessage.includes("already")) {
    return "You already reported this content.";
  }

  const exactMessage = extractErrorMessage(error);
  return exactMessage || "Unable to submit report right now.";
}
