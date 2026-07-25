import React, { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

function CornerSpinner({ size = 300, image, speedMs = 12000, opacity = 0.95 }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: speedMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();
    return () => animation.stop();
  }, [spin, speedMs]);

  const rotate = useMemo(
    () =>
      spin.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
      }),
    [spin]
  );

  const animatedStyle = useMemo(
    () => ({
      width: size,
      height: size,
      top: -size / 2,
      left: -size / 2,
      borderRadius: size / 2,
      opacity,
      transform: [{ rotate }],
    }),
    [opacity, rotate, size]
  );

  return (
    <Animated.Image
      source={image}
      resizeMode="cover"
      pointerEvents="none"
      style={[styles.corner, animatedStyle]}
    />
  );
}

export default memo(CornerSpinner);

const styles = StyleSheet.create({
  corner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    zIndex: -2,
  },
});
