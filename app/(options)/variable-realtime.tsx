import { API_URL } from "@/constants/router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type RealtimePoint = {
  value: number;
  rawDate: string;
};

const pickFirst = (...values: Array<unknown>) => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
};

const normalizePoints = (payload: any): RealtimePoint[] => {
  const collection =
    payload?.history ??
    payload?.data ??
    payload?.points ??
    payload?.records ??
    payload;

  if (!Array.isArray(collection)) {
    return [];
  }

  return collection
    .map((item: any) => {
      const rawValue = pickFirst(
        item?.value,
        item?.avg,
        item?.mean,
        item?.average,
        item?.median,
        item?.max,
        item?.min
      );
      const numericValue = Number(rawValue);
      if (Number.isNaN(numericValue)) {
        return null;
      }

      const rawDate = String(
        pickFirst(item?.timestamp, item?.date, item?.datetime, item?.time) || ""
      );

      if (!rawDate) {
        return null;
      }

      return {
        value: numericValue,
        rawDate,
      };
    })
    .filter(Boolean) as RealtimePoint[];
};

const toApiDate = (date: Date) => date.toISOString();

export default function VariableRealtimeScreen() {
  const router = useRouter();
  const { systemId, variableId, variableName, systemName } = useLocalSearchParams<{
    systemId?: string;
    variableId?: string;
    variableName?: string;
    systemName?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [points, setPoints] = useState<RealtimePoint[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const fetchRealtime = useCallback(async (silent = false) => {
    if (!systemId || !variableId) {
      Alert.alert("Error", "Faltan datos de sistema o variable");
      setLoading(false);
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const rawToken = await AsyncStorage.getItem("token");
      const token = rawToken ? rawToken.replace(/"/g, "") : null;

      if (!token) {
        Alert.alert("Error", "Sesión inválida");
        return;
      }

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        grouping: "hours",
        start_date: toApiDate(startDate),
        end_date: toApiDate(endDate),
      });

      const endpoint =
        `${API_URL}/growing-systems/${systemId}/variables/${variableId}/history/analytics` +
        `?${params.toString()}`;

      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        throw new Error("Tu sesión expiró o el token es inválido. Inicia sesión de nuevo.");
      }

      if (!response.ok) {
        let backendMessage = "";

        try {
          const errorPayload = await response.json();
          backendMessage =
            errorPayload?.detail?.[0]?.msg ||
            errorPayload?.message ||
            JSON.stringify(errorPayload);
        } catch {
          backendMessage = await response.text();
        }

        throw new Error(
          backendMessage || `No se pudo consultar tiempo real (HTTP ${response.status})`
        );
      }

      const payload = await response.json();
      const normalized = normalizePoints(payload);

      setPoints(normalized.slice(-30));
      setLastUpdate(new Date().toISOString());
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los datos en tiempo real";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [systemId, variableId]);

  useEffect(() => {
    fetchRealtime(false);
  }, [fetchRealtime]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchRealtime(true);
    }, 60000);

    return () => clearInterval(timer);
  }, [fetchRealtime]);

  const chartData = useMemo(() => points, [points]);
  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map((point) => point.value), 1);
  }, [chartData]);

  const minValue = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.min(...chartData.map((point) => point.value));
  }, [chartData]);

  const average = useMemo(() => {
    if (chartData.length === 0) return 0;
    return chartData.reduce((sum, point) => sum + point.value, 0) / chartData.length;
  }, [chartData]);

  const latest = chartData[chartData.length - 1];

  const renderLineChart = () => {
    if (chartData.length === 0) return null;

    const width = Math.max(280, chartData.length * 36);
    const height = 150;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.chartWrapper, { width }]}> 
          <View style={styles.grid}>
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
          </View>

          <View style={styles.svgLikeContainer}>
            <View style={styles.polylineTrack}>
              {chartData.map((point, index) => {
                const x = chartData.length === 1 ? width / 2 : (index / (chartData.length - 1)) * (width - 16) + 8;
                const y = height - (point.value / maxValue) * (height - 20) - 10;

                return (
                  <View
                    key={`point-${point.rawDate}-${index}`}
                    style={[styles.dot, { left: x - 4, top: y - 4 }]}
                  />
                );
              })}
            </View>

            <View style={styles.xLabelsRow}>
              {chartData.map((point, index) => {
                const dateLabel = new Date(point.rawDate).toLocaleTimeString("es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <Text key={`label-${index}`} style={styles.xLabel}>
                    {dateLabel}
                  </Text>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={18} color="#166534" />
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Variable en tiempo real</Text>
      <Text style={styles.subtitle}>{systemName || "Sistema"}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Variable</Text>
        <Text style={styles.variableName}>{variableName || "Variable agronómica"}</Text>

        <View style={styles.metricsRow}>
          <Text style={styles.metricText}>Último: {latest ? latest.value.toFixed(2) : "-"}</Text>
          <Text style={styles.metricText}>Promedio: {average.toFixed(2)}</Text>
        </View>
        <View style={styles.metricsRow}>
          <Text style={styles.metricText}>Mín: {minValue.toFixed(2)}</Text>
          <Text style={styles.metricText}>Máx: {maxValue.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.refreshButton, refreshing && styles.buttonDisabled]}
          onPress={() => fetchRealtime(true)}
          disabled={refreshing}
        >
          <Ionicons name="refresh" size={15} color="#166534" />
          <Text style={styles.refreshText}>{refreshing ? "Actualizando..." : "Actualizar ahora"}</Text>
        </TouchableOpacity>

        <Text style={styles.updateText}>
          {lastUpdate
            ? `Última actualización: ${new Date(lastUpdate).toLocaleTimeString("es-CO")}`
            : "Sin actualizaciones aún"}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 18 }} />
      ) : points.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No existen datos recientes para esta variable.
          </Text>
          <Text style={styles.emptyHint}>
            El sistema consulta automáticamente cada 60 segundos.
          </Text>
        </View>
      ) : (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Comportamiento dinámico (últimas 24h)</Text>
          <Text style={styles.chartHint}>Actualización automática cada 60 segundos</Text>
          {renderLineChart()}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e9f5ec",
  },
  content: {
    padding: 20,
    paddingBottom: 28,
  },
  backButton: {
    marginTop: 4,
    marginBottom: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#dcfce7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backText: {
    color: "#166534",
    fontWeight: "700",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#14532d",
  },
  subtitle: {
    color: "#4b5563",
    marginTop: 3,
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    elevation: 2,
  },
  label: {
    marginBottom: 4,
    color: "#4b5563",
    fontWeight: "500",
  },
  variableName: {
    color: "#166534",
    fontWeight: "700",
    marginBottom: 8,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  metricText: {
    color: "#374151",
    fontWeight: "600",
  },
  refreshButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dcfce7",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  refreshText: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 12,
  },
  updateText: {
    marginTop: 8,
    color: "#6b7280",
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  emptyCard: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    elevation: 2,
  },
  emptyText: {
    color: "#6b7280",
    textAlign: "center",
    fontWeight: "600",
  },
  emptyHint: {
    marginTop: 6,
    color: "#9ca3af",
    textAlign: "center",
    fontSize: 12,
  },
  chartCard: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    elevation: 2,
  },
  chartTitle: {
    color: "#14532d",
    fontWeight: "700",
    fontSize: 16,
  },
  chartHint: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 3,
    marginBottom: 8,
  },
  chartWrapper: {
    minHeight: 190,
  },
  grid: {
    height: 150,
    justifyContent: "space-between",
    marginBottom: 6,
  },
  gridLine: {
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
  },
  svgLikeContainer: {
    marginTop: -150,
    height: 178,
  },
  polylineTrack: {
    height: 150,
    position: "relative",
  },
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#16a34a",
    borderWidth: 1,
    borderColor: "#fff",
  },
  xLabelsRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  xLabel: {
    color: "#6b7280",
    fontSize: 10,
    minWidth: 32,
    textAlign: "center",
  },
});
