// utils/responsive.js
import { useWindowDimensions, PixelRatio, I18nManager } from "react-native";

const guidelineBaseWidth = 390;   // iPhone 14 width
const guidelineBaseHeight = 844;  // iPhone 14 height

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const scale = (size) => (width / guidelineBaseWidth) * size;
  const vscale = (size) => (height / guidelineBaseHeight) * size;

  const ms = (size, factor = 0.5) =>
    size + (scale(size) - size) * factor;

  const font = (size) =>
    Math.round(PixelRatio.roundToNearestPixel(ms(size)));

  return {
    w: width,
    h: height,
    isSmall: width < 360,
    scale,
    vscale,
    ms,
    font,
    isRTL: I18nManager.isRTL,
    dirRow: { flexDirection: I18nManager.isRTL ? "row-reverse" : "row" },
    textAlign: I18nManager.isRTL ? "right" : "left",
  };
}
