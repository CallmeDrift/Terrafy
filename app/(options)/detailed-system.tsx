import { API_URL } from "@/constants/router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const pickFirst = <T,>(...values: Array<T | undefined | null>) => {
	for (const value of values) {
		if (value !== undefined && value !== null) return value;
	}

	return undefined;
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
			</View>

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
