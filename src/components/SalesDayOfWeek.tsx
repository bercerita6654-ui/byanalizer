import React, { useState, useMemo } from 'react';
import { DailySales } from '../types';
import { formatRupiah, formatNumberIndo, formatRupiahCompact } from '../utils';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, Cell
} from 'recharts';
import { BarChart3, HelpCircle, Sparkles, CalendarDays, TrendingUp, ShoppingBag, Layers, Percent } from 'lucide-react';

interface SalesDayOfWeekProps {
  salesData: DailySales[];
}

type MetricType = 'revenue' | 'transactions' | 'aov' | 'channels';

export default function SalesDayOfWeek({ salesData }: SalesDayOfWeekProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('revenue');

  // Days order starting from Monday to Sunday
  const DAYS_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  const dayOfWeekStats = useMemo(() => {
    if (salesData.length === 0) return [];

    // Initialize map
    const agg: Record<string, {
      dayName: string;
      totalAll: number;
      txAll: number;
      totalInstan: number;
      totalReguler: number;
      totalManual: number;
      txInstan: number;
      txReguler: number;
      txManual: number;
      occurrences: number;
    }> = {};

    DAYS_ORDER.forEach(day => {
      agg[day] = {
        dayName: day,
        totalAll: 0,
        txAll: 0,
        totalInstan: 0,
        totalReguler: 0,
        totalManual: 0,
        txInstan: 0,
        txReguler: 0,
        txManual: 0,
        occurrences: 0,
      };
    });

    // Aggregate values
    salesData.forEach(day => {
      const dayName = day.dayOfWeek;
      if (agg[dayName]) {
        agg[dayName].totalAll += day.totalAll;
        agg[dayName].txAll += day.txAll;
        agg[dayName].totalInstan += day.totalInstan;
        agg[dayName].totalReguler += day.totalReguler;
        agg[dayName].totalManual += day.totalManual;
        agg[dayName].txInstan += day.txInstan;
        agg[dayName].txReguler += day.txReguler;
        agg[dayName].txManual += day.txManual;
        agg[dayName].occurrences += 1;
      }
    });

    // Map to array and calculate averages
    return DAYS_ORDER.map(day => {
      const data = agg[day];
      const count = data.occurrences || 1;
      const avgRevenue = data.totalAll / count;
      const avgTransactions = data.txAll / count;
      const aov = data.txAll > 0 ? data.totalAll / data.txAll : 0;
      
      const avgInstan = data.totalInstan / count;
      const avgReguler = data.totalReguler / count;
      const avgManual = data.totalManual / count;

      return {
        ...data,
        avgRevenue: Math.round(avgRevenue),
        avgTransactions: parseFloat(avgTransactions.toFixed(1)),
        aov: Math.round(aov),
        avgInstan: Math.round(avgInstan),
        avgReguler: Math.round(avgReguler),
        avgManual: Math.round(avgManual),
      };
    });
  }, [salesData]);

  // Insights calculations
  const insights = useMemo(() => {
    if (dayOfWeekStats.length === 0) return null;

    // Find best and worst days based on avgRevenue
    let bestDay = dayOfWeekStats[0];
    let worstDay = dayOfWeekStats[0];

    dayOfWeekStats.forEach(day => {
      if (day.avgRevenue > bestDay.avgRevenue) {
        bestDay = day;
      }
      if (day.avgRevenue < worstDay.avgRevenue) {
        worstDay = day;
      }
    });

    // Weekdays vs Weekends
    // Weekdays: Senin - Jumat
    // Weekends: Sabtu & Minggu
    let weekdayRevenueTotal = 0;
    let weekdayDaysCount = 0;
    let weekendRevenueTotal = 0;
    let weekendDaysCount = 0;

    dayOfWeekStats.forEach(day => {
      if (day.dayName === 'Sabtu' || day.dayName === 'Minggu') {
        weekendRevenueTotal += day.avgRevenue;
        weekendDaysCount += 1;
      } else {
        weekdayRevenueTotal += day.avgRevenue;
        weekdayDaysCount += 1;
      }
    });

    const avgWeekdayRevenue = weekdayRevenueTotal / (weekdayDaysCount || 1);
    const avgWeekendRevenue = weekendRevenueTotal / (weekendDaysCount || 1);
    const weekendVsWeekdayDiffPct = avgWeekdayRevenue > 0 
      ? ((avgWeekendRevenue - avgWeekdayRevenue) / avgWeekdayRevenue) * 100 
      : 0;

    return {
      bestDay: {
        name: bestDay.dayName,
        value: bestDay.avgRevenue,
        tx: bestDay.avgTransactions,
        aov: bestDay.aov
      },
      worstDay: {
        name: worstDay.dayName,
        value: worstDay.avgRevenue,
        tx: worstDay.avgTransactions
      },
      comparison: {
        avgWeekday: Math.round(avgWeekdayRevenue),
        avgWeekend: Math.round(avgWeekendRevenue),
        diffPct: weekendVsWeekdayDiffPct
      }
    };
  }, [dayOfWeekStats]);

  // Custom tooltips
  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-800 text-white p-4.5 rounded-2xl shadow-xl space-y-2 text-xs min-w-[240px]">
          <div className="border-b border-slate-800 pb-2 mb-2">
            <p className="font-black text-slate-300 text-[11px] uppercase tracking-wider">
              Hari: <span className="text-white">{label}</span>
            </p>
            <p className="text-[9px] text-slate-400 font-bold mt-0.5">
              Dihitung dari {data.occurrences} hari {label} historis
            </p>
          </div>

          {selectedMetric === 'revenue' && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center gap-4">
                <span className="font-bold text-slate-400">Rata-rata Omzet:</span>
                <span className="font-mono text-emerald-400 font-black">{formatRupiah(data.avgRevenue)}</span>
              </div>
              <div className="flex justify-between items-center gap-4 text-[11px]">
                <span className="font-bold text-slate-400">Total Omzet Keseluruhan:</span>
                <span className="font-mono text-slate-300">{formatRupiahCompact(data.totalAll)}</span>
              </div>
            </div>
          )}

          {selectedMetric === 'transactions' && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center gap-4">
                <span className="font-bold text-slate-400">Rata-rata Transaksi:</span>
                <span className="font-mono text-blue-400 font-black">{data.avgTransactions} Tx</span>
              </div>
              <div className="flex justify-between items-center gap-4 text-[11px]">
                <span className="font-bold text-slate-400">Total Transaksi Keseluruhan:</span>
                <span className="font-mono text-slate-300">{formatNumberIndo(data.txAll)} Tx</span>
              </div>
            </div>
          )}

          {selectedMetric === 'aov' && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center gap-4">
                <span className="font-bold text-slate-400">Rata-rata Keranjang (AOV):</span>
                <span className="font-mono text-rose-400 font-black">{formatRupiah(data.aov)}</span>
              </div>
            </div>
          )}

          {selectedMetric === 'channels' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center gap-4 text-[11px] font-black border-b border-slate-800/60 pb-1 text-slate-400">
                <span>Rata-rata per Channel:</span>
                <span>Nilai (Rp)</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Instan:
                </span>
                <span className="font-mono text-slate-200">{formatRupiahCompact(data.avgInstan)}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="font-bold flex items-center gap-1.5 text-blue-400">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Reguler:
                </span>
                <span className="font-mono text-slate-200">{formatRupiahCompact(data.avgReguler)}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="font-bold flex items-center gap-1.5 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Manual:
                </span>
                <span className="font-mono text-slate-200">{formatRupiahCompact(data.avgManual)}</span>
              </div>
              <div className="border-t border-slate-800 pt-1.5 mt-1.5 flex justify-between items-center text-[11px] font-black">
                <span className="text-slate-400">Total Omzet Harian:</span>
                <span className="font-mono text-white">{formatRupiahCompact(data.avgRevenue)}</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 leading-none">Analisa Performa Hari (Day of Week)</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Mengidentifikasi hari-hari paling menguntungkan untuk strategi operasional bisnis</p>
          </div>
        </div>

        {/* Metric selection controls */}
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200/50 shadow-inner">
          <button
            onClick={() => setSelectedMetric('revenue')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              selectedMetric === 'revenue'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            Omzet Rata-rata
          </button>
          
          <button
            onClick={() => setSelectedMetric('channels')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              selectedMetric === 'channels'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3 h-3" />
            Berdasarkan Channel
          </button>

          <button
            onClick={() => setSelectedMetric('transactions')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              selectedMetric === 'transactions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-3 h-3" />
            Transaksi Harian
          </button>

          <button
            onClick={() => setSelectedMetric('aov')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              selectedMetric === 'aov'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Nilai Keranjang (AOV)
          </button>
        </div>
      </div>

      {/* KPI Cards & Insights */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Best Day Card */}
          <div className="bg-emerald-50/40 border border-emerald-100 p-5 rounded-2xl flex items-center gap-4.5">
            <div className="p-3 bg-emerald-600 rounded-xl text-white shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none">Hari Terlaris (Profit Maksimal)</span>
              <h4 className="text-sm font-black text-slate-800 mt-1">{insights.bestDay.name}</h4>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                Rerata Omzet <strong className="text-emerald-600 font-extrabold">{formatRupiahCompact(insights.bestDay.value)}</strong> ({insights.bestDay.tx} Tx)
              </p>
            </div>
          </div>

          {/* Worst Day Card */}
          <div className="bg-rose-50/40 border border-rose-100 p-5 rounded-2xl flex items-center gap-4.5">
            <div className="p-3 bg-rose-600 rounded-xl text-white shadow-sm">
              <TrendingUp className="w-5 h-5 rotate-180" />
            </div>
            <div>
              <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest leading-none">Hari Tersepi (Tingkat Pembelian Rendah)</span>
              <h4 className="text-sm font-black text-slate-800 mt-1">{insights.worstDay.name}</h4>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                Rerata Omzet <strong className="text-rose-600 font-extrabold">{formatRupiahCompact(insights.worstDay.value)}</strong> ({insights.worstDay.tx} Tx)
              </p>
            </div>
          </div>

          {/* Weekend vs Weekday Card */}
          <div className="bg-indigo-50/40 border border-indigo-100 p-5 rounded-2xl flex items-center gap-4.5">
            <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-sm">
              <Percent className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest leading-none">Analisa Akhir Pekan vs Hari Kerja</span>
              <div className="flex items-center gap-2 mt-1">
                <h4 className="text-xs font-bold text-slate-800">
                  {insights.comparison.diffPct >= 0 ? 'Weekend Naik' : 'Weekend Turun'}
                </h4>
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                  insights.comparison.diffPct >= 0 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {insights.comparison.diffPct >= 0 ? '+' : ''}{insights.comparison.diffPct.toFixed(1)}%
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                Weekend <span className="font-bold text-slate-700">{formatRupiahCompact(insights.comparison.avgWeekend)}</span> vs Weekday <span className="font-bold text-slate-700">{formatRupiahCompact(insights.comparison.avgWeekday)}</span>
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Bar Chart Section */}
      <div className="h-[320px] w-full">
        {dayOfWeekStats.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {selectedMetric === 'revenue' ? (
              <BarChart data={dayOfWeekStats} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dayName" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatRupiahCompact(v)} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip} cursor={{ fill: '#f1f5f9', opacity: 0.5 }} />
                <Bar dataKey="avgRevenue" name="Rerata Omzet Harian" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  {dayOfWeekStats.map((entry, index) => {
                    const isBest = insights && entry.dayName === insights.bestDay.name;
                    return <Cell key={`cell-${index}`} fill={isBest ? '#10b981' : '#6366f1'} />;
                  })}
                </Bar>
              </BarChart>
            ) : selectedMetric === 'channels' ? (
              <BarChart data={dayOfWeekStats} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dayName" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatRupiahCompact(v)} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip} cursor={{ fill: '#f1f5f9', opacity: 0.5 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 'bold', paddingTop: 10 }} />
                <Bar dataKey="avgManual" name="Manual Sales" stackId="a" fill="#f59e0b" maxBarSize={45} />
                <Bar dataKey="avgReguler" name="Reguler Sales" stackId="a" fill="#3b82f6" maxBarSize={45} />
                <Bar dataKey="avgInstan" name="Instan Sales" stackId="a" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={45} />
              </BarChart>
            ) : selectedMetric === 'transactions' ? (
              <BarChart data={dayOfWeekStats} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dayName" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip} cursor={{ fill: '#f1f5f9', opacity: 0.5 }} />
                <Bar dataKey="avgTransactions" name="Rerata Order (Tx)" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  {dayOfWeekStats.map((entry, index) => {
                    const isSunday = entry.dayName === 'Minggu' || entry.dayName === 'Sabtu';
                    return <Cell key={`cell-${index}`} fill={isSunday ? '#3b82f6' : '#818cf8'} />;
                  })}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={dayOfWeekStats} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dayName" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatRupiahCompact(v)} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip} cursor={{ fill: '#f1f5f9', opacity: 0.5 }} />
                <Bar dataKey="aov" name="Rerata Nilai Keranjang (AOV)" radius={[6, 6, 0, 0]} maxBarSize={45} fill="#f43f5e" />
              </BarChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 font-bold italic">
            Belum ada data untuk kalkulasi visualisasi.
          </div>
        )}
      </div>

      {/* Explanatory insights footer */}
      <div className="bg-slate-50 border border-slate-100 p-4.5 rounded-2xl flex items-start gap-2.5 text-[10.5px] font-semibold text-slate-500 leading-relaxed">
        <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <div>
          <span className="text-slate-800 font-extrabold uppercase text-[10px] tracking-wider block mb-1">💡 Cara Membaca &amp; Pemanfaatan Strategis</span>
          Grafik di atas memvisualisasikan data rata-rata harian tertimbang per hari dalam seminggu. 
          Gunakan insight <strong className="text-indigo-600 font-bold">Hari Terlaris</strong> untuk memaksimalkan jadwal rilis promosi, event live streaming, maupun kampanye iklan berbayar (ads) agar konversi penjualan optimal. 
          Sebaliknya, pada <strong className="text-indigo-600 font-bold">Hari Tersepi</strong>, pertimbangkan pemberian promo diskon kilat (flash sale) atau kampanye penarik minat guna mendorong volume transaksi.
        </div>
      </div>

    </div>
  );
}
