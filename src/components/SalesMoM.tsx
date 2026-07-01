import React, { useState, useMemo, useEffect } from 'react';
import { DailySales } from '../types';
import { formatRupiah, formatNumberIndo, formatRupiahCompact } from '../utils';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  Calendar, DollarSign, ShoppingCart, Percent, ArrowRight,
  Activity, Info, Sparkles, ChevronRight, BarChart2
} from 'lucide-react';
import { motion } from 'motion/react';

interface SalesMoMProps {
  salesData: DailySales[];
}

interface MonthStats {
  yearMonth: string;
  label: string;
  totalSales: number;
  totalTx: number;
}

export default function SalesMoM({ salesData }: SalesMoMProps) {
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>('');

  // 1. Group daily sales into monthly buckets (ensuring chronological order)
  const monthlyStats = useMemo<MonthStats[]>(() => {
    if (salesData.length === 0) return [];
    
    const monthsMap = new Map<string, { totalSales: number; totalTx: number }>();
    const sortedData = [...salesData].sort((a, b) => a.date.localeCompare(b.date));
    
    sortedData.forEach(day => {
      const yearMonth = day.date.substring(0, 7); // "YYYY-MM"
      const existing = monthsMap.get(yearMonth);
      if (existing) {
        existing.totalSales += day.totalAll;
        existing.totalTx += day.txAll;
      } else {
        monthsMap.set(yearMonth, { totalSales: day.totalAll, totalTx: day.txAll });
      }
    });

    return Array.from(monthsMap.entries()).map(([yearMonth, stats]) => {
      // Create date object on day 2 to avoid timezone adjustments shifting the month
      const dateObj = new Date(`${yearMonth}-02`);
      let label = yearMonth;
      if (!isNaN(dateObj.getTime())) {
        label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(dateObj);
      }
      return {
        yearMonth,
        label,
        totalSales: stats.totalSales,
        totalTx: stats.totalTx
      };
    }).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  }, [salesData]);

  // 2. Compute MoM comparison metrics for each month compared to its predecessor
  const momGrowthList = useMemo(() => {
    const list = [];
    for (let i = 0; i < monthlyStats.length; i++) {
      const current = monthlyStats[i];
      const prev = i > 0 ? monthlyStats[i - 1] : null;

      let salesGrowthPct = 0;
      let salesDiff = 0;
      if (prev) {
        salesDiff = current.totalSales - prev.totalSales;
        salesGrowthPct = prev.totalSales > 0 ? (salesDiff / prev.totalSales) * 100 : 0;
      }

      let txGrowthPct = 0;
      let txDiff = 0;
      if (prev) {
        txDiff = current.totalTx - prev.totalTx;
        txGrowthPct = prev.totalTx > 0 ? (txDiff / prev.totalTx) * 100 : 0;
      }

      list.push({
        ...current,
        prevMonth: prev,
        salesDiff,
        salesGrowthPct,
        txDiff,
        txGrowthPct
      });
    }
    return list;
  }, [monthlyStats]);

  // 3. Auto-select the latest month that has a comparison month on mount/data change
  useEffect(() => {
    if (momGrowthList.length > 1 && !selectedYearMonth) {
      // Use the last month in the list which has a valid preceding month
      setSelectedYearMonth(momGrowthList[momGrowthList.length - 1].yearMonth);
    } else if (momGrowthList.length === 1 && !selectedYearMonth) {
      // Fallback if there is only 1 month
      setSelectedYearMonth(momGrowthList[0].yearMonth);
    }
  }, [momGrowthList, selectedYearMonth]);

  // 4. Extract metrics for the currently selected month
  const activeMomData = useMemo(() => {
    if (!selectedYearMonth) return null;
    return momGrowthList.find(item => item.yearMonth === selectedYearMonth) || null;
  }, [momGrowthList, selectedYearMonth]);

  if (salesData.length === 0) {
    return (
      <div id="mom-empty-state" className="p-6 bg-slate-50 border border-slate-200 text-slate-500 font-semibold rounded-2xl">
        Belum ada data penjualan untuk menganalisa tren pertumbuhan bulanan.
      </div>
    );
  }

  // If there is only 1 month of data, we cannot calculate MoM growth
  if (monthlyStats.length < 2) {
    return (
      <div id="mom-insufficient-data" className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <Info className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 leading-none">Analisis Pertumbuhan MoM</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Dibutuhkan minimal data dari 2 bulan berbeda</p>
          </div>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs text-slate-500 font-medium">
          Saat ini baru terdapat data untuk 1 bulan saja ({monthlyStats[0]?.label || '-'}). Month-over-Month (MoM) growth akan muncul secara otomatis setelah data bulan baru ditambahkan ke spreadsheet Anda.
        </div>
      </div>
    );
  }

  return (
    <div id="mom-growth-analysis-section" className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 leading-none uppercase tracking-wider">Month-over-Month (MoM) Growth</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Analisa persentase kenaikan/penurunan penjualan dan volume transaksi bulanan harian</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Real-time Growth Trends</span>
        </div>
      </div>

      {/* Month Selection Tabs */}
      <div className="space-y-2">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Pilih Bulan Evaluasi:</span>
        <div id="mom-month-tabs-container" className="flex gap-2 pb-1 overflow-x-auto -mx-2 px-2 scrollbar-hide md:flex-wrap">
          {momGrowthList.map((item, idx) => {
            // We can only compare if there is a previous month, else we show "Awal Data"
            const hasPrev = idx > 0;
            const omzetGrowth = item.salesGrowthPct;
            const isPositive = omzetGrowth >= 0;
            
            return (
              <button
                key={item.yearMonth}
                id={`mom-tab-btn-${item.yearMonth}`}
                type="button"
                onClick={() => setSelectedYearMonth(item.yearMonth)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 shrink-0 border ${
                  selectedYearMonth === item.yearMonth
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                    : 'bg-slate-50 border-slate-200/70 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="font-extrabold">{item.label}</span>
                
                {hasPrev ? (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg ${
                    selectedYearMonth === item.yearMonth
                      ? 'bg-white/20 text-white'
                      : isPositive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50'
                      : 'bg-rose-50 text-rose-700 border border-rose-100/50'
                  }`}>
                    {isPositive ? '+' : ''}{omzetGrowth.toFixed(1)}%
                  </span>
                ) : (
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                    selectedYearMonth === item.yearMonth ? 'bg-white/10 text-indigo-100' : 'bg-slate-200 text-slate-500'
                  }`}>
                    Awal Data
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* MoM Growth Cards */}
      {activeMomData && (
        <div id="mom-growth-cards-grid" className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Card 1: Omzet Growth */}
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            id="mom-omzet-card"
            className={`p-5 sm:p-6 rounded-3xl border transition-all relative overflow-hidden ${
              !activeMomData.prevMonth 
                ? 'bg-slate-50/50 border-slate-200' 
                : activeMomData.salesGrowthPct >= 0
                ? 'bg-emerald-50/30 border-emerald-100 hover:shadow-md hover:shadow-emerald-50/20'
                : 'bg-rose-50/30 border-rose-100 hover:shadow-md hover:shadow-rose-50/20'
            }`}
          >
            {/* Background absolute decor circle */}
            <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full blur-2xl opacity-40 transition-all ${
              !activeMomData.prevMonth
                ? 'bg-slate-200'
                : activeMomData.salesGrowthPct >= 0
                ? 'bg-emerald-200'
                : 'bg-rose-200'
            }`} />

            <div className="relative z-10 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl border ${
                    !activeMomData.prevMonth
                      ? 'bg-slate-100 border-slate-200 text-slate-500'
                      : activeMomData.salesGrowthPct >= 0
                      ? 'bg-emerald-100/60 border-emerald-200 text-emerald-700'
                      : 'bg-rose-100/60 border-rose-200 text-rose-700'
                  }`}>
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-black uppercase text-slate-500 tracking-wider">Pertumbuhan Omzet</span>
                </div>
                
                {activeMomData.prevMonth && (
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${
                    activeMomData.salesGrowthPct >= 0
                      ? 'bg-emerald-100/90 text-emerald-800'
                      : 'bg-rose-100/90 text-rose-800'
                  }`}>
                    {activeMomData.salesGrowthPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {activeMomData.salesGrowthPct >= 0 ? 'Surplus' : 'Defisit'}
                  </span>
                )}
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-widest mb-1">Pertumbuhan MoM</span>
                {activeMomData.prevMonth ? (
                  <h2 className={`text-3xl sm:text-4xl font-black font-mono tracking-tighter leading-none ${
                    activeMomData.salesGrowthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {activeMomData.salesGrowthPct >= 0 ? '+' : ''}
                    {activeMomData.salesGrowthPct.toFixed(2)}%
                  </h2>
                ) : (
                  <h2 className="text-2xl font-black text-slate-400 tracking-tight leading-none">
                    TIDAK TERSEDIA
                  </h2>
                )}
              </div>

              {/* Stats side-by-side details */}
              <div className="pt-4 border-t border-slate-200/50 grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Bulan Ini ({activeMomData.label})</span>
                  <span className="text-xs sm:text-sm font-black text-slate-800 font-mono block">
                    {formatRupiah(activeMomData.totalSales)}
                  </span>
                </div>
                
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Bulan Lalu ({activeMomData.prevMonth?.label || 'Tidak Ada'})</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-500 font-mono block">
                    {activeMomData.prevMonth ? formatRupiah(activeMomData.prevMonth.totalSales) : '-'}
                  </span>
                </div>
              </div>

              {/* Explanatory Narrative */}
              <div className="pt-3 border-t border-slate-200/50 text-[11px] leading-relaxed text-slate-500 font-medium">
                {activeMomData.prevMonth ? (
                  <span>
                    Omzet penjualan bulanan{' '}
                    <strong className={activeMomData.salesGrowthPct >= 0 ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}>
                      {activeMomData.salesGrowthPct >= 0 ? 'meningkat' : 'menurun'}{' '}
                      sebesar {formatRupiah(Math.abs(activeMomData.salesDiff))}
                    </strong>{' '}
                    dibandingkan dengan bulan {activeMomData.prevMonth.label}. Rata-rata pergerakan omzet dipengaruhi oleh frekuensi dan volume promo.
                  </span>
                ) : (
                  <span>Bulan {activeMomData.label} merupakan titik awal rekor penjualan historis dalam spreadsheet Anda, sehingga belum memiliki perbandingan pertumbuhan MoM.</span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Card 2: Transactions Growth */}
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            id="mom-transactions-card"
            className={`p-5 sm:p-6 rounded-3xl border transition-all relative overflow-hidden ${
              !activeMomData.prevMonth 
                ? 'bg-slate-50/50 border-slate-200' 
                : activeMomData.txGrowthPct >= 0
                ? 'bg-emerald-50/30 border-emerald-100 hover:shadow-md hover:shadow-emerald-50/20'
                : 'bg-rose-50/30 border-rose-100 hover:shadow-md hover:shadow-rose-50/20'
            }`}
          >
            {/* Background absolute decor circle */}
            <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full blur-2xl opacity-40 transition-all ${
              !activeMomData.prevMonth
                ? 'bg-slate-200'
                : activeMomData.txGrowthPct >= 0
                ? 'bg-emerald-200'
                : 'bg-rose-200'
            }`} />

            <div className="relative z-10 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl border ${
                    !activeMomData.prevMonth
                      ? 'bg-slate-100 border-slate-200 text-slate-500'
                      : activeMomData.txGrowthPct >= 0
                      ? 'bg-emerald-100/60 border-emerald-200 text-emerald-700'
                      : 'bg-rose-100/60 border-rose-200 text-rose-700'
                  }`}>
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-black uppercase text-slate-500 tracking-wider">Pertumbuhan Transaksi</span>
                </div>
                
                {activeMomData.prevMonth && (
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${
                    activeMomData.txGrowthPct >= 0
                      ? 'bg-emerald-100/90 text-emerald-800'
                      : 'bg-rose-100/90 text-rose-800'
                  }`}>
                    {activeMomData.txGrowthPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {activeMomData.txGrowthPct >= 0 ? 'Surplus' : 'Defisit'}
                  </span>
                )}
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-widest mb-1">Pertumbuhan MoM</span>
                {activeMomData.prevMonth ? (
                  <h2 className={`text-3xl sm:text-4xl font-black font-mono tracking-tighter leading-none ${
                    activeMomData.txGrowthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {activeMomData.txGrowthPct >= 0 ? '+' : ''}
                    {activeMomData.txGrowthPct.toFixed(2)}%
                  </h2>
                ) : (
                  <h2 className="text-2xl font-black text-slate-400 tracking-tight leading-none">
                    TIDAK TERSEDIA
                  </h2>
                )}
              </div>

              {/* Stats side-by-side details */}
              <div className="pt-4 border-t border-slate-200/50 grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Bulan Ini ({activeMomData.label})</span>
                  <span className="text-xs sm:text-sm font-black text-slate-800 font-mono block">
                    {formatNumberIndo(activeMomData.totalTx)} <span className="text-[10px] text-slate-400">Tx</span>
                  </span>
                </div>
                
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Bulan Lalu ({activeMomData.prevMonth?.label || 'Tidak Ada'})</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-500 font-mono block">
                    {activeMomData.prevMonth ? `${formatNumberIndo(activeMomData.prevMonth.totalTx)} Tx` : '-'}
                  </span>
                </div>
              </div>

              {/* Explanatory Narrative */}
              <div className="pt-3 border-t border-slate-200/50 text-[11px] leading-relaxed text-slate-500 font-medium">
                {activeMomData.prevMonth ? (
                  <span>
                    Volume order/transaksi harian bulanan{' '}
                    <strong className={activeMomData.txGrowthPct >= 0 ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}>
                      {activeMomData.txGrowthPct >= 0 ? 'meningkat' : 'menurun'}{' '}
                      sebesar {formatNumberIndo(Math.abs(activeMomData.txDiff))} order
                    </strong>{' '}
                    dibandingkan dengan bulan {activeMomData.prevMonth.label}. Hal ini mengindikasikan tingkat frekuensi konversi pelanggan baru dan loyal.
                  </span>
                ) : (
                  <span>Buku data bulanan ini merupakan entri awal data transaksi Anda sehingga perbandingan data sebelum periode bersangkutan tidak tersedia.</span>
                )}
              </div>
            </div>
          </motion.div>

        </div>
      )}

      {/* MoM Historical List Table */}
      <div id="mom-historical-trends-overview" className="bg-slate-50/50 border border-slate-200/60 p-4 sm:p-5 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4.5 h-4.5 text-indigo-500" />
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Daftar Komparasi &amp; Tren Pertumbuhan Menyeluruh</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="pb-2.5">Bulan Evaluasi</th>
                <th className="pb-2.5 text-right">Total Omzet</th>
                <th className="pb-2.5 text-right">Total Order (Tx)</th>
                <th className="pb-2.5 text-center">Pertumbuhan Omzet</th>
                <th className="pb-2.5 text-center">Pertumbuhan Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-600">
              {momGrowthList.map((item, idx) => {
                const hasPrev = idx > 0;
                const isSelected = selectedYearMonth === item.yearMonth;
                
                return (
                  <tr 
                    key={item.yearMonth}
                    id={`mom-row-${item.yearMonth}`}
                    onClick={() => setSelectedYearMonth(item.yearMonth)}
                    className={`cursor-pointer transition-all hover:bg-slate-100/70 ${
                      isSelected ? 'bg-indigo-50/50 font-bold text-slate-900' : ''
                    }`}
                  >
                    <td className="py-3 px-1 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-indigo-600' : 'bg-transparent'}`} />
                      <span>{item.label}</span>
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-slate-700">
                      {formatRupiah(item.totalSales)}
                    </td>
                    <td className="py-3 text-right font-mono text-slate-500">
                      {formatNumberIndo(item.totalTx)} Tx
                    </td>
                    <td className="py-3 text-center">
                      {hasPrev ? (
                        <span className={`inline-flex items-center gap-0.5 font-bold px-2.5 py-0.5 rounded-lg text-[10.5px] ${
                          item.salesGrowthPct >= 0 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {item.salesGrowthPct >= 0 ? <ArrowUpRight className="w-3 h-3 text-emerald-600" /> : <ArrowDownRight className="w-3 h-3 text-rose-600" />}
                          {item.salesGrowthPct >= 0 ? '+' : ''}{item.salesGrowthPct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded">Awal Data</span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      {hasPrev ? (
                        <span className={`inline-flex items-center gap-0.5 font-bold px-2.5 py-0.5 rounded-lg text-[10.5px] ${
                          item.txGrowthPct >= 0 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {item.txGrowthPct >= 0 ? <ArrowUpRight className="w-3 h-3 text-emerald-600" /> : <ArrowDownRight className="w-3 h-3 text-rose-600" />}
                          {item.txGrowthPct >= 0 ? '+' : ''}{item.txGrowthPct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded">Awal Data</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 font-bold mt-1">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Tips: Klik pada salah satu baris bulan di tabel untuk mengaktifkan komparasi visual interaktif di atas secara langsung.</span>
        </div>
      </div>

    </div>
  );
}
