import type { CurrentUser } from "@foryou/supabase";
import { getAdminGrandMasterUserId } from "../../config/env";
import { getAdminCurrentUser } from "./current-user";

export type GrandMasterDenyReason =
  | "missing_env"
  | "not_signed_in"
  | "wrong_user_id"
  | "role_mismatch";

export type GrandMasterAccessState =
  | {
      status: "allow";
      currentUser: CurrentUser;
      expectedUserId: string;
    }
  | {
      status: "deny";
      reason: GrandMasterDenyReason;
      message: string;
      expectedUserId: string | null;
      currentUser: CurrentUser | null;
    };

export class GrandMasterAccessError extends Error {
  reason: GrandMasterDenyReason;

  constructor(reason: GrandMasterDenyReason, message: string) {
    super(message);
    this.reason = reason;
    this.name = "GrandMasterAccessError";
  }
}

export async function getGrandMasterAccessState(): Promise<GrandMasterAccessState> {
  let expectedUserId: string | null = null;

  try {
    expectedUserId = getAdminGrandMasterUserId();
  } catch {
    return {
      status: "deny",
      reason: "missing_env",
      message: "Missing ADMIN_GRANDMASTER_USER_ID environment variable.",
      expectedUserId: null,
      currentUser: null
    };
  }

  const currentUser = await getAdminCurrentUser();

  if (!currentUser) {
    return {
      status: "deny",
      reason: "not_signed_in",
      message: "Sign in is required.",
      expectedUserId,
      currentUser: null
    };
  }

  if (currentUser.authUser.id !== expectedUserId) {
    return {
      status: "deny",
      reason: "wrong_user_id",
      message: "Signed-in user id does not match ADMIN_GRANDMASTER_USER_ID.",
      expectedUserId,
      currentUser
    };
  }

  const role = String(currentUser.profile.role);
  if (role !== "grandmaster") {
    return {
      status: "deny",
      reason: "role_mismatch",
      message: "Signed-in user does not have role 'grandmaster'.",
      expectedUserId,
      currentUser
    };
  }

  return {
    status: "allow",
    currentUser,
    expectedUserId
  };
}

export async function requireGrandMasterAccess(): Promise<CurrentUser> {
  const state = await getGrandMasterAccessState();

  if (state.status !== "allow") {
    throw new GrandMasterAccessError(state.reason, state.message);
  }

  return state.currentUser;
}
