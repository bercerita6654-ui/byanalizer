import React, { useState, useEffect, useMemo } from 'react';
import { DailySales, SalesOrder } from '../types';
import { formatRupiah, formatNumberIndo, formatRupiahCompact, formatDateIndo, formatMonthIndo } from '../utils';
import { 
  TrendingUp, ShoppingCart, Award, Sparkles, DollarSign,
  ArrowUpRight, BarChart3, HelpCircle, Activity, ShoppingBag,
  ArrowUp, ArrowDown, Trophy, Target, CheckCircle2, Lock, Calendar,
  Store, UserCheck, Zap, Package, FileText
} from 'lucide-react';

interface SalesSummaryProps {
  salesData: DailySales[];
  rawOrders?: SalesOrder[];
  allOrders?: SalesOrder[];
  selectedAdmin?: string;
  onSelectAdmin?: (admin: string) => void;
}

export default function SalesSummary({ 
  salesData, 
  rawOrders = [], 
  allOrders = [], 
  selectedAdmin = '', 
  onSelectAdmin 
}: SalesSummaryProps) {
  const stats = useMemo(() => {
    if (salesData.length === 0) return null;

    let totalSales = 0;
    let totalTx = 0;
    
    let totalInstanSales = 0;
    let totalRegulerSales = 0;
    let totalManualSales = 0;

    let totalInstanTx = 0;
    let totalRegulerTx = 0;
    let totalManualTx = 0;

    let maxSales = -1;
    let maxSalesDate = '';
    let minSales = Infinity;
    let minSalesDate = '';

    salesData.forEach(day => {
      totalSales += day.totalAll;
      totalTx += day.txAll;

      totalInstanSales += day.totalInstan;
      totalRegulerSales += day.totalReguler;
      totalManualSales += day.totalManual;

      totalInstanTx += day.txInstan;
      totalRegulerTx += day.txReguler;
      totalManualTx += day.txManual;

      if (day.totalAll > maxSales) {
        maxSales = day.totalAll;
        maxSalesDate = day.date;
      }
      // Only check non-zero sales for minimum productive day
      if (day.totalAll > 0 && day.totalAll < minSales) {
        minSales = day.totalAll;
        minSalesDate = day.date;
      }
    });

    const daysCount = salesData.length;
    const avgDailySales = totalSales / daysCount;
    const avgDailyTx = totalTx / daysCount;
    const aov = totalTx > 0 ? totalSales / totalTx : 0;

    // Day of week performance aggregation
    const dowPerformance: { [key: string]: { totalSales: number; count: number; totalTx: number } } = {
      'Senin': { totalSales: 0, count: 0, totalTx: 0 },
      'Selasa': { totalSales: 0, count: 0, totalTx: 0 },
      'Rabu': { totalSales: 0, count: 0, totalTx: 0 },
      'Kamis': { totalSales: 0, count: 0, totalTx: 0 },
      'Jumat': { totalSales: 0, count: 0, totalTx: 0 },
      'Sabtu': { totalSales: 0, count: 0, totalTx: 0 },
      'Minggu': { totalSales: 0, count: 0, totalTx: 0 },
    };

    salesData.forEach(day => {
      if (dowPerformance[day.dayOfWeek]) {
        dowPerformance[day.dayOfWeek].totalSales += day.totalAll;
        dowPerformance[day.dayOfWeek].totalTx += day.txAll;
        dowPerformance[day.dayOfWeek].count += 1;
      }
    });

    const dowStats = Object.entries(dowPerformance)
      .map(([dayName, performance]) => {
        const averageSales = performance.count > 0 ? performance.totalSales / performance.count : 0;
        const averageTx = performance.count > 0 ? performance.totalTx / performance.count : 0;
        return {
          dayName,
          averageSales,
          averageTx,
          totalSales: performance.totalSales,
          count: performance.count
        };
      })
      .sort((a, b) => b.averageSales - a.averageSales);

    return {
      totalSales,
      totalTx,
      avgDailySales,
      avgDailyTx,
      aov,
      maxSales,
      maxSalesDate,
      minSales: minSales === Infinity ? 0 : minSales,
      minSalesDate: minSalesDate === '' ? '-' : minSalesDate,
      dowStats,
      channelSplit: {
        instan: { sales: totalInstanSales, tx: totalInstanTx, pct: totalSales > 0 ? (totalInstanSales / totalSales) * 100 : 0 },
        reguler: { sales: totalRegulerSales, tx: totalRegulerTx, pct: totalSales > 0 ? (totalRegulerSales / totalSales) * 100 : 0 },
        manual: { sales: totalManualSales, tx: totalManualTx, pct: totalSales > 0 ? (totalManualSales / totalSales) * 100 : 0 },
      }
    };
  }, [salesData]);

  if (!stats) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded-2xl">
        Belum ada data penjualan harian untuk dianalisa.
      </div>
    );
  }

  const bestDayName = stats.dowStats[0]?.dayName;
  const worstDayName = stats.dowStats[stats.dowStats.length - 1]?.dayName;

  // Selected month for the 3-tier target tracking
  const [selectedTargetMonth, setSelectedTargetMonth] = useState<string>('');

  // Period filter state for Distribution Channel Composition (default to harian)
  const [distributionPeriod, setDistributionPeriod] = useState<'harian' | 'mingguan' | 'bulanan' | 'total'>('harian');

  // Extract available months from sheet LIST MENU PENJUALAN (Kolom 3: Tanggal)
  const availableMonths = useMemo(() => {
    const dataSource = allOrders && allOrders.length > 0 ? allOrders : rawOrders;
    
    if (dataSource && dataSource.length > 0) {
      const monthsMap = new Map<string, { yearMonth: string; label: string; totalSales: number; totalTx: number }>();
      
      dataSource.forEach(ord => {
        if (ord.isVoid) return;
        if (selectedAdmin && (ord.admin || ord.createdBy || '').trim() !== selectedAdmin) return;

        const dateStr = ord.date; // Kolom 3: Tanggal
        if (!dateStr || dateStr.length < 7) return;
        const yearMonth = dateStr.substring(0, 7); // "YYYY-MM"
        
        if (!monthsMap.has(yearMonth)) {
          const label = formatMonthIndo(yearMonth);
          monthsMap.set(yearMonth, { yearMonth, label, totalSales: 0, totalTx: 0 });
        }
        
        const m = monthsMap.get(yearMonth)!;
        m.totalSales += ord.total || 0;
        m.totalTx += 1;
      });

      return Array.from(monthsMap.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    }

    // Fallback if rawOrders not yet populated
    const monthsMap = new Map<string, { yearMonth: string; label: string; totalSales: number; totalTx: number }>();
    salesData.forEach(day => {
      const yearMonth = day.date.substring(0, 7);
      if (!monthsMap.has(yearMonth)) {
        const label = formatMonthIndo(yearMonth);
        monthsMap.set(yearMonth, { yearMonth, label, totalSales: 0, totalTx: 0 });
      }
      const m = monthsMap.get(yearMonth)!;
      m.totalSales += day.totalAll;
      m.totalTx += day.txAll;
    });

    return Array.from(monthsMap.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  }, [allOrders, rawOrders, selectedAdmin, salesData]);

  // Set initial selected target month to the latest month in dataset
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedTargetMonth) {
      // Find latest month
      const sortedMonths = [...availableMonths].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
      setSelectedTargetMonth(sortedMonths[sortedMonths.length - 1].yearMonth);
    }
  }, [availableMonths, selectedTargetMonth]);

  // Get current selected month sales info
  const selectedMonthInfo = useMemo(() => {
    if (selectedTargetMonth === 'all') {
      const allSales = availableMonths.reduce((sum, m) => sum + m.totalSales, 0);
      const allTx = availableMonths.reduce((sum, m) => sum + m.totalTx, 0);
      return { yearMonth: 'all', label: 'Semua Bulan', totalSales: allSales, totalTx: allTx };
    }
    if (!selectedTargetMonth) return { label: '-', totalSales: 0, totalTx: 0, yearMonth: '' };
    const found = availableMonths.find(m => m.yearMonth === selectedTargetMonth);
    if (found) return found;
    
    // Fallback if not found in precalculated list
    const labelParts = selectedTargetMonth.split('-');
    const label = labelParts.length >= 2 ? `${labelParts[1]}/${labelParts[0]}` : selectedTargetMonth;
    return { yearMonth: selectedTargetMonth, label, totalSales: 0, totalTx: 0 };
  }, [availableMonths, selectedTargetMonth]);

  const todayComparison = useMemo(() => {
    if (salesData.length === 0) return null;

    // Chronologically sort data
    const sorted = [...salesData].sort((a, b) => a.date.localeCompare(b.date));

    // Pick the latest day in the dataset (latest real transaction in LIST MENU PENJUALAN)
    const latestIndex = sorted.length - 1;
    const latestDay = sorted[latestIndex];

    // Get preceding 7 days relative to the resolved latestDay
    const preceding7Days = sorted.slice(Math.max(0, latestIndex - 7), latestIndex);
    
    if (preceding7Days.length === 0) {
      return {
        latestDay,
        avgPrev7Days: 0,
        diffVal: 0,
        diffPct: 0,
        isHigher: false,
        isEqual: true,
        hasHistory: false
      };
    }

    const totalPrev7Days = preceding7Days.reduce((sum, d) => sum + d.totalAll, 0);
    const avgPrev7Days = totalPrev7Days / preceding7Days.length;
    const diffVal = latestDay.totalAll - avgPrev7Days;
    const diffPct = avgPrev7Days > 0 ? (diffVal / avgPrev7Days) * 100 : 0;

    return {
      latestDay,
      avgPrev7Days,
      diffVal,
      diffPct,
      isHigher: diffVal > 0,
      isEqual: diffVal === 0,
      hasHistory: true
    };
  }, [salesData]);

  // Aggregated Store (Kolom 6), Admin (Kolom 10), and Status (Kolom 13) analytics from raw orders
  // Automatically follows the selected month from Target Penjualan Berjenjang
  const storeAndAdminStats = useMemo(() => {
    const baseOrdersForStores = rawOrders && rawOrders.length > 0 ? rawOrders : (allOrders || []);
    const baseOrdersForAdmins = allOrders && allOrders.length > 0 ? allOrders : (rawOrders || []);

    if (baseOrdersForStores.length === 0 && baseOrdersForAdmins.length === 0) return null;

    // Filter by selected target month if specific month chosen (e.g. "2026-10")
    const filteredStoreOrders = selectedTargetMonth && selectedTargetMonth !== 'all'
      ? baseOrdersForStores.filter(ord => ord.date && ord.date.startsWith(selectedTargetMonth))
      : baseOrdersForStores;

    const filteredAdminOrders = selectedTargetMonth && selectedTargetMonth !== 'all'
      ? baseOrdersForAdmins.filter(ord => ord.date && ord.date.startsWith(selectedTargetMonth))
      : baseOrdersForAdmins;

    const storeMap = new Map<string, { name: string; sales: number; tx: number; instanTx: number; regulerTx: number; manualTx: number }>();
    const adminMap = new Map<string, { name: string; sales: number; tx: number }>();
    const statusMap = new Map<string, { status: string; count: number; sales: number }>();

    let totalStoreSales = 0;
    let totalStoreTx = 0;

    filteredStoreOrders.forEach(ord => {
      if (ord.isVoid) return;
      const storeName = ord.tokoOnline || ord.customer || 'Lainnya';
      const status = ord.status || 'Tidak Diketahui';
      const total = ord.total || 0;

      totalStoreSales += total;
      totalStoreTx += 1;

      // Store stats
      if (!storeMap.has(storeName)) {
        storeMap.set(storeName, { name: storeName, sales: 0, tx: 0, instanTx: 0, regulerTx: 0, manualTx: 0 });
      }
      const s = storeMap.get(storeName)!;
      s.sales += total;
      s.tx += 1;
      if (ord.orderCategory === 'instan') s.instanTx += 1;
      else if (ord.orderCategory === 'manual') s.manualTx += 1;
      else s.regulerTx += 1;

      // Status stats
      if (!statusMap.has(status)) {
        statusMap.set(status, { status, count: 0, sales: 0 });
      }
      const st = statusMap.get(status)!;
      st.count += 1;
      st.sales += total;
    });

    filteredAdminOrders.forEach(ord => {
      if (ord.isVoid) return;
      const adminName = (ord.admin || ord.createdBy || '').trim();
      const total = ord.total || 0;

      if (adminName && adminName !== '-' && adminName.toLowerCase() !== 'lainnya') {
        if (!adminMap.has(adminName)) {
          adminMap.set(adminName, { name: adminName, sales: 0, tx: 0 });
        }
        const a = adminMap.get(adminName)!;
        a.sales += total;
        a.tx += 1;
      }
    });

    let totalAdminSales = 0;
    let totalAdminTx = 0;
    adminMap.forEach(a => {
      totalAdminSales += a.sales;
      totalAdminTx += a.tx;
    });

    const stores = Array.from(storeMap.values()).sort((a, b) => b.sales - a.sales);
    const admins = Array.from(adminMap.values()).sort((a, b) => b.sales - a.sales);
    const statuses = Array.from(statusMap.values()).sort((a, b) => b.count - a.count);

    return {
      stores,
      admins,
      statuses,
      totalStoreSales,
      totalStoreTx,
      totalAdminSales,
      totalAdminTx,
      selectedMonthLabel: selectedMonthInfo.label
    };
  }, [rawOrders, allOrders, selectedTargetMonth, selectedMonthInfo]);

  // Dynamically scale channel splits based on distribution period (harian, mingguan, bulanan, total)
  const scaledChannelData = useMemo(() => {
    const daysCount = salesData.length || 1;
    
    let scaleFactor = 1;
    let label = 'Total';
    
    if (distributionPeriod === 'harian') {
      scaleFactor = 1 / daysCount;
      label = 'Rata-rata Harian';
    } else if (distributionPeriod === 'mingguan') {
      scaleFactor = 7 / daysCount;
      label = 'Rata-rata Mingguan (7 Hari)';
    } else if (distributionPeriod === 'bulanan') {
      scaleFactor = 30 / daysCount;
      label = 'Rata-rata Bulanan (30 Hari)';
    } else {
      scaleFactor = 1;
      label = 'Total Seluruh Periode';
    }

    const instanSales = stats.channelSplit.instan.sales * scaleFactor;
    const instanTx = stats.channelSplit.instan.tx * scaleFactor;
    const regulerSales = stats.channelSplit.reguler.sales * scaleFactor;
    const regulerTx = stats.channelSplit.reguler.tx * scaleFactor;
    const manualSales = stats.channelSplit.manual.sales * scaleFactor;
    const manualTx = stats.channelSplit.manual.tx * scaleFactor;

    return {
      label,
      instan: { sales: instanSales, tx: instanTx, pct: stats.channelSplit.instan.pct },
      reguler: { sales: regulerSales, tx: regulerTx, pct: stats.channelSplit.reguler.pct },
      manual: { sales: manualSales, tx: manualTx, pct: stats.channelSplit.manual.pct }
    };
  }, [salesData, stats, distributionPeriod]);

  return (
    <div className="space-y-6">
      {/* Active Admin Monitoring Banner */}
      {selectedAdmin && (
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-sm shrink-0 border border-white/20">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
                  Performa Harian Admin (Kolom 10)
                </span>
                <span className="text-xs text-indigo-200 font-semibold hidden sm:inline">Sheet LIST MENU PENJUALAN</span>
              </div>
              <h3 className="text-sm sm:text-base font-black tracking-tight mt-1 flex items-center gap-2">
                <span>Memantau Kinerja Admin:</span>
                <span className="underline decoration-indigo-300 underline-offset-4">{selectedAdmin}</span>
              </h3>
            </div>
          </div>
          {onSelectAdmin && (
            <button
              onClick={() => onSelectAdmin('')}
              className="px-4 py-2 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 text-xs font-black uppercase tracking-wider transition-all self-start sm:self-auto cursor-pointer shadow-sm shrink-0"
              title="Kembali ke performa gabungan semua admin"
            >
              Lihat Semua Admin
            </button>
          )}
        </div>
      )}

      {/* Prime KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-5">
        
        {/* KPI 0: Today's Sales with Trend Arrow */}
        {todayComparison && (
          <div className="relative overflow-hidden bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 group hover:shadow-md transition-all duration-300 col-span-2 lg:col-span-1">
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-rose-50/50 opacity-40 group-hover:scale-125 transition-all duration-500 blur-2xl"></div>
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex justify-between items-center mb-4">
                <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
                  <DollarSign className="w-5 h-5" />
                </div>
                <span className="text-[10px] sm:text-xs bg-rose-100 text-rose-800 font-black px-2.5 sm:px-3 py-1 rounded-full uppercase tracking-wider">Omzet Hari Ini</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  {formatDateIndo(todayComparison.latestDay.date)}
                </p>
                <h3 className="text-xl min-[400px]:text-2xl sm:text-3xl lg:text-lg xl:text-[15px] 2xl:text-xl font-black text-slate-800 tracking-tighter leading-none font-mono whitespace-nowrap overflow-x-auto py-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {formatRupiah(todayComparison.latestDay.totalAll)}
                </h3>
                
                {/* Arrow Trend Indicator */}
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  {todayComparison.hasHistory ? (
                    <>
                      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black ${
                        todayComparison.isHigher 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : todayComparison.isEqual
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {todayComparison.isHigher ? (
                          <ArrowUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : todayComparison.isEqual ? (
                          <Activity className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        )}
                        <span>{Math.abs(todayComparison.diffPct).toFixed(1)}%</span>
                      </div>
                      <span className="text-xs font-bold text-slate-400">
                        vs rerata: <span className="font-mono text-slate-500 font-black">{formatRupiahCompact(todayComparison.avgPrev7Days)}</span>
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 font-bold">Data history minim</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI 1: Total Revenue */}
        <div className="relative overflow-hidden bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 group hover:shadow-md transition-all duration-300 col-span-2 lg:col-span-1">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-indigo-50 opacity-40 group-hover:scale-125 transition-all duration-500 blur-2xl"></div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex justify-between items-center mb-4">
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-xs bg-indigo-100 text-indigo-800 font-black px-2.5 sm:px-3 py-1 rounded-full uppercase tracking-wider">Omzet Total</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Akumulasi Penjualan</p>
              <h3 className="text-xl min-[400px]:text-2xl sm:text-3xl lg:text-lg xl:text-[15px] 2xl:text-xl font-black text-slate-800 tracking-tighter leading-none font-mono whitespace-nowrap overflow-x-auto py-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {formatRupiah(stats.totalSales)}
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-3.5">Dari total <span className="text-indigo-600 font-black font-mono">{salesData.length}</span> hari operasional</p>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Volume */}
        <div className="relative overflow-hidden bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 group hover:shadow-md transition-all duration-300 col-span-1">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-emerald-50 opacity-40 group-hover:scale-125 transition-all duration-500 blur-2xl"></div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex justify-between items-center mb-4">
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-xs bg-emerald-100 text-emerald-800 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">Volume</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Order</p>
              <h3 className="text-lg sm:text-2xl font-black text-slate-800 tracking-tight leading-none font-mono">
                {formatNumberIndo(stats.totalTx)} <span className="text-xs sm:text-sm font-black text-slate-400">Tx</span>
              </h3>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-3.5">Rerata <span className="text-emerald-600 font-black font-mono">{Math.round(stats.avgDailyTx)}</span> / hari</p>
            </div>
          </div>
        </div>

        {/* KPI 3: Average Daily Sales */}
        <div className="relative overflow-hidden bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 group hover:shadow-md transition-all duration-300 col-span-1">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-amber-50 opacity-40 group-hover:scale-125 transition-all duration-500 blur-2xl"></div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex justify-between items-center mb-4">
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-xs bg-amber-100 text-amber-800 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">Rerata</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Omzet / Hari</p>
              <h3 className="text-base min-[360px]:text-lg sm:text-xl xl:text-[14px] 2xl:text-lg font-black text-slate-800 tracking-tighter leading-none font-mono whitespace-nowrap overflow-x-auto py-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {formatRupiah(stats.avgDailySales)}
              </h3>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-3.5">AOV <span className="text-amber-600 font-black font-mono">{formatRupiahCompact(stats.aov)}</span></p>
            </div>
          </div>
        </div>

        {/* KPI 4: Top Channel */}
        <div className="relative overflow-hidden bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 group hover:shadow-md transition-all duration-300 col-span-2 lg:col-span-1">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-rose-50 opacity-40 group-hover:scale-125 transition-all duration-500 blur-2xl"></div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex justify-between items-center mb-4">
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-xs bg-rose-100 text-rose-800 font-black px-2.5 sm:px-3 py-1 rounded-full uppercase tracking-wider">Channel Utama</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Jalur Terkuat</p>
              <h3 className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight leading-none font-mono">
                {stats.channelSplit.instan.sales > stats.channelSplit.reguler.sales ? 'INSTAN' : 'REGULER'}
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-3.5">
                Kontribusi <span className="text-rose-600 font-black font-mono">{Math.max(stats.channelSplit.instan.pct, stats.channelSplit.reguler.pct).toFixed(1)}%</span> dari total omzet
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Target Penjualan Berjenjang (3 Level) Tracker */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h4 className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500 animate-pulse shrink-0" />
              Target Penjualan Berjenjang (3 Level) - Bulanan
            </h4>
            <p className="text-xs text-slate-500 font-semibold mt-1">Sistem target omzet bulanan berkala untuk melacak pencapaian performa toko per bulan.</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl text-left md:text-right w-full md:w-auto shrink-0 shadow-inner">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none mb-1">Omzet Terpilih ({selectedMonthInfo.label})</span>
            <span className="text-lg font-black text-slate-800 font-mono leading-none block">{formatRupiah(selectedMonthInfo.totalSales)}</span>
          </div>
        </div>

        {/* Month Selector Buttons */}
        {availableMonths.length > 0 && (
          <div className="flex gap-2 pb-3 overflow-x-auto border-b border-slate-100 -mx-4 px-4 sm:-mx-6 sm:px-6 md:flex-wrap md:overflow-x-visible md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button
              type="button"
              onClick={() => setSelectedTargetMonth('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-2 shrink-0 ${
                selectedTargetMonth === 'all'
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Semua Bulan</span>
              <span className={`ml-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                selectedTargetMonth === 'all'
                  ? 'bg-indigo-700/85 text-indigo-50'
                  : 'bg-slate-200 text-slate-600 font-mono'
              }`}>
                {formatRupiahCompact(availableMonths.reduce((s, m) => s + m.totalSales, 0))}
              </span>
            </button>
            {availableMonths.map((month) => (
              <button
                key={month.yearMonth}
                type="button"
                onClick={() => setSelectedTargetMonth(month.yearMonth)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-2 shrink-0 ${
                  selectedTargetMonth === month.yearMonth
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>{month.label}</span>
                <span className={`ml-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                  selectedTargetMonth === month.yearMonth
                    ? 'bg-indigo-700/85 text-indigo-50'
                    : 'bg-slate-200 text-slate-600 font-mono'
                }`}>
                  {formatRupiahCompact(month.totalSales)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Master Progress Bar with Level Pinpoints */}
        <div className="space-y-3 pt-2">
          <div className="relative h-4 bg-slate-100 rounded-full border border-slate-200/50">
            {/* The fill */}
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full transition-all duration-1000 relative shadow-inner"
              style={{ width: `${Math.min((selectedMonthInfo.totalSales / 850000000) * 100, 100)}%` }}
            />

            {/* Level 1 pin */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${(600000000 / 850000000) * 100}%` }}
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 ${selectedMonthInfo.totalSales >= 600000000 ? 'bg-amber-600 border-white' : 'bg-white border-slate-300'} shadow-sm z-10`} />
              <span className="text-[10px] font-bold text-slate-500 mt-6 absolute whitespace-nowrap">Lvl 1 (600M)</span>
            </div>

            {/* Level 2 pin */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${(700000000 / 850000000) * 100}%` }}
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 ${selectedMonthInfo.totalSales >= 700000000 ? 'bg-purple-600 border-white' : 'bg-white border-slate-300'} shadow-sm z-10`} />
              <span className="text-[10px] font-bold text-slate-500 mt-6 absolute whitespace-nowrap">Lvl 2 (700M)</span>
            </div>

            {/* Level 3 pin */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${(800000000 / 850000000) * 100}%` }}
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 ${selectedMonthInfo.totalSales >= 800000000 ? 'bg-emerald-500 border-white animate-bounce' : 'bg-white border-slate-300'} shadow-sm z-10`} />
              <span className="text-[10px] font-bold text-slate-500 mt-6 absolute whitespace-nowrap">Lvl 3 (800M)</span>
            </div>
          </div>
          {/* Spacer for label heights */}
          <div className="h-6" />
        </div>

        {/* Level Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Level 1 Card */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            selectedMonthInfo.totalSales >= 600000000
              ? 'bg-amber-50/50 border-amber-200/60 shadow-sm shadow-amber-100/30'
              : 'bg-slate-50/40 border-slate-100'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl shrink-0 ${
                  selectedMonthInfo.totalSales >= 600000000 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-black uppercase text-slate-800 tracking-wider leading-none">Target Level 1</h5>
                  <p className="text-[10px] sm:text-xs text-amber-800 font-bold mt-1">Sertifikasi Bronze</p>
                </div>
              </div>
              {selectedMonthInfo.totalSales >= 600000000 ? (
                <span className="text-[10px] sm:text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200/40 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Achieved
                </span>
              ) : (
                <span className="text-[10px] sm:text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 flex items-center gap-1 shrink-0">
                  <Lock className="w-3.5 h-3.5" /> Locked
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs sm:text-sm font-bold text-slate-400">Target Omzet</span>
                <span className="text-sm sm:text-base font-black text-slate-800 font-mono">Rp 600.000.000</span>
              </div>
              
              <div className="flex justify-between items-center text-xs text-slate-500 font-bold mt-2">
                <span>Progress</span>
                <span className="font-mono">{Math.min((selectedMonthInfo.totalSales / 600000000) * 100, 100).toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${selectedMonthInfo.totalSales >= 600000000 ? 'bg-amber-500' : 'bg-indigo-400'}`}
                  style={{ width: `${Math.min((selectedMonthInfo.totalSales / 600000000) * 100, 100)}%` }}
                />
              </div>

              <p className="text-xs font-semibold text-slate-500 mt-2">
                {selectedMonthInfo.totalSales >= 600000000 ? (
                  <span className="text-emerald-600 font-bold">🎉 Selamat! Target level 1 terlampaui.</span>
                ) : (
                  <span>Butuh <strong className="text-slate-600 font-bold">{formatRupiahCompact(600000000 - selectedMonthInfo.totalSales)}</strong> lagi untuk mencapai level ini.</span>
                )}
              </p>
            </div>
          </div>

          {/* Level 2 Card */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            selectedMonthInfo.totalSales >= 700000000
              ? 'bg-purple-50/50 border-purple-200/60 shadow-sm shadow-purple-100/30'
              : 'bg-slate-50/40 border-slate-100'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl shrink-0 ${
                  selectedMonthInfo.totalSales >= 700000000 ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-black uppercase text-slate-800 tracking-wider leading-none">Target Level 2</h5>
                  <p className="text-[10px] sm:text-xs text-purple-800 font-bold mt-1">Sertifikasi Silver</p>
                </div>
              </div>
              {selectedMonthInfo.totalSales >= 700000000 ? (
                <span className="text-[10px] sm:text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200/40 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Achieved
                </span>
              ) : (
                <span className="text-[10px] sm:text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 flex items-center gap-1 shrink-0">
                  <Lock className="w-3.5 h-3.5" /> Locked
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs sm:text-sm font-bold text-slate-400">Target Omzet</span>
                <span className="text-sm sm:text-base font-black text-slate-800 font-mono">Rp 700.000.000</span>
              </div>
              
              <div className="flex justify-between items-center text-xs text-slate-500 font-bold mt-2">
                <span>Progress</span>
                <span className="font-mono">{Math.min((selectedMonthInfo.totalSales / 700000000) * 100, 100).toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${selectedMonthInfo.totalSales >= 700000000 ? 'bg-purple-500' : 'bg-indigo-400'}`}
                  style={{ width: `${Math.min((selectedMonthInfo.totalSales / 700000000) * 100, 100)}%` }}
                />
              </div>

              <p className="text-xs font-semibold text-slate-500 mt-2">
                {selectedMonthInfo.totalSales >= 700000000 ? (
                  <span className="text-emerald-600 font-bold">🎉 Hebat! Target level 2 berhasil ditembus.</span>
                ) : (
                  <span>Butuh <strong className="text-slate-600 font-bold">{formatRupiahCompact(700000000 - selectedMonthInfo.totalSales)}</strong> lagi untuk mencapai level ini.</span>
                )}
              </p>
            </div>
          </div>

          {/* Level 3 Card */}
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all sm:col-span-2 lg:col-span-1 ${
            selectedMonthInfo.totalSales >= 800000000
              ? 'bg-indigo-50/50 border-indigo-200/60 shadow-sm shadow-indigo-100/30'
              : 'bg-slate-50/40 border-slate-100'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl shrink-0 ${
                  selectedMonthInfo.totalSales >= 800000000 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-black uppercase text-slate-800 tracking-wider leading-none">Target Level 3</h5>
                  <p className="text-[10px] sm:text-xs text-indigo-800 font-bold mt-1">Sertifikasi Gold</p>
                </div>
              </div>
              {selectedMonthInfo.totalSales >= 800000000 ? (
                <span className="text-[10px] sm:text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200/40 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Achieved
                </span>
              ) : (
                <span className="text-[10px] sm:text-xs font-black uppercase px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 flex items-center gap-1 shrink-0">
                  <Lock className="w-3.5 h-3.5" /> Locked
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs sm:text-sm font-bold text-slate-400">Target Omzet</span>
                <span className="text-sm sm:text-base font-black text-slate-800 font-mono">Rp 800.000.000</span>
              </div>
              
              <div className="flex justify-between items-center text-xs text-slate-500 font-bold mt-2">
                <span>Progress</span>
                <span className="font-mono">{Math.min((selectedMonthInfo.totalSales / 800000000) * 100, 100).toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${selectedMonthInfo.totalSales >= 800000000 ? 'bg-indigo-600' : 'bg-indigo-500'}`}
                  style={{ width: `${Math.min((selectedMonthInfo.totalSales / 800000000) * 100, 100)}%` }}
                />
              </div>

              <p className="text-xs font-semibold text-slate-500 mt-2">
                {selectedMonthInfo.totalSales >= 800000000 ? (
                  <span className="text-emerald-600 font-bold">🏆 Luar Biasa! Anda melampaui Target Utama Level 3!</span>
                ) : (
                  <span>Butuh <strong className="text-slate-600 font-bold">{formatRupiahCompact(800000000 - selectedMonthInfo.totalSales)}</strong> lagi untuk melampaui target utama.</span>
                )}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Channel Splits Breakdown Details */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              Komposisi Penjualan per Jalur Distribusi
            </h4>
            <span className="text-[10px] text-slate-400 font-bold block mt-1">
              Menampilkan {scaledChannelData.label}
            </span>
          </div>
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 self-start sm:self-auto no-print">
            {(['harian', 'mingguan', 'bulanan', 'total'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setDistributionPeriod(period)}
                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  distributionPeriod === period
                    ? 'bg-white text-indigo-600 shadow-sm border-transparent'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {period === 'harian' && 'Harian'}
                {period === 'mingguan' && 'Mingguan'}
                {period === 'bulanan' && 'Bulanan'}
                {period === 'total' && 'Total'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {/* Instan Channel */}
          <div className="bg-emerald-50/50 border border-emerald-100 p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-200/40">Instan</span>
                <span className="text-xs font-bold text-emerald-700">{scaledChannelData.instan.pct.toFixed(1)}%</span>
              </div>
              <p className="text-lg sm:text-xl lg:text-base xl:text-lg font-black text-emerald-950 font-mono tracking-tight whitespace-nowrap overflow-x-auto py-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {formatRupiah(scaledChannelData.instan.sales)}
              </p>
            </div>
            <div className="border-t border-emerald-100 pt-3 mt-3 flex justify-between text-xs font-bold text-emerald-800">
              <span>Transaksi:</span>
              <span>
                {scaledChannelData.instan.tx % 1 === 0 
                  ? formatNumberIndo(scaledChannelData.instan.tx) 
                  : scaledChannelData.instan.tx.toFixed(1)
                } Tx
              </span>
            </div>
          </div>

          {/* Reguler Channel */}
          <div className="bg-indigo-50/50 border border-indigo-100 p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded-md border border-indigo-200/40">Reguler</span>
                <span className="text-xs font-bold text-indigo-700">{scaledChannelData.reguler.pct.toFixed(1)}%</span>
              </div>
              <p className="text-lg sm:text-xl lg:text-base xl:text-lg font-black text-indigo-950 font-mono tracking-tight whitespace-nowrap overflow-x-auto py-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {formatRupiah(scaledChannelData.reguler.sales)}
              </p>
            </div>
            <div className="border-t border-indigo-100 pt-3 mt-3 flex justify-between text-xs font-bold text-indigo-800">
              <span>Transaksi:</span>
              <span>
                {scaledChannelData.reguler.tx % 1 === 0 
                  ? formatNumberIndo(scaledChannelData.reguler.tx) 
                  : scaledChannelData.reguler.tx.toFixed(1)
                } Tx
              </span>
            </div>
          </div>

          {/* Manual Channel */}
          <div className="bg-amber-50/50 border border-amber-100 p-4 sm:p-5 rounded-2xl flex flex-col justify-between sm:col-span-2 lg:col-span-1">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-200/40">Manual</span>
                <span className="text-xs font-bold text-amber-700">{scaledChannelData.manual.pct.toFixed(1)}%</span>
              </div>
              <p className="text-lg sm:text-xl lg:text-base xl:text-lg font-black text-amber-950 font-mono tracking-tight whitespace-nowrap overflow-x-auto py-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {formatRupiah(scaledChannelData.manual.sales)}
              </p>
            </div>
            <div className="border-t border-amber-100 pt-3 mt-3 flex justify-between text-xs font-bold text-amber-800">
              <span>Transaksi:</span>
              <span>
                {scaledChannelData.manual.tx % 1 === 0 
                  ? formatNumberIndo(scaledChannelData.manual.tx) 
                  : scaledChannelData.manual.tx.toFixed(1)
                } Tx
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toko Online (Kolom 6) & Admin Proses Nota (Kolom 10) Breakdown from LIST MENU PENJUALAN */}
      {storeAndAdminStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Toko Online Performance (Kolom 6) */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                        Kinerja Toko Online (Kolom 6)
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">
                        Breakdown Toko • Periode: <span className="text-indigo-600 font-black">{selectedMonthInfo.label}</span> (Sesuai Target)
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    {selectedMonthInfo.label} ({storeAndAdminStats.stores.length} Toko)
                  </span>
                </div>

                <div className="space-y-3.5 mt-5">
                  {storeAndAdminStats.stores.map((store, idx) => {
                    const pctOfTotal = storeAndAdminStats.totalStoreSales > 0 
                      ? (store.sales / storeAndAdminStats.totalStoreSales) * 100 
                      : 0;

                    return (
                      <div key={store.name} className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2 hover:bg-slate-50 transition-all">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-extrabold w-5 h-5 rounded-md bg-white border border-slate-200/60 text-slate-600 flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-black text-slate-800 truncate" title={store.name}>
                              {store.name}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-slate-900 font-mono block">
                              {formatRupiah(store.sales)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(pctOfTotal, 100)}%` }}
                          />
                        </div>

                        {/* Order stats & tags */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold pt-0.5">
                          <span>
                            {pctOfTotal.toFixed(1)}% dari total omzet ({formatNumberIndo(store.tx)} Tx)
                          </span>
                          <div className="flex items-center gap-1.5">
                            {store.instanTx > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100/70 text-emerald-700 text-[9px] font-extrabold">
                                {formatNumberIndo(store.instanTx)} Instan
                              </span>
                            )}
                            {store.regulerTx > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100/70 text-indigo-700 text-[9px] font-extrabold">
                                {formatNumberIndo(store.regulerTx)} Reguler
                              </span>
                            )}
                            {store.manualTx > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-700 text-[9px] font-extrabold">
                                {formatNumberIndo(store.manualTx)} Manual
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-3 text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                <span>Total Omzet Toko ({selectedMonthInfo.label}):</span>
                <span className="font-black text-slate-700 font-mono">{formatRupiah(storeAndAdminStats.totalStoreSales)}</span>
              </div>
            </div>

            {/* Admin Leaderboard (Kolom 10) */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                        Produktivitas Admin (Kolom 10)
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">
                        Peringkat Admin Pemroses Nota • Periode: <span className="text-emerald-700 font-black">{selectedMonthInfo.label}</span> (Sesuai Target)
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {selectedMonthInfo.label} • Leaderboard
                  </span>
                </div>

                <div className="space-y-2.5 mt-5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-2">
                    <span>Pilih admin untuk filter performa harian ({selectedMonthInfo.label}):</span>
                    {selectedAdmin && onSelectAdmin && (
                      <button 
                        onClick={() => onSelectAdmin('')}
                        className="text-indigo-600 hover:text-indigo-800 font-extrabold cursor-pointer"
                      >
                        Reset Pilihan
                      </button>
                    )}
                  </div>
                  {storeAndAdminStats.admins.slice(0, 8).map((admin, idx) => {
                    const medalColors = [
                      'bg-amber-100 text-amber-800 border-amber-200',
                      'bg-slate-200 text-slate-700 border-slate-300',
                      'bg-amber-50 text-amber-700 border-amber-200/60'
                    ];

                    const aov = admin.tx > 0 ? admin.sales / admin.tx : 0;
                    const isSelected = selectedAdmin === admin.name;
                    const totalRef = storeAndAdminStats.totalAdminSales || storeAndAdminStats.totalStoreSales || 1;

                    return (
                      <div 
                        key={admin.name} 
                        onClick={() => onSelectAdmin?.(isSelected ? '' : admin.name)}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                          isSelected
                            ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-400/40 shadow-sm'
                            : idx === 0 
                            ? 'bg-amber-50/40 border-amber-200/50 hover:bg-amber-50/70' 
                            : idx === 1 
                            ? 'bg-slate-50/70 border-slate-200/60 hover:bg-slate-100/70'
                            : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                        title={isSelected ? 'Klik untuk membatalkan filter admin' : `Klik untuk memantau performa harian ${admin.name}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 border ${
                            idx < 3 ? medalColors[idx] : 'bg-slate-50 text-slate-400 border-slate-100'
                          }`}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs truncate block leading-snug ${isSelected ? 'font-black text-indigo-950' : 'font-black text-slate-800'}`} title={admin.name}>
                                {admin.name}
                              </span>
                              {isSelected && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-indigo-600 text-white font-black shrink-0">
                                  Aktif
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {formatNumberIndo(admin.tx)} Nota • Rerata: {formatRupiahCompact(aov)}/nota
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-mono">
                          <span className={`text-xs block ${isSelected ? 'font-black text-indigo-950' : 'font-black text-slate-900'}`}>
                            {formatRupiahCompact(admin.sales)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold block">
                            {((admin.sales / totalRef) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-3 text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                <span>Total Nota Admin ({selectedMonthInfo.label}):</span>
                <span className="font-black text-slate-700 font-mono">
                  {formatNumberIndo(storeAndAdminStats.totalAdminTx || storeAndAdminStats.totalStoreTx)} Transaksi ({formatRupiahCompact(storeAndAdminStats.totalAdminSales)})
                </span>
              </div>
            </div>

          </div>

          {/* Kolom 13 Status & Instan Rule Validation Banner */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-100/80 rounded-3xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-sm shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-xs font-black uppercase text-emerald-950 tracking-wider">
                    Sinkronisasi Kolom Sheet LIST MENU PENJUALAN Aktif
                  </h5>
                  <p className="text-xs text-emerald-800/90 font-medium mt-1 leading-relaxed">
                    Aturan Pesanan Instan aktif: status <span className="font-extrabold text-emerald-950 bg-emerald-100/80 px-1.5 py-0.5 rounded">DIAMBIL</span> (Kolom 13) pada toko official (Kolom 6: ONLINE SHOPEE, ONLINE TIKTOK TOKOPEDIA BALIST, ONLINE SHOPEE GOMART, ONLINE TIKTOK TOPED GOMALL) dikelompokkan sebagai <strong>Pesanan Instan</strong> (21.639 Tx | Rp 3,16 Miliar | 64,1%). Kolom 10 mengalokasikan admin proses nota dan kolom 1 mengidentifikasi ID/No Nota.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* DoW Rank */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Performa Penjualan Berdasarkan Hari Dalam Seminggu
            </h4>
            
            <div className="space-y-3.5">
              {stats.dowStats.map((dow, idx) => {
                const maxDowSales = stats.dowStats[0].averageSales;
                const percentageOfMax = maxDowSales > 0 ? (dow.averageSales / maxDowSales) * 100 : 0;
                
                return (
                  <div key={dow.dayName} className="flex items-center gap-3 sm:gap-4">
                    <span className="text-xs font-black text-slate-500 w-12 sm:w-16 shrink-0">{dow.dayName}</span>
                    <div className="flex-1 bg-slate-50 h-3.5 rounded-xl overflow-hidden border border-slate-100">
                      <div 
                        className={`h-full rounded-xl transition-all duration-1000 ${
                          idx === 0 
                            ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-sm' 
                            : 'bg-indigo-300'
                        }`}
                        style={{ width: `${percentageOfMax}%` }}
                      />
                    </div>
                    <div className="text-right min-w-[95px] sm:min-w-[130px] shrink-0 font-mono">
                      <span className="text-[11px] sm:text-xs font-black text-slate-800 block sm:inline">
                        {formatRupiah(dow.averageSales)}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold sm:ml-1.5 block sm:inline">
                        ({Math.round(dow.averageTx)} Tx)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 bg-slate-50/50 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 sm:p-6 rounded-b-3xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl">
                <Award className="w-5 h-5" />
              </div>
              <div className="text-xs leading-relaxed">
                <p className="font-black text-slate-800">Analisis Kinerja Hari Kerja & Akhir Pekan</p>
                <p className="text-slate-500 font-semibold mt-0.5">
                  Hari <span className="text-indigo-600 font-extrabold">{bestDayName}</span> adalah hari paling produktif dengan omzet rata-rata harian tertinggi (<span className="text-indigo-600 font-extrabold">{formatRupiah(stats.dowStats[0]?.averageSales)}</span>). 
                  Sebaliknya, hari <span className="text-rose-600 font-extrabold">{worstDayName}</span> mencatat kinerja paling landai. Atur jadwal promosi atau tim kerja ekstra di hari padat untuk optimasi konversi.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Highlight Day Records */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-4 w-full">
            <h4 className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-indigo-500" />
              Rekor Penjualan Tertinggi & Terendah
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
              {/* Max Sales */}
              <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">Puncak Rekor</span>
                  <span className="text-xs text-slate-400 font-bold font-mono">{stats.maxSalesDate}</span>
                </div>
                <h5 className="text-base sm:text-lg xl:text-xl font-black text-emerald-950 mt-2 font-mono tracking-tight whitespace-nowrap overflow-x-auto py-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {formatRupiah(stats.maxSales)}
                </h5>
                <p className="text-xs text-slate-500 font-semibold mt-1">Sangat menguntungkan! Hubungkan jadwal ini dengan promo terlapir.</p>
              </div>

              {/* Min Sales */}
              <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-2xl flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">Titik Terendah</span>
                  <span className="text-xs text-slate-400 font-bold font-mono">{stats.minSalesDate}</span>
                </div>
                <h5 className="text-base sm:text-lg xl:text-xl font-black text-rose-950 mt-2 font-mono tracking-tight whitespace-nowrap overflow-x-auto py-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {formatRupiah(stats.minSales)}
                </h5>
                <p className="text-xs text-slate-500 font-semibold mt-1">Omzet landai. Periksa ketersediaan tim atau ada penutupan toko.</p>
              </div>

              {/* Today's Sales Trend Detailed */}
              {todayComparison && (
                <div className={`p-4 rounded-2xl flex flex-col justify-between relative overflow-hidden border ${
                  todayComparison.isHigher 
                    ? 'bg-emerald-50/30 border-emerald-100' 
                    : todayComparison.isEqual
                    ? 'bg-slate-50 border-slate-200/60'
                    : 'bg-rose-50/30 border-rose-100'
                }`}>
                  <div className="flex justify-between items-start">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                      todayComparison.isHigher 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/30' 
                        : todayComparison.isEqual
                        ? 'bg-slate-100 text-slate-600 border border-slate-200/30'
                        : 'bg-rose-100 text-rose-800 border border-rose-200/30'
                    }`}>
                      Perbandingan Hari Ini
                    </span>
                    <span className="text-xs text-slate-400 font-bold font-mono">{todayComparison.latestDay.date}</span>
                  </div>
                  <h5 className="text-base sm:text-lg xl:text-xl font-black text-slate-800 mt-2 font-mono tracking-tight whitespace-nowrap overflow-x-auto py-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {formatRupiah(todayComparison.latestDay.totalAll)}
                  </h5>
                  <p className="text-xs text-slate-500 font-semibold mt-1.5 leading-relaxed">
                    {todayComparison.hasHistory ? (
                      <>
                        Omzet hari ini tercatat{' '}
                        <strong className={todayComparison.isHigher ? 'text-emerald-600 font-extrabold' : 'text-rose-600 font-extrabold'}>
                          {Math.abs(todayComparison.diffPct).toFixed(1)}% {todayComparison.isHigher ? 'lebih tinggi' : 'lebih rendah'}
                        </strong>{' '}
                        dari rerata harian sebelumnya (<span className="font-bold text-slate-700">{formatRupiahCompact(todayComparison.avgPrev7Days)}</span>).
                      </>
                    ) : (
                      'Data riwayat harian sebelumnya tidak mencukupi untuk kalkulasi rerata harian.'
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 font-semibold italic mt-4 border-t border-slate-100 pt-3">
            Analisis data historis ini didasarkan sepenuhnya dari Google Sheet "LIST MENU PENJUALAN".
          </p>
        </div>

      </div>
    </div>
  );
}
