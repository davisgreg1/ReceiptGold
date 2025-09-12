import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

interface ConfettiPieceProps {
  delay: number;
  color: string;
  x: number;
  show: boolean;
  size: number;
}

const ConfettiPiece: React.FC<ConfettiPieceProps> = ({ delay, color, x, show, size }) => {
  const animValue = useRef(new Animated.Value(0)).current;
  const rotateValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (show) {
      // Reset animation values
      animValue.setValue(0);
      rotateValue.setValue(0);

      const fallAnimation = Animated.timing(animValue, {
        toValue: 1,
        duration: 3000,
        delay,
        useNativeDriver: true,
      });

      const rotateAnimation = Animated.timing(rotateValue, {
        toValue: 1,
        duration: 3000,
        delay,
        useNativeDriver: true,
      });

      Animated.parallel([fallAnimation, rotateAnimation]).start();
    }
  }, [show]);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, height + 100],
  });

  const rotate = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
  });

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          left: x,
          backgroundColor: color,
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ translateY }, { rotate }],
        },
      ]}
    />
  );
};

interface ConfettiOverlayProps {
  show: boolean;
  duration?: number;
  pieceCount?: number;
  colors?: string[];
}

export const ConfettiOverlay: React.FC<ConfettiOverlayProps> = ({
  show,
  duration = 4000,
  pieceCount = 100,
  colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#FF69B4", "#00CED1", "#32CD32", "#FF8C00", "#DC143C", "#9370DB"]
}) => {
  const confettiPieces = Array.from({ length: pieceCount }, (_, i) => ({
    id: i,
    delay: Math.random() * 1500, // Spread launches over 1.5 seconds
    color: colors[Math.floor(Math.random() * colors.length)],
    x: Math.random() * width,
    size: Math.random() * 6 + 6, // Random size between 6-12px
  }));

  if (!show) return null;

  return (
    <View style={styles.confettiContainer} pointerEvents="none">
      {confettiPieces.map((piece) => (
        <ConfettiPiece
          key={piece.id}
          delay={piece.delay}
          color={piece.color}
          x={piece.x}
          size={piece.size}
          show={show}
        />
      ))}
    </View>
  );
};

// Hook for easy confetti management
export const useConfetti = (duration: number = 4000) => {
  const [showConfetti, setShowConfetti] = React.useState(false);

  const triggerConfetti = React.useCallback(() => {
    setShowConfetti(true);
    setTimeout(() => {
      setShowConfetti(false);
    }, duration);
  }, [duration]);

  return { showConfetti, triggerConfetti };
};

const styles = StyleSheet.create({
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  confettiPiece: {
    position: 'absolute',
    // Size is now dynamic - set via style props
  },
});