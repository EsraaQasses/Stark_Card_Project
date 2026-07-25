import React, { createContext, useContext, useState } from "react";

const FavoritesContext = createContext();
export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState([]);
  const addFavorite = (item) =>
    setFavorites((prev) => (prev.find((f) => f.id === item.id) ? prev : [...prev, item]));
  const removeFavorite = (id) => setFavorites((prev) => prev.filter((f) => f.id !== id));
  return (
    <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}
export const useFavorites = () => useContext(FavoritesContext);
