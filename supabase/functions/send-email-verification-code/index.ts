import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const OTP_CODE_LENGTH = 6;
const OTP_EXPIRES_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 5;

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateNumericCode(length: number): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
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
  resend_count: number;
  max_resends: number;
  last_sent_at: string;
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const mailFrom = Deno.env.get("MAIL_FROM");
    const hashPepper = Deno.env.get("OTP_HASH_PEPPER");
    const appEnv = Deno.env.get("APP_ENV") ?? "development";

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !mailFrom || !hashPepper) {
      return jsonResponse(500, {
        success: false,
        error: "Missing required server secrets"
      });
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);

    if (!email || !isValidEmail(email)) {
      return jsonResponse(400, {
        success: false,
        error: "유효한 이메일 주소를 입력해주세요."
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data: existingRequest, error: existingRequestError } = await supabase
      .from("email_verification_requests")
      .select("id, email, resend_count, max_resends, last_sent_at, expires_at, verified_at, consumed_at")
      .eq("email", email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<VerificationRequestRow>();

    if (existingRequestError) {
      return jsonResponse(500, {
        success: false,
        error: existingRequestError.message
      });
    }

    const nowMs = Date.now();
    const hasVerifiedButUnfinishedRequest = Boolean(
      existingRequest && existingRequest.verified_at && !existingRequest.consumed_at
    );

    if (existingRequest && !existingRequest.verified_at) {
      const secondsSinceLastSend = Math.floor(
        (nowMs - new Date(existingRequest.last_sent_at).getTime()) / 1000
      );
      const resendAfterSeconds = RESEND_COOLDOWN_SECONDS - Math.max(secondsSinceLastSend, 0);

      if (resendAfterSeconds > 0) {
        return jsonResponse(429, {
          success: false,
          error: `재전송은 ${resendAfterSeconds}초 후에 가능합니다.`,
          resendAfterSeconds
        });
      }

      if (existingRequest.resend_count >= existingRequest.max_resends) {
        return jsonResponse(429, {
          success: false,
          error: "재전송 가능 횟수를 초과했습니다. 잠시 후 다시 시도해주세요."
        });
      }
    }

    const code = generateNumericCode(OTP_CODE_LENGTH);
    const codeHash = await sha256Hex(`${email}:${code}:${hashPepper}`);
    const expiresAt = new Date(nowMs + OTP_EXPIRES_MINUTES * 60_000).toISOString();

    let requestId: string;

    if (existingRequest && !existingRequest.verified_at) {
      const { data: updatedRow, error: updateError } = await supabase
        .from("email_verification_requests")
        .update({
          code_hash: codeHash,
          status: "code_sent",
          attempt_count: 0,
          resend_count: existingRequest.resend_count + 1,
          last_sent_at: new Date(nowMs).toISOString(),
          expires_at: expiresAt,
          verification_token: null,
          verified_at: null
        })
        .eq("id", existingRequest.id)
        .select("id")
        .single<{ id: string }>();

      if (updateError || !updatedRow) {
        return jsonResponse(500, {
          success: false,
          error: updateError?.message ?? "인증 요청 갱신에 실패했습니다."
        });
      }

      requestId = updatedRow.id;
    } else if (existingRequest && hasVerifiedButUnfinishedRequest) {
      // A previously verified-but-unfinished signup should be resumable.
      // Re-issue a fresh code/token on the same request instead of blocking this email.
      const { data: updatedRow, error: updateError } = await supabase
        .from("email_verification_requests")
        .update({
          code_hash: codeHash,
          status: "code_sent",
          attempt_count: 0,
          resend_count: 0,
          last_sent_at: new Date(nowMs).toISOString(),
          expires_at: expiresAt,
          verification_token: null,
          verified_at: null
        })
        .eq("id", existingRequest.id)
        .select("id")
        .single<{ id: string }>();

      if (updateError || !updatedRow) {
        return jsonResponse(500, {
          success: false,
          error: updateError?.message ?? "인증 요청 갱신에 실패했습니다."
        });
      }

      requestId = updatedRow.id;
    } else {
      const { data: insertedRow, error: insertError } = await supabase
        .from("email_verification_requests")
        .insert({
          email,
          code_hash: codeHash,
          status: "code_sent",
          attempt_count: 0,
          max_attempts: MAX_ATTEMPTS,
          resend_count: 0,
          max_resends: MAX_RESENDS,
          last_sent_at: new Date(nowMs).toISOString(),
          expires_at: expiresAt
        })
        .select("id")
        .single<{ id: string }>();

      if (insertError || !insertedRow) {
        return jsonResponse(500, {
          success: false,
          error: insertError?.message ?? "인증 요청 생성에 실패했습니다."
        });
      }

      requestId = insertedRow.id;
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: mailFrom,
        to: [email],
        subject: "LUCL 이메일 인증 코드",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>LUCL 이메일 인증</h2>
            <p>아래 인증 코드를 입력해주세요.</p>
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
            <p>인증 코드는 ${OTP_EXPIRES_MINUTES}분 후 만료됩니다.</p>
          </div>
        `
      })
    });

    if (!resendResponse.ok) {
      const resendErrorText = await resendResponse.text();

      if (appEnv !== "production") {
        return jsonResponse(200, {
          success: true,
          requestId,
          expiresAt,
          message: "개발 환경: 메일 전송 실패로 디버그 코드를 반환합니다.",
          debugCode: code,
          emailDeliverySkipped: true,
          warning: resendErrorText
        });
      }

      return jsonResponse(502, {
        success: false,
        error: `이메일 전송 실패: ${resendErrorText}`
      });
    }

    return jsonResponse(200, {
      success: true,
      requestId,
      expiresAt,
      message: "인증 코드를 전송했습니다.",
      ...(appEnv !== "production" ? { debugCode: code } : {})
    });
  } catch (error) {
    return jsonResponse(500, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
