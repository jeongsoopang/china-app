import type { UserProfileRow } from "@foryou/types";
import type { CurrentUser } from "@foryou/supabase";
import { supabase } from "../../lib/supabase/client";

export type AuthUser = CurrentUser["authUser"];

export type MobileSessionUser = {
  authUser: AuthUser;
  profile: UserProfileRow | null;
};

export type EmailPasswordCredentials = {
  email: string;
  password: string;
};

export type SignUpInput = EmailPasswordCredentials & {
  displayName: string;
  realName: string;
  verificationToken: string;
};

export type SignUpResult = {
  requiresEmailConfirmation: boolean;
  user: MobileSessionUser | null;
};

export type SendSignUpEmailCodeResult = {
  success: boolean;
  requestId?: string;
  expiresAt?: string | null;
  resendAfterSeconds?: number;
  message?: string;
  debugCode?: string | null;
};

export type VerifySignUpEmailCodeResult = {
  success: boolean;
  verified: boolean;
  verificationToken: string | null;
  message: string;
};

type EdgeErrorLike = Error & {
  context?: unknown;
};

function isMissingAuthSessionError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("auth session missing") || message.includes("session missing");
}

async function parseFunctionInvokeError(error: unknown): Promise<string> {
  if (!(error instanceof Error)) {
    return "Request failed.";
  }

  const edgeError = error as EdgeErrorLike;
  if (edgeError.context instanceof Response) {
    const response = edgeError.context;

    try {
      const payload = (await response.clone().json()) as { error?: unknown; message?: unknown };
      const backendMessage =
        typeof payload.error === "string"
          ? payload.error
          : typeof payload.message === "string"
            ? payload.message
            : null;

      if (backendMessage && backendMessage.trim().length > 0) {
        return backendMessage;
      }
    } catch {
      try {
        const text = await response.clone().text();
        if (text.trim().length > 0) {
          return text;
        }
      } catch {
        return error.message || "Request failed.";
      }
    }
  }

  return error.message || "Request failed.";
}

async function fetchProfileByUserId(userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchSessionUser(): Promise<MobileSessionUser | null> {
  const authResult = await supabase.auth.getUser();

  if (authResult.error) {
    if (isMissingAuthSessionError(authResult.error)) {
      return null;
    }
    throw authResult.error;
  }

  const authUser = authResult.data.user;
  if (!authUser) {
    return null;
  }

  const profile = await fetchProfileByUserId(authUser.id);

  return {
    authUser,
    profile
  };
}

export async function requestSignUpEmailVerificationCode(
  email: string
): Promise<SendSignUpEmailCodeResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.functions.invoke("send-email-verification-code", {
    body: {
      email: normalizedEmail
    }
  });

  if (error) {
    const message = await parseFunctionInvokeError(error);
    throw new Error(message);
  }

  const payload = (data ?? {}) as {
    success?: boolean;
    requestId?: unknown;
    expiresAt?: unknown;
    resendAfterSeconds?: unknown;
    message?: unknown;
    debugCode?: unknown;
    error?: unknown;
  };

  if (payload.success !== true) {
    const fallbackMessage =
      typeof payload.error === "string" && payload.error.trim().length > 0
        ? payload.error
        : "인증 코드 전송에 실패했습니다.";
    throw new Error(fallbackMessage);
  }

  return {
    success: true,
    requestId: typeof payload.requestId === "string" ? payload.requestId : undefined,
    expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : null,
    resendAfterSeconds:
      typeof payload.resendAfterSeconds === "number" ? payload.resendAfterSeconds : undefined,
    message: typeof payload.message === "string" ? payload.message : undefined,
    debugCode: typeof payload.debugCode === "string" ? payload.debugCode : null
  };
}

export async function verifySignUpEmailVerificationCode(
  email: string,
  code: string
): Promise<VerifySignUpEmailCodeResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();

  const { data, error } = await supabase.functions.invoke("verify-email-verification-code", {
    body: {
      email: normalizedEmail,
      code: normalizedCode
    }
  });

  if (error) {
    const message = await parseFunctionInvokeError(error);
    return {
      success: false,
      verified: false,
      verificationToken: null,
      message: message.trim().length > 0 ? message : "인증 실패"
    };
  }

  const payload = (data ?? {}) as {
    success?: boolean;
    verificationToken?: unknown;
    message?: unknown;
    error?: unknown;
  };

  if (payload.success !== true) {
    return {
      success: false,
      verified: false,
      verificationToken: null,
      message:
        typeof payload.message === "string"
          ? payload.message
          : typeof payload.error === "string"
            ? payload.error
            : "인증 실패"
    };
  }

  return {
    success: true,
    verified: true,
    verificationToken:
      typeof payload.verificationToken === "string" ? payload.verificationToken : null,
    message: typeof payload.message === "string" ? payload.message : "이메일 인증 완료"
  };
}

export async function signInWithEmailPassword(
  credentials: EmailPasswordCredentials
): Promise<MobileSessionUser> {
  const normalizedEmail = credentials.email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: credentials.password
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Sign-in succeeded but user payload is missing.");
  }

  const profile = await fetchProfileByUserId(data.user.id);

  return {
    authUser: data.user,
    profile
  };
}

export async function signUpWithEmailPassword(input: SignUpInput): Promise<SignUpResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const realName = input.realName.trim();
  const verificationToken = input.verificationToken.trim();

  if (!verificationToken) {
    throw new Error("이메일 인증이 필요합니다.");
  }

  const { data, error } = await supabase.functions.invoke("complete-signup", {
    body: {
      email: normalizedEmail,
      password: input.password,
      displayName,
      realName,
      verificationToken
    }
  });

  if (error) {
    const message = await parseFunctionInvokeError(error);
    throw new Error(message);
  }

  const payload = (data ?? {}) as {
    success?: boolean;
    error?: unknown;
  };

  if (payload.success !== true) {
    const message =
      typeof payload.error === "string" && payload.error.trim().length > 0
        ? payload.error
        : "회원가입에 실패했습니다.";
    throw new Error(message);
  }

  const signedInUser = await signInWithEmailPassword({
    email: normalizedEmail,
    password: input.password
  });

  return {
    requiresEmailConfirmation: false,
    user: signedInUser
  };
}

export async function signOutSession(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export function mapAuthError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Authentication request failed.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (message.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }

  if (message.includes("password")) {
    return error.message;
  }

  if (message.includes("rate limit")) {
    return "Too many requests. Please try again shortly.";
  }

  return error.message || "Authentication request failed.";
}
