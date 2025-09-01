import React from "react";
import { Image, ImageStyle, View } from "react-native";
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
      ? require("../../assets/images/logo/logo-dark.svg")
      : require("../../assets/images/logo/logo-light.svg");

  return (
    <View style={[{ width: size, height: size, backgroundColor: 'transparent' }, style]}>
      <Image
        source={logoSource}
        style={{
          width: size,
          height: size,
          backgroundColor: 'transparent',
        }}
        resizeMode="contain"
      />
    </View>
  );
};
