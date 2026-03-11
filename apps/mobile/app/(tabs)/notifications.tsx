import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { useNotifications } from "../../src/features/notifications/use-notifications";

function formatCreatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function AuthenticatedNotificationsContent() {
  const notifications = useNotifications();

  if (notifications.isLoading && notifications.state.notifications.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Notifications</Text>
        <Text style={styles.text}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Notifications</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Unread: {notifications.unreadCount}</Text>
        <Pressable
          disabled={!notifications.canMarkAllAsRead}
          onPress={notifications.onMarkAllAsRead}
          style={[
            styles.markAllButton,
            !notifications.canMarkAllAsRead && styles.markAllButtonDisabled
          ]}
        >
          <Text style={styles.markAllButtonLabel}>
            {notifications.isMarkingAll ? "Marking..." : "Mark all as read"}
          </Text>
        </Pressable>
      </View>

      {notifications.state.notifications.length === 0 ? (
        <Text style={styles.text}>No notifications yet.</Text>
      ) : (
        <View style={styles.list}>
          {notifications.state.notifications.map((notification) => {
            const isPendingItem =
              notifications.isMarkingOne &&
              notifications.state.processingNotificationId === notification.id;

            return (
              <Pressable
                key={notification.id}
                disabled={notification.is_read || isPendingItem || notifications.isMarkingAll}
                onPress={() => notifications.onPressNotification(notification.id)}
                style={[
                  styles.card,
                  !notification.is_read && styles.unreadCard,
                  (notification.is_read || isPendingItem || notifications.isMarkingAll) &&
                    styles.cardDisabled
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{notification.title}</Text>
                  <Text style={styles.statusText}>
                    {isPendingItem ? "Marking..." : notification.is_read ? "Read" : "Unread"}
                  </Text>
                </View>
                <Text style={styles.cardMessage}>{notification.message}</Text>
                <Text style={styles.cardMeta}>
                  {notification.type} · {formatCreatedAt(notification.created_at)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable onPress={notifications.refresh} style={styles.refreshButton}>
        <Text style={styles.refreshButtonLabel}>Refresh</Text>
      </Pressable>

      {notifications.state.infoMessage ? (
        <Text style={styles.infoText}>{notifications.state.infoMessage}</Text>
      ) : null}
      {notifications.state.errorMessage ? (
        <Text style={styles.errorText}>{notifications.state.errorMessage}</Text>
      ) : null}
    </ScrollView>
  );
}

export default function NotificationsScreen() {
  const auth = useAuthSession();

  if (auth.isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Notifications</Text>
        <Text style={styles.text}>Checking session...</Text>
      </View>
    );
  }

  if (!auth.isSignedIn) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Notifications</Text>
        <Text style={styles.text}>Sign in to view your notifications.</Text>
        <Link
          href={{
            pathname: "/auth/sign-in",
            params: { redirectTo: "/(tabs)/notifications" }
          }}
          style={styles.authLink}
        >
          Sign In
        </Link>
      </View>
    );
  }

  return <AuthenticatedNotificationsContent />;
}

const styles = StyleSheet.create({
  container: {
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
  authLink: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600"
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  metaText: {
    fontSize: 13,
    color: "#475569"
  },
  markAllButton: {
    borderWidth: 1,
    borderColor: "#0f172a",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  markAllButtonDisabled: {
    opacity: 0.5
  },
  markAllButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a"
  },
  list: {
    gap: 10
  },
  card: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 6
  },
  unreadCard: {
    borderColor: "#0f172a",
    backgroundColor: "#f1f5f9"
  },
  cardDisabled: {
    opacity: 0.75
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a"
  },
  statusText: {
    fontSize: 12,
    color: "#475569"
  },
  cardMessage: {
    fontSize: 14,
    color: "#334155"
  },
  cardMeta: {
    fontSize: 12,
    color: "#64748b"
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  refreshButtonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155"
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
