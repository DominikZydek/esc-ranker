"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    
    if (savedTheme) {
      setIsDark(savedTheme === "dark");
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else {
      const systemPreference = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(systemPreference);
      document.documentElement.classList.toggle("dark", systemPreference);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    
    document.documentElement.classList.toggle("dark", newTheme);
    
    localStorage.setItem("theme", newTheme ? "dark" : "light");
  };

  const button = <button
      onClick={toggleTheme}
      className="rounded-full p-2 bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
      aria-label={isDark ? "Przełącz na tryb jasny" : "Przełącz na tryb ciemny"}
    >
      {isDark ? (
        <Sun size={20} className="text-yellow-300" />
      ) : (
        <Moon size={20} className="text-blue-300" />
      )}
    </button>

    console.log(button)

  return (
    <button
      onClick={toggleTheme}
      className="rounded-full p-2 bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
      aria-label={isDark ? "Przełącz na tryb jasny" : "Przełącz na tryb ciemny"}
    >
      {isDark ? (
        <Sun size={20} className="text-yellow-300" />
      ) : (
        <Moon size={20} className="text-blue-300" />
      )}
    </button>
  );
}