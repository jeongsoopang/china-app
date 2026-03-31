import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

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

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

type VerificationRequestRow = {
  id: string;
  email: string;
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

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, {
        success: false,
        error: "Missing required server secrets"
      });
    }

    const body = await req.json().catch(() => ({}));

    const email = normalizeEmail(body?.email);
    const password = typeof body?.password === "string" ? body.password : "";
    const displayName = normalizeText(body?.displayName);
    const realName = normalizeText(body?.realName);
    const verificationToken = normalizeText(body?.verificationToken);

    if (!email) {
      return jsonResponse(400, {
        success: false,
        error: "이메일을 입력해주세요."
      });
    }

    if (displayName.length < 1) {
      return jsonResponse(400, {
        success: false,
        error: "사용자명을 입력해주세요."
      });
    }

    if (realName.length < 1) {
      return jsonResponse(400, {
        success: false,
        error: "실명을 입력해주세요."
      });
    }

    if (password.length < 6) {
      return jsonResponse(400, {
        success: false,
        error: "비밀번호는 6자 이상이어야 합니다."
      });
    }

    if (!verificationToken) {
      return jsonResponse(400, {
        success: false,
        error: "이메일 인증이 필요합니다."
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data: verificationRow, error: verificationError } = await supabase
      .from("email_verification_requests")
      .select("id, email, expires_at, verified_at, consumed_at")
      .eq("email", email)
      .eq("verification_token", verificationToken)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<VerificationRequestRow>();

    if (verificationError) {
      return jsonResponse(500, {
        success: false,
        error: verificationError.message
      });
    }

    if (!verificationRow || !verificationRow.verified_at || verificationRow.consumed_at) {
      return jsonResponse(400, {
        success: false,
        error: "유효한 이메일 인증 정보가 없습니다. 다시 인증해주세요."
      });
    }

    if (Date.now() > new Date(verificationRow.expires_at).getTime()) {
      return jsonResponse(400, {
        success: false,
        error: "인증이 만료되었습니다. 다시 인증해주세요."
      });
    }

    const { data: createdUserData, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        real_name: realName
      }
    });

    if (createUserError || !createdUserData.user) {
      const message = createUserError?.message ?? "회원가입에 실패했습니다.";
      const normalizedMessage = message.toLowerCase();

      if (
        normalizedMessage.includes("already") ||
        normalizedMessage.includes("registered") ||
        normalizedMessage.includes("exists")
      ) {
        return jsonResponse(409, {
          success: false,
          error: "이미 가입된 이메일입니다."
        });
      }

      return jsonResponse(500, {
        success: false,
        error: message
      });
    }

    const { error: finalizeError } = await supabase
      .from("email_verification_requests")
      .update({
        status: "completed",
        consumed_at: new Date().toISOString(),
        completed_user_id: createdUserData.user.id
      })
      .eq("id", verificationRow.id);

    if (finalizeError) {
      return jsonResponse(500, {
        success: false,
        error: finalizeError.message
      });
    }

    return jsonResponse(200, {
      success: true,
      userId: createdUserData.user.id,
      message: "회원가입이 완료되었습니다."
    });
  } catch (error) {
    return jsonResponse(500, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
