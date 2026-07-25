import { Dimensions, PixelRatio, useWindowDimensions } from "react-native";
import { useMemo } from "react";

const BASE_W = 390; // iPhone 14 width
const BASE_H = 844; // iPhone 14 height
export const BASE_SCREEN = { width: BASE_W, height: BASE_H };
export const SCREEN_BREAKPOINTS = {
  smallPhoneMax: 359,
  largePhoneMin: 430,
  tabletMin: 768,
};

// Static functions for use outside components
const getDimensions = () => Dimensions.get("window");
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const getStaticSx = (n) => {
  const { width: W } = getDimensions();
  return (W / BASE_W) * n;
};
const getStaticSy = (n) => {
  const { height: H } = getDimensions();
  return (H / BASE_H) * n;
};
const getStaticS = (n) => {
  const { width: W, height: H } = getDimensions();
  return ((W / BASE_W + H / BASE_H) / 2) * n;
};

// Static exports (for use outside components or in StyleSheet.create)
export const sx = getStaticSx;
export const sy = getStaticSy;
export const s = getStaticS;
export const sp = (size) => PixelRatio.roundToNearestPixel(getStaticS(size));
export const ms = (size, factor = 0.5) => size + (getStaticS(size) - size) * factor;
export const rsp = (size, factor = 0.5) => PixelRatio.roundToNearestPixel(ms(size, factor));

// Hook-based scaling (for use inside components - updates on dimension changes)
export const useScale = () => {
  const { width: W, height: H } = useWindowDimensions();
  
  return useMemo(() => {
    const sx = (n) => (W / BASE_W) * n;
    const sy = (n) => (H / BASE_H) * n;
    const s = (n) => ((W / BASE_W + H / BASE_H) / 2) * n;
    const ms = (size, factor = 0.5) => size + (s(size) - size) * factor;
    const sp = (size) => PixelRatio.roundToNearestPixel(s(size));
    const rsp = (size, factor = 0.5) => PixelRatio.roundToNearestPixel(ms(size, factor));
    const isSmallPhone = W <= SCREEN_BREAKPOINTS.smallPhoneMax;
    const isLargePhone = W >= SCREEN_BREAKPOINTS.largePhoneMin;
    const isTablet = Math.min(W, H) >= SCREEN_BREAKPOINTS.tabletMin;
    
    return { isLargePhone, isSmallPhone, isTablet, ms, rsp, s, sp, sx, sy, width: W, height: H };
  }, [W, H]);
};

// Device detection helpers
export const isSmallDevice = () => {
  const { width: W } = getDimensions();
  return W < 360;
};

export const isTablet = () => {
  const { width: W, height: H } = getDimensions();
  return Math.min(W, H) >= 768;
};
