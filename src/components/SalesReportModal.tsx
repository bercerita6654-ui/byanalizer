import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DailySales, MarketingEvent, ProductPerformance } from '../types';
import { formatRupiah, formatNumberIndo, formatDateIndo, parseProductPerformanceCSV } from '../utils';
import { getProductsCache, setProductsCache } from '../dbCache';
import { Download, CheckCircle2, X, Calendar, FileText, Check, TrendingUp, ArrowRight, ArrowUpRight, ArrowDownRight, Layers, SlidersHorizontal } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SalesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesData: DailySales[];
  events: MarketingEvent[];
  initialReportType?: 'monthly' | 'weekly' | 'daily';
  initialSelectedWeek?: string;
}

export interface WeeklyOption {
  weekKey: string;
  startDate: string;
  endDate: string;
  label: string;
  shortLabel: string;
  days: DailySales[];
  totalSales: number;
  totalTx: number;
  totalInstan: number;
  totalReguler: number;
  totalManual: number;
  txInstan: number;
  txReguler: number;
  txManual: number;
  aov: number;
  avgDailySales: number;
  peakDay: DailySales | null;
  lowestDay: DailySales | null;
  activeDaysCount: number;
}

export interface PeriodSalesSummary {
  startDate: string;
  endDate: string;
  label: string;
  monthLabel: string;
  days: DailySales[];
  totalSales: number;
  totalTx: number;
  totalInstan: number;
  totalReguler: number;
  totalManual: number;
  txInstan: number;
  txReguler: number;
  txManual: number;
  aov: number;
  avgDailySales: number;
  peakDay: DailySales | null;
  lowestDay: DailySales | null;
  activeDaysCount: number;
}

export function getMondayOfWeekSafe(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const date = new Date(y, m, d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(y, m, diff);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}

export function getSundayOfWeekSafe(mondayStr: string): string {
  const parts = mondayStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const sunday = new Date(y, m, d + 6);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;
}

/**
 * Shifts a YYYY-MM-DD date back by N calendar months.
 * Clamps days to the month maximum if needed (e.g. 31 Aug -> 31 Jul, 31 Mar -> 28 Feb).
 * E.g., 2026-09-01 with monthsBack=1 -> 2026-08-01; with monthsBack=2 -> 2026-07-01.
 */
export function shiftDateByMonths(dateStr: string, monthsBack: number): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  let targetY = y;
  let targetM = m - monthsBack;
  while (targetM <= 0) {
    targetM += 12;
    targetY -= 1;
  }
  const maxDaysInMonth = new Date(targetY, targetM, 0).getDate();
  const targetD = Math.min(d, maxDaysInMonth);
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${targetY}-${pad(targetM)}-${pad(targetD)}`;
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthIndex = parseInt(parts[1], 10) - 1;
  const year = parts[0];
  return `${day} ${monthNames[monthIndex] || ''} ${year}`;
}

export function formatRangeWithTag(startDate: string, endDate: string, tag: string): string {
  const partsStart = startDate.split('-');
  const partsEnd = endDate.split('-');
  if (partsStart.length < 3 || partsEnd.length < 3) {
    return `${startDate} - ${endDate} (${tag})`;
  }
  const dayStart = parseInt(partsStart[2], 10);
  const monthStartIdx = parseInt(partsStart[1], 10) - 1;
  const yearStart = partsStart[0];

  const dayEnd = parseInt(partsEnd[2], 10);
  const monthEndIdx = parseInt(partsEnd[1], 10) - 1;
  const yearEnd = partsEnd[0];

  const fullMonthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  if (yearStart === yearEnd && monthStartIdx === monthEndIdx) {
    return `${dayStart} - ${dayEnd} ${fullMonthNames[monthStartIdx]} ${yearStart} (${tag})`;
  } else if (yearStart === yearEnd) {
    return `${dayStart} ${shortMonthNames[monthStartIdx]} - ${dayEnd} ${shortMonthNames[monthEndIdx]} ${yearStart} (${tag})`;
  } else {
    return `${dayStart} ${shortMonthNames[monthStartIdx]} ${yearStart} - ${dayEnd} ${shortMonthNames[monthEndIdx]} ${yearEnd} (${tag})`;
  }
}

export function formatGrowthPct(curr: number, prev: number): string {
  if (prev === 0) {
    return curr > 0 ? '+100.0%' : '0.0%';
  }
  const pct = ((curr - prev) / prev) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function computePeriodSummary(data: DailySales[], startDate: string, endDate: string): PeriodSalesSummary {
  const days = data.filter(d => d.date >= startDate && d.date <= endDate).sort((a, b) => a.date.localeCompare(b.date));
  let totalSales = 0;
  let totalTx = 0;
  let totalInstan = 0;
  let totalReguler = 0;
  let totalManual = 0;
  let txInstan = 0;
  let txReguler = 0;
  let txManual = 0;
  let peakDay: DailySales | null = null;
  let lowestDay: DailySales | null = null;

  days.forEach(d => {
    totalSales += d.totalAll;
    totalTx += d.txAll;
    totalInstan += d.totalInstan;
    totalReguler += d.totalReguler;
    totalManual += d.totalManual;
    txInstan += d.txInstan;
    txReguler += d.txReguler;
    txManual += d.txManual;

    if (!peakDay || d.totalAll > peakDay.totalAll) {
      peakDay = d;
    }
    if (d.totalAll > 0 && (!lowestDay || d.totalAll < lowestDay.totalAll)) {
      lowestDay = d;
    }
  });

  const activeDaysCount = days.length;
  const aov = totalTx > 0 ? Math.round(totalSales / totalTx) : 0;
  const avgDailySales = activeDaysCount > 0 ? Math.round(totalSales / activeDaysCount) : 0;
  const label = `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`;
  const monthLabel = formatMonthLabel(startDate.substring(0, 7));

  return {
    startDate,
    endDate,
    label,
    monthLabel,
    days,
    totalSales,
    totalTx,
    totalInstan,
    totalReguler,
    totalManual,
    txInstan,
    txReguler,
    txManual,
    aov,
    avgDailySales,
    peakDay,
    lowestDay: lowestDay || peakDay,
    activeDaysCount
  };
}

export function computeProductSummaryForPeriod(rawProducts: ProductPerformance[], startDate: string, endDate: string) {
  const periodProducts = rawProducts.filter(p => p.date && p.date >= startDate && p.date <= endDate);
  const skuMap = new Map<string, {
    sku: string;
    name: string;
    brand: string;
    category: string;
    unit: string;
    totalQty: number;
    totalSales: number;
  }>();

  periodProducts.forEach(p => {
    const key = p.sku.trim();
    const qty = p.totalQty || (p as any).qty || 0;
    const sales = p.totalSales || (p as any).sales || 0;
    const existing = skuMap.get(key);
    if (existing) {
      existing.totalQty += qty;
      existing.totalSales += sales;
      if ((!existing.brand || existing.brand === '-') && p.brand) existing.brand = p.brand;
      if ((!existing.category || existing.category === 'Lainnya') && p.category) existing.category = p.category;
    } else {
      skuMap.set(key, {
        sku: p.sku,
        name: p.name,
        brand: p.brand || '-',
        category: p.category || 'Lainnya',
        unit: p.unit || 'pcs',
        totalQty: qty,
        totalSales: sales,
      });
    }
  });

  const aggregated = Array.from(skuMap.values()).sort((a, b) => b.totalSales - a.totalSales);
  const totalSales = aggregated.reduce((sum, p) => sum + p.totalSales, 0);
  const totalQty = aggregated.reduce((sum, p) => sum + p.totalQty, 0);

  // Category map
  const catMap = new Map<string, { category: string; skuSet: Set<string>; totalQty: number; totalSales: number }>();
  aggregated.forEach(p => {
    const c = p.category || 'Lainnya';
    if (!catMap.has(c)) {
      catMap.set(c, { category: c, skuSet: new Set(), totalQty: 0, totalSales: 0 });
    }
    const item = catMap.get(c)!;
    item.skuSet.add(p.sku);
    item.totalQty += p.totalQty;
    item.totalSales += p.totalSales;
  });
  const categorySummary = Array.from(catMap.values()).sort((a, b) => b.totalSales - a.totalSales);

  // Brand map
  const brMap = new Map<string, { brand: string; skuSet: Set<string>; totalQty: number; totalSales: number }>();
  aggregated.forEach(p => {
    const b = p.brand || 'Tanpa Merk';
    if (!brMap.has(b)) {
      brMap.set(b, { brand: b, skuSet: new Set(), totalQty: 0, totalSales: 0 });
    }
    const item = brMap.get(b)!;
    item.skuSet.add(p.sku);
    item.totalQty += p.totalQty;
    item.totalSales += p.totalSales;
  });
  const brandSummary = Array.from(brMap.values()).sort((a, b) => b.totalSales - a.totalSales);

  return {
    periodProducts,
    aggregated,
    totalSales,
    totalQty,
    categorySummary,
    brandSummary
  };
}

function getPriorMonths(yearMonthStr: string): string[] {
  const [yearStr, monthStr] = yearMonthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  
  const prior1Month = month === 1 ? 12 : month - 1;
  const prior1Year = month === 1 ? year - 1 : year;
  
  const prior2Month = prior1Month === 1 ? 12 : prior1Month - 1;
  const prior2Year = prior1Month === 1 ? prior1Year - 1 : prior1Year;
  
  const pad = (num: number) => String(num).padStart(2, '0');
  return [
    `${prior1Year}-${pad(prior1Month)}`,
    `${prior2Year}-${pad(prior2Month)}`
  ];
}

function formatMonthLabel(yearMonthStr: string): string {
  if (!yearMonthStr) return '';
  const [year, month] = yearMonthStr.split('-');
  const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  if (isNaN(dateObj.getTime())) return yearMonthStr;
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(dateObj);
}

export default function SalesReportModal({ 
  isOpen, 
  onClose, 
  salesData, 
  events,
  initialReportType,
  initialSelectedWeek
}: SalesReportModalProps) {
  // Extract all available months from the dataset
  const availableMonths = useMemo(() => {
    const monthsMap = new Map<string, { yearMonth: string; label: string; totalSales: number }>();
    const sortedData = [...salesData].sort((a, b) => a.date.localeCompare(b.date));
    
    sortedData.forEach(day => {
      const parts = day.date.split('-');
      if (parts.length >= 2) {
        const yearMonth = `${parts[0]}-${parts[1]}`;
        
        const existing = monthsMap.get(yearMonth);
        if (existing) {
          existing.totalSales += day.totalAll;
        } else {
          monthsMap.set(yearMonth, { yearMonth, label: formatMonthLabel(yearMonth), totalSales: day.totalAll });
        }
      }
    });

    // Recalculate accurately
    monthsMap.forEach((val, key) => {
      val.totalSales = salesData
        .filter(day => day.date.startsWith(key))
        .reduce((sum, d) => sum + d.totalAll, 0);
    });

    return Array.from(monthsMap.values()).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  }, [salesData]);

  // Tab/Report type state
  const [reportType, setReportType] = useState<'monthly' | 'weekly' | 'daily'>('monthly');

  // Selected single date state (Daily)
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>('');

  // Weekly / Custom Range tab state
  const [weeklySelectionMode, setWeeklySelectionMode] = useState<'preset' | 'custom'>('preset');
  const [selectedWeeklyDate, setSelectedWeeklyDate] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [includeMoMComparison, setIncludeMoMComparison] = useState<boolean>(true);

  // Loaded products data state
  const [allProducts, setAllProducts] = useState<ProductPerformance[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(false);

  // Available single dates
  const availableDates = useMemo(() => {
    return [...salesData].map(day => day.date).sort((a, b) => b.localeCompare(a));
  }, [salesData]);

  // Available weeks calculated from salesData
  const availableWeeks = useMemo<WeeklyOption[]>(() => {
    if (salesData.length === 0) return [];
    
    const weekMap = new Map<string, DailySales[]>();
    const sorted = [...salesData].sort((a, b) => a.date.localeCompare(b.date));
    
    sorted.forEach(day => {
      const monday = getMondayOfWeekSafe(day.date);
      if (!weekMap.has(monday)) {
        weekMap.set(monday, []);
      }
      weekMap.get(monday)!.push(day);
    });

    const weeks: WeeklyOption[] = [];

    weekMap.forEach((days, monday) => {
      const sunday = getSundayOfWeekSafe(monday);
      const summary = computePeriodSummary(salesData, monday, sunday);
      const label = `${formatDateIndo(monday)} s/d ${formatDateIndo(sunday)}`;
      const shortLabel = `Minggu: ${formatDateIndo(monday).replace(/ \d{4}$/, '')} - ${formatDateIndo(sunday)}`;

      weeks.push({
        weekKey: monday,
        ...summary,
        label,
        shortLabel,
      });
    });

    // Sort descending so the latest week is first
    return weeks.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  }, [salesData]);

  // Initialize custom dates when availableWeeks becomes available
  useEffect(() => {
    if (availableWeeks.length > 0) {
      if (!customStartDate) {
        setCustomStartDate(availableWeeks[0].startDate);
      }
      if (!customEndDate) {
        setCustomEndDate(availableWeeks[0].endDate);
      }
    }
  }, [availableWeeks, customStartDate, customEndDate]);

  // Active range based on current mode
  const activeRange = useMemo(() => {
    if (weeklySelectionMode === 'preset') {
      const wk = availableWeeks.find(w => w.weekKey === selectedWeeklyDate) || availableWeeks[0];
      return {
        startDate: wk ? wk.startDate : '2026-09-01',
        endDate: wk ? wk.endDate : '2026-09-07',
        isPreset: true,
        label: wk ? wk.label : '1 September 2026 s/d 7 September 2026'
      };
    } else {
      const start = customStartDate || (availableWeeks[0]?.startDate || '2026-09-01');
      const end = customEndDate || (availableWeeks[0]?.endDate || '2026-09-07');
      const realStart = start <= end ? start : end;
      const realEnd = start <= end ? end : start;
      return {
        startDate: realStart,
        endDate: realEnd,
        isPreset: false,
        label: `${formatDateIndo(realStart)} s/d ${formatDateIndo(realEnd)}`
      };
    }
  }, [weeklySelectionMode, selectedWeeklyDate, customStartDate, customEndDate, availableWeeks]);

  // Comparison periods (Current vs M-1 vs M-2)
  const comparisonPeriods = useMemo(() => {
    const { startDate, endDate } = activeRange;
    const m1Start = shiftDateByMonths(startDate, 1);
    const m1End = shiftDateByMonths(endDate, 1);
    const m2Start = shiftDateByMonths(startDate, 2);
    const m2End = shiftDateByMonths(endDate, 2);

    const currSummary = computePeriodSummary(salesData, startDate, endDate);
    const m1Summary = computePeriodSummary(salesData, m1Start, m1End);
    const m2Summary = computePeriodSummary(salesData, m2Start, m2End);

    // Sales growth
    const salesGrowthM1 = m1Summary.totalSales > 0 ? ((currSummary.totalSales - m1Summary.totalSales) / m1Summary.totalSales) * 100 : 0;
    const salesGrowthM2 = m2Summary.totalSales > 0 ? ((currSummary.totalSales - m2Summary.totalSales) / m2Summary.totalSales) * 100 : 0;
    
    // Tx growth
    const txGrowthM1 = m1Summary.totalTx > 0 ? ((currSummary.totalTx - m1Summary.totalTx) / m1Summary.totalTx) * 100 : 0;
    const txGrowthM2 = m2Summary.totalTx > 0 ? ((currSummary.totalTx - m2Summary.totalTx) / m2Summary.totalTx) * 100 : 0;

    return {
      current: currSummary,
      m1: m1Summary,
      m2: m2Summary,
      m1Start,
      m1End,
      m2Start,
      m2End,
      salesGrowthM1,
      salesGrowthM2,
      txGrowthM1,
      txGrowthM2,
      m1Label: `${formatDateShort(m1Start)} - ${formatDateShort(m1End)}`,
      m2Label: `${formatDateShort(m2Start)} - ${formatDateShort(m2End)}`,
    };
  }, [activeRange, salesData]);

  // Sync initial tab and week when modal opens
  useEffect(() => {
    if (isOpen && initialReportType) {
      setReportType(initialReportType);
    }
  }, [isOpen, initialReportType]);

  useEffect(() => {
    if (isOpen && initialSelectedWeek) {
      setSelectedWeeklyDate(initialSelectedWeek);
    } else if (isOpen && availableWeeks.length > 0 && !selectedWeeklyDate) {
      setSelectedWeeklyDate(availableWeeks[0].weekKey);
    }
  }, [isOpen, initialSelectedWeek, availableWeeks, selectedWeeklyDate]);

  // Lazy fetch products when modal is open
  const fetchProductsForDailySummary = async () => {
    if (allProducts.length > 0) return;
    setIsProductsLoading(true);
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8ACyi03DJ77mANO19x_hJV82Xs8rNBBLyT9IIGc1tgYGNrv9WMufjm940iEPx4QU6Eta6T8Ekv2-X/pub?gid=68677243&single=true&output=csv';
    try {
      // Coba ambil dari cache terlebih dahulu
      const cached = await getProductsCache(url);
      if (cached && cached.length > 0) {
        setAllProducts(cached);
        setIsProductsLoading(false);
        return;
      }

      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        const parsed = parseProductPerformanceCSV(text);
        setAllProducts(parsed);
        await setProductsCache(url, parsed);
      }
    } catch (error) {
      console.error('Gagal mengambil data produk untuk ringkasan harian:', error);
    } finally {
      setIsProductsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProductsForDailySummary();
    }
  }, [isOpen]);

  // Set default selected date to latest date in dataset
  useEffect(() => {
    if (isOpen && availableDates.length > 0 && !selectedDailyDate) {
      setSelectedDailyDate(availableDates[0]);
    }
  }, [isOpen, availableDates, selectedDailyDate]);

  // Date selection options with summary amounts
  const dateOptions = useMemo(() => {
    return availableDates.map(date => {
      const salesObj = salesData.find(d => d.date === date);
      const label = `${salesObj ? salesObj.dayOfWeek : ''}, ${formatDateIndo(date)}`;
      const amount = salesObj ? formatRupiah(salesObj.totalAll) : '';
      return { date, label, amount };
    });
  }, [availableDates, salesData]);

  // Selected month state
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Selected months state for downloading
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Initialize selected months to all available months when open is triggered
  useEffect(() => {
    if (isOpen && availableMonths.length > 0) {
      setSelectedMonths(availableMonths.map(m => m.yearMonth));
    }
  }, [isOpen, availableMonths]);

  // Set default selected month to latest month in dataset
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0].yearMonth);
    }
  }, [availableMonths, selectedMonth]);

  const reportTitle = 'Laporan Evaluasi & Kinerja Penjualan Bulanan';

  // Selected Month Data
  const currentMonthData = useMemo(() => {
    if (!selectedMonth) return [];
    return salesData.filter(day => day.date.startsWith(selectedMonth)).sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedMonth, salesData]);

  // Selected Month Summary Stats
  const currentMonthSummary = useMemo(() => {
    if (currentMonthData.length === 0) return null;
    
    let totalSales = 0;
    let totalTx = 0;
    let totalInstan = 0;
    let totalReguler = 0;
    let totalManual = 0;
    let txInstan = 0;
    let txReguler = 0;
    let txManual = 0;
    let maxDaySales = -1;
    let maxDayDate = '';
    let minDaySales = Infinity;
    let minDayDate = '';

    currentMonthData.forEach(day => {
      totalSales += day.totalAll;
      totalTx += day.txAll;
      totalInstan += day.totalInstan;
      totalReguler += day.totalReguler;
      totalManual += day.totalManual;
      txInstan += day.txInstan;
      txReguler += day.txReguler;
      txManual += day.txManual;

      if (day.totalAll > maxDaySales) {
        maxDaySales = day.totalAll;
        maxDayDate = day.date;
      }
      if (day.totalAll > 0 && day.totalAll < minDaySales) {
        minDaySales = day.totalAll;
        minDayDate = day.date;
      }
    });

    const activeDays = currentMonthData.length;
    const avgDailySales = activeDays > 0 ? totalSales / activeDays : 0;
    const avgTxPerDay = activeDays > 0 ? totalTx / activeDays : 0;
    const aov = totalTx > 0 ? totalSales / totalTx : 0;

    return {
      activeDays,
      totalSales,
      totalTx,
      avgDailySales,
      avgTxPerDay,
      aov,
      maxDaySales,
      maxDayDate,
      minDaySales: minDaySales === Infinity ? 0 : minDaySales,
      minDayDate: minDayDate === '' ? '-' : minDayDate,
      channelSplit: {
        instan: { sales: totalInstan, tx: txInstan, pct: totalSales > 0 ? (totalInstan / totalSales) * 100 : 0 },
        reguler: { sales: totalReguler, tx: txReguler, pct: totalSales > 0 ? (totalReguler / totalSales) * 100 : 0 },
        manual: { sales: totalManual, tx: txManual, pct: totalSales > 0 ? (totalManual / totalSales) * 100 : 0 },
      }
    };
  }, [currentMonthData]);

  // Target achievements for the selected month (bronze: 600m, silver: 700m, gold: 800m)
  const targetAchievementsList = useMemo(() => {
    if (!currentMonthSummary) return [];
    const totalSales = currentMonthSummary.totalSales;
    
    return [
      { key: 'bronze', label: 'Bronze (600M)', target: 600000000, achieved: totalSales >= 600000000, pct: (totalSales / 600000000) * 100 },
      { key: 'silver', label: 'Silver (700M)', target: 700000000, achieved: totalSales >= 700000000, pct: (totalSales / 700000000) * 100 },
      { key: 'gold', label: 'Gold (800M)', target: 800000000, achieved: totalSales >= 800000000, pct: (totalSales / 800000000) * 100 },
    ];
  }, [currentMonthSummary]);

  // Weekly Analysis
  const weeklyAnalysis = useMemo(() => {
    if (currentMonthData.length === 0) return [];

    const weeks = [
      { id: 1, label: 'Minggu I (Tgl 01-07)', start: 1, end: 7 },
      { id: 2, label: 'Minggu II (Tgl 08-14)', start: 8, end: 14 },
      { id: 3, label: 'Minggu III (Tgl 15-21)', start: 15, end: 21 },
      { id: 4, label: 'Minggu IV & V (Tgl 22+)', start: 22, end: 31 },
    ];

    return weeks.map(week => {
      const daysInWeek = currentMonthData.filter(day => {
        const dateParts = day.date.split('-');
        if (dateParts.length >= 3) {
          const dateNum = parseInt(dateParts[2], 10);
          return dateNum >= week.start && dateNum <= week.end;
        }
        return false;
      });

      const totalSales = daysInWeek.reduce((sum, d) => sum + d.totalAll, 0);
      const totalTx = daysInWeek.reduce((sum, d) => sum + d.txAll, 0);
      const activeDays = daysInWeek.length;
      const avgSales = activeDays > 0 ? totalSales / activeDays : 0;

      return {
        ...week,
        totalSales,
        totalTx,
        activeDays,
        avgSales
      };
    });
  }, [currentMonthData]);

  // 2 Months Prior Comparison
  const priorComparison = useMemo(() => {
    if (!selectedMonth) return null;
    const [prior1Key, prior2Key] = getPriorMonths(selectedMonth);

    const getMonthStats = (key: string) => {
      const filtered = salesData.filter(d => d.date.startsWith(key));
      const totalSales = filtered.reduce((sum, d) => sum + d.totalAll, 0);
      const totalTx = filtered.reduce((sum, d) => sum + d.txAll, 0);
      const activeDays = filtered.length;
      const avgDailySales = activeDays > 0 ? totalSales / activeDays : 0;
      const aov = totalTx > 0 ? totalSales / totalTx : 0;
      
      let totalInstan = 0;
      let totalReguler = 0;
      let totalManual = 0;
      filtered.forEach(day => {
        totalInstan += day.totalInstan;
        totalReguler += day.totalReguler;
        totalManual += day.totalManual;
      });

      return {
        key,
        label: formatMonthLabel(key),
        totalSales,
        totalTx,
        activeDays,
        avgDailySales,
        aov,
        hasData: filtered.length > 0,
        channelSplit: { instan: totalInstan, reguler: totalReguler, manual: totalManual }
      };
    };

    const curStats = {
      label: formatMonthLabel(selectedMonth),
      totalSales: currentMonthSummary?.totalSales || 0,
      totalTx: currentMonthSummary?.totalTx || 0,
      activeDays: currentMonthSummary?.activeDays || 0,
      avgDailySales: currentMonthSummary?.avgDailySales || 0,
      aov: currentMonthSummary?.aov || 0,
      hasData: (currentMonthSummary?.activeDays || 0) > 0
    };

    const prior1Stats = getMonthStats(prior1Key);
    const prior2Stats = getMonthStats(prior2Key);

    // Calculate growth percentages
    const calculateGrowth = (currentVal: number, priorVal: number) => {
      if (priorVal <= 0) return 0;
      return ((currentVal - priorVal) / priorVal) * 100;
    };

    return {
      current: curStats,
      prior1: prior1Stats,
      prior2: prior2Stats,
      growthVsPrior1: prior1Stats.hasData ? calculateGrowth(curStats.totalSales, prior1Stats.totalSales) : null,
      growthVsPrior2: prior2Stats.hasData ? calculateGrowth(curStats.totalSales, prior2Stats.totalSales) : null,
      txGrowthVsPrior1: prior1Stats.hasData ? calculateGrowth(curStats.totalTx, prior1Stats.totalTx) : null,
    };
  }, [selectedMonth, salesData, currentMonthSummary]);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportStep, setExportStep] = useState<string>('');
  const [activeExportIndex, setActiveExportIndex] = useState<number>(-1);

  // Stale closure safeguard: create a ref mirroring the latest state
  const stateRef = useRef<{
    currentMonthSummary: any;
    priorComparison: any;
    weeklyAnalysis: any[];
    currentMonthData: DailySales[];
  }>({
    currentMonthSummary: null,
    priorComparison: null,
    weeklyAnalysis: [],
    currentMonthData: [],
  });

  stateRef.current = {
    currentMonthSummary,
    priorComparison,
    weeklyAnalysis,
    currentMonthData,
  };

  const executeMonthPDFDownload = async (monthLabel: string) => {
    try {
      const fileName = `Laporan Evaluasi Penjualan Bulanan (${monthLabel}).pdf`;
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const {
        currentMonthSummary: summary,
        priorComparison: comp,
        weeklyAnalysis: weekly,
        currentMonthData: data
      } = stateRef.current;

      if (!summary || !comp) {
        console.warn('Data ringkasan tidak lengkap untuk ' + monthLabel);
        return;
      }

      setExportStep(`Menyusun ${monthLabel} - Halaman 1 (Ringkasan Eksekutif)...`);
      await new Promise(resolve => setTimeout(resolve, 50));

      // ==========================================
      // PAGE 1: HEADER & EXECUTIVE SUMMARY & TARGETS
      // ==========================================

      // 1. Corporate Header Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text(`LAPORAN PENJUALAN BULAN ${monthLabel.toUpperCase()}`, 14, 20);

      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(0.5);
      doc.line(14, 25, 196, 25);

      // Section 1: Ringkasan Eksekutif
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229); // Indigo 600
      doc.text('I. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)', 14, 32);

      // Draw 6 KPI boxes helper
      const drawKPIBox = (x: number, y: number, w: number, h: number, title: string, value: string, subtext: string, valueColor = [15, 23, 42]) => {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, w, h, 2, 2, 'FD');

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(title.toUpperCase(), x + 3, y + 5);

        // Value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
        if (value.length > 18) doc.setFontSize(8);
        doc.text(value, x + 3, y + 11);

        // Subtext
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(subtext, x + 3, y + 17);
      };

      const kpiW = 58;
      const kpiH = 22;
      const gap = 4;

      const latestTargetStatus = 
        summary.totalSales >= 800000000 ? '🥇 Gold Achieved' :
        summary.totalSales >= 700000000 ? '🥈 Silver Achieved' :
        summary.totalSales >= 600000000 ? '🥉 Bronze Achieved' : '❌ Target Belum Tercapai';

      drawKPIBox(14, 42, kpiW, kpiH, 'Omzet Penjualan Bulanan', formatRupiah(summary.totalSales), `Total omzet kotor bulan ${monthLabel}`, [79, 70, 229]);
      drawKPIBox(14 + kpiW + gap, 42, kpiW, kpiH, 'Volume Transaksi (Tx)', `${formatNumberIndo(summary.totalTx)} Order`, 'Total transaksi dalam bulan ini');
      drawKPIBox(14 + 2 * (kpiW + gap), 42, kpiW, kpiH, 'Rata-rata Order (AOV)', formatRupiah(summary.aov), 'Nilai belanja rata-rata per order');
      
      drawKPIBox(14, 68, kpiW, kpiH, 'Rata-rata Omzet / Hari', formatRupiah(summary.avgDailySales), `Rerata dari ${summary.activeDays} hari aktif`);
      drawKPIBox(14 + kpiW + gap, 68, kpiW, kpiH, 'Penjualan Harian Tertinggi', formatRupiah(summary.maxDaySales), `Tercapai pada tgl ${summary.maxDayDate}`, [16, 185, 129]);
      drawKPIBox(14 + 2 * (kpiW + gap), 68, kpiW, kpiH, 'Target Pencapaian Terakhir', latestTargetStatus, 'Target level bulanan berjenjang', [79, 70, 229]);

      // Section 2: Comparison table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text('II. PERBANDINGAN TREN OMZET (2 BULAN SEBELUMNYA)', 14, 98);

      const priorHeaders = [['Periode Bulan', 'Total Omzet Penjualan', 'Total Transaksi', 'Rata-rata / Hari', 'Nilai AOV', 'Hari Kerja']];
      const priorRows = [];
      
      if (comp.prior2.hasData) {
        priorRows.push([
          comp.prior2.label,
          formatRupiah(comp.prior2.totalSales),
          formatNumberIndo(comp.prior2.totalTx) + ' Tx',
          formatRupiah(comp.prior2.avgDailySales),
          formatRupiah(comp.prior2.aov),
          `${comp.prior2.activeDays} Hari`
        ]);
      } else {
        priorRows.push(['Riwayat data 2 bulan sebelumnya tidak ditemukan', '-', '-', '-', '-', '-']);
      }

      if (comp.prior1.hasData) {
        priorRows.push([
          comp.prior1.label,
          formatRupiah(comp.prior1.totalSales),
          formatNumberIndo(comp.prior1.totalTx) + ' Tx',
          formatRupiah(comp.prior1.avgDailySales),
          formatRupiah(comp.prior1.aov),
          `${comp.prior1.activeDays} Hari`
        ]);
      } else {
        priorRows.push(['Riwayat data bulan sebelumnya tidak ditemukan', '-', '-', '-', '-', '-']);
      }

      priorRows.push([
        comp.current.label,
        formatRupiah(comp.current.totalSales),
        formatNumberIndo(comp.current.totalTx) + ' Tx',
        formatRupiah(comp.current.avgDailySales),
        formatRupiah(comp.current.aov),
        `${comp.current.activeDays} Hari`
      ]);

      autoTable(doc, {
        head: priorHeaders,
        body: priorRows,
        startY: 103,
        theme: 'striped',
        didParseCell: function(dataCell) {
          if (dataCell.section === 'body' && dataCell.row.index === 2) {
            dataCell.cell.styles.textColor = [29, 78, 216]; // Blue font
          }
        },
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 45 },
          1: { halign: 'right', fontStyle: 'bold' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'center' }
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          valign: 'middle'
        },
        margin: { left: 14, right: 14 }
      });

      let finalY = (doc as any).lastAutoTable.finalY || 135;

      // Draw Growth Highlights
      if (comp.growthVsPrior1 !== null || comp.growthVsPrior2 !== null) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text('Sorotan Pertumbuhan (Growth Highlights):', 14, finalY + 8);

        let boxY = finalY + 11;
        let boxW = 88;
        let boxH = 15;

        if (comp.growthVsPrior1 !== null) {
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(14, boxY, boxW, boxH, 1.5, 1.5, 'FD');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(`Pertumbuhan vs Bulan Lalu (${comp.prior1.label}):`, 17, boxY + 6);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          const growth1 = comp.growthVsPrior1;
          if (growth1 >= 0) {
            doc.setTextColor(16, 185, 129); // Emerald
            doc.text(`+${growth1.toFixed(1)}% (Meningkat)`, 17, boxY + 11);
          } else {
            doc.setTextColor(239, 68, 68); // Rose
            doc.text(`${growth1.toFixed(1)}% (Menurun)`, 17, boxY + 11);
          }
        }

        if (comp.growthVsPrior2 !== null) {
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(108, boxY, boxW, boxH, 1.5, 1.5, 'FD');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(`Pertumbuhan vs 2 Bulan Lalu (${comp.prior2.label}):`, 111, boxY + 6);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          const growth2 = comp.growthVsPrior2;
          if (growth2 >= 0) {
            doc.setTextColor(79, 70, 229); // Indigo
            doc.text(`+${growth2.toFixed(1)}% (Meningkat)`, 111, boxY + 11);
          } else {
            doc.setTextColor(239, 68, 68); // Rose
            doc.text(`${growth2.toFixed(1)}% (Menurun)`, 111, boxY + 11);
          }
        }

        finalY = boxY + boxH + 5;
      }

      // Section 3: Target Bulanan Berjenjang
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text('III. EVALUASI TARGET BERJENJANG BULANAN', 14, finalY + 8);

      let targetY = finalY + 13;
      let targetW = 58;
      let targetH = 18;
      
      targetAchievementsList.forEach((lvl, idx) => {
        let tx = 14 + idx * (targetW + 4);
        
        if (lvl.achieved) {
          doc.setFillColor(240, 253, 250); // Emerald 50
          doc.setDrawColor(167, 243, 208); // Emerald 200
        } else {
          doc.setFillColor(248, 250, 252); // Slate 50
          doc.setDrawColor(226, 232, 240); // Slate 200
        }
        doc.roundedRect(tx, targetY, targetW, targetH, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(lvl.label, tx + 4, targetY + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Target: Rp ${formatNumberIndo(lvl.target)}`, tx + 4, targetY + 10);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        if (lvl.achieved) {
          doc.setTextColor(4, 120, 87); // Emerald 700 (Green)
          doc.text(`TERCAPAI (${lvl.pct.toFixed(1)}%)`, tx + 4, targetY + 15);
        } else {
          doc.setTextColor(220, 38, 38); // Red 600 (Red)
          doc.text(`TERCAPAI (${lvl.pct.toFixed(1)}%)`, tx + 4, targetY + 15);
        }
      });

      // Add MoM Growth
      if (comp.growthVsPrior1 !== null && comp.txGrowthVsPrior1 !== null) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(79, 70, 229);
        doc.text('IV. PERTUMBUHAN BULANAN (MoM GROWTH)', 14, targetY + 25);

        const drawMoMBox = (x: number, y: number, w: number, h: number, title: string, growth: number, currentVal: number, priorVal: number, isSales: boolean) => {
          const isSurplus = growth >= 0;
          const bgColor = isSurplus ? [240, 253, 244] : [255, 241, 242]; // Emerald 50 vs Rose 50
          const borderColor = isSurplus ? [187, 247, 208] : [254, 205, 211]; // Emerald 200 vs Rose 200
          const textColor = isSurplus ? [6, 78, 59] : [159, 18, 57]; // Emerald 800 vs Rose 800
          
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
          doc.roundedRect(x, y, w, h, 2, 2, 'FD');
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(title.toUpperCase(), x + 4, y + 6);
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.text((isSurplus ? '+' : '') + growth.toFixed(2) + '%', x + 4, y + 12);
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(71, 85, 105);
          doc.text(`Bulan Ini: ${isSales ? formatRupiah(currentVal) : formatNumberIndo(currentVal) + ' Tx'}`, x + 4, y + 16);
          doc.text(`Bulan Lalu: ${isSales ? formatRupiah(priorVal) : formatNumberIndo(priorVal) + ' Tx'}`, x + 4, y + 20);
        };

        const momY = targetY + 28;
        const momW = 89;
        const momH = 22;
        drawMoMBox(14, momY, momW, momH, 'PERTUMBUHAN OMZET', comp.growthVsPrior1, comp.current.totalSales, comp.prior1.totalSales, true);
        drawMoMBox(14 + momW + 4, momY, momW, momH, 'PERTUMBUHAN TRANSAKSI', comp.txGrowthVsPrior1, comp.current.totalTx, comp.prior1.totalTx, false);
      }

      // ==========================================
      // PAGE 2: WEEKLY BREAKDOWN & CHANNELS & RECOMMENDATIONS
      // ==========================================
      setExportStep(`Menyusun ${monthLabel} - Halaman 2 (Analisa Mingguan & Saluran)...`);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      doc.addPage();

      // Section IV: Weekly Performance
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text('IV. ANALISIS KINERJA MINGGUAN (WEEKLY PERFORMANCE)', 14, 26);

      const weeklyHeaders = [['Minggu Ke-', 'Total Omzet', 'Total Transaksi (Tx)', 'Rerata Omzet Harian', 'Hari Operasional', 'Estimasi Kontribusi']];
      const weeklyRows = weekly.map(week => {
        const totalMonthSales = summary.totalSales || 1;
        const contributionPct = (week.totalSales / totalMonthSales) * 100;
        return [
          week.label,
          formatRupiah(week.totalSales),
          `${formatNumberIndo(week.totalTx)} Tx`,
          formatRupiah(week.avgSales),
          `${week.activeDays} Hari`,
          `${contributionPct.toFixed(1)}%`
        ];
      });

      autoTable(doc, {
        head: weeklyHeaders,
        body: weeklyRows,
        startY: 31,
        theme: 'striped',
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 45 },
          1: { halign: 'right', fontStyle: 'bold' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'center' },
          5: { halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] }
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          valign: 'middle'
        },
        margin: { left: 14, right: 14 }
      });

      let p2Y = (doc as any).lastAutoTable.finalY || 70;

      // Section V: Sales Channel Split
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text('V. DISTRIBUSI SALURAN PENJUALAN (SALES CHANNEL SPLIT)', 14, p2Y + 8);

      let channelY = p2Y + 13;
      let channelW = 58;
      let channelH = 22;

      const splits = [
        { label: 'Instan (Kurir Instan)', sales: summary.channelSplit.instan.sales, priorSales: comp.prior1.channelSplit.instan, tx: summary.channelSplit.instan.tx, pct: summary.channelSplit.instan.pct, bg: [240, 253, 244], border: [187, 247, 208], text: [21, 128, 61] },
        { label: 'Reguler (Ekspedisi)', sales: summary.channelSplit.reguler.sales, priorSales: comp.prior1.channelSplit.reguler, tx: summary.channelSplit.reguler.tx, pct: summary.channelSplit.reguler.pct, bg: [239, 246, 255], border: [191, 219, 254], text: [29, 78, 216] },
        { label: 'Manual (Offline/Custom)', sales: summary.channelSplit.manual.sales, priorSales: comp.prior1.channelSplit.manual, tx: summary.channelSplit.manual.tx, pct: summary.channelSplit.manual.pct, bg: [255, 251, 235], border: [253, 242, 175], text: [180, 83, 9] }
      ];

      splits.forEach((split, idx) => {
        let cx = 14 + idx * (channelW + 4);
        doc.setFillColor(split.bg[0], split.bg[1], split.bg[2]);
        doc.setDrawColor(split.border[0], split.border[1], split.border[2]);
        doc.roundedRect(cx, channelY, channelW, channelH, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(split.text[0], split.text[1], split.text[2]);
        doc.text(split.label, cx + 3, channelY + 5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(formatRupiah(split.sales), cx + 3, channelY + 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`${split.tx} Tx (${split.pct.toFixed(1)}%)`, cx + 3, channelY + 16);
        doc.text(`vs Bln Lalu: ${formatRupiah(split.priorSales)}`, cx + 3, channelY + 20);
      });

      // Section VII: Strategic Recommendations
      let recY = channelY + channelH + 6;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, recY, 182, 30, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('VII. ANALISIS & REKOMENDASI (berdasarkan AI)', 18, recY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);

      const primaryChannel = summary.channelSplit.instan.pct > 40 ? 'Instan' : 'Reguler';
      
      const recText1 = `1. Kinerja omzet bulan ini didorong secara signifikan oleh penjualan melalui saluran ${primaryChannel}. Disarankan untuk terus memberikan promo voucher khusus untuk meningkatkan volume transaksi.`;
      const recText2 = `2. Rekomendasi operasional: Alokasikan sumber daya logistik ekstra pada hari-hari sibuk (terutama hari kerja aktif) untuk meminimalkan waktu pemrosesan dan menjaga loyalitas pelanggan setia.`;
      const recText3 = `3. Optimasi pada periode promo Double Date 6.6, 7.7, 8.8, dst, terbukti efektif meningkatkan trafik.`;

      const lines = doc.splitTextToSize(`${recText1}\n${recText2}\n${recText3}`, 174);

      let textY = recY + 12;
      lines.forEach((l: string) => {
        doc.text(l, 18, textY);
        textY += 4.2;
      });

      // Chart: Performance by Day of Week
      const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      const salesByDay: Record<string, number> = {};
      const txByDay: Record<string, number> = {};
      daysOfWeek.forEach(d => {
          salesByDay[d] = 0;
          txByDay[d] = 0;
      });
      data.forEach(d => {
          if (salesByDay[d.dayOfWeek] !== undefined) {
              salesByDay[d.dayOfWeek] += d.totalAll;
              txByDay[d.dayOfWeek] += d.txAll;
          }
      });

      const chartY = recY + 35;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('TOTAL PERFORMA PENJUALAN BERDASARKAN HARI', 14, chartY);

      const barMaxWidth = 110;
      const maxSales = Math.max(...Object.values(salesByDay), 1);
      let barY = chartY + 8;
      daysOfWeek.forEach(day => {
          const sales = salesByDay[day];
          const width = (sales / maxSales) * barMaxWidth;
          doc.setFillColor(79, 70, 229); // Indigo 600
          doc.rect(40, barY, width, 4, 'F');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(71, 85, 105);
          doc.text(day, 14, barY + 3.5);
          doc.text(formatRupiah(sales), 40 + width + 2, barY + 3.5);
          barY += 7;
      });

      // Add transaction ranking
      const txStatsY = barY + 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('Peringkat Hari Berdasarkan Volume Transaksi:', 14, txStatsY);
      
      const sortedDays = Object.entries(txByDay).sort((a, b) => b[1] - a[1]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      sortedDays.forEach((dayTx, index) => {
          doc.text(`${index + 1}. ${dayTx[0]}: ${formatNumberIndo(dayTx[1])} Tx`, 14, txStatsY + 5 + (index * 4));
      });

      // ==========================================
      // PAGE 3+: DETAILED DAILY SALES TRANSACTIONS LIST
      // ==========================================
      setExportStep(`Menyusun ${monthLabel} - Halaman Rincian Transaksi Harian...`);
      await new Promise(resolve => setTimeout(resolve, 50));

      doc.addPage();

      const dailyHeaders = [['Tanggal', 'Hari', 'Omzet Instan', 'Omzet Reguler', 'Omzet Manual', 'Omzet Total', 'Tx Total', 'Event / Kampanye']];
      const dailyRows = data.map(day => {
        const dayEvents = events.filter(e => e.date === day.date);
        const eventTitles = dayEvents.map(e => e.title).join(', ');
        
        let holidayInfo = '';
        // Add hardcoded holiday checks for Bali/National
        // This is a simplified approach based on the request
        const holidayMap: Record<string, string> = {
          '2026-03-29': 'Nyepi',
          '2026-04-01': 'Galungan',
          '2026-04-11': 'Kuningan',
          '2026-06-01': 'Hari Lahir Pancasila',
          '2026-06-10': 'Galungan',
          '2026-06-20': 'Kuningan'
        };
        if (holidayMap[day.date]) {
          holidayInfo = `[Libur: ${holidayMap[day.date]}] `;
        }
        
        return [
          day.date,
          day.dayOfWeek,
          formatRupiah(day.totalInstan),
          formatRupiah(day.totalReguler),
          formatRupiah(day.totalManual),
          formatRupiah(day.totalAll),
          `${day.txAll} Tx`,
          `${holidayInfo}${eventTitles || '-'}`
        ];
      });

      autoTable(doc, {
        head: dailyHeaders,
        body: dailyRows,
        startY: 28,
        theme: 'striped',
        didParseCell: function(dataCell) {
          if (dataCell.section === 'body') {
            const dayValue = dataCell.row.raw[1];
            if (typeof dayValue === 'string' && (dayValue.toLowerCase() === 'minggu' || dayValue.toLowerCase() === 'sunday')) {
              dataCell.cell.styles.textColor = [220, 38, 38]; // Red font for Sunday
            }
          }
        },
        headStyles: {
          fillColor: [15, 23, 42], // Slate 900
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 20 },
          1: { halign: 'left', cellWidth: 15 },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] },
          6: { halign: 'right' },
          7: { halign: 'left', cellWidth: 40 }
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2.2,
          valign: 'middle'
        },
        margin: { top: 25, bottom: 20, left: 14, right: 14 }
      });

      // ==========================================
      // POST-PROCESSING: HEADERS, FOOTERS & PAGE NUMBERS
      // ==========================================
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Draw running headers on Page 2 and Page 3+
        if (i > 1) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          
          const runningHeaderTitle = i === 2 
            ? 'IV. ANALISIS KINERJA MINGGUAN (WEEKLY PERFORMANCE)' 
            : 'VI. DAFTAR RINCIAN PENJUALAN HARIAN';
            
          doc.text(runningHeaderTitle, 14, 15);
          doc.text(`Periode: ${monthLabel}`, 196 - doc.getTextWidth(`Periode: ${monthLabel}`), 15);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.line(14, 18, 196, 18);
        }

        // Draw footers on ALL pages
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`${reportTitle} - Periode ${monthLabel}`, 14, 287);

        const pageStr = `Halaman ${i} dari ${totalPages}`;
        doc.text(pageStr, doc.internal.pageSize.width - 14 - doc.getTextWidth(pageStr), 287);
      }

      setExportStep(`Mengunduh PDF ${monthLabel}...`);
      doc.save(fileName);
    } catch (error) {
      console.error(`Gagal menghasilkan PDF untuk ${monthLabel}:`, error);
    }
  };

  // Generate Daily Executive Summary PDF
  const executeDailyPDFDownload = async (dateStr: string) => {
    try {
      setIsExporting(true);
      setExportStep('Mempersiapkan data ringkasan harian...');
      await new Promise(resolve => setTimeout(resolve, 300));

      const dailySalesObj = salesData.find(d => d.date === dateStr);
      if (!dailySalesObj) {
        console.error('Data harian tidak ditemukan untuk: ' + dateStr);
        setIsExporting(false);
        return;
      }

      // Filter products for this day
      const dailyProducts = allProducts
        .filter(p => p.date === dateStr)
        .sort((a, b) => b.totalSales - a.totalSales); // Best-selling first

      const formattedDateFull = formatDateIndo(dateStr);
      const fileName = `Ringkasan_Eksekutif_Harian_${dateStr}.pdf`;

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // 1. Corporate Header Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text('RINGKASAN EKSEKUTIF PENJUALAN HARIAN', 14, 18);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229); // Indigo 600
      const dateText = `HARI & TANGGAL: ${dailySalesObj.dayOfWeek.toUpperCase()}, ${formattedDateFull.toUpperCase()}`;
      doc.text(dateText, 14, 24);

      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(0.5);
      doc.line(14, 27, 196, 27);

      // Section Title: KPI Utama
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text('I. METRIK KINERJA UTAMA (KEY PERFORMANCE INDICATORS)', 14, 34);

      // Draw 3 KPI boxes helper
      const drawKPIBox = (x: number, y: number, w: number, h: number, title: string, value: string, subtext: string, valueColor = [15, 23, 42]) => {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, w, h, 2, 2, 'FD');

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(title.toUpperCase(), x + 3, y + 4.5);

        // Value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
        doc.text(value, x + 3, y + 10.5);

        // Subtext
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(148, 163, 184);
        doc.text(subtext, x + 3, y + 15.5);
      };

      const kpiW = 58;
      const kpiH = 19;
      const gap = 4;
      const aov = dailySalesObj.txAll > 0 ? dailySalesObj.totalAll / dailySalesObj.txAll : 0;

      drawKPIBox(14, 38, kpiW, kpiH, 'Total Omzet Harian', formatRupiah(dailySalesObj.totalAll), 'Akumulasi omzet kotor hari ini', [79, 70, 229]);
      drawKPIBox(14 + kpiW + gap, 38, kpiW, kpiH, 'Volume Transaksi', `${formatNumberIndo(dailySalesObj.txAll)} Transaksi`, `Berdasarkan total order sukses`, [15, 23, 42]);
      drawKPIBox(14 + 2 * (kpiW + gap), 38, kpiW, kpiH, 'Rata-rata Keranjang (AOV)', formatRupiah(Math.round(aov)), 'Nilai rata-rata per transaksi', [244, 63, 94]);

      // Draw Holiday / Marketing Events (if any)
      const holidayMap: Record<string, string> = {
        '2026-03-29': 'Nyepi',
        '2026-04-01': 'Galungan',
        '2026-04-11': 'Kuningan',
        '2026-06-01': 'Hari Lahir Pancasila',
        '2026-06-10': 'Galungan',
        '2026-06-20': 'Kuningan'
      };
      
      const isHoliday = holidayMap[dateStr];
      const dayEvents = events.filter(e => e.date === dateStr);
      const eventText = dayEvents.map(e => e.title).join(', ');

      let nextY = 62;
      if (isHoliday || eventText) {
        doc.setFillColor(254, 243, 199); // amber 100
        doc.setDrawColor(253, 230, 138); // amber 200
        doc.setLineWidth(0.3);
        doc.roundedRect(14, nextY, 182, 10, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(146, 64, 14); // amber 800
        
        let contextMsg = '💡 Keterangan Hari Ini: ';
        if (isHoliday) contextMsg += `[Libur Nasional: ${isHoliday}] `;
        if (eventText) contextMsg += `[Event Aktif: ${eventText}]`;
        
        doc.text(contextMsg, 17, nextY + 6);
        nextY += 14;
      } else {
        nextY += 1;
      }

      // Section Title: Channel Penjualan
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text('II. KINERJA SALES CHANNEL (CHANNEL BREAKDOWN)', 14, nextY);
      nextY += 4;

      // Table for Channel Breakdown
      const channelHeaders = [['Nama Channel', 'Total Transaksi', 'Transaksi Share (%)', 'Total Omzet (Rp)', 'Omzet Share (%)']];
      
      const totalAllTx = dailySalesObj.txAll || 1;
      const totalAllSales = dailySalesObj.totalAll || 1;

      const channelRows = [
        [
          'Instan (Gojek / Grab / ShopeeFood)', 
          `${dailySalesObj.txInstan} Tx`, 
          `${((dailySalesObj.txInstan / totalAllTx) * 100).toFixed(1)}%`, 
          formatRupiah(dailySalesObj.totalInstan), 
          `${((dailySalesObj.totalInstan / totalAllSales) * 100).toFixed(1)}%`
        ],
        [
          'Reguler (Website / Aplikasi / Marketplaces)', 
          `${dailySalesObj.txReguler} Tx`, 
          `${((dailySalesObj.txReguler / totalAllTx) * 100).toFixed(1)}%`, 
          formatRupiah(dailySalesObj.totalReguler), 
          `${((dailySalesObj.totalReguler / totalAllSales) * 100).toFixed(1)}%`
        ],
        [
          'Manual (Admin WhatsApp / Kasir Toko)', 
          `${dailySalesObj.txManual} Tx`, 
          `${((dailySalesObj.txManual / totalAllTx) * 100).toFixed(1)}%`, 
          formatRupiah(dailySalesObj.totalManual), 
          `${((dailySalesObj.totalManual / totalAllSales) * 100).toFixed(1)}%`
        ],
        [
          'TOTAL AKUMULASI', 
          `${dailySalesObj.txAll} Tx`, 
          '100%', 
          formatRupiah(dailySalesObj.totalAll), 
          '100%'
        ]
      ];

      autoTable(doc, {
        head: channelHeaders,
        body: channelRows,
        startY: nextY,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 70, fontStyle: 'bold' },
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right', fontStyle: 'bold' },
          4: { halign: 'right' }
        },
        styles: {
          fontSize: 7,
          cellPadding: 1.8
        },
        didParseCell: function(cellData) {
          if (cellData.section === 'body' && cellData.row.index === 3) {
            cellData.cell.styles.fontStyle = 'bold';
            cellData.cell.styles.fillColor = [241, 245, 249]; // light gray background for total row
          }
        },
        margin: { left: 14, right: 14 }
      });

      // Get next Y position after the table
      nextY = (doc as any).lastAutoTable.finalY + 8;

      // Section Title: Best Selling Products
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text('III. RINCIAN PERFORMA PRODUK TERLARIS (BEST-SELLING PRODUCTS)', 14, nextY);
      nextY += 4;

      if (dailyProducts.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('Tidak ada data rincian transaksi produk spesifik untuk tanggal ini.', 14, nextY);
      } else {
        const productHeaders = [['Rank', 'SKU', 'Nama Produk', 'Merk', 'Kategori', 'Qty Terjual', 'Omzet Penjualan', 'Harga Rerata']];
        const productRows = dailyProducts.slice(0, 10).map((p, index) => {
          const unitPrice = p.totalQty > 0 ? Math.round(p.totalSales / p.totalQty) : 0;
          return [
            `#${index + 1}`,
            p.sku,
            p.name,
            p.brand,
            p.category,
            `${p.totalQty} ${p.unit || 'pcs'}`,
            formatRupiah(p.totalSales),
            `${formatRupiah(unitPrice)}`
          ];
        });

        autoTable(doc, {
          head: productHeaders,
          body: productRows,
          startY: nextY,
          theme: 'striped',
          headStyles: {
            fillColor: [79, 70, 229], // Indigo 600
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: 'bold'
          },
          columnStyles: {
            0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 20, fontStyle: 'bold' },
            2: { cellWidth: 50 },
            3: { cellWidth: 20 },
            4: { cellWidth: 22 },
            5: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
            6: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] },
            7: { cellWidth: 18, halign: 'right' }
          },
          styles: {
            fontSize: 6.8,
            cellPadding: 1.8
          },
          margin: { left: 14, right: 14, bottom: 20 }
        });
      }

      // Add Running Footers to Page(s)
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        
        doc.text(`Ringkasan Eksekutif Harian - Tanggal ${formattedDateFull}`, 14, 287);
        const pageStr = `Halaman ${i} dari ${totalPages}`;
        doc.text(pageStr, doc.internal.pageSize.width - 14 - doc.getTextWidth(pageStr), 287);
      }

      setExportStep(`Mengunduh PDF Ringkasan Harian...`);
      doc.save(fileName);
    } catch (err) {
      console.error('Gagal membuat ringkasan PDF harian:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Execute Consolidated Period PDF Download (Ringkasan Analitik + Analisa Produk + Perbandingan Multi-Bulan dalam 1 PDF)
  const executePeriodPDFDownload = async (startDate: string, endDate: string, compareMoM: boolean = true) => {
    const realStart = startDate <= endDate ? startDate : endDate;
    const realEnd = startDate <= endDate ? endDate : startDate;

    setIsExporting(true);
    setExportStep(`Mempersiapkan data periode (${formatDateShort(realStart)} s/d ${formatDateShort(realEnd)})...`);

    try {
      // Calculate period summaries
      const currSummary = computePeriodSummary(salesData, realStart, realEnd);
      const m1Start = shiftDateByMonths(realStart, 1);
      const m1End = shiftDateByMonths(realEnd, 1);
      const m1Summary = computePeriodSummary(salesData, m1Start, m1End);

      const m2Start = shiftDateByMonths(realStart, 2);
      const m2End = shiftDateByMonths(realEnd, 2);
      const m2Summary = computePeriodSummary(salesData, m2Start, m2End);

      // Ensure product data is loaded
      let productsList = allProducts;
      if (productsList.length === 0) {
        setExportStep('Mengunduh rincian data produk...');
        const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8ACyi03DJ77mANO19x_hJV82Xs8rNBBLyT9IIGc1tgYGNrv9WMufjm940iEPx4QU6Eta6T8Ekv2-X/pub?gid=68677243&single=true&output=csv';
        const cached = await getProductsCache(url);
        if (cached && cached.length > 0) {
          productsList = cached;
          setAllProducts(cached);
        } else {
          const resp = await fetch(url);
          if (resp.ok) {
            const txt = await resp.text();
            productsList = parseProductPerformanceCSV(txt);
            setAllProducts(productsList);
            await setProductsCache(url, productsList);
          }
        }
      }

      setExportStep('Menghitung agregasi performa & komparasi produk multi-bulan...');
      const currProd = computeProductSummaryForPeriod(productsList, realStart, realEnd);
      const m1Prod = computeProductSummaryForPeriod(productsList, m1Start, m1End);
      const m2Prod = computeProductSummaryForPeriod(productsList, m2Start, m2End);

      // Map M-1 and M-2 category & brand for easy lookup
      const m1CatMap = new Map<string, number>(m1Prod.categorySummary.map(c => [c.category, c.totalSales]));
      const m2CatMap = new Map<string, number>(m2Prod.categorySummary.map(c => [c.category, c.totalSales]));
      const m1BrandMap = new Map<string, number>(m1Prod.brandSummary.map(b => [b.brand, b.totalSales]));
      const m2BrandMap = new Map<string, number>(m2Prod.brandSummary.map(b => [b.brand, b.totalSales]));

      setExportStep('Menyusun tata letak PDF terpadu & komparasi...');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const fileName = `Laporan_Penjualan_Terpadu_${realStart}_sd_${realEnd}.pdf`;

      // Helper for drawing KPI box
      const drawKPI = (x: number, y: number, w: number, h: number, title: string, value: string, subtext: string, color: [number, number, number]) => {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, w, h, 2, 2, 'FD');

        // Color accent strip on left
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(x, y + 1.5, 1.2, h - 3, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(100, 116, 139);
        doc.text(title.toUpperCase(), x + 3, y + 4);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(value, x + 3, y + 9.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.3);
        doc.setTextColor(148, 163, 184);
        doc.text(subtext, x + 3, y + 13.2);
      };

      // ==========================================
      // PAGE 1: RINGKASAN ANALITIK & KOMPARASI MULTI-BULAN
      // ==========================================
      // Top header banner
      doc.setFillColor(79, 70, 229); // Indigo 600
      doc.rect(14, 12, 182, 18, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text('LAPORAN PENJUALAN MINGGUAN', 18, 19);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(224, 231, 255);
      const comparisonSubtext = compareMoM
        ? `PERIODE: ${currSummary.label.toUpperCase()} • KOMPARASI VS ${formatDateShort(m1Start)} - ${formatDateShort(m1End)} & ${formatDateShort(m2Start)} - ${formatDateShort(m2End)}`
        : `KONSOLIDASI RINGKASAN ANALITIK & ANALISA PRODUK • PERIODE: ${currSummary.label.toUpperCase()}`;
      doc.text(comparisonSubtext, 18, 25);

      // Period badge on top right of banner
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      const bannerRightText = `${formatRupiah(currSummary.totalSales)}`;
      doc.text(bannerRightText, 192 - doc.getTextWidth(bannerRightText), 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(224, 231, 255);
      const txSubtitle = `${formatNumberIndo(currSummary.totalTx)} Transaksi • AOV ${formatRupiah(currSummary.aov)}`;
      doc.text(txSubtitle, 192 - doc.getTextWidth(txSubtitle), 25);

      // Section Title I: Ringkasan Analitik Penjualan
      let curY = 34;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('I. RINGKASAN ANALITIK PENJUALAN & MATRIKS PERBANDINGAN MULTI-BULAN', 14, curY);

      curY += 3.5;
      const kpiW = 43;
      const kpiH = 14.5;
      const kpiGap = 3.3;

      // Primary channel calculation
      const channelEntries = [
        { name: 'Instan', total: currSummary.totalInstan, tx: currSummary.txInstan },
        { name: 'Reguler', total: currSummary.totalReguler, tx: currSummary.txReguler },
        { name: 'Manual', total: currSummary.totalManual, tx: currSummary.txManual },
      ].sort((a, b) => b.total - a.total);
      const topChannel = channelEntries[0];
      const topChannelPct = currSummary.totalSales > 0 ? ((topChannel.total / currSummary.totalSales) * 100).toFixed(0) : '0';

      // 4 KPI Boxes in 1 Row
      drawKPI(14, curY, kpiW, kpiH, 'Total Omzet Terpilih', formatRupiah(currSummary.totalSales), `${currSummary.activeDaysCount} hari aktif tercatat`, [79, 70, 229]);
      drawKPI(14 + (kpiW + kpiGap), curY, kpiW, kpiH, 'Total Order (Tx)', `${formatNumberIndo(currSummary.totalTx)} Transaksi`, `AOV: ${formatRupiah(currSummary.aov)}`, [15, 23, 42]);
      drawKPI(14 + 2 * (kpiW + kpiGap), curY, kpiW, kpiH, 'Rata-rata Omzet / Hari', formatRupiah(currSummary.avgDailySales), `Omzet harian terdistribusi`, [16, 185, 129]);
      drawKPI(14 + 3 * (kpiW + kpiGap), curY, kpiW, kpiH, 'Saluran Terbesar', `${topChannel.name} (${topChannelPct}%)`, `${formatRupiah(topChannel.total)} (${topChannel.tx} tx)`, [99, 102, 241]);

      curY += kpiH + 4.5;

      // Sub-section A: Matriks Perbandingan Multi-Bulan (M vs M-1 vs M-2)
      if (compareMoM) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(30, 41, 59);
        doc.text('A. Matriks Perbandingan Kinerja Multi-Bulan (Periode Berjalan vs 1 Bulan & 2 Bulan Sebelumnya)', 14, curY);
        curY += 2;

        const comparisonRows = [
          [
            'Total Omzet Penjualan',
            formatRupiah(m2Summary.totalSales),
            formatRupiah(m1Summary.totalSales),
            formatRupiah(currSummary.totalSales),
            formatGrowthPct(currSummary.totalSales, m1Summary.totalSales),
            formatGrowthPct(currSummary.totalSales, m2Summary.totalSales),
          ],
          [
            'Total Transaksi (Orders)',
            `${formatNumberIndo(m2Summary.totalTx)} order`,
            `${formatNumberIndo(m1Summary.totalTx)} order`,
            `${formatNumberIndo(currSummary.totalTx)} order`,
            formatGrowthPct(currSummary.totalTx, m1Summary.totalTx),
            formatGrowthPct(currSummary.totalTx, m2Summary.totalTx),
          ],
          [
            'Rata-rata Nilai Order (AOV)',
            formatRupiah(m2Summary.aov),
            formatRupiah(m1Summary.aov),
            formatRupiah(currSummary.aov),
            formatGrowthPct(currSummary.aov, m1Summary.aov),
            formatGrowthPct(currSummary.aov, m2Summary.aov),
          ],
          [
            'Penjualan Instan',
            formatRupiah(m2Summary.totalInstan),
            formatRupiah(m1Summary.totalInstan),
            formatRupiah(currSummary.totalInstan),
            formatGrowthPct(currSummary.totalInstan, m1Summary.totalInstan),
            formatGrowthPct(currSummary.totalInstan, m2Summary.totalInstan),
          ],
          [
            'Penjualan Reguler',
            formatRupiah(m2Summary.totalReguler),
            formatRupiah(m1Summary.totalReguler),
            formatRupiah(currSummary.totalReguler),
            formatGrowthPct(currSummary.totalReguler, m1Summary.totalReguler),
            formatGrowthPct(currSummary.totalReguler, m2Summary.totalReguler),
          ],
          [
            'Penjualan Manual',
            formatRupiah(m2Summary.totalManual),
            formatRupiah(m1Summary.totalManual),
            formatRupiah(currSummary.totalManual),
            formatGrowthPct(currSummary.totalManual, m1Summary.totalManual),
            formatGrowthPct(currSummary.totalManual, m2Summary.totalManual),
          ],
          [
            'Rata-rata Omzet / Hari Kerja',
            formatRupiah(m2Summary.avgDailySales),
            formatRupiah(m1Summary.avgDailySales),
            formatRupiah(currSummary.avgDailySales),
            formatGrowthPct(currSummary.avgDailySales, m1Summary.avgDailySales),
            formatGrowthPct(currSummary.avgDailySales, m2Summary.avgDailySales),
          ],
          [
            'Jumlah Hari Kerja Aktif',
            `${m2Summary.activeDaysCount} hari`,
            `${m1Summary.activeDaysCount} hari`,
            `${currSummary.activeDaysCount} hari`,
            `${currSummary.activeDaysCount - m1Summary.activeDaysCount >= 0 ? '+' : ''}${currSummary.activeDaysCount - m1Summary.activeDaysCount} hari`,
            `${currSummary.activeDaysCount - m2Summary.activeDaysCount >= 0 ? '+' : ''}${currSummary.activeDaysCount - m2Summary.activeDaysCount} hari`,
          ]
        ];

        autoTable(doc, {
          head: [[
            'Metrik Kinerja Penjualan',
            formatRangeWithTag(m2Start, m2End, 'M-2'),
            formatRangeWithTag(m1Start, m1End, 'M-1'),
            formatRangeWithTag(realStart, realEnd, 'M'),
            'Pertumbuhan vs M-1',
            'Pertumbuhan vs M-2'
          ]],
          body: comparisonRows,
          startY: curY,
          theme: 'grid',
          headStyles: {
            fillColor: [79, 70, 229],
            textColor: [255, 255, 255],
            fontSize: 5.8,
            fontStyle: 'bold',
            halign: 'center',
            cellPadding: 1.2
          },
          columnStyles: {
            0: { cellWidth: 52, fontStyle: 'bold' },
            1: { halign: 'right', cellWidth: 26 },
            2: { halign: 'right', cellWidth: 26 },
            3: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
            4: { halign: 'center', cellWidth: 26 },
            5: { halign: 'center', cellWidth: 26 },
          },
          styles: {
            fontSize: 5.8,
            cellPadding: 1.15
          },
          didParseCell: function(data) {
            // First row highlight (Total Omzet)
            if (data.section === 'body' && data.row.index === 0) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [241, 245, 249];
            }
            // Growth columns text coloring
            if (data.section === 'body' && (data.column.index === 4 || data.column.index === 5)) {
              const val = String(data.cell.raw || '');
              if (val.startsWith('+')) {
                data.cell.styles.textColor = [22, 101, 52]; // Dark green
                data.cell.styles.fontStyle = 'bold';
              } else if (val.startsWith('-')) {
                data.cell.styles.textColor = [185, 28, 28]; // Dark red
                data.cell.styles.fontStyle = 'bold';
              }
            }
          },
          margin: { left: 14, right: 14 }
        });

        curY = (doc as any).lastAutoTable.finalY + 4;
      }

      // Sub-section B: Daily Breakdown
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(30, 41, 59);
      doc.text('B. Rincian Tren Penjualan Harian Periode Berjalan (Daily Sales Breakdown)', 14, curY);
      curY += 2;

      // Build daily rows
      const dailyRows = currSummary.days.map(day => {
        const ev = events.find(e => e.date === day.date);
        const dayAov = day.txAll > 0 ? Math.round(day.totalAll / day.txAll) : 0;
        return [
          `${day.dayOfWeek}, ${formatDateIndo(day.date).replace(/ \d{4}$/, '')}`,
          formatRupiah(day.totalInstan),
          formatRupiah(day.totalReguler),
          formatRupiah(day.totalManual),
          formatRupiah(day.totalAll),
          `${formatNumberIndo(day.txAll)} tx`,
          formatRupiah(dayAov),
          ev ? `${ev.title} (${ev.type})` : '-'
        ];
      });

      // Total row for daily table
      dailyRows.push([
        'TOTAL PERIODE TERPILIH',
        formatRupiah(currSummary.totalInstan),
        formatRupiah(currSummary.totalReguler),
        formatRupiah(currSummary.totalManual),
        formatRupiah(currSummary.totalSales),
        `${formatNumberIndo(currSummary.totalTx)} tx`,
        formatRupiah(currSummary.aov),
        `${currSummary.days.length} Hari Kerja`
      ]);

      autoTable(doc, {
        head: [['Hari & Tanggal', 'Omzet Instan', 'Omzet Reguler', 'Omzet Manual', 'Total Omzet', 'Transaksi', 'AOV', 'Event / Catatan']],
        body: dailyRows,
        startY: curY,
        theme: 'striped',
        headStyles: {
          fillColor: [30, 41, 59], // Slate 800
          textColor: [255, 255, 255],
          fontSize: 6.2,
          fontStyle: 'bold',
          cellPadding: 1.3
        },
        columnStyles: {
          0: { cellWidth: 32, fontStyle: 'bold' },
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right', fontStyle: 'bold' },
          5: { halign: 'center' },
          6: { halign: 'right' },
          7: { cellWidth: 35, fontSize: 5.3 }
        },
        styles: {
          fontSize: 5.8,
          cellPadding: 1.15
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.row.index === dailyRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [224, 231, 255]; // light indigo
            data.cell.styles.textColor = [49, 46, 129];
          }
        },
        margin: { left: 14, right: 14 }
      });

      curY = (doc as any).lastAutoTable.finalY + 3.5;

      // Sub-section C: Evaluasi & Highlight Analitik
      if (curY < 268) {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        const boxH = Math.min(18, 280 - curY);
        doc.roundedRect(14, curY, 182, boxH, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(79, 70, 229);
        doc.text('CATATAN & EVALUASI ANALITIK PENJUALAN MINGGUAN / PERIODE:', 18, curY + 4);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(71, 85, 105);
        
        const momSalesPct = formatGrowthPct(currSummary.totalSales, m1Summary.totalSales);
        const mom2SalesPct = formatGrowthPct(currSummary.totalSales, m2Summary.totalSales);
        const peakDayText = currSummary.peakDay ? `${currSummary.peakDay.dayOfWeek} (${formatDateIndo(currSummary.peakDay.date).replace(/ \d{4}$/, '')}) - ${formatRupiah(currSummary.peakDay.totalAll)}` : '-';
        
        const bullet1 = `• Akumulasi pendapatan mencapai ${formatRupiah(currSummary.totalSales)} dengan volume order ${formatNumberIndo(currSummary.totalTx)} transaksi (AOV ${formatRupiah(currSummary.aov)}).`;
        const bullet2 = compareMoM
          ? `• Pertumbuhan omzet tercatat ${momSalesPct} dibandingkan periode yang sama 1 bulan lalu (M-1) dan ${mom2SalesPct} dibandingkan 2 bulan lalu (M-2).`
          : `• Penjualan tertinggi terjadi pada ${peakDayText}. Kanal ${topChannel.name} berkontribusi paling dominan (${topChannelPct}%).`;
        const bullet3 = `• Lanjutkan ke Halaman 2 untuk rincian performa produk, kontribusi SKU terlaris, kategori, dan merk.`;
        doc.text(bullet1, 18, curY + 8);
        doc.text(bullet2, 18, curY + 12);
        doc.text(bullet3, 18, curY + 16);
      }

      // ==========================================
      // PAGE 2: ANALISA PERFORMA PRODUK
      // ==========================================
      doc.addPage();
      curY = 12;

      // Top banner Page 2
      doc.setFillColor(30, 41, 59); // Slate 800
      doc.rect(14, curY, 182, 16, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(255, 255, 255);
      doc.text('II. ANALISA PERFORMA PRODUK & KONTRIBUSI SKU (MULTI-BULAN)', 18, curY + 6.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(203, 213, 225);
      doc.text(`RINCIAN PENJUALAN PRODUK TERLARIS & KOMPARASI • PERIODE: ${currSummary.label.toUpperCase()}`, 18, curY + 12);

      const topSkuInfo = currProd.aggregated[0];
      const rightProdText = `${formatNumberIndo(currProd.totalQty)} Unit Terjual`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(rightProdText, 192 - doc.getTextWidth(rightProdText), curY + 7.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(203, 213, 225);
      const skuCountText = `${currProd.aggregated.length} SKU Aktif`;
      doc.text(skuCountText, 192 - doc.getTextWidth(skuCountText), curY + 12);

      curY += 19;

      // 6 Product KPI Boxes (2 rows x 3 columns)
      const prodKpiW = 58;
      const prodKpiH = 14;
      const upt = currSummary.totalTx > 0 ? (currProd.totalQty / currSummary.totalTx).toFixed(1) : '0';
      const topCat = currProd.categorySummary[0];
      const topBrand = currProd.brandSummary[0];

      // Row 1 of Product KPIs
      drawKPI(14, curY, prodKpiW, prodKpiH, 'Total Volume Unit Terjual', `${formatNumberIndo(currProd.totalQty)} Unit`, `Rata-rata ${upt} unit / transaksi (UPT)`, [79, 70, 229]);
      drawKPI(14 + prodKpiW + kpiGap, curY, prodKpiW, prodKpiH, 'Jumlah SKU Terjual', `${formatNumberIndo(currProd.aggregated.length)} SKU Aktif`, `${currProd.categorySummary.length} kategori • ${currProd.brandSummary.length} merk`, [15, 23, 42]);
      drawKPI(14 + 2 * (prodKpiW + kpiGap), curY, prodKpiW, prodKpiH, 'Total Omzet Produk', formatRupiah(currProd.totalSales), `Omzet teragregasi dari transaksi SKU`, [16, 185, 129]);

      curY += prodKpiH + 3;

      // Row 2 of Product KPIs
      const topSkuTitle = topSkuInfo ? (topSkuInfo.name.length > 22 ? topSkuInfo.name.substring(0, 22) + '...' : topSkuInfo.name) : '-';
      const topSkuSub = topSkuInfo ? `${topSkuInfo.totalQty} ${topSkuInfo.unit} (${formatRupiah(topSkuInfo.totalSales)})` : '-';
      drawKPI(14, curY, prodKpiW, prodKpiH, 'SKU Produk Terlaris (#1)', topSkuTitle, topSkuSub, [244, 63, 94]);

      const topCatName = topCat ? topCat.category : '-';
      const topCatSub = topCat ? `${topCat.skuSet.size} SKU • ${formatRupiah(topCat.totalSales)}` : '-';
      drawKPI(14 + prodKpiW + kpiGap, curY, prodKpiW, prodKpiH, 'Kategori Teratas', topCatName, topCatSub, [217, 119, 6]);

      const topBrandName = topBrand ? topBrand.brand : '-';
      const topBrandSub = topBrand ? `${topBrand.skuSet.size} SKU • ${formatRupiah(topBrand.totalSales)}` : '-';
      drawKPI(14 + 2 * (prodKpiW + kpiGap), curY, prodKpiW, prodKpiH, 'Merk / Brand Teratas', topBrandName, topBrandSub, [99, 102, 241]);

      curY += prodKpiH + 4.5;

      // Sub-section A: Top Categories & Brands Comparative Tables
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(30, 41, 59);
      doc.text('A. Perbandingan Kinerja Kategori & Brand Teratas (M vs 1 & 2 Bulan Lalu)', 14, curY);
      curY += 2;

      // Category Table (Left half: 88mm width)
      const catRows = currProd.categorySummary.slice(0, 5).map(c => {
        const m1Sales = m1CatMap.get(c.category) || 0;
        const growth = formatGrowthPct(c.totalSales, m1Sales);
        return [
          c.category.length > 18 ? c.category.substring(0, 18) + '..' : c.category,
          `${c.skuSet.size}`,
          formatRupiah(c.totalSales),
          growth
        ];
      });

      autoTable(doc, {
        head: [['Kategori Produk', 'Jml SKU', 'Omzet (M)', 'vs M-1']],
        body: catRows.length > 0 ? catRows : [['Tidak ada data', '-', '-', '-']],
        startY: curY,
        tableWidth: 89,
        theme: 'striped',
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontSize: 5.8,
          fontStyle: 'bold',
          cellPadding: 1.1
        },
        columnStyles: {
          0: { cellWidth: 33, fontStyle: 'bold' },
          1: { cellWidth: 15, halign: 'center' },
          2: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 15, halign: 'center' },
        },
        styles: {
          fontSize: 5.5,
          cellPadding: 1
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 3) {
            const val = String(data.cell.raw || '');
            if (val.startsWith('+')) data.cell.styles.textColor = [22, 101, 52];
            else if (val.startsWith('-')) data.cell.styles.textColor = [185, 28, 28];
          }
        },
        margin: { left: 14 }
      });

      const catFinalY = (doc as any).lastAutoTable.finalY;

      // Brand Table (Right half: 89mm width)
      const brandRows = currProd.brandSummary.slice(0, 5).map(b => {
        const m1Sales = m1BrandMap.get(b.brand) || 0;
        const growth = formatGrowthPct(b.totalSales, m1Sales);
        return [
          b.brand.length > 18 ? b.brand.substring(0, 18) + '..' : b.brand,
          `${b.skuSet.size}`,
          formatRupiah(b.totalSales),
          growth
        ];
      });

      autoTable(doc, {
        head: [['Merk / Brand', 'Jml SKU', 'Omzet (M)', 'vs M-1']],
        body: brandRows.length > 0 ? brandRows : [['Tidak ada data', '-', '-', '-']],
        startY: curY,
        tableWidth: 89,
        theme: 'striped',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: 5.8,
          fontStyle: 'bold',
          cellPadding: 1.1
        },
        columnStyles: {
          0: { cellWidth: 33, fontStyle: 'bold' },
          1: { cellWidth: 15, halign: 'center' },
          2: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 15, halign: 'center' },
        },
        styles: {
          fontSize: 5.5,
          cellPadding: 1
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 3) {
            const val = String(data.cell.raw || '');
            if (val.startsWith('+')) data.cell.styles.textColor = [22, 101, 52];
            else if (val.startsWith('-')) data.cell.styles.textColor = [185, 28, 28];
          }
        },
        margin: { left: 107 }
      });

      const brandFinalY = (doc as any).lastAutoTable.finalY;
      curY = Math.max(catFinalY, brandFinalY) + 4.5;

      // Sub-section B: Top 15 Best Selling SKUs
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(30, 41, 59);
      doc.text('B. Rincian SKU Produk Terlaris Periode Berjalan (Top 15 Selling SKUs)', 14, curY);
      curY += 2;

      if (currProd.aggregated.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Tidak ada data rincian transaksi produk spesifik untuk periode ini.', 14, curY + 3);
        curY += 8;
      } else {
        const productHeaders = [['Rank', 'SKU', 'Nama Produk', 'Merk', 'Kategori', 'Unit Terjual', 'Omzet Penjualan', 'Share %', 'Harga Rerata']];
        const productRows = currProd.aggregated.slice(0, 15).map((p, index) => {
          const unitPrice = p.totalQty > 0 ? Math.round(p.totalSales / p.totalQty) : 0;
          const share = currProd.totalSales > 0 ? ((p.totalSales / currProd.totalSales) * 100).toFixed(1) : '0';
          const trimmedName = p.name.length > 34 ? p.name.substring(0, 34) + '...' : p.name;
          return [
            `#${index + 1}`,
            p.sku,
            trimmedName,
            p.brand,
            p.category,
            `${formatNumberIndo(p.totalQty)} ${p.unit || 'pcs'}`,
            formatRupiah(p.totalSales),
            `${share}%`,
            formatRupiah(unitPrice)
          ];
        });

        autoTable(doc, {
          head: productHeaders,
          body: productRows,
          startY: curY,
          theme: 'striped',
          headStyles: {
            fillColor: [79, 70, 229],
            textColor: [255, 255, 255],
            fontSize: 6,
            fontStyle: 'bold',
            cellPadding: 1.15
          },
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 18, fontStyle: 'bold' },
            2: { cellWidth: 50 },
            3: { cellWidth: 22 },
            4: { cellWidth: 22 },
            5: { cellWidth: 18, halign: 'right' },
            6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
            7: { cellWidth: 12, halign: 'center' },
            8: { cellWidth: 20, halign: 'right' }
          },
          styles: {
            fontSize: 5.5,
            cellPadding: 1.05
          },
          margin: { left: 14, right: 14, bottom: 18 }
        });

        curY = (doc as any).lastAutoTable.finalY + 3.5;
      }

      // Sub-section C: Product Insight Callout Box
      if (curY < 274) {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        const boxH = Math.min(16, 282 - curY);
        doc.roundedRect(14, curY, 182, boxH, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(15, 23, 42);
        doc.text('INSIGHT PRODUK & REKOMENDASI STOK PERIODE INI:', 18, curY + 3.8);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.4);
        doc.setTextColor(71, 85, 105);
        const top3Skus = currProd.aggregated.slice(0, 3).map(p => p.sku).join(', ');
        const insight1 = `• Kontributor produk terbesar dipimpin oleh SKU: ${top3Skus || '-'}. Pastikan stok produk unggulan ini terjaga aman.`;
        const insight2 = `• Kategori ${topCat ? topCat.category : '-'} dan Brand ${topBrand ? topBrand.brand : '-'} mendominasi volume dan omzet tertinggi pada periode ini.`;
        doc.text(insight1, 18, curY + 7.8);
        doc.text(insight2, 18, curY + 12);
      }

      // ==========================================
      // RUNNING FOOTERS ON ALL PAGES
      // ==========================================
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(14, 284, 196, 284);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);
        doc.setTextColor(100, 116, 139);
        doc.text(`Laporan Penjualan Terpadu (Ringkasan Analitik & Analisa Produk) • Periode: ${currSummary.label}`, 14, 288);

        const pageStr = `Halaman ${i} dari ${totalPages}`;
        doc.text(pageStr, 196 - doc.getTextWidth(pageStr), 288);
      }

      setExportStep('Mengunduh file PDF terpadu...');
      doc.save(fileName);
    } catch (err) {
      console.error('Gagal membuat laporan penjualan PDF:', err);
    } finally {
      setIsExporting(false);
      setExportStep('');
    }
  };

  // Backward compatible wrapper for weekly download by week key
  const executeWeeklyPDFDownload = async (weekKey: string) => {
    const weekObj = availableWeeks.find(w => w.weekKey === weekKey) || availableWeeks[0];
    if (!weekObj) return;
    await executePeriodPDFDownload(weekObj.startDate, weekObj.endDate, true);
  };

  // Start download sequentially for chosen months
  const handleStartDownload = async () => {
    if (selectedMonths.length === 0) return;
    setIsExporting(true);
    
    // Sort selected months chronologically ascending (oldest first)
    const sortedSelected = [...availableMonths]
      .filter(m => selectedMonths.includes(m.yearMonth))
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

    try {
      for (let i = 0; i < sortedSelected.length; i++) {
        const currentMonthObj = sortedSelected[i];
        setActiveExportIndex(i);
        setSelectedMonth(currentMonthObj.yearMonth);
        
        setExportStep(`Mempersiapkan data laporan ${currentMonthObj.label}...`);
        // Wait 250ms for state and currentMonthSummary useMemo to update and settle
        await new Promise(resolve => setTimeout(resolve, 250));
        
        // Execute the PDF generation for this specific month
        await executeMonthPDFDownload(currentMonthObj.label);
      }
    } catch (error) {
      console.error('Kesalahan ekspor laporan:', error);
    } finally {
      setIsExporting(false);
      setActiveExportIndex(-1);
      setExportStep('');
      onClose(); // Automatically close when done
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh] relative animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide leading-none">
                {reportType === 'weekly'
                  ? 'Unduh Laporan Penjualan (Mingguan / Kustom)'
                  : reportType === 'monthly'
                  ? 'Unduh Laporan Kinerja Bulanan'
                  : 'Unduh Ringkasan Eksekutif Harian'}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">
                {reportType === 'weekly'
                  ? 'Filter periode kalender / custom tanggal dengan perbandingan performa multi-bulan (MoM)'
                  : reportType === 'monthly'
                  ? 'Pilih periode bulan evaluasi untuk diekspor ke PDF'
                  : 'Pilih tanggal harian spesifik untuk diekspor ke PDF'}
              </p>
            </div>
          </div>
          
          {!isExporting && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all border border-slate-200/50 bg-white shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        {!isExporting && (
          <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
            <button
              onClick={() => setReportType('weekly')}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                reportType === 'weekly'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              📈 Mingguan / Kustom (MoM)
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                reportType === 'monthly'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              📊 Laporan Bulanan
            </button>
            <button
              onClick={() => setReportType('daily')}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                reportType === 'daily'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              📅 Ringkasan Harian
            </button>
          </div>
        )}

        {isExporting ? (
          /* Progress State View */
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 flex-1 my-auto">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-12 w-12 bg-indigo-600 items-center justify-center shadow-lg shadow-indigo-200">
                <Download className="w-5 h-5 text-white animate-bounce" />
              </span>
            </div>

            <div className="space-y-2 max-w-xs">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Mengekspor Laporan PDF...</h4>
              <p className="text-[10.5px] font-semibold text-slate-500 leading-normal">
                Harap tunggu, data laporan sedang dikonversi ke format PDF secara berkualitas tinggi.
              </p>
            </div>

            {/* Progress bar and step info */}
            <div className="w-full max-w-sm bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <span>Progress Ekspor</span>
                <span className="text-indigo-600 font-bold">
                  {reportType === 'monthly' 
                    ? (activeExportIndex >= 0 ? `${activeExportIndex + 1} / ${selectedMonths.length} Laporan` : 'Memulai...')
                    : '1 / 1 Laporan'}
                </span>
              </div>

              <div className="space-y-2">
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{ 
                      width: reportType === 'monthly' 
                        ? `${selectedMonths.length > 0 ? ((activeExportIndex + 1) / selectedMonths.length) * 100 : 0}%`
                        : '100%'
                    }}
                  />
                </div>
                <p className="text-[10.5px] font-bold text-slate-600 animate-pulse truncate leading-tight">
                  {exportStep || 'Mempersiapkan...'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold justify-center pt-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Vektor Tajam • Bebas Error Rendering • Tanpa Tanda Tangan</span>
            </div>
          </div>
        ) : (
          /* Selection Form View */
          <>
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {reportType === 'weekly' ? (
                <div className="space-y-4">
                  {/* Info Panel Weekly */}
                  <div className="bg-indigo-50/80 border border-indigo-100 p-4 rounded-2xl flex gap-3 text-[11px] font-semibold text-indigo-900 leading-normal shadow-sm">
                    <div className="mt-0.5 shrink-0">
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-indigo-600 text-white rounded-full font-black text-xs">✓</span>
                    </div>
                    <div>
                      <p className="font-bold text-indigo-950">Laporan Penjualan Terpadu (Analitik, Produk &amp; Komparasi Multi-Bulan)</p>
                      <p className="text-[10.5px] text-indigo-700/90 mt-0.5">
                        Dapat difilter per minggu kalender atau <strong>rentang tanggal kustom</strong> bebas. Otomatis membandingkan data dengan 1 bulan (M-1) dan 2 bulan (M-2) sebelumnya untuk evaluasi performa bisnis.
                      </p>
                    </div>
                  </div>

                  {/* Mode Selector: Preset Minggu vs Rentang Kustom */}
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => setWeeklySelectionMode('preset')}
                      className={`flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        weeklySelectionMode === 'preset'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Minggu Kalender (Senin - Minggu)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeeklySelectionMode('custom')}
                      className={`flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        weeklySelectionMode === 'custom'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Filter Rentang Tanggal Kustom
                    </button>
                  </div>

                  {/* Input Based on Selected Mode */}
                  {weeklySelectionMode === 'preset' ? (
                    /* Week Selection Dropdown */
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Pilih Periode Minggu
                      </label>
                      <select
                        value={selectedWeeklyDate}
                        onChange={(e) => setSelectedWeeklyDate(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold"
                      >
                        {availableWeeks.map(wk => (
                          <option key={wk.weekKey} value={wk.weekKey}>
                            {wk.label} — {formatRupiah(wk.totalSales)} ({wk.totalTx} tx)
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    /* Custom Date Range Picker */
                    <div className="space-y-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                          Tentukan Tanggal Mulai &amp; Tanggal Selesai
                        </label>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                          {activeRange.startDate} s/d {activeRange.endDate}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10.5px] font-bold text-slate-600 block">
                            Dari Tanggal (Mulai):
                          </label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10.5px] font-bold text-slate-600 block">
                            Sampai Tanggal (Selesai):
                          </label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                          />
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="text-slate-400 font-bold uppercase tracking-wider mr-1">Preset Cepat:</span>
                        {availableWeeks.slice(0, 3).map((wk, idx) => (
                          <button
                            key={wk.weekKey}
                            type="button"
                            onClick={() => {
                              setCustomStartDate(wk.startDate);
                              setCustomEndDate(wk.endDate);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors shadow-2xs"
                          >
                            {idx === 0 ? 'Minggu Terakhir' : idx === 1 ? '1 Minggu Lalu' : '2 Minggu Lalu'} ({formatDateShort(wk.startDate)} - {formatDateShort(wk.endDate)})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MoM Comparison Toggle Box */}
                  <div className="border border-indigo-100 bg-linear-to-r from-indigo-50/70 to-slate-50 p-3.5 rounded-2xl flex items-start gap-3 shadow-2xs">
                    <input
                      type="checkbox"
                      id="mom-comparison-toggle"
                      checked={includeMoMComparison}
                      onChange={(e) => setIncludeMoMComparison(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 accent-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="mom-comparison-toggle" className="flex-1 cursor-pointer select-none">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-indigo-950">
                          Sertakan Matriks Perbandingan Multi-Bulan (MoM) di PDF
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          Otomatis
                        </span>
                      </div>
                      <p className="text-[10.5px] text-indigo-800/80 mt-0.5 leading-snug">
                        Otomatis menyertakan tabel komparasi kinerja dengan <strong>{comparisonPeriods.m1Label}</strong> (1 Bulan Lalu) dan <strong>{comparisonPeriods.m2Label}</strong> (2 Bulan Lalu) beserta kalkulasi pertumbuhan omzet &amp; pesanan.
                      </p>
                    </label>
                  </div>

                  {/* Detailed Preview Card with Multi-Period Comparison */}
                  {(() => {
                    const { current, m1, m2, salesGrowthM1, salesGrowthM2, txGrowthM1, txGrowthM2, m1Label, m2Label } = comparisonPeriods;
                    const periodProductsCount = allProducts.filter(p => p.date && p.date >= activeRange.startDate && p.date <= activeRange.endDate).length;

                    return (
                      <div className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
                              Ringkasan Periode Terpilih ({weeklySelectionMode === 'preset' ? 'Minggu Kalender' : 'Rentang Kustom'})
                            </span>
                            <h4 className="text-xs font-black text-slate-800 mt-0.5">{activeRange.label}</h4>
                          </div>
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
                            {current.activeDaysCount} Hari Kerja Aktif
                          </span>
                        </div>

                        {/* Current Period KPIs */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="space-y-0.5 bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                            <span className="text-[9.5px] text-slate-400 font-bold block">Total Omzet:</span>
                            <span className="font-mono font-black text-indigo-600 text-sm block">
                              {formatRupiah(current.totalSales)}
                            </span>
                          </div>

                          <div className="space-y-0.5 bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                            <span className="text-[9.5px] text-slate-400 font-bold block">Total Transaksi:</span>
                            <span className="font-mono font-black text-slate-800 text-sm block">
                              {formatNumberIndo(current.totalTx)} Order
                            </span>
                          </div>

                          <div className="space-y-0.5 bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                            <span className="text-[9.5px] text-slate-400 font-bold block">Rata-rata Order (AOV):</span>
                            <span className="text-slate-700 font-extrabold text-[11px] block">
                              {formatRupiah(current.aov)}
                            </span>
                          </div>

                          <div className="space-y-0.5 bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                            <span className="text-[9.5px] text-slate-400 font-bold block">Omzet Rata-rata / Hari:</span>
                            <span className="text-emerald-600 font-extrabold text-[11px] block">
                              {formatRupiah(current.avgDailySales)}
                            </span>
                          </div>
                        </div>

                        {/* Comparative Insight Card (MoM) */}
                        {includeMoMComparison && (
                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                            <div className="bg-slate-100/80 px-3 py-1.5 border-b border-slate-200/80 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                                Preview Matriks Perbandingan Multi-Bulan
                              </span>
                              <span className="text-indigo-600 font-bold">2 Periode Pembanding</span>
                            </div>

                            <div className="divide-y divide-slate-100 text-[11px]">
                              {/* 1 Month Ago Comparison */}
                              <div className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-slate-800">1 Bulan Lalu (M-1):</span>
                                    <span className="text-[10px] text-slate-500 font-semibold">{m1Label}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500">
                                    Omzet: <strong>{formatRupiah(m1.totalSales)}</strong> • {formatNumberIndo(m1.totalTx)} transaksi
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className={`inline-flex items-center gap-1 text-[10.5px] font-black px-2 py-0.5 rounded-md ${
                                    salesGrowthM1 >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                  }`}>
                                    {salesGrowthM1 >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                    {salesGrowthM1 >= 0 ? '+' : ''}{salesGrowthM1.toFixed(1)}% Omzet
                                  </span>
                                  <span className="block text-[9px] text-slate-400 font-bold mt-0.5">
                                    Tx: {txGrowthM1 >= 0 ? '+' : ''}{txGrowthM1.toFixed(1)}%
                                  </span>
                                </div>
                              </div>

                              {/* 2 Months Ago Comparison */}
                              <div className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-slate-800">2 Bulan Lalu (M-2):</span>
                                    <span className="text-[10px] text-slate-500 font-semibold">{m2Label}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500">
                                    Omzet: <strong>{formatRupiah(m2.totalSales)}</strong> • {formatNumberIndo(m2.totalTx)} transaksi
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className={`inline-flex items-center gap-1 text-[10.5px] font-black px-2 py-0.5 rounded-md ${
                                    salesGrowthM2 >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                  }`}>
                                    {salesGrowthM2 >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                    {salesGrowthM2 >= 0 ? '+' : ''}{salesGrowthM2.toFixed(1)}% Omzet
                                  </span>
                                  <span className="block text-[9px] text-slate-400 font-bold mt-0.5">
                                    Tx: {txGrowthM2 >= 0 ? '+' : ''}{txGrowthM2.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between text-[10.5px]">
                          <span className="text-slate-500 font-semibold">
                            Data Rincian Produk Terkait Periode Ini:
                          </span>
                          <span className="text-indigo-600 font-bold">
                            {isProductsLoading ? 'Memuat data produk...' : `${periodProductsCount} catatan transaksi produk`}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : reportType === 'monthly' ? (
                <>
                  {/* Quick info panel */}
                  <div className="bg-amber-50 border border-amber-200/40 p-4 rounded-2xl flex gap-3 text-[11px] font-semibold text-amber-800 leading-normal">
                    <div className="mt-0.5 shrink-0">
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-100 text-amber-700 rounded-full font-bold">!</span>
                    </div>
                    <p>
                      Sistem mendeteksi <strong className="text-amber-950">{availableMonths.length} bulan</strong> data penjualan. Pilih bulan yang ingin Anda unduh secara bersamaan. Laporan akan diunduh secara berurutan.
                    </p>
                  </div>

                  {/* Selection Actions (Select All, Clear) */}
                  <div className="flex items-center justify-between pb-1 text-[11px] font-bold">
                    <span className="text-slate-400 uppercase tracking-wider">Daftar Bulan Tersedia</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedMonths(availableMonths.map(m => m.yearMonth))}
                        className="text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-wider"
                      >
                        Pilih Semua
                      </button>
                      <span className="text-slate-200">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMonths([])}
                        className="text-rose-600 hover:text-rose-800 transition-colors uppercase tracking-wider"
                      >
                        Batalkan Pilihan
                      </button>
                    </div>
                  </div>

                  {/* Month List */}
                  <div className="space-y-2 border border-slate-100 rounded-2xl p-2 max-h-[35vh] overflow-y-auto bg-slate-50/50">
                    {availableMonths.map(month => {
                      const isChecked = selectedMonths.includes(month.yearMonth);
                      
                      // Target status indicator based on sales thresholds
                      const isGold = month.totalSales >= 800000000;
                      const isSilver = month.totalSales >= 700000000;
                      const isBronze = month.totalSales >= 600000000;
                      
                      const targetLabel = isGold ? '🥇 Gold' : isSilver ? '🥈 Silver' : isBronze ? '🥉 Bronze' : '❌ No Level';
                      const targetColor = isGold 
                        ? 'bg-amber-50 text-amber-700 border-amber-200/60' 
                        : isSilver 
                        ? 'bg-slate-100 text-slate-700 border-slate-200/60' 
                        : isBronze 
                        ? 'bg-amber-100 text-amber-800 border-amber-200/60' 
                        : 'bg-rose-50 text-rose-600 border-rose-100';

                      return (
                        <button
                          key={month.yearMonth}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setSelectedMonths(prev => prev.filter(m => m !== month.yearMonth));
                            } else {
                              setSelectedMonths(prev => [...prev, month.yearMonth]);
                            }
                          }}
                          className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left group ${
                            isChecked 
                              ? 'bg-white border-indigo-200 shadow-sm' 
                              : 'bg-transparent border-transparent hover:bg-slate-100/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-1 rounded-md border transition-all ${
                              isChecked 
                                ? 'bg-indigo-600 border-indigo-600 text-white' 
                                : 'bg-white border-slate-200 text-transparent group-hover:border-slate-300'
                            }`}>
                              <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                            </div>
                            <div>
                              <p className="text-xs font-extrabold text-slate-800">{month.label}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">{formatRupiah(month.totalSales)}</p>
                            </div>
                          </div>

                          <span className={`text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-lg border ${targetColor}`}>
                            {targetLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Info Panel */}
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex gap-3 text-[11px] font-semibold text-indigo-800 leading-normal">
                    <div className="mt-0.5 shrink-0">
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full font-bold">💡</span>
                    </div>
                    <p>
                      Unduh ringkasan eksekutif harian berformat PDF satu halaman. Laporan ini merangkum omzet harian, rincian penjualan per channel, event aktif, dan rincian produk terlaris di tanggal terpilih.
                    </p>
                  </div>

                  {/* Date Dropdown Select */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pilih Tanggal Laporan</label>
                    <select
                      value={selectedDailyDate}
                      onChange={(e) => setSelectedDailyDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold"
                    >
                      {dateOptions.map(opt => (
                        <option key={opt.date} value={opt.date}>
                          {opt.label} — {opt.amount}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Summary Preview of Selected Day */}
                  {selectedDailyDate && (
                    <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/40 space-y-3">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Pratinjau Data Terpilih</span>
                      
                      {(() => {
                        const dayData = salesData.find(d => d.date === selectedDailyDate);
                        const dayProductsCount = allProducts.filter(p => p.date === selectedDailyDate).length;
                        if (!dayData) return null;
                        return (
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold block">Total Omzet:</span>
                              <span className="font-mono font-extrabold text-indigo-600 text-sm">{formatRupiah(dayData.totalAll)}</span>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold block">Total Transaksi:</span>
                              <span className="font-mono font-extrabold text-slate-800 text-sm">{dayData.txAll} Transaksi</span>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold block">Kinerja Channel:</span>
                              <span className="text-slate-600 font-bold text-[10.5px] block truncate">
                                Instan: {((dayData.totalInstan / (dayData.totalAll || 1)) * 100).toFixed(0)}% • 
                                Reguler: {((dayData.totalReguler / (dayData.totalAll || 1)) * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold block">Produk Terlaris:</span>
                              <span className="text-emerald-600 font-extrabold text-[11px] block">
                                {isProductsLoading ? 'Memuat data...' : `${dayProductsCount} jenis produk terjual`}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                {reportType === 'weekly' ? (
                  <>
                    Periode: <strong className="text-indigo-600 font-extrabold">{formatDateShort(activeRange.startDate)} - {formatDateShort(activeRange.endDate)}</strong>
                    {includeMoMComparison && <span className="text-emerald-600 font-extrabold ml-1.5">• Komparasi MoM</span>}
                  </>
                ) : reportType === 'monthly' ? (
                  <>Terpilih: <strong className="text-indigo-600 font-extrabold">{selectedMonths.length} Bulan</strong></>
                ) : (
                  <>Metrik Harian: <strong className="text-indigo-600 font-extrabold">1 Hari Kerja</strong></>
                )}
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-black uppercase text-slate-500 hover:text-slate-700 transition-colors bg-white shadow-sm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (reportType === 'weekly') {
                      executePeriodPDFDownload(activeRange.startDate, activeRange.endDate, includeMoMComparison);
                    } else if (reportType === 'monthly') {
                      handleStartDownload();
                    } else {
                      executeDailyPDFDownload(selectedDailyDate);
                    }
                  }}
                  disabled={
                    reportType === 'weekly'
                      ? !activeRange.startDate || !activeRange.endDate || isProductsLoading
                      : reportType === 'monthly'
                      ? selectedMonths.length === 0
                      : !selectedDailyDate || isProductsLoading
                  }
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-indigo-100 disabled:opacity-45 hover:scale-[1.01]"
                >
                  <Download className="w-4 h-4 text-white" />
                  {isProductsLoading ? 'Memuat Produk...' : 'Mulai Unduh'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
