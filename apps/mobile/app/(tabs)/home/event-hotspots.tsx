import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase/client";
import { CityHeroHeader } from "../../../src/ui/city-hero-header";
import { colors, radius, spacing, typography } from "../../../src/ui/theme";

type EventPageBannerRow = {
  id: number;
  title: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
};

type EventPageSponsorRow = {
  id: number;
  name: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export default function EventHotspotsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const rawReturnTo = params.returnTo;
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  const [banners, setBanners] = useState<EventPageBannerRow[]>([]);
  const [sponsors, setSponsors] = useState<EventPageSponsorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadEventPageData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const [bannerResult, sponsorResult] = await Promise.all([
      (supabase as unknown as { from: (table: string) => any })
        .from("event_page_banners")
        .select("id, title, image_url, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
      (supabase as unknown as { from: (table: string) => any })
        .from("event_page_sponsors")
        .select("id, name, image_url, link_url, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
    ]);

    if (bannerResult.error || sponsorResult.error) {
      setBanners([]);
      setSponsors([]);
      setLoadError("Unable to load Event page content right now.");
      setIsLoading(false);
      return;
    }

    setBanners((bannerResult.data ?? []) as EventPageBannerRow[]);
    setSponsors((sponsorResult.data ?? []) as EventPageSponsorRow[]);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEventPageData();
    }, [loadEventPageData])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroWrap}>
        <CityHeroHeader
          title="Event 맛집"
          height={164}
          imageOffsetY={-10}
          contentOffsetY={8}
          style={styles.heroFullBleed}
          contentStyle={styles.heroContentCentered}
        />
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
          style={[styles.heroBackButton, { top: Math.max(insets.top + 6, spacing.md) }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color="#f8fafc" />
          <Text style={styles.heroBackButtonLabel}>Back</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.heroStrip}
      >
        {banners.map((banner) => (
          <View key={banner.id} style={styles.heroCard}>
            <Image source={{ uri: banner.image_url }} style={styles.heroCardImage} resizeMode="cover" />
            <View style={styles.heroCardOverlay}>
              <Text style={styles.heroCardLabel} numberOfLines={1}>
                {banner.title?.trim().length ? banner.title : "Event Highlight"}
              </Text>
            </View>
          </View>
        ))}
        {!isLoading && banners.length === 0 ? (
          <View style={styles.heroCard}>
            <Ionicons name="image-outline" size={28} color={colors.accent} />
            <Text style={styles.heroCardLabel}>No active banners yet.</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>LUCL Sponsors</Text>
      </View>

      {isLoading ? <Text style={styles.metaText}>Loading Event page content...</Text> : null}
      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

      <View style={styles.sponsorGrid}>
        {sponsors.map((sponsor) => (
          <Pressable
            key={sponsor.id}
            style={styles.sponsorItem}
            onPress={() => {
              if (sponsor.link_url) {
                void Linking.openURL(sponsor.link_url);
              }
            }}
            disabled={!sponsor.link_url}
          >
            <View style={styles.sponsorCircle}>
              <Image source={{ uri: sponsor.image_url }} style={styles.sponsorImage} resizeMode="cover" />
            </View>
            <Text style={styles.sponsorName} numberOfLines={2}>
              {sponsor.name}
            </Text>
          </Pressable>
        ))}
        {!isLoading && sponsors.length === 0 ? (
          <View style={styles.emptySponsorWrap}>
            <Text style={styles.metaText}>No active sponsors yet.</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    backgroundColor: colors.background
  },
  heroFullBleed: {
    marginHorizontal: 0
  },
  heroWrap: {
    position: "relative"
  },
  heroContentCentered: {
    justifyContent: "center",
    alignItems: "center"
  },
  heroBackButton: {
    position: "absolute",
    left: spacing.md,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(15,31,54,0.56)",
    borderWidth: 1,
    borderColor: "rgba(248,250,252,0.36)"
  },
  heroBackButtonLabel: {
    fontSize: typography.body,
    fontWeight: "700",
    color: "#f8fafc"
  },
  heroStrip: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg
  },
  heroCard: {
    width: 280,
    aspectRatio: 4 / 3,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(173,194,220,0.62)",
    backgroundColor: "#e9eff8",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#0f1f36",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
    overflow: "hidden"
  },
  heroCardImage: {
    width: "100%",
    height: "100%"
  },
  heroCardOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(15,31,54,0.45)"
  },
  heroCardLabel: {
    fontSize: typography.bodySmall,
    color: "#f8fafc"
  },
  sectionHeaderRow: {
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  sponsorGrid: {
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.lg
  },
  sponsorItem: {
    width: "31%",
    alignItems: "center",
    gap: 8
  },
  sponsorCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(173,194,220,0.64)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f1f36",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: "hidden"
  },
  sponsorImage: {
    width: "100%",
    height: "100%"
  },
  sponsorName: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center"
  },
  emptySponsorWrap: {
    width: "100%",
    alignItems: "center"
  },
  metaText: {
    paddingHorizontal: spacing.lg,
    fontSize: typography.bodySmall,
    color: colors.textMuted
  },
  errorText: {
    paddingHorizontal: spacing.lg,
    fontSize: typography.bodySmall,
    color: "#b91c1c"
  }
});
