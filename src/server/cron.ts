import cron from "node-cron";
import { User, Budget, Expense } from "./db";
import { sendDailySummaryEmail, sendMonthlySummaryEmail } from "./mailer";

export function initCronJobs() {
  // Run every day at 8:00 PM (server time)
  cron.schedule("0 20 * * *", async () => {
    console.log("[CRON] Starting daily expense summary job...");
    try {
      const today = new Date().toISOString().split("T")[0];
      const monthStr = today.substring(0, 7);

      const users = await User.find();

      for (const user of users) {
        // Find budget for the month
        const budget = await Budget.findOne({ userId: user._id, month: monthStr });
        if (!budget) continue; // If no budget set up, skip

        // Find all expenses for the user this month
        const allExpenses = await Expense.find({ userId: user._id });
        const monthExpenses = allExpenses.filter((e: any) => e.date.startsWith(monthStr));
        
        // Find expenses for TODAY
        const todayExpenses = monthExpenses.filter((e: any) => e.date === today && e.category !== "income" && e.category !== "savings");
        
        // Calculate total spent today
        const totalSpentToday = todayExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);

        // Even if they spent 0 today, we'll send them a summary so they know they stayed within budget!

        // Calculate remaining budget
        const incomeExpenses = monthExpenses.filter((e: any) => e.category === "income");
        const spendingExpenses = monthExpenses.filter((e: any) => e.category !== "income" && e.category !== "savings");
        
        const totalMoneyReceived = (budget.pocketMoney || 0) + incomeExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        const totalExpenses = spendingExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        
        const remainingBudget = totalMoneyReceived - totalExpenses;

        // Map today's expenses for the email
        const formattedExpenses = todayExpenses.map((e: any) => ({
          category: e.category,
          amount: e.amount,
          description: e.description,
        }));

        // Send Email
        await sendDailySummaryEmail(
          user.email,
          user.name,
          totalSpentToday,
          formattedExpenses,
          remainingBudget
        );
      }
      console.log("[CRON] Daily expense summary job completed.");
    } catch (error) {
      console.error("[CRON] Error running daily expense summary job:", error);
    }
  });

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
