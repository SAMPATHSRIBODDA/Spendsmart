import cron from "node-cron";
import { User, Budget, Expense } from "./db";
import { sendMonthlySummaryEmail } from "./mailer";

export function initCronJobs() {
  // Run on the 1st of every month at 10:00 AM (server time) for the previous month's summary
  cron.schedule("0 10 1 * *", async () => {
    console.log("[CRON] Starting monthly expense summary job...");
    try {
      const now = new Date();
      // Get the previous month by subtracting 1 from the current month
      now.setMonth(now.getMonth() - 1);
      const prevMonthStr = now.toISOString().substring(0, 7); // e.g. "2026-06"
      
      const monthName = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

      const users = await User.find();

      for (const user of users) {
        // Find budget for the previous month
        const budget = await Budget.findOne({ userId: user._id, month: prevMonthStr });
        if (!budget) continue;

        // Find all expenses for the user in the previous month
        const monthExpenses = await Expense.find({ 
          userId: user._id,
          date: { $regex: `^${prevMonthStr}` } 
        });
        
        const spendingExpenses = monthExpenses.filter((e: any) => e.category !== "income" && e.category !== "savings");
        const savingsExpenses = monthExpenses.filter((e: any) => e.category === "savings");
        
        const totalSpent = spendingExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        const actualSavings = savingsExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        const savingsGoal = budget.savingsGoal || 0;

        // Aggregate by category
        const categoryMap: Record<string, number> = {};
        spendingExpenses.forEach((e: any) => {
          categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
        });

        const categoryBreakdown = Object.keys(categoryMap).map(cat => ({
          category: cat,
          amount: categoryMap[cat]
        })).sort((a, b) => b.amount - a.amount); // Sort by highest spend

        // Send Email
        await sendMonthlySummaryEmail(
          user.email,
          user.name,
          monthName,
          totalSpent,
          savingsGoal,
          actualSavings,
          categoryBreakdown
        );
      }
      console.log("[CRON] Monthly expense summary job completed.");
    } catch (error) {
      console.error("[CRON] Error running monthly expense summary job:", error);
    }
  });

  console.log("Initialized background CRON jobs.");
}
