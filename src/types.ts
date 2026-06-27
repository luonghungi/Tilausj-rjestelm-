export interface UserProfile {
  uid: string;
  email: string;
  role: 'customer' | 'admin';
  name: string;
  phone?: string;
  createdAt: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  allergens: string[];
  price: number;
  category: string;
  imageUrl?: string;
  isSoldOut: boolean;
  createdAt: number;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export type OrderStatus = 'vastaanotettu' | 'valmistetaan' | 'valmis' | 'nouto_ok' | 'peruutettu';

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail: string;
  items: OrderItem[];
  totalPrice: number;
  pickupTimeType: 'heti' | 'kellonaika';
  pickupTimeValue?: string; // e.g., "14:30"
  additionalNotes?: string;
  status: OrderStatus;
  createdAt: number;
}
