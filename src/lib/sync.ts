import { api } from "./api";

interface BackupBudget {
  month: string;
  pocketMoney: number;
  savingsGoal: number;
  allocated: {
    food: number;
    transport: number;
    shopping: number;
    entertainment: number;
    emergency: number;
    stationery: number;
    savings: number;
    other: number;
  };
}

// Save data to localStorage
export function backupData(userId: string, expenses: any[], budget?: any, month?: string) {
  if (!userId) return;

  try {
    // 1. Backup expenses
    if (expenses && Array.isArray(expenses)) {
      localStorage.setItem(`spendsmart_backup_expenses_${userId}`, JSON.stringify(expenses));
    }

    // 2. Backup budget
    if (budget && month) {
      const budgetKey = `spendsmart_backup_budgets_${userId}`;
      const existingRaw = localStorage.getItem(budgetKey);
      let budgets: BackupBudget[] = [];

      if (existingRaw) {
        try {
          budgets = JSON.parse(existingRaw);
          if (!Array.isArray(budgets)) budgets = [];
        } catch {
          budgets = [];
        }
      }

      // Filter out any older entry for the same month
      budgets = budgets.filter((b) => b.month !== month);

      budgets.push({
        month,
        pocketMoney: Number(budget.pocketMoney || 0),
        savingsGoal: Number(budget.savingsGoal || 0),
        allocated: {
          food: Number(budget.allocated?.food || 0),
          transport: Number(budget.allocated?.transport || 0),
          shopping: Number(budget.allocated?.shopping || 0),
          entertainment: Number(budget.allocated?.entertainment || 0),
          emergency: Number(budget.allocated?.emergency || 0),
          stationery: Number(budget.allocated?.stationery || 0),
          savings: Number(budget.allocated?.savings || 0),
          other: Number(budget.allocated?.other || 0),
        },
      });

      localStorage.setItem(budgetKey, JSON.stringify(budgets));
    }
  } catch (error) {
    console.error("Failed to write offline local storage backup:", error);
  }
}

// Restore backup from localStorage if server database was reset (has 0 expenses)
export async function restoreBackupIfNeeded(userId: string): Promise<boolean> {
  if (!userId) return false;

  try {
    const expensesRaw = localStorage.getItem(`spendsmart_backup_expenses_${userId}`);
    const budgetsRaw = localStorage.getItem(`spendsmart_backup_budgets_${userId}`);

    if (!expensesRaw && !budgetsRaw) return false;

    let backupExpenses: any[] = [];
    let backupBudgets: any[] = [];

    if (expensesRaw) {
      try {
        backupExpenses = JSON.parse(expensesRaw);
      } catch {}
    }

    if (budgetsRaw) {
      try {
        backupBudgets = JSON.parse(budgetsRaw);
      } catch {}
    }

    // If we have nothing to restore, skip
    if (backupExpenses.length === 0 && backupBudgets.length === 0) return false;

    // Fetch current server expenses to check if we need to restore
    const res = await api.get("/expenses");
    const serverExpenses = Array.isArray(res.data)
      ? res.data
      : (res.data && Array.isArray(res.data.data) ? res.data.data : []);

    // If server already has transactions, it's not a fresh reset. But wait!
    // What if the server is completely empty (0 transactions)?
    // That means the stateless server container was rebooted and lost the db.json file!
    if (serverExpenses.length === 0 && backupExpenses.length > 0) {
      console.log(`Stateless server database reset detected. Restoring ${backupExpenses.length} transactions and ${backupBudgets.length} monthly budgets...`);
      
      await api.post("/expenses/restore", {
        expenses: backupExpenses,
        budgets: backupBudgets,
      });

      console.log("Durable restore completed successfully!");
      return true;
    }
  } catch (error) {
    console.error("Failed to restore backup:", error);
  }

  return false;
}
