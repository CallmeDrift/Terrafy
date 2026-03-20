import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        
        {/* LOGO */}
        <Image
          source={{ uri: "https://i.pinimg.com/control1/1200x/b6/30/a4/b630a41cdd8f721beaa99b540cd8c63d.jpg" }}
          style={styles.logo}
        />

        <Text style={styles.title}>Terrafy</Text>
        <Text style={styles.subtitle}>Monitorea. Analiza. Crece.</Text>

        {/* Email */}
        <Text style={styles.label}>Correo</Text>
        <TextInput
          style={styles.input}
          placeholder="tu.email@ejemplo.com"
          value={email}
          onChangeText={setEmail}
        />

        {/* Password */}
        <Text style={styles.label}>Contraseña</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Ingresa tu contraseña"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.showText}>
              {showPassword ? "Ocultar" : "Ver"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Forgot */}
        <Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text>

        {/* Login Button */}
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => router.replace("/(tabs)/dashboard")}
        >
          <Text style={styles.loginText}>Iniciar sesión</Text>
        </TouchableOpacity>

        {/* Divider */}
        <Text style={styles.or}>o</Text>

        {/* Create Account */}
        <TouchableOpacity style={styles.createButton}>
          <Text style={styles.createText}>Crear cuenta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e9f5ec",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    elevation: 5,
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: "center",
    marginBottom: 10,
    borderRadius: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    color: "#16a34a",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 20,
    color: "#777",
  },
  label: {
    marginTop: 10,
    marginBottom: 5,
    color: "#333",
  },
  input: {
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    padding: 12,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
  },
  showText: {
    color: "#16a34a",
    fontWeight: "bold",
  },
  forgot: {
    textAlign: "right",
    color: "#16a34a",
    marginTop: 5,
  },
  loginButton: {
    backgroundColor: "#16a34a",
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
  },
  loginText: {
    textAlign: "center",
    color: "#fff",
    fontWeight: "bold",
  },
  or: {
    textAlign: "center",
    marginVertical: 15,
    color: "#aaa",
  },
  createButton: {
    borderWidth: 1,
    borderColor: "#16a34a",
    padding: 15,
    borderRadius: 10,
  },
  createText: {
    textAlign: "center",
    color: "#16a34a",
    fontWeight: "bold",
  },
});
