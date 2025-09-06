import React from "react";
import { Image, ImageStyle, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

interface LogoProps {
  size?: number;
  style?: ImageStyle;
}

export const Logo: React.FC<LogoProps> = ({ size = 48, style }) => {
  return (
    <View style={[{ width: size, height: size, backgroundColor: 'transparent' }, style]}>
      <Image
        source={require("../../assets/splash.png")}
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
