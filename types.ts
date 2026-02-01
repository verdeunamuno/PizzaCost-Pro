export type Unit = 'Kg' | 'L' | 'Ud';

export interface IngredientCost {
  id: string;
  name: string;
  unit: Unit;
  pricePerUnit: number;
  defaultSalePrice?: number;
  showInSales?: boolean;
  currentStock?: number;
  minStock?: number;
}

export interface PizzaIngredient {
  id: string;
  name: string;
  amount: number;
  unit: Unit;
}

export interface Pizza {
  id: string;
  number: number;
  name: string;
  ingredients: PizzaIngredient[];
  salePrice?: number;
  isActive?: boolean;
}

export interface AppSettings {
  decimals: number;
  currency: string;
  glovoCommission: number;
}

export interface TicketItem {
  id: string;
  name: string;
  quantity: number;
  salePrice: number;
  costPrice: number;
  ingredients: PizzaIngredient[];
}

export interface Ticket {
  id: string;
  ticketNumber: number;
  date: string;
  items: TicketItem[];
  totalVenta: number;
  totalCosto: number;
  totalProfit: number;
  isGlovo?: boolean;
}