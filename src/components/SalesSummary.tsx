import React, { useState, useEffect, useMemo } from 'react';
import { DailySales } from '../types';
import { formatRupiah, formatNumberIndo, formatRupiahCompact, formatDateIndo } from '../utils';
import { 
  TrendingUp, ShoppingCart, Award, Sparkles, DollarSign,
  ArrowUpRight, BarChart3, HelpCircle, Activity, ShoppingBag,
  ArrowUp, ArrowDown, Trophy, Target, CheckCircle2, Lock, Calendar
} from 'lucide-react';

interface SalesSummaryProps {
  salesData: DailySales[];
}

export default function SalesSummary({ salesData }: SalesSummaryProps) {
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

  // Extract available months from salesData
  const availableMonths = useMemo(() => {
    const monthsMap = new Map<string, { yearMonth: string; label: string; totalSales: number }>();
    
    // Sort salesData chronologically to get correct ordering
    const sortedData = [...salesData].sort((a, b) => a.date.localeCompare(b.date));
    
    sortedData.forEach(day => {
      const parts = day.date.split('-');
      if (parts.length >= 2) {
        const yearMonth = `${parts[0]}-${parts[1]}`;
        const dateObj = new Date(day.date);
        let label = '';
        if (!isNaN(dateObj.getTime())) {
          // Format e.g., "Januari 2026"
          label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(dateObj);
        } else {
          label = yearMonth;
        }
        
        const existing = monthsMap.get(yearMonth);
        if (existing) {
          existing.totalSales += day.totalAll;
        } else {
          monthsMap.set(yearMonth, { yearMonth, label, totalSales: 0 });
        }
      }
    });
    
    // Fill correct totalSales by summing up matching days
    monthsMap.forEach((val, key) => {
      const totalForMonth = salesData
        .filter(day => day.date.startsWith(key))
        .reduce((sum, d) => sum + d.totalAll, 0);
      val.totalSales = totalForMonth;
    });

    return Array.from(monthsMap.values());
  }, [salesData]);

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
    if (!selectedTargetMonth) return { label: '-', totalSales: 0, yearMonth: '' };
    const found = availableMonths.find(m => m.yearMonth === selectedTargetMonth);
    if (found) return found;
    
    // Fallback if not found in precalculated list
    const labelParts = selectedTargetMonth.split('-');
    const label = labelParts.length >= 2 ? `${labelParts[1]}/${labelParts[0]}` : selectedTargetMonth;
    const total = salesData
      .filter(day => day.date.startsWith(selectedTargetMonth))
      .reduce((sum, d) => sum + d.totalAll, 0);
    return { yearMonth: selectedTargetMonth, label, totalSales: total };
  }, [availableMonths, selectedTargetMonth, salesData]);

  const todayComparison = useMemo(() => {
    if (salesData.length === 0) return null;

    // Chronologically sort data to find the latest day
    const sorted = [...salesData].sort((a, b) => a.date.localeCompare(b.date));
    const latestDay = sorted[sorted.length - 1];

    // Get preceding 7 days
    const preceding7Days = sorted.slice(Math.max(0, sorted.length - 8), sorted.length - 1);
    
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

  return (
    <div className="space-y-6">
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
                <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-none font-mono">
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
                      <span className="text-[11px] sm:text-xs font-bold text-slate-400">
                        vs rerata 7hr: <span className="font-mono text-slate-500 font-black">{formatRupiahCompact(todayComparison.avgPrev7Days)}</span>
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
              <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-none font-mono break-all sm:break-normal">
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
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none font-mono">
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
              <h3 className="text-lg sm:text-xl xl:text-2xl font-black text-slate-800 tracking-tight leading-none font-mono">
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Trophy className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
              Target Penjualan Berjenjang (3 Level) - Bulanan
            </h4>
            <p className="text-[11px] text-slate-400 font-bold mt-1">Sistem target omzet bulanan berkala untuk melacak pencapaian performa toko per bulan.</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 px-3.5 py-1.5 rounded-xl text-right w-full md:w-auto">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">Omzet Terpilih ({selectedMonthInfo.label})</span>
            <span className="text-base font-black text-slate-800 font-mono leading-none">{formatRupiah(selectedMonthInfo.totalSales)}</span>
          </div>
        </div>

        {/* Month Selector Buttons */}
        {availableMonths.length > 0 && (
          <div className="flex gap-2 pb-3 overflow-x-auto border-b border-slate-100 -mx-4 px-4 sm:-mx-6 sm:px-6 md:flex-wrap md:overflow-x-visible md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {availableMonths.map((month) => (
              <button
                key={month.yearMonth}
                type="button"
                onClick={() => setSelectedTargetMonth(month.yearMonth)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 shrink-0 ${
                  selectedTargetMonth === month.yearMonth
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{month.label}</span>
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-lg ${
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
              <div className={`w-3.5 h-3.5 rounded-full border-2 ${selectedMonthInfo.totalSales >= 600000000 ? 'bg-indigo-600 border-white' : 'bg-white border-slate-300'} shadow-sm z-10`} />
              <span className="text-[8px] font-black text-slate-400 mt-5 absolute whitespace-nowrap">Lvl 1 (600M)</span>
            </div>

            {/* Level 2 pin */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${(700000000 / 850000000) * 100}%` }}
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 ${selectedMonthInfo.totalSales >= 700000000 ? 'bg-purple-600 border-white' : 'bg-white border-slate-300'} shadow-sm z-10`} />
              <span className="text-[8px] font-black text-slate-400 mt-5 absolute whitespace-nowrap">Lvl 2 (700M)</span>
            </div>

            {/* Level 3 pin */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${(800000000 / 850000000) * 100}%` }}
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 ${selectedMonthInfo.totalSales >= 800000000 ? 'bg-amber-500 border-white animate-bounce' : 'bg-white border-slate-300'} shadow-sm z-10`} />
              <span className="text-[8px] font-black text-slate-400 mt-5 absolute whitespace-nowrap">Lvl 3 (800M)</span>
            </div>
          </div>
          {/* Spacer for label heights */}
          <div className="h-4" />
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
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          Komposisi Penjualan per Jalur Distribusi
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {/* Instan Channel */}
          <div className="bg-emerald-50/50 border border-emerald-100 p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-200/40">Instan</span>
                <span className="text-xs font-bold text-emerald-700">{stats.channelSplit.instan.pct.toFixed(1)}%</span>
              </div>
              <p className="text-xl font-black text-emerald-950 font-mono">{formatRupiah(stats.channelSplit.instan.sales)}</p>
            </div>
            <div className="border-t border-emerald-100 pt-3 mt-3 flex justify-between text-xs font-bold text-emerald-800">
              <span>Transaksi:</span>
              <span>{formatNumberIndo(stats.channelSplit.instan.tx)} Tx</span>
            </div>
          </div>

          {/* Reguler Channel */}
          <div className="bg-indigo-50/50 border border-indigo-100 p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded-md border border-indigo-200/40">Reguler</span>
                <span className="text-xs font-bold text-indigo-700">{stats.channelSplit.reguler.pct.toFixed(1)}%</span>
              </div>
              <p className="text-xl font-black text-indigo-950 font-mono">{formatRupiah(stats.channelSplit.reguler.sales)}</p>
            </div>
            <div className="border-t border-indigo-100 pt-3 mt-3 flex justify-between text-xs font-bold text-indigo-800">
              <span>Transaksi:</span>
              <span>{formatNumberIndo(stats.channelSplit.reguler.tx)} Tx</span>
            </div>
          </div>

          {/* Manual Channel */}
          <div className="bg-amber-50/50 border border-amber-100 p-4 sm:p-5 rounded-2xl flex flex-col justify-between sm:col-span-2 lg:col-span-1">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-200/40">Manual</span>
                <span className="text-xs font-bold text-amber-700">{stats.channelSplit.manual.pct.toFixed(1)}%</span>
              </div>
              <p className="text-xl font-black text-amber-950 font-mono">{formatRupiah(stats.channelSplit.manual.sales)}</p>
            </div>
            <div className="border-t border-amber-100 pt-3 mt-3 flex justify-between text-xs font-bold text-amber-800">
              <span>Transaksi:</span>
              <span>{formatNumberIndo(stats.channelSplit.manual.tx)} Tx</span>
            </div>
          </div>
        </div>
      </div>

      {/* Day of Week Analysis Area */}
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
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <ArrowUpRight className="w-4.5 h-4.5 text-indigo-500" />
              Rekor Penjualan Tertinggi & Terendah
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
              {/* Max Sales */}
              <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-2xl flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">Puncak Rekor</span>
                  <span className="text-[10px] text-slate-400 font-bold font-mono">{stats.maxSalesDate}</span>
                </div>
                <h5 className="text-lg sm:text-xl font-black text-emerald-950 mt-2 font-mono">{formatRupiah(stats.maxSales)}</h5>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">Sangat menguntungkan! Hubungkan jadwal ini dengan promo terlapir.</p>
              </div>

              {/* Min Sales */}
              <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-2xl flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md">Titik Terendah</span>
                  <span className="text-[10px] text-slate-400 font-bold font-mono">{stats.minSalesDate}</span>
                </div>
                <h5 className="text-lg sm:text-xl font-black text-rose-950 mt-2 font-mono">{formatRupiah(stats.minSales)}</h5>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">Omzet landai. Periksa ketersediaan tim atau ada penutupan toko.</p>
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
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                      todayComparison.isHigher 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200/30' 
                        : todayComparison.isEqual
                        ? 'bg-slate-100 text-slate-600 border border-slate-200/30'
                        : 'bg-rose-100 text-rose-800 border border-rose-200/30'
                    }`}>
                      Perbandingan Hari Ini
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold font-mono">{todayComparison.latestDay.date}</span>
                  </div>
                  <h5 className="text-lg sm:text-xl font-black text-slate-800 mt-2 font-mono">
                    {formatRupiah(todayComparison.latestDay.totalAll)}
                  </h5>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1.5 leading-relaxed">
                    {todayComparison.hasHistory ? (
                      <>
                        Omzet hari ini tercatat{' '}
                        <strong className={todayComparison.isHigher ? 'text-emerald-600 font-extrabold' : 'text-rose-600 font-extrabold'}>
                          {Math.abs(todayComparison.diffPct).toFixed(1)}% {todayComparison.isHigher ? 'lebih tinggi' : 'lebih rendah'}
                        </strong>{' '}
                        dari rerata 7 hari sebelumnya (<span className="font-bold text-slate-700">{formatRupiahCompact(todayComparison.avgPrev7Days)}</span>).
                      </>
                    ) : (
                      'Data riwayat harian sebelumnya tidak mencukupi untuk kalkulasi rerata 7 hari.'
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 font-bold italic mt-4 border-t border-slate-100 pt-3">
            Analisis data historis ini didasarkan sepenuhnya dari Google Sheet "Penjualan Harian".
          </p>
        </div>

      </div>
    </div>
  );
}
