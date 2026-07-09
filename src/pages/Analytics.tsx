import React, { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import { Expense } from "../types";
import { getSettings } from "../lib/settings";
import { backupData } from "../lib/sync";
import {
  TrendingUp,
  TrendingDown,
  Percent,
  Calendar,
  Award,
  DollarSign,
  Layers,
  CheckCircle,
  Lock,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  PieChart,
  Pie,
  Legend,
} from "recharts";

export const Analytics: React.FC = () => {
  const [currency, setCurrency] = useState("$");

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

  // Helper to format values using Indian numbering system (e.g. 1,20,000)
  const formatIndianNumber = (num: number) => {
    return new Intl.NumberFormat("en-IN").format(num);
  };

  const getCategoryLabel = (catKey: string) => {
    switch (catKey.toLowerCase()) {
      case "savings": return "Savings";
      case "food": return "Food & Dining";
      case "transport": return "Transport";
      case "shopping": return "Shopping";
      case "entertainment": return "Entertainment";
      case "emergency": return "Emergency Reserve";
      case "stationery": return "Stationery";
      case "other": return "Other / Misc";
      default: return catKey.charAt(0).toUpperCase() + catKey.slice(1);
    }
  };

  // Month selector state
  const getTodayMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const currentMonthStr = getTodayMonthStr();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  const [summary, setSummary] = useState<any>(null);
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);
  const [historicalSpending, setHistoricalSpending] = useState<Array<{ monthLabel: string; totalSpent: number }>>([]);
  const [loading, setLoading] = useState(true);

  // Helper for last 4 months
  const getLast4Months = (targetMonthStr: string): string[] => {
    const list = [];
    let current = targetMonthStr;
    for (let i = 0; i < 4; i++) {
      list.unshift(current); // oldest first
      const [year, month] = current.split("-").map(Number);
      if (month === 1) {
        current = `${year - 1}-12`;
      } else {
        current = `${year}-${String(month - 1).padStart(2, "0")}`;
      }
    }
    return list;
  };

  const formatMonthShortLabel = (mStr: string) => {
    const [year, mIndex] = mStr.split("-");
    const d = new Date(Number(year), Number(mIndex) - 1, 1);
    return d.toLocaleString("default", { month: "short", year: "2-digit" });
  };

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // 1. Fetch pre-calculated backend summary
      const sRes = await api.get(`/budget/summary?month=${selectedMonth}`);
      setSummary(sRes.data);

      // 2. Fetch all expenses and filter for this month
      const eRes = await api.get("/expenses");
      const rawData = eRes.data;
      const dataArray = Array.isArray(rawData)
        ? rawData
        : (rawData && Array.isArray(rawData.data) ? rawData.data : []);
      const filtered = dataArray.filter((exp: Expense) =>
        exp.date.startsWith(selectedMonth)
      );
      setMonthExpenses(filtered);

      // Backup locally
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const u = JSON.parse(storedUser);
          const uId = u.id || u._id;
          if (uId) {
            backupData(uId, dataArray, sRes.data, selectedMonth);
          }
        } catch {}
      }

      // 3. Fetch historical spending comparison for last 4 months
      const monthsToFetch = getLast4Months(selectedMonth);
      const historyRes = await Promise.all(
        monthsToFetch.map(async (m) => {
          try {
            const res = await api.get(`/budget/summary?month=${m}`);
            return {
              monthLabel: formatMonthShortLabel(m),
              totalSpent: res.data.totalExpenses || 0,
            };
          } catch (err) {
            console.error(`Error fetching historical summary for ${m}:`, err);
            return {
              monthLabel: formatMonthShortLabel(m),
              totalSpent: 0,
            };
          }
        })
      );
      setHistoricalSpending(historyRes);
    } catch (err) {
      console.error("Error loading analytics summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();

    const handleSettingsChange = () => {
      fetchAnalyticsData();
    };
    window.addEventListener("spendsmart_settings_change", handleSettingsChange);
    return () => {
      window.removeEventListener("spendsmart_settings_change", handleSettingsChange);
    };
  }, [selectedMonth]);

  const formatMonthName = (mStr: string) => {
    const [year, mIndex] = mStr.split("-");
    const d = new Date(Number(year), Number(mIndex) - 1, 1);
    return d.toLocaleString("default", { month: "long", year: "numeric" });
  };

  // Pre-calculated backend metrics mapped directly to variables
  const monthlyIncome = summary?.totalMoneyReceived !== undefined ? summary.totalMoneyReceived : (summary?.pocketMoney || 0);
  const totalExpenses = summary?.totalExpenses || 0;
  const totalSavings = summary?.currentSavings || 0;
  const savingsRate = summary?.savingsRate || 0;
  const budgetUtilization = summary?.budgetUtilization || 0;

  // Analyze active spending categories client-side to ensure bug-free highest/lowest logic
  const activeCategories = useMemo(() => {
    const list: Array<{ key: string; label: string; amount: number }> = [];
    if (summary?.categorySpending) {
      Object.entries(summary.categorySpending).forEach(([catKey, amount]) => {
        const amt = Number(amount || 0);
        if (amt > 0) {
          list.push({
            key: catKey,
            label: getCategoryLabel(catKey),
            amount: amt
          });
        }
      });
    }
    // Sort descending by amount
    list.sort((a, b) => b.amount - a.amount);
    return list;
  }, [summary]);

  const highestSpendingCategory = activeCategories.length > 0 ? activeCategories[0].label : "No spending yet";
  const lowestSpendingCategory = activeCategories.length > 0 ? activeCategories[activeCategories.length - 1].label : "No spending yet";
  const savingsGoal = summary?.savingsGoal || 0;
  const savingsRemaining = Math.max(0, savingsGoal - totalSavings);
  const savingsGoalProgress =
    savingsGoal > 0 ? Math.min(100, Math.round((totalSavings / savingsGoal) * 100)) : 0;

  // Modern Horizontal Bar Chart Data (compares all category spending, filter out empty ones)
  const horizontalChartData = useMemo(() => {
    if (!summary) return [];
    const categories = [
      { name: "Food & Dining", Spent: summary.categorySpending?.food || 0 },
      { name: "Transport", Spent: summary.categorySpending?.transport || 0 },
      { name: "Shopping", Spent: summary.categorySpending?.shopping || 0 },
      { name: "Entertainment", Spent: summary.categorySpending?.entertainment || 0 },
      { name: "Emergency Reserve", Spent: summary.categorySpending?.emergency || 0 },
      { name: "Stationery", Spent: summary.categorySpending?.stationery || 0 },
      { name: "Other / Misc", Spent: summary.categorySpending?.other || 0 },
    ];
    return categories.filter((cat) => cat.Spent > 0);
  }, [summary]);

  const COLORS = [
    "#f97316", // Food - Orange
    "#0ea5e9", // Transport - Sky
    "#6366f1", // Shopping - Indigo
    "#f43f5e", // Entertainment - Rose
    "#ef4444", // Emergency - Red
    "#10b981", // Stationery - Emerald
    "#f59e0b", // Other - Amber
  ];

  // Pie chart data for expense distribution
  const expenseDistributionData = useMemo(() => {
    if (!summary?.categorySpending) return [];
    const categories = [
      { name: "Food & Dining", value: summary.categorySpending.food || 0, color: "#f97316" },
      { name: "Transport", value: summary.categorySpending.transport || 0, color: "#0ea5e9" },
      { name: "Shopping", value: summary.categorySpending.shopping || 0, color: "#6366f1" },
      { name: "Entertainment", value: summary.categorySpending.entertainment || 0, color: "#f43f5e" },
      { name: "Emergency Reserve", value: summary.categorySpending.emergency || 0, color: "#ef4444" },
      { name: "Stationery", value: summary.categorySpending.stationery || 0, color: "#10b981" },
      { name: "Other / Misc", value: summary.categorySpending.other || 0, color: "#f59e0b" },
    ];
    return categories.filter((cat) => cat.value > 0);
  }, [summary]);

  // Largest single expense calculation
  const largestSingleExpenseStr = useMemo(() => {
    if (monthExpenses.length === 0) return "None";
    const expensesOnly = monthExpenses.filter(e => e.category !== "income");
    if (expensesOnly.length === 0) return "None";
    const maxExp = expensesOnly.reduce((max, exp) => exp.amount > max.amount ? exp : max, expensesOnly[0]);
    if (!maxExp || maxExp.amount <= 0) return "None";
    const catLabel = getCategoryLabel(maxExp.category || "");
    return `${catLabel} – ${currency}${formatIndianNumber(maxExp.amount)}`;
  }, [monthExpenses, currency]);

  // Insights generation
  const spendTrendInsight = useMemo(() => {
    if (historicalSpending.length < 2) return "";
    const currentSpend = historicalSpending[3]?.totalSpent || 0;
    const prevSpend = historicalSpending[2]?.totalSpent || 0;
    if (prevSpend === 0) return "";
    
    const pctChange = Math.round(((prevSpend - currentSpend) / prevSpend) * 100);
    if (pctChange > 0) {
      return `spent ${pctChange}% less than last month`;
    } else if (pctChange < 0) {
      return `spent ${Math.abs(pctChange)}% more than last month`;
    } else {
      return `spent exactly the same as last month`;
    }
  }, [historicalSpending]);

  const savingsInsight = useMemo(() => {
    return totalSavings >= savingsGoal && savingsGoal > 0 
      ? "successfully achieved your savings goal" 
      : "did not meet your savings goal";
  }, [totalSavings, savingsGoal]);

  const disciplineInsight = useMemo(() => {
    return budgetUtilization <= 100 
      ? "Overall, your budgeting improved and stayed within limits compared to the previous month." 
      : "Overall, your spending exceeded your starting pocket money, requiring tighter budget discipline next period.";
  }, [budgetUtilization]);

  const financialInsightsText = useMemo(() => {
    const trendText = spendTrendInsight ? `You ${spendTrendInsight}, ` : "Based on your activity, ";
    const goalText = savingsGoal > 0 ? `${savingsInsight}, ` : "";
    const catText = highestSpendingCategory !== "No spending yet" ? `and ${highestSpendingCategory} was your highest spending category.` : "and you had no expenses.";
    
    return `${trendText}${goalText}${catText} ${disciplineInsight}`;
  }, [spendTrendInsight, savingsInsight, highestSpendingCategory, disciplineInsight, savingsGoal]);

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400 font-mono text-xs gap-3">
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        Generating Monthly Financial Summary...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-16" id="analytics-view">
      {/* 1. Header with Month Selector & Lock Notice */}
      <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 md:p-7 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-gray-950/20 hover:border-gray-700/50 transition-all duration-300" id="analytics-header-container">
        <div className="flex flex-col gap-1.5 self-stretch md:self-auto">
          <span className="text-[10px] text-gray-500 font-mono font-extrabold tracking-wider uppercase">
            Selected Fiscal Month
          </span>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4.5 py-3 bg-gray-950/60 border border-gray-800 hover:border-emerald-500/30 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10 text-sm text-gray-100 rounded-2xl outline-none font-bold transition-all shadow-inner"
              id="analytics-month-picker"
            />
          </div>
        </div>

        {/* Lock indicator state */}
        {selectedMonth !== currentMonthStr ? (
          <div className="flex items-start gap-3.5 px-5 py-4 bg-amber-500/5 border border-amber-500/15 text-amber-400 rounded-2xl text-xs max-w-md shadow-lg shadow-amber-500/2" id="readonly-warning-banner">
            <Lock className="h-4.5 w-4.5 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <span className="font-extrabold block text-amber-300 mb-0.5">Monthly Archive Read-Only</span>
              <p className="text-gray-400 leading-relaxed font-semibold">
                This is a historical archive. Previous months can be viewed but remain non-editable. Select the current month ({formatMonthName(currentMonthStr)}) to edit.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3.5 px-5 py-4 bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 rounded-2xl text-xs max-w-md shadow-lg shadow-emerald-500/2" id="active-warning-banner">
            <TrendingUp className="h-4.5 w-4.5 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <span className="font-extrabold block text-emerald-300 mb-0.5">Editable Active Period</span>
              <p className="text-gray-400 leading-relaxed font-semibold">
                You can fully manage transactions and edit category budgets for the current active period.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Unified Financial Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="analytics-summary-cards">
        {/* Money Received */}
        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 flex flex-col justify-between shadow-xl shadow-gray-950/15 hover:border-gray-700/50 hover:-translate-y-1 transition-all duration-300 relative group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Money Received
              </span>
              <span className="text-3xl font-black tracking-tight text-white mt-1 block">
                {currency}{monthlyIncome}
              </span>
            </div>
            <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl text-emerald-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-300 transition-colors duration-300 shadow-inner">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <span className="text-[10px] text-gray-500 font-sans font-semibold block mt-4.5">Starting pocket money</span>
        </div>

        {/* Total Spent */}
        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 flex flex-col justify-between shadow-xl shadow-gray-950/15 hover:border-gray-700/50 hover:-translate-y-1 transition-all duration-300 relative group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Total Spent
              </span>
              <span className="text-3xl font-black tracking-tight text-rose-400 mt-1 block">
                {currency}{totalExpenses}
              </span>
            </div>
            <div className="p-3.5 bg-rose-500/5 border border-rose-500/15 rounded-2xl text-rose-400 group-hover:bg-rose-500/10 group-hover:text-rose-300 transition-colors duration-300 shadow-inner">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <span className="text-[10px] text-gray-500 font-sans font-semibold block mt-4.5">All expenditures this month</span>
        </div>

        {/* Savings Rate */}
        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 flex flex-col justify-between shadow-xl shadow-gray-950/15 hover:border-gray-700/50 hover:-translate-y-1 transition-all duration-300 relative group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Savings Rate
              </span>
              <span className="text-3xl font-black tracking-tight text-indigo-400 mt-1 block">
                {savingsRate}%
              </span>
            </div>
            <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl text-indigo-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-300 transition-colors duration-300 shadow-inner">
              <Percent className="h-5 w-5" />
            </div>
          </div>
          <span className="text-[10px] text-gray-500 font-sans font-semibold block mt-4.5">Pocket money saved</span>
        </div>

        {/* Budget Utilization */}
        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 flex flex-col justify-between shadow-xl shadow-gray-950/15 hover:border-gray-700/50 hover:-translate-y-1 transition-all duration-300 relative group">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                Budget Utilization
              </span>
              <span className="text-3xl font-black tracking-tight text-amber-400 mt-1 block">
                {budgetUtilization}%
              </span>
            </div>
            <div className="p-3.5 bg-amber-500/5 border border-amber-500/15 rounded-2xl text-amber-400 group-hover:bg-amber-500/10 group-hover:text-amber-300 transition-colors duration-300 shadow-inner">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <span className="text-[10px] text-gray-500 font-sans font-semibold block mt-4.5">Pocket money spent</span>
        </div>
      </div>

      {/* 3. Savings Goal Progress Section */}
      <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 md:p-7 flex flex-col gap-6 shadow-xl shadow-gray-950/20 hover:border-gray-700/50 transition-all duration-300" id="savings-goal-progress-card">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3.5">
          <h3 className="text-lg font-black text-white flex items-center gap-2.5 tracking-tight">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            Savings Goal Target Completion Rate
          </h3>
          <span className="text-[10px] text-gray-500 font-mono uppercase font-bold tracking-wider">
            Goal Analysis
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="flex flex-col gap-1 text-sm bg-gray-950/40 p-5 rounded-2xl border border-gray-800/50 shadow-inner">
            <span className="text-xs text-gray-500 font-bold">Savings Goal</span>
            <strong className="text-2xl font-extrabold text-white mt-1">{currency}{formatIndianNumber(savingsGoal)}</strong>
            <span className="text-[10px] text-gray-500 mt-1 leading-relaxed">Target savings goal configured.</span>
          </div>

          <div className="flex flex-col gap-1 text-sm bg-gray-950/40 p-5 rounded-2xl border border-gray-800/50 shadow-inner">
            <span className="text-xs text-gray-500 font-bold">Current Saved Amount</span>
            <strong className="text-2xl font-extrabold text-emerald-400 mt-1">{currency}{formatIndianNumber(totalSavings)}</strong>
            <span className="text-[10px] text-gray-500 mt-1 leading-relaxed">Logged savings this period.</span>
          </div>

          <div className="flex flex-col gap-1 text-sm bg-gray-950/40 p-5 rounded-2xl border border-gray-800/50 shadow-inner">
            <span className="text-xs text-gray-500 font-bold">Remaining Amount</span>
            <strong className={`text-2xl font-extrabold mt-1 ${savingsRemaining > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {savingsRemaining === 0 ? "🎉 Goal Achieved" : `${currency}${formatIndianNumber(savingsRemaining)}`}
            </strong>
            <span className="text-[10px] text-gray-500 mt-1 leading-relaxed">Outstanding target remaining.</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          <div className="flex justify-between items-center text-xs font-bold text-gray-400">
            <span>Completed:</span>
            <span className="text-purple-400">{savingsGoalProgress}%</span>
          </div>
          <div className="h-2.5 w-full bg-gray-950 rounded-full border border-gray-900/40 overflow-hidden shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${savingsGoalProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. Expense Distribution Chart */}
      <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 md:p-7 shadow-xl shadow-gray-950/20 hover:border-gray-700/50 transition-all duration-300" id="expense-distribution-section">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3.5">
          <h3 className="text-lg font-black text-white flex items-center gap-2.5 tracking-tight">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            Expense Distribution
          </h3>
          <span className="text-[10px] text-gray-500 font-mono uppercase font-bold tracking-wider">
            Category Breakdown
          </span>
        </div>

        {expenseDistributionData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center mt-4">
            <div className="md:col-span-6 flex flex-col items-center justify-center">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {expenseDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#111625", borderColor: "#2b3554", borderRadius: "16px", padding: "10px 14px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.4)" }}
                      itemStyle={{ color: "#f1f5f9", fontSize: "12px", fontWeight: "bold" }}
                      formatter={(value: any) => [`${currency}${value}`, "Spent"]}
                    />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: "11px", color: "#8897bd", fontWeight: "600" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="md:col-span-6 flex flex-col gap-4">
              <h4 className="text-xs font-bold text-gray-400 font-mono uppercase tracking-wider">Spend Allocation</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Visualizing how your discretionary and non-discretionary expenses split across your dynamic student categories this month. 
              </p>
              <div className="grid grid-cols-2 gap-3.5 mt-2">
                {expenseDistributionData.map((cat, idx) => {
                  const percent = totalExpenses > 0 ? Math.round((cat.value / totalExpenses) * 100) : 0;
                  return (
                    <div key={idx} className="bg-gray-950/40 p-3.5 border border-gray-800/40 rounded-2xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs font-bold text-gray-300 truncate">{cat.name}</span>
                      </div>
                      <span className="text-xs font-black text-white shrink-0">{percent}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-800/80 rounded-2xl bg-gray-950/20 mt-4">
            <Percent className="h-8 w-8 text-gray-600 mb-2" />
            <p className="text-xs font-semibold text-gray-400">No active expenditures logged in this period</p>
          </div>
        )}
      </div>

      {/* 5. Category Spending Comparison Chart */}
      <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 md:p-7 flex flex-col gap-5 shadow-xl shadow-gray-950/20 hover:border-gray-700/50 transition-all duration-300" id="category-comparison-section">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3.5">
          <h3 className="text-lg font-black text-white flex items-center gap-2.5 tracking-tight">
            <Layers className="h-5 w-5 text-emerald-400" />
            Category Spending Comparison
          </h3>
          <span className="text-[10px] text-gray-500 font-mono uppercase font-bold tracking-wider">
            Comparative Chart
          </span>
        </div>

        {horizontalChartData.length > 0 ? (
          <div className="h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={horizontalChartData}
                margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e253c" horizontal={false} />
                <XAxis type="number" stroke="#5c6c94" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#5c6c94" fontSize={11} tickLine={false} width={130} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111625", borderColor: "#2b3554", borderRadius: "16px", padding: "10px 14px" }}
                  itemStyle={{ color: "#f1f5f9", fontSize: "12px", fontWeight: "bold" }}
                  formatter={(value: any) => [`${currency}${value}`, "Spent"]}
                />
                <Bar dataKey="Spent" radius={[0, 6, 6, 0]} barSize={16}>
                  {horizontalChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-800/80 rounded-2xl bg-gray-950/20 mt-4">
            <Percent className="h-8 w-8 text-gray-600 mb-2" />
            <p className="text-xs font-semibold text-gray-400">No active category spending recorded</p>
          </div>
        )}
      </div>

      {/* 6. Monthly Spending Comparison (New Section) */}
      <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 md:p-7 flex flex-col gap-5 shadow-xl shadow-gray-950/20 hover:border-gray-700/50 transition-all duration-300" id="monthly-spending-comparison-section">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3.5">
          <h3 className="text-lg font-black text-white flex items-center gap-2.5 tracking-tight">
            <Calendar className="h-5 w-5 text-purple-400" />
            Monthly Spending Comparison
          </h3>
          <span className="text-[10px] text-gray-500 font-mono uppercase font-bold tracking-wider">
            Spending Trends Over Time
          </span>
        </div>

        {historicalSpending.length > 0 ? (
          <div className="h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={historicalSpending}
                margin={{ left: 10, right: 10, top: 15, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e253c" vertical={false} />
                <XAxis dataKey="monthLabel" stroke="#5c6c94" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#5c6c94" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111625", borderColor: "#2b3554", borderRadius: "16px", padding: "10px 14px" }}
                  itemStyle={{ color: "#f1f5f9", fontSize: "12px", fontWeight: "bold" }}
                  formatter={(value: any) => [`${currency}${value}`, "Total Spent"]}
                />
                <Bar dataKey="totalSpent" fill="#a855f7" radius={[6, 6, 0, 0]} barSize={36}>
                  {historicalSpending.map((entry, index) => {
                    const isSelected = entry.monthLabel === formatMonthShortLabel(selectedMonth);
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isSelected ? "#3b82f6" : "#a855f7"} 
                        opacity={isSelected ? 1 : 0.75}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-800/80 rounded-2xl bg-gray-950/20 mt-4">
            <Percent className="h-8 w-8 text-gray-600 mb-2" />
            <p className="text-xs font-semibold text-gray-400">No historical monthly data found</p>
          </div>
        )}
      </div>

      {/* 7. Monthly Financial Report Card */}
      <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-gray-950/20 hover:border-gray-700/50 transition-all duration-300" id="financial-report-section">
        <div className="flex justify-between items-center border-b border-gray-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-400" />
              Monthly Financial Report
            </h3>
            <span className="text-xs text-gray-500 mt-1 block">A comprehensive executive-level audit for {formatMonthName(selectedMonth)}</span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono uppercase font-bold tracking-wider">
            Statement
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
          {/* Left Column: Flow of Funds */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-bold text-gray-400 font-mono uppercase tracking-wider border-b border-gray-850 pb-2">Funds & Flow</h4>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-400 font-medium">Money Received</span>
                <span className="text-sm font-black text-white">{currency}{monthlyIncome}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-400 font-medium">Total Spent</span>
                <span className="text-sm font-black text-rose-400">-{currency}{totalExpenses}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-gray-850/60 pt-2">
                <span className="text-sm text-gray-300 font-bold">Total Saved</span>
                <span className="text-sm font-black text-emerald-400">+{currency}{totalSavings}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-400 font-medium">Savings Goal Status</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${totalSavings >= savingsGoal ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                  {totalSavings >= savingsGoal ? "Achieved" : "Not Achieved"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Highlights */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-bold text-gray-400 font-mono uppercase tracking-wider border-b border-gray-850 pb-2">Category & Transaction Highlights</h4>
            <div className="flex flex-col gap-3">
              {activeCategories.length === 0 ? (
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm text-gray-400 font-medium">Category Highlights</span>
                  <span className="text-xs text-amber-400/80 font-bold">No spending recorded yet this month</span>
                </div>
              ) : activeCategories.length === 1 ? (
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm text-gray-400 font-medium">Only Active Category</span>
                  <span className="text-sm font-black text-rose-400 truncate max-w-[200px]" title={activeCategories[0].label}>
                    {activeCategories[0].label} – {currency}{formatIndianNumber(activeCategories[0].amount)}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-400 font-medium">Highest Spending Category</span>
                    <span className="text-sm font-black text-gray-100 truncate max-w-[200px]" title={highestSpendingCategory}>{highestSpendingCategory}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm text-gray-400 font-medium">Lowest Spending Category</span>
                    <span className="text-sm font-black text-gray-100 truncate max-w-[200px]" title={lowestSpendingCategory}>{lowestSpendingCategory}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-400 font-medium">Largest Single Expense</span>
                <span className="text-sm font-black text-rose-400 truncate max-w-[250px]" title={largestSingleExpenseStr}>
                  {largestSingleExpenseStr}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-gray-850/60 pt-2">
                <span className="text-sm text-gray-400 font-medium">Budget Utilization Rate</span>
                <span className="text-sm font-black text-white">{budgetUtilization}%</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm text-gray-400 font-medium">Total Transactions logged</span>
                <span className="text-sm font-black text-white">{monthExpenses.length} transactions</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 8. Month-End Summary / Financial Insights Card */}
      <div className="bg-gradient-to-r from-emerald-500/5 to-blue-500/5 border border-emerald-500/10 rounded-3xl p-6 md:p-8 shadow-xl shadow-gray-950/20 hover:border-emerald-500/20 transition-all duration-300" id="financial-insights-section">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 rounded-2xl shrink-0 shadow-inner">
            <Award className="h-6 w-6 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-wider">Financial Insights</span>
            <h4 className="text-lg font-black text-white mt-1 tracking-tight">Month-End Summary</h4>
            <p className="text-sm font-semibold text-gray-300 leading-relaxed mt-3 bg-gray-950/30 p-5 border border-gray-850/40 rounded-2xl shadow-inner">
              "{financialInsightsText}"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
