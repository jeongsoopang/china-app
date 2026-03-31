import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
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
    const authHeader = req.headers.get("Authorization") ?? "";
    console.log("[delete-account] auth header exists:", Boolean(authHeader));
    console.log(
      "[delete-account] auth header prefix:",
      authHeader ? authHeader.slice(0, 20) : "(empty)"
    );

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[delete-account] Missing or invalid Authorization header");
      return jsonResponse(401, {
        success: false,
        error: "Missing or invalid Authorization header"
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey =
      Deno.env.get("SB_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("[delete-account] has SUPABASE_URL:", Boolean(supabaseUrl));
    console.log("[delete-account] has publishable/anon key:", Boolean(publishableKey));
    console.log("[delete-account] has service role key:", Boolean(serviceRoleKey));

    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      console.error("[delete-account] Missing required server secrets");
      return jsonResponse(500, {
        success: false,
        error: "Missing required server secrets"
      });
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const authUserResult = await authClient.auth.getUser();

    console.log(
      "[delete-account] getUser success:",
      Boolean(authUserResult.data?.user),
      "error:",
      authUserResult.error?.message ?? null
    );

    if (authUserResult.error || !authUserResult.data.user) {
      console.error("[delete-account] auth.getUser failed:", authUserResult.error);
      return jsonResponse(401, {
        success: false,
        error: authUserResult.error?.message ?? "Invalid JWT"
      });
    }

    const userId = authUserResult.data.user.id;
    console.log("[delete-account] deleting user id:", userId);

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const deleteResult = await serviceClient.auth.admin.deleteUser(userId, false);

    console.log(
      "[delete-account] deleteUser success:",
      !deleteResult.error,
      "error:",
      deleteResult.error?.message ?? null
    );

    if (deleteResult.error) {
      console.error("[delete-account] deleteUser failed:", deleteResult.error);
      return jsonResponse(500, {
        success: false,
        error: deleteResult.error.message
      });
    }

    return jsonResponse(200, {
      success: true,
      deletedUserId: userId,
      message: "계정이 삭제되었습니다."
    });
  } catch (error) {
    console.error("[delete-account] unexpected error:", error);
    return jsonResponse(500, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
