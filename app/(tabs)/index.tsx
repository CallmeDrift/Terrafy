import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useState } from "react";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <View style={styles.container}>
      
      <View style={styles.card}>
        
        <Text style={styles.title}>Terrafy</Text>
        <Text style={styles.subtitle}>Monitor. Analyze. Grow.</Text>

        {/* Email */}
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="your.email@example.com"
          value={email}
          onChangeText={setEmail}
        />

        {/* Password */}
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* Forgot */}
        <Text style={styles.forgot}>Forgot password?</Text>

        {/* Login Button */}
        <TouchableOpacity style={styles.loginButton}>
          <Text style={styles.loginText}>Login</Text>
        </TouchableOpacity>

        {/* Divider */}
        <Text style={styles.or}>or</Text>

        {/* Create Account */}
        <TouchableOpacity style={styles.createButton}>
          <Text style={styles.createText}>Create account</Text>
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