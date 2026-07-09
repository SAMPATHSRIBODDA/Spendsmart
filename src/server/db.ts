import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import mongoose, { Schema } from "mongoose";

// Load dotenv configuration
dotenv.config();

const DB_FILE = path.join(process.cwd(), "db.json");

// Define basic models types
interface IUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  createdAt: string;
}

interface IOtp {
  _id: string;
  email: string;
  otp: string;
  type: "login" | "signup";
  expiresAt: string;
  tempData?: {
    name?: string;
    phone?: string;
  };
  createdAt: string;
}

interface IBudget {
  _id: string;
  userId: string;
  month: string; // "YYYY-MM"
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
  thresholdsFired?: {
    [category: string]: {
      p80?: boolean;
      p100?: boolean;
    };
  };
  createdAt: string;
}

interface IExpense {
  _id: string;
  userId: string;
  amount: number;
  category: string;
  description: string;
  date: string; // "YYYY-MM-DD"
  note?: string; // Optional Note
  createdAt: string;
}

interface INotification {
  _id: string;
  userId: string;
  type: "info" | "warning" | "success";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface IDatabaseSchema {
  users: IUser[];
  budgets: IBudget[];
  expenses: IExpense[];
  notifications: INotification[];
  otps: IOtp[];
}

// Check MongoDB connection availability
const MONGODB_URI = process.env.MONGODB_URI || "";
let isMongoConnected = false;

// Define Mongoose schemas
const UserMongoSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  passwordHash: { type: String },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const OTPMongoSchema = new Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  type: { type: String, required: true },
  expiresAt: { type: String, required: true },
  tempData: { type: Schema.Types.Mixed },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const BudgetMongoSchema = new Schema({
  userId: { type: String, required: true },
  month: { type: String, required: true },
  pocketMoney: { type: Number, required: true },
  savingsGoal: { type: Number, required: true },
  allocated: {
    food: { type: Number, default: 0 },
    transport: { type: Number, default: 0 },
    shopping: { type: Number, default: 0 },
    entertainment: { type: Number, default: 0 },
    emergency: { type: Number, default: 0 },
    stationery: { type: Number, default: 0 },
    savings: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },
  thresholdsFired: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const ExpenseMongoSchema = new Schema({
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: String, required: true },
  note: { type: String, default: "" },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const NotificationMongoSchema = new Schema({
  userId: { type: String, required: true },
  type: { type: String, required: true }, // "info" | "warning" | "success"
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

const UserM = mongoose.models.User || mongoose.model("User", UserMongoSchema);
const BudgetM = mongoose.models.Budget || mongoose.model("Budget", BudgetMongoSchema);
const ExpenseM = mongoose.models.Expense || mongoose.model("Expense", ExpenseMongoSchema);
const NotificationM = mongoose.models.Notification || mongoose.model("Notification", NotificationMongoSchema);
const OtpM = mongoose.models.OTP || mongoose.model("OTP", OTPMongoSchema);

// Try connecting to MongoDB. If it fails, fall back to JSON database.
export async function initDatabaseConnection(): Promise<boolean> {
  const isProduction = process.env.NODE_ENV === "production";
  const allowFallback = process.env.ALLOW_LOCAL_DB_FALLBACK === "true";

  if (!MONGODB_URI) {
    if (isProduction && !allowFallback) {
      const msg = "CRITICAL ERROR: No MONGODB_URI configured in production. Local JSON database fallback is disabled.";
      console.error("\n======================================================\n" + msg + "\n======================================================\n");
      throw new Error(msg);
    }
    console.warn("\n======================================================\n" +
                 "WARNING: No MONGODB_URI configured. Defaulting to local JSON database.\n" +
                 "======================================================\n");
    isMongoConnected = false;
    return false;
  }
  try {
    const maskedUri = MONGODB_URI.replace(/:([^@]+)@/, ":****@");
    console.log(`Connecting to MongoDB Atlas at: ${maskedUri}`);
    
    // Disable command buffering so queries fail fast if connection drops/fails
    mongoose.set("bufferCommands", false);

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000, // 15 seconds timeout to prevent false timeout fallbacks
      connectTimeoutMS: 15000,
    });
    isMongoConnected = true;
    console.log("Connected to MongoDB Atlas successfully!");
    return true;
  } catch (error: any) {
    if (isProduction && !allowFallback) {
      const msg = `CRITICAL ERROR: MongoDB Atlas connection failed in production. Local JSON database fallback is disabled. Error: ${error.message}`;
      console.error("\n======================================================\n" + msg + "\n======================================================\n");
      throw new Error(msg);
    }
    console.error("\n======================================================\n" +
                  `WARNING: MongoDB Atlas connection failed. Falling back to local JSON database.\n` +
                  `Error: ${error.message || error}\n` +
                  "======================================================\n");
    isMongoConnected = false;
    return false;
  }
}

export function getMongoConnectionStatus(): { connected: boolean; uri: string } {
  return {
    connected: isMongoConnected,
    uri: MONGODB_URI || "",
  };
}

// Convert Mongoose Document to Plain object with string _id
function transformDoc(doc: any) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  if (obj._id) {
    obj._id = obj._id.toString();
  }
  return obj;
}

function mergeNotesInExpense(item: any) {
  if (item && item.description && item.note && item.note.trim()) {
    item.description = `${item.description} (${item.note.trim()})`;
    item.note = "";
  }
  return item;
}

// Safe query sanitization to prevent CastError for invalid ObjectIds
function sanitizeQuery(query: any) {
  if (!query) return {};
  const clean = { ...query };
  if (clean._id) {
    const idStr = String(clean._id);
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(idStr);
    if (!isValidObjectId) {
      // Create a dummy ObjectId so it safe-queries to no results instead of throwing CastError
      clean._id = new mongoose.Types.ObjectId();
    }
  }
  return clean;
}

class JsonDatabase {
  private queue: Promise<any> = Promise.resolve();

  public async read(): Promise<IDatabaseSchema> {
    try {
      const content = await fs.readFile(DB_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (!parsed.notifications) {
        parsed.notifications = [];
      }
      return parsed;
    } catch (error) {
      const initialSchema: IDatabaseSchema = {
        users: [],
        budgets: [],
        expenses: [],
        notifications: [],
        otps: [],
      };
      await fs.writeFile(DB_FILE, JSON.stringify(initialSchema, null, 2), "utf-8");
      return initialSchema;
    }
  }

  public async write(data: IDatabaseSchema): Promise<void> {
    this.queue = this.queue.then(async () => {
      await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    });
    return this.queue;
  }

  public getModel<T extends keyof IDatabaseSchema>(collectionName: T) {
    const self = this;
    type ItemType = IDatabaseSchema[T][number];

    const getMongoModel = (): any => {
      if (collectionName === "users") return UserM;
      if (collectionName === "budgets") return BudgetM;
      if (collectionName === "notifications") return NotificationM;
      if (collectionName === "otps") return OtpM;
      return ExpenseM;
    };

    return {
      async find(query?: Partial<ItemType>): Promise<ItemType[]> {
        if (isMongoConnected) {
          const mModel = getMongoModel();
          const cleanQ = sanitizeQuery(query);
          const docs = await mModel.find(cleanQ);
          const results = docs.map(transformDoc);
          if (collectionName === "expenses") {
            results.forEach(mergeNotesInExpense);
          }
          return results;
        } else {
          const db = await self.read();
          const items = db[collectionName] as ItemType[];
          const filtered = !query ? items : items.filter((item: any) => {
            return Object.entries(query).every(([key, value]) => item[key] === value);
          });
          const results = filtered.map(item => ({ ...item }));
          if (collectionName === "expenses") {
            results.forEach(mergeNotesInExpense);
          }
          return results;
        }
      },

      async findOne(query: Partial<ItemType>): Promise<ItemType | null> {
        if (isMongoConnected) {
          const mModel = getMongoModel();
          const cleanQ = sanitizeQuery(query);
          const doc = await mModel.findOne(cleanQ);
          const result = transformDoc(doc);
          if (collectionName === "expenses" && result) {
            mergeNotesInExpense(result);
          }
          return result;
        } else {
          const db = await self.read();
          const items = db[collectionName] as ItemType[];
          const found = items.find((item: any) => {
            return Object.entries(query).every(([key, value]) => item[key] === value);
          });
          const result = found ? { ...found } : null;
          if (collectionName === "expenses" && result) {
            mergeNotesInExpense(result);
          }
          return result;
        }
      },

      async create(data: Omit<ItemType, "_id" | "createdAt">): Promise<ItemType> {
        if (isMongoConnected) {
          const mModel = getMongoModel();
          const doc = await mModel.create(data);
          return transformDoc(doc);
        } else {
          const db = await self.read();
          const newItem = {
            ...data,
            _id: Math.random().toString(36).substring(2, 11),
            createdAt: new Date().toISOString(),
          } as unknown as ItemType;

          (db[collectionName] as any[]).push(newItem);
          await self.write(db);
          return newItem;
        }
      },

      async updateOne(query: Partial<ItemType>, update: Partial<ItemType>): Promise<boolean> {
        if (isMongoConnected) {
          const mModel = getMongoModel();
          const cleanQ = sanitizeQuery(query);
          const res = await mModel.updateOne(cleanQ, { $set: update });
          return res.modifiedCount > 0 || res.matchedCount > 0;
        } else {
          const db = await self.read();
          const items = db[collectionName] as any[];
          const index = items.findIndex((item) => {
            return Object.entries(query).every(([key, value]) => item[key] === value);
          });

          if (index === -1) return false;

          items[index] = {
            ...items[index],
            ...update,
          };

          await self.write(db);
          return true;
        }
      },

      async deleteOne(query: Partial<ItemType>): Promise<boolean> {
        if (isMongoConnected) {
          const mModel = getMongoModel();
          const cleanQ = sanitizeQuery(query);
          const res = await mModel.deleteOne(cleanQ);
          return res.deletedCount ? res.deletedCount > 0 : false;
        } else {
          const db = await self.read();
          const items = db[collectionName] as any[];
          const index = items.findIndex((item) => {
            return Object.entries(query).every(([key, value]) => item[key] === value);
          });

          if (index === -1) return false;

          items.splice(index, 1);
          await self.write(db);
          return true;
        }
      },

      async deleteMany(query: Partial<ItemType>): Promise<number> {
        if (isMongoConnected) {
          const mModel = getMongoModel();
          const cleanQ = sanitizeQuery(query);
          const res = await mModel.deleteMany(cleanQ);
          return res.deletedCount || 0;
        } else {
          const db = await self.read();
          const items = db[collectionName] as any[];
          let count = 0;
          const remainingItems = items.filter((item) => {
            const match = Object.entries(query).every(([key, value]) => item[key] === value);
            if (match) {
              count++;
              return false;
            }
            return true;
          });
          db[collectionName] = remainingItems;
          await self.write(db);
          return count;
        }
      }
    };
  }
}

const db = new JsonDatabase();

export const User = db.getModel("users");
export const Budget = db.getModel("budgets");
export const Expense = db.getModel("expenses");
export const Notification = db.getModel("notifications");
export const OTP = db.getModel("otps");
