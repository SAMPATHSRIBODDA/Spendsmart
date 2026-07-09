// SpendSmart Settings & Theme Utilities

export type CurrencySymbol = "$" | "₹" | "€" | "£";

export interface AppSettings {
  theme: "dark" | "light";
  currency: CurrencySymbol;
  dismissedReminderDate: string | null; // e.g. "YYYY-MM-DD"
}

const SETTINGS_KEY = "spendsmart_settings";

const defaultSettings: AppSettings = {
  theme: "dark",
  currency: "₹",
  dismissedReminderDate: null,
};

export const getSettings = (): AppSettings => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = (settings: Partial<AppSettings>) => {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));

  // Dispatch a storage event to let other windows/listeners know
  window.dispatchEvent(new Event("spendsmart_settings_change"));

  // Apply theme class to root
  applyTheme(updated.theme);
};

const applyTheme = (theme: "dark" | "light") => {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("light-mode");
    root.style.colorScheme = "light";
  } else {
    root.classList.remove("light-mode");
    root.style.colorScheme = "dark";
  }
};

// Initialize theme on script load
if (typeof window !== "undefined") {
  applyTheme(getSettings().theme);
}
