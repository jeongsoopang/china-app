import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { mapAuthError } from "../../src/features/auth/auth.service";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { useAppLanguage } from "../../src/features/language/app-language";

const REDIRECT_PATHS = ["/(tabs)/me", "/(tabs)/compose", "/(tabs)/notifications"] as const;
type RedirectPath = (typeof REDIRECT_PATHS)[number];

export default function SignInScreen() {
  const router = useRouter();
  const auth = useAuthSession();
  const { resolvedLanguage } = useAppLanguage();
  const params = useLocalSearchParams<{ redirectTo?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const redirectTo = useMemo<RedirectPath>(() => {
    if (
      typeof params.redirectTo === "string" &&
      (REDIRECT_PATHS as readonly string[]).includes(params.redirectTo)
    ) {
      return params.redirectTo as RedirectPath;
    }

    return "/(tabs)/me";
  }, [params.redirectTo]);

  const isSubmitting = auth.action === "signing_in";
  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;
  const isKo = resolvedLanguage === "ko";

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
    setIsSuccess(false);

    try {
      await auth.signIn({
        email: email.trim(),
        password
      });
      setIsSuccess(true);
      router.replace(redirectTo);
    } catch (error) {
      setLocalError(mapAuthError(error));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{isKo ? "로그인" : "Sign In"}</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "이메일" : "Email"}</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSubmitting}
          keyboardType="email-address"
          placeholder="name@example.com"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "비밀번호" : "Password"}</Text>
        <TextInput
          autoCapitalize="none"
          editable={!isSubmitting}
          placeholder={isKo ? "비밀번호를 입력하세요" : "Enter password"}
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
      </View>

      <Pressable
        disabled={!canSubmit}
        onPress={onSubmit}
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
      >
        <Text style={styles.buttonLabel}>
          {isSubmitting ? (isKo ? "로그인 중..." : "Signing In...") : isKo ? "로그인" : "Sign In"}
        </Text>
      </Pressable>

      {isSuccess ? <Text style={styles.successText}>{isKo ? "로그인되었습니다." : "Sign-in successful."}</Text> : null}
      {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
      {!localError && auth.errorMessage ? <Text style={styles.errorText}>{auth.errorMessage}</Text> : null}

      <Link
        asChild
        href={{
          pathname: "/auth/sign-up",
          params: { redirectTo }
        }}
      >
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonLabel}>
            {isKo ? "계정이 없나요? 회원가입" : "Need an account? Sign Up"}
          </Text>
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
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { color: "#f8fafc", fontWeight: "600" },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#0f172a",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  secondaryButtonLabel: { color: "#0f172a", fontWeight: "600" },
  successText: { fontSize: 14, color: "#166534" },
  errorText: { fontSize: 14, color: "#b91c1c" }
});
