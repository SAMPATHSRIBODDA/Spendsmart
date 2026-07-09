import { Router, Response } from "express";
import { Expense, Budget } from "./db";
import { authMiddleware, AuthenticatedRequest } from "./auth";
import { MinHeap } from "./dsa";
import { NotificationQueueManager, checkBudgetThresholds } from "./notificationQueue";

const router = Router();

// Get all expenses for current user
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const expenses = await Expense.find({ userId });
    res.json(expenses);
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new expense
router.post("/", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { amount, category, description, date, note } = req.body;

  if (!amount || !category || !description || !date) {
    res.status(400).json({ error: "Missing required fields: amount, category, description, date" });
    return;
  }

  try {
    const newExpense = await Expense.create({
      userId,
      amount: Number(amount),
      category,
      description,
      date,
      note: note || "",
    });

    // Enqueue a notification using the Queue DSA helper
    if (category === "income") {
      NotificationQueueManager.enqueueNotification(
        userId,
        "success",
        "Money Added Successfully",
        `Successfully credited ₹${amount} for "${description}".`
      );
    } else if (category === "savings") {
      NotificationQueueManager.enqueueNotification(
        userId,
        "success",
        "Savings Recorded Successfully",
        `Successfully added ₹${amount} to savings for "${description}".`
      );
    } else {
      NotificationQueueManager.enqueueNotification(
        userId,
        "success",
        "Expense Recorded Successfully",
        `Recorded expense of ₹${amount} for "${description}".`
      );
    }

    // Trigger asynchronous budget threshold checks
    checkBudgetThresholds(userId, date.substring(0, 7)).catch((err) => {
      console.error("Error checking budget thresholds:", err);
    });

    res.status(201).json({ message: "Expense added successfully", expense: newExpense });
  } catch (error) {
    console.error("Error creating expense:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Batch Restore Expenses & Budgets from local backup
router.post("/restore", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { expenses, budgets } = req.body;

  try {
    // 1. Restore Expenses
    if (Array.isArray(expenses) && expenses.length > 0) {
      const existing = await Expense.find({ userId });
      const existingKeys = new Set(existing.map(e => `${e.amount}_${e.category}_${e.description}_${e.date}`));

      for (const exp of expenses) {
        const finalDesc = exp.note && exp.note.trim() ? `${exp.description} (${exp.note.trim()})` : exp.description;
        const key = `${exp.amount}_${exp.category}_${finalDesc}_${exp.date}`;
        if (!existingKeys.has(key)) {
          await Expense.create({
            userId,
            amount: Number(exp.amount),
            category: exp.category,
            description: finalDesc,
            date: exp.date,
            note: "",
          });
        }
      }
    }

    // 2. Restore Budgets
    if (Array.isArray(budgets) && budgets.length > 0) {
      for (const b of budgets) {
        const existingB = await Budget.findOne({ userId, month: b.month });
        if (!existingB) {
          await Budget.create({
            userId,
            month: b.month,
            pocketMoney: Number(b.pocketMoney || 0),
            savingsGoal: Number(b.savingsGoal || 0),
            allocated: {
              food: Number(b.allocated?.food || 0),
              transport: Number(b.allocated?.transport || 0),
              shopping: Number(b.allocated?.shopping || 0),
              entertainment: Number(b.allocated?.entertainment || 0),
              emergency: Number(b.allocated?.emergency || 0),
              stationery: Number(b.allocated?.stationery || 0),
              savings: Number(b.allocated?.savings || 0),
              other: Number(b.allocated?.other || 0),
            }
          });
        }
      }
    }

    res.json({ success: true, message: "Local backup restored successfully!" });
  } catch (err) {
    console.error("Error restoring backup:", err);
    res.status(500).json({ error: "Failed to restore backup" });
  }
});

// Edit/Update expense
router.put("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const expenseId = req.params.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { amount, category, description, date, note } = req.body;

  if (!amount || !category || !description || !date) {
    res.status(400).json({ error: "Missing required fields for update: amount, category, description, date" });
    return;
  }

  try {
    const updated = await Expense.updateOne(
      { _id: expenseId, userId },
      {
        amount: Number(amount),
        category,
        description,
        date,
        note: note || "",
      }
    );

    if (!updated) {
      res.status(404).json({ error: "Expense not found or unauthorized" });
      return;
    }

    // Enqueue notification
    NotificationQueueManager.enqueueNotification(
      userId,
      "info",
      "Transaction Updated",
      `Successfully updated details for "${description}" (${category}).`
    );

    // Trigger asynchronous budget threshold checks
    checkBudgetThresholds(userId, date.substring(0, 7)).catch((err) => {
      console.error("Error checking budget thresholds:", err);
    });

    const updatedExpense = await Expense.findOne({ _id: expenseId, userId });
    res.json({ message: "Expense updated successfully", expense: updatedExpense });
  } catch (error) {
    console.error("Error updating expense:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete expense
router.delete("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const expenseId = req.params.id;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const expenseToDelete = await Expense.findOne({ _id: expenseId, userId });
    if (!expenseToDelete) {
      res.status(404).json({ error: "Expense not found or unauthorized" });
      return;
    }

    const deleted = await Expense.deleteOne({ _id: expenseId, userId });
    if (!deleted) {
      res.status(404).json({ error: "Expense not found or unauthorized" });
      return;
    }

    // Enqueue notification
    NotificationQueueManager.enqueueNotification(
      userId,
      "info",
      "Transaction Deleted",
      `Deleted transaction "${expenseToDelete.description}" of ₹${expenseToDelete.amount}.`
    );

    // Trigger asynchronous budget threshold checks
    checkBudgetThresholds(userId, expenseToDelete.date.substring(0, 7)).catch((err) => {
      console.error("Error checking budget thresholds:", err);
    });

    res.json({ message: "Expense deleted successfully" });
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get DSA-Sorted Expenses using Min-Heap
router.get("/sorted", authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const sortBy = (req.query.sortBy as string) || "amount"; // "amount" or "date"

  try {
    const expenses = await Expense.find({ userId });
    const heap = new MinHeap<any>();

    expenses.forEach((exp) => {
      let key = 0;
      if (sortBy === "amount") {
        key = exp.amount;
      } else if (sortBy === "date") {
        key = new Date(exp.date).getTime();
      }
      heap.insert(key, exp);
    });

    const sortedExpenses = heap.toSortedArray();
    res.json({
      algorithm: "Min-Heap Priority Queue Sorting",
      sortBy,
      count: sortedExpenses.length,
      data: sortedExpenses,
    });
  } catch (error) {
    console.error("Error sorting expenses with DSA heap:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
