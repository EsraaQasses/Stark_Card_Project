export const palette = {
  starkBlue: "#0B63D8",
  starkBlueDark: "#0e448bff",
  authNavy: "#092D67",
  appBlue: "#2137EC",
  textNavy: "#0E1B3B",
  textMutedBlue: "#7C8DA6",
  white: "#FFFFFF",
  lineBlue: "#E4ECF2",
  surfaceSoftBlue: "#F3F7FB",
  surfaceCardBlue: "#F8FBFF",
  success: "#16a34a",
  pending: "#ca8a04",
  danger: "#dc2626",
  slate: "#334155",
};

export const colors = {
  brand: {
    primary: palette.starkBlue,
    primaryDark: palette.starkBlueDark,
    appBackground: palette.appBlue,
    auth: palette.authNavy,
  },
  text: {
    primary: palette.textNavy,
    inverse: palette.white,
    muted: palette.textMutedBlue,
    inverseMuted: "rgba(255,255,255,0.8)",
  },
  surface: {
    background: palette.white,
    soft: palette.surfaceSoftBlue,
    card: palette.white,
    cardSoft: palette.surfaceCardBlue,
  },
  border: {
    default: palette.lineBlue,
    inverse: "rgba(255,255,255,0.35)",
  },
  status: {
    success: palette.success,
    pending: palette.pending,
    danger: palette.danger,
    slate: palette.slate,
  },
};
