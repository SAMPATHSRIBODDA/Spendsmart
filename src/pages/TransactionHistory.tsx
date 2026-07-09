import React, { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { Budget, Expense } from "../types";
import {
  FileText,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit,
  X,
  PlusCircle,
  Undo2,
  ChevronDown,
  ArrowUpRight,
  Utensils,
  Bus,
  ShoppingBag,
  Film,
  PenTool,
  AlertTriangle,
  HelpCircle,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Stack, Trie, mergeSort } from "../lib/dsa";
import { getSettings } from "../lib/settings";
import { backupData } from "../lib/sync";

const monthsOf2026 = [
  { value: "2026-04", label: "April 2026" },
  { value: "2026-05", label: "May 2026" },
  { value: "2026-06", label: "June 2026" },
  { value: "2026-07", label: "July 2026" },
  { value: "2026-08", label: "August 2026" },
  { value: "2026-09", label: "September 2026" },
];

// Binary Search helper functions for date range filtering in an ascending/descending date-sorted array of Expenses
function findFirstOnOrAfterAsc(arr: Expense[], startDate: string): number {
  let low = 0;
  let high = arr.length - 1;
  let ans = arr.length;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid].date >= startDate) {
      ans = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return ans;
}

function findLastOnOrBeforeAsc(arr: Expense[], endDate: string): number {
  let low = 0;
  let high = arr.length - 1;
  let ans = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid].date <= endDate) {
      ans = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return ans;
}

function findFirstOnOrBeforeDesc(arr: Expense[], endDate: string): number {
  let low = 0;
  let high = arr.length - 1;
  let ans = arr.length;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid].date <= endDate) {
      ans = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return ans;
}

function findLastOnOrAfterDesc(arr: Expense[], startDate: string): number {
  let low = 0;
  let high = arr.length - 1;
  let ans = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid].date >= startDate) {
      ans = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return ans;
}

const getCategoryDetails = (cat: string) => {
  const c = cat.toLowerCase();
  switch (c) {
    case "income":
      return {
        icon: ArrowUpRight,
        colorClass: "text-emerald-400",
        bgClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
        label: "Income"
      };
    case "savings":
      return {
        icon: PlusCircle,
        colorClass: "text-purple-400",
        bgClass: "bg-purple-500/10 border-purple-500/20 text-purple-400",
        label: "Savings"
      };
    case "food":
      return {
        icon: Utensils,
        colorClass: "text-orange-400",
        bgClass: "bg-orange-500/10 border-orange-500/20 text-orange-400",
        label: "Food"
      };
    case "transport":
      return {
        icon: Bus,
        colorClass: "text-blue-400",
        bgClass: "bg-blue-500/10 border-blue-500/20 text-blue-400",
        label: "Transport"
      };
    case "shopping":
      return {
        icon: ShoppingBag,
        colorClass: "text-purple-400",
        bgClass: "bg-purple-500/10 border-purple-500/20 text-purple-400",
        label: "Shopping"
      };
    case "entertainment":
      return {
        icon: Film,
        colorClass: "text-pink-400",
        bgClass: "bg-pink-500/10 border-pink-500/20 text-pink-400",
        label: "Entertainment"
      };
    case "stationery":
    case "utilities":
      return {
        icon: PenTool,
        colorClass: "text-yellow-400",
        bgClass: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
        label: cat === "stationery" ? "Stationery" : "Utilities"
      };
    case "emergency":
      return {
        icon: AlertTriangle,
        colorClass: "text-red-400",
        bgClass: "bg-red-500/10 border-red-500/20 text-red-400",
        label: "Emergency"
      };
    default:
      return {
        icon: HelpCircle,
        colorClass: "text-gray-400",
        bgClass: "bg-gray-500/10 border-gray-500/20 text-gray-400",
        label: cat.charAt(0).toUpperCase() + cat.slice(1)
      };
  }
};

const formatDateGPay = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
};

const formatMonthName = (monthStr: string) => {
  const [year, month] = monthStr.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const formatIndianNumber = (num: number) => {
  return new Intl.NumberFormat("en-IN").format(num);
};

const getDailyExpenseLabel = (dateStr: string) => {
  if (!dateStr) return "DAILY EXPENSE";
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (dateStr === todayStr) {
    return "TODAY'S EXPENSE";
  } else if (dateStr === yesterdayStr) {
    return "YESTERDAY'S EXPENSE";
  } else {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dateZero = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const diffTime = todayZero.getTime() - dateZero.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1 && diffDays < 8) {
      return `${diffDays} DAYS AGO`;
    }
    return "DAILY EXPENSE";
  }
};

export const TransactionHistory: React.FC = () => {
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

  const getTodayMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const currentMonthStr = getTodayMonthStr();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Sorting & Filtering State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"amount" | "date" | "category" | "title">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Expense modal states (Create & Edit)
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Modal State
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showAddSuggestions, setShowAddSuggestions] = useState(false);
  const [showEditSuggestions, setShowEditSuggestions] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("food");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Undo Delete Stack state
  const undoStack = useRef(new Stack<Expense>()); // [DSA] Stack data structure for Last-In-First-Out (LIFO) undo functionality
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [undoItemName, setUndoItemName] = useState("");
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isCurrentMonthEditable = selectedMonth === currentMonthStr;

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const sRes = await api.get(`/budget/summary?month=${selectedMonth}`);
      setSummary(sRes.data);
      setBudget(sRes.data);

      const eRes = await api.get("/expenses");
      const rawData = eRes.data;
      const dataArray = Array.isArray(rawData)
        ? rawData
        : (rawData && Array.isArray(rawData.data) ? rawData.data : []);
      setExpenses(dataArray);

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
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedMonth]);

  // ADD EXPENSE handler
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !date) {
      setAddError("Please fill in all required fields.");
      return;
    }

    setAddError(null);
    setAddLoading(true);

    try {
      await api.post("/expenses", {
        amount: Number(amount),
        category,
        description,
        date,
        note,
      });

      // Clear fields
      setAmount("");
      setDescription("");
      setNote("");
      setDate(new Date().toISOString().split("T")[0]);
      setIsAddExpenseOpen(false);
      await fetchTransactions();
    } catch (err: any) {
      setAddError(err.response?.data?.error || "Failed to create transaction.");
    } finally {
      setAddLoading(false);
    }
  };

  // EDIT EXPENSE modal opener
  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setEditAmount(String(exp.amount));
    setEditCategory(exp.category);
    setEditDescription(exp.description);
    setEditDate(exp.date);
    setEditNote(exp.note || "");
    setEditError(null);
  };

  // EDIT EXPENSE handler
  const handleEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    if (!editAmount || !editDescription || !editDate) {
      setEditError("Please fill in all required fields.");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      await api.put(`/expenses/${editingExpense._id}`, {
        amount: Number(editAmount),
        category: editCategory,
        description: editDescription,
        date: editDate,
        note: editNote,
      });

      setEditingExpense(null);
      await fetchTransactions();
    } catch (err: any) {
      setEditError(err.response?.data?.error || "Failed to update expense.");
    } finally {
      setEditLoading(false);
    }
  };

  // DELETE EXPENSE with manual Stack Undo handler
  const handleDeleteExpense = async (exp: Expense) => {
    try {
      await api.delete(`/expenses/${exp._id}`);

      // Push to custom Stack
      undoStack.current.push(exp);
      setUndoItemName(exp.description);
      setShowUndoToast(true);

      // Reset auto-dismiss timer
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setShowUndoToast(false);
      }, 6000);

      setEditingExpense(null);
      await fetchTransactions();
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
  };

  // UNDO DELETE handler (Pops from our Stack)
  const handleUndoDelete = async () => {
    const lastDeleted = undoStack.current.pop();
    if (!lastDeleted) return;

    try {
      await api.post("/expenses", {
        amount: lastDeleted.amount,
        category: lastDeleted.category,
        description: lastDeleted.description,
        date: lastDeleted.date,
        note: lastDeleted.note,
      });

      setShowUndoToast(false);
      await fetchTransactions();
    } catch (error) {
      console.error("Error restoring expense during Undo:", error);
    }
  };

  const pocketMoney = summary?.pocketMoney || 0;

  // Filter expenses strictly belonging to the selected month: YYYY-MM
  const monthExpenses = expenses.filter((exp) => exp.date.startsWith(selectedMonth));

  // TRIE SEARCH engine: Match title/category instantly while typing
  const trie = useRef(new Trie<Expense>()); // [DSA] Prefix Tree (Trie) for O(L) time complexity auto-completion and fast searching
  useEffect(() => {
    const newTrie = new Trie<Expense>();
    for (const exp of expenses) {
      newTrie.insert(exp.description, exp);
      newTrie.insert(exp.category, exp);
    }
    trie.current = newTrie;
  }, [expenses]);

  // Compute Search Matches from Trie
  let matchedExpenses: Expense[] = [];
  if (searchQuery.trim()) {
    matchedExpenses = trie.current.search(searchQuery).filter((exp) => exp.date.startsWith(selectedMonth));
  } else {
    matchedExpenses = [...monthExpenses];
  }

  // Compute autocomplete suggestions from the existing Trie
  const getSuggestions = (queryText: string): string[] => {
    if (!queryText.trim()) return [];
    const matches = trie.current.search(queryText);
    const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date));
    const uniqueDescs: string[] = [];
    for (const exp of sorted) {
      if (exp.description && exp.description.toLowerCase().startsWith(queryText.toLowerCase())) {
        if (!uniqueDescs.includes(exp.description)) {
          uniqueDescs.push(exp.description);
          if (uniqueDescs.length >= 5) break;
        }
      }
    }
    return uniqueDescs;
  };

  const addSuggestions = getSuggestions(description);
  const editSuggestions = getSuggestions(editDescription);

  // Apply base Category filter first (Trie search has already been applied to matchedExpenses)
  const categoryFilteredExpenses = matchedExpenses.filter((exp) => {
    if (filterCategory !== "all") {
      if (filterCategory === "income") {
        if (exp.category !== "income") return false;
      } else if (filterCategory === "utilities") {
        if (exp.category !== "utilities" && exp.category !== "stationery" && exp.category !== "other") return false;
      } else {
        if (exp.category !== filterCategory) return false;
      }
    }
    return true;
  });

  // Sort by date first using Merge Sort to enable binary search on dates
  // (Direction of sort matches `sortDirection`)
  const dateSorted = mergeSort(categoryFilteredExpenses, (a, b) => {
    const factor = sortDirection === "asc" ? 1 : -1;
    return (new Date(a.date).getTime() - new Date(b.date).getTime()) * factor;
  });

  // Use Binary Search for Date Range filtering if active
  let dateFilteredExpenses = dateSorted;
  const isBinarySearchActive = !!(filterStartDate || filterEndDate);

  if (isBinarySearchActive) {
    let startIdx = 0;
    let endIdx = dateSorted.length - 1;

    if (sortDirection === "asc") {
      // Ascending (Oldest First): arr[mid].date is sorted oldest to newest
      if (filterStartDate) {
        startIdx = findFirstOnOrAfterAsc(dateSorted, filterStartDate);
      }
      if (filterEndDate) {
        endIdx = findLastOnOrBeforeAsc(dateSorted, filterEndDate);
      }
    } else {
      // Descending (Newest First): arr[mid].date is sorted newest to oldest
      if (filterStartDate) {
        endIdx = findLastOnOrAfterDesc(dateSorted, filterStartDate);
      }
      if (filterEndDate) {
        startIdx = findFirstOnOrBeforeDesc(dateSorted, filterEndDate);
      }
    }

    if (startIdx <= endIdx && startIdx >= 0 && endIdx < dateSorted.length) {
      dateFilteredExpenses = dateSorted.slice(startIdx, endIdx + 1);
    } else {
      dateFilteredExpenses = [];
    }
  }

  // Final SORTING Engine using manual MERGE SORT (if user sorted by other fields)
  // Since we already sorted by date, we can skip sorting if sortBy === "date"
  const compareExpenses = (a: Expense, b: Expense): number => {
    const factor = sortDirection === "asc" ? 1 : -1;
    if (sortBy === "amount") {
      return (a.amount - b.amount) * factor;
    } else if (sortBy === "category") {
      return a.category.localeCompare(b.category) * factor;
    } else if (sortBy === "title") {
      return a.description.localeCompare(b.description) * factor;
    }
    return 0;
  };

  const sortedExpenses = sortBy === "date" ? dateFilteredExpenses : mergeSort(dateFilteredExpenses, compareExpenses); // [DSA] Stable O(N log N) Merge Sort for ledger sorting

  // Group sortedExpenses by date
  const uniqueDates: string[] = [];
  const groupedExpenses: { [key: string]: Expense[] } = {};

  for (const exp of sortedExpenses) {
    const dStr = exp.date;
    if (!groupedExpenses[dStr]) {
      groupedExpenses[dStr] = [];
      uniqueDates.push(dStr);
    }
    groupedExpenses[dStr].push(exp);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8" id="transaction-history-page">
      {/* Undo Toast */}
      <AnimatePresence>
        {showUndoToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 flex items-center justify-between gap-5 px-5 py-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl min-w-[320px] max-w-sm"
          >
            <div className="flex flex-col">
              <p className="text-xs font-semibold text-gray-400">Transaction deleted</p>
              <p className="text-sm font-bold text-white truncate max-w-[200px] mt-0.5">{undoItemName}</p>
            </div>
            <button
              onClick={handleUndoDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-xs font-extrabold rounded-xl transition-all cursor-pointer"
            >
              <Undo2 className="h-3.5 w-3.5 font-bold" />
              <span>Undo</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col gap-1 shrink-0">
          <span className="text-[10px] text-gray-500 font-mono font-extrabold tracking-wider uppercase">
            Dedicated Transactions Ledger
          </span>
          <div className="relative inline-flex items-center gap-1 cursor-pointer">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-transparent text-2xl font-black text-white pr-8 outline-none cursor-pointer focus:ring-0 focus:border-transparent select-none font-sans"
              id="history-month-select"
            >
              {monthsOf2026.map((m) => (
                <option key={m.value} value={m.value} className="bg-gray-950 text-gray-100 text-sm font-bold">
                  {m.label}
                </option>
              ))}
            </select>
            <span className="absolute right-2 pointer-events-none text-emerald-400 text-sm">▼</span>
          </div>
        </div>

        {/* Info or Add Button */}
        <div>
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-950/40 border border-gray-800 text-gray-400 rounded-xl text-xs max-w-md">
            <Info className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="leading-relaxed">
              Transaction history ledger is in read-only view mode.
            </p>
          </div>
        </div>
      </div>

      {/* Main Ledger Content */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 flex flex-col gap-6 shadow-xl">
        <div className="border-b border-gray-800 pb-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-400" />
              Ledger Details
            </h3>
            <span className="text-[11px] text-gray-500 mt-0.5 block">
              Instant Trie Search & Manual Merge Sort sorting engine active
            </span>
          </div>

          <span className="text-[10px] font-mono bg-gray-950 border border-gray-800/80 text-emerald-400 px-3 py-1 rounded-lg self-start sm:self-center font-bold">
            DSA TRIE & MERGE-SORT ACTIVE
          </span>
        </div>

        {/* Filters Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4.5 bg-gray-950 border border-gray-800 rounded-2xl">
          {/* Trie Search Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 flex items-center gap-1">
              <Search className="h-3.5 w-3.5 text-emerald-400" />
              Trie Instant Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3.5 py-2.5 bg-gray-900 border border-gray-800 focus:border-emerald-500/50 text-xs text-gray-200 rounded-xl outline-none"
              placeholder="Type title or category..."
              id="trie-search-input"
            />
          </div>

          {/* Filter Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-emerald-400" />
              Category Filter
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3.5 py-2.5 bg-gray-900 border border-gray-800 focus:border-emerald-500/50 text-xs text-gray-200 rounded-xl outline-none cursor-pointer"
              id="category-filter-select"
            >
              <option value="all">All Categories</option>
              <option value="food">Food & Dining</option>
              <option value="transport">Transport</option>
              <option value="shopping">Shopping</option>
              <option value="entertainment">Entertainment</option>
              <option value="emergency">Emergency</option>
              <option value="utilities">Utilities</option>
              <option value="income">Income</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400">Date Range Start</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="px-3.5 py-2 bg-gray-900 border border-gray-800 focus:border-emerald-500/50 text-xs text-gray-200 rounded-xl outline-none"
            />
          </div>

          {/* Date Range End */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400">Date Range End</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="px-3.5 py-2 bg-gray-900 border border-gray-800 focus:border-emerald-500/50 text-xs text-gray-200 rounded-xl outline-none"
            />
          </div>
        </div>

        {/* Sorting Options Dropdown */}
        <div className="flex flex-wrap gap-3 items-center justify-between text-xs bg-gray-950/30 p-3 rounded-xl border border-gray-800/65">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-semibold">Sort History By:</span>
            <select
              value={`${sortBy}-${sortDirection}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split("-") as [any, any];
                setSortBy(field);
                setSortDirection(direction);
              }}
              className="px-3 py-1.5 bg-gray-950 border border-gray-800 focus:border-emerald-500/50 text-xs text-gray-200 rounded-lg outline-none cursor-pointer font-bold"
              id="sort-select-dropdown"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${isBinarySearchActive ? "animate-pulse" : "opacity-60"}`}></span>
              Binary Search {isBinarySearchActive ? "Active" : "Ready"}
            </span>
            <span className="text-[10px] text-gray-500 font-medium">
              Stable Merge Sort Engine
            </span>
          </div>
        </div>

        {/* Transaction Activity List grouped by date */}
        {uniqueDates.length > 0 ? (
          <div className="flex flex-col gap-2.5" id="gpay-transaction-list">
            {uniqueDates.map((dateStr) => {
              const dayExpenses = groupedExpenses[dateStr];
              const dailyExpenseSum = dayExpenses
                .filter((exp) => exp.category !== "income")
                .reduce((sum, exp) => sum + exp.amount, 0);

              return (
                <div key={dateStr} className="bg-gray-950/20 border border-gray-800/40 rounded-lg p-2.5 flex flex-col gap-1.5">
                  {/* Group Date Header */}
                  <div className="flex justify-between items-center border-b border-gray-800/20 pb-1">
                    <span className="text-[10px] font-extrabold text-gray-400 tracking-wide uppercase">
                      {formatDateGPay(dateStr)}
                    </span>
                    <span className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">
                      Daily Ledger
                    </span>
                  </div>

                  {/* List of Transactions */}
                  <div className="flex flex-col gap-0.5">
                    {dayExpenses.map((exp) => {
                      const isIncome = exp.category === "income";
                      const details = getCategoryDetails(exp.category);
                      const CategoryIcon = details.icon;

                      return (
                        <div
                          key={exp._id}
                          className="flex items-center justify-between py-1 px-2 hover:bg-gray-800/10 rounded-md transition-all border border-transparent cursor-default"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Icon container */}
                            <div className={`p-1 rounded border shrink-0 ${details.bgClass}`}>
                              <CategoryIcon className="h-3 w-3" />
                            </div>

                            {/* Transaction details (Title with Date directly underneath) */}
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-gray-100 truncate">
                                {exp.description}
                              </span>
                            </div>
                          </div>

                          {/* Amount */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className={`text-xs font-black font-mono tracking-tight ${isIncome ? "text-emerald-400" : "text-white"}`}>
                                {isIncome ? "+" : "-"}{currency}{formatIndianNumber(exp.amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Daily Expense Summary */}
                  {dailyExpenseSum > 0 && (
                    <div className="flex justify-between items-center text-[9px] font-black text-gray-500 pt-1 border-t border-gray-800/20 mt-0.5 font-mono tracking-wider">
                      <span>{getDailyExpenseLabel(dateStr)}</span>
                      <span className="text-xs text-gray-300">
                        {currency}{formatIndianNumber(dailyExpenseSum)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl bg-gray-950/20 px-6 flex flex-col items-center justify-center gap-2">
            <FileText className="h-8 w-8 text-gray-700" />
            <span className="text-xs font-bold text-gray-400">No transactions recorded yet.</span>
          </div>
        )}
      </div>

      {/* Record Expense Modal */}
      <AnimatePresence>
        {isAddExpenseOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
              id="add-expense-modal"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-emerald-400" />
                  <span className="text-base font-bold text-white">Record New Expense</span>
                </div>
                <button
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleAddExpense} className="p-6 flex flex-col gap-4">
                {addError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                {/* Description */}
                <div className="flex flex-col gap-1.5 relative">
                  <label htmlFor="expense-desc" className="text-xs font-bold text-gray-400">Description *</label>
                  <input
                    id="expense-desc"
                    type="text"
                    required
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setShowAddSuggestions(true);
                    }}
                    onFocus={() => setShowAddSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowAddSuggestions(false), 200);
                    }}
                    className="px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl focus:border-emerald-500/50 outline-none text-sm text-gray-200 font-semibold w-full"
                    placeholder="e.g. Lunch, snacks, bus ticket..."
                  />
                  {showAddSuggestions && addSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-gray-900 border border-gray-800 rounded-xl shadow-xl overflow-hidden z-50">
                      {addSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setDescription(suggestion);
                            setShowAddSuggestions(false);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-gray-800 text-sm text-gray-200 transition-colors border-b border-gray-800/50 last:border-0 cursor-pointer flex items-center gap-2"
                        >
                          <Search className="h-3.5 w-3.5 text-gray-500" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Amount */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="expense-amount" className="text-xs font-bold text-gray-400">Amount ({currency}) *</label>
                    <input
                      id="expense-amount"
                      type="number"
                      required
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl focus:border-emerald-500/50 outline-none text-sm text-gray-200 font-bold"
                      placeholder="e.g. 150"
                    />
                  </div>

                  {/* Category */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="expense-category" className="text-xs font-bold text-gray-400">Category *</label>
                    <select
                      id="expense-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl focus:border-emerald-500/50 outline-none text-sm text-gray-200 font-bold cursor-pointer"
                    >
                      <option value="food">Food & Dining</option>
                      <option value="transport">Transport</option>
                      <option value="shopping">Shopping</option>
                      <option value="entertainment">Entertainment</option>
                      <option value="emergency">Emergency</option>
                      <option value="stationery">Stationery</option>
                      <option value="other">Other / Misc</option>
                    </select>
                  </div>
                </div>

                {/* Date */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="expense-date" className="text-xs font-bold text-gray-400">Date *</label>
                  <input
                    id="expense-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl focus:border-emerald-500/50 outline-none text-sm text-gray-200 font-semibold"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddExpenseOpen(false)}
                    className="px-4.5 py-2.5 bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-xs font-black rounded-xl transition-all cursor-pointer"
                  >
                    {addLoading ? "Recording..." : "Record Transaction"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {editingExpense && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
              id="edit-expense-modal"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit className="h-5 w-5 text-emerald-400" />
                  <span className="text-base font-bold text-white">Edit Transaction Details</span>
                </div>
                <button
                  onClick={() => setEditingExpense(null)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleEditExpense} className="p-6 flex flex-col gap-4">
                {editError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-xl flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                {/* Description */}
                <div className="flex flex-col gap-1.5 relative">
                  <label htmlFor="edit-expense-desc" className="text-xs font-bold text-gray-400">Description *</label>
                  <input
                    id="edit-expense-desc"
                    type="text"
                    required
                    value={editDescription}
                    onChange={(e) => {
                      setEditDescription(e.target.value);
                      setShowEditSuggestions(true);
                    }}
                    onFocus={() => setShowEditSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowEditSuggestions(false), 200);
                    }}
                    className="px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl focus:border-emerald-500/50 outline-none text-sm text-gray-200 font-semibold w-full"
                    placeholder="e.g. Lunch, snacks, bus ticket..."
                  />
                  {showEditSuggestions && editSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-gray-900 border border-gray-800 rounded-xl shadow-xl overflow-hidden z-50">
                      {editSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setEditDescription(suggestion);
                            setShowEditSuggestions(false);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-gray-800 text-sm text-gray-200 transition-colors border-b border-gray-800/50 last:border-0 cursor-pointer flex items-center gap-2"
                        >
                          <Search className="h-3.5 w-3.5 text-gray-500" />
                          <span>{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Amount */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-expense-amount" className="text-xs font-bold text-gray-400">Amount ({currency}) *</label>
                    <input
                      id="edit-expense-amount"
                      type="number"
                      required
                      min="1"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl focus:border-emerald-500/50 outline-none text-sm text-gray-200 font-bold"
                    />
                  </div>

                  {/* Category */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="edit-expense-category" className="text-xs font-bold text-gray-400">Category *</label>
                    <select
                      id="edit-expense-category"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl focus:border-emerald-500/50 outline-none text-sm text-gray-200 font-bold cursor-pointer"
                    >
                      <option value="food">Food & Dining</option>
                      <option value="transport">Transport</option>
                      <option value="shopping">Shopping</option>
                      <option value="entertainment">Entertainment</option>
                      <option value="emergency">Emergency</option>
                      <option value="stationery">Stationery</option>
                      <option value="other">Other / Misc</option>
                    </select>
                  </div>
                </div>

                {/* Date */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="edit-expense-date" className="text-xs font-bold text-gray-400">Date *</label>
                  <input
                    id="edit-expense-date"
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl focus:border-emerald-500/50 outline-none text-sm text-gray-200 font-semibold"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-800 mt-2">
                  {/* Delete button (only if editable month) */}
                  {isCurrentMonthEditable ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(editingExpense)}
                      className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      id="delete-expense-btn"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingExpense(null)}
                      className="px-4.5 py-2.5 bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editLoading}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-xs font-black rounded-xl transition-all cursor-pointer"
                      id="submit-edit-expense-btn"
                    >
                      {editLoading ? "Saving Changes..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
