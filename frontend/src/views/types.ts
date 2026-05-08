import type { ShareItState } from "../hooks/useShareIt";
import type { ThemeMode } from "../types";

export type Design = "dispatch" | "plain";

export interface ViewProps extends ShareItState {
  theme: ThemeMode;
  design: Design;
  onToggleTheme: () => void;
  onToggleDesign: () => void;
}
