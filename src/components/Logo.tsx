import React from "react";
import { Image, ImageStyle } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

interface LogoProps {
  size?: number;
  style?: ImageStyle;
}

export const Logo: React.FC<LogoProps> = ({ size = 48, style }) => {
  const { themeMode } = useTheme();

  // Use different logo based on theme
  const logoSource =
    themeMode === "dark"
      ? require("../../assets/images/logo/logo-dark.png")
      : require("../../assets/images/logo/logo-light.png");

  return (
    <Image
      source={logoSource}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
      resizeMode="contain"
    />
  );
};
