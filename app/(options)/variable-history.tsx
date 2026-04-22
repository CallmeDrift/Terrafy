import { API_URL } from "@/constants/router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system/legacy";
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

type ExportFormat = "csv" | "excel";


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

const sanitizeForFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();

const formatDateForFileName = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const getExtensionByFormat = (format: ExportFormat) => {
  if (format === "excel") return "xlsx";
  return "csv";
};

const getMimeByFormat = (format: ExportFormat) => {
  if (format === "excel") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  return "text/csv";
};

const inferExtensionFromContentType = (contentType?: string | null) => {
  if (!contentType) return null;

  const normalized = contentType.toLowerCase();

  if (normalized.includes("spreadsheet") || normalized.includes("excel")) {
    return "xlsx";
  }

  if (normalized.includes("csv")) {
    return "csv";
  }

  if (normalized.includes("json")) {
    return "json";
  }

  if (normalized.includes("text/plain")) {
    return "txt";
  }

  return null;
};

const getHeaderValue = (
  headers: Record<string, string> | undefined,
  key: string
) => {
  if (!headers) return null;

  const direct = headers[key];
  if (direct) return direct;

  const lowerKey = key.toLowerCase();

  for (const headerKey of Object.keys(headers)) {
    if (headerKey.toLowerCase() === lowerKey) {
      return headers[headerKey];
    }
  }

  return null;
};

const parseFileNameFromContentDisposition = (contentDisposition?: string | null) => {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1].trim().replace(/"/g, ""));
  }

  const asciiMatch = contentDisposition.match(/filename=([^;]+)/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1].trim().replace(/"/g, "");
  }

  return null;
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
  timeoutMs = 8000,
  accept = "application/json"
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: accept,
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
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("csv");
  const [exporting, setExporting] = useState(false);

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

  const handleExportData = async () => {
    if (!systemId || !variableId) {
      Alert.alert("Error", "Faltan datos de sistema o variable");
      return;
    }

    if (startDate > endDate) {
      Alert.alert("Error", "La fecha inicial no puede ser mayor a la final");
      return;
    }

    try {
      setExporting(true);

      const rawToken = await AsyncStorage.getItem("token");
      const token = rawToken ? rawToken.replace(/"/g, "") : null;

      if (!token) {
        Alert.alert("Error", "Sesion invalida");
        return;
      }

      const params = new URLSearchParams({
        grouping: "hours",
        start_date: toApiStartDate(startDate),
        end_date: toApiEndDate(endDate),
        format: selectedFormat,
      });

      const endpoint =
        `${API_URL}/growing-systems/${systemId}/variables/${variableId}/history/analytics` +
        `?${params.toString()}`;

      const variableFileToken = sanitizeForFileName(String(variableName || "variable")) || "variable";
      const startToken = formatDateForFileName(startDate);
      const endToken = formatDateForFileName(endDate);
      const defaultFileName = `historial_${variableFileToken}_${startToken}_${endToken}.${getExtensionByFormat(selectedFormat)}`;

      if (Platform.OS === "web") {
        const response = await fetchWithTimeout(endpoint, token, 15000, "*/*");

        if (response.status === 401) {
          throw new Error("Tu sesion expiro o el token es invalido. Inicia sesion de nuevo.");
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
            backendMessage || `No se pudo exportar el historial (HTTP ${response.status})`
          );
        }

        const responseFileName = parseFileNameFromContentDisposition(
          response.headers.get("content-disposition")
        );

        const responseExtension = inferExtensionFromContentType(
          response.headers.get("content-type")
        );

        const fileName = responseFileName ||
          (responseExtension
            ? `historial_${variableFileToken}_${startToken}_${endToken}.${responseExtension}`
            : defaultFileName);

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);

        Alert.alert("Exito", "Archivo generado y descargado correctamente");
        return;
      }

      const baseDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;

      if (!baseDirectory) {
        throw new Error("No se encontro una ruta valida para guardar el archivo");
      }

      const exportDirectory = `${baseDirectory}exports/`;

      await FileSystem.makeDirectoryAsync(exportDirectory, {
        intermediates: true,
      });

      const tempUri = `${exportDirectory}tmp_${Date.now()}_${defaultFileName}`;

      const downloadResult = await FileSystem.downloadAsync(endpoint, tempUri, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "*/*",
        },
      });

      if (!downloadResult || downloadResult.status >= 400) {
        throw new Error("No se pudo descargar el archivo exportado");
      }

      const contentDisposition = getHeaderValue(
        downloadResult.headers,
        "content-disposition"
      );
      const contentType = getHeaderValue(downloadResult.headers, "content-type");

      const responseFileName = parseFileNameFromContentDisposition(contentDisposition);
      const responseExtension = inferExtensionFromContentType(contentType);

      const finalFileName = responseFileName ||
        (responseExtension
          ? `historial_${variableFileToken}_${startToken}_${endToken}.${responseExtension}`
          : defaultFileName);

      const finalUri = `${exportDirectory}${finalFileName}`;

      await FileSystem.moveAsync({
        from: downloadResult.uri,
        to: finalUri,
      });

      if (Platform.OS === "android") {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

        if (permissions.granted) {
          const mimeType = contentType || getMimeByFormat(selectedFormat);
          const base64Content = await FileSystem.readAsStringAsync(finalUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const publicUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            finalFileName,
            mimeType
          );

          await FileSystem.writeAsStringAsync(publicUri, base64Content, {
            encoding: FileSystem.EncodingType.Base64,
          });

          Alert.alert("Exito", "Archivo descargado y guardado en la carpeta seleccionada.");
          return;
        }
      }

      Alert.alert("Exito", `Archivo descargado en: ${finalUri}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo generar el archivo de exportacion";

      Alert.alert("Error", message);
    } finally {
      setExporting(false);
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

        <Text style={styles.label}>Formato de exportacion</Text>
        <View style={styles.formatRow}>
          <TouchableOpacity
            style={[
              styles.formatOption,
              selectedFormat === "csv" && styles.formatOptionSelected,
            ]}
            onPress={() => setSelectedFormat("csv")}
          >
            <Text
              style={[
                styles.formatOptionText,
                selectedFormat === "csv" && styles.formatOptionTextSelected,
              ]}
            >
              CSV (.csv)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.formatOption,
              selectedFormat === "excel" && styles.formatOptionSelected,
            ]}
            onPress={() => setSelectedFormat("excel")}
          >
            <Text
              style={[
                styles.formatOptionText,
                selectedFormat === "excel" && styles.formatOptionTextSelected,
              ]}
            >
              Excel (.xlsx)
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.exportButton,
            (loading || exporting) && styles.buttonDisabled,
          ]}
          onPress={handleExportData}
          disabled={loading || exporting}
        >
          <Ionicons name="download-outline" size={16} color="#fff" />
          <Text style={styles.buttonText}>
            {exporting ? "Descargando archivo..." : "Exportar datos"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.exportHint}>
          La exportacion se realiza desde el endpoint usando el formato seleccionado.
        </Text>
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
  formatRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  formatOption: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
  },
  formatOptionSelected: {
    borderColor: "#166534",
    backgroundColor: "#dcfce7",
  },
  formatOptionText: {
    color: "#334155",
    fontWeight: "600",
  },
  formatOptionTextSelected: {
    color: "#166534",
  },
  exportButton: {
    marginTop: 10,
    backgroundColor: "#0369a1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  exportHint: {
    marginTop: 8,
    color: "#6b7280",
    fontSize: 12,
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
