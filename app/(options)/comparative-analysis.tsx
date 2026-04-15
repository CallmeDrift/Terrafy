import Picker, { PickerOption } from "@/components/picker";
import { API_URL } from "@/constants/router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
    DateTimePickerAndroid,
    DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type GrowingSystem = {
  systemId: number;
  name: string;
  ubication?: string;
};

type AgronomicVariable = {
  variableId: number;
  name: string;
  measurementUnit?: string;
};

type HistoryPoint = {
  value: number;
  rawDate: string;
};

type VariableSeries = {
  variableId: number;
  variableName: string;
  measurementUnit?: string;
  color: string;
  points: HistoryPoint[];
};

const COLORS = ["#16a34a", "#0284c7", "#ea580c", "#7c3aed", "#dc2626", "#0891b2"];

const pickFirst = (...values: Array<unknown>) => {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
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

const normalizeHistoryPoints = (payload: any): HistoryPoint[] => {
  const collection =
    payload?.history ?? payload?.data ?? payload?.points ?? payload?.records ?? payload;

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
    .filter(Boolean) as HistoryPoint[];
};

export default function ComparativeAnalysisScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ systemId?: string; systemName?: string }>();

  const [token, setToken] = useState<string | null>(null);
  const [systems, setSystems] = useState<GrowingSystem[]>([]);
  const [variables, setVariables] = useState<AgronomicVariable[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(
    params.systemId ? Number(params.systemId) : null
  );
  const [selectedVariableIds, setSelectedVariableIds] = useState<number[]>([]);

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date;
  });
  const [endDate, setEndDate] = useState(() => new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [series, setSeries] = useState<VariableSeries[]>([]);
  const [insufficientVariables, setInsufficientVariables] = useState<string[]>([]);

  const selectedSystemName = useMemo(() => {
    return (
      systems.find((system) => system.systemId === selectedSystemId)?.name ||
      params.systemName ||
      "Sistema"
    );
  }, [systems, selectedSystemId, params.systemName]);

  const systemOptions: PickerOption<number>[] = useMemo(
    () =>
      systems.map((system) => ({
        value: system.systemId,
        label: system.name,
        description: system.ubication,
      })),
    [systems]
  );

  const loadSystems = useCallback(async () => {
    try {
      setLoadingBase(true);

      const rawToken = await AsyncStorage.getItem("token");
      const rawUser = await AsyncStorage.getItem("user");

      const parsedToken = rawToken ? rawToken.replace(/"/g, "") : null;
      if (!parsedToken || !rawUser) {
        Alert.alert("Error", "Sesion invalida");
        return;
      }

      setToken(parsedToken);

      const user = JSON.parse(rawUser);
      const response = await fetch(`${API_URL}/growing-systems/${user.userId}`, {
        headers: {
          Authorization: `Bearer ${parsedToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("No se pudieron cargar los sistemas");
      }

      const payload = await response.json();
      const fetchedSystems = (payload?.systems || []) as GrowingSystem[];
      setSystems(fetchedSystems);

      if (!selectedSystemId && fetchedSystems.length > 0) {
        setSelectedSystemId(fetchedSystems[0].systemId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al cargar sistemas";
      Alert.alert("Error", message);
    } finally {
      setLoadingBase(false);
    }
  }, [selectedSystemId]);

  const loadVariablesBySystem = useCallback(
    async (systemId: number) => {
      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/growing-systems/system/${systemId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("No se pudieron cargar las variables del sistema");
        }

        const result = await response.json();
        const rawSystem = result?.system ?? result?.growingSystem ?? result?.data ?? result;
        const rawVariables =
          rawSystem?.agronomicVariables ??
          rawSystem?.variables ??
          result?.agronomicVariables ??
          result?.variables ??
          [];

        const normalized: AgronomicVariable[] = (rawVariables || [])
          .map((item: any) => {
            const source = item?.variable ?? item?.agronomicVariable ?? item;
            const variableId = Number(
              pickFirst(source?.variableId, source?.id, item?.variableId, item?.id)
            );

            if (Number.isNaN(variableId)) return null;

            return {
              variableId,
              name: String(pickFirst(source?.name, source?.variableName, item?.name) || "Variable"),
              measurementUnit: String(
                pickFirst(source?.measurementUnit, source?.unit, item?.measurementUnit, item?.unit) ||
                  ""
              ),
            };
          })
          .filter(Boolean) as AgronomicVariable[];

        setVariables(normalized);
        setSelectedVariableIds([]);
        setSeries([]);
        setInsufficientVariables([]);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las variables del sistema";
        Alert.alert("Error", message);
      }
    },
    [token]
  );

  useEffect(() => {
    loadSystems();
  }, [loadSystems]);

  useEffect(() => {
    if (selectedSystemId) {
      loadVariablesBySystem(selectedSystemId);
    }
  }, [selectedSystemId, loadVariablesBySystem]);

  const toggleVariable = (variableId: number) => {
    setSelectedVariableIds((prev) =>
      prev.includes(variableId)
        ? prev.filter((id) => id !== variableId)
        : [...prev, variableId]
    );
  };

  const fetchComparativeData = async () => {
    if (!selectedSystemId) {
      Alert.alert("Error", "Debes seleccionar un sistema");
      return;
    }

    if (selectedVariableIds.length < 2) {
      Alert.alert("Error", "Selecciona al menos dos variables para comparar");
      return;
    }

    if (startDate > endDate) {
      Alert.alert("Error", "La fecha inicial no puede ser mayor a la fecha final");
      return;
    }

    if (!token) {
      Alert.alert("Error", "Sesion invalida");
      return;
    }

    try {
      setLoadingChart(true);
      setSeries([]);
      setInsufficientVariables([]);

      const params = new URLSearchParams({
        grouping: "hours",
        start_date: toApiStartDate(startDate),
        end_date: toApiEndDate(endDate),
      });

      const selectedVariables = variables.filter((variable) =>
        selectedVariableIds.includes(variable.variableId)
      );

      const results = await Promise.all(
        selectedVariables.map(async (variable, index) => {
          const endpoint =
            `${API_URL}/growing-systems/${selectedSystemId}/variables/${variable.variableId}/history/analytics` +
            `?${params.toString()}`;

          const response = await fetch(endpoint, {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            return {
              ...variable,
              points: [] as HistoryPoint[],
              error: true,
              color: COLORS[index % COLORS.length],
            };
          }

          const payload = await response.json();
          const points = normalizeHistoryPoints(payload);

          return {
            ...variable,
            points,
            error: false,
            color: COLORS[index % COLORS.length],
          };
        })
      );

      const enoughData = results.filter((item) => item.points.length >= 2);
      const insufficient = results
        .filter((item) => item.points.length < 2)
        .map((item) => item.name);

      setSeries(
        enoughData.map((item) => ({
          variableId: item.variableId,
          variableName: item.name,
          measurementUnit: item.measurementUnit,
          color: item.color,
          points: item.points,
        }))
      );
      setInsufficientVariables(insufficient);

      if (insufficient.length > 0) {
        Alert.alert(
          "Datos insuficientes",
          `Sin datos suficientes para: ${insufficient.join(", ")}. Se muestran las demas variables.`
        );
      }

      if (enoughData.length === 0) {
        Alert.alert(
          "Sin datos comparables",
          "Ninguna variable tiene suficientes datos en el rango seleccionado."
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudieron consultar los datos historicos";
      Alert.alert("Error", message);
    } finally {
      setLoadingChart(false);
    }
  };

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

  const renderSeriesChart = (item: VariableSeries) => {
    const maxValue = Math.max(...item.points.map((point) => point.value), 1);
    const minValue = Math.min(...item.points.map((point) => point.value));
    const range = Math.max(maxValue - minValue, 1);
    const width = Math.max(300, item.points.length * 18);

    const firstLabel = new Date(item.points[0].rawDate).toLocaleString("es-CO", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const lastLabel = new Date(item.points[item.points.length - 1].rawDate).toLocaleString(
      "es-CO",
      {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    );

    const latest = item.points[item.points.length - 1]?.value ?? 0;

    return (
      <View key={item.variableId} style={styles.seriesCard}>
        <View style={styles.seriesHeader}>
          <View style={[styles.seriesColorDot, { backgroundColor: item.color }]} />
          <Text style={styles.seriesName}>{item.variableName}</Text>
          <Text style={styles.seriesMeta}>
            Ultimo: {latest.toFixed(2)} {item.measurementUnit || ""}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[styles.seriesChartBox, { width }]}> 
            <View style={styles.seriesBarsRow}>
              {item.points.map((point, index) => {
                const normalizedHeight = ((point.value - minValue) / range) * 70 + 10;

                return (
                  <View key={`${item.variableId}-${index}`} style={styles.seriesBarGroup}>
                    <View
                      style={[
                        styles.seriesBar,
                        {
                          height: normalizedHeight,
                          backgroundColor: item.color,
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.seriesAxisRow}>
          <Text style={styles.axisText}>{firstLabel}</Text>
          <Text style={styles.axisText}>{lastLabel}</Text>
        </View>

        <View style={styles.seriesStatsRow}>
          <Text style={styles.seriesStatText}>Min: {minValue.toFixed(2)}</Text>
          <Text style={styles.seriesStatText}>Max: {maxValue.toFixed(2)}</Text>
        </View>
      </View>
    );
  };

  if (loadingBase) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Cargando modulo de analisis...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={18} color="#166534" />
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Analisis comparativo</Text>
      <Text style={styles.subtitle}>Compara tendencias de multiples variables</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Sistema de cultivo</Text>
        <Picker
          value={selectedSystemId}
          options={systemOptions}
          onChange={setSelectedSystemId}
          placeholder="Selecciona un sistema"
          disabled={systems.length === 0}
        />

        <Text style={styles.label}>Variables agronomicas (2 o mas)</Text>
        <View style={styles.variablesWrap}>
          {variables.map((variable) => {
            const selected = selectedVariableIds.includes(variable.variableId);

            return (
              <TouchableOpacity
                key={variable.variableId}
                style={[styles.variableChip, selected && styles.variableChipSelected]}
                onPress={() => toggleVariable(variable.variableId)}
              >
                <Text style={[styles.variableChipText, selected && styles.variableChipTextSelected]}>
                  {variable.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {variables.length === 0 && (
          <Text style={styles.emptyVariablesText}>
            Este sistema no tiene variables configuradas.
          </Text>
        )}

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
          <TouchableOpacity style={styles.dateButton} onPress={openStartDatePicker}>
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
          <TouchableOpacity style={styles.dateButton} onPress={openEndDatePicker}>
            <Ionicons name="calendar-outline" size={18} color="#166534" />
            <Text style={styles.dateText}>{toPickerLabel(endDate)}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.generateButton, loadingChart && styles.generateButtonDisabled]}
          onPress={fetchComparativeData}
          disabled={loadingChart}
        >
          <Ionicons name="analytics-outline" size={17} color="#fff" />
          <Text style={styles.generateButtonText}>
            {loadingChart ? "Generando..." : "Generar comparativa"}
          </Text>
        </TouchableOpacity>
      </View>

      {showStartPicker && Platform.OS !== "android" && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowStartPicker(false);
            if (event.type === "set" && date) {
              setStartDate(date);
            }
          }}
        />
      )}

      {showEndPicker && Platform.OS !== "android" && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowEndPicker(false);
            if (event.type === "set" && date) {
              setEndDate(date);
            }
          }}
        />
      )}

      {loadingChart && <ActivityIndicator size="large" color="#16a34a" style={styles.chartLoader} />}

      {!!insufficientVariables.length && (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Variables sin datos suficientes</Text>
          <Text style={styles.warningText}>{insufficientVariables.join(", ")}</Text>
        </View>
      )}

      {series.length > 0 && (
        <View style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>Comparativa en {selectedSystemName}</Text>
          <Text style={styles.resultsSubtitle}>
            Visualizacion segmentada por variable para analizar tendencias simultaneas.
          </Text>
          <Text style={styles.scaleHint}>
            Nota: cada variable se normaliza en su propia escala para facilitar comparacion de tendencia.
          </Text>

          {series.map((item) => renderSeriesChart(item))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e9f5ec",
    gap: 10,
  },
  loadingText: {
    color: "#4b5563",
  },
  container: {
    flex: 1,
    backgroundColor: "#e9f5ec",
  },
  content: {
    padding: 20,
    paddingBottom: 30,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
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
    marginTop: 2,
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    elevation: 3,
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    color: "#374151",
    fontWeight: "600",
  },
  variablesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  variableChip: {
    backgroundColor: "#f3f4f6",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  variableChipSelected: {
    backgroundColor: "#dcfce7",
    borderColor: "#16a34a",
  },
  variableChipText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 12,
  },
  variableChipTextSelected: {
    color: "#166534",
  },
  emptyVariablesText: {
    color: "#6b7280",
    marginTop: 8,
  },
  input: {
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateButton: {
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateText: {
    color: "#111827",
    fontWeight: "600",
  },
  generateButton: {
    marginTop: 16,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  chartLoader: {
    marginTop: 16,
  },
  warningCard: {
    marginTop: 14,
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  warningTitle: {
    color: "#9a3412",
    fontWeight: "700",
    marginBottom: 4,
  },
  warningText: {
    color: "#9a3412",
  },
  resultsCard: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    gap: 10,
  },
  resultsTitle: {
    color: "#14532d",
    fontSize: 18,
    fontWeight: "700",
  },
  resultsSubtitle: {
    color: "#4b5563",
  },
  scaleHint: {
    color: "#6b7280",
    fontSize: 12,
  },
  seriesCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 4,
  },
  seriesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  seriesColorDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  seriesName: {
    color: "#111827",
    fontWeight: "700",
  },
  seriesMeta: {
    color: "#4b5563",
    fontSize: 12,
  },
  seriesChartBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#ecf0f1",
  },
  seriesBarsRow: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  seriesBarGroup: {
    width: 8,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  seriesBar: {
    width: 8,
    borderRadius: 999,
  },
  seriesAxisRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  axisText: {
    color: "#6b7280",
    fontSize: 11,
  },
  seriesStatsRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  seriesStatText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 12,
  },
});
