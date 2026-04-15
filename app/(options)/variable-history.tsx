import { ANALYTICS_API_URL, API_URL } from "@/constants/router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import Constants from "expo-constants";
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

type AnalyticsSystem = {
  id: string;
  name: string;
};

type AnalyticsVariable = {
  id: string;
  name: string;
};

const toIsoInput = (date: Date) => date.toISOString().slice(0, 19);
const toIsoApi = (date: Date) => date.toISOString();

const toPickerLabel = (date: Date) =>
  date.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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

const normalizeAnalyticsSystems = (payload: any): AnalyticsSystem[] => {
  const collection = payload?.systems ?? payload?.data ?? payload;

  if (!Array.isArray(collection)) {
    return [];
  }

  return collection
    .map((item: any) => {
      const id = String(pickFirst(item?.id, item?.system_id, item?.systemId) ?? "");
      const name = String(
        pickFirst(item?.name, item?.system_name, item?.systemName, item?.title) ?? ""
      );

      if (!id) return null;

      return { id, name };
    })
    .filter(Boolean) as AnalyticsSystem[];
};

const normalizeAnalyticsVariables = (payload: any): AnalyticsVariable[] => {
  const collection = payload?.variables ?? payload?.data ?? payload;

  if (!Array.isArray(collection)) {
    return [];
  }

  return collection
    .map((item: any) => {
      const id = String(pickFirst(item?.id, item?.variable_id, item?.variableId) ?? "");
      const name = String(
        pickFirst(item?.name, item?.variable_name, item?.variableName, item?.title) ?? ""
      );

      if (!id) return null;

      return { id, name };
    })
    .filter(Boolean) as AnalyticsVariable[];
};

const normalizeName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const getExpoDevIp = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return undefined;

  return hostUri.split(":")[0];
};

const getAnalyticsBaseCandidates = () => {
  const inferredFromApi = API_URL.replace(":3000/api", ":8000");
  const expoDevIp = getExpoDevIp();
  const expoDerived = expoDevIp ? `http://${expoDevIp}:8000` : undefined;

  const configuredAnalyticsIp =
    ANALYTICS_API_URL && !ANALYTICS_API_URL.includes("localhost")
      ? ANALYTICS_API_URL
      : undefined;

  const inferredAnalyticsIp =
    inferredFromApi && !inferredFromApi.includes("localhost")
      ? inferredFromApi
      : undefined;

  const androidPreferred = [
    configuredAnalyticsIp,
    inferredAnalyticsIp,
    "http://192.168.1.2:8000",
    expoDerived,
  ];

  const defaultPreferred = [
    configuredAnalyticsIp,
    inferredAnalyticsIp,
    expoDerived,
    ANALYTICS_API_URL,
    inferredFromApi,
    "http://localhost:8000",
  ];

  const candidates = Platform.OS === "android" ? androidPreferred : defaultPreferred;

  return Array.from(new Set(candidates.filter(Boolean) as string[]));
};

const fetchWithTimeout = async (url: string, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
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

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Sesión inválida");
        return;
      }

      const params = new URLSearchParams({
        start_date: toIsoApi(startDate),
        end_date: toIsoApi(endDate),
        grouping: "hours",
      });

      const candidates = getAnalyticsBaseCandidates();
      let payload: any = null;
      let lastErrorMessage = "No se pudo cargar el historial de la variable";
      let lastTriedBaseUrl = "";

      for (const baseUrl of candidates) {
        lastTriedBaseUrl = baseUrl;
        try {
          const systemsResponse = await fetchWithTimeout(`${baseUrl}/analysis/systems`);

          if (!systemsResponse.ok) {
            let backendMessage = "";

            try {
              const errorPayload = await systemsResponse.json();
              backendMessage =
                errorPayload?.detail?.[0]?.msg ||
                errorPayload?.message ||
                JSON.stringify(errorPayload);
            } catch {
              backendMessage = await systemsResponse.text();
            }

            lastErrorMessage =
              backendMessage ||
              `No se pudo consultar sistemas de analítica (HTTP ${systemsResponse.status})`;
            continue;
          }

          const systemsPayload = await systemsResponse.json();
          const analyticsSystems = normalizeAnalyticsSystems(systemsPayload);

          let resolvedSystemId = systemId;
          const idExists = analyticsSystems.some((item) => item.id === resolvedSystemId);

          if (!idExists && systemName) {
            const targetName = normalizeName(systemName);
            const byName = analyticsSystems.find(
              (item) => item.name && normalizeName(item.name) === targetName
            );

            if (byName) {
              resolvedSystemId = byName.id;
            }
          }

          if (!analyticsSystems.some((item) => item.id === resolvedSystemId)) {
            const validIds = analyticsSystems.map((item) => item.id).join(", ");
            throw new Error(
              `Sistema ${systemId} no existe en analítica. IDs válidos: ${validIds || "ninguno"}`
            );
          }

          const variablesResponse = await fetchWithTimeout(`${baseUrl}/analysis/variables`);

          if (!variablesResponse.ok) {
            let backendMessage = "";

            try {
              const errorPayload = await variablesResponse.json();
              backendMessage =
                errorPayload?.detail?.[0]?.msg ||
                errorPayload?.message ||
                JSON.stringify(errorPayload);
            } catch {
              backendMessage = await variablesResponse.text();
            }

            lastErrorMessage =
              backendMessage ||
              `No se pudo consultar variables de analítica (HTTP ${variablesResponse.status})`;
            continue;
          }

          const variablesPayload = await variablesResponse.json();
          const analyticsVariables = normalizeAnalyticsVariables(variablesPayload);

          let resolvedVariableId = variableId;
          const variableIdExists = analyticsVariables.some(
            (item) => item.id === resolvedVariableId
          );

          if (!variableIdExists && variableName) {
            const targetVariableName = normalizeName(variableName);
            const variableByName = analyticsVariables.find(
              (item) => item.name && normalizeName(item.name) === targetVariableName
            );

            if (variableByName) {
              resolvedVariableId = variableByName.id;
            }
          }

          if (!analyticsVariables.some((item) => item.id === resolvedVariableId)) {
            const validVariableIds = analyticsVariables.map((item) => item.id).join(", ");
            throw new Error(
              `Variable ${variableId} no existe en analítica. IDs válidos: ${validVariableIds || "ninguno"}`
            );
          }

          params.set("system_id", resolvedSystemId);
          params.set("variable_id", resolvedVariableId);

          const response = await fetchWithTimeout(
            `${baseUrl}/analysis/history?${params.toString()}`
          );

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

            lastErrorMessage =
              backendMessage || `No se pudo recuperar el historial (HTTP ${response.status})`;

            // Si el backend ya respondió con error funcional/validación,
            // no seguimos intentando otros hosts porque el request llegó bien.
            if ([400, 401, 403, 422].includes(response.status)) {
              break;
            }

            continue;
          }

          payload = await response.json();
          break;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            lastErrorMessage = "Tiempo de espera agotado al consultar analítica";
          } else {
            lastErrorMessage =
              error instanceof Error ? error.message : "Error de conexión con analítica";
          }
        }
      }

      if (!payload) {
        throw new Error(`${lastErrorMessage}. Última URL: ${lastTriedBaseUrl}`);
      }

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
            value={toIsoInput(startDate)}
            onChangeText={(value) => {
              const parsed = new Date(value);
              if (!Number.isNaN(parsed.getTime())) {
                setStartDate(parsed);
              }
            }}
            style={styles.input}
            placeholder="YYYY-MM-DDTHH:mm:ss"
          />
        ) : (
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartPicker(true)}
          >
            <Ionicons name="calendar-outline" size={18} color="#166534" />
            <Text style={styles.dateText}>{toPickerLabel(startDate)}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Fecha final</Text>
        {Platform.OS === "web" ? (
          <TextInput
            value={toIsoInput(endDate)}
            onChangeText={(value) => {
              const parsed = new Date(value);
              if (!Number.isNaN(parsed.getTime())) {
                setEndDate(parsed);
              }
            }}
            style={styles.input}
            placeholder="YYYY-MM-DDTHH:mm:ss"
          />
        ) : (
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowEndPicker(true)}
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

      {showStartPicker && Platform.OS !== "web" && (
        <DateTimePicker
          value={startDate}
          mode="datetime"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            if (Platform.OS !== "ios") {
              setShowStartPicker(false);
            }

            if (event.type === "set" && selectedDate) {
              setStartDate(selectedDate);
            }
          }}
        />
      )}

      {showEndPicker && Platform.OS !== "web" && (
        <DateTimePicker
          value={endDate}
          mode="datetime"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            if (Platform.OS !== "ios") {
              setShowEndPicker(false);
            }

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
