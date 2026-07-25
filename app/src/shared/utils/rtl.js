export const APP_DIRECTION = "ltr";
export const APP_IS_RTL = APP_DIRECTION === "rtl";

export const isRTL = () => APP_IS_RTL;

export const textAlignStart = () => (APP_IS_RTL ? "right" : "left");

export const textAlignEnd = () => (APP_IS_RTL ? "left" : "right");

export const rowDirection = () => (APP_IS_RTL ? "row-reverse" : "row");

export const rowDirectionReverse = () => (APP_IS_RTL ? "row" : "row-reverse");

export const writingDirection = () => (APP_IS_RTL ? "rtl" : "ltr");

export const startMarginProp = () => (APP_IS_RTL ? "marginRight" : "marginLeft");

export const endMarginProp = () => (APP_IS_RTL ? "marginLeft" : "marginRight");
