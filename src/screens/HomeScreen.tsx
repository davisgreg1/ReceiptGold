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
import { BrandText, HeadingText, BodyText, ButtonText } from '../components/Typography';
import PricingLanding from "./PricingLanding";

export const HomeScreen: React.FC = () => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const homeNavigation = useHomeNavigation();
  const tabNavigation = useTabNavigation();

  // const handleLogout = () => {
  //   Alert.alert(
  //     'Sign Out',
  //     'Are you sure you want to sign out?',
  //     [
  //       {
  //         text: 'Cancel',
  //         style: 'cancel',
  //       },
  //       {
  //         text: 'Sign Out',
  //         style: 'destructive',
  //         onPress: logout,
  //       },
  //     ]
  //   );
  // };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background.primary }]}
    >
      <View style={styles.header}>
        <BrandText size="large" color="gold">
          ReceiptGold
        </BrandText>
        {/* <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={handleLogout}
            style={[styles.logoutButton, { backgroundColor: theme.status.error }]}
          >
            <Text style={[styles.logoutButtonText, { color: theme.text.inverse }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View> */}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeSection}>
          <HeadingText size="large" color="primary">
            Welcome back
            {user?.displayName
              ? `, ${(user as any).displayName?.split(' ')[0] || user?.email?.split('@')[0] || ''}`
              : user?.email
                ? `, ${user.email?.split('@')[0] || ''}`
                : ''}
            !
          </HeadingText>
          <BodyText size="large" color="secondary">
            Manage your receipts and maximize your tax savings
          </BodyText>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <HeadingText size="medium" color="primary">
            Quick Actions
          </HeadingText>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.gold.primary }]}
              onPress={() => navigationHelpers.switchToReceiptsTab(tabNavigation)}
            >
              <Text style={styles.actionButtonIcon}>📄</Text>
              <ButtonText size="medium" color="inverse">
                Scan Receipt
              </ButtonText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.background.secondary, borderColor: theme.border.primary, borderWidth: 1 }]}
              onPress={() => navigationHelpers.switchToReportsTab(tabNavigation)}
            >
              <Text style={styles.actionButtonIcon}>📊</Text>
              <ButtonText size="medium" color="primary">
                View Reports
              </ButtonText>
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
  quickActions: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
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
  placeholder: {
    alignItems: "center",
    marginBottom: 40,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
  },
});
