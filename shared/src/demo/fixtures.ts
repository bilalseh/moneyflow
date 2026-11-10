import type { CategoryId } from '../categories';

/** Static parts of the demo household. All amounts are USD cents. */
export const DEMO_INCOMES = [
  { id: 'inc-salary', name: 'Salary', amount: 420000, kind: 'fixed' },
  { id: 'inc-freelance', name: 'Freelance design', amount: 60000, kind: 'variable' },
] as const;

export const DEMO_FIXED_COSTS = [
  { id: 'fc-rent', name: 'Rent', categoryId: 'housing', amount: 145000, day: 1 },
  { id: 'fc-power', name: 'Electricity and water', categoryId: 'utilities', amount: 12000, day: 6 },
  { id: 'fc-net', name: 'Internet and phone', categoryId: 'utilities', amount: 6500, day: 8 },
  { id: 'fc-insurance', name: 'Car insurance', categoryId: 'insurance', amount: 9500, day: 10 },
  { id: 'fc-transit', name: 'Metro pass', categoryId: 'transport', amount: 8000, day: 2 },
] as const satisfies readonly {
  id: string;
  name: string;
  categoryId: CategoryId;
  amount: number;
  day: number;
}[];

export const DEMO_DEBTS = [
  {
    id: 'debt-card',
    name: 'Credit card',
    balance: 320000,
    aprBps: 2499,
    minPayment: 9600,
    day: 18,
  },
  { id: 'debt-car', name: 'Car loan', balance: 850000, aprBps: 690, minPayment: 26000, day: 15 },
] as const;

export const DEMO_ACCOUNTS = [
  { id: 'acc-checking', name: 'Checking', kind: 'cash', balance: 235000 },
  { id: 'acc-savings', name: 'Savings', kind: 'savings', balance: 480000 },
  { id: 'acc-emergency', name: 'Emergency fund', kind: 'emergency', balance: 650000 },
] as const;

/** Goals with target dates expressed as months from now. */
export const DEMO_GOALS = [
  {
    id: 'goal-japan',
    name: 'Trip to Japan',
    targetAmount: 400000,
    savedAmount: 125000,
    inMonths: 10,
    priority: 'high',
  },
  {
    id: 'goal-laptop',
    name: 'New laptop',
    targetAmount: 180000,
    savedAmount: 60000,
    inMonths: 6,
    priority: 'medium',
  },
  {
    id: 'goal-wedding',
    name: 'Wedding fund',
    targetAmount: 1500000,
    savedAmount: 200000,
    inMonths: 30,
    priority: 'low',
  },
] as const;

/** Monthly subscriptions: `used` seeds the subscription tracker; unset ones get flagged. */
export const DEMO_SUBSCRIPTIONS = [
  { note: 'NETFLIX.COM', amount: 1599, day: 5, used: true },
  { note: 'Spotify Premium', amount: 1099, day: 12, used: true },
  { note: 'City Gym membership', amount: 4500, day: 3, used: true },
  { note: 'iCloud storage', amount: 299, day: 20, used: true },
  { note: 'MasterClass', amount: 1500, day: 24, used: null },
  { note: 'Duolingo Plus', amount: 799, day: 27, used: null },
] as const;

/** Variable spending patterns: occurrences per month and amount range in cents. */
export const DEMO_PATTERNS: readonly {
  categoryId: CategoryId;
  perMonth: readonly [number, number];
  amount: readonly [number, number];
  notes: readonly string[];
}[] = [
  {
    categoryId: 'groceries',
    perMonth: [7, 9],
    amount: [3500, 14500],
    notes: ['Carrefour', 'Spinneys', 'Whole Foods Market', 'Corner grocery'],
  },
  {
    categoryId: 'dining',
    perMonth: [6, 10],
    amount: [1200, 6800],
    notes: ['Starbucks', 'Pizza night', 'Talabat order', 'Sushi bar', 'Bakery'],
  },
  {
    categoryId: 'transport',
    perMonth: [3, 6],
    amount: [1500, 5500],
    notes: ['Uber trip', 'Fuel station', 'Parking'],
  },
  {
    categoryId: 'shopping',
    perMonth: [2, 4],
    amount: [2500, 16000],
    notes: ['Amazon', 'IKEA', 'Zara', 'Electronics store'],
  },
  {
    categoryId: 'entertainment',
    perMonth: [1, 3],
    amount: [1500, 6000],
    notes: ['Cinema tickets', 'Concert', 'Steam game'],
  },
  { categoryId: 'health', perMonth: [0, 2], amount: [1500, 9000], notes: ['Pharmacy', 'Dentist'] },
  { categoryId: 'personal', perMonth: [0, 2], amount: [2000, 6000], notes: ['Barber', 'Sephora'] },
  {
    categoryId: 'gifts',
    perMonth: [0, 1],
    amount: [3000, 12000],
    notes: ['Birthday gift', 'Charity donation'],
  },
];

export const DEMO_SAVINGS_TRANSFER = 40000;
export const DEMO_CARD_EXTRA_PAYMENT = 15000;
