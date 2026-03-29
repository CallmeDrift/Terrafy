import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

export type PickerOption<T extends string | number> = {
	label: string;
	value: T;
	description?: string;
};

type PickerProps<T extends string | number> = {
	value: T | null;
	options: PickerOption<T>[];
	onChange: (value: T) => void;
	placeholder?: string;
	error?: string;
	disabled?: boolean;
};

export default function Picker<T extends string | number>({
	value,
	options,
	onChange,
	placeholder = "Selecciona una opción",
	error,
	disabled = false,
}: PickerProps<T>) {
	const [open, setOpen] = useState(false);
	const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
	const triggerRef = useRef<View>(null);
	const opacityAnim = useRef(new Animated.Value(0)).current;
	const translateAnim = useRef(new Animated.Value(-8)).current;

	const selectedOption = useMemo(
		() => options.find((option) => option.value === value),
		[options, value]
	);

	const handleSelect = (selectedValue: T) => {
		onChange(selectedValue);
		setOpen(false);
	};

	const closeDropdown = () => setOpen(false);

	const openDropdown = () => {
		if (disabled) return;

		triggerRef.current?.measureInWindow((x, y, width, height) => {
			setAnchor({ x, y, width, height });
			setOpen(true);
		});
	};

	useEffect(() => {
		if (open) {
			opacityAnim.setValue(0);
			translateAnim.setValue(-8);

			Animated.parallel([
				Animated.timing(opacityAnim, {
					toValue: 1,
					duration: 150,
					useNativeDriver: true,
				}),
				Animated.timing(translateAnim, {
					toValue: 0,
					duration: 180,
					useNativeDriver: true,
				}),
			]).start();
		}
	}, [open, opacityAnim, translateAnim]);

	const window = Dimensions.get("window");
	const horizontalMargin = 20;
	const dropdownWidth = Math.min(anchor.width, window.width - horizontalMargin * 2);
	const left = Math.max(
		horizontalMargin,
		Math.min(anchor.x, window.width - dropdownWidth - horizontalMargin)
	);
	const estimatedHeight = Math.min(300, Math.max(56, options.length * 64));
	const spaceBelow = window.height - (anchor.y + anchor.height);
	const spaceAbove = anchor.y;
	const showAbove = spaceBelow < estimatedHeight + 12 && spaceAbove > spaceBelow;
	const top = showAbove
		? Math.max(12, anchor.y - estimatedHeight - 8)
		: Math.min(window.height - estimatedHeight - 12, anchor.y + anchor.height + 8);

	return (
		<View>
			<View ref={triggerRef} collapsable={false}>
				<Pressable
					style={[
						styles.trigger,
						open && styles.triggerOpen,
						!!error && styles.triggerError,
						disabled && styles.triggerDisabled,
					]}
					onPress={open ? closeDropdown : openDropdown}
				>
					<Text
						style={[
							styles.triggerText,
							!selectedOption && styles.placeholderText,
							disabled && styles.triggerTextDisabled,
						]}
					>
						{selectedOption ? selectedOption.label : placeholder}
					</Text>
					<Ionicons
						name={open ? "chevron-up" : "chevron-down"}
						size={18}
						color={disabled ? "#b6b6b6" : "#444"}
					/>
				</Pressable>
			</View>

			<Modal
				visible={open && !disabled}
				transparent
				statusBarTranslucent
				animationType="none"
				onRequestClose={closeDropdown}
			>
				<View style={styles.modalRoot}>
					<Pressable style={styles.backdrop} onPress={closeDropdown} />
					<Animated.View
						style={[
							styles.dropdownFloating,
							{
								top,
								left,
								width: dropdownWidth,
								maxHeight: 300,
								opacity: opacityAnim,
								transform: [{ translateY: translateAnim }],
							},
						]}
					>
						<ScrollView
							showsVerticalScrollIndicator={false}
							keyboardShouldPersistTaps="handled"
						>
							{options.length === 0 && (
								<Text style={styles.emptyText}>No hay opciones disponibles</Text>
							)}

							{options.map((option) => {
								const selected = option.value === value;

								return (
									<Pressable
										key={String(option.value)}
										style={[styles.item, selected && styles.itemSelected]}
										onPress={() => handleSelect(option.value)}
									>
										<Text style={styles.itemTitle}>{option.label}</Text>
										{option.description ? (
											<Text style={styles.itemDescription}>{option.description}</Text>
										) : null}
									</Pressable>
								);
							})}
						</ScrollView>
					</Animated.View>
				</View>
			</Modal>

			{error ? <Text style={styles.errorText}>{error}</Text> : null}
		</View>
	);
}

const styles = StyleSheet.create({
	trigger: {
		backgroundColor: "#f2f2f2",
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 14,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	triggerOpen: {
		borderWidth: 1,
		borderColor: "#16a34a",
	},
	triggerError: {
		borderWidth: 1,
		borderColor: "red",
	},
	triggerDisabled: {
		opacity: 0.6,
	},
	triggerText: {
		color: "#111",
		fontSize: 15,
	},
	triggerTextDisabled: {
		color: "#8f8f8f",
	},
	placeholderText: {
		color: "#666",
	},
	modalRoot: {
		...StyleSheet.absoluteFillObject,
	},
	backdrop: {
		...StyleSheet.absoluteFillObject,
	},
	dropdownFloating: {
		position: "absolute",
		backgroundColor: "#fff",
		borderRadius: 12,
		padding: 8,
		gap: 8,
		elevation: 10,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.15,
		shadowRadius: 16,
	},
	item: {
		backgroundColor: "#f2f2f2",
		borderRadius: 10,
		padding: 12,
	},
	itemSelected: {
		borderWidth: 2,
		borderColor: "#16a34a",
	},
	itemTitle: {
		fontWeight: "bold",
		color: "#111",
	},
	itemDescription: {
		marginTop: 2,
		color: "#666",
	},
	emptyText: {
		color: "#666",
		fontStyle: "italic",
	},
	errorText: {
		marginTop: 4,
		color: "red",
		fontSize: 12,
	},
});
