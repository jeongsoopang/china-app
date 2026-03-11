import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSchoolVerification } from "../../src/features/verification/use-school-verification";

function formatExpiresAt(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

export default function SchoolVerificationScreen() {
  const router = useRouter();
  const {
    state,
    canRequestCode,
    canVerifyCode,
    setSchoolEmail,
    setCode,
    onRequestCode,
    onVerifyCode
  } = useSchoolVerification();

  const isRequesting = state.action === "requesting";
  const isVerifying = state.action === "verifying";
  const isDevelopment = process.env.NODE_ENV !== "production";
  const hasRequestedCode = state.requestResult !== null;
  const expiresAtLabel = formatExpiresAt(state.requestResult?.codeExpiresAt ?? null);
  const verifiedEmail = state.refreshedProfile?.verified_school_email ?? null;
  const verifiedUniversityId = state.refreshedProfile?.verified_university_id ?? null;
  const isVerified = Boolean(verifiedEmail && verifiedUniversityId);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>School Verification</Text>
      <Text style={styles.caption}>
        Verify using your university email. Email delivery remains placeholder for now.
      </Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>School Email</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isRequesting && !isVerifying && !state.isSuccess}
          keyboardType="email-address"
          placeholder="name@university.edu.cn"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={state.schoolEmail}
          onChangeText={setSchoolEmail}
        />
      </View>

      <Pressable
        disabled={!canRequestCode}
        onPress={onRequestCode}
        style={[styles.primaryButton, !canRequestCode && styles.buttonDisabled]}
      >
        <Text style={styles.primaryButtonLabel}>
          {isRequesting ? "Requesting..." : "Request Code"}
        </Text>
      </Pressable>

      {hasRequestedCode && state.requestResult?.university ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Matched University</Text>
          <Text style={styles.cardText}>{state.requestResult.university.name}</Text>
          {state.requestResult.university.shortName ? (
            <Text style={styles.cardSubText}>{state.requestResult.university.shortName}</Text>
          ) : null}
        </View>
      ) : null}

      {hasRequestedCode ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>4-Digit Code</Text>
          <TextInput
            editable={!isRequesting && !isVerifying && !state.isSuccess}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="1234"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={state.code}
            onChangeText={setCode}
          />
        </View>
      ) : null}

      {hasRequestedCode ? (
        <Pressable
          disabled={!canVerifyCode}
          onPress={onVerifyCode}
          style={[styles.secondaryButton, !canVerifyCode && styles.buttonDisabled]}
        >
          <Text style={styles.secondaryButtonLabel}>{isVerifying ? "Verifying..." : "Verify"}</Text>
        </Pressable>
      ) : null}

      {expiresAtLabel ? <Text style={styles.helperText}>Code expires at {expiresAtLabel}</Text> : null}

      {isDevelopment &&
      state.requestResult?.emailDeliverySkipped &&
      state.requestResult?.developmentWarning ? (
        <View style={styles.devWarningBox}>
          <Text style={styles.devWarningTitle}>Development Email Fallback</Text>
          <Text style={styles.devWarningText}>
            Email delivery was skipped: {state.requestResult.developmentWarning}
          </Text>
        </View>
      ) : null}

      {isDevelopment && state.requestResult?.debugCode ? (
        <View style={styles.debugBox}>
          <Text style={styles.debugLabel}>Development Verification Code</Text>
          <Text style={styles.debugCodeValue}>{state.requestResult.debugCode}</Text>
        </View>
      ) : null}

      {state.isSuccess ? (
        <View style={styles.successBox}>
          <Text style={styles.successTitle}>Verification Successful</Text>
          <Text style={styles.successText}>Current profile has been refreshed.</Text>
          <Text style={styles.successText}>
            School verified: {isVerified ? "Yes" : "No"}
          </Text>
          {verifiedEmail ? <Text style={styles.successText}>Email: {verifiedEmail}</Text> : null}
          {verifiedUniversityId ? (
            <Text style={styles.successText}>University ID: {verifiedUniversityId}</Text>
          ) : null}
          <View style={styles.successActions}>
            <Pressable
              onPress={() => router.replace("/(tabs)/me")}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>Back to Me</Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace("/")}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonLabel}>Go to Home</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {state.infoMessage ? <Text style={styles.infoText}>{state.infoMessage}</Text> : null}
      {state.errorMessage ? <Text style={styles.errorText}>{state.errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
    backgroundColor: "#ffffff"
  },
  heading: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a"
  },
  caption: {
    fontSize: 14,
    color: "#475569"
  },
  fieldGroup: {
    gap: 6
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155"
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#0f172a"
  },
  primaryButton: {
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
  buttonDisabled: {
    opacity: 0.5
  },
  primaryButtonLabel: {
    color: "#f8fafc",
    fontWeight: "600"
  },
  secondaryButtonLabel: {
    color: "#0f172a",
    fontWeight: "600"
  },
  helperText: {
    fontSize: 13,
    color: "#64748b"
  },
  debugText: {
    fontSize: 12,
    color: "#7c3aed"
  },
  debugBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#8b5cf6",
    backgroundColor: "#f5f3ff",
    padding: 10,
    gap: 4
  },
  debugLabel: {
    fontSize: 12,
    color: "#6d28d9",
    fontWeight: "600"
  },
  debugCodeValue: {
    fontSize: 24,
    letterSpacing: 3,
    fontWeight: "700",
    color: "#5b21b6"
  },
  successActions: {
    marginTop: 12,
    gap: 10
  },
  devWarningBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    padding: 10,
    gap: 4
  },
  devWarningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400e"
  },
  devWarningText: {
    fontSize: 12,
    color: "#92400e"
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 4
  },
  cardTitle: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600"
  },
  cardText: {
    fontSize: 16,
    color: "#0f172a",
    fontWeight: "600"
  },
  cardSubText: {
    fontSize: 13,
    color: "#475569"
  },
  successBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#16a34a",
    backgroundColor: "#f0fdf4",
    padding: 12,
    gap: 4
  },
  successTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#166534"
  },
  successText: {
    fontSize: 13,
    color: "#166534"
  },
  infoText: {
    fontSize: 14,
    color: "#166534"
  },
  errorText: {
    fontSize: 14,
    color: "#b91c1c"
  }
});
