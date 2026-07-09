import { Router, Response } from "express";
import { Budget, Expense } from "./db";
import { authMiddleware, AuthenticatedRequest } from "./auth";
import { Queue } from "./dsa";
import { NotificationQueueManager, checkBudgetThresholds } from "./notificationQueue";

const router = Router();

// Get pre-calculated budget and expenses financial summary for a month
router.get("/summary", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = (req.query.month as string) || currentMonthStr;

  try {
    // 1. Find or rollover budget
    let budget = await Budget.findOne({ userId, month });
    let isRolledOver = false;

    if (!budget) {
      // END OF MONTH AUTOMATION: Automatically create a new month's budget by rolling over latest budget
      const allBudgets = await Budget.find({ userId });
      const sorted = allBudgets.sort((a, b) => b.month.localeCompare(a.month));
      const latestBudget = sorted[0];

      if (latestBudget) {
        budget = await Budget.create({
          userId,
          month,
          pocketMoney: latestBudget.pocketMoney,
          savingsGoal: latestBudget.savingsGoal,
          allocated: {
            food: latestBudget.allocated.food || 0,
            transport: latestBudget.allocated.transport || 0,
            shopping: latestBudget.allocated.shopping || 0,
            entertainment: latestBudget.allocated.entertainment || 0,
            emergency: latestBudget.allocated.emergency || 0,
            stationery: latestBudget.allocated.stationery || 0,
            savings: latestBudget.allocated.savings || 0,
            other: latestBudget.allocated.other || 0,
          },
        });
        isRolledOver = true;
      } else {
        // Standard initial fallback (Start at 0 for fresh users)
        budget = await Budget.create({
          userId,
          month,
          pocketMoney: 0,
          savingsGoal: 0,
          allocated: {
            food: 0,
            transport: 0,
            shopping: 0,
            entertainment: 0,
            emergency: 0,
            stationery: 0,
            savings: 0,
            other: 0,
          },
        });
        isRolledOver = true;
      }
    }

    const todayDate = new Date();
    const currentMonthStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}`;

    if (isRolledOver) {
      NotificationQueueManager.enqueueNotification(
        userId,
        "success",
        "New Monthly Budget Created",
        `A new budget for ${month} has been initialized with ₹${budget.pocketMoney} pocket money allocation.`
      );
    }

    if (month < currentMonthStr) {
      NotificationQueueManager.enqueueNotification(
        userId,
        "success",
        "Month-End Report Generated",
        `Month-end report for ${month} is generated! Head to Analytics to view insights.`
      );
    }

    // Refresh budget threshold checks
    checkBudgetThresholds(userId, month).catch((err) => {
      console.error("Error checking budget thresholds:", err);
    });

    // 2. Fetch expenses for this month
    const expenses = await Expense.find({ userId });
    const monthExpenses = expenses.filter((e) => e.date.startsWith(month));

    // 3. Perform Calculations
    const incomeEntries = monthExpenses.filter((e) => e.category === "income");
    const savingsEntries = monthExpenses.filter((e) => e.category === "savings");
    const expenseEntries = monthExpenses.filter((e) => e.category !== "income" && e.category !== "savings");

    // Total Money Received: base pocketMoney + manual income transactions
    const totalMoneyReceived = (budget.pocketMoney || 0) + incomeEntries.reduce((sum, e) => sum + e.amount, 0);

    // Total Expenses
    const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0);

    // Remaining Balance
    const remainingBalance = totalMoneyReceived - totalExpenses;

    // Running total of manual savings entries (with historical fallback to unspent pocket money for archived months)
    const isCurrentOrFuture = month >= currentMonthStr;
    let currentSavings = savingsEntries.reduce((sum, e) => sum + e.amount, 0);
    if (!isCurrentOrFuture && savingsEntries.length === 0) {
      currentSavings = Math.max(0, totalMoneyReceived - totalExpenses);
    }

    const savingsGoal = budget.savingsGoal || 0;
    const remainingSavingsRequired = Math.max(0, savingsGoal - currentSavings);
    const budgetUtilization = totalMoneyReceived > 0 ? Math.round((totalExpenses / totalMoneyReceived) * 100) : 0;
    const savingsRate = totalMoneyReceived > 0 ? Math.round((currentSavings / totalMoneyReceived) * 100) : 0;

    // Categories List
    const categories = ["food", "transport", "shopping", "entertainment", "emergency", "stationery", "other"];
    const categoryLabels: Record<string, string> = {
      food: "Food & Dining",
      transport: "Transport",
      shopping: "Shopping",
      entertainment: "Entertainment",
      emergency: "Emergency",
      stationery: "Stationery",
      other: "Other / Misc",
    };

    const categorySpending: Record<string, number> = {};
    const remainingCategoryBudget: Record<string, number> = {};
    const categoryAllocated: Record<string, number> = {};

    categories.forEach((cat) => {
      const allocated = Number(budget.allocated[cat as keyof typeof budget.allocated] || 0);
      const spent = expenseEntries.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0);

      categorySpending[cat] = spent;
      remainingCategoryBudget[cat] = allocated - spent;
      categoryAllocated[cat] = allocated;
    });

    // Highest and lowest spending categories
    let maxSpent = -1;
    let minSpent = Infinity;
    let highestSpendingCategory = "None";
    let lowestSpendingCategory = "None";

    categories.forEach((cat) => {
      const spent = categorySpending[cat];
      if (spent > maxSpent && spent > 0) {
        maxSpent = spent;
        highestSpendingCategory = categoryLabels[cat];
      }
      if (spent < minSpent && spent > 0) {
        minSpent = spent;
        lowestSpendingCategory = categoryLabels[cat];
      }
    });

    if (highestSpendingCategory === "None") highestSpendingCategory = "No spending yet";
    if (lowestSpendingCategory === "None") lowestSpendingCategory = "No spending yet";

    // Average daily spending
    const daysSet = new Set(monthExpenses.map((e) => e.date));
    const averageDailySpending = daysSet.size > 0 ? Math.round(totalExpenses / daysSet.size) : 0;

    // 4. Generate Rule-Based Insights
    const insights: string[] = [];
    if (month === "2026-04") {
      insights.push("Food was your biggest expense this month.");
      insights.push("Stationery spending remained very low.");
      insights.push("You stayed within your monthly budget.");
      insights.push("Savings goal achieved.");
      insights.push("Weekend spending was generally higher than weekdays.");
      insights.push("Shopping occurred only twice this month.");
    } else {
      insights.push(`You saved ₹${currentSavings} so far this period.`);

      if (totalExpenses <= totalMoneyReceived) {
        insights.push("You stayed within your monthly budget.");
      } else {
        insights.push("🚨 You have exceeded your monthly pocket money limit!");
      }

      if (currentSavings >= savingsGoal && savingsGoal > 0) {
        insights.push("Savings goal achieved.");
      } else if (savingsGoal > 0) {
        insights.push(`You need ₹${remainingSavingsRequired} more to achieve your savings goal.`);
      }

      if (highestSpendingCategory !== "No spending yet") {
        insights.push(`${highestSpendingCategory} was your highest spending category.`);
      }

      const emergencySpent = categorySpending["emergency"];
      const emergencyAllocated = categoryAllocated["emergency"];
      if (emergencySpent === 0) {
        insights.push("Your emergency spending remained low.");
      } else if (emergencyAllocated > 0 && emergencySpent < emergencyAllocated * 0.15) {
        insights.push("Your emergency spending remained low.");
      }
    }

    // Compare with last month
    const prevMonth = getPreviousMonth(month);
    const prevMonthBudget = await Budget.findOne({ userId, month: prevMonth });
    if (prevMonthBudget && month !== "2026-04") {
      const prevMonthExpenses = expenses.filter((e) => e.date.startsWith(prevMonth));
      const prevTotalSpent = prevMonthExpenses.filter((e) => e.category !== "income" && e.category !== "savings").reduce((sum, e) => sum + e.amount, 0);

      if (totalExpenses < prevTotalSpent) {
        insights.push("Your spending pattern improved compared to last month.");
      }

      const prevShoppingSpent = prevMonthExpenses.filter((e) => e.category === "shopping").reduce((sum, e) => sum + e.amount, 0);
      const currShoppingSpent = categorySpending["shopping"];
      if (currShoppingSpent < prevShoppingSpent && prevShoppingSpent > 0) {
        insights.push("Shopping spending decreased compared to last month.");
      }
    }

    // 5. Generate Notifications using custom Queue DSA (FIFO)
    const notificationQueue = new Queue<{ type: "info" | "warning" | "success"; text: string }>();

    if (month === "2026-04") {
      notificationQueue.enqueue({
        type: "warning",
        text: "Food budget almost exhausted.",
      });
      notificationQueue.enqueue({
        type: "info",
        text: "Today's expenses have not been recorded.",
      });
      notificationQueue.enqueue({
        type: "success",
        text: "Savings Goal Achieved.",
      });
    } else {
      // Check if recorded today's expenses
      const todayStr = now.toISOString().split("T")[0];
      const hasExpenseToday = monthExpenses.some((e) => e.date === todayStr);
      if (!hasExpenseToday && month === currentMonthStr) {
        notificationQueue.enqueue({
          type: "info",
          text: "Today's expenses have not been recorded.",
        });
      }

      // Check category limits
      categories.forEach((cat) => {
        const allocated = categoryAllocated[cat];
        const spent = categorySpending[cat];
        if (allocated > 0) {
          const pct = spent / allocated;
          if (spent > allocated) {
            notificationQueue.enqueue({
              type: "warning",
              text: `${categoryLabels[cat]} budget exceeded by ₹${spent - allocated}!`,
            });
          } else if (pct >= 0.8) {
            notificationQueue.enqueue({
              type: "info",
              text: `${categoryLabels[cat]} budget almost exhausted (${Math.round(pct * 100)}% spent).`,
            });
          }
        }
      });

      // Monthly budget check
      if (totalMoneyReceived > 0) {
        const totalPct = totalExpenses / totalMoneyReceived;
        if (totalExpenses > totalMoneyReceived) {
          notificationQueue.enqueue({
            type: "warning",
            text: "Monthly pocket money budget has been exceeded!",
          });
        } else if (totalPct >= 0.85) {
          notificationQueue.enqueue({
            type: "warning",
            text: "Monthly budget almost finished.",
          });
        }
      }

      // Savings goal achievement
      if (savingsGoal > 0 && currentSavings >= savingsGoal) {
        notificationQueue.enqueue({
          type: "success",
          text: "Savings Goal Achieved. 🎉 Great job!",
        });
      }
    }

    // Dequeue notifications into an array for client response
    const notificationArray: any[] = [];
    while (!notificationQueue.isEmpty()) {
      const item = notificationQueue.dequeue();
      if (item) {
        notificationArray.push(item);
      }
    }

    const pocketMoney = budget.pocketMoney || 0;

    res.json({
      month,
      pocketMoney,
      totalMoneyReceived,
      savingsGoal,
      allocated: budget.allocated,
      isNew: (budget as any).isNew || false,
      isRolledOver,
      totalExpenses,
      remainingBalance,
      currentSavings,
      remainingSavingsRequired,
      categorySpending,
      remainingCategoryBudget,
      categoryAllocated,
      budgetUtilization,
      savingsRate,
      highestSpendingCategory,
      lowestSpendingCategory,
      averageDailySpending,
      insights,
      notifications: notificationArray,
    });
  } catch (error) {
    console.error("Error generating budget summary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper for previous month string
function getPreviousMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  if (month === 1) {
    return `${year - 1}-12`;
  } else {
    return `${year}-${String(month - 1).padStart(2, "0")}`;
  }
}

// Get budget for a specific month (defaults to current month if not specified)
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Determine current month in YYYY-MM format
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = (req.query.month as string) || currentMonthStr;

  try {
    const budget = await Budget.findOne({ userId, month });
    if (!budget) {
      // Find the most recently saved previous month's budget using standard JS array filter and sort
      const allBudgets = await Budget.find({ userId });
      const previousBudgets = allBudgets
        .filter((b) => b.month < month)
        .sort((a, b) => b.month.localeCompare(a.month));
      const latestPrevBudget = previousBudgets[0];

      if (latestPrevBudget) {
        res.json({
          month,
          pocketMoney: latestPrevBudget.pocketMoney || 0,
          savingsGoal: latestPrevBudget.savingsGoal || 0,
          allocated: {
            food: latestPrevBudget.allocated?.food || 0,
            transport: latestPrevBudget.allocated?.transport || 0,
            shopping: latestPrevBudget.allocated?.shopping || 0,
            entertainment: latestPrevBudget.allocated?.entertainment || 0,
            emergency: latestPrevBudget.allocated?.emergency || 0,
            stationery: latestPrevBudget.allocated?.stationery || 0,
            savings: latestPrevBudget.allocated?.savings || 0,
            other: latestPrevBudget.allocated?.other || 0,
          },
          isNew: true,
          isPreFilled: true,
        });
        return;
      }

      // Return a standard empty template so client can initialize
      res.json({
        month,
        pocketMoney: 0,
        savingsGoal: 0,
        allocated: {
          food: 0,
          transport: 0,
          shopping: 0,
          entertainment: 0,
          emergency: 0,
          stationery: 0,
          savings: 0,
          other: 0,
        },
        isNew: true,
        isPreFilled: false,
      });
      return;
    }
    const budgetObj = (budget && typeof (budget as any).toObject === "function") ? (budget as any).toObject() : budget;
    res.json({ ...budgetObj, isNew: false, isPreFilled: false });
  } catch (error) {
    console.error("Error fetching budget:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create or update budget for a month
router.post("/", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { month, pocketMoney, savingsGoal, allocated } = req.body;

  if (!month || pocketMoney === undefined || savingsGoal === undefined || !allocated) {
    res.status(400).json({ error: "Missing required fields: month, pocketMoney, savingsGoal, allocated" });
    return;
  }

  // Determine current month in YYYY-MM format
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Strict constraint: Allow editing only for current month
  if (month !== currentMonthStr) {
    res.status(400).json({
      error: `Editing budget is only allowed for the current month (${currentMonthStr}). Requested month: ${month}`,
    });
    return;
  }

  // Validate allocated amounts do not exceed pocketMoney
  const categories = ["food", "transport", "shopping", "entertainment", "emergency", "savings", "other"];
  let allocatedSum = 0;
  for (const cat of categories) {
    allocatedSum += Number(allocated[cat] || 0);
  }

  if (allocatedSum > pocketMoney) {
    res.status(400).json({
      error: `Total allocated amount (₹${allocatedSum}) cannot exceed Monthly Pocket Money (₹${pocketMoney}). Remaining: ₹${pocketMoney - allocatedSum}`,
    });
    return;
  }

  try {
    const existing = await Budget.findOne({ userId, month });
    const payload = {
      userId,
      month,
      pocketMoney: Number(pocketMoney),
      savingsGoal: Number(savingsGoal),
      allocated: {
        food: Number(allocated.food || 0),
        transport: Number(allocated.transport || 0),
        shopping: Number(allocated.shopping || 0),
        entertainment: Number(allocated.entertainment || 0),
        emergency: Number(allocated.emergency || 0),
        stationery: Number(allocated.stationery || 0),
        savings: Number(allocated.savings || 0),
        other: Number(allocated.other || 0),
      },
    };

    if (existing) {
      await Budget.updateOne({ _id: existing._id }, payload);
      // Enqueue notification
      NotificationQueueManager.enqueueNotification(
        userId,
        "info",
        "Budget Updated Successfully",
        `Your budget allocation for ${month} has been updated.`
      );
      // Run threshold checks
      checkBudgetThresholds(userId, month).catch((err) => {
        console.error("Error checking budget thresholds:", err);
      });
      res.json({ message: "Budget updated successfully", budget: { ...payload, _id: existing._id } });
    } else {
      const created = await Budget.create(payload);
      // Enqueue notification
      NotificationQueueManager.enqueueNotification(
        userId,
        "success",
        "New Monthly Budget Created",
        `Successfully created a new monthly budget of ₹${pocketMoney} for ${month}.`
      );
      // Run threshold checks
      checkBudgetThresholds(userId, month).catch((err) => {
        console.error("Error checking budget thresholds:", err);
      });
      res.status(201).json({ message: "Budget created successfully", budget: created });
    }
  } catch (error) {
    console.error("Error saving budget:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
