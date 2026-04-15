import { API_URL } from "@/constants/router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type HistoryPoint = {
  label: string;
  value: number;
  rawDate?: string;
};


const toDateInput = (date: Date) => date.toISOString().slice(0, 10);
const toApiStartDate = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
};
const toApiEndDate = (date: Date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
};

const toPickerLabel = (date: Date) =>
  date.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const pickFirst = (...values: Array<unknown>) => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
};

const normalizeHistoryPoints = (payload: any): HistoryPoint[] => {
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

      const label = rawDate
        ? new Date(rawDate).toLocaleDateString("es-CO", {
            month: "2-digit",
            day: "2-digit",
          })
        : "-";

      return {
        label,
        value: numericValue,
        rawDate,
      };
    })
    .filter(Boolean) as HistoryPoint[];
};

const fetchWithTimeout = async (
  url: string,
  token?: string,
  timeoutMs = 8000
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
};

export default function VariableHistoryScreen() {
  const router = useRouter();
  const { systemId, variableId, variableName, systemName } = useLocalSearchParams<{
    systemId?: string;
    variableId?: string;
    variableName?: string;
    systemName?: string;
  }>();

  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date;
  });
  const [endDate, setEndDate] = useState(() => new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const openStartDatePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: startDate,
        mode: "date",
        is24Hour: true,
        onChange: (event, selectedDate) => {
          if (event.type === "set" && selectedDate) {
            setStartDate(selectedDate);
          }
        },
      });
      return;
    }

    setShowStartPicker(true);
  };

  const openEndDatePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: endDate,
        mode: "date",
        is24Hour: true,
        onChange: (event, selectedDate) => {
          if (event.type === "set" && selectedDate) {
            setEndDate(selectedDate);
          }
        },
      });
      return;
    }

    setShowEndPicker(true);
  };

  const chartData = useMemo(() => points.slice(-24), [points]);
  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map((point) => point.value), 1);
  }, [chartData]);

  const average = useMemo(() => {
    if (points.length === 0) return 0;
    return points.reduce((sum, point) => sum + point.value, 0) / points.length;
  }, [points]);

  const handleFetchHistory = async () => {
    if (!systemId || !variableId) {
      Alert.alert("Error", "Faltan datos de sistema o variable");
      return;
    }

    if (startDate > endDate) {
      Alert.alert("Error", "La fecha inicial no puede ser mayor a la final");
      return;
    }

    try {
      setLoading(true);

      const rawToken = await AsyncStorage.getItem("token");
      const token = rawToken ? rawToken.replace(/"/g, "") : null;

      if (!token) {
        Alert.alert("Error", "Sesión inválida");
        return;
      }

      const params = new URLSearchParams({
        grouping: "hours",
        start_date: toApiStartDate(startDate),
        end_date: toApiEndDate(endDate),
      });

      const endpoint =
        `${API_URL}/growing-systems/${systemId}/variables/${variableId}/history/analytics` +
        `?${params.toString()}`;

      const response = await fetchWithTimeout(endpoint, token);

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
          backendMessage || `No se pudo recuperar el historial (HTTP ${response.status})`
        );
      }

      const payload = await response.json();

      const normalizedPoints = normalizeHistoryPoints(payload);
      setPoints(normalizedPoints);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo cargar el historial de la variable";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={18} color="#166534" />
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Histórico de variable</Text>
      <Text style={styles.subtitle}>{systemName || "Sistema"}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Variable</Text>
        <Text style={styles.variableName}>{variableName || "Variable agronómica"}</Text>

        <Text style={styles.label}>Fecha inicial</Text>
        {Platform.OS === "web" ? (
          <TextInput
            value={toDateInput(startDate)}
            onChangeText={(value) => {
              const parsed = new Date(`${value}T00:00:00`);
              if (!Number.isNaN(parsed.getTime())) {
                setStartDate(parsed);
              }
            }}
            style={styles.input}
            placeholder="YYYY-MM-DD"
          />
        ) : (
          <TouchableOpacity
            style={styles.dateButton}
            onPress={openStartDatePicker}
          >
            <Ionicons name="calendar-outline" size={18} color="#166534" />
            <Text style={styles.dateText}>{toPickerLabel(startDate)}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Fecha final</Text>
        {Platform.OS === "web" ? (
          <TextInput
            value={toDateInput(endDate)}
            onChangeText={(value) => {
              const parsed = new Date(`${value}T00:00:00`);
              if (!Number.isNaN(parsed.getTime())) {
                setEndDate(parsed);
              }
            }}
            style={styles.input}
            placeholder="YYYY-MM-DD"
          />
        ) : (
          <TouchableOpacity
            style={styles.dateButton}
            onPress={openEndDatePicker}
          >
            <Ionicons name="calendar-outline" size={18} color="#166534" />
            <Text style={styles.dateText}>{toPickerLabel(endDate)}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleFetchHistory}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "Consultando..." : "Consultar historial"}</Text>
        </TouchableOpacity>
      </View>

      {showStartPicker && Platform.OS === "ios" && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="inline"
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            if (event.type === "set" && selectedDate) {
              setStartDate(selectedDate);
            }
          }}
        />
      )}

      {showEndPicker && Platform.OS === "ios" && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="inline"
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            if (event.type === "set" && selectedDate) {
              setEndDate(selectedDate);
            }
          }}
        />
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 18 }} />
      ) : points.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No existen datos en el rango seleccionado.
          </Text>
        </View>
      ) : (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Comportamiento en el tiempo</Text>

          <View style={styles.metricsRow}>
            <Text style={styles.metricText}>Registros: {points.length}</Text>
            <Text style={styles.metricText}>Promedio: {average.toFixed(2)}</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chartArea}>
              {chartData.map((point, index) => {
                const barHeight = Math.max(8, (point.value / maxValue) * 120);

                return (
                  <View key={`${point.rawDate || point.label}-${index}`} style={styles.barGroup}>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { height: barHeight }]} />
                    </View>
                    <Text style={styles.barValue}>{point.value.toFixed(1)}</Text>
                    <Text style={styles.barLabel}>{point.label}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
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
    marginTop: 8,
    marginBottom: 4,
    color: "#4b5563",
    fontWeight: "500",
  },
  variableName: {
    color: "#166534",
    fontWeight: "700",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
  },
  dateButton: {
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: {
    color: "#166534",
    fontWeight: "600",
  },
  button: {
    marginTop: 14,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
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
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 10,
  },
  metricText: {
    color: "#4b5563",
    fontWeight: "600",
  },
  chartArea: {
    minHeight: 180,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingVertical: 6,
  },
  barGroup: {
    alignItems: "center",
    width: 40,
  },
  barTrack: {
    height: 130,
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
    color: "#166534",
    fontWeight: "700",
  },
  barLabel: {
    marginTop: 2,
    fontSize: 10,
    color: "#6b7280",
  },
});
