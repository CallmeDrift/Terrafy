import { API_URL } from "@/constants/router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
	DateTimePickerAndroid,
	DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Modal,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import * as XLSX from "xlsx";

type AgronomicVariable = {
	variableId?: number;
	id?: number;
	name?: string;
	measurementUnit?: string;
	description?: string;
	minValue?: number;
	maxValue?: number;
	currentValue?: number;
	sampleRate?: number;
	status?: string;
};

type GrowingSystemDetail = {
	systemId?: number;
	id?: number;
	name?: string;
	ubication?: string;
	description?: string;
	status?: string;
	creationDate?: string;
	agronomicVariables?: AgronomicVariable[];
	variables?: AgronomicVariable[];
};

type ExportFormat = "csv" | "excel";

type ReportDownloadFormat = "excel" | "json";

type AnalyticsRow = {
	timestamp: string;
	count: number;
	avg: number;
	min: number;
	max: number;
};

type ReportVariableSummary = {
	variableId: number;
	variableName: string;
	measurementUnit: string;
	records: number;
	average: number;
	minimum: number;
	maximum: number;
};

type ReportAlertEvent = {
	variableId: number;
	variableName: string;
	timestamp: string;
	value: number;
	thresholdType: "min" | "max";
	threshold: number;
};

type ConsolidatedReport = {
	generatedAt: string;
	period: {
		startDate: string;
		endDate: string;
	};
	system: {
		systemId: string;
		name: string;
		ubication: string;
		description: string;
		status: string;
	};
	summary: {
		variablesConfigured: number;
		variablesWithData: number;
		totalRecords: number;
		alertEvents: number;
		failedVariables: string[];
	};
	variables: ReportVariableSummary[];
	alerts: ReportAlertEvent[];
};

type ReportVariableSource = {
	id: number | null;
	name: string;
	measurementUnit: string;
	minValue: number | undefined;
	maxValue: number | undefined;
};

const pickFirst = <T,>(...values: Array<T | undefined | null>) => {
	for (const value of values) {
		if (value !== undefined && value !== null) return value;
	}

	return undefined;
};

const toApiStartDate = (date: Date) => {
	const start = new Date(date);
	start.setHours(0, 0, 0, 0);
	return start.toISOString();
};

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const toPickerLabel = (date: Date) =>
	date.toLocaleDateString("es-CO", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});

const toApiEndDate = (date: Date) => {
	const end = new Date(date);
	end.setHours(23, 59, 59, 999);
	return end.toISOString();
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

const ensureFileExtension = (fileName: string, extension: string) => {
	const normalizedExtension = extension.startsWith(".")
		? extension.slice(1)
		: extension;

	if (fileName.toLowerCase().endsWith(`.${normalizedExtension.toLowerCase()}`)) {
		return fileName;
	}

	return `${fileName.replace(/\.[^.]+$/, "")}.${normalizedExtension}`;
};

const buildExcelBase64FromAnalyticsPayload = (payload: any) => {
	const rows = Array.isArray(payload?.data)
		? payload.data.map((item: any) => ({
			timestamp: item?.timestamp ?? "",
			count: item?.count ?? "",
			avg: item?.avg ?? "",
			min: item?.min ?? "",
			max: item?.max ?? "",
		}))
		: [];

	const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ timestamp: "" }]);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, "Historial");

	return XLSX.write(workbook, {
		bookType: "xlsx",
		type: "base64",
	});
};

const base64ToUint8Array = (base64: string) => {
	const binaryString = atob(base64);
	const length = binaryString.length;
	const bytes = new Uint8Array(length);

	for (let i = 0; i < length; i += 1) {
		bytes[i] = binaryString.charCodeAt(i);
	}

	return bytes;
};

const normalizeAnalyticsRows = (payload: any): AnalyticsRow[] => {
	const collection = payload?.data ?? payload?.history ?? payload?.points ?? payload?.records ?? [];

	if (!Array.isArray(collection)) {
		return [];
	}

	return collection
		.map((item: any) => {
			const timestamp = String(item?.timestamp ?? item?.date ?? item?.datetime ?? item?.time ?? "");
			const avg = Number(item?.avg ?? item?.mean ?? item?.average ?? item?.value);
			const min = Number(item?.min ?? item?.avg ?? item?.value);
			const max = Number(item?.max ?? item?.avg ?? item?.value);
			const count = Number(item?.count ?? 1);

			if (!timestamp || Number.isNaN(avg) || Number.isNaN(min) || Number.isNaN(max)) {
				return null;
			}

			return {
				timestamp,
				count: Number.isNaN(count) ? 1 : Math.max(1, count),
				avg,
				min,
				max,
			};
		})
		.filter(Boolean) as AnalyticsRow[];
};

export default function DetailedSystem() {
	const router = useRouter();
	const { systemId } = useLocalSearchParams<{ systemId?: string }>();
	const [loading, setLoading] = useState(true);
	const [detail, setDetail] = useState<GrowingSystemDetail | null>(null);
	const [deletingVariableId, setDeletingVariableId] = useState<number | null>(null);
	const [isEditModalVisible, setIsEditModalVisible] = useState(false);
	const [editingVariableId, setEditingVariableId] = useState<number | null>(null);
	const [editName, setEditName] = useState("");
	const [editMeasurementUnit, setEditMeasurementUnit] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [editMinValue, setEditMinValue] = useState("");
	const [editMaxValue, setEditMaxValue] = useState("");
	const [savingEdit, setSavingEdit] = useState(false);
	const [bulkExportFormat, setBulkExportFormat] = useState<ExportFormat>("excel");
	const [exportingAll, setExportingAll] = useState(false);
	const [reportStartDate, setReportStartDate] = useState(() => {
		const date = new Date();
		date.setDate(date.getDate() - 7);
		return date;
	});
	const [reportEndDate, setReportEndDate] = useState(() => new Date());
	const [showReportStartPicker, setShowReportStartPicker] = useState(false);
	const [showReportEndPicker, setShowReportEndPicker] = useState(false);
	const [generatingReport, setGeneratingReport] = useState(false);
	const [downloadingReport, setDownloadingReport] = useState(false);
	const [reportDownloadFormat, setReportDownloadFormat] = useState<ReportDownloadFormat>("excel");
	const [reportData, setReportData] = useState<ConsolidatedReport | null>(null);
	const [reportMessage, setReportMessage] = useState("");

	const getVariableId = (variable: AgronomicVariable) =>
		variable.variableId ?? variable.id ?? null;

	const getVariableCurrentValue = (variable: AgronomicVariable) => {
		if (typeof variable.currentValue === "number" && !Number.isNaN(variable.currentValue)) {
			return variable.currentValue;
		}

		return undefined;
	};

	const isVariableOutOfThreshold = (variable: AgronomicVariable) => {
		const currentValue = getVariableCurrentValue(variable);
		const hasMin = typeof variable.minValue === "number" && !Number.isNaN(variable.minValue);
		const hasMax = typeof variable.maxValue === "number" && !Number.isNaN(variable.maxValue);

		if (typeof currentValue === "number" && (hasMin || hasMax)) {
			if (hasMin && currentValue < (variable.minValue as number)) return true;
			if (hasMax && currentValue > (variable.maxValue as number)) return true;
			return false;
		}

		const statusText = String(variable.status || "").toLowerCase();
		return /(fuera|out|alert|critical|danger|alarm)/.test(statusText);
	};

	const openEditVariableModal = (variable: AgronomicVariable) => {
		const variableId = getVariableId(variable);
		if (!variableId) {
			Alert.alert("Error", "No se encontró el identificador de la variable");
			return;
		}

		setEditingVariableId(variableId);
		setEditName(variable.name || "");
		setEditMeasurementUnit(variable.measurementUnit || "");
		setEditDescription(variable.description || "");
		setEditMinValue(
			typeof variable.minValue === "number" ? String(variable.minValue) : ""
		);
		setEditMaxValue(
			typeof variable.maxValue === "number" ? String(variable.maxValue) : ""
		);
		setIsEditModalVisible(true);
	};

	const closeEditVariableModal = () => {
		if (savingEdit) return;
		setIsEditModalVisible(false);
		setEditingVariableId(null);
		setEditName("");
		setEditMeasurementUnit("");
		setEditDescription("");
		setEditMinValue("");
		setEditMaxValue("");
	};

	const handleEditVariable = async () => {
		if (!editingVariableId) {
			Alert.alert("Error", "No se encontró la variable a editar");
			return;
		}

		if (!editName.trim()) {
			Alert.alert("Error", "El nombre de la variable es obligatorio");
			return;
		}

		if (!editMeasurementUnit.trim()) {
			Alert.alert("Error", "La unidad de medida es obligatoria");
			return;
		}

		if (editMinValue.trim() === "" || editMaxValue.trim() === "") {
			Alert.alert("Error", "Los umbrales mínimo y máximo son obligatorios");
			return;
		}

		const parsedMinValue = Number(editMinValue);
		const parsedMaxValue = Number(editMaxValue);

		if (Number.isNaN(parsedMinValue) || Number.isNaN(parsedMaxValue)) {
			Alert.alert("Error", "Los umbrales deben ser valores numéricos");
			return;
		}

		if (parsedMinValue > parsedMaxValue) {
			Alert.alert("Error", "El umbral máximo debe ser mayor o igual al mínimo");
			return;
		}

		try {
			setSavingEdit(true);

			const rawToken = await AsyncStorage.getItem("token");
			const token = rawToken ? rawToken.replace(/"/g, "") : null;

			if (!token) {
				Alert.alert("Error", "Sesión inválida");
				return;
			}

			const response = await fetch(
				`${API_URL}/agronomic-variables/${editingVariableId}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						name: editName.trim(),
						measurementUnit: editMeasurementUnit.trim(),
						description: editDescription.trim(),
					}),
				}
			);

			if (!response.ok) {
				let message = "No se pudo actualizar la variable";

				try {
					const errorPayload = await response.json();
					message =
						errorPayload?.error?.message ||
						errorPayload?.message ||
						message;
				} catch {
					// no-op
				}

				throw new Error(message);
			}

			const systemIdentifier = String(systemId || detail?.systemId || detail?.id || "");
			if (!systemIdentifier) {
				throw new Error("No se encontró el identificador del sistema");
			}

			const alertDefinitionResponse = await fetch(
				`${API_URL}/growing-systems/${systemIdentifier}/variable/${editingVariableId}/alert-definition`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						minValue: parsedMinValue,
						maxValue: parsedMaxValue,
					}),
				}
			);

			if (!alertDefinitionResponse.ok && alertDefinitionResponse.status !== 204) {
				let message = "No se pudieron actualizar los umbrales de alerta";

				try {
					const errorPayload = await alertDefinitionResponse.json();
					message =
						errorPayload?.error?.message ||
						errorPayload?.message ||
						message;
				} catch {
					// no-op
				}

				throw new Error(message);
			}

			const updated = await response.json();

			setDetail((prev) => {
				if (!prev) return prev;

				const updateVariable = (list?: AgronomicVariable[]) =>
					(list || []).map((item) => {
						if (getVariableId(item) !== editingVariableId) return item;

						return {
							...item,
							name: updated?.name ?? editName.trim(),
							measurementUnit:
								updated?.measurementUnit ?? editMeasurementUnit.trim(),
							description: updated?.description ?? editDescription.trim(),
							minValue: parsedMinValue,
							maxValue: parsedMaxValue,
						};
					});

				return {
					...prev,
					agronomicVariables: updateVariable(prev.agronomicVariables),
					variables: updateVariable(prev.variables),
				};
			});

			Alert.alert("Éxito", "Variable actualizada correctamente");
			closeEditVariableModal();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "No se pudo actualizar la variable";
			Alert.alert("Error", message);
		} finally {
			setSavingEdit(false);
		}
	};

	const confirmDeleteVariable = async (variableName: string) => {
		if (Platform.OS === "web") {
			return confirm(`¿Deseas eliminar la variable ${variableName}?`);
		}

		return new Promise<boolean>((resolve) => {
			Alert.alert(
				"Eliminar variable",
				`¿Deseas eliminar la variable ${variableName}?`,
				[
					{
						text: "Cancelar",
						style: "cancel",
						onPress: () => resolve(false),
					},
					{
						text: "Eliminar",
						style: "destructive",
						onPress: () => resolve(true),
					},
				]
			);
		});
	};

	const handleDeleteVariable = async (variable: AgronomicVariable) => {
		const variableId = getVariableId(variable);
		const variableName = variable.name || "seleccionada";

		if (!variableId) {
			Alert.alert("Error", "No se encontró el identificador de la variable");
			return;
		}

		if (!systemId) {
			Alert.alert("Error", "No se encontró el identificador del sistema");
			return;
		}

		const confirmed = await confirmDeleteVariable(variableName);
		if (!confirmed) return;

		try {
			setDeletingVariableId(variableId);

			const token = await AsyncStorage.getItem("token");
			if (!token) {
				Alert.alert("Error", "Sesión inválida");
				return;
			}

			const response = await fetch(
				`${API_URL}/growing-systems/${systemId}/variable/${variableId}`,
				{
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				}
			);

			const deleted = response.ok || response.status === 204;
			const lastStatus: number | null = response.status;

			if (!deleted) {
				if (lastStatus === 404) {
					throw new Error("Endpoint de eliminación no encontrado en el backend");
				}

				throw new Error("No se pudo eliminar la variable");
			}

			setDetail((prev) => {
				if (!prev) return prev;

				const removeVariable = (list?: AgronomicVariable[]) =>
					(list || []).filter((item) => getVariableId(item) !== variableId);

				return {
					...prev,
					agronomicVariables: removeVariable(prev.agronomicVariables),
					variables: removeVariable(prev.variables),
				};
			});

			Alert.alert("Éxito", "Variable eliminada correctamente");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "No se pudo eliminar la variable";
			Alert.alert("Error", message);
		} finally {
			setDeletingVariableId(null);
		}
	};

	const handleExportAllVariables = async () => {
		const systemIdentifier = String(systemId || detail?.systemId || detail?.id || "");

		if (!systemIdentifier) {
			Alert.alert("Error", "No se encontro el identificador del sistema");
			return;
		}

		const exportableVariables = (detail?.agronomicVariables || detail?.variables || [])
			.map((variable) => ({
				id: getVariableId(variable),
				name: variable.name || "variable",
			}))
			.filter((item): item is { id: number; name: string } => Boolean(item.id));

		if (exportableVariables.length === 0) {
			Alert.alert("Error", "No hay variables validas para exportar");
			return;
		}

		try {
			setExportingAll(true);

			const rawToken = await AsyncStorage.getItem("token");
			const token = rawToken ? rawToken.replace(/"/g, "") : null;

			if (!token) {
				Alert.alert("Error", "Sesion invalida");
				return;
			}

			const endDate = new Date();
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - 7);

			const startToken = formatDateForFileName(startDate);
			const endToken = formatDateForFileName(endDate);
			const systemFileToken = sanitizeForFileName(detail?.name || "sistema") || "sistema";

			let successfulDownloads = 0;
			const failedVariables: string[] = [];

			const sharedExportDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
			let exportDirectory: string | null = null;
			if (sharedExportDirectory) {
				exportDirectory = `${sharedExportDirectory}exports/`;
				await FileSystem.makeDirectoryAsync(exportDirectory, { intermediates: true });
			}

			let androidDirectoryUri: string | null = null;
			if (Platform.OS === "android") {
				const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

				if (permissions.granted) {
					androidDirectoryUri = permissions.directoryUri;
				}
			}

			for (const variable of exportableVariables) {
				try {
					const params = new URLSearchParams({
						grouping: "hours",
						start_date: toApiStartDate(startDate),
						end_date: toApiEndDate(endDate),
						format: bulkExportFormat,
					});

					const endpoint =
						`${API_URL}/growing-systems/${systemIdentifier}/variables/${variable.id}/history/analytics` +
						`?${params.toString()}`;

					const variableFileToken = sanitizeForFileName(variable.name) || `variable_${variable.id}`;
					const fallbackFileName =
						`historico_${systemFileToken}_${variableFileToken}_${startToken}_${endToken}.` +
						`${getExtensionByFormat(bulkExportFormat)}`;

					if (Platform.OS === "web") {
						const response = await fetch(endpoint, {
							headers: {
								Authorization: `Bearer ${token}`,
								Accept: "*/*",
							},
						});

						if (!response.ok) {
							throw new Error(`HTTP ${response.status}`);
						}

						const responseFileName = parseFileNameFromContentDisposition(
							response.headers.get("content-disposition")
						);

						const responseExtension = inferExtensionFromContentType(
							response.headers.get("content-type")
						);
						const contentType = response.headers.get("content-type");
						const isJsonWhenExcel =
							bulkExportFormat === "excel" &&
							String(contentType || "").toLowerCase().includes("json");

						let fileName = responseFileName ||
							(responseExtension
								? `historico_${systemFileToken}_${variableFileToken}_${startToken}_${endToken}.${responseExtension}`
								: fallbackFileName);

						let blob: Blob;

						if (isJsonWhenExcel) {
							const payload = await response.json();
							const excelBase64 = buildExcelBase64FromAnalyticsPayload(payload);
							blob = new Blob([base64ToUint8Array(excelBase64)], {
								type: getMimeByFormat("excel"),
							});
							fileName = ensureFileExtension(fileName, "xlsx");
						} else {
							blob = await response.blob();

							if (bulkExportFormat === "excel") {
								fileName = ensureFileExtension(fileName, "xlsx");
							}
						}

						const blobUrl = URL.createObjectURL(blob);
						const link = document.createElement("a");
						link.href = blobUrl;
						link.download = fileName;
						document.body.appendChild(link);
						link.click();
						document.body.removeChild(link);
						URL.revokeObjectURL(blobUrl);

						successfulDownloads += 1;
						continue;
					}

					if (!exportDirectory) {
						throw new Error("No se encontro una ruta local para guardar archivos");
					}

					const tempUri = `${exportDirectory}tmp_${Date.now()}_${variable.id}`;
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
					const isJsonWhenExcel =
						bulkExportFormat === "excel" &&
						String(contentType || "").toLowerCase().includes("json");

					let finalFileName = responseFileName ||
						(responseExtension
							? `historico_${systemFileToken}_${variableFileToken}_${startToken}_${endToken}.${responseExtension}`
							: fallbackFileName);

					if (bulkExportFormat === "excel") {
						finalFileName = ensureFileExtension(finalFileName, "xlsx");
					}

					const finalUri = `${exportDirectory}${finalFileName}`;

					if (isJsonWhenExcel) {
						const rawPayload = await FileSystem.readAsStringAsync(downloadResult.uri, {
							encoding: FileSystem.EncodingType.UTF8,
						});
						const payload = JSON.parse(rawPayload);
						const excelBase64 = buildExcelBase64FromAnalyticsPayload(payload);

						await FileSystem.writeAsStringAsync(finalUri, excelBase64, {
							encoding: FileSystem.EncodingType.Base64,
						});

						await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
					} else {
						await FileSystem.moveAsync({
							from: downloadResult.uri,
							to: finalUri,
						});
					}

					if (androidDirectoryUri) {
						const mimeType = contentType || getMimeByFormat(bulkExportFormat);
						const base64Content = await FileSystem.readAsStringAsync(finalUri, {
							encoding: FileSystem.EncodingType.Base64,
						});

						const publicUri = await FileSystem.StorageAccessFramework.createFileAsync(
							androidDirectoryUri,
							finalFileName,
							mimeType
						);

						await FileSystem.writeAsStringAsync(publicUri, base64Content, {
							encoding: FileSystem.EncodingType.Base64,
						});
					}

					successfulDownloads += 1;
				} catch {
					failedVariables.push(variable.name);
				}
			}

			if (failedVariables.length === 0) {
				Alert.alert(
					"Exito",
					`Se descargaron ${successfulDownloads} archivos del sistema.`
				);
				return;
			}

			Alert.alert(
				"Exportacion finalizada",
				`Descargas exitosas: ${successfulDownloads}. Fallidas: ${failedVariables.length}.`
			);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "No se pudo exportar el historico de todas las variables";

			Alert.alert("Error", message);
		} finally {
			setExportingAll(false);
		}
	};

	const openReportStartDatePicker = () => {
		if (Platform.OS === "android") {
			DateTimePickerAndroid.open({
				value: reportStartDate,
				mode: "date",
				is24Hour: true,
				onChange: (event, selectedDate) => {
					if (event.type === "set" && selectedDate) {
						setReportStartDate(selectedDate);
					}
				},
			});
			return;
		}

		setShowReportStartPicker(true);
	};

	const openReportEndDatePicker = () => {
		if (Platform.OS === "android") {
			DateTimePickerAndroid.open({
				value: reportEndDate,
				mode: "date",
				is24Hour: true,
				onChange: (event, selectedDate) => {
					if (event.type === "set" && selectedDate) {
						setReportEndDate(selectedDate);
					}
				},
			});
			return;
		}

		setShowReportEndPicker(true);
	};

	const handleGenerateReport = async () => {
		const systemIdentifier = String(systemId || detail?.systemId || detail?.id || "");

		if (!systemIdentifier) {
			Alert.alert("Error", "No se encontro el identificador del sistema");
			return;
		}

		if (reportStartDate > reportEndDate) {
			Alert.alert("Error", "La fecha inicial no puede ser mayor a la final");
			return;
		}

		const variablesSource = detail?.agronomicVariables || detail?.variables || [];
		const exportableVariables = variablesSource
			.map((variable) => ({
				id: getVariableId(variable),
				name: variable.name || "Variable",
				measurementUnit: variable.measurementUnit || "",
				minValue: variable.minValue,
				maxValue: variable.maxValue,
			}))
			.filter((item: ReportVariableSource): item is ReportVariableSource & { id: number } =>
				item.id !== null
			);

		if (exportableVariables.length === 0) {
			Alert.alert("Error", "No hay variables configuradas para generar reporte");
			return;
		}

		try {
			setGeneratingReport(true);
			setReportMessage("");

			const rawToken = await AsyncStorage.getItem("token");
			const token = rawToken ? rawToken.replace(/"/g, "") : null;

			if (!token) {
				Alert.alert("Error", "Sesion invalida");
				return;
			}

			const variableSummaries: ReportVariableSummary[] = [];
			const alertEvents: ReportAlertEvent[] = [];
			const failedVariables: string[] = [];

			for (const variable of exportableVariables) {
				try {
					const params = new URLSearchParams({
						grouping: "hours",
						start_date: toApiStartDate(reportStartDate),
						end_date: toApiEndDate(reportEndDate),
					});

					const endpoint =
						`${API_URL}/growing-systems/${systemIdentifier}/variables/${variable.id}/history/analytics` +
						`?${params.toString()}`;

					const response = await fetch(endpoint, {
						headers: {
							Authorization: `Bearer ${token}`,
							Accept: "application/json",
						},
					});

					if (!response.ok) {
						throw new Error(`HTTP ${response.status}`);
					}

					const payload = await response.json();
					const rows = normalizeAnalyticsRows(payload);

					if (rows.length === 0) {
						continue;
					}

					const records = rows.reduce((sum, row) => sum + row.count, 0);
					const avg = rows.reduce((sum, row) => sum + row.avg, 0) / rows.length;
					const min = Math.min(...rows.map((row) => row.min));
					const max = Math.max(...rows.map((row) => row.max));

					variableSummaries.push({
						variableId: variable.id,
						variableName: variable.name,
						measurementUnit: variable.measurementUnit,
						records,
						average: avg,
						minimum: min,
						maximum: max,
					});

					const hasMinThreshold =
						typeof variable.minValue === "number" && !Number.isNaN(variable.minValue);
					const hasMaxThreshold =
						typeof variable.maxValue === "number" && !Number.isNaN(variable.maxValue);

					for (const row of rows) {
						if (hasMinThreshold && row.avg < (variable.minValue as number)) {
							alertEvents.push({
								variableId: variable.id,
								variableName: variable.name,
								timestamp: row.timestamp,
								value: row.avg,
								thresholdType: "min",
								threshold: variable.minValue as number,
							});
						}

						if (hasMaxThreshold && row.avg > (variable.maxValue as number)) {
							alertEvents.push({
								variableId: variable.id,
								variableName: variable.name,
								timestamp: row.timestamp,
								value: row.avg,
								thresholdType: "max",
								threshold: variable.maxValue as number,
							});
						}
					}
				} catch {
					failedVariables.push(variable.name);
				}
			}

			if (variableSummaries.length === 0) {
				setReportData(null);
				setReportMessage("No existen datos historicos en el periodo seleccionado.");
				Alert.alert("Sin datos", "No existen datos en el periodo seleccionado");
				return;
			}

			const report: ConsolidatedReport = {
				generatedAt: new Date().toISOString(),
				period: {
					startDate: toApiStartDate(reportStartDate),
					endDate: toApiEndDate(reportEndDate),
				},
				system: {
					systemId: systemIdentifier,
					name: detail?.name || "Sistema",
					ubication: detail?.ubication || "No registrada",
					description: detail?.description || "Sin descripcion",
					status: detail?.status || "Sin estado",
				},
				summary: {
					variablesConfigured: exportableVariables.length,
					variablesWithData: variableSummaries.length,
					totalRecords: variableSummaries.reduce((sum, item) => sum + item.records, 0),
					alertEvents: alertEvents.length,
					failedVariables,
				},
				variables: variableSummaries,
				alerts: alertEvents,
			};

			setReportData(report);
			setReportMessage("");
			Alert.alert("Exito", "Reporte consolidado generado correctamente");
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "No se pudo generar el reporte consolidado";

			Alert.alert("Error", message);
		} finally {
			setGeneratingReport(false);
		}
	};

	const handleDownloadReport = async () => {
		if (!reportData) {
			Alert.alert("Error", "Primero debes generar el reporte");
			return;
		}

		try {
			setDownloadingReport(true);

			const systemFileToken = sanitizeForFileName(reportData.system.name) || "sistema";
			const startToken = formatDateForFileName(reportStartDate);
			const endToken = formatDateForFileName(reportEndDate);

			if (reportDownloadFormat === "json") {
				const fileName = `reporte_${systemFileToken}_${startToken}_${endToken}.json`;
				const jsonContent = JSON.stringify(reportData, null, 2);

				if (Platform.OS === "web") {
					const blob = new Blob([jsonContent], { type: "application/json" });
					const blobUrl = URL.createObjectURL(blob);
					const link = document.createElement("a");
					link.href = blobUrl;
					link.download = fileName;
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
					URL.revokeObjectURL(blobUrl);
					return;
				}

				const baseDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
				if (!baseDirectory) {
					throw new Error("No se encontro una ruta para guardar el reporte");
				}

				const reportDirectory = `${baseDirectory}reports/`;
				await FileSystem.makeDirectoryAsync(reportDirectory, { intermediates: true });
				const localUri = `${reportDirectory}${fileName}`;

				await FileSystem.writeAsStringAsync(localUri, jsonContent, {
					encoding: FileSystem.EncodingType.UTF8,
				});

				if (Platform.OS === "android") {
					const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
					if (permissions.granted) {
						const publicUri = await FileSystem.StorageAccessFramework.createFileAsync(
							permissions.directoryUri,
							fileName,
							"application/json"
						);

						await FileSystem.writeAsStringAsync(publicUri, jsonContent, {
							encoding: FileSystem.EncodingType.UTF8,
						});
					}
				}

				Alert.alert("Exito", "Reporte descargado correctamente");
				return;
			}

			const metadataRows = [
				{ campo: "Fecha de generacion", valor: new Date(reportData.generatedAt).toLocaleString("es-CO") },
				{ campo: "Sistema", valor: reportData.system.name },
				{ campo: "Ubicacion", valor: reportData.system.ubication },
				{ campo: "Estado", valor: reportData.system.status },
				{ campo: "Periodo inicio", valor: new Date(reportData.period.startDate).toLocaleString("es-CO") },
				{ campo: "Periodo fin", valor: new Date(reportData.period.endDate).toLocaleString("es-CO") },
			];

			const summaryRows = reportData.variables.map((item) => ({
				variable: item.variableName,
				unidad: item.measurementUnit,
				registros: item.records,
				promedio: Number(item.average.toFixed(4)),
				minimo: Number(item.minimum.toFixed(4)),
				maximo: Number(item.maximum.toFixed(4)),
			}));

			const alertsRows = reportData.alerts.map((item) => ({
				variable: item.variableName,
				timestamp: item.timestamp,
				valor: Number(item.value.toFixed(4)),
				tipo: item.thresholdType === "min" ? "Debajo de minimo" : "Encima de maximo",
				umbral: item.threshold,
			}));

			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.json_to_sheet(metadataRows),
				"Sistema"
			);
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.json_to_sheet(summaryRows.length > 0 ? summaryRows : [{ variable: "Sin datos" }]),
				"Resumen"
			);
			XLSX.utils.book_append_sheet(
				workbook,
				XLSX.utils.json_to_sheet(alertsRows.length > 0 ? alertsRows : [{ variable: "Sin alertas" }]),
				"Alertas"
			);

			const excelBase64 = XLSX.write(workbook, {
				bookType: "xlsx",
				type: "base64",
			});

			const fileName = `reporte_${systemFileToken}_${startToken}_${endToken}.xlsx`;

			if (Platform.OS === "web") {
				const blob = new Blob([base64ToUint8Array(excelBase64)], {
					type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				});
				const blobUrl = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = blobUrl;
				link.download = fileName;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				URL.revokeObjectURL(blobUrl);
				return;
			}

			const baseDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
			if (!baseDirectory) {
				throw new Error("No se encontro una ruta para guardar el reporte");
			}

			const reportDirectory = `${baseDirectory}reports/`;
			await FileSystem.makeDirectoryAsync(reportDirectory, { intermediates: true });
			const localUri = `${reportDirectory}${fileName}`;

			await FileSystem.writeAsStringAsync(localUri, excelBase64, {
				encoding: FileSystem.EncodingType.Base64,
			});

			if (Platform.OS === "android") {
				const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
				if (permissions.granted) {
					const publicUri = await FileSystem.StorageAccessFramework.createFileAsync(
						permissions.directoryUri,
						fileName,
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
					);

					await FileSystem.writeAsStringAsync(publicUri, excelBase64, {
						encoding: FileSystem.EncodingType.Base64,
					});
				}
			}

			Alert.alert("Exito", "Reporte descargado correctamente");
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "No se pudo descargar el reporte";

			Alert.alert("Error", message);
		} finally {
			setDownloadingReport(false);
		}
	};

	const fetchSystemDetail = useCallback(async () => {
		if (!systemId) {
			Alert.alert("Error", "No se recibió el identificador del sistema");
			setLoading(false);
			return;
		}

		try {
			setLoading(true);

			const token = await AsyncStorage.getItem("token");

			const response = await fetch(
				`${API_URL}/growing-systems/system/${systemId}`,
				{
					headers: token
						? {
								Authorization: `Bearer ${token}`,
							}
						: undefined,
				}
			);
			if (!response.ok) {
				throw new Error("No se pudo recuperar el sistema de cultivo");
			}

			const result = await response.json();
			const rawSystem =
				result?.system ?? result?.growingSystem ?? result?.data ?? result;

			const rawVariables =
				rawSystem?.agronomicVariables ??
				rawSystem?.variables ??
				result?.agronomicVariables ??
				result?.variables ??
				[];

			const normalizedVariables: AgronomicVariable[] = (rawVariables || []).map(
				(item: any) => {
					const source = item?.variable ?? item?.agronomicVariable ?? item;

					return {
						variableId: pickFirst(source?.variableId, source?.id, item?.variableId, item?.id),
						id: pickFirst(source?.id, source?.variableId, item?.id, item?.variableId),
						name: pickFirst(source?.name, source?.variableName, item?.name),
						minValue: pickFirst(
							source?.minValue,
							source?.alertDefinition?.minValue,
							item?.minValue,
							item?.alertDefinition?.minValue
						),
						maxValue: pickFirst(
							source?.maxValue,
							source?.alertDefinition?.maxValue,
							item?.maxValue,
							item?.alertDefinition?.maxValue
						),
						currentValue: pickFirst(
							source?.currentValue,
							source?.latestValue,
							source?.lastValue,
							source?.value,
							item?.currentValue,
							item?.latestValue,
							item?.lastValue,
							item?.value
						),
						measurementUnit: pickFirst(
							source?.measurementUnit,
							source?.unit,
							item?.measurementUnit,
							item?.unit
						),
						description: pickFirst(source?.description, item?.description),
						sampleRate: pickFirst(item?.sampleRate, source?.sampleRate),
						status: pickFirst(source?.status, item?.status),
					};
				}
			);

			const parsedDetail: GrowingSystemDetail = {
				systemId: pickFirst(rawSystem?.systemId, rawSystem?.id),
				id: pickFirst(rawSystem?.id, rawSystem?.systemId),
				name: pickFirst(rawSystem?.name, rawSystem?.systemName, rawSystem?.greenhouseName),
				ubication: pickFirst(rawSystem?.ubication, rawSystem?.location, rawSystem?.address),
				description: pickFirst(rawSystem?.description, rawSystem?.details),
				status: pickFirst(rawSystem?.status, rawSystem?.state),
				creationDate: pickFirst(
					rawSystem?.creationDate,
					rawSystem?.createdAt,
					rawSystem?.created_at
				),
				agronomicVariables: normalizedVariables,
				variables: normalizedVariables,
			};

			setDetail(parsedDetail);
		} catch (error) {
			Alert.alert("Error", "No se pudieron cargar los detalles del sistema");
		} finally {
			setLoading(false);
		}
	}, [systemId]);

	useEffect(() => {
		fetchSystemDetail();
	}, [fetchSystemDetail]);

	const variables =
		detail?.agronomicVariables || detail?.variables || [];
	const hasOutOfThresholdVariables = variables.some((variable) =>
		isVariableOutOfThreshold(variable)
	);

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<View style={styles.topSection}>
				<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
					<Ionicons name="arrow-back" size={18} color="#166534" />
					<Text style={styles.backText}>Volver</Text>
				</TouchableOpacity>

				<Text style={styles.title}>Detalle de invernadero</Text>

				<TouchableOpacity
					style={styles.analysisButton}
					onPress={() =>
						router.push({
							pathname: "/(options)/comparative-analysis",
							params: {
								systemId: String(systemId || detail?.systemId || detail?.id || ""),
								systemName: detail?.name || "Sistema",
							},
						})
					}
				>
					<Ionicons name="analytics-outline" size={16} color="#166534" />
					<Text style={styles.analysisButtonText}>Analisis comparativo</Text>
				</TouchableOpacity>

				<View style={styles.exportAllContainer}>
					<Text style={styles.exportAllLabel}>Exportar historicos de todas las variables</Text>
					<View style={styles.exportAllFormatRow}>
						<TouchableOpacity
							style={[
								styles.exportAllFormatOption,
								bulkExportFormat === "excel" && styles.exportAllFormatOptionSelected,
							]}
							onPress={() => setBulkExportFormat("excel")}
						>
							<Text
								style={[
									styles.exportAllFormatText,
									bulkExportFormat === "excel" && styles.exportAllFormatTextSelected,
								]}
							>
								Excel
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[
								styles.exportAllFormatOption,
								bulkExportFormat === "csv" && styles.exportAllFormatOptionSelected,
							]}
							onPress={() => setBulkExportFormat("csv")}
						>
							<Text
								style={[
									styles.exportAllFormatText,
									bulkExportFormat === "csv" && styles.exportAllFormatTextSelected,
								]}
							>
								CSV
							</Text>
						</TouchableOpacity>
					</View>

					<TouchableOpacity
						style={[
							styles.exportAllButton,
							(exportingAll || loading) && styles.buttonDisabled,
						]}
						onPress={handleExportAllVariables}
						disabled={exportingAll || loading}
					>
						<Ionicons name="download-outline" size={16} color="#ffffff" />
						<Text style={styles.exportAllButtonText}>
							{exportingAll ? "Descargando..." : "Descargar todas"}
						</Text>
					</TouchableOpacity>
				</View>

				<View style={styles.reportContainer}>
					<Text style={styles.reportTitle}>Generar reporte consolidado</Text>

					<Text style={styles.reportLabel}>Fecha inicial</Text>
					{Platform.OS === "web" ? (
						<TextInput
							style={styles.reportInput}
							value={toDateInput(reportStartDate)}
							onChangeText={(value) => {
								const parsed = new Date(`${value}T00:00:00`);
								if (!Number.isNaN(parsed.getTime())) {
									setReportStartDate(parsed);
								}
							}}
							placeholder="YYYY-MM-DD"
						/>
					) : (
						<TouchableOpacity style={styles.reportDateButton} onPress={openReportStartDatePicker}>
							<Ionicons name="calendar-outline" size={16} color="#166534" />
							<Text style={styles.reportDateText}>{toPickerLabel(reportStartDate)}</Text>
						</TouchableOpacity>
					)}

					<Text style={styles.reportLabel}>Fecha final</Text>
					{Platform.OS === "web" ? (
						<TextInput
							style={styles.reportInput}
							value={toDateInput(reportEndDate)}
							onChangeText={(value) => {
								const parsed = new Date(`${value}T00:00:00`);
								if (!Number.isNaN(parsed.getTime())) {
									setReportEndDate(parsed);
								}
							}}
							placeholder="YYYY-MM-DD"
						/>
					) : (
						<TouchableOpacity style={styles.reportDateButton} onPress={openReportEndDatePicker}>
							<Ionicons name="calendar-outline" size={16} color="#166534" />
							<Text style={styles.reportDateText}>{toPickerLabel(reportEndDate)}</Text>
						</TouchableOpacity>
					)}

					<TouchableOpacity
						style={[styles.reportGenerateButton, (generatingReport || loading) && styles.buttonDisabled]}
						onPress={handleGenerateReport}
						disabled={generatingReport || loading}
					>
						<Ionicons name="document-text-outline" size={16} color="#ffffff" />
						<Text style={styles.reportGenerateButtonText}>
							{generatingReport ? "Generando..." : "Generar reporte"}
						</Text>
					</TouchableOpacity>

					{reportData && (
						<>
							<View style={styles.reportSummaryBox}>
								<Text style={styles.reportSummaryText}>
									Variables con datos: {reportData.summary.variablesWithData} / {reportData.summary.variablesConfigured}
								</Text>
								<Text style={styles.reportSummaryText}>
									Registros: {reportData.summary.totalRecords} | Alertas: {reportData.summary.alertEvents}
								</Text>
							</View>

							<Text style={styles.reportLabel}>Descargar reporte</Text>
							<View style={styles.reportFormatRow}>
								<TouchableOpacity
									style={[
										styles.reportFormatOption,
										reportDownloadFormat === "excel" && styles.reportFormatOptionSelected,
									]}
									onPress={() => setReportDownloadFormat("excel")}
								>
									<Text
										style={[
											styles.reportFormatText,
											reportDownloadFormat === "excel" && styles.reportFormatTextSelected,
										]}
									>
										Excel
									</Text>
								</TouchableOpacity>

								<TouchableOpacity
									style={[
										styles.reportFormatOption,
										reportDownloadFormat === "json" && styles.reportFormatOptionSelected,
									]}
									onPress={() => setReportDownloadFormat("json")}
								>
									<Text
										style={[
											styles.reportFormatText,
											reportDownloadFormat === "json" && styles.reportFormatTextSelected,
										]}
									>
										JSON
									</Text>
								</TouchableOpacity>
							</View>

							<TouchableOpacity
								style={[styles.reportDownloadButton, downloadingReport && styles.buttonDisabled]}
								onPress={handleDownloadReport}
								disabled={downloadingReport}
							>
								<Ionicons name="download-outline" size={16} color="#ffffff" />
								<Text style={styles.reportDownloadButtonText}>
									{downloadingReport ? "Descargando..." : "Descargar reporte"}
								</Text>
							</TouchableOpacity>
						</>
					)}

					{reportMessage ? <Text style={styles.reportInfoText}>{reportMessage}</Text> : null}
				</View>
			</View>

			{showReportStartPicker && Platform.OS === "ios" && (
				<DateTimePicker
					value={reportStartDate}
					mode="date"
					display="inline"
					onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
						if (event.type === "set" && selectedDate) {
							setReportStartDate(selectedDate);
						}
					}}
				/>
			)}

			{showReportEndPicker && Platform.OS === "ios" && (
				<DateTimePicker
					value={reportEndDate}
					mode="date"
					display="inline"
					onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
						if (event.type === "set" && selectedDate) {
							setReportEndDate(selectedDate);
						}
					}}
				/>
			)}

			{loading ? (
				<ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 24 }} />
			) : (
				<>
					<View
						style={[
							styles.card,
							hasOutOfThresholdVariables && styles.alertSystemCard,
						]}
					>
						<Text style={styles.systemName}>{detail?.name || "Sin nombre"}</Text>
						{hasOutOfThresholdVariables && (
							<View style={styles.alertBadge}>
								<Text style={styles.alertBadgeText}>Variables fuera de umbral</Text>
							</View>
						)}

						<View style={styles.infoRow}>
							<Text style={styles.label}>Ubicación</Text>
							<Text style={styles.value}>{detail?.ubication || "No registrada"}</Text>
						</View>

						<View style={styles.infoRow}>
							<Text style={styles.label}>Estado</Text>
							<Text style={styles.value}>{detail?.status || "Sin estado"}</Text>
						</View>

						<View style={styles.infoRow}>
							<Text style={styles.label}>Creación</Text>
							<Text style={styles.value}>
								{detail?.creationDate
									? new Date(detail.creationDate).toLocaleString()
									: "Sin fecha"}
							</Text>
						</View>

						<View style={styles.descriptionBox}>
							<Text style={styles.label}>Descripción</Text>
							<Text style={styles.descriptionText}>
								{detail?.description || "Sin descripción"}
							</Text>
						</View>
					</View>

					<Text style={styles.sectionTitle}>Variables agronómicas</Text>

					{variables.length === 0 ? (
						<View style={styles.emptyCard}>
							<Text style={styles.emptyText}>No hay variables asociadas</Text>
						</View>
					) : (
						variables.map((variable, index) => {
							const outOfThreshold = isVariableOutOfThreshold(variable);
							const currentValue = getVariableCurrentValue(variable);

							return (
							<View
								key={String(variable.variableId || variable.id || index)}
								style={[
									styles.variableCard,
									outOfThreshold && styles.alertVariableCard,
								]}
							>
								<View style={styles.variableHeader}>
									<View style={styles.variableTitleContainer}>
										<Text style={styles.variableTitle}>{variable.name || "Sin nombre"}</Text>
										{outOfThreshold && (
											<View style={styles.alertChip}>
												<Text style={styles.alertChipText}>Fuera de umbral</Text>
											</View>
										)}
									</View>
									<View style={styles.variableActions}>
										<TouchableOpacity
											onPress={() => openEditVariableModal(variable)}
											disabled={savingEdit || deletingVariableId === getVariableId(variable)}
										>
											<Ionicons name="pencil" size={18} color="#166534" />
										</TouchableOpacity>
										<TouchableOpacity
											onPress={() => handleDeleteVariable(variable)}
											disabled={deletingVariableId === getVariableId(variable)}
										>
											<Ionicons name="trash-outline" size={18} color="#dc2626" />
										</TouchableOpacity>
									</View>
								</View>

								<View style={styles.infoRow}>
									<Text style={styles.label}>Unidad</Text>
									<Text style={styles.value}>{variable.measurementUnit || "-"}</Text>
								</View>

								<View style={styles.infoRow}>
									<Text style={styles.label}>Frecuencia</Text>
									<Text style={styles.value}>
										{variable.sampleRate ? `${variable.sampleRate}s` : "-"}
									</Text>
								</View>

								<View style={styles.infoRow}>
									<Text style={styles.label}>Estado</Text>
									<Text style={styles.value}>{variable.status || "-"}</Text>
								</View>

								<View style={styles.infoRow}>
									<Text style={styles.label}>Umbral mínimo</Text>
									<Text style={styles.value}>
										{typeof variable.minValue === "number" ? variable.minValue : "-"}
									</Text>
								</View>

								<View style={styles.infoRow}>
									<Text style={styles.label}>Umbral máximo</Text>
									<Text style={styles.value}>
										{typeof variable.maxValue === "number" ? variable.maxValue : "-"}
									</Text>
								</View>

								<View style={styles.infoRow}>
									<Text style={styles.label}>Valor actual</Text>
									<Text style={styles.value}>
										{typeof currentValue === "number" ? currentValue : "-"}
									</Text>
								</View>

								<View style={styles.historyButtonsRow}>
									<TouchableOpacity
										style={styles.historyButton}
										onPress={() =>
											router.push({
												pathname: "/(options)/variable-realtime",
												params: {
													systemId: String(systemId || detail?.systemId || detail?.id || ""),
													variableId: String(getVariableId(variable) || ""),
													variableName: variable.name || "Variable",
													systemName: detail?.name || "Sistema",
												},
											})
										}
										disabled={!getVariableId(variable)}
									>
										<Ionicons name="pulse-outline" size={16} color="#166534" />
										<Text style={styles.historyButtonText}>Ver en tiempo real</Text>
									</TouchableOpacity>

									<TouchableOpacity
										style={styles.historyButton}
										onPress={() =>
											router.push({
												pathname: "/(options)/variable-history",
												params: {
													systemId: String(systemId || detail?.systemId || detail?.id || ""),
													variableId: String(getVariableId(variable) || ""),
													variableName: variable.name || "Variable",
													systemName: detail?.name || "Sistema",
												},
											})
										}
										disabled={!getVariableId(variable)}
									>
										<Ionicons name="analytics-outline" size={16} color="#166534" />
										<Text style={styles.historyButtonText}>Ver histórico</Text>
									</TouchableOpacity>
								</View>

								<Text style={styles.variableDescription}>
									{variable.description || "Sin descripción"}
								</Text>
							</View>
							);
						})
					)}
				</>
			)}

			<Modal
				visible={isEditModalVisible}
				transparent
				animationType="fade"
				onRequestClose={closeEditVariableModal}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>Editar variable</Text>

						<Text style={styles.modalLabel}>Nombre</Text>
						<TextInput
							style={styles.modalInput}
							value={editName}
							onChangeText={setEditName}
							placeholder="Nombre de la variable"
						/>

						<Text style={styles.modalLabel}>Unidad de medida</Text>
						<TextInput
							style={styles.modalInput}
							value={editMeasurementUnit}
							onChangeText={setEditMeasurementUnit}
							placeholder="Unidad"
						/>

						<Text style={styles.modalLabel}>Descripción</Text>
						<TextInput
							style={[styles.modalInput, styles.modalTextArea]}
							value={editDescription}
							onChangeText={setEditDescription}
							placeholder="Descripción"
							multiline
						/>

						<Text style={styles.modalLabel}>Umbral mínimo</Text>
						<TextInput
							style={styles.modalInput}
							value={editMinValue}
							onChangeText={setEditMinValue}
							placeholder="Ej: 10"
							keyboardType="numeric"
						/>

						<Text style={styles.modalLabel}>Umbral máximo</Text>
						<TextInput
							style={styles.modalInput}
							value={editMaxValue}
							onChangeText={setEditMaxValue}
							placeholder="Ej: 30"
							keyboardType="numeric"
						/>

						<View style={styles.modalActions}>
							<TouchableOpacity
								style={[styles.modalButton, styles.cancelButton]}
								onPress={closeEditVariableModal}
								disabled={savingEdit}
							>
								<Text style={styles.cancelButtonText}>Cancelar</Text>
							</TouchableOpacity>

							<TouchableOpacity
								style={[styles.modalButton, styles.saveButton, savingEdit && styles.buttonDisabled]}
								onPress={handleEditVariable}
								disabled={savingEdit}
							>
								<Text style={styles.saveButtonText}>
									{savingEdit ? "Guardando..." : "Guardar"}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
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
		paddingTop: 20,
		paddingBottom: 28,
	},
	topSection: {
		marginBottom: 14,
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
		marginBottom: 12,
	},
	backText: {
		color: "#166534",
		fontWeight: "700",
	},
	title: {
		fontSize: 24,
		fontWeight: "700",
		color: "#14532d",
		marginBottom: 14,
	},
	analysisButton: {
		alignSelf: "flex-start",
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingVertical: 7,
		paddingHorizontal: 12,
		borderRadius: 999,
		backgroundColor: "#dcfce7",
	},
	analysisButtonText: {
		color: "#166534",
		fontWeight: "700",
		fontSize: 12,
	},
	exportAllContainer: {
		marginTop: 10,
		backgroundColor: "#ffffff",
		borderRadius: 12,
		padding: 10,
		borderWidth: 1,
		borderColor: "#dcfce7",
	},
	exportAllLabel: {
		color: "#14532d",
		fontWeight: "700",
		marginBottom: 8,
		fontSize: 12,
	},
	exportAllFormatRow: {
		flexDirection: "row",
		gap: 8,
		marginBottom: 8,
	},
	exportAllFormatOption: {
		backgroundColor: "#f8fafc",
		borderWidth: 1,
		borderColor: "#cbd5e1",
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 999,
	},
	exportAllFormatOptionSelected: {
		backgroundColor: "#dcfce7",
		borderColor: "#166534",
	},
	exportAllFormatText: {
		color: "#334155",
		fontWeight: "700",
		fontSize: 12,
	},
	exportAllFormatTextSelected: {
		color: "#166534",
	},
	exportAllButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: "#0369a1",
		paddingVertical: 10,
		borderRadius: 10,
	},
	exportAllButtonText: {
		color: "#ffffff",
		fontWeight: "700",
		fontSize: 12,
	},
	reportContainer: {
		marginTop: 10,
		backgroundColor: "#ffffff",
		borderRadius: 12,
		padding: 10,
		borderWidth: 1,
		borderColor: "#d1fae5",
	},
	reportTitle: {
		color: "#14532d",
		fontWeight: "700",
		fontSize: 13,
		marginBottom: 8,
	},
	reportLabel: {
		color: "#4b5563",
		fontWeight: "600",
		fontSize: 12,
		marginTop: 6,
		marginBottom: 4,
	},
	reportInput: {
		backgroundColor: "#f2f2f2",
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		color: "#111827",
	},
	reportDateButton: {
		backgroundColor: "#f2f2f2",
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	reportDateText: {
		color: "#166534",
		fontWeight: "600",
	},
	reportGenerateButton: {
		marginTop: 10,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: "#16a34a",
		paddingVertical: 10,
		borderRadius: 10,
	},
	reportGenerateButtonText: {
		color: "#ffffff",
		fontWeight: "700",
		fontSize: 12,
	},
	reportSummaryBox: {
		marginTop: 10,
		backgroundColor: "#ecfdf5",
		borderRadius: 10,
		padding: 8,
		borderWidth: 1,
		borderColor: "#86efac",
	},
	reportSummaryText: {
		color: "#166534",
		fontWeight: "600",
		fontSize: 12,
	},
	reportFormatRow: {
		flexDirection: "row",
		gap: 8,
		marginTop: 4,
	},
	reportFormatOption: {
		backgroundColor: "#f8fafc",
		borderWidth: 1,
		borderColor: "#cbd5e1",
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 999,
	},
	reportFormatOptionSelected: {
		backgroundColor: "#dcfce7",
		borderColor: "#166534",
	},
	reportFormatText: {
		color: "#334155",
		fontWeight: "700",
		fontSize: 12,
	},
	reportFormatTextSelected: {
		color: "#166534",
	},
	reportDownloadButton: {
		marginTop: 10,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: "#0f766e",
		paddingVertical: 10,
		borderRadius: 10,
	},
	reportDownloadButtonText: {
		color: "#ffffff",
		fontWeight: "700",
		fontSize: 12,
	},
	reportInfoText: {
		marginTop: 8,
		color: "#6b7280",
		fontSize: 12,
	},
	card: {
		backgroundColor: "#fff",
		borderRadius: 20,
		padding: 16,
		elevation: 3,
		marginBottom: 18,
	},
	alertSystemCard: {
		backgroundColor: "#fef2f2",
		borderWidth: 1,
		borderColor: "#fca5a5",
	},
	alertBadge: {
		alignSelf: "flex-start",
		backgroundColor: "#fee2e2",
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 999,
		marginBottom: 10,
	},
	alertBadgeText: {
		color: "#991b1b",
		fontWeight: "700",
		fontSize: 12,
	},
	systemName: {
		fontSize: 20,
		fontWeight: "700",
		color: "#166534",
		marginBottom: 10,
	},
	infoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: 12,
		marginBottom: 8,
	},
	label: {
		color: "#4b5563",
		fontWeight: "500",
	},
	value: {
		color: "#111827",
		fontWeight: "600",
		flexShrink: 1,
		textAlign: "right",
	},
	descriptionBox: {
		marginTop: 6,
	},
	descriptionText: {
		color: "#374151",
		marginTop: 4,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#14532d",
		marginBottom: 10,
	},
	emptyCard: {
		backgroundColor: "#fff",
		borderRadius: 14,
		padding: 16,
		elevation: 2,
	},
	emptyText: {
		color: "#6b7280",
	},
	variableCard: {
		backgroundColor: "#fff",
		borderRadius: 16,
		padding: 14,
		marginBottom: 10,
		elevation: 2,
	},
	alertVariableCard: {
		backgroundColor: "#fef2f2",
		borderWidth: 1,
		borderColor: "#fca5a5",
	},
	variableTitle: {
		color: "#166534",
		fontWeight: "700",
		fontSize: 16,
	},
	variableTitleContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		flexWrap: "wrap",
	},
	alertChip: {
		backgroundColor: "#fee2e2",
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 999,
	},
	alertChipText: {
		color: "#991b1b",
		fontSize: 11,
		fontWeight: "700",
	},
	variableHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	variableActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	variableDescription: {
		marginTop: 6,
		color: "#4b5563",
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.35)",
		justifyContent: "center",
		padding: 20,
	},
	modalCard: {
		backgroundColor: "#fff",
		borderRadius: 16,
		padding: 16,
		elevation: 4,
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#14532d",
		marginBottom: 10,
	},
	modalLabel: {
		color: "#4b5563",
		fontWeight: "600",
		marginTop: 8,
		marginBottom: 4,
	},
	modalInput: {
		backgroundColor: "#f2f2f2",
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		color: "#111827",
	},
	modalTextArea: {
		minHeight: 80,
		textAlignVertical: "top",
	},
	modalActions: {
		flexDirection: "row",
		justifyContent: "flex-end",
		gap: 10,
		marginTop: 14,
	},
	modalButton: {
		borderRadius: 10,
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	cancelButton: {
		backgroundColor: "#e5e7eb",
	},
	cancelButtonText: {
		color: "#374151",
		fontWeight: "700",
	},
	saveButton: {
		backgroundColor: "#16a34a",
	},
	saveButtonText: {
		color: "#fff",
		fontWeight: "700",
	},
	buttonDisabled: {
		opacity: 0.7,
	},
	historyButton: {
		marginTop: 6,
		alignSelf: "flex-start",
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: "#dcfce7",
		paddingVertical: 6,
		paddingHorizontal: 10,
		borderRadius: 999,
	},
	historyButtonsRow: {
		marginTop: 6,
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	historyButtonText: {
		color: "#166534",
		fontWeight: "700",
		fontSize: 12,
	},
});
