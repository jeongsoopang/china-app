import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthSessionProvider } from "../src/features/auth/auth-session";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthSessionProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="verification/school" options={{ title: "School Verification" }} />
          
          
        </Stack>
      </AuthSessionProvider>
    </GestureHandlerRootView>
  );
}
