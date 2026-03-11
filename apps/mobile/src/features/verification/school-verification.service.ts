import type { Database } from "@foryou/types";
import { supabase } from "../../lib/supabase/client";
import type {
  SchoolVerificationConfirmResult,
  SchoolVerificationRequestResult,
  UniversityPreview
} from "./school-verification.types";

type ConfirmRpcRow =
  Database["public"]["Functions"]["confirm_school_verification"]["Returns"][number];

type EdgeRequestResponse = {
  success?: boolean;
  verificationId?: number | string | null;
  universityId?: string | null;
  universitySlug?: string | null;
  schoolEmail?: string | null;
  expiresAt?: string | null;
  debugCode?: string | null;
  emailDeliverySkipped?: boolean | null;
  developmentWarning?: string | null;
  error?: string | null;
};

function getSingleRpcRow<T>(
  rpcName: string,
  data: T[] | T | null
): T {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      throw new Error(`${rpcName} returned no rows.`);
    }

    return data[0];
  }

  if (!data) {
    throw new Error(`${rpcName} returned no data.`);
  }

  return data;
}

function parseVerificationId(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  throw new Error("Invalid verification ID returned from send-school-verification.");
}

async function fetchUniversityPreview(universityId: string): Promise<UniversityPreview | null> {
  const { data, error } = await supabase
    .from("universities")
    .select("id, name, short_name")
    .eq("id", universityId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    shortName: data.short_name
  };
}

async function parseEdgeFunctionError(error: unknown): Promise<string> {
  if (!(error instanceof Error)) {
    return "Request failed.";
  }

  const maybeContext = error as Error & { context?: unknown };
  const context = maybeContext.context;

  if (context instanceof Response) {
    try {
      const cloned = context.clone();
      const json = (await cloned.json()) as { error?: unknown; message?: unknown };
      const backendMessage =
        typeof json.error === "string"
          ? json.error
          : typeof json.message === "string"
            ? json.message
            : null;

      if (backendMessage) {
        return backendMessage;
      }
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim().length > 0) {
          return text;
        }
      } catch {
        // fall through to default message
      }
    }
  }

  return error.message || "Request failed.";
}

export async function requestSchoolVerification(
  schoolEmail: string
): Promise<SchoolVerificationRequestResult> {
  const normalizedEmail = schoolEmail.trim().toLowerCase();
  const sessionResult = await supabase.auth.getSession();

  if (sessionResult.error) {
    throw sessionResult.error;
  }

  const session = sessionResult.data.session;
  const accessToken = session?.access_token ?? null;

  console.log(
    "[school-verification] session exists:",
    Boolean(session),
    "access_token exists:",
    Boolean(accessToken)
  );

  if (!accessToken) {
    throw new Error("No active session token. Please sign in again.");
  }

  console.log(
    "[school-verification] invoking edge function send-school-verification via functions.invoke"
  );

  const { data, error } = await supabase.functions.invoke("send-school-verification", {
    body: {
      schoolEmail: normalizedEmail
    },
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (error) {
    const message = await parseEdgeFunctionError(error);
    throw new Error(message);
  }

  const row = getSingleRpcRow<EdgeRequestResponse>("send-school-verification", data);

  if (row.success === false) {
    throw new Error(
      typeof row.error === "string" && row.error.trim().length > 0
        ? row.error
        : "Verification request failed."
    );
  }

  const universityId = typeof row.universityId === "string" ? row.universityId : null;
  const university = universityId ? await fetchUniversityPreview(universityId) : null;

  return {
    verificationId: parseVerificationId(row.verificationId),
    schoolEmail: typeof row.schoolEmail === "string" ? row.schoolEmail : normalizedEmail,
    codeExpiresAt: typeof row.expiresAt === "string" ? row.expiresAt : null,
    university,
    debugCode: typeof row.debugCode === "string" ? row.debugCode : null,
    emailDeliverySkipped: Boolean(row.emailDeliverySkipped),
    developmentWarning: typeof row.developmentWarning === "string" ? row.developmentWarning : null
  };
}

export async function confirmSchoolVerification(
  verificationId: number,
  code: string
): Promise<SchoolVerificationConfirmResult> {
  const normalizedCode = code.trim();

  const { data, error } = await supabase.rpc("confirm_school_verification", {
    p_verification_id: verificationId,
    p_code: normalizedCode
  });

  if (error) {
    throw error;
  }

  const row = getSingleRpcRow<ConfirmRpcRow>("confirm_school_verification", data);

  return {
    success: row.success,
    status: row.status,
    message: row.message
  };
}
