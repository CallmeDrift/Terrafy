import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Settings() {
    const router = useRouter();

    return (
        <View style={styles.container}>

            <Text style={styles.title}>Configuraciones</Text>

            {/* Perfil */}
            <View style={styles.profileCard}>
                <View style={styles.avatar}>
                    <Text style={{ color: "#fff", fontSize: 20 }}>👤</Text>
                </View>

                <View>
                    <Text style={styles.name}>Dorifuto megumin</Text>
                    <Text style={styles.email}>dorifuto@example.com</Text>
                    <Text style={styles.edit}>Editar Perfil</Text>
                </View>
            </View>

            {/* Opciones */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>cuenta</Text>

                <TouchableOpacity style={styles.option}>

                    <View style={styles.optionLeft}>
                        <Ionicons name="person-outline" size={20} color="#333" />
                        <Text style={styles.optionText}>Información Personal</Text>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color="#999" />

                </TouchableOpacity>

                <TouchableOpacity style={styles.option}>
                    <View style={styles.optionLeft}>
                        <Ionicons name="notifications-outline" size={20} color="#333" />
                        <Text style={styles.optionText}>Notificaciones</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.option}>
                    <View style={styles.optionLeft}>
                        <Ionicons name="shield-checkmark-outline" size={20} color="#333" />
                        <Text style={styles.optionText}>Privacidad y Seguridad</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferencias</Text>

                <TouchableOpacity style={styles.option}>
                    <View style={styles.optionLeft}>
                        <Ionicons name="language" size={20} color="#333" />
                        <Text style={styles.optionText}>Idioma</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                </TouchableOpacity>
            </View>

            {/* Logout */}
            <TouchableOpacity style={styles.logout} onPress={() => router.replace("/")}>
                <Text style={{ color: "red", fontWeight: "bold" }}>Salir</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#e9f5ec",
        padding: 20,
        marginTop: 40
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
    },
    subtitle: {
        color: "#666",
        marginBottom: 15,
    },
    profileCard: {
        flexDirection: "row",
        backgroundColor: "#fff",
        padding: 15,
        borderRadius: 20,
        alignItems: "center",
        marginBottom: 20,
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,

    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: "#16a34a",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10,
    },
    name: {
        fontWeight: "bold",
    },
    email: {
        color: "#666",
    },
    edit: {
        color: "#16a34a",
        marginTop: 5,
    },
    section: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 10,
        marginBottom: 15,
        elevation: 2,
    },
    sectionTitle: {
        fontWeight: "bold",
        marginBottom: 10,
    },
    option: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
    },
    optionLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    optionText: {
        marginLeft: 10,
    },
    logout: {
        borderWidth: 1,
        borderColor: "red",
        padding: 15,
        borderRadius: 15,
        alignItems: "center",
        marginTop: 10,
    },
});
