import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type ChatbotPanelProps = {
	onClose?: () => void;
};

export function ChatbotPanel({ onClose }: ChatbotPanelProps) {
	return (
		<View style={styles.chatCard}>
			<View style={styles.chatHeader}>
				<View style={styles.headerLeft}>
					<View style={styles.botBadge}>
						<Ionicons name="sparkles" size={14} color="#ffffff" />
					</View>
					<Text style={styles.headerTitle}>Chatbot Terrafy</Text>
				</View>
				{!!onClose && (
					<TouchableOpacity onPress={onClose}>
						<Ionicons name="close" size={20} color="#166534" />
					</TouchableOpacity>
				)}
			</View>

			<ScrollView style={styles.messagesArea} contentContainerStyle={styles.messagesContent}>
				<View style={[styles.messageBubble, styles.botBubble]}>
					<Text style={styles.botMessageText}>
						Hola, soy tu asistente de Terrafy. Te ayudo con variables, alertas e historicos.
					</Text>
				</View>
			</ScrollView>

			<View style={styles.quickActionsRow}>
				<TouchableOpacity style={styles.quickActionChip} activeOpacity={0.9}>
					<Text style={styles.quickActionText}>Ver alertas</Text>
				</TouchableOpacity>
				<TouchableOpacity style={styles.quickActionChip} activeOpacity={0.9}>
					<Text style={styles.quickActionText}>Ultimas mediciones</Text>
				</TouchableOpacity>
			</View>

			<View style={styles.inputRow}>
				<TextInput
					style={styles.input}
					placeholder="Escribe un mensaje..."
					placeholderTextColor="#6b7280"
					editable={false}
				/>
				<TouchableOpacity style={styles.sendButton} activeOpacity={0.9}>
					<Ionicons name="send" size={16} color="#ffffff" />
				</TouchableOpacity>
			</View>
		</View>
	);
}

export default function ChatbotScreen() {
	return (
		<View style={styles.screenContainer}>
			<ChatbotPanel />
		</View>
	);
}

const styles = StyleSheet.create({
	screenContainer: {
		flex: 1,
		backgroundColor: "#e9f5ec",
		padding: 16,
		justifyContent: "center",
	},
	chatCard: {
		width: "100%",
		height: 430,
		backgroundColor: "#ffffff",
		borderRadius: 18,
		padding: 12,
		elevation: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 10,
	},
	chatHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 10,
	},
	headerLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	botBadge: {
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: "#16a34a",
		alignItems: "center",
		justifyContent: "center",
	},
	headerTitle: {
		fontSize: 14,
		fontWeight: "700",
		color: "#166534",
	},
	messagesArea: {
		flex: 1,
		backgroundColor: "#f7faf7",
		borderRadius: 12,
	},
	messagesContent: {
		padding: 10,
		gap: 10,
	},
	messageBubble: {
		maxWidth: "90%",
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 12,
	},
	botBubble: {
		alignSelf: "flex-start",
		backgroundColor: "#dcfce7",
	},
	botMessageText: {
		color: "#14532d",
		fontSize: 13,
	},
	quickActionsRow: {
		marginTop: 10,
		marginBottom: 8,
		flexDirection: "row",
		gap: 8,
	},
	quickActionChip: {
		backgroundColor: "#ecfdf5",
		borderColor: "#86efac",
		borderWidth: 1,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 999,
	},
	quickActionText: {
		fontSize: 12,
		fontWeight: "700",
		color: "#166534",
	},
	inputRow: {
		marginTop: 2,
		flexDirection: "row",
		gap: 8,
		alignItems: "center",
	},
	input: {
		flex: 1,
		backgroundColor: "#f3f4f6",
		borderRadius: 999,
		paddingHorizontal: 14,
		paddingVertical: 10,
		color: "#111827",
	},
	sendButton: {
		width: 38,
		height: 38,
		borderRadius: 19,
		backgroundColor: "#16a34a",
		alignItems: "center",
		justifyContent: "center",
	},
});
