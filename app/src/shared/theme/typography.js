export const customFontFamilies = {
  almarai: {
    regular: "Almarai-Regular",
    light: "Almarai-Light",
    bold: "Almarai-Bold",
    extraBold: "Almarai-ExtraBold",
  },
};

export const fontFamilies = {
  // Undefined lets React Native use the platform system font:
  // Android Roboto/system and iOS San Francisco/system.
  regular: undefined,
  light: undefined,
  medium: undefined,
  bold: undefined,
  extraBold: undefined,
  arabic: undefined,
  arabicLight: undefined,
  arabicBold: undefined,
  arabicExtraBold: undefined,
  fallback: undefined,
  system: undefined,
  // Optional named custom fonts remain available without being the default.
  almaraiRegular: customFontFamilies.almarai.regular,
  almaraiLight: customFontFamilies.almarai.light,
  almaraiBold: customFontFamilies.almarai.bold,
  almaraiExtraBold: customFontFamilies.almarai.extraBold,
};

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  screenTitle: 28,
  button: 22,
};

export const fontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  heavy: "800",
  black: "900",
};

export const lineHeights = {
  xs: 17,
  sm: 20,
  md: 23,
  lg: 26,
  xl: 31,
  screenTitle: 36,
  button: 30,
};

export const typography = {
  fontFamily: fontFamilies.regular,
  preferredFontFamily: fontFamilies.system,
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.screenTitle,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.screenTitle,
  },
  button: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.button,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.button,
  },
  footer: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.xs,
    lineHeight: lineHeights.xs,
    opacity: 0.8,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.md,
  },
  caption: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.xs,
  },
  label: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.sm,
  },
};
