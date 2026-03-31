import { supabase } from "../../lib/supabase/client";

type DeleteAccountResponse = {
  success?: boolean;
  error?: string;
  message?: string;
};

type InvokeErrorWithContext = Error & {
  context?: unknown;
};

async function parseInvokeError(error: unknown): Promise<string> {
  if (!(error instanceof Error)) {
    return "계정 삭제 요청에 실패했습니다.";
  }

  const invokeError = error as InvokeErrorWithContext;
  const context = invokeError.context;

  if (context instanceof Response) {
    try {
      const json = (await context.clone().json()) as { error?: unknown; message?: unknown };
      if (typeof json.error === "string" && json.error.trim().length > 0) {
        return json.error;
      }
      if (typeof json.message === "string" && json.message.trim().length > 0) {
        return json.message;
      }
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim().length > 0) {
          return text;
        }
      } catch {
        return invokeError.message;
      }
    }
  }

  return invokeError.message || "계정 삭제 요청에 실패했습니다.";
}

export async function deleteMyAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    method: "POST"
  });

  if (error) {
    throw new Error(await parseInvokeError(error));
  }

  const payload = (data ?? {}) as DeleteAccountResponse;

  if (!payload.success) {
    throw new Error(payload.error ?? payload.message ?? "계정 삭제 요청에 실패했습니다.");
  }
}
