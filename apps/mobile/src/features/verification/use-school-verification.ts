import type { UserProfileRow } from "@foryou/types";
import { useMemo, useState } from "react";
import { useAuthSession } from "../auth/auth-session";
import { getMobileCurrentUser } from "../auth/current-user";
import {
  confirmSchoolVerification,
  requestSchoolVerification
} from "./school-verification.service";
import type { SchoolVerificationRequestResult } from "./school-verification.types";

const SCHOOL_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.edu\.cn$/i;
const FOUR_DIGIT_CODE_PATTERN = /^\d{4}$/;

type VerificationAction = "idle" | "requesting" | "verifying";

type VerificationState = {
  schoolEmail: string;
  code: string;
  requestResult: SchoolVerificationRequestResult | null;
  refreshedProfile: UserProfileRow | null;
  isSuccess: boolean;
  action: VerificationAction;
  errorMessage: string | null;
  infoMessage: string | null;
};

const INITIAL_STATE: VerificationState = {
  schoolEmail: "",
  code: "",
  requestResult: null,
  refreshedProfile: null,
  isSuccess: false,
  action: "idle",
  errorMessage: null,
  infoMessage: null
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

export function useSchoolVerification() {
  const authSession = useAuthSession();
  const [state, setState] = useState<VerificationState>(INITIAL_STATE);
  const isLoading = state.action !== "idle";

  const canRequestCode = useMemo(() => {
    return SCHOOL_EMAIL_PATTERN.test(state.schoolEmail) && !isLoading && !state.isSuccess;
  }, [isLoading, state.isSuccess, state.schoolEmail]);

  const canVerifyCode = useMemo(() => {
    return (
      state.requestResult !== null &&
      FOUR_DIGIT_CODE_PATTERN.test(state.code) &&
      !isLoading &&
      !state.isSuccess
    );
  }, [isLoading, state.code, state.isSuccess, state.requestResult]);

  function setSchoolEmail(value: string) {
    setState((current) => ({
      ...current,
      schoolEmail: value,
      code: "",
      requestResult: null,
      isSuccess: false,
      errorMessage: null,
      infoMessage: null
    }));
  }

  function setCode(value: string) {
    const normalizedValue = value.replace(/\D/g, "").slice(0, 4);

    setState((current) => ({
      ...current,
      code: normalizedValue,
      errorMessage: null,
      infoMessage: null
    }));
  }

  async function onRequestCode() {
    if (isLoading) {
      return;
    }

    if (!SCHOOL_EMAIL_PATTERN.test(state.schoolEmail)) {
      setState((current) => ({
        ...current,
        errorMessage: "Enter a valid school email address ending with .edu.cn."
      }));
      return;
    }

    setState((current) => ({
      ...current,
      action: "requesting",
      errorMessage: null,
      infoMessage: null
    }));

    try {
      const result = await requestSchoolVerification(state.schoolEmail);

      setState((current) => ({
        ...current,
        schoolEmail: result.schoolEmail,
        requestResult: result,
        code: "",
        action: "idle",
        infoMessage: "Verification code requested."
      }));
    } catch (error) {
      const message = toErrorMessage(error, "Request failed.");

      setState((current) => ({
        ...current,
        action: "idle",
        errorMessage: message
      }));
    }
  }

  async function onVerifyCode() {
    if (isLoading) {
      return;
    }

    if (!state.requestResult) {
      setState((current) => ({
        ...current,
        errorMessage: "Request a verification code first."
      }));
      return;
    }

    if (!FOUR_DIGIT_CODE_PATTERN.test(state.code)) {
      setState((current) => ({
        ...current,
        errorMessage: "Enter a 4-digit verification code."
      }));
      return;
    }

    setState((current) => ({
      ...current,
      action: "verifying",
      errorMessage: null,
      infoMessage: null
    }));

    try {
      const verificationResult = await confirmSchoolVerification(
        state.requestResult.verificationId,
        state.code
      );

      if (!verificationResult.success) {
        throw new Error(verificationResult.message ?? "Verification failed.");
      }

      await authSession.refresh();
      const currentUser = await getMobileCurrentUser();

      setState((current) => ({
        ...current,
        action: "idle",
        isSuccess: true,
        refreshedProfile: currentUser?.profile ?? null,
        infoMessage:
          verificationResult.message ??
          "School verification complete. Profile state has been refreshed."
      }));
    } catch (error) {
      const message = toErrorMessage(error, "Verification failed.");

      setState((current) => ({
        ...current,
        action: "idle",
        errorMessage: message
      }));
    }
  }

  return {
    state,
    isLoading,
    canRequestCode,
    canVerifyCode,
    setSchoolEmail,
    setCode,
    onRequestCode,
    onVerifyCode
  };
}
