import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { CityHeroHeader } from "../../src/ui/city-hero-header";
import {
  fetchAnnouncementDetailById,
  mapNotificationsError,
  type AnnouncementDetail
} from "../../src/features/notifications/notifications.service";
import { useNotifications } from "../../src/features/notifications/use-notifications";
import type { NotificationListItem } from "../../src/features/notifications/notifications.types";

function formatCreatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

type NotificationTab = "announcement" | "notification";
const ANNOUNCEMENT_PAPER = require("../../assets/announcements/announcement-letter-paper.png");

function AnnouncementAttachmentImage({ imageUrl }: { imageUrl: string }) {
  const [aspectRatio, setAspectRatio] = useState<number>(4 / 3);

  return (
    <View style={styles.detailImageFrame}>
      <Image
        source={{ uri: imageUrl }}
        resizeMode="contain"
        style={[styles.detailImage, { aspectRatio }]}
        onLoad={({ nativeEvent }) => {
          const width = nativeEvent.source?.width ?? 0;
          const height = nativeEvent.source?.height ?? 0;

          if (width > 0 && height > 0) {
            setAspectRatio(width / height);
          }
        }}
      />
    </View>
  );
}

function AuthenticatedNotificationsContent() {
  const router = useRouter();
  const notifications = useNotifications();
  const [tab, setTab] = useState<NotificationTab>("announcement");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementDetail | null>(null);
  const [isLoadingAnnouncement, setIsLoadingAnnouncement] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  const announcementTypes = useMemo(() => new Set(["announcement", "system"]), []);
  const announcementItems = useMemo(
    () =>
      notifications.state.notifications.filter((notification) =>
        announcementTypes.has(notification.type)
      ),
    [announcementTypes, notifications.state.notifications]
  );
  const personalItems = useMemo(
    () =>
      notifications.state.notifications.filter(
        (notification) => !announcementTypes.has(notification.type)
      ),
    [announcementTypes, notifications.state.notifications]
  );
  const visibleItems = tab === "announcement" ? announcementItems : personalItems;
  const visibleUnreadCount = visibleItems.filter((item) => !item.is_read).length;

  async function handlePressNotification(notification: NotificationListItem) {
    const marked = await notifications.onPressNotification(notification);
    if (!marked) {
      return;
    }

    if (notification.ref_type === "announcement" && notification.ref_id) {
      setAnnouncementError(null);
      setIsLoadingAnnouncement(true);

      try {
        const detail = await fetchAnnouncementDetailById(notification.ref_id);
        setSelectedAnnouncement(detail);
        setTab("announcement");
      } catch (error) {
        setAnnouncementError(mapNotificationsError(error));
      } finally {
        setIsLoadingAnnouncement(false);
      }

      return;
    }

    if (notification.ref_type === "post" && notification.ref_id) {
      router.push({
        pathname: "/posts/[postId]",
        params: {
          postId: notification.ref_id,
          returnTo: "/(tabs)/notifications"
        }
      });
    }
  }

  if (notifications.isLoading && notifications.state.notifications.length === 0) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
          <CityHeroHeader
            title="Notifications"
            height={164}
            imageOffsetY={-10}
            contentOffsetY={8}
          />
          <View style={styles.contentInner}>
            <Text style={styles.text}>Loading notifications...</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <CityHeroHeader
          title="Notifications"
          height={164}
          imageOffsetY={-10}
          contentOffsetY={8}
        />
        <View style={styles.contentInner}>
          <View style={styles.tabRow}>
            <Pressable
              onPress={() => setTab("announcement")}
              style={[styles.tabCard, tab === "announcement" && styles.tabCardActive]}
            >
              <Text style={[styles.tabTitle, tab === "announcement" && styles.tabTitleActive]}>
                Announcement
              </Text>
              <Text style={[styles.tabMeta, tab === "announcement" && styles.tabMetaActive]}>
                {announcementItems.length}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab("notification")}
              style={[styles.tabCard, tab === "notification" && styles.tabCardActive]}
            >
              <Text style={[styles.tabTitle, tab === "notification" && styles.tabTitleActive]}>
                Notification
              </Text>
              <Text style={[styles.tabMeta, tab === "notification" && styles.tabMetaActive]}>
                {personalItems.length}
              </Text>
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Unread: {visibleUnreadCount}</Text>
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

          {announcementError ? <Text style={styles.errorText}>{announcementError}</Text> : null}

          {visibleItems.length === 0 ? (
            <Text style={styles.text}>No notifications yet.</Text>
          ) : (
            <View style={styles.list}>
              {visibleItems.map((notification) => {
                const isPendingItem =
                  notifications.isMarkingOne &&
                  notifications.state.processingNotificationId === notification.id;

                return (
                  <Pressable
                    key={notification.id}
                    disabled={isPendingItem || notifications.isMarkingAll}
                    onPress={() => void handlePressNotification(notification)}
                    style={[
                      styles.card,
                      !notification.is_read && styles.unreadCard,
                      (isPendingItem || notifications.isMarkingAll) && styles.cardDisabled
                    ]}
                  >
                    <ImageBackground
                      source={ANNOUNCEMENT_PAPER}
                      resizeMode="cover"
                      style={styles.cardPaper}
                      imageStyle={styles.cardPaperImage}
                    >
                      <View
                        style={[
                          styles.cardContentOverlay,
                          !notification.is_read && styles.cardContentOverlayUnread
                        ]}
                      >
                        <View style={styles.cardHeader}>
                          <Text style={styles.cardTitle}>{notification.title}</Text>
                          <Text style={styles.statusText}>
                            {isPendingItem ? "Marking..." : notification.is_read ? "Read" : "Unread"}
                          </Text>
                        </View>
                        <Text style={styles.cardMessage}>{notification.body}</Text>
                        <Text style={styles.cardMeta}>{formatCreatedAt(notification.created_at)}</Text>
                      </View>
                    </ImageBackground>
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
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(selectedAnnouncement) || isLoadingAnnouncement}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isLoadingAnnouncement) {
            setSelectedAnnouncement(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ImageBackground
              source={ANNOUNCEMENT_PAPER}
              resizeMode="cover"
              style={styles.modalPaper}
              imageStyle={styles.modalPaperImage}
            >
              <View style={styles.modalPaperOverlay}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailBadge}>공지 상세</Text>
                  <Pressable
                    onPress={() => {
                      if (!isLoadingAnnouncement) {
                        setSelectedAnnouncement(null);
                      }
                    }}
                  >
                    <Text style={styles.detailClose}>닫기</Text>
                  </Pressable>
                </View>

                {isLoadingAnnouncement ? (
                  <Text style={styles.detailLoading}>공지 내용을 불러오는 중...</Text>
                ) : selectedAnnouncement ? (
                  <ScrollView
                    style={styles.detailContentScroll}
                    contentContainerStyle={styles.detailContentContainer}
                  >
                    <Text style={styles.detailTitle}>{selectedAnnouncement.title}</Text>
                    {selectedAnnouncement.outline ? (
                      <Text style={styles.detailOutline}>{selectedAnnouncement.outline}</Text>
                    ) : null}
                    <Text style={styles.detailMeta}>
                      {formatCreatedAt(selectedAnnouncement.published_at ?? selectedAnnouncement.created_at)}
                    </Text>
                    {selectedAnnouncement.image_urls.length > 0 ? (
                      <View style={styles.detailImageList}>
                        {selectedAnnouncement.image_urls.map((imageUrl) => (
                          <AnnouncementAttachmentImage key={imageUrl} imageUrl={imageUrl} />
                        ))}
                      </View>
                    ) : null}
                    {selectedAnnouncement.body ? (
                      <Text style={styles.detailBody}>{selectedAnnouncement.body}</Text>
                    ) : null}
                  </ScrollView>
                ) : null}
              </View>
            </ImageBackground>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function NotificationsScreen() {
  const auth = useAuthSession();

  if (auth.isLoading) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
          <CityHeroHeader
            title="Notifications"
            height={164}
            imageOffsetY={-10}
            contentOffsetY={8}
          />
          <View style={[styles.contentInner, styles.statusBlock]}>
            <Text style={styles.text}>Checking session...</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!auth.isSignedIn) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container}>
          <CityHeroHeader
            title="Notifications"
            height={164}
            imageOffsetY={-10}
            contentOffsetY={8}
          />
          <View style={[styles.contentInner, styles.statusBlock]}>
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
        </ScrollView>
      </View>
    );
  }

  return <AuthenticatedNotificationsContent />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc"
  },
  container: {
    paddingBottom: 20,
    gap: 12,
    backgroundColor: "#f8fafc"
  },
  contentInner: {
    paddingHorizontal: 20,
    gap: 12
  },
  statusBlock: {
    gap: 10
  },
  text: {
    fontSize: 15,
    color: "#334155"
  },
  tabRow: {
    flexDirection: "row",
    gap: 10
  },
  tabCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4
  },
  tabCardActive: {
    borderColor: "#0f172a",
    backgroundColor: "#f1f5f9"
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155"
  },
  tabTitleActive: {
    color: "#0f172a"
  },
  tabMeta: {
    fontSize: 12,
    color: "#64748b"
  },
  tabMetaActive: {
    color: "#0f172a"
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
    borderColor: "#d6c8ad",
    borderRadius: 14,
    backgroundColor: "#f7f0df",
    overflow: "hidden"
  },
  cardPaper: {
    borderRadius: 14
  },
  cardPaperImage: {
    borderRadius: 14
  },
  cardContentOverlay: {
    backgroundColor: "rgba(255, 252, 245, 0.82)",
    padding: 12,
    gap: 6
  },
  cardContentOverlayUnread: {
    backgroundColor: "rgba(255, 250, 238, 0.90)"
  },
  unreadCard: {
    borderColor: "#8a6b3e"
  },
  cardDisabled: {
    opacity: 0.6
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start"
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a"
  },
  statusText: {
    fontSize: 12,
    color: "#64748b"
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
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#94a3b8",
    paddingVertical: 10,
    backgroundColor: "#ffffff"
  },
  refreshButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155"
  },
  infoText: {
    fontSize: 13,
    color: "#0f766e"
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "center",
    padding: 20
  },
  modalCard: {
    maxHeight: "78%",
    borderWidth: 1,
    borderColor: "#8a6b3e",
    borderRadius: 16,
    backgroundColor: "#f7f0df",
    overflow: "hidden"
  },
  modalPaper: {
    borderRadius: 16
  },
  modalPaperImage: {
    borderRadius: 16
  },
  modalPaperOverlay: {
    padding: 16,
    gap: 8,
    backgroundColor: "rgba(255, 252, 245, 0.86)"
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  detailBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a"
  },
  detailClose: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  detailLoading: {
    fontSize: 14,
    color: "#475569"
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a"
  },
  detailOutline: {
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
    fontWeight: "700"
  },
  detailMeta: {
    fontSize: 12,
    color: "#64748b"
  },
  detailContentScroll: {
    maxHeight: 500
  },
  detailContentContainer: {
    gap: 10,
    paddingBottom: 6
  },
  detailImageList: {
    gap: 10
  },
  detailImageFrame: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2d7bd",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    overflow: "hidden"
  },
  detailImage: {
    width: "100%"
  },
  detailBody: {
    fontSize: 15,
    lineHeight: 24,
    color: "#0f172a"
  }
});
