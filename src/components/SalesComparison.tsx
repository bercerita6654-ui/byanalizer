import React, { useState, useMemo } from 'react';
import { DailySales } from '../types';
import { formatRupiah, formatNumberIndo, formatRupiahCompact } from '../utils';
import { 
  ArrowUpRight, ArrowDownRight, ArrowRight, Calendar, 
  Layers, ShoppingBag, TrendingUp, Sparkles, HelpCircle,
  RefreshCw, Scale, DollarSign, ShoppingCart
} from 'lucide-react';

interface SalesComparisonProps {
  salesData: DailySales[];
}

export default function SalesComparison({ salesData }: SalesComparisonProps) {
  const [enabled, setEnabled] = useState<boolean>(false);

  // Default ranges
  // Given that data is primarily from Jan 1, 2026 to Jun 30, 2026:
  // Range A: Q2 2026 (Apr - Jun)
  // Range B: Q1 2026 (Jan - Mar)
  const [startA, setStartA] = useState<string>('2026-04-01');
  const [endA, setEndA] = useState<string>('2026-06-30');
  
  const [startB, setStartB] = useState<string>('2026-01-01');
  const [endB, setEndB] = useState<string>('2026-03-31');

  // Bounds for dates
  const bounds = useMemo(() => {
    if (salesData.length === 0) return { min: '', max: '' };
    return {
      min: salesData[0].date,
      max: salesData[salesData.length - 1].date
    };
  }, [salesData]);

  // Aggregator helper
  const calculateRangeStats = (start: string, end: string) => {
    const filtered = salesData.filter(d => {
      if (start && d.date < start) return false;
      if (end && d.date > end) return false;
      return true;
    });

    let totalSales = 0;
    let totalTx = 0;
    let totalInstanSales = 0;
    let totalRegulerSales = 0;
    let totalManualSales = 0;
    let totalInstanTx = 0;
    let totalRegulerTx = 0;
    let totalManualTx = 0;

    filtered.forEach(d => {
      totalSales += d.totalAll;
      totalTx += d.txAll;
      totalInstanSales += d.totalInstan;
      totalRegulerSales += d.totalReguler;
      totalManualSales += d.totalManual;
      totalInstanTx += d.txInstan;
      totalRegulerTx += d.txReguler;
      totalManualTx += d.txManual;
    });

    const daysCount = filtered.length || 1;
    const avgDailySales = totalSales / daysCount;
    const aov = totalTx > 0 ? totalSales / totalTx : 0;

    return {
      daysCount,
      totalSales,
      totalTx,
      avgDailySales,
      aov,
      channels: {
        instan: { sales: totalInstanSales, tx: totalInstanTx },
        reguler: { sales: totalRegulerSales, tx: totalRegulerTx },
        manual: { sales: totalManualSales, tx: totalManualTx }
      }
    };
  };

  const stats = useMemo(() => {
    if (salesData.length === 0) return null;
    const statsA = calculateRangeStats(startA, endA);
    const statsB = calculateRangeStats(startB, endB);

    // Percentage diff calculator helper (relative to B)
    const getDiffPct = (valA: number, valB: number) => {
      if (valB === 0) return valA > 0 ? 100 : 0;
      return ((valA - valB) / valB) * 100;
    };

    return {
      statsA,
      statsB,
      comparison: {
        totalSales: {
          diff: statsA.totalSales - statsB.totalSales,
          pct: getDiffPct(statsA.totalSales, statsB.totalSales)
        },
        totalTx: {
          diff: statsA.totalTx - statsB.totalTx,
          pct: getDiffPct(statsA.totalTx, statsB.totalTx)
        },
        avgDailySales: {
          diff: statsA.avgDailySales - statsB.avgDailySales,
          pct: getDiffPct(statsA.avgDailySales, statsB.avgDailySales)
        },
        aov: {
          diff: statsA.aov - statsB.aov,
          pct: getDiffPct(statsA.aov, statsB.aov)
        },
        channels: {
          instan: {
            salesPct: getDiffPct(statsA.channels.instan.sales, statsB.channels.instan.sales),
            txPct: getDiffPct(statsA.channels.instan.tx, statsB.channels.instan.tx)
          },
          reguler: {
            salesPct: getDiffPct(statsA.channels.reguler.sales, statsB.channels.reguler.sales),
            txPct: getDiffPct(statsA.channels.reguler.tx, statsB.channels.reguler.tx)
          },
          manual: {
            salesPct: getDiffPct(statsA.channels.manual.sales, statsB.channels.manual.sales),
            txPct: getDiffPct(statsA.channels.manual.tx, statsB.channels.manual.tx)
          }
        }
      }
    };
  }, [salesData, startA, endA, startB, endB]);

  // Set preset ranges
  const applyComparisonPreset = (type: 'q2vsq1' | 'last30vsprior' | 'last7vsprior') => {
    if (salesData.length === 0) return;
    const maxDateStr = salesData[salesData.length - 1].date;
    const maxDate = new Date(maxDateStr);

    if (type === 'q2vsq1') {
      const year = maxDateStr.substring(0, 4);
      setStartA(`${year}-04-01`);
      setEndA(`${year}-06-30`);
      setStartB(`${year}-01-01`);
      setEndB(`${year}-03-31`);
    } else if (type === 'last30vsprior') {
      // Last 30 days
      const dateA_End = new Date(maxDate);
      const dateA_Start = new Date(maxDate);
      dateA_Start.setDate(dateA_Start.getDate() - 29);

      // Prior 30 days
      const dateB_End = new Date(dateA_Start);
      dateB_End.setDate(dateB_End.getDate() - 1);
      const dateB_Start = new Date(dateB_End);
      dateB_Start.setDate(dateB_Start.getDate() - 29);

      setStartA(dateA_Start.toISOString().substring(0, 10));
      setEndA(dateA_End.toISOString().substring(0, 10));
      setStartB(dateB_Start.toISOString().substring(0, 10));
      setEndB(dateB_End.toISOString().substring(0, 10));
    } else if (type === 'last7vsprior') {
      // Last 7 days
      const dateA_End = new Date(maxDate);
      const dateA_Start = new Date(maxDate);
      dateA_Start.setDate(dateA_Start.getDate() - 6);

      // Prior 7 days
      const dateB_End = new Date(dateA_Start);
      dateB_End.setDate(dateB_End.getDate() - 1);
      const dateB_Start = new Date(dateB_End);
      dateB_Start.setDate(dateB_Start.getDate() - 6);

      setStartA(dateA_Start.toISOString().substring(0, 10));
      setEndA(dateA_End.toISOString().substring(0, 10));
      setStartB(dateB_Start.toISOString().substring(0, 10));
      setEndB(dateB_End.toISOString().substring(0, 10));
    }
  };

  const renderBadge = (pct: number) => {
    const isPositive = pct >= 0;
    const formatted = pct.toFixed(1);
    const sign = isPositive ? '+' : '';
    
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full ${
        isPositive 
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' 
          : 'bg-rose-50 border border-rose-200 text-rose-700'
      }`}>
        {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
        {sign}{formatted}%
      </span>
    );
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      
      {/* Title with expander toggle */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 leading-none">Perbandingan Periode Penjualan</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Bandingkan performa dua rentang tanggal khusus berdampingan</p>
          </div>
        </div>

        <button
          onClick={() => setEnabled(!enabled)}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
            enabled 
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {enabled ? 'Sembunyikan Perbandingan' : 'Aktifkan Perbandingan'}
        </button>
      </div>

      {enabled && stats && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Dual Range Configurations Card */}
          <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl space-y-4">
            
            {/* Range controls inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Range A */}
              <div className="space-y-3 p-4 bg-white border border-slate-200/50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/40">Periode Utama (A)</span>
                  <span className="text-[10px] text-slate-400 font-bold">{stats.statsA.daysCount} hari aktif</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Mulai</label>
                    <input
                      type="date"
                      value={startA}
                      min={bounds.min}
                      max={bounds.max}
                      onChange={e => setStartA(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 bg-slate-50/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Selesai</label>
                    <input
                      type="date"
                      value={endA}
                      min={bounds.min}
                      max={bounds.max}
                      onChange={e => setEndA(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 bg-slate-50/30"
                    />
                  </div>
                </div>
              </div>

              {/* Range B */}
              <div className="space-y-3 p-4 bg-white border border-slate-200/50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/40">Periode Pembanding (B)</span>
                  <span className="text-[10px] text-slate-400 font-bold">{stats.statsB.daysCount} hari aktif</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Mulai</label>
                    <input
                      type="date"
                      value={startB}
                      min={bounds.min}
                      max={bounds.max}
                      onChange={e => setStartB(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 bg-slate-50/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400">Selesai</label>
                    <input
                      type="date"
                      value={endB}
                      min={bounds.min}
                      max={bounds.max}
                      onChange={e => setEndB(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 bg-slate-50/30"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/40 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Preset Pembanding:</span>
              <button
                onClick={() => applyComparisonPreset('q2vsq1')}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 rounded-lg transition-all text-[9.5px]"
              >
                Q2 vs Q1 (Apr-Jun vs Jan-Mar)
              </button>
              <button
                onClick={() => applyComparisonPreset('last30vsprior')}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 rounded-lg transition-all text-[9.5px]"
              >
                30 Hari Terakhir vs 30 Hari Sebelumnya
              </button>
              <button
                onClick={() => applyComparisonPreset('last7vsprior')}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 rounded-lg transition-all text-[9.5px]"
              >
                7 Hari Terakhir vs 7 Hari Sebelumnya
              </button>
            </div>
          </div>

          {/* SIDE BY SIDE KPI SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* KPI 1: Total Sales Revenue */}
            <div className="bg-slate-50/30 border border-slate-200/75 p-5 rounded-2xl flex flex-col justify-between hover:border-indigo-300 transition-all">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Omzet</span>
                {renderBadge(stats.comparison.totalSales.pct)}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400 font-bold">Periode A:</span>
                  <span className="font-mono font-black text-slate-800">{formatRupiahCompact(stats.statsA.totalSales)}</span>
                </div>
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400 font-bold">Periode B:</span>
                  <span className="font-mono font-bold text-slate-500">{formatRupiahCompact(stats.statsB.totalSales)}</span>
                </div>
                <div className="border-t border-dashed border-slate-200 pt-1.5 mt-1.5 flex justify-between text-[10px] font-black">
                  <span className="text-slate-400">Selisih:</span>
                  <span className={stats.comparison.totalSales.diff >= 0 ? 'text-emerald-600 font-mono' : 'text-rose-600 font-mono'}>
                    {stats.comparison.totalSales.diff >= 0 ? '+' : ''}{formatRupiahCompact(stats.comparison.totalSales.diff)}
                  </span>
                </div>
              </div>
            </div>

            {/* KPI 2: Total Tx Count */}
            <div className="bg-slate-50/30 border border-slate-200/75 p-5 rounded-2xl flex flex-col justify-between hover:border-indigo-300 transition-all">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Transaksi</span>
                {renderBadge(stats.comparison.totalTx.pct)}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400 font-bold">Periode A:</span>
                  <span className="font-black text-slate-800">{formatNumberIndo(stats.statsA.totalTx)} Tx</span>
                </div>
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400 font-bold">Periode B:</span>
                  <span className="font-bold text-slate-500">{formatNumberIndo(stats.statsB.totalTx)} Tx</span>
                </div>
                <div className="border-t border-dashed border-slate-200 pt-1.5 mt-1.5 flex justify-between text-[10px] font-black">
                  <span className="text-slate-400">Selisih:</span>
                  <span className={stats.comparison.totalTx.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {stats.comparison.totalTx.diff >= 0 ? '+' : ''}{formatNumberIndo(stats.comparison.totalTx.diff)} Tx
                  </span>
                </div>
              </div>
            </div>

            {/* KPI 3: Avg Daily Sales */}
            <div className="bg-slate-50/30 border border-slate-200/75 p-5 rounded-2xl flex flex-col justify-between hover:border-indigo-300 transition-all">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rata-rata Harian</span>
                {renderBadge(stats.comparison.avgDailySales.pct)}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400 font-bold">Periode A:</span>
                  <span className="font-mono font-black text-slate-800">{formatRupiahCompact(stats.statsA.avgDailySales)}</span>
                </div>
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400 font-bold">Periode B:</span>
                  <span className="font-mono font-bold text-slate-500">{formatRupiahCompact(stats.statsB.avgDailySales)}</span>
                </div>
                <div className="border-t border-dashed border-slate-200 pt-1.5 mt-1.5 flex justify-between text-[10px] font-black">
                  <span className="text-slate-400">Kecepatan:</span>
                  <span className={stats.comparison.avgDailySales.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {stats.comparison.avgDailySales.diff >= 0 ? ' Naik' : ' Turun'} {formatRupiahCompact(Math.abs(stats.comparison.avgDailySales.diff))}/hari
                  </span>
                </div>
              </div>
            </div>

            {/* KPI 4: Basket AOV */}
            <div className="bg-slate-50/30 border border-slate-200/75 p-5 rounded-2xl flex flex-col justify-between hover:border-indigo-300 transition-all">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nilai Belanja (AOV)</span>
                {renderBadge(stats.comparison.aov.pct)}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400 font-bold">Periode A:</span>
                  <span className="font-mono font-black text-slate-800">{formatRupiahCompact(stats.statsA.aov)}</span>
                </div>
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-slate-400 font-bold">Periode B:</span>
                  <span className="font-mono font-bold text-slate-500">{formatRupiahCompact(stats.statsB.aov)}</span>
                </div>
                <div className="border-t border-dashed border-slate-200 pt-1.5 mt-1.5 flex justify-between text-[10px] font-black">
                  <span className="text-slate-400">Efisiensi:</span>
                  <span className={stats.comparison.aov.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {stats.comparison.aov.diff >= 0 ? '+' : ''}{formatRupiahCompact(stats.comparison.aov.diff)} /order
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* CHANNEL BY CHANNEL GROWTH GRID */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              Perbandingan Kontribusi &amp; Pertumbuhan per Channel
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Instan */}
              <div className="bg-emerald-50/20 border border-emerald-100 p-4 rounded-xl space-y-3.5">
                <div className="flex justify-between items-center border-b border-emerald-100/60 pb-2">
                  <span className="text-[10px] font-black uppercase text-emerald-600">Jalur Instan</span>
                  {renderBadge(stats.comparison.channels.instan.salesPct)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-400 font-bold">A (Omzet / Tx):</span>
                    <span className="font-black text-slate-800 font-mono text-right">
                      {formatRupiahCompact(stats.statsA.channels.instan.sales)} <span className="text-[10px] text-slate-400 font-medium">({stats.statsA.channels.instan.tx} Tx)</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-400 font-bold">B (Omzet / Tx):</span>
                    <span className="font-bold text-slate-500 font-mono text-right">
                      {formatRupiahCompact(stats.statsB.channels.instan.sales)} <span className="text-[10px] text-slate-400 font-medium">({stats.statsB.channels.instan.tx} Tx)</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Reguler */}
              <div className="bg-blue-50/20 border border-blue-100 p-4 rounded-xl space-y-3.5">
                <div className="flex justify-between items-center border-b border-blue-100/60 pb-2">
                  <span className="text-[10px] font-black uppercase text-blue-600">Jalur Reguler</span>
                  {renderBadge(stats.comparison.channels.reguler.salesPct)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-400 font-bold">A (Omzet / Tx):</span>
                    <span className="font-black text-slate-800 font-mono text-right">
                      {formatRupiahCompact(stats.statsA.channels.reguler.sales)} <span className="text-[10px] text-slate-400 font-medium">({stats.statsA.channels.reguler.tx} Tx)</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-400 font-bold">B (Omzet / Tx):</span>
                    <span className="font-bold text-slate-500 font-mono text-right">
                      {formatRupiahCompact(stats.statsB.channels.reguler.sales)} <span className="text-[10px] text-slate-400 font-medium">({stats.statsB.channels.reguler.tx} Tx)</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Manual */}
              <div className="bg-amber-50/20 border border-amber-100 p-4 rounded-xl space-y-3.5">
                <div className="flex justify-between items-center border-b border-amber-100/60 pb-2">
                  <span className="text-[10px] font-black uppercase text-amber-600">Jalur Manual</span>
                  {renderBadge(stats.comparison.channels.manual.salesPct)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-400 font-bold">A (Omzet / Tx):</span>
                    <span className="font-black text-slate-800 font-mono text-right">
                      {formatRupiahCompact(stats.statsA.channels.manual.sales)} <span className="text-[10px] text-slate-400 font-medium">({stats.statsA.channels.manual.tx} Tx)</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-400 font-bold">B (Omzet / Tx):</span>
                    <span className="font-bold text-slate-500 font-mono text-right">
                      {formatRupiahCompact(stats.statsB.channels.manual.sales)} <span className="text-[10px] text-slate-400 font-medium">({stats.statsB.channels.manual.tx} Tx)</span>
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {!enabled && (
        <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs text-slate-500 font-bold">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Aktifkan perbandingan di atas untuk menganalisis pertumbuhan bisnis Anda antar kuartal atau bulan secara dinamis.</span>
          </div>
          <button
            onClick={() => {
              setEnabled(true);
              applyComparisonPreset('q2vsq1');
            }}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold uppercase tracking-wider bg-indigo-50 border border-indigo-100/60 px-3 py-1.5 rounded-xl transition-all"
          >
            Buka Kuartal 2 vs Kuartal 1
          </button>
        </div>
      )}

    </div>
  );
}
