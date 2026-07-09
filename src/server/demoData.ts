import { Budget, Expense } from "./db";

export async function seedDemoDataForUser(userId: string) {
  // Check if user already has budgets or expenses
  const existingBudgets = await Budget.find({ userId });
  if (existingBudgets.length > 0) {
    console.log(`Demo data already exists for user ${userId}. Skipping seed.`);
    return;
  }

  console.log(`Seeding realistic college student finance demo data for user ${userId}...`);

  // 1. Seed June 2026 (Completed historical month)
  await Budget.create({
    userId,
    month: "2026-06",
    pocketMoney: 5500,
    savingsGoal: 800,
    allocated: {
      food: 2200,
      transport: 700,
      shopping: 600,
      entertainment: 600,
      emergency: 400,
      stationery: 300,
      other: 500,
      savings: 0,
    } as any
  });

  const juneExpenses = [
    { description: "College Registration Fee", amount: 180, category: "stationery", date: "2026-06-01" },
    { description: "Monthly Bus Pass", amount: 320, category: "transport", date: "2026-06-01" },
    { description: "Hostel canteen lunch", amount: 130, category: "food", date: "2026-06-02" },
    { description: "Reference Textbook", amount: 250, category: "stationery", date: "2026-06-04" },
    { description: "Campus cafe snacks", amount: 90, category: "food", date: "2026-06-05" },
    { description: "Raincoat", amount: 480, category: "shopping", date: "2026-06-06" },
    { description: "Pharmacy / Cold medicine", amount: 150, category: "emergency", date: "2026-06-07" },
    { description: "Hostel canteen dinner", amount: 140, category: "food", date: "2026-06-08" },
    { description: "Subway meal", amount: 180, category: "food", date: "2026-06-10" },
    { description: "Movie with friends", amount: 350, category: "entertainment", date: "2026-06-12" },
    { description: "Notebooks & pens", amount: 65, category: "stationery", date: "2026-06-15" },
    { description: "Auto fare", amount: 100, category: "transport", date: "2026-06-16" },
    { description: "Train ticket home", amount: 280, category: "transport", date: "2026-06-18" },
    { description: "Pizza delivery", amount: 420, category: "food", date: "2026-06-20" },
    { description: "Mobile bill recharge", amount: 249, category: "other", date: "2026-06-22" },
    { description: "Jeans from store", amount: 550, category: "shopping", date: "2026-06-24" },
    { description: "South Indian Dinner", amount: 160, category: "food", date: "2026-06-26" },
    { description: "Ice cream parlor", amount: 120, category: "entertainment", date: "2026-06-28" },
    { description: "Hostel Laundry charge", amount: 150, category: "other", date: "2026-06-29" },
    { description: "Coffee & cookies", amount: 85, category: "food", date: "2026-06-30" }
  ];

  for (const exp of juneExpenses) {
    await Expense.create({
      userId,
      amount: exp.amount,
      category: exp.category,
      description: exp.description,
      date: exp.date,
      note: ""
    });
  }

  // 2. Seed April 2026 (Completed historical month)
  await Budget.create({
    userId,
    month: "2026-04",
    pocketMoney: 6000,
    savingsGoal: 1000,
    allocated: {
      food: 2500,
      transport: 800,
      shopping: 700,
      entertainment: 700,
      emergency: 500,
      stationery: 200,
      other: 600,
      savings: 0,
    } as any
  });

  const aprilExpenses = [
    { description: "Breakfast", amount: 60, category: "food", date: "2026-04-01" },
    { description: "Lunch", amount: 120, category: "food", date: "2026-04-01" },
    { description: "Dinner", amount: 110, category: "food", date: "2026-04-01" },
    { description: "Tea", amount: 20, category: "food", date: "2026-04-02" },
    { description: "Lunch", amount: 120, category: "food", date: "2026-04-02" },
    { description: "Bus", amount: 40, category: "transport", date: "2026-04-03" },
    { description: "Lunch", amount: 120, category: "food", date: "2026-04-03" },
    { description: "Coffee", amount: 80, category: "food", date: "2026-04-04" },
    { description: "Dinner", amount: 150, category: "food", date: "2026-04-04" },
    { description: "Friends Cafe", amount: 300, category: "entertainment", date: "2026-04-05" },
    { description: "Breakfast", amount: 70, category: "food", date: "2026-04-06" },
    { description: "Lunch", amount: 120, category: "food", date: "2026-04-06" },
    { description: "Metro", amount: 60, category: "transport", date: "2026-04-07" },
    { description: "Dinner", amount: 140, category: "food", date: "2026-04-07" },
    { description: "Shampoo", amount: 220, category: "shopping", date: "2026-04-08" },
    { description: "Lunch", amount: 130, category: "food", date: "2026-04-09" },
    { description: "Tea", amount: 20, category: "food", date: "2026-04-10" },
    { description: "Auto", amount: 100, category: "transport", date: "2026-04-10" },
    { description: "Notebook", amount: 90, category: "stationery", date: "2026-04-11" },
    { description: "Lunch", amount: 120, category: "food", date: "2026-04-12" },
    { description: "Movie", amount: 350, category: "entertainment", date: "2026-04-13" },
    { description: "Breakfast", amount: 60, category: "food", date: "2026-04-14" },
    { description: "Medicines", amount: 180, category: "emergency", date: "2026-04-15" },
    { description: "Dinner", amount: 150, category: "food", date: "2026-04-16" },
    { description: "Mobile Recharge", amount: 249, category: "other", date: "2026-04-17" },
    { description: "Lunch", amount: 120, category: "food", date: "2026-04-18" },
    { description: "Ice Cream", amount: 120, category: "entertainment", date: "2026-04-18" },
    { description: "Bus", amount: 40, category: "transport", date: "2026-04-19" },
    { description: "Pen", amount: 40, category: "stationery", date: "2026-04-20" },
    { description: "Lunch", amount: 120, category: "food", date: "2026-04-21" },
    { description: "Laundry", amount: 150, category: "other", date: "2026-04-22" },
    { description: "T-Shirt", amount: 450, category: "shopping", date: "2026-04-23" },
    { description: "Coffee", amount: 70, category: "food", date: "2026-04-24" },
    { description: "Dinner", amount: 180, category: "food", date: "2026-04-25" },
    { description: "Auto", amount: 90, category: "transport", date: "2026-04-26" },
    { description: "Snacks", amount: 60, category: "food", date: "2026-04-27" },
    { description: "Lunch", amount: 130, category: "food", date: "2026-04-28" },
    { description: "Tea", amount: 20, category: "food", date: "2026-04-29" },
    { description: "Dinner", amount: 150, category: "food", date: "2026-04-30" },
    { description: "Friends Dinner", amount: 260, category: "food", date: "2026-04-31" }
  ];

  for (const exp of aprilExpenses) {
    await Expense.create({
      userId,
      amount: exp.amount,
      category: exp.category,
      description: exp.description,
      date: exp.date,
      note: ""
    });
  }

  console.log("Seeding completed successfully! Rahul Sharma's June and April 2026 transactions are ready.");
}
