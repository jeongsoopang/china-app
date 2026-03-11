import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mapAuthError } from "../../src/features/auth/auth.service";
import { useAuthSession } from "../../src/features/auth/auth-session";

export default function MeScreen() {
  const auth = useAuthSession();
  const [localError, setLocalError] = useState<string | null>(null);
  const isSigningOut = auth.action === "signing_out";

  async function onSignOut() {
    if (isSigningOut) {
      return;
    }

    setLocalError(null);

    try {
      await auth.signOut();
    } catch (error) {
      setLocalError(mapAuthError(error));
    }
  }

  if (auth.isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Me</Text>
        <Text style={styles.text}>Loading account state...</Text>
      </View>
    );
  }

  if (!auth.isSignedIn || !auth.user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Me</Text>
        <Text style={styles.text}>Sign in to view your account and access school verification.</Text>
        <Link
          asChild
          href={{
            pathname: "/auth/sign-in",
            params: { redirectTo: "/(tabs)/me" }
          }}
        >
          <Pressable style={styles.button}>
            <Text style={styles.buttonLabel}>Sign In</Text>
          </Pressable>
        </Link>
        <Link
          asChild
          href={{
            pathname: "/auth/sign-up",
            params: { redirectTo: "/(tabs)/me" }
          }}
        >
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonLabel}>Sign Up</Text>
          </Pressable>
        </Link>
        {auth.errorMessage ? <Text style={styles.errorText}>{auth.errorMessage}</Text> : null}
      </View>
    );
  }

  const displayName =
    auth.user.profile?.display_name ??
    (typeof auth.user.authUser.user_metadata?.display_name === "string"
      ? auth.user.authUser.user_metadata.display_name
      : null) ??
    "-";
  const email = auth.user.authUser.email ?? "-";
  const role = auth.user.profile?.role ?? "-";
  const tier = auth.user.profile?.tier ?? null;
  const verifiedSchoolEmail = auth.user.profile?.verified_school_email ?? null;
  const verifiedUniversityId = auth.user.profile?.verified_university_id ?? null;
  const isSchoolVerified = Boolean(verifiedSchoolEmail && verifiedUniversityId);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Me</Text>
      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>Email</Text>
        <Text style={styles.profileValue}>{email}</Text>
        <Text style={styles.profileLabel}>Display Name</Text>
        <Text style={styles.profileValue}>{displayName}</Text>
        <Text style={styles.profileLabel}>Role</Text>
        <Text style={styles.profileValue}>{role}</Text>
        {tier ? (
          <>
            <Text style={styles.profileLabel}>Tier</Text>
            <Text style={styles.profileValue}>{tier}</Text>
          </>
        ) : null}
        <Text style={styles.profileLabel}>School Verified</Text>
        <Text style={styles.profileValue}>{isSchoolVerified ? "Yes" : "No"}</Text>
        <Text style={styles.profileLabel}>Verified Email</Text>
        <Text style={styles.profileValue}>{verifiedSchoolEmail ?? "-"}</Text>
        <Text style={styles.profileLabel}>Verified University</Text>
        <Text style={styles.profileValue}>{verifiedUniversityId ?? "-"}</Text>
      </View>
      <Link asChild href="/verification/school">
        <Pressable style={styles.button}>
          <Text style={styles.buttonLabel}>School Verification</Text>
        </Pressable>
      </Link>
      <Pressable
        disabled={isSigningOut}
        onPress={onSignOut}
        style={[styles.secondaryButton, isSigningOut && styles.buttonDisabled]}
      >
        <Text style={styles.secondaryButtonLabel}>{isSigningOut ? "Signing Out..." : "Sign Out"}</Text>
      </Pressable>
      {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
      {!localError && auth.errorMessage ? <Text style={styles.errorText}>{auth.errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
    backgroundColor: "#f8fafc"
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a"
  },
  text: {
    fontSize: 15,
    color: "#334155"
  },
  profileCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 4
  },
  profileLabel: {
    fontSize: 12,
    color: "#64748b"
  },
  profileValue: {
    fontSize: 15,
    color: "#0f172a",
    marginBottom: 4
  },
  button: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: "#0f172a",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#0f172a",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  secondaryButtonLabel: {
    color: "#0f172a",
    fontWeight: "600"
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonLabel: {
    color: "#f8fafc",
    fontWeight: "600"
  },
  errorText: {
    fontSize: 14,
    color: "#b91c1c"
  }
});
