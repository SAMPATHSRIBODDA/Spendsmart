import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { getSettings, saveSettings, CurrencySymbol } from "../lib/settings";
import {
  User as UserIcon,
  Mail,
  Shield,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Coins,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Award,
  CheckCircle,
} from "lucide-react";
import { motion } from "motion/react";

interface SettingsPageProps {
  onLogout: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [currency, setCurrency] = useState<CurrencySymbol>("$");

  // User details from localStorage
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; uri: string } | null>(null);

  // Success / Error status messages
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Confirmation states
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const currentMonthNameYear = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    // Load stored settings on mount
    const current = getSettings();
    setTheme(current.theme);
    setCurrency(current.currency);

    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("Failed to parse stored user profile:", err);
      }
    }

    const fetchDbStatus = async () => {
      try {
        const response = await api.get("/db-status");
        setDbStatus(response.data);
      } catch (err) {
        console.error("Failed to fetch database connection status:", err);
      }
    };
    fetchDbStatus();
  }, []);

  const handleThemeChange = (newTheme: "dark" | "light") => {
    setTheme(newTheme);
    saveSettings({ theme: newTheme });
    triggerGlobalSettingsUpdate();
    showToast("Theme updated successfully.");
  };

  const handleCurrencyChange = (newCurrency: CurrencySymbol) => {
    setCurrency(newCurrency);
    saveSettings({ currency: newCurrency });
    triggerGlobalSettingsUpdate();
    showToast(`Currency symbol modified to ${newCurrency}.`);
  };

  const triggerGlobalSettingsUpdate = () => {
    // Let layout and other pages know settings changed
    window.dispatchEvent(new Event("spendsmart_settings_change"));
  };

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg("");
    }, 4000);
  };

  // Reset current month budget allocation
  const handleResetBudget = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      await api.post("/budget", {
        month: currentMonthStr,
        pocketMoney: 0,
        savingsGoal: 0,
        allocated: {
          food: 0,
          transport: 0,
          shopping: 0,
          entertainment: 0,
          emergency: 0,
          savings: 0,
          other: 0,
        },
      });

      showToast("Current month budget has been reset to zero successfully.");
      setShowResetConfirm(false);
      // Trigger update
      window.dispatchEvent(new Event("spendsmart_settings_change"));
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to reset current month budget.");
    } finally {
      setLoading(false);
    }
  };

  // Delete User Account
  const handleDeleteAccount = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      await api.delete("/auth/account");
      // Call standard logout
      onLogout();
      navigate("/login");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to delete user account.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-16" id="settings-view">
      {/* Messages */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 p-4 rounded-xl flex items-center gap-3 text-sm font-semibold shadow-md">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/25 text-rose-400 p-4 rounded-xl flex items-center gap-3 text-sm font-semibold shadow-md">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. Profile Panel */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4.5 min-w-0">
          <div className="h-16 w-16 bg-gradient-to-tr from-emerald-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/10 shrink-0">
            {user?.name ? user.name.charAt(0).toUpperCase() : "S"}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-gray-500 font-mono font-extrabold tracking-wider uppercase block">Logged Profile</span>
            <h2 className="text-xl font-extrabold text-white tracking-tight truncate mt-0.5">{user?.name || "Student Demographics"}</h2>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1.5 font-medium">
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{user?.email || "student@example.com"}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full md:w-auto">
          <div className="bg-gray-950/60 border border-gray-800 px-4 py-2.5 rounded-xl text-center md:text-right font-mono text-[10px] text-gray-500">
            ACCOUNT STATUS: <span className="text-emerald-400 font-bold">VERIFIED LEVEL 1</span>
          </div>
          {dbStatus && (
            <div className="bg-gray-950/60 border border-gray-800 px-4 py-2.5 rounded-xl text-center md:text-right font-mono text-[10px] text-gray-500 flex flex-col gap-1 items-center md:items-end">
              <div>
                DATABASE:{" "}
                {dbStatus.connected ? (
                  <span className="text-emerald-400 font-bold">MONGODB ATLAS CONNECTED</span>
                ) : (
                  <span className="text-amber-500 font-bold">LOCAL FALLBACK</span>
                )}
              </div>
              {dbStatus.uri && (
                <span className="text-[9px] text-gray-600 block truncate max-w-[220px]" title={dbStatus.uri}>
                  {dbStatus.uri}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 2. Interface Appearance */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
          <div className="flex items-center gap-2.5 border-b border-gray-850 pb-3">
            <Sun className="h-5 w-5 text-amber-400 shrink-0" />
            <h3 className="text-sm font-extrabold text-white">Interface Customization</h3>
          </div>

          {/* Theme Toggling */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-400">Workspace Accent Lightness Mode</label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                onClick={() => handleThemeChange("dark")}
                className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : "bg-gray-950/40 border-gray-850 text-gray-500 hover:text-gray-300"
                }`}
                id="theme-dark-btn"
              >
                <Moon className="h-4 w-4" />
                <span>Stealth Dark Mode</span>
              </button>

              <button
                onClick={() => handleThemeChange("light")}
                className={`py-3 px-4 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-bold transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : "bg-gray-950/40 border-gray-850 text-gray-500 hover:text-gray-300"
                }`}
                id="theme-light-btn"
              >
                <Sun className="h-4 w-4" />
                <span>Clean Light Mode</span>
              </button>
            </div>
          </div>

          {/* Currency Selection */}
          <div className="flex flex-col gap-2 mt-2">
            <label className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-emerald-400" />
              Standard Currency Representation Symbols
            </label>
            <select
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value as CurrencySymbol)}
              className="mt-1 w-full px-4 py-3 bg-gray-950 border border-gray-850 text-gray-200 text-xs font-bold rounded-xl outline-none focus:border-emerald-500/30 transition-all cursor-pointer"
              id="currency-selector"
            >
              <option value="₹">₹ Indian Rupee (INR)</option>
              <option value="$">$ US Dollar (USD)</option>
              <option value="€">€ Euro (EUR)</option>
              <option value="£">£ British Pound (GBP)</option>
            </select>
          </div>
        </div>

        {/* 3. Account Actions / Maintenance */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
          <div className="flex items-center gap-2.5 border-b border-gray-850 pb-3">
            <Shield className="h-5 w-5 text-indigo-400 shrink-0" />
            <h3 className="text-sm font-extrabold text-white">Maintenance & Security Actions</h3>
          </div>

          {/* Reset Current Month Budget Allocation */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-white">Reset Current Month Budget Allocation</span>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Instantly wipe all allocated categories, target savings goals, and monthly limits back to zero.
            </p>

            <button
              onClick={() => setShowResetConfirm(true)}
              className="mt-1 w-fit flex items-center gap-2 px-4 py-2.5 bg-gray-950 hover:bg-amber-500/10 hover:text-amber-400 border border-gray-850 hover:border-amber-500/20 text-gray-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
              id="trigger-reset-budget-btn"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset Current Month Limits</span>
            </button>
          </div>

          {/* Delete User Account Wiping Data */}
          <div className="flex flex-col gap-2 mt-2 border-t border-gray-850/60 pt-4">
            <span className="text-xs font-bold text-rose-400">Permanently Delete SpendSmart Account</span>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              This completely purges your credentials, budgets, transactions, and categories irreversibly.
            </p>

            <button
              onClick={() => {
                setDeleteInput("");
                setShowDeleteConfirm(true);
              }}
              className="mt-1 w-fit flex items-center gap-2 px-4 py-2.5 bg-gray-950 hover:bg-rose-500/10 hover:text-rose-400 border border-gray-850 hover:border-rose-500/20 text-gray-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
              id="trigger-delete-account-btn"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Account & Erase All Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Reset Confirmation Overlay Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5"
          >
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-white tracking-tight">Reset Monthly Limits</h3>
            </div>

            <p className="text-sm text-gray-400 leading-relaxed">
              This will reset all category budgets, savings goal, and monthly pocket money for {currentMonthNameYear} back to ₹0. This cannot be undone. Continue?
            </p>

            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2.5 bg-gray-950 hover:bg-gray-850 border border-gray-800 text-gray-400 font-bold rounded-xl text-xs cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleResetBudget}
                disabled={loading}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-bold rounded-xl text-xs cursor-pointer transition-all"
                id="confirm-reset-budget-btn"
              >
                {loading ? "Resetting..." : "Yes, Reset"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 5. Delete Account Confirmation Overlay Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5"
          >
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-2 bg-rose-500/10 rounded-lg">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-white tracking-tight">Permanently Delete Account</h3>
            </div>

            <div className="flex flex-col gap-4 text-sm text-gray-400 leading-relaxed">
              <p>
                This will permanently delete your account, all budgets, transactions, and savings history. This cannot be undone.
              </p>
              
              <div className="flex flex-col gap-2 mt-1">
                <label className="text-xs font-bold text-gray-400">
                  Please type <span className="text-rose-400 font-mono font-extrabold select-all">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full px-4 py-3 bg-gray-950 border border-gray-800 text-gray-200 text-sm font-semibold rounded-xl outline-none focus:border-rose-500/30 transition-all text-center placeholder-gray-700"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInput("");
                }}
                className="px-4 py-2.5 bg-gray-950 hover:bg-gray-850 border border-gray-800 text-gray-400 font-bold rounded-xl text-xs cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={loading || deleteInput !== "DELETE"}
                className={`px-4 py-2.5 font-bold rounded-xl text-xs cursor-pointer transition-all ${
                  deleteInput === "DELETE"
                    ? "bg-rose-500 hover:bg-rose-400 text-white"
                    : "bg-gray-950 text-gray-600 border border-gray-850 cursor-not-allowed"
                }`}
                id="confirm-delete-account-btn"
              >
                {loading ? "Deleting..." : "Yes, Delete Permanently"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
