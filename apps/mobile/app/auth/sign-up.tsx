import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  mapAuthError,
  requestSignUpEmailVerificationCode,
  verifySignUpEmailVerificationCode
} from "../../src/features/auth/auth.service";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { useAppLanguage } from "../../src/features/language/app-language";

const REDIRECT_PATHS = ["/(tabs)/me", "/(tabs)/compose", "/(tabs)/notifications"] as const;
type RedirectPath = (typeof REDIRECT_PATHS)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{6}$/;

export default function SignUpScreen() {
  const router = useRouter();
  const auth = useAuthSession();
  const { resolvedLanguage } = useAppLanguage();
  const params = useLocalSearchParams<{ redirectTo?: string }>();

  const [displayName, setDisplayName] = useState("");
  const [realName, setRealName] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const [codeRequested, setCodeRequested] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
  const isKo = resolvedLanguage === "ko";
  const normalizedEmail = email.trim().toLowerCase();
  const emailIsValid = EMAIL_PATTERN.test(normalizedEmail);

  const canSendCode =
    displayName.trim().length > 0 &&
    realName.trim().length > 0 &&
    emailIsValid &&
    !isSendingCode &&
    !isVerifyingCode &&
    !isSubmitting &&
    !isEmailVerified;

  const canVerifyCode =
    codeRequested &&
    CODE_PATTERN.test(verificationCode) &&
    !isEmailVerified &&
    !isVerifyingCode &&
    !isSubmitting;

  const canResendCode =
    codeRequested && !isEmailVerified && !isSendingCode && !isVerifyingCode && !isSubmitting;

  const canSubmit =
    displayName.trim().length > 0 &&
    realName.trim().length > 0 &&
    emailIsValid &&
    isEmailVerified &&
    verificationToken !== null &&
    password.length >= 6 &&
    !isSubmitting;

  useEffect(() => {
    if (!auth.isLoading && auth.isSignedIn) {
      router.replace(redirectTo);
    }
  }, [auth.isLoading, auth.isSignedIn, redirectTo, router]);

  function resetEmailVerificationState() {
    setCodeRequested(false);
    setIsEmailVerified(false);
    setVerificationCode("");
    setVerificationToken(null);
    setPassword("");
    setSuccessMessage(null);
    setInfoMessage(null);
  }

  function onEmailChange(value: string) {
    setEmail(value);
    setLocalError(null);
    resetEmailVerificationState();
  }

  async function onSendCode() {
    if (!canSendCode) {
      return;
    }

    setLocalError(null);
    setSuccessMessage(null);
    setInfoMessage(null);
    setIsSendingCode(true);

    try {
      const result = await requestSignUpEmailVerificationCode(normalizedEmail);
      setCodeRequested(true);
      setInfoMessage(result.message ?? (isKo ? "인증 코드를 보냈습니다." : "Verification code sent."));
    } catch (error) {
      setLocalError(mapAuthError(error));
    } finally {
      setIsSendingCode(false);
    }
  }

  async function onVerifyCode() {
    if (!canVerifyCode) {
      return;
    }

    setLocalError(null);
    setSuccessMessage(null);
    setInfoMessage(null);
    setIsVerifyingCode(true);

    try {
      const result = await verifySignUpEmailVerificationCode(normalizedEmail, verificationCode);

      if (!result.success || !result.verified || !result.verificationToken) {
        setIsEmailVerified(false);
        setVerificationToken(null);
        setLocalError(isKo ? "인증 실패" : "Verification failed.");
        return;
      }

      setIsEmailVerified(true);
      setVerificationToken(result.verificationToken);
      setSuccessMessage(isKo ? "이메일 인증 완료" : "Email verified.");
      setInfoMessage(null);
      setLocalError(null);
    } catch {
      setIsEmailVerified(false);
      setVerificationToken(null);
      setLocalError(isKo ? "인증 실패" : "Verification failed.");
    } finally {
      setIsVerifyingCode(false);
    }
  }

  async function onSubmit() {
    if (!canSubmit || !verificationToken) {
      return;
    }

    setLocalError(null);
    setSuccessMessage(null);
    setInfoMessage(null);

    try {
      const result = await auth.signUp({
        email: normalizedEmail,
        password,
        displayName: displayName.trim(),
        realName: realName.trim(),
        verificationToken
      });

      if (!result.user) {
        setLocalError(isKo ? "회원가입에 실패했습니다. 다시 시도해주세요." : "Sign-up failed. Please try again.");
        return;
      }

      router.replace(redirectTo);
    } catch (error) {
      setLocalError(mapAuthError(error));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{isKo ? "회원가입" : "Sign Up"}</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "사용자명" : "User Name"}</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setDisplayName}
          placeholder={isKo ? "사용자명을 입력하세요" : "Enter your user name"}
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={displayName}
          editable={!isSubmitting}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "실명" : "Real Name"}</Text>
        <TextInput
          autoCorrect={false}
          onChangeText={setRealName}
          placeholder={isKo ? "실명을 입력하세요" : "Enter your real name"}
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={realName}
          editable={!isSubmitting}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "이메일" : "Email"}</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={onEmailChange}
          placeholder="name@example.com"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={email}
          editable={!isSubmitting && !isEmailVerified}
        />
      </View>

      <Pressable
        disabled={!canSendCode}
        onPress={() => void onSendCode()}
        style={[styles.secondaryButton, !canSendCode && styles.buttonDisabled]}
      >
        <Text style={styles.secondaryButtonLabel}>
          {isSendingCode ? (isKo ? "전송 중..." : "Sending...") : isKo ? "인증하기" : "Send Code"}
        </Text>
      </Pressable>

      {infoMessage ? <Text style={styles.errorText}>{infoMessage}</Text> : null}

      {codeRequested ? (
        <>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              {isKo ? "인증 코드 (6자리 숫자)" : "Verification Code (6 digits)"}
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              onChangeText={(value) => {
                setVerificationCode(value.replace(/\D/g, "").slice(0, 6));
                setLocalError(null);
                setSuccessMessage(null);
              }}
              placeholder="000000"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={verificationCode}
              editable={!isSubmitting && !isEmailVerified}
            />
          </View>

          <View style={styles.inlineButtonRow}>
            <Pressable
              disabled={!canVerifyCode}
              onPress={() => void onVerifyCode()}
              style={[styles.secondaryButton, styles.inlineButton, !canVerifyCode && styles.buttonDisabled]}
            >
              <Text style={styles.secondaryButtonLabel}>
                {isVerifyingCode ? (isKo ? "확인 중..." : "Verifying...") : isKo ? "확인" : "Verify"}
              </Text>
            </Pressable>

            <Pressable
              disabled={!canResendCode}
              onPress={() => void onSendCode()}
              style={[styles.secondaryButton, styles.inlineButton, !canResendCode && styles.buttonDisabled]}
            >
              <Text style={styles.secondaryButtonLabel}>{isKo ? "재전송" : "Resend"}</Text>
            </Pressable>
          </View>

          {successMessage ? <Text style={styles.errorText}>{successMessage}</Text> : null}
        </>
      ) : null}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "비밀번호 (최소 6자)" : "Password (min 6 chars)"}</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setPassword}
          placeholder={
            isEmailVerified
              ? isKo
                ? "비밀번호를 입력하세요"
                : "Enter password"
              : isKo
                ? "이메일 인증 후 입력 가능"
                : "Available after email verification"
          }
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={[styles.input, !isEmailVerified && styles.inputDisabled]}
          value={password}
          editable={isEmailVerified && !isSubmitting}
        />
      </View>

      {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
      {!localError && auth.errorMessage ? <Text style={styles.errorText}>{auth.errorMessage}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={() => void onSubmit()}
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
      >
        <Text style={styles.buttonLabel}>
          {isSubmitting ? (isKo ? "가입 중..." : "Signing up...") : isKo ? "회원가입" : "Sign Up"}
        </Text>
      </Pressable>

      <Link asChild href="/auth/sign-in">
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonLabel}>
            {isKo ? "이미 계정이 있나요? 로그인" : "Already have an account? Sign In"}
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
  inputDisabled: {
    backgroundColor: "#f1f5f9",
    color: "#94a3b8"
  },
  inlineButtonRow: {
    flexDirection: "row",
    gap: 10
  },
  inlineButton: {
    flex: 1
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
  infoText: {
    fontSize: 14,
    color: "#0f766e"
  },
  infoErrorText: {
    color: "#b91c1c"
  },
  errorText: {
    fontSize: 14,
    color: "#b91c1c"
  }
});
