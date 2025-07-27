import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { useHomeNavigation, useTabNavigation, navigationHelpers } from "../navigation/navigationHelpers";
import PricingLanding from "./PricingLanding";

export const HomeScreen: React.FC = () => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const homeNavigation = useHomeNavigation();
  const tabNavigation = useTabNavigation();

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
            onPress={handleLogout}
            style={[styles.logoutButton, { backgroundColor: theme.status.error }]}
          >
            <Text style={[styles.logoutButtonText, { color: theme.text.inverse }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeSection}>
          <Text style={[styles.welcomeText, { color: theme.text.primary }]}>
            Welcome back
            {user?.displayName
              ? `, ${(user as any).displayName?.split(' ')[0] || user?.email?.split('@')[0] || ''}`
              : user?.email
                ? `, ${user.email?.split('@')[0] || ''}`
                : ''}
            !
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
            Manage your receipts and maximize your tax savings
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            Quick Actions
          </Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.gold.primary }]}
              onPress={() => navigationHelpers.switchToReceiptsTab(tabNavigation)}
            >
              <Text style={styles.actionButtonIcon}>📄</Text>
              <Text style={[styles.actionButtonText, { color: theme.text.inverse }]}>
                Scan Receipt
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.background.secondary, borderColor: theme.border.primary, borderWidth: 1 }]}
              onPress={() => navigationHelpers.switchToReportsTab(tabNavigation)}
            >
              <Text style={styles.actionButtonIcon}>📊</Text>
              <Text style={[styles.actionButtonText, { color: theme.text.primary }]}>
                View Reports
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <PricingLanding />
      </ScrollView>
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
  },
  welcomeSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  quickActions: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  actionButtonIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
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
