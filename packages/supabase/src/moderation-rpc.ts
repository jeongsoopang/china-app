import type { Database } from "@foryou/types";
import type { AppSupabaseClient } from "./client";

type CreateReportRpcReturn = Database["public"]["Functions"]["create_report"]["Returns"];
type ReviewReportRpcReturn = Database["public"]["Functions"]["review_report"]["Returns"];
type CreateModerationFlagRpcReturn =
  Database["public"]["Functions"]["create_moderation_flag"]["Returns"];
type ReviewModerationFlagRpcReturn =
  Database["public"]["Functions"]["review_moderation_flag"]["Returns"];
type PublishAnnouncementRpcReturn =
  Database["public"]["Functions"]["publish_announcement"]["Returns"];

export type ReportTargetType = "post" | "comment";

export type ReportReasonCode =
  | "spam"
  | "abusive"
  | "hate"
  | "harassment"
  | "misleading"
  | "other";

export type CreateReportInput = {
  targetType: ReportTargetType;
  targetId: number;
  reasonCode: ReportReasonCode;
  reasonText?: string | null;
};

export type CreateReportResult = {
  reportId: number | null;
  message: string | null;
};

export type ReviewReportInput = {
  reportId: number;
  nextStatus: string;
  action?: string;
};

export type ReviewReportResult = {
  success: boolean;
  message: string | null;
};

export type CreateModerationFlagInput = {
  targetType: string;
  targetId: number;
  flagSource: string;
  riskScore: number;
  reasonSummary: string;
};

export type CreateModerationFlagResult = {
  flagId: number | null;
  message: string | null;
};

export type ReviewModerationFlagInput = {
  flagId: number;
  nextStatus: string;
};

export type ReviewModerationFlagResult = {
  success: boolean;
  message: string | null;
};

export type PublishAnnouncementResult = {
  published: boolean;
  message: string | null;
};

function toRecord(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }

  if (data && typeof data === "object") {
    return data as Record<string, unknown>;
  }

  return null;
}

function parseNumericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

function parseMessage(data: unknown, record: Record<string, unknown> | null): string | null {
  if (typeof data === "string") {
    return data;
  }

  return record && typeof record.message === "string" ? record.message : null;
}

export async function createReport(
  client: AppSupabaseClient,
  input: CreateReportInput
): Promise<CreateReportResult> {
  const { data, error } = await client.rpc("create_report", {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason_code: input.reasonCode,
    p_reason_text: input.reasonText ?? null
  });

  if (error) {
    throw error;
  }

  const record = toRecord(data);
  const reportId = parseNumericId(record?.report_id ?? record?.id);

  return {
    reportId,
    message: parseMessage(data, record)
  };
}

export async function reviewReport(
  client: AppSupabaseClient,
  input: ReviewReportInput
): Promise<ReviewReportResult> {
  const { data, error } = await client.rpc("review_report", {
    p_report_id: input.reportId,
    p_next_status: input.nextStatus,
    p_action: input.action ?? "none"
  });

  if (error) {
    throw error;
  }

  const record = toRecord(data);

  return {
    success: record ? Boolean(record.success ?? true) : true,
    message: parseMessage(data, record)
  };
}

export async function createModerationFlag(
  client: AppSupabaseClient,
  input: CreateModerationFlagInput
): Promise<CreateModerationFlagResult> {
  const { data, error } = await client.rpc("create_moderation_flag", {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_flag_source: input.flagSource,
    p_risk_score: input.riskScore,
    p_reason_summary: input.reasonSummary
  });

  if (error) {
    throw error;
  }

  const record = toRecord(data);

  return {
    flagId: parseNumericId(record?.flag_id ?? record?.id),
    message: parseMessage(data, record)
  };
}

export async function reviewModerationFlag(
  client: AppSupabaseClient,
  input: ReviewModerationFlagInput
): Promise<ReviewModerationFlagResult> {
  const { data, error } = await client.rpc("review_moderation_flag", {
    p_flag_id: input.flagId,
    p_next_status: input.nextStatus
  });

  if (error) {
    throw error;
  }

  const record = toRecord(data);

  return {
    success: record ? Boolean(record.success ?? true) : true,
    message: parseMessage(data, record)
  };
}

export async function publishAnnouncement(
  client: AppSupabaseClient,
  announcementId: number
): Promise<PublishAnnouncementResult> {
  const { data, error } = await client.rpc("publish_announcement", {
    p_announcement_id: announcementId
  });

  if (error) {
    throw error;
  }

  const record = toRecord(data);

  return {
    published: record ? Boolean(record.published ?? true) : true,
    message: parseMessage(data, record)
  };
}
