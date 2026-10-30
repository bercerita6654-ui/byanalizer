export interface DailySales {
  date: string; // YYYY-MM-DD
  txInstan: number;
  totalInstan: number;
  txReguler: number;
  totalReguler: number;
  txManual: number;
  totalManual: number;
  txAll: number;
  totalAll: number;
  dayOfWeek: string; // Senin, Selasa, etc.
}

export interface SalesOrder {
  id: string; // Kolom 1: No Nota / ID (e.g. ONL.2610.03117)
  noNota: string; // Kolom 1: No. Nota
  tglInput: string; // Kolom 2: Tgl Input (e.g. 2026-10-30 11:29:21)
  date: string; // Kolom 3: Tanggal (YYYY-MM-DD)
  noSo: string; // Kolom 4: No. SO (e.g. SO2639272)
  noPemesanan: string; // Kolom 5: No Pemesanan (e.g. 586864942941505492)
  tokoOnline: string; // Kolom 6: Nama Toko Online
  customer: string; // Kolom 6 alias for tokoOnline
  kepada: string; // Kolom 7: Kepada
  total: number; // Kolom 8: Total Nominal
  type: string; // Kolom 9: Type
  admin: string; // Kolom 10: Admin yang proses nota
  createdBy: string; // Kolom 10 alias
  sales: string; // Kolom 11: Sales
  status: string; // Kolom 13: Status (DIAMBIL, BLM DIKIRIM, etc.)
  isVoid: boolean; // Kolom 16: Void
  orderCategory: 'instan' | 'reguler' | 'manual';
}

export interface MarketingEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'promo' | 'ads' | 'livestream' | 'operational' | 'other';
  description?: string;
  budget?: number;
}

export interface SalesTarget {
  monthlyOmzet: number;
  monthlyTx: number;
}

export type ChartTab = 'trend' | 'channel' | 'comparison' | 'aov';
export type ViewTab = 'dashboard' | 'products' | 'calendar' | 'table' | 'predictions';

export interface ProductPerformance {
  sku: string;
  category: string;
  name: string;
  totalQty: number;
  unit: string;
  totalSales: number;
  brand: string;
  date?: string; // Optional raw transaction date (YYYY-MM-DD)
  imageUrl?: string; // Optional product image URL from FOTO PRODUK column
}

export const EVENT_TYPES = [
  { id: 'promo', name: 'Promo / Diskon', color: 'bg-rose-500', textClass: 'text-rose-600', bgClass: 'bg-rose-50 border-rose-100' },
  { id: 'ads', name: 'Iklan / Ads', color: 'bg-indigo-500', textClass: 'text-indigo-600', bgClass: 'bg-indigo-50 border-indigo-100' },
  { id: 'livestream', name: 'Livestream', color: 'bg-amber-500', textClass: 'text-amber-600', bgClass: 'bg-amber-50 border-amber-100' },
  { id: 'operational', name: 'Operasional', color: 'bg-emerald-500', textClass: 'text-emerald-600', bgClass: 'bg-emerald-50 border-emerald-100' },
  { id: 'other', name: 'Lainnya', color: 'bg-slate-500', textClass: 'text-slate-600', bgClass: 'bg-slate-50 border-slate-100' },
] as const;
