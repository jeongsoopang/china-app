import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const OTP_CODE_LENGTH = 6;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

type VerificationRequestRow = {
  id: string;
  email: string;
  code_hash: string;
  attempt_count: number;
  max_attempts: number;
  expires_at: string;
  verified_at: string | null;
  consumed_at: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const hashPepper = Deno.env.get("OTP_HASH_PEPPER");

    if (!supabaseUrl || !serviceRoleKey || !hashPepper) {
      return jsonResponse(500, {
        success: false,
        error: "Missing required server secrets"
      });
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!email) {
      return jsonResponse(400, {
        success: false,
        error: "이메일을 입력해주세요."
      });
    }

    if (!/^\d+$/.test(code) || code.length !== OTP_CODE_LENGTH) {
      return jsonResponse(400, {
        success: false,
        error: "인증 코드는 숫자 6자리여야 합니다."
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data: requestRow, error: requestError } = await supabase
      .from("email_verification_requests")
      .select("id, email, code_hash, attempt_count, max_attempts, expires_at, verified_at, consumed_at")
      .eq("email", email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<VerificationRequestRow>();

    if (requestError) {
      return jsonResponse(500, {
        success: false,
        error: requestError.message
      });
    }

    if (!requestRow || requestRow.verified_at || requestRow.consumed_at) {
      return jsonResponse(400, {
        success: false,
        message: "인증 실패"
      });
    }

    const now = Date.now();
    const expiresAt = new Date(requestRow.expires_at).getTime();

    if (now > expiresAt) {
      await supabase
        .from("email_verification_requests")
        .update({ status: "expired" })
        .eq("id", requestRow.id);

      return jsonResponse(400, {
        success: false,
        message: "인증 실패"
      });
    }

    if (requestRow.attempt_count >= requestRow.max_attempts) {
      return jsonResponse(400, {
        success: false,
        message: "인증 실패"
      });
    }

    const codeHash = await sha256Hex(`${email}:${code}:${hashPepper}`);

    if (codeHash !== requestRow.code_hash) {
      const nextAttemptCount = requestRow.attempt_count + 1;
      const nextStatus = nextAttemptCount >= requestRow.max_attempts ? "failed" : "code_sent";

      await supabase
        .from("email_verification_requests")
        .update({
          attempt_count: nextAttemptCount,
          status: nextStatus
        })
        .eq("id", requestRow.id);

      return jsonResponse(400, {
        success: false,
        message: "인증 실패",
        remainingAttempts: Math.max(requestRow.max_attempts - nextAttemptCount, 0)
      });
    }

    const verificationToken = crypto.randomUUID();

    const { error: verifyUpdateError } = await supabase
      .from("email_verification_requests")
      .update({
        status: "verified",
        verified_at: new Date(now).toISOString(),
        verification_token: verificationToken
      })
      .eq("id", requestRow.id);

    if (verifyUpdateError) {
      return jsonResponse(500, {
        success: false,
        error: verifyUpdateError.message
      });
    }

    return jsonResponse(200, {
      success: true,
      message: "이메일 인증 완료",
      verificationToken
    });
  } catch (error) {
    return jsonResponse(500, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
