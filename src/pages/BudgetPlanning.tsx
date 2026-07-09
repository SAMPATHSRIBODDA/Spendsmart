import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Budget } from "../types";
import { Wallet, AlertTriangle, Check, Lock, Info, PlusCircle, Landmark } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getSettings } from "../lib/settings";
import { backupData } from "../lib/sync";

export const BudgetPlanning: React.FC = () => {
  const [currency, setCurrency] = useState("$");

  // Helper to format values using Indian numbering system (e.g. 1,20,000)
  const formatIndianNumber = (num: number) => {
    return new Intl.NumberFormat("en-IN").format(num);
  };

  useEffect(() => {
    const updateCurrency = () => {
      setCurrency(getSettings().currency);
    };
    updateCurrency();
    window.addEventListener("spendsmart_settings_change", updateCurrency);
    return () => {
      window.removeEventListener("spendsmart_settings_change", updateCurrency);
    };
  }, []);

  // Get current month string: "YYYY-MM"
  const getTodayMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const currentMonthStr = getTodayMonthStr();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [pocketMoney, setPocketMoney] = useState<number>(1000); // Standard default
  const [savingsGoal, setSavingsGoal] = useState<number>(200); // Standard default
  const [allocated, setAllocated] = useState<Budget["allocated"]>({
    food: 0,
    transport: 0,
    shopping: 0,
    entertainment: 0,
    emergency: 0,
    stationery: 0,
    savings: 0,
    other: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPreFilled, setIsPreFilled] = useState(false);

  // Load budget for selectedMonth
  const fetchBudget = async (month: string) => {
    setLoading(true);
    setError(null);
    setIsPreFilled(false);
    try {
      const response = await api.get(`/budget?month=${month}`);
      const data = response.data;
      if (data) {
        setPocketMoney(data.pocketMoney || 0);
        setSavingsGoal(data.savingsGoal || 0);
        setIsPreFilled(data.isPreFilled || false);
        setAllocated({
          food: data.allocated?.food || 0,
          transport: data.allocated?.transport || 0,
          shopping: data.allocated?.shopping || 0,
          entertainment: data.allocated?.entertainment || 0,
          emergency: data.allocated?.emergency || 0,
          stationery: data.allocated?.stationery || 0,
          savings: data.allocated?.savings || 0,
          other: data.allocated?.other || 0,
        });
      }
    } catch (err: any) {
      console.error("Error loading budget:", err);
      setError("Failed to load budget. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudget(selectedMonth);
  }, [selectedMonth]);

  const isCurrentMonth = selectedMonth === currentMonthStr;

  // Calculate live allocations from the 7 category input fields
  const allocatedSum =
    Number(allocated.food || 0) +
    Number(allocated.transport || 0) +
    Number(allocated.shopping || 0) +
    Number(allocated.entertainment || 0) +
    Number(allocated.emergency || 0) +
    Number(allocated.stationery || 0) +
    Number(allocated.other || 0);

  const remainingPocketMoney = pocketMoney - allocatedSum;
  const isExceeded = allocatedSum > pocketMoney;

  const handleCategoryChange = (category: keyof Budget["allocated"], val: string) => {
    if (!isCurrentMonth) return; // Read-only
    const num = Math.max(0, Number(val));
    setAllocated((prev) => ({
      ...prev,
      [category]: num,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCurrentMonth) return;

    if (isExceeded) {
      setError("Allocation sum cannot exceed Monthly Pocket Money!");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await api.post("/budget", {
        month: selectedMonth,
        pocketMoney,
        savingsGoal,
        allocated,
      });
      setSuccess(response.data.message || "Budget saved successfully!");
      setIsPreFilled(false);
      
      // Update local storage backup
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const u = JSON.parse(storedUser);
          const uId = u.id || u._id;
          if (uId) {
            backupData(uId, [], { pocketMoney, savingsGoal, allocated }, selectedMonth);
          }
        } catch {}
      }

      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError("Failed to save budget. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper for human month names
  const formatMonthName = (mStr: string) => {
    const [year, month] = mStr.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto" id="budget-planning-wrapper">
      {/* Month Selection and Read-Only Alert */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <label htmlFor="month-select" className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
            Planning Month
          </label>
          <div className="flex items-center gap-3">
            <input
              id="month-select"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 bg-gray-950 border border-gray-800 focus:border-emerald-500/50 focus:ring-emerald-500/10 text-sm text-gray-100 rounded-xl outline-none"
            />
            <span className="text-sm font-semibold text-gray-300">
              ({formatMonthName(selectedMonth)})
            </span>
          </div>
        </div>

        {/* Edit lock indicator */}
        {!isCurrentMonth ? (
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs" id="read-only-badge">
            <Lock className="h-4 w-4 shrink-0" />
            <span className="font-semibold leading-relaxed">
              Read-Only: Budgets can only be created or modified for the current month ({formatMonthName(currentMonthStr)}).
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs" id="editable-badge">
            <Check className="h-4 w-4 shrink-0" />
            <span className="font-semibold leading-relaxed">
              Active Month: You are editing the current month's budget.
            </span>
          </div>
        )}
      </div>

      {/* Main Budget Dashboard Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: General Values & Category Allocations */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
              <Landmark className="h-5 w-5 text-emerald-400" />
              Pocket Money & Savings Goals
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Pocket Money Input */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pocket-money-input" className="text-xs font-semibold text-gray-400">
                  Monthly Pocket Money ({currency})
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm text-gray-500 font-mono font-bold">{currency}</span>
                  <input
                    id="pocket-money-input"
                    type="number"
                    min="0"
                    disabled={!isCurrentMonth}
                    value={pocketMoney || ""}
                    onChange={(e) => setPocketMoney(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-8 pr-4 py-2.5 bg-gray-950 border border-gray-800 disabled:opacity-50 disabled:cursor-not-allowed focus:border-emerald-500/50 focus:ring-emerald-500/10 text-sm text-gray-100 rounded-xl outline-none"
                    placeholder="Enter pocket money"
                    required
                  />
                </div>
                <p className="text-[10px] text-gray-500 font-mono mt-0.5">Total funds for this month</p>
              </div>

              {/* Savings Goal Input */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="savings-goal-input" className="text-xs font-semibold text-gray-400">
                  Savings Goal ({currency})
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm text-gray-500 font-mono font-bold">{currency}</span>
                  <input
                    id="savings-goal-input"
                    type="number"
                    min="0"
                    disabled={!isCurrentMonth}
                    value={savingsGoal || ""}
                    onChange={(e) => setSavingsGoal(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-8 pr-4 py-2.5 bg-gray-950 border border-gray-800 disabled:opacity-50 disabled:cursor-not-allowed focus:border-emerald-500/50 focus:ring-emerald-500/10 text-sm text-gray-100 rounded-xl outline-none"
                    placeholder="Enter savings goal"
                    required
                  />
                </div>
                <p className="text-[10px] text-gray-500 font-mono mt-0.5">Your target savings this month</p>
              </div>
            </div>
          </div>

          {/* Category Allocations Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
              <Wallet className="h-5 w-5 text-emerald-400" />
              Budget Category Allocations
            </h3>

            {isPreFilled && (
              <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-2 font-medium">
                <Info className="h-4 w-4 shrink-0" />
                <span>Pre-filled from last month — review and adjust before saving.</span>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {[
                { key: "food", label: "Food & Dining", color: "border-l-orange-500" },
                { key: "transport", label: "Transport & Commute", color: "border-l-sky-500" },
                { key: "shopping", label: "Shopping & Wardrobe", color: "border-l-indigo-500" },
                { key: "entertainment", label: "Entertainment & Fun", color: "border-l-rose-500" },
                { key: "emergency", label: "Emergency Reserve", color: "border-l-red-500" },
                { key: "stationery", label: "Stationery & Supplies", color: "border-l-emerald-500" },
                { key: "other", label: "Miscellaneous (Other)", color: "border-l-amber-500" },
              ].map((cat) => (
                <div
                  key={cat.key}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-gray-950/40 border border-gray-800 rounded-xl border-l-4 ${cat.color} gap-3`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-200">{cat.label}</span>
                    <span className="text-[11px] text-gray-500 capitalize">{cat.key} Allocation</span>
                  </div>
                  <div className="relative w-full sm:w-36">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-600">{currency}</span>
                    <input
                      type="number"
                      min="0"
                      disabled={!isCurrentMonth}
                      value={allocated[cat.key as keyof Budget["allocated"]] || ""}
                      onChange={(e) => handleCategoryChange(cat.key as keyof Budget["allocated"], e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-gray-950 border border-gray-800 focus:border-emerald-500/50 text-sm text-right text-gray-100 rounded-lg outline-none disabled:opacity-50 disabled:cursor-not-allowed font-semibold font-mono"
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Live Summary & Submission */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-6 sticky top-24" id="budget-summary-card">
            <h3 className="text-base font-bold text-white border-b border-gray-800 pb-3">
              Budget Summary & Status
            </h3>

            {/* Allocation Meter */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-400">
                <span>Allocation Progress</span>
                <span className="font-mono">
                  {currency}{formatIndianNumber(allocatedSum)} / {currency}{formatIndianNumber(pocketMoney)}
                </span>
              </div>
              <div className="h-3.5 bg-gray-950 rounded-full overflow-hidden border border-gray-800">
                <motion.div
                  className={`h-full rounded-full transition-all duration-300 ${isExceeded ? "bg-rose-500" : "bg-emerald-500"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (allocatedSum / (pocketMoney || 1)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Remaining pocket money metric */}
            <div className={`p-4 rounded-2xl flex flex-col gap-1 border ${
              isExceeded
                ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            }`}>
              <span className="text-[11px] font-bold uppercase tracking-wider block opacity-70">
                Remaining Monthly Pocket Money
              </span>
              <span className="text-3xl font-extrabold tracking-tight font-mono block">
                {currency}{formatIndianNumber(remainingPocketMoney)}
              </span>
            </div>

            {/* Danger alert when exceeded */}
            <AnimatePresence>
              {isExceeded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs flex gap-2 items-start"
                  id="budget-exceeded-alert"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block">Allocation Limit Exceeded!</strong>
                    The total allocated amount across all categories exceeds your monthly pocket money limit by {currency}{formatIndianNumber(Math.abs(remainingPocketMoney))}. Please decrease some category budgets.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Info notice about savings goal */}
            <div className="p-3.5 bg-gray-950/40 border border-gray-800 rounded-xl text-xs text-gray-400 flex gap-2.5 items-start">
              <Info className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-gray-300 font-semibold block mb-0.5">Goal Matching:</strong>
                Your Savings Goal is <strong className="text-emerald-400 font-bold">{currency}{formatIndianNumber(savingsGoal)}</strong>. Ensure your General Savings and Emergency Reserve allocations are configured to match this goal.
              </div>
            </div>

            {/* Alerts */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-tight block font-medium">{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-xl flex items-start gap-2">
                <Check className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-tight block font-medium">{success}</span>
              </div>
            )}

            {/* Save Button */}
            {isCurrentMonth && (
              <button
                type="submit"
                disabled={loading || isExceeded}
                className={`w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-gray-950 text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer flex justify-center items-center gap-2 border border-emerald-500/20 shadow-lg shadow-emerald-500/5 ${
                  loading || isExceeded ? "opacity-40 cursor-not-allowed" : ""
                }`}
                id="save-budget-btn"
              >
                <PlusCircle className="h-4 w-4" />
                <span>{loading ? "Saving Budget..." : "Save & Finalize Budget"}</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
