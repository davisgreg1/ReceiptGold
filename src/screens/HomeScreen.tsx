import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";

export const HomeScreen: React.FC = () => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background.primary }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.gold.primary }]}>
          ReceiptGold
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={toggleTheme}
            style={[styles.themeToggle, { borderColor: theme.border.accent }]}
          >
            <Text style={[styles.themeToggleText, { color: theme.text.primary }]}>
              {themeMode === "dark" ? "☀️" : "🌙"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLogout}
            style={[styles.logoutButton, { backgroundColor: theme.status.error }]}
          >
            <Text style={[styles.logoutButtonText, { color: theme.text.inverse }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={[styles.welcomeText, { color: theme.text.primary }]}>
          Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}!
        </Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
          Your premium receipt management solution for LLCs
        </Text>

        <View style={styles.placeholder}>
          <Text
            style={[styles.placeholderText, { color: theme.text.tertiary }]}
          >
            🚧 Coming Soon 🚧
          </Text>
          <Text
            style={[styles.placeholderSubtext, { color: theme.text.tertiary }]}
          >
            • Receipt Generation
          </Text>
          <Text
            style={[styles.placeholderSubtext, { color: theme.text.tertiary }]}
          >
            • OCR Scanning
          </Text>
          <Text
            style={[styles.placeholderSubtext, { color: theme.text.tertiary }]}
          >
            • Expense Tracking
          </Text>
          <Text
            style={[styles.placeholderSubtext, { color: theme.text.tertiary }]}
          >
            • Tax Compliance
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.background.secondary,
              borderColor: theme.border.primary,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>
            Quick Stats
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: theme.gold.primary }]}>
                0
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Receipts
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: theme.gold.primary }]}>
                $0.00
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Total
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statNumber, { color: theme.gold.primary }]}>
                0
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Categories
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  themeToggleText: {
    fontSize: 18,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
  },
  placeholder: {
    alignItems: "center",
    marginBottom: 40,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
  },
  placeholderSubtext: {
    fontSize: 14,
    marginBottom: 4,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
