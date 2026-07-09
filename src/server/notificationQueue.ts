import { Queue } from "./dsa";
import { Notification, Budget, Expense, User } from "./db";
import { sendNotificationEmail } from "./mailer";

export class NotificationQueueManager {
  private static queue = new Queue<{
    userId: string;
    type: "info" | "warning" | "success";
    title: string;
    message: string;
  }>();

  private static isProcessing = false;

  // Enqueue a new notification request (FIFO)
  public static enqueueNotification(
    userId: string,
    type: "info" | "warning" | "success",
    title: string,
    message: string
  ): void {
    this.queue.enqueue({ userId, type, title, message });
    this.processQueue();
  }

  // Process elements sequentially
  private static async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (!this.queue.isEmpty()) {
        const item = this.queue.dequeue();
        if (item) {
          // Check if this notification already exists in last 30 seconds to prevent duplicates
          const thirtySecsAgo = new Date(Date.now() - 30 * 1000).toISOString();
          const existing = await Notification.findOne({
            userId: item.userId,
            title: item.title,
            message: item.message,
            createdAt: { $gte: thirtySecsAgo } as any,
          });

          if (!existing) {
            await Notification.create({
              userId: item.userId,
              type: item.type,
              title: item.title,
              message: item.message,
              read: false,
            });

            // Send notification email in background
            try {
              const user = await User.findOne({ _id: item.userId });
              if (user && user.email) {
                sendNotificationEmail(user.email, item.title, item.message, item.type).catch(e => console.error("Notification email error:", e));
              }
            } catch (err) {
              console.error("Failed to send notification email:", err);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing notification queue:", error);
    } finally {
      this.isProcessing = false;
    }
  }
}

// Check budget thresholds for warning & exceeding budget and savings goals
export async function checkBudgetThresholds(userId: string, monthStr: string): Promise<void> {
  try {
    const budget = await Budget.findOne({ userId, month: monthStr });
    if (!budget) return;

    const expenses = await Expense.find({ userId });
    const monthExpenses = expenses.filter((e) => e.date.startsWith(monthStr));
    const spendingExpenses = monthExpenses.filter((e) => e.category !== "income" && e.category !== "savings");
    const incomeExpenses = monthExpenses.filter((e) => e.category === "income");
    const savingsExpenses = monthExpenses.filter((e) => e.category === "savings");

    const categorySpending: Record<string, number> = {};
    const categories = ["food", "transport", "shopping", "entertainment", "emergency", "stationery", "other"];
    const categoryLabels: Record<string, string> = {
      food: "Food & Dining",
      transport: "Transport & Commute",
      shopping: "Shopping & Wardrobe",
      entertainment: "Entertainment & Fun",
      emergency: "Emergency Reserve",
      stationery: "Stationery & Supplies",
      other: "Miscellaneous",
    };

    categories.forEach((cat) => {
      categorySpending[cat] = 0;
    });

    spendingExpenses.forEach((exp) => {
      if (categories.includes(exp.category)) {
        categorySpending[exp.category] += exp.amount;
      }
    });

    // 1. Check category limits with persistent thresholdsFired tracking
    const thresholdsFired = {
      ...(budget.thresholdsFired || {}),
    };
    let thresholdsUpdated = false;

    categories.forEach((cat) => {
      const allocated = Number(budget.allocated[cat as keyof typeof budget.allocated] || 0);
      const spent = categorySpending[cat] || 0;
      if (allocated > 0) {
        const pct = spent / allocated;
        const catLabel = categoryLabels[cat] || cat;

        if (!thresholdsFired[cat]) {
          thresholdsFired[cat] = {};
        }

        if (spent >= allocated) {
          if (!thresholdsFired[cat].p100) {
            thresholdsFired[cat].p100 = true;
            thresholdsFired[cat].p80 = true; // Mark p80 as fired as well so we don't trigger it if they drop back and up again
            thresholdsUpdated = true;

            NotificationQueueManager.enqueueNotification(
              userId,
              "warning",
              "Budget Exceeded",
              `You've exceeded your ${catLabel} budget (₹${spent} / ₹${allocated}).`
            );
          }
        } else if (pct >= 0.8) {
          if (!thresholdsFired[cat].p80) {
            thresholdsFired[cat].p80 = true;
            thresholdsUpdated = true;

            NotificationQueueManager.enqueueNotification(
              userId,
              "warning",
              "Budget Warning Threshold",
              `You've used ${Math.round(pct * 100)}% of your ${catLabel} budget (₹${spent} / ₹${allocated}).`
            );
          }
        }
      }
    });

    if (thresholdsUpdated) {
      await Budget.updateOne({ _id: budget._id }, { thresholdsFired });
    }

    const userNotifications = await Notification.find({ userId });
    const monthNotifs = userNotifications.filter((n) => n.createdAt && n.createdAt.startsWith(monthStr));

    // 2. Monthly pocket money budget check
    const totalMoneyReceived = (budget.pocketMoney || 0) + incomeExpenses.reduce((sum, e) => sum + e.amount, 0);

    const totalExpenses = spendingExpenses.reduce((sum, e) => sum + e.amount, 0);
    if (totalMoneyReceived > 0) {
      const totalPct = totalExpenses / totalMoneyReceived;
      if (totalExpenses > totalMoneyReceived) {
        const alreadyNotified = monthNotifs.some((n) => n.title === "Pocket Money Exceeded");
        if (!alreadyNotified) {
          NotificationQueueManager.enqueueNotification(
            userId,
            "warning",
            "Pocket Money Exceeded",
            `Total monthly expenses (₹${totalExpenses}) have exceeded your pocket money budget (₹${totalMoneyReceived})!`
          );
        }
      } else if (totalPct >= 0.85) {
        const alreadyNotified = monthNotifs.some((n) => n.title === "Pocket Money High Usage");
        if (!alreadyNotified) {
          NotificationQueueManager.enqueueNotification(
            userId,
            "warning",
            "Pocket Money High Usage",
            `Total monthly expenses are at ${Math.round(totalPct * 100)}% of your pocket money budget (₹${totalMoneyReceived}).`
          );
        }
      }
    }

    // 3. Savings goal achievement
    const savingsGoal = budget.savingsGoal || 0;
    const currentSavings = savingsExpenses.reduce((sum, e) => sum + e.amount, 0);
    if (savingsGoal > 0 && currentSavings >= savingsGoal) {
      const alreadyNotified = monthNotifs.some((n) => n.title === "Savings Goal Achieved");
      if (!alreadyNotified) {
        NotificationQueueManager.enqueueNotification(
          userId,
          "success",
          "Savings Goal Achieved",
          `Congratulations! You achieved your monthly savings goal of ₹${savingsGoal} with ₹${currentSavings} saved so far!`
        );
      }
    }
  } catch (err) {
    console.error("Error in checkBudgetThresholds:", err);
  }
}
