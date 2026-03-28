import { Image, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { spacing, typography } from "./theme";

type CityHeroHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  height?: number;
  imageOffsetY?: number;
  contentOffsetY?: number;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
};

export function CityHeroHeader({
  eyebrow,
  title,
  subtitle,
  height = 162,
  imageOffsetY = 0,
  contentOffsetY = 0,
  style,
  contentStyle
}: CityHeroHeaderProps) {
  return (
    <View style={[styles.wrap, { height }, style]}>
      <Image
        source={require("../../assets/home/shanghai-banner-light.png")}
        style={[styles.image, imageOffsetY !== 0 ? { transform: [{ translateY: imageOffsetY }] } : null]}
        resizeMode="cover"
      />
      <View style={styles.overlay}>
        <View
          style={[
            styles.contentWrap,
            contentOffsetY !== 0 ? { transform: [{ translateY: contentOffsetY }] } : null,
            contentStyle
          ]}
        >
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#e8eef6"
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%"
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,31,54,0.18)",
    paddingHorizontal: spacing.lg
  },
  contentWrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  eyebrow: {
    marginBottom: 2,
    fontSize: typography.bodySmall,
    color: "rgba(248,250,252,0.92)",
    fontWeight: "600",
    textAlign: "center"
  },
  title: {
    fontSize: typography.titleLarge,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 0.3,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  },
  subtitle: {
    marginTop: 2,
    fontSize: typography.caption,
    color: "rgba(248,250,252,0.92)",
    textAlign: "center"
  }
});
