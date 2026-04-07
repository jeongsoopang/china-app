import { Ionicons } from "@expo/vector-icons";
import { Tabs, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius } from "../../src/ui/theme";

function DetailBackHeaderButton() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();

  const rawReturnTo = params.returnTo;
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

  return (
    <Pressable
      onPress={() => {
        if (returnTo) {
          router.replace(returnTo as never);
          return;
        }

        if (router.canGoBack()) {
          router.back();
          return;
        }

        router.replace("/(tabs)" as never);
      }}
      style={styles.backButton}
    >
      <Ionicons name="chevron-back" size={20} color="#111827" />
      <Text style={styles.backButtonLabel}>Back</Text>
    </Pressable>
  );
}

function CampusBackHeaderButton() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    universityId?: string | string[];
    returnTo?: string | string[];
  }>();

  const rawReturnTo = params.returnTo;
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

  const rawUniversityId = params.universityId;
  const universityId = Array.isArray(rawUniversityId) ? rawUniversityId[0] : rawUniversityId;

  return (
    <Pressable
      onPress={() => {
        if (returnTo) {
          router.replace(returnTo as never);
          return;
        }

        if (universityId) {
          router.replace(`/universities/${universityId}` as never);
          return;
        }

        router.replace("/(tabs)" as never);
      }}
      style={styles.backButton}
    >
      <Ionicons name="chevron-back" size={20} color="#111827" />
      <Text style={styles.backButtonLabel}>Back</Text>
    </Pressable>
  );
}

function UniversityDetailBackHeaderButton() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();

  const rawReturnTo = params.returnTo;
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

  return (
    <Pressable
      onPress={() => {
        if (returnTo) {
          router.replace(returnTo as never);
          return;
        }

        router.replace("/home/universities" as never);
      }}
      style={styles.backButton}
    >
      <Ionicons name="chevron-back" size={20} color="#111827" />
      <Text style={styles.backButtonLabel}>Back</Text>
    </Pressable>
  );
}

function MyPostsBackHeaderButton() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();

  const rawReturnTo = params.returnTo;
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

  return (
    <Pressable
      onPress={() => {
        if (returnTo) {
          router.replace(returnTo as never);
          return;
        }

        router.replace("/me" as never);
      }}
      style={styles.backButton}
    >
      <Ionicons name="chevron-back" size={20} color="#111827" />
      <Text style={styles.backButtonLabel}>Back</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        headerStyle: {
          backgroundColor: colors.background
        },
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.92)",
          borderTopColor: "rgba(176,196,220,0.44)",
          borderTopWidth: 1,
          height: 64,
          paddingTop: 8,
          paddingBottom: 8
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "LUCL",
          tabBarLabel: "Home",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          )
        }}
      />

      <Tabs.Screen
        name="compose"
        options={{
          title: "New Post",
          tabBarLabel: "New Post",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "add-circle" : "add-circle-outline"}
              size={size}
              color={color}
            />
          )
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "heart" : "heart-outline"}
              size={size}
              color={color}
            />
          )
        }}
      />

      <Tabs.Screen
        name="me"
        options={{
          title: "My",
          tabBarLabel: "My",
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={size}
              color={color}
            />
          )
        }}
      />

      <Tabs.Screen
        name="fun"
        options={{
          href: null,
          title: "",
          headerShown: false
        }}
      />

      <Tabs.Screen
        name="home/universities"
        options={{
          href: null,
          title: "",
          headerShown: false
        }}
      />

      <Tabs.Screen
        name="home/event-hotspots"
        options={{
          href: null,
          title: "",
          headerShown: false
        }}
      />

      <Tabs.Screen
        name="home/shanghai"
        options={{
          href: null,
          title: "",
          headerShown: false
        }}
      />

      <Tabs.Screen
        name="home/shanghai-food"
        options={{
          href: null,
          title: "",
          headerShown: false
        }}
      />

      <Tabs.Screen
        name="home/shanghai-place"
        options={{
          href: null,
          title: "",
          headerShown: false
        }}
      />

      <Tabs.Screen
        name="home/shanghai-church"
        options={{
          href: null,
          title: "",
          headerShown: false
        }}
      />

      <Tabs.Screen
        name="home/search"
        options={{
          href: null,
          title: "Search Results",
          headerLeft: () => <DetailBackHeaderButton />
        }}
      />

      <Tabs.Screen
        name="home/shanghai-cafe"
        options={{
          href: null,
          title: "",
          headerShown: false
        }}
      />

      <Tabs.Screen
        name="home/shanghai-landmark"
        options={{
          href: null,
          title: "",
          headerShown: false
        }}
      />

      <Tabs.Screen
        name="universities/[universityId]"
        options={{
          href: null,
          title: "University",
          headerLeft: () => <UniversityDetailBackHeaderButton />
        }}
      />

      <Tabs.Screen
        name="universities/[universityId]/study/[degree]"
        options={{
          href: null,
          title: "Study",
          headerShown: false
        }}
      />

      <Tabs.Screen
        name="universities/[universityId]/study/[degree]/category/[categorySlug]"
        options={{
          href: null,
          title: "Study",
          headerShown: false
        }}
      />

      <Tabs.Screen
        name="universities/[universityId]/campus/[campusSlug]"
        options={{
          href: null,
          title: "Campus",
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="universities/[universityId]/qa/[categorySlug]"
        options={{
          href: null,
          title: "Q&A",
          headerLeft: () => <DetailBackHeaderButton />
        }}
      />

      <Tabs.Screen
        name="universities/[universityId]/search"
        options={{
          href: null,
          title: "Search",
          headerLeft: () => <DetailBackHeaderButton />
        }}
      />
      <Tabs.Screen
        name="my-posts"
        options={{
          href: null,
          title: "My Posts",
          headerLeft: () => <MyPostsBackHeaderButton />
        }}
      />

      <Tabs.Screen
        name="users/[userId]"
        options={{
          href: null,
          title: "Profile",
          headerLeft: () => <DetailBackHeaderButton />
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(176,196,220,0.44)"
  },
  backButtonLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary
  }
});
