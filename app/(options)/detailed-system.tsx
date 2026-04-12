import { API_URL } from "@/constants/router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

type AgronomicVariable = {
	variableId?: number;
	id?: number;
	name?: string;
	measurementUnit?: string;
	description?: string;
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

	const getVariableId = (variable: AgronomicVariable) =>
		variable.variableId ?? variable.id ?? null;

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

	return (
		<ScrollView style={styles.container} contentContainerStyle={styles.content}>
			<View style={styles.topSection}>
				<TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
					<Ionicons name="arrow-back" size={18} color="#166534" />
					<Text style={styles.backText}>Volver</Text>
				</TouchableOpacity>

				<Text style={styles.title}>Detalle de invernadero</Text>
			</View>

			{loading ? (
				<ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 24 }} />
			) : (
				<>
					<View style={styles.card}>
						<Text style={styles.systemName}>{detail?.name || "Sin nombre"}</Text>

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
						variables.map((variable, index) => (
							<View
								key={String(variable.variableId || variable.id || index)}
								style={styles.variableCard}
							>
								<View style={styles.variableHeader}>
									<Text style={styles.variableTitle}>{variable.name || "Sin nombre"}</Text>
									<TouchableOpacity
										onPress={() => handleDeleteVariable(variable)}
										disabled={deletingVariableId === getVariableId(variable)}
									>
										<Ionicons name="trash-outline" size={18} color="#dc2626" />
									</TouchableOpacity>
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

								<Text style={styles.variableDescription}>
									{variable.description || "Sin descripción"}
								</Text>
							</View>
						))
					)}
				</>
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
	card: {
		backgroundColor: "#fff",
		borderRadius: 20,
		padding: 16,
		elevation: 3,
		marginBottom: 18,
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
	variableTitle: {
		color: "#166534",
		fontWeight: "700",
		fontSize: 16,
	},
	variableHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	variableDescription: {
		marginTop: 6,
		color: "#4b5563",
	},
});
