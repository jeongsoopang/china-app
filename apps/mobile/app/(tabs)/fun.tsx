import { StyleSheet, Text, View } from "react-native";

export default function FunScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>FUN</Text>
      <Text style={styles.text}>Discovery and entertainment placeholder.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 8,
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
  }
});
