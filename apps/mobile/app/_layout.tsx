import { Stack } from "expo-router";
import { AuthSessionProvider } from "../src/features/auth/auth-session";

export default function RootLayout() {
  return (
    <AuthSessionProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="universities/[universityId]" options={{ title: "University" }} />
        <Stack.Screen name="posts/[postId]" options={{ title: "Post" }} />
        <Stack.Screen name="qa/[qaId]" options={{ title: "Q&A" }} />
        <Stack.Screen name="verification/school" options={{ title: "School Verification" }} />
        <Stack.Screen name="auth/sign-in" options={{ title: "Sign In" }} />
        <Stack.Screen name="auth/sign-up" options={{ title: "Sign Up" }} />
      </Stack>
    </AuthSessionProvider>
  );
}
