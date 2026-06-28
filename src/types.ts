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
export type ViewTab = 'dashboard' | 'calendar' | 'table' | 'predictions';

export const EVENT_TYPES = [
  { id: 'promo', name: 'Promo / Diskon', color: 'bg-rose-500', textClass: 'text-rose-600', bgClass: 'bg-rose-50 border-rose-100' },
  { id: 'ads', name: 'Iklan / Ads', color: 'bg-indigo-500', textClass: 'text-indigo-600', bgClass: 'bg-indigo-50 border-indigo-100' },
  { id: 'livestream', name: 'Livestream', color: 'bg-amber-500', textClass: 'text-amber-600', bgClass: 'bg-amber-50 border-amber-100' },
  { id: 'operational', name: 'Operasional', color: 'bg-emerald-500', textClass: 'text-emerald-600', bgClass: 'bg-emerald-50 border-emerald-100' },
  { id: 'other', name: 'Lainnya', color: 'bg-slate-500', textClass: 'text-slate-600', bgClass: 'bg-slate-50 border-slate-100' },
] as const;
