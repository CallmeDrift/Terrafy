import { API_URL } from "@/constants/router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type HistoricalData = {
  system_id?: string;
  system_name?: string;
  t_hours?: number;
  growth_stage?: string;
  environment?: {
    temperature_c?: number;
    rh_percent?: number;
    vpd_kpa?: number;
    vpd_status?: string;
  };
  sensors?: {
    ph?: number;
    ec_ms_cm?: number;
    dissolved_o2?: number;
  };
  timestamp?: string;
};

type ChartPoint = {
  label: string;
  value: number;
  suffix?: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [summary, setSummary] = useState<HistoricalData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("user");
        const token = await AsyncStorage.getItem("token");

        if (!storedUser || !token) {
          setLoadingSummary(false);
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        const systemsResponse = await fetch(
          `${API_URL}/growing-systems/${parsedUser.userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!systemsResponse.ok) {
          throw new Error("No se pudieron recuperar los sistemas");
        }

        const systemsPayload = await systemsResponse.json();
        const systems = systemsPayload?.systems || [];

        if (!Array.isArray(systems) || systems.length === 0) {
          setSummary(null);
          return;
        }

        const selectedSystem = systems[0];

        const latestResponse = await fetch(
          `${API_URL}/growing-systems/${selectedSystem.systemId}/latest`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!latestResponse.ok) {
          throw new Error("No se pudo obtener el último resumen");
        }

        const latestPayload = await latestResponse.json();
        setSummary(latestPayload);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        setSummary(null);
      } finally {
        setLoadingSummary(false);
      }
    };

    loadDashboardData();
  }, []);

  const chartData: ChartPoint[] = useMemo(() => {
    if (!summary) return [];

    return [
      {
        label: "Temp",
        value: Number(summary.environment?.temperature_c ?? 0),
        suffix: "°C",
      },
      {
        label: "RH",
        value: Number(summary.environment?.rh_percent ?? 0),
        suffix: "%",
      },
      {
        label: "pH",
        value: Number(summary.sensors?.ph ?? 0),
      },
      {
        label: "EC",
        value: Number(summary.sensors?.ec_ms_cm ?? 0),
      },
      {
        label: "O2",
        value: Number(summary.sensors?.dissolved_o2 ?? 0),
      },
    ];
  }, [summary]);

  const maxChartValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map((item) => item.value), 1);
  }, [chartData]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Bienvenido, {user?.name || "Usuario"}</Text>

      <Text style={styles.subtitle}>Estado de tu cultivo en tiempo real</Text>

      <TouchableOpacity
        style={styles.analysisButton}
        onPress={() => router.push("/(options)/comparative-analysis")}
      >
        <Ionicons name="analytics-outline" size={16} color="#166534" />
        <Text style={styles.analysisButtonText}>Ir a analisis comparativo</Text>
      </TouchableOpacity>

      <View style={styles.card}>


        {!!summary?.system_name && (
          <Text style={styles.systemName}>Sistema: {summary.system_name}</Text>
        )}

        {loadingSummary ? (
          <View style={styles.chartPlaceholder}>
            <ActivityIndicator size="small" color="#16a34a" />
            <Text style={styles.placeholderText}>Cargando resumen...</Text>
          </View>
        ) : chartData.length === 0 ? (
          <View style={styles.chartPlaceholder}>
            <Text style={styles.placeholderText}>No hay resumen disponible</Text>
          </View>
        ) : (
          <View style={styles.chartArea}>
            {chartData.map((item) => {
              const barHeight = Math.max(8, (item.value / maxChartValue) * 110);

              return (
                <View key={item.label} style={styles.barGroup}>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { height: barHeight }]} />
                  </View>
                  <Text style={styles.barValue}>
                    {item.value.toFixed(1)}{item.suffix || ""}
                  </Text>
                  <Text style={styles.barLabel}>{item.label}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.grid}>
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Ionicons name="flask-outline" size={18} color="#16a34a" />
            <Text style={styles.metricTitle}>pH del suelo</Text>
          </View>
          <Text style={styles.metricValue}>{summary?.sensors?.ph?.toFixed(2) ?? "-"}</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Ionicons name="thermometer-outline" size={18} color="#16a34a" />
            <Text style={styles.metricTitle}>Temp. del suelo</Text>
          </View>
          <Text style={styles.metricValue}>
            {summary?.environment?.temperature_c?.toFixed(1) ?? "-"}°C
          </Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Ionicons name="leaf-outline" size={18} color="#16a34a" />
            <Text style={styles.metricTitle}>Oxígeno disuelto</Text>
          </View>
          <Text style={styles.metricValue}>
            {summary?.sensors?.dissolved_o2?.toFixed(2) ?? "-"}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Ionicons name="water-outline" size={18} color="#16a34a" />
            <Text style={styles.metricTitle}>Humedad</Text>
          </View>
          <Text style={styles.metricValue}>
            {summary?.environment?.rh_percent?.toFixed(1) ?? "-"}%
          </Text>
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
    marginTop: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
  },
  subtitle: {
    marginBottom: 20,
    color: "#666",
  },
  analysisButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dcfce7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  analysisButtonText: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 12,
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
    marginBottom: 6,
    fontSize: 16,
    color: "#14532d",
  },
  systemName: {
    color: "#4b5563",
    marginBottom: 10,
  },
  chartPlaceholder: {
    height: 160,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    borderRadius: 15,
    gap: 8,
  },
  placeholderText: {
    color: "#888",
  },
  chartArea: {
    height: 170,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    backgroundColor: "#f2f2f2",
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 8,
  },
  barGroup: {
    alignItems: "center",
    width: 46,
  },
  barTrack: {
    height: 110,
    width: 14,
    borderRadius: 999,
    backgroundColor: "#dcfce7",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  bar: {
    width: "100%",
    backgroundColor: "#16a34a",
    borderRadius: 999,
  },
  barValue: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    color: "#166534",
  },
  barLabel: {
    marginTop: 2,
    fontSize: 10,
    color: "#6b7280",
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
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  metricTitle: {
    color: "#666",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#16a34a",
  },
});
