import { useEffect, useState } from "react";
import DispatchView from "./views/DispatchView";
import PlainView from "./views/PlainView";
import { useShareIt } from "./hooks/useShareIt";
import type { Design } from "./views/types";
import type { ThemeMode } from "./types";
import "./App.css";
import "./styles/plain.css";

const DESIGN_KEY = "shareit:design";
const THEME_KEY = "shareit:theme";

function readDefaultDesign(): Design {
  const fromEnv = import.meta.env.VITE_DEFAULT_DESIGN as string | undefined;
  if (fromEnv === "plain" || fromEnv === "dispatch") return fromEnv;
  return "plain";
}

function readInitialDesign(fallback: Design): Design {
  try {
    const stored = localStorage.getItem(DESIGN_KEY);
    if (stored === "dispatch" || stored === "plain") return stored;
  } catch {
    /* ignore */
  }
  return fallback;
}

function readInitialTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return "light";
}

export default function App() {
  const [design, setDesign] = useState<Design>(() =>
    readInitialDesign(readDefaultDesign()),
  );
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);
  const state = useShareIt();

  useEffect(() => {
    document.documentElement.dataset.design = design;
    try {
      localStorage.setItem(DESIGN_KEY, design);
    } catch {
      /* ignore */
    }
  }, [design]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const onToggleDesign = () =>
    setDesign((d) => (d === "dispatch" ? "plain" : "dispatch"));
  const onToggleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : "light"));

  const viewProps = {
    ...state,
    design,
    theme,
    onToggleDesign,
    onToggleTheme,
  };

  return design === "plain" ? (
    <PlainView {...viewProps} />
  ) : (
    <DispatchView {...viewProps} />
  );
}
