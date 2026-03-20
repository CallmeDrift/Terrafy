import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function Dashboard() {
  return (
    <ScrollView style={styles.container}>
      
      <Text style={styles.title}> Bienvenido, Dorifuto</Text>
      <Text style={styles.subtitle}>Estado de tu cultivo en tiempo real</Text>

      {/* Card de gráfica */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tendencia de pH</Text>
        <View style={styles.chartPlaceholder}>
          <Text style={{ color: "#888" }}>Gráfica aquí</Text>
        </View>
      </View>

      {/* Métricas */}
      <View style={styles.grid}>
        
        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>pH del suelo</Text>
          <Text style={styles.metricValue}>6.8</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>Temp. del suelo</Text>
          <Text style={styles.metricValue}>24°C</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>Oxigeno en el aire</Text>
          <Text style={styles.metricValue}>60%</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricTitle}>Humedad</Text>
          <Text style={styles.metricValue}>65%</Text>
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
    marginBottom: 20,
    color: "#666",
  },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 20,
    marginBottom: 20,
    elevation: 4,
  },
  cardTitle: {
    fontWeight: "bold",
    marginBottom: 10,
    fontSize: 16,
  },
  chartPlaceholder: {
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    borderRadius: 15,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 20,
    marginBottom: 15,
    elevation: 3,
  },
  metricTitle: {
    color: "#666",
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#16a34a",
  },
});
