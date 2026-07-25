// src/ui/Theme.js
// Legacy compatibility layer. New UI work should import tokens from src/shared/theme.
import {
  colors as sharedColors,
  fontFamilies,
  fontSizes,
  fontWeights,
  layout,
  lineHeights,
  radius,
  responsiveSpacing,
  screenSize,
  shadows,
  spacing,
  typography,
} from "../shared/theme";

const colors = {
  appBg: sharedColors.brand.appBackground,
  btnGradientStart: "#3B82F6",
  btnGradientMid: "#3B82F6",
  btnGradientEnd: "#3B82F6",
  authBtnGradientStart: sharedColors.brand.auth,
  authBtnGradientMid: "rgba(9,45,103,0.10)",
  authBtnGradientEnd: sharedColors.brand.auth,
  appBtnGradientStart: sharedColors.brand.primary,
  appBtnGradientMid: "rgba(11,99,216,0.12)",
  appBtnGradientEnd: sharedColors.brand.primaryDark,
  textPrimary: sharedColors.text.inverse,
  textMuted: sharedColors.text.inverseMuted,
  border: sharedColors.border.inverse,

  primary: sharedColors.brand.primary,
  white: sharedColors.surface.background,
  line: sharedColors.border.default,
  muted: sharedColors.text.muted,
  bgSoft: sharedColors.surface.soft,
};

const sizes = {
  buttonWidth: 350,
  buttonHeight: 72,
  buttonRadius: radius.button,
  pagePaddingH: layout.pagePaddingH,
  pagePaddingTop: layout.pagePaddingTop,
  pagePaddingBottom: layout.pagePaddingBottom,
};

const shadow = shadows.button;

const Theme = {
  colors,
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  radius,
  responsiveSpacing,
  screenSize,
  shadow,
  sizes,
  spacing,
  typography,
};

export {
  colors,
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  radius,
  responsiveSpacing,
  screenSize,
  shadow,
  sizes,
  spacing,
  typography,
};
export default Theme;
