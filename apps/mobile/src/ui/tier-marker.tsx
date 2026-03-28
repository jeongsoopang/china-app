import { Image, type ImageSourcePropType, StyleSheet, View } from "react-native";

type TierImageKey =
  | "bronze"
  | "silver"
  | "gold"
  | "emerald"
  | "diamond"
  | "grandmaster"
  | "church_master"
  | "campus_master";

const TIER_ASSETS: Record<TierImageKey, ImageSourcePropType> = {
  bronze: require("../../assets/tiers/tier_bronze.png"),
  silver: require("../../assets/tiers/tier_silver.png"),
  gold: require("../../assets/tiers/tier_gold.png"),
  emerald: require("../../assets/tiers/tier_emerald.png"),
  diamond: require("../../assets/tiers/tier_diamond.png"),
  grandmaster: require("../../assets/tiers/tier_gm.png"),
  church_master: require("../../assets/tiers/tier_church_master.png"),
  campus_master: require("../../assets/tiers/tier_campus_master.png")
};

type NormalizedTierMarker = { kind: "image"; key: TierImageKey } | null;

function normalizeTierValue(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (
    normalized === "bronze" ||
    normalized === "silver" ||
    normalized === "gold" ||
    normalized === "emerald" ||
    normalized === "diamond" ||
    normalized === "platinum" ||
    normalized === "master" ||
    normalized === "grandmaster" ||
    normalized === "church_master" ||
    normalized === "campus_master"
  ) {
    return normalized;
  }

  return null;
}

export function resolveTierMarkerValue(
  tier: string | null | undefined,
  role?: string | null | undefined
): string | null {
  const normalizedTier = normalizeTierValue(tier);
  if (normalizedTier) {
    return normalizedTier;
  }

  const normalizedRole = normalizeTierValue(role);
  if (normalizedRole) {
    return normalizedRole;
  }

  const fallbackRole = role?.trim().toLowerCase() ?? "";
  if (fallbackRole === "student") {
    return "bronze";
  }

  return null;
}

function normalizeTierMarker(value: string | null | undefined): NormalizedTierMarker {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized === "church_master") {
    return { kind: "image", key: "church_master" };
  }
  if (normalized === "campus_master") {
    return { kind: "image", key: "campus_master" };
  }
  if (normalized === "bronze" || normalized === "silver" || normalized === "gold" || normalized === "emerald") {
    return { kind: "image", key: normalized };
  }
  if (normalized === "diamond" || normalized === "platinum") {
    return { kind: "image", key: "diamond" };
  }
  if (normalized === "grandmaster" || normalized === "master") {
    return { kind: "image", key: "grandmaster" };
  }

  return null;
}

export function normalizeTierForDisplay(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized === "platinum") {
    return "diamond";
  }
  if (normalized === "master") {
    return "grandmaster";
  }
  return normalized || "-";
}

export function TierMarker(props: { value: string | null | undefined; size?: number }) {
  const { value, size = 16 } = props;
  const marker = normalizeTierMarker(value);

  if (!marker) {
    return null;
  }

  return (
    <View style={[styles.badge, { width: size, height: size }]}>
      <Image
        source={TIER_ASSETS[marker.key]}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center"
  }
});
