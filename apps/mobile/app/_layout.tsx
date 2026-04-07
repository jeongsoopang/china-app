import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthSessionProvider } from "../src/features/auth/auth-session";
import { AppLanguageProvider } from "../src/features/language/app-language";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppLanguageProvider>
        <AuthSessionProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="posts/[postId]"
              options={{
                headerShown: false,
                gestureEnabled: true,
                fullScreenGestureEnabled: true
              }}
            />
            <Stack.Screen
              name="qa/[qaId]"
              options={{
                headerShown: false,
                gestureEnabled: true,
                fullScreenGestureEnabled: true
              }}
            />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="verification/school" options={{ title: "School Verification" }} />
          </Stack>
        </AuthSessionProvider>
      </AppLanguageProvider>
    </GestureHandlerRootView>
  );
}
