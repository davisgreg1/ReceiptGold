import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { typography } from "./typography";

export type ThemeMode = "light" | "dark";

export const darkTheme = {
  background: {
    primary: "#0D1117",
    secondary: "#1C1C1E",
    tertiary: "#2C2C2E",
    elevated: "#3C3C3E",
    overlay: "rgba(0, 0, 0, 0.8)",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#8E8E93",
    tertiary: "#6D6D73",
    accent: "#FFD700",
    inverse: "#000000",
  },
  gold: {
    primary: "#FFD700",
    rich: "#B8860B",
    muted: "#8B6914",
    background: "rgba(255, 215, 0, 0.1)",
  },
  border: {
    primary: "#2C2C2E",
    secondary: "#3C3C3E",
    accent: "#FFD700",
    focus: "#FFD700",
  },
  shadow: {
    small: "0 2px 4px rgba(255, 215, 0, 0.1)",
    medium: "0 4px 8px rgba(255, 215, 0, 0.15)",
    large: "0 8px 16px rgba(255, 215, 0, 0.2)",
  },
  status: {
    success: "#34C759",
    error: "#FF3B30",
    warning: "#FF9500",
    info: "#007AFF",
  },
  typography,
};

export const lightTheme = {
  background: {
    primary: "#FFFFFF",
    secondary: "#F8F9FA",
    tertiary: "#F2F2F7",
    elevated: "#FFFFFF",
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  text: {
    primary: "#1C1C1E",
    secondary: "#3C3C43",
    tertiary: "#8E8E93",
    accent: "#B8860B",
    inverse: "#FFFFFF",
  },
  gold: {
    primary: "#B8860B",
    rich: "#8B6914",
    muted: "#D4AF37",
    background: "rgba(184, 134, 11, 0.08)",
  },
  border: {
    primary: "#E5E5EA",
    secondary: "#D1D1D6",
    accent: "#B8860B",
    focus: "#B8860B",
  },
  shadow: {
    small: "0 2px 4px rgba(0, 0, 0, 0.1)",
    medium: "0 4px 8px rgba(0, 0, 0, 0.15)",
    large: "0 8px 16px rgba(0, 0, 0, 0.2)",
  },
  status: {
    success: "#34C759",
    error: "#FF3B30",
    warning: "#FF9500",
    info: "#007AFF",
  },
  typography,
};

export type Theme = typeof darkTheme;

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("themeMode");
        if (savedTheme) {
          setThemeMode(savedTheme as ThemeMode);
        } else {
          setThemeMode(systemColorScheme || "dark");
        }
      } catch (error) {
        console.log("Error loading theme:", error);
      }
    };
    loadTheme();
  }, [systemColorScheme]);

  const theme = useMemo(() => 
    themeMode === "dark" ? darkTheme : lightTheme, 
    [themeMode]
  );

  const toggleTheme = async () => {
    const newMode = themeMode === "dark" ? "light" : "dark";
    setThemeMode(newMode);
    await AsyncStorage.setItem("themeMode", newMode);
  };

  const setTheme = async (mode: ThemeMode) => {
    setThemeMode(mode);
    await AsyncStorage.setItem("themeMode", mode);
  };

  const contextValue = useMemo(() => ({
    theme,
    themeMode,
    toggleTheme,
    setTheme
  }), [theme, themeMode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
