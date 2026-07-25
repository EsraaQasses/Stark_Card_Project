// src/ui/AppIcon.js
import React from "react";
import { Image } from "react-native";

// map ONLY the files that actually exist
const ICONS = {
  home: require("../assets/icons/home.png"),
  downloads: require("../assets/icons/downloads.png"),
  shipping: require("../assets/icons/card.png"),
  qr: require("../assets/icons/qr.png"),
  send: require("../assets/icons/send.png"),
  menu: require("../assets/icons/menu.png"),
  user: require("../assets/icons/user.png"),
  bell: require("../assets/icons/bell.png"),
  search: require("../assets/icons/search.png"),
};

export default function AppIcon({
  name,
  size = 22,
  active = false,
  tintActive = "#2F8CFF",
  tintInactive = "#1F2A44",
  style,
}) {
  const src = ICONS[name];
  if (!src) return null;
  return (
    <Image
      source={src}
      resizeMode="contain"
      style={[{ width: size, height: size, tintColor: active ? tintActive : tintInactive }, style]}
    />
  );
}
