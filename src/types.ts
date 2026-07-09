export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Budget {
  _id?: string;
  userId?: string;
  month: string; // YYYY-MM
  pocketMoney: number;
  savingsGoal: number;
  allocated: {
    food: number;
    transport: number;
    shopping: number;
    entertainment: number;
    emergency: number;
    stationery?: number;
    savings: number;
    other: number;
  };
  isNew?: boolean;
}

export interface Expense {
  _id: string;
  userId: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  note?: string;
  createdAt: string;
}
