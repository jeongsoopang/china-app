import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { mapAuthError } from "../../src/features/auth/auth.service";
import { useAuthSession } from "../../src/features/auth/auth-session";

const REDIRECT_PATHS = ["/(tabs)/me", "/(tabs)/compose", "/(tabs)/notifications"] as const;
type RedirectPath = (typeof REDIRECT_PATHS)[number];

export default function SignUpScreen() {
  const router = useRouter();
  const auth = useAuthSession();
  const params = useLocalSearchParams<{ redirectTo?: string }>();
  const [displayName, setDisplayName] = useState("");
  const [realName, setRealName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [shouldShowSignInButton, setShouldShowSignInButton] = useState(false);

  const redirectTo = useMemo<RedirectPath>(() => {
    if (
      typeof params.redirectTo === "string" &&
      (REDIRECT_PATHS as readonly string[]).includes(params.redirectTo)
    ) {
      return params.redirectTo as RedirectPath;
    }

    return "/(tabs)/me";
  }, [params.redirectTo]);

  const isSubmitting = auth.action === "signing_up";
  const canSubmit =
    displayName.trim().length > 0 &&
    realName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    !isSubmitting;

  useEffect(() => {
    if (!auth.isLoading && auth.isSignedIn) {
      router.replace(redirectTo);
    }
  }, [auth.isLoading, auth.isSignedIn, redirectTo, router]);

  async function onSubmit() {
    if (!canSubmit) {
      return;
    }

    setLocalError(null);
    setSuccessMessage(null);
    setShouldShowSignInButton(false);

    try {
      const result = await auth.signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        realName: realName.trim()
      });

      if (result.requiresEmailConfirmation) {
        setSuccessMessage(
          "Sign-up succeeded. Please check your email to confirm your account, then sign in."
        );
        setShouldShowSignInButton(true);
        return;
      }

      router.replace(redirectTo);
    } catch (error) {
      setLocalError(mapAuthError(error));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Sign Up</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>User Name (Display Name)</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setDisplayName}
          placeholder="Choose a display name"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={displayName}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Real Name</Text>
        <TextInput
          autoCorrect={false}
          onChangeText={setRealName}
          placeholder="Enter your real name"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={realName}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="name@example.com"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={email}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Password (min 6 chars)</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setPassword}
          placeholder="Create password"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={styles.input}
          value={password}
        />
      </View>

      {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}
      {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
      {auth.errorMessage ? <Text style={styles.errorText}>{auth.errorMessage}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={() => void onSubmit()}
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
      >
        <Text style={styles.buttonLabel}>
          {isSubmitting ? "Creating account..." : "Sign Up"}
        </Text>
      </Pressable>

      {shouldShowSignInButton ? (
        <Link
          asChild
          href={{
            pathname: "/auth/sign-in",
            params: { redirectTo }
          }}
        >
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonLabel}>Go to Sign In</Text>
          </Pressable>
        </Link>
      ) : null}

      <Link asChild href="/auth/sign-in">
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonLabel}>Already have an account? Sign In</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12, backgroundColor: "#ffffff" },
  heading: { fontSize: 26, fontWeight: "700", color: "#0f172a" },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#0f172a"
  },
  button: {
    borderRadius: 10,
    backgroundColor: "#0f172a",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonLabel: { color: "#f8fafc", fontWeight: "600" },
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
  successText: {
    fontSize: 14,
    color: "#166534"
  },
  errorText: {
    fontSize: 14,
    color: "#b91c1c"
  }
});
