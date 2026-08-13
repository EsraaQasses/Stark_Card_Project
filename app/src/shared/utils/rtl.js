// Arabic is the only active app language today, so keep layout semantics RTL.
// Keep all direction decisions in this module so screens do not hard-code
// physical left/right values. If English is enabled later, this can become
// language-driven without touching every screen.
export const APP_DIRECTION = "rtl";
export const APP_IS_RTL = APP_DIRECTION === "rtl";

export const isRTL = () => APP_IS_RTL;

export const textAlignStart = () => (APP_IS_RTL ? "right" : "left");

export const textAlignEnd = () => (APP_IS_RTL ? "left" : "right");

export const rowDirection = () => (APP_IS_RTL ? "row-reverse" : "row");

export const rowDirectionReverse = () => (APP_IS_RTL ? "row" : "row-reverse");

export const writingDirection = () => (APP_IS_RTL ? "rtl" : "ltr");

export const startMarginProp = () => (APP_IS_RTL ? "marginRight" : "marginLeft");

export const endMarginProp = () => (APP_IS_RTL ? "marginLeft" : "marginRight");

export const startPaddingProp = () => (APP_IS_RTL ? "paddingRight" : "paddingLeft");

export const endPaddingProp = () => (APP_IS_RTL ? "paddingLeft" : "paddingRight");

export const startPositionProp = () => (APP_IS_RTL ? "right" : "left");

export const endPositionProp = () => (APP_IS_RTL ? "left" : "right");

export const chevronForwardIcon = () => (APP_IS_RTL ? "chevron-back" : "chevron-forward");
