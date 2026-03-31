import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  type ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { useAppLanguage } from "../../src/features/language/app-language";
import {
  DEFAULT_HOME_GUIDE_CONTENT,
  fetchHomeGuideContent
} from "../../src/features/home/home-guide.service";
import {
  fetchLatestHomePopupAnnouncement,
  type AnnouncementDetail
} from "../../src/features/notifications/notifications.service";
import { CityHeroHeader } from "../../src/ui/city-hero-header";
import { colors, radius, spacing, typography } from "../../src/ui/theme";

type LogoKey = "sjtu" | "fudan" | "tongji" | "sufe" | "sisu" | "ecnu";
type ExploreCardKey = "event" | "universities" | "shanghai";
type QuickActionKey = "my-school" | "campus-notice" | "my-posts";

const LOGO_ASSETS: Record<LogoKey, ImageSourcePropType> = {
  sjtu: require("../../assets/home/logos/sjtu.png"),
  fudan: require("../../assets/home/logos/fudan.png"),
  tongji: require("../../assets/home/logos/tongji.png"),
  sufe: require("../../assets/home/logos/sufe.png"),
  sisu: require("../../assets/home/logos/sisu.png"),
  ecnu: require("../../assets/home/logos/ecnu.png")
};

const CARD_ASSETS: Record<ExploreCardKey, ImageSourcePropType> = {
  event: require("../../assets/home/cards/event-hotspots-card.png"),
  universities: require("../../assets/home/cards/universities-card.png"),
  shanghai: require("../../assets/home/cards/shanghai-card.png")
};

const SCHOOL_LOGOS: Array<{ key: LogoKey; label: string }> = [
  { key: "sjtu", label: "SJTU" },
  { key: "fudan", label: "Fudan" },
  { key: "tongji", label: "Tongji" },
  { key: "sufe", label: "SUFE" },
  { key: "sisu", label: "SISU" },
  { key: "ecnu", label: "ECNU" }
];

const CARDS: Array<{ key: ExploreCardKey; title: string; subtitle: string; route: string }> = [
  {
    key: "event",
    title: "Event 맛집",
    subtitle: "City events and local highlights",
    route: "/home/event-hotspots"
  },
  {
    key: "universities",
    title: "Universities",
    subtitle: "Campus life across Shanghai",
    route: "/home/universities"
  },
  {
    key: "shanghai",
    title: "Shanghai",
    subtitle: "Food, place, and church",
    route: "/home/shanghai"
  }
];

const QUICK_ACTIONS: Array<{
  key: QuickActionKey;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "my-school", icon: "school-outline" },
  { key: "campus-notice", icon: "megaphone-outline" },
  { key: "my-posts", icon: "document-text-outline" }
];

const HOME_POPUP_HIDE_UNTIL_STORAGE_KEY = "@lucl/home_announcement_hide_until_v1";
const HOME_POPUP_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HOME_GUIDE_HIDE_UNTIL_STORAGE_KEY = "@lucl/home_guide_hide_until_v1";
const HOME_GUIDE_DISMISSED_FOREVER_STORAGE_KEY = "@lucl/home_guide_dismissed_forever_v1";
const HOME_GUIDE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HOME_GUIDE_IMAGE_URL =
  "https://pdlgnrutisyenrcdetxm.supabase.co/storage/v1/object/public/home-guide/home-guide.png";

function getAnnouncementVersionKey(announcement: AnnouncementDetail): string {
  const version = announcement.updated_at ?? announcement.published_at ?? announcement.created_at ?? "";
  return `${announcement.id}:${version}`;
}

async function readHomePopupHideUntilMap(): Promise<Record<string, number>> {
  const raw = await AsyncStorage.getItem(HOME_POPUP_HIDE_UNTIL_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, number> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        next[key] = value;
      }
    });
    return next;
  } catch {
    return {};
  }
}

async function readHomeGuideHideUntil(): Promise<number> {
  const raw = await AsyncStorage.getItem(HOME_GUIDE_HIDE_UNTIL_STORAGE_KEY);
  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

async function readHomeGuideDismissedForever(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(HOME_GUIDE_DISMISSED_FOREVER_STORAGE_KEY);
  return raw === "true";
}

export default function HomeScreen() {
  const auth = useAuthSession();
  const { resolvedLanguage, setLanguageMode } = useAppLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cardScrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const quickActionsAnim = useRef(new Animated.Value(0)).current;
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [isGuideModalVisible, setIsGuideModalVisible] = useState(false);
  const [isAnnouncementModalVisible, setIsAnnouncementModalVisible] = useState(false);
  const [homeGuideContent, setHomeGuideContent] = useState(DEFAULT_HOME_GUIDE_CONTENT);
  const [homeAnnouncement, setHomeAnnouncement] = useState<AnnouncementDetail | null>(null);
  const [homePopupHideUntilMap, setHomePopupHideUntilMap] = useState<Record<string, number>>({});
  const [isHomeEntryDataReady, setIsHomeEntryDataReady] = useState(false);
  const [isGuideDismissedForSession, setIsGuideDismissedForSession] = useState(false);
  const [homeGuideHideUntil, setHomeGuideHideUntil] = useState(0);
  const [isHomeGuideDismissedForever, setIsHomeGuideDismissedForever] = useState(false);
  const [sessionDismissedAnnouncementKey, setSessionDismissedAnnouncementKey] = useState<string | null>(null);

  const cardWidth = Math.min(Math.max(width - 110, 240), 290);
  const cardGap = spacing.md;
  const snapStep = cardWidth + cardGap;
  const sidePadding = Math.max((width - cardWidth) / 2, spacing.lg);
  const verifiedUniversityId = auth.user?.profile?.verified_university_id ?? null;
  const hasVerifiedSchool = Boolean(verifiedUniversityId);
  const isKo = resolvedLanguage === "ko";

  function getCardTitle(key: ExploreCardKey): string {
    if (key === "event") {
      return isKo ? "이벤트 맛집" : "Event Hotspots";
    }
    if (key === "universities") {
      return isKo ? "대학" : "Universities";
    }
    return isKo ? "상하이" : "Shanghai";
  }

  function getCardSubtitle(key: ExploreCardKey): string {
    if (key === "event") {
      return isKo ? "도시 이벤트와 로컬 하이라이트" : "City events and local highlights";
    }
    if (key === "universities") {
      return isKo ? "상하이 캠퍼스 생활" : "Campus life across Shanghai";
    }
    return isKo ? "맛집, 장소, 교회" : "Food, place, and church";
  }

  function getQuickActionLabel(key: QuickActionKey): string {
    if (key === "my-school") {
      return isKo ? "내 학교" : "My School";
    }
    if (key === "campus-notice") {
      return isKo ? "공지" : "Notice";
    }
    return isKo ? "내 글" : "My Page";
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      cardScrollRef.current?.scrollTo({
        x: snapStep,
        y: 0,
        animated: false
      });
    }, 10);

    return () => clearTimeout(timeout);
  }, [snapStep]);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeEntryData() {
      try {
        const [content, latestHomePopup, hideMap, guideHideUntil, guideDismissedForever] = await Promise.all([
          fetchHomeGuideContent(),
          fetchLatestHomePopupAnnouncement(),
          readHomePopupHideUntilMap(),
          readHomeGuideHideUntil(),
          readHomeGuideDismissedForever()
        ]);

        if (!cancelled) {
          setHomeGuideContent(content);
          setHomeAnnouncement(latestHomePopup);
          setHomePopupHideUntilMap(hideMap);
          setHomeGuideHideUntil(guideHideUntil);
          setIsHomeGuideDismissedForever(guideDismissedForever);
          setIsGuideDismissedForSession(false);
          setIsHomeEntryDataReady(true);
        }
      } catch {
        if (!cancelled) {
          setHomePopupHideUntilMap({});
          setHomeGuideHideUntil(0);
          setIsHomeGuideDismissedForever(false);
          setIsGuideDismissedForSession(false);
          setIsHomeEntryDataReady(true);
        }
      }
    }

    void loadHomeEntryData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHomeEntryDataReady) {
      return;
    }

    const announcementKey = homeAnnouncement ? getAnnouncementVersionKey(homeAnnouncement) : null;
    const now = Date.now();
    const isHiddenForWeek =
      announcementKey !== null && (homePopupHideUntilMap[announcementKey] ?? 0) > now;
    const isSessionDismissed = announcementKey !== null && sessionDismissedAnnouncementKey === announcementKey;
    const isGuideHiddenForWeek = homeGuideHideUntil > now;

    if (announcementKey && !isHiddenForWeek && !isSessionDismissed) {
      setIsAnnouncementModalVisible(true);
      setIsGuideModalVisible(false);
      return;
    }

    if (
      homeGuideContent.isVisible &&
      !isGuideDismissedForSession &&
      !isGuideHiddenForWeek &&
      !isHomeGuideDismissedForever
    ) {
      setIsGuideModalVisible(true);
      return;
    }

    setIsGuideModalVisible(false);
  }, [
    homeGuideContent.isVisible,
    homeAnnouncement,
    homeGuideHideUntil,
    homePopupHideUntilMap,
    isGuideDismissedForSession,
    isHomeGuideDismissedForever,
    isHomeEntryDataReady,
    sessionDismissedAnnouncementKey
  ]);

  function submitGlobalSearch() {
    const query = searchInput.trim();
    if (!query) {
      return;
    }

    router.push({
      pathname: "/home/search",
      params: { q: query, returnTo: "/(tabs)" }
    });
  }

  function toggleQuickActions() {
    const nextOpen = !isQuickActionsOpen;
    setIsQuickActionsOpen(nextOpen);

    Animated.timing(quickActionsAnim, {
      toValue: nextOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }

  async function closeAnnouncementForWeek() {
    if (!homeAnnouncement) {
      setIsAnnouncementModalVisible(false);
      return;
    }

    const key = getAnnouncementVersionKey(homeAnnouncement);
    const nextMap = {
      ...homePopupHideUntilMap,
      [key]: Date.now() + HOME_POPUP_WEEK_MS
    };

    setHomePopupHideUntilMap(nextMap);
    setSessionDismissedAnnouncementKey(key);
    setIsAnnouncementModalVisible(false);
    await AsyncStorage.setItem(HOME_POPUP_HIDE_UNTIL_STORAGE_KEY, JSON.stringify(nextMap));
  }

  function closeAnnouncementForSession() {
    if (homeAnnouncement) {
      setSessionDismissedAnnouncementKey(getAnnouncementVersionKey(homeAnnouncement));
    }
    setIsAnnouncementModalVisible(false);
  }

  function closeGuideForSession() {
    setIsGuideDismissedForSession(true);
    setIsGuideModalVisible(false);
  }

  async function hideGuideForWeek() {
    const hideUntil = Date.now() + HOME_GUIDE_WEEK_MS;
    setHomeGuideHideUntil(hideUntil);
    setIsGuideModalVisible(false);
    await AsyncStorage.setItem(HOME_GUIDE_HIDE_UNTIL_STORAGE_KEY, String(hideUntil));
  }

  async function dismissGuideForever() {
    setIsHomeGuideDismissedForever(true);
    setIsGuideModalVisible(false);
    await AsyncStorage.setItem(HOME_GUIDE_DISMISSED_FOREVER_STORAGE_KEY, "true");
  }

  async function handleQuickActionPress(actionKey: QuickActionKey) {
    if (actionKey === "campus-notice") {
      try {
        let targetAnnouncement = homeAnnouncement;
        if (!targetAnnouncement) {
          targetAnnouncement = await fetchLatestHomePopupAnnouncement();
          if (targetAnnouncement) {
            setHomeAnnouncement(targetAnnouncement);
          }
        }

        if (targetAnnouncement) {
          setIsAnnouncementModalVisible(true);
        }
      } catch {
        setIsAnnouncementModalVisible(false);
      }
      return;
    }

    if (actionKey === "my-posts") {
      router.push({
        pathname: "/my-posts",
        params: { returnTo: "/(tabs)" }
      });
      return;
    }

    if (!verifiedUniversityId) {
      return;
    }

    if (actionKey === "my-school") {
      router.push({
        pathname: "/universities/[universityId]",
        params: { universityId: String(verifiedUniversityId) }
      });
      return;
    }

    router.push({
      pathname: "/universities/[universityId]",
      params: { universityId: String(verifiedUniversityId), section: "notice" }
    });
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <CityHeroHeader
          title="LUCL"
          subtitle="Link Your China Life"
          height={164}
          imageOffsetY={-10}
          contentOffsetY={8}
          contentStyle={styles.heroContentCentered}
        />

        <View style={styles.languageToggleRow}>
          <Pressable
            onPress={() => void setLanguageMode("ko")}
            style={[styles.languageToggleButton, isKo && styles.languageToggleButtonSelected]}
          >
            <Text style={[styles.languageToggleLabel, isKo && styles.languageToggleLabelSelected]}>KR</Text>
          </Pressable>
          <Pressable
            onPress={() => void setLanguageMode("en")}
            style={[styles.languageToggleButton, !isKo && styles.languageToggleButtonSelected]}
          >
            <Text style={[styles.languageToggleLabel, !isKo && styles.languageToggleLabelSelected]}>EN</Text>
          </Pressable>
        </View>

        <View style={styles.logoRow}>
          {SCHOOL_LOGOS.map((school) => (
            <View key={school.key} style={styles.logoButton}>
              <Image source={LOGO_ASSETS[school.key]} style={styles.logoImage} resizeMode="contain" />
            </View>
          ))}
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={submitGlobalSearch}
            placeholder={isKo ? "LUCL 전체 검색" : "Search across LUCL"}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          <Pressable onPress={submitGlobalSearch} style={styles.searchActionButton}>
            <Text style={styles.searchActionButtonLabel}>{isKo ? "검색" : "Go"}</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={cardScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={snapStep}
          snapToAlignment="start"
          contentContainerStyle={{
            paddingHorizontal: sidePadding,
            gap: cardGap
          }}
        >
          {CARDS.map((card) => (
            <Pressable
              key={card.key}
              onPress={() =>
                router.push({
                  pathname: card.route as never,
                  params: { returnTo: "/(tabs)" }
                })
              }
              style={[styles.carouselCard, { width: cardWidth }]}
            >
              <View style={styles.cardImage}>
                <Image source={CARD_ASSETS[card.key]} style={styles.cardImageAsset} resizeMode="cover" />
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.cardTitle}>{getCardTitle(card.key)}</Text>
                <Text style={styles.cardSubtitle}>{getCardSubtitle(card.key)}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>

      <View
        style={[styles.quickActionsRoot, { bottom: Math.max(insets.bottom - 32, -12), transform: [{ scale: 0.92 }] }]}
        pointerEvents="box-none"
      >
        <View style={styles.quickActionsRow}>
          <Animated.View
            style={[
              styles.quickActionsTrack,
              {
                opacity: quickActionsAnim,
                transform: [
                  {
                    translateX: quickActionsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0]
                    })
                  },
                  {
                    scale: quickActionsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1]
                    })
                  }
                ]
              }
            ]}
            pointerEvents={isQuickActionsOpen ? "auto" : "none"}
          >
            {QUICK_ACTIONS.map((action) => {
              const schoolDependent = action.key === "my-school";
              const disabled = schoolDependent && !hasVerifiedSchool;
              return (
                <View key={action.key} style={styles.quickActionItem}>
                  <Pressable
                    onPress={() => void handleQuickActionPress(action.key)}
                    disabled={disabled}
                    style={[styles.quickActionButton, disabled && styles.quickActionButtonDisabled]}
                  >
                    <Ionicons name={action.icon} size={18} color={disabled ? colors.textMuted : colors.accent} />
                  </Pressable>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="clip"
                    style={[styles.quickActionLabel, disabled && styles.quickActionDisabledLabel]}
                  >
                    {getQuickActionLabel(action.key)}
                  </Text>
                </View>
              );
            })}
          </Animated.View>

          <Pressable onPress={toggleQuickActions} style={styles.quickMainButton}>
            <Text style={styles.quickMainButtonLabel}>{isQuickActionsOpen ? ">>" : "<<"}</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={isAnnouncementModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeAnnouncementForSession}
      >
        <View style={styles.homeAnnouncementBackdrop}>
          <View style={styles.homeAnnouncementCard}>
            <View style={styles.homeAnnouncementHeader}>
              <Text style={styles.homeAnnouncementBadge}>{isKo ? "홈 공지" : "Home Announcement"}</Text>
              <Pressable onPress={closeAnnouncementForSession}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
            <Text style={styles.homeAnnouncementTitle}>{homeAnnouncement?.title ?? ""}</Text>
            {homeAnnouncement?.outline ? (
              <Text style={styles.homeAnnouncementOutline}>{homeAnnouncement.outline}</Text>
            ) : null}
            <ScrollView
              style={styles.homeAnnouncementBodyScroll}
              contentContainerStyle={styles.homeAnnouncementBodyContent}
            >
              <Text style={styles.homeAnnouncementBody}>{homeAnnouncement?.body ?? ""}</Text>
            </ScrollView>
            <View style={styles.homeAnnouncementActions}>
              <Pressable style={styles.homeAnnouncementActionGhost} onPress={closeAnnouncementForSession}>
                <Text style={styles.homeAnnouncementActionGhostLabel}>{isKo ? "닫기" : "Close"}</Text>
              </Pressable>
              <Pressable style={styles.homeAnnouncementActionPrimary} onPress={() => void closeAnnouncementForWeek()}>
                <Text style={styles.homeAnnouncementActionPrimaryLabel}>
                  {isKo ? "일주일간 닫기" : "Hide for 1 week"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isGuideModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeGuideForSession}
      >
        <View style={styles.guideModalBackdrop}>
          <Pressable style={styles.guideBackdropDismissArea} onPress={closeGuideForSession} />
          <View
            style={[
              styles.guideModalSheet,
              {
                paddingBottom: Math.max(insets.bottom + 14, 20),
                paddingTop: Math.max(insets.top + 12, 20)
              }
            ]}
          >
            <ScrollView contentContainerStyle={styles.guideModalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.guideLetterCard}>
                <View style={styles.guideCloseRow}>
                  <Pressable
                    style={styles.guideCloseButton}
                    onPress={closeGuideForSession}
                    hitSlop={8}
                    accessibilityLabel={isKo ? "이번 세션에서 가이드 닫기" : "Close guide for this session"}
                  >
                    <Ionicons name="close" size={20} color={colors.textPrimary} />
                  </Pressable>
                </View>
                <Text style={styles.guideModalEyebrow}>{isKo ? "가이드 노트" : "Guide note"}</Text>
                <Text style={styles.guideModalTitle}>{homeGuideContent.title}</Text>

                <View style={styles.guideModalImageFrame}>
                  <Image
                    source={{ uri: HOME_GUIDE_IMAGE_URL }}
                    style={styles.guideModalImage}
                    resizeMode="cover"
                  />
                </View>

                <Text style={styles.guideModalBody}>{homeGuideContent.body}</Text>
                <Text style={styles.guideModalSignature}>{isKo ? "LUCL 팀" : "LUCL Team"}</Text>
                <View style={styles.guideActionsRow}>
                  <Pressable style={styles.guideSnoozeButton} onPress={() => void hideGuideForWeek()}>
                    <Text style={styles.guideSnoozeButtonLabel}>
                      {isKo ? "일주일간 보지 않기" : "Hide for 1 week"}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.guideDismissButton} onPress={() => void dismissGuideForever()}>
                    <Text style={styles.guideDismissButtonLabel}>
                      {isKo ? "다시 보지 않기" : "Don't show again"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  container: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  heroContentCentered: {
    justifyContent: "center",
    alignItems: "center"
  },
  languageToggleRow: {
    marginHorizontal: spacing.lg,
    marginTop: -4,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8
  },
  languageToggleButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(173,194,220,0.72)",
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  languageToggleButtonSelected: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary
  },
  languageToggleLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textPrimary
  },
  languageToggleLabelSelected: {
    color: "#f8fafc"
  },
  logoRow: {
    marginHorizontal: spacing.lg,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap"
  },
  logoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(173,194,220,0.7)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f1f36",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  logoImage: {
    width: 28,
    height: 28
  },
  searchBar: {
    marginHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(173,194,220,0.64)",
    shadowColor: "#0f1f36",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    color: colors.textPrimary,
    paddingVertical: 0
  },
  searchActionButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  searchActionButtonLabel: {
    color: "#f8fafc",
    fontSize: typography.caption,
    fontWeight: "700"
  },
  carouselCard: {
    borderRadius: radius.xl,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(173,194,220,0.56)",
    overflow: "hidden",
    shadowColor: "#0f1f36",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  cardImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: "#e7edf7"
  },
  cardImageAsset: {
    width: "100%",
    height: "100%"
  },
  cardFooter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)"
  },
  cardTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  cardSubtitle: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary
  },
  quickActionsRoot: {
    position: "absolute",
    right: spacing.lg,
    width: 340,
    alignItems: "flex-end"
  },
  quickActionsRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-end"
  },
  quickActionsTrack: {
    position: "absolute",
    right: 60,
    top: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  quickActionItem: {
    width: 72,
    height: 46,
    position: "relative",
    alignItems: "center",
    justifyContent: "center"
  },
  quickActionLabel: {
    position: "absolute",
    bottom: 52,
    width: 72,
    fontSize: 9,
    lineHeight: 10,
    color: "#3d4f68",
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "rgba(248,250,252,0.9)",
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2
  },
  quickActionDisabledLabel: {
    color: "#8897aa"
  },
  quickActionButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(242,248,255,0.98)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(188,209,233,0.92)",
    shadowColor: "#aac5e3",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  quickActionButtonDisabled: {
    backgroundColor: "rgba(241,245,249,0.96)",
    borderColor: "rgba(209,219,230,0.95)"
  },
  quickMainButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(248,250,252,0.9)",
    shadowColor: "#0f1f36",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5
  },
  quickMainButtonLabel: {
    color: "#f8fafc",
    fontSize: typography.body,
    fontWeight: "800"
  },
  homeAnnouncementBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  homeAnnouncementCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "78%",
    borderRadius: radius.xl,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    padding: spacing.md,
    gap: spacing.sm
  },
  homeAnnouncementHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  homeAnnouncementBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1f3a5f"
  },
  homeAnnouncementTitle: {
    fontSize: typography.subtitle,
    fontWeight: "800",
    color: colors.textPrimary
  },
  homeAnnouncementOutline: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary
  },
  homeAnnouncementBodyScroll: {
    maxHeight: 250
  },
  homeAnnouncementBodyContent: {
    paddingBottom: 4
  },
  homeAnnouncementBody: {
    fontSize: typography.body,
    color: colors.textPrimary,
    lineHeight: 22
  },
  homeAnnouncementActions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end"
  },
  homeAnnouncementActionGhost: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md
  },
  homeAnnouncementActionGhostLabel: {
    color: "#334155",
    fontSize: typography.bodySmall,
    fontWeight: "700"
  },
  homeAnnouncementActionPrimary: {
    backgroundColor: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md
  },
  homeAnnouncementActionPrimaryLabel: {
    color: "#f8fafc",
    fontSize: typography.bodySmall,
    fontWeight: "700"
  },
  guideModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(44,31,18,0.26)",
    justifyContent: "flex-end"
  },
  guideBackdropDismissArea: {
    flex: 1
  },
  guideModalSheet: {
    maxHeight: "84%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#f8f0e2",
    borderTopWidth: 1,
    borderTopColor: "#eadbc3",
    paddingHorizontal: spacing.lg
  },
  guideModalContent: {
    paddingBottom: spacing.md
  },
  guideLetterCard: {
    marginTop: 8,
    borderRadius: 20,
    backgroundColor: "#fffaf0",
    borderWidth: 1,
    borderColor: "#e8dbc7",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    shadowColor: "#4b3621",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  guideCloseRow: {
    width: "100%",
    alignItems: "flex-end"
  },
  guideCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "#e7d7bf"
  },
  guideModalEyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: "#8b6e4b",
    fontWeight: "700"
  },
  guideModalTitle: {
    fontSize: typography.title,
    color: "#3f2f20",
    fontWeight: "800",
    lineHeight: 30
  },
  guideModalImageFrame: {
    padding: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#e7d7bf",
    backgroundColor: "#f9f1e2"
  },
  guideModalImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: "#e8dbc7"
  },
  guideModalImagePlaceholder: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#e2d0b4",
    backgroundColor: "#f5e8d5",
    alignItems: "center",
    justifyContent: "center"
  },
  guideModalImagePlaceholderLabel: {
    fontSize: typography.bodySmall,
    color: "#8b6e4b",
    fontWeight: "600"
  },
  guideModalBody: {
    fontSize: typography.body,
    lineHeight: 25,
    color: "#5d4a38"
  },
  guideModalSignature: {
    fontSize: 12,
    color: "#8b6e4b",
    fontWeight: "600",
    textAlign: "right"
  },
  guideActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm
  },
  guideSnoozeButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#cbb79a",
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: "#f7efdf"
  },
  guideSnoozeButtonLabel: {
    color: "#5d4a38",
    fontSize: typography.bodySmall,
    fontWeight: "700"
  },
  guideDismissButton: {
    borderRadius: radius.md,
    backgroundColor: "#5d4a38",
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  guideDismissButtonLabel: {
    color: "#fef8ef",
    fontSize: typography.bodySmall,
    fontWeight: "700"
  }
});
