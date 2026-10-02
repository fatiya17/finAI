export type BudgetBucket = "needs" | "wants" | "savings" | "income";
export type TransactionType = "expense" | "income";
export type AccentColor = "blue" | "violet" | "pink" | "yellow" | "green";

export interface UserProfile {
  name: string;
  role: "mahasiswa" | "first-jobber" | "umum";
  monthlyIncome: number;
  financialGoal: string[];
  isOnboarded: boolean;
  themeMode: "light" | "dark" | "system";
  accentColor: AccentColor;
  budgetRatio: {
    needs: number;
    wants: number;
    savings: number;
  };
}

export interface CategoryItem {
  id: string;
  name: string;
  emoji: string;
  color: string;
  bucket: BudgetBucket;
  keywords: string[];
}

export interface TransactionItem {
  id: string;
  type?: TransactionType;
  title: string;
  amount: number;
  categoryId: string;
  bucket: BudgetBucket;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AppState {
  profile: UserProfile;
  categories: CategoryItem[];
  transactions: TransactionItem[];
  chats: ChatMessage[];
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: "c1", name: "Makan Harian", emoji: "🍜", color: "bg-emerald-200", bucket: "needs", keywords: ["makan", "nasi", "minum", "warteg", "sarapan", "siang", "malam", "food"] },
  { id: "c2", name: "Transportasi", emoji: "🚌", color: "bg-blue-200", bucket: "needs", keywords: ["gojek", "grab", "bensin", "angkot", "kereta", "krl", "parkir"] },
  { id: "c3", name: "Kebutuhan Kuliah/Kerja", emoji: "📚", color: "bg-slate-300", bucket: "needs", keywords: ["buku", "print", "fotokopi", "tugas", "stationery"] },
  { id: "c4", name: "Ngopi & Kafe", emoji: "☕", color: "bg-amber-200", bucket: "wants", keywords: ["kopi", "kafe", "cafe", "nongkrong", "nugas", "starbucks", "janji jiwa"] },
  { id: "c5", name: "Kuota & Hiburan", emoji: "📱", color: "bg-rose-200", bucket: "wants", keywords: ["kuota", "pulsa", "paket data", "netflix", "spotify", "nonton", "bioskop"] },
  { id: "c6", name: "Tabungan Darurat", emoji: "💰", color: "bg-violet-200", bucket: "savings", keywords: ["tabung", "darurat", "simpanan", "investasi"] },
  { id: "c7", name: "Pemasukan Tambahan", emoji: "💵", color: "bg-emerald-200", bucket: "income", keywords: ["gaji", "bonus", "thr", "dikasih", "jual", "fee", "transfer", "masuk"] }
];

export const DEFAULT_PROFILE: UserProfile = {
  name: "",
  role: "mahasiswa",
  monthlyIncome: 0,
  financialGoal: [],
  isOnboarded: false,
  themeMode: "light",
  accentColor: "blue",
  budgetRatio: { needs: 50, wants: 30, savings: 20 }
};

export const STORAGE_KEY = "finai_app_state_v1";

export function getInitialState(): AppState {
  if (typeof window === "undefined") return { profile: DEFAULT_PROFILE, categories: DEFAULT_CATEGORIES, transactions: [], chats: [] };
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse stored state", e);
    }
  }
  return { profile: DEFAULT_PROFILE, categories: DEFAULT_CATEGORIES, transactions: [], chats: [] };
}

export function saveState(state: AppState) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}
