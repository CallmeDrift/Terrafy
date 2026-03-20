import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function History() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>History</Text>
      <Text style={styles.subtitle}>View past measurements</Text>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.zone}>Zone B3</Text>
        <Text style={styles.date}>2026-02-21 at 14:30</Text>

        <View style={styles.row}>
          <Text>Soil pH</Text>
          <Text style={styles.value}>6.8 pH</Text>
        </View>

        <View style={styles.row}>
          <Text>Temperature</Text>
          <Text style={styles.value}>24 °C</Text>
        </View>

        <View style={styles.row}>
          <Text>Air Oxygen</Text>
          <Text style={styles.value}>20.9 %</Text>
        </View>

        <View style={styles.row}>
          <Text>Humidity</Text>
          <Text style={styles.value}>65 %</Text>
        </View>
      </View>

      {/* Otro card resumido */}
      <View style={styles.card}>
        <Text style={styles.zone}>Zone A1</Text>
        <Text style={styles.date}>2026-02-21 at 09:15</Text>

        <View style={styles.miniRow}>
          <Text>7.1</Text>
          <Text>22°C</Text>
          <Text>21%</Text>
          <Text>72%</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e9f5ec",
    padding: 20,
    marginTop: 40
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#666",
    marginBottom: 15,
  },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 20,
    marginBottom: 15,
    elevation: 3,
  },
  zone: {
    fontWeight: "bold",
    fontSize: 16,
  },
  date: {
    color: "#888",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 3,
  },
  value: {
    fontWeight: "bold",
    color: "#16a34a",
  },
  miniRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
});
