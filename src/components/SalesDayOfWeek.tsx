import React, { useState, useMemo } from 'react';
import { DailySales } from '../types';
import { formatRupiah, formatNumberIndo, formatRupiahCompact, formatDateIndo } from '../utils';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, Cell
} from 'recharts';
import { 
  BarChart3, HelpCircle, Sparkles, CalendarDays, TrendingUp, 
  ShoppingBag, Layers, Percent, X, Info, Calendar 
} from 'lucide-react';

interface SalesDayOfWeekProps {
  salesData: DailySales[];
}

type MetricType = 'revenue' | 'transactions' | 'aov' | 'channels';

export default function SalesDayOfWeek({ salesData }: SalesDayOfWeekProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('revenue');
  const [selectedDayName, setSelectedDayName] = useState<string | null>(null);

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

  // Detailed calculations for selected popup day
  const selectedDayData = useMemo(() => {
    if (!selectedDayName) return null;
    return dayOfWeekStats.find(d => d.dayName === selectedDayName) || null;
  }, [selectedDayName, dayOfWeekStats]);

  const selectedDayDates = useMemo(() => {
    if (!selectedDayName) return [];
    return salesData
      .filter(d => d.dayOfWeek === selectedDayName)
      .sort((a, b) => b.totalAll - a.totalAll);
  }, [selectedDayName, salesData]);

  // Custom tooltips
  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950/95 backdrop-blur-md border border-slate-800 text-white p-4.5 rounded-2xl shadow-2xl space-y-3 text-xs min-w-[280px] max-w-sm">
          {/* Header */}
          <div className="border-b border-slate-800/80 pb-2 flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="font-black text-slate-400 uppercase tracking-widest text-[9.5px]">
                📊 Analisa Hari Kerja
              </span>
              <span className="font-mono text-slate-300 font-bold bg-indigo-950/60 border border-indigo-900/50 px-2.5 py-0.5 rounded-md text-[10px]">
                Hari {label}
              </span>
            </div>
            <p className="text-[9.5px] text-slate-400 font-bold">
              Berdasarkan <span className="text-white">{data.occurrences} hari</span> {label} dalam histori data
            </p>
          </div>

          {/* Revenue Metric */}
          {selectedMetric === 'revenue' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-xl border border-slate-800/40">
                <span className="font-bold text-slate-400">Rerata Omzet Harian:</span>
                <span className="font-mono text-emerald-400 font-black text-sm">{formatRupiah(data.avgRevenue)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] px-1 pt-1">
                <span className="font-semibold text-slate-500">Total Akumulasi {label}:</span>
                <span className="font-mono text-slate-300 font-bold">{formatRupiah(data.totalAll)}</span>
              </div>
            </div>
          )}

          {/* Transactions Metric */}
          {selectedMetric === 'transactions' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-xl border border-slate-800/40">
                <span className="font-bold text-slate-400">Rerata Transaksi:</span>
                <span className="font-mono text-blue-400 font-black text-sm">{data.avgTransactions} Tx</span>
              </div>
              
              {/* Transaction channel breakdown */}
              <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[10px] font-black uppercase text-slate-500 pb-0.5">Kontribusi Transaksi:</div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold flex items-center gap-1.5 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Instan
                  </span>
                  <span className="font-mono text-slate-300">
                    {data.txInstan} Tx ({data.txAll > 0 ? ((data.txInstan / data.txAll) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold flex items-center gap-1.5 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Reguler
                  </span>
                  <span className="font-mono text-slate-300">
                    {data.txReguler} Tx ({data.txAll > 0 ? ((data.txReguler / data.txAll) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold flex items-center gap-1.5 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Manual
                  </span>
                  <span className="font-mono text-slate-300">
                    {data.txManual} Tx ({data.txAll > 0 ? ((data.txManual / data.txAll) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-slate-800">
                <span className="font-semibold text-slate-500">Total Transaksi Historis:</span>
                <span className="font-mono text-slate-300 font-bold">{formatNumberIndo(data.txAll)} Tx</span>
              </div>
            </div>
          )}

          {/* AOV Metric */}
          {selectedMetric === 'aov' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-slate-900/60 p-2 rounded-xl border border-slate-800/40">
                <span className="font-bold text-slate-400">Rerata Keranjang (AOV):</span>
                <span className="font-mono text-rose-400 font-black text-sm">{formatRupiah(data.aov)}</span>
              </div>
              <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/50 text-[10px] text-slate-400 leading-relaxed">
                💡 Pelanggan yang berbelanja pada hari <strong className="text-white">{label}</strong> rata-rata membelanjakan <strong className="text-rose-300">{formatRupiah(data.aov)}</strong> per struk belanja.
              </div>
            </div>
          )}

          {/* Channels Metric */}
          {selectedMetric === 'channels' && (
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-800/60 pb-1 flex justify-between">
                <span>Rerata per Channel</span>
                <span>Nilai &amp; Kontribusi</span>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center gap-4 text-[11px]">
                  <span className="font-bold flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Instan
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-300 font-bold">{formatRupiah(data.avgInstan)}</span>
                    <span className="text-[10px] font-extrabold bg-slate-800/60 px-1.5 py-0.5 rounded text-indigo-300">
                      {data.avgRevenue > 0 ? ((data.avgInstan / data.avgRevenue) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center gap-4 text-[11px]">
                  <span className="font-bold flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Reguler
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-300 font-bold">{formatRupiah(data.avgReguler)}</span>
                    <span className="text-[10px] font-extrabold bg-slate-800/60 px-1.5 py-0.5 rounded text-indigo-300">
                      {data.avgRevenue > 0 ? ((data.avgReguler / data.avgRevenue) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center gap-4 text-[11px]">
                  <span className="font-bold flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-f59e0b" style={{ backgroundColor: '#f59e0b' }} />
                    Manual
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-300 font-bold">{formatRupiah(data.avgManual)}</span>
                    <span className="text-[10px] font-extrabold bg-slate-800/60 px-1.5 py-0.5 rounded text-indigo-300">
                      {data.avgRevenue > 0 ? ((data.avgManual / data.avgRevenue) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px] font-black">
                <span className="text-slate-400">Total Rerata Harian:</span>
                <span className="font-mono text-emerald-400 text-xs">{formatRupiah(data.avgRevenue)}</span>
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
            <p className="text-[10px] text-slate-400 font-bold mt-1">
              Mengidentifikasi hari-hari paling menguntungkan. <span className="text-indigo-600 font-black animate-pulse">(Klik Batang Diagram untuk Detail)</span>
            </p>
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
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isBest ? '#10b981' : '#6366f1'} 
                        cursor="pointer"
                        onClick={() => setSelectedDayName(entry.dayName)}
                      />
                    );
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
                <Bar dataKey="avgManual" name="Manual Sales" stackId="a" fill="#f59e0b" maxBarSize={45}>
                  {dayOfWeekStats.map((entry, idx) => (
                    <Cell 
                      key={`manual-${idx}`} 
                      fill="#f59e0b" 
                      cursor="pointer" 
                      onClick={() => setSelectedDayName(entry.dayName)} 
                    />
                  ))}
                </Bar>
                <Bar dataKey="avgReguler" name="Reguler Sales" stackId="a" fill="#3b82f6" maxBarSize={45}>
                  {dayOfWeekStats.map((entry, idx) => (
                    <Cell 
                      key={`reguler-${idx}`} 
                      fill="#3b82f6" 
                      cursor="pointer" 
                      onClick={() => setSelectedDayName(entry.dayName)} 
                    />
                  ))}
                </Bar>
                <Bar dataKey="avgInstan" name="Instan Sales" stackId="a" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  {dayOfWeekStats.map((entry, idx) => (
                    <Cell 
                      key={`instan-${idx}`} 
                      fill="#10b981" 
                      cursor="pointer" 
                      onClick={() => setSelectedDayName(entry.dayName)} 
                    />
                  ))}
                </Bar>
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
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isSunday ? '#3b82f6' : '#818cf8'} 
                        cursor="pointer"
                        onClick={() => setSelectedDayName(entry.dayName)}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={dayOfWeekStats} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dayName" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatRupiahCompact(v)} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip} cursor={{ fill: '#f1f5f9', opacity: 0.5 }} />
                <Bar dataKey="aov" name="Rerata Nilai Keranjang (AOV)" radius={[6, 6, 0, 0]} maxBarSize={45} fill="#f43f5e">
                  {dayOfWeekStats.map((entry, index) => (
                    <Cell 
                      key={`aov-${index}`} 
                      fill="#f43f5e" 
                      cursor="pointer" 
                      onClick={() => setSelectedDayName(entry.dayName)} 
                    />
                  ))}
                </Bar>
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

      {/* DETAILED DAY OF WEEK POPUP MODAL */}
      {selectedDayName && selectedDayData && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in no-print"
          onClick={() => setSelectedDayName(null)}
        >
          <div 
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-indigo-50 border border-indigo-100/60 text-indigo-600 rounded-2xl shrink-0">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 leading-tight">
                    Detail Hari: {selectedDayName}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    Analisis performa penjualan, korelasi channel, dan riwayat transaksi harian
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDayName(null)}
                className="p-2 hover:bg-slate-200/60 rounded-xl transition-all text-slate-400 hover:text-slate-800 cursor-pointer border border-transparent hover:border-slate-200/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              
              {/* Highlight Banner */}
              <div className="bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-indigo-50/20 border border-indigo-100/30 p-4 rounded-2xl flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-500 shrink-0 animate-pulse" />
                <p className="text-[11px] font-semibold text-indigo-950 leading-relaxed">
                  Dihitung secara akumulatif dari <strong className="text-indigo-600">{selectedDayData.occurrences} hari {selectedDayName}</strong> historis dalam filter periode aktif Anda.
                </p>
              </div>

              {/* Grid of Key Average Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Rata-rata Omzet</span>
                  <p className="text-base font-black text-slate-800 mt-1 font-mono">
                    {formatRupiah(selectedDayData.avgRevenue)}
                  </p>
                  <p className="text-[9.5px] text-slate-400 font-bold mt-1">
                    Total: {formatRupiahCompact(selectedDayData.totalAll)}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Rata-rata Order</span>
                  <p className="text-base font-black text-slate-800 mt-1 font-mono">
                    {selectedDayData.avgTransactions} <span className="text-xs font-bold text-slate-400">Tx</span>
                  </p>
                  <p className="text-[9.5px] text-slate-400 font-bold mt-1">
                    Total: {formatNumberIndo(selectedDayData.txAll)} Tx
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Rata-rata AOV</span>
                  <p className="text-base font-black text-slate-800 mt-1 font-mono">
                    {formatRupiah(selectedDayData.aov)}
                  </p>
                  <p className="text-[9.5px] text-slate-400 font-bold mt-1">
                    Nilai belanja per keranjang
                  </p>
                </div>
              </div>

              {/* Channel Distribution */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Rata-rata Omzet Berdasarkan Delivery Channel
                </h4>
                
                <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-4.5 space-y-3.5">
                  {/* Instan Channel */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-emerald-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        Instant Delivery
                      </span>
                      <span className="font-mono font-black text-slate-700">
                        {formatRupiah(selectedDayData.avgInstan)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${selectedDayData.avgRevenue > 0 ? (selectedDayData.avgInstan / selectedDayData.avgRevenue) * 100 : 0}%` 
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[9.5px] text-slate-400 font-bold">
                      <span>Kontribusi: {selectedDayData.avgRevenue > 0 ? ((selectedDayData.avgInstan / selectedDayData.avgRevenue) * 100).toFixed(1) : 0}%</span>
                      <span>Total Tx Instan: {selectedDayData.txInstan}</span>
                    </div>
                  </div>

                  {/* Reguler Channel */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-blue-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        Regular Shipping
                      </span>
                      <span className="font-mono font-black text-slate-700">
                        {formatRupiah(selectedDayData.avgReguler)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${selectedDayData.avgRevenue > 0 ? (selectedDayData.avgReguler / selectedDayData.avgRevenue) * 100 : 0}%` 
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[9.5px] text-slate-400 font-bold">
                      <span>Kontribusi: {selectedDayData.avgRevenue > 0 ? ((selectedDayData.avgReguler / selectedDayData.avgRevenue) * 100).toFixed(1) : 0}%</span>
                      <span>Total Tx Reguler: {selectedDayData.txReguler}</span>
                    </div>
                  </div>

                  {/* Manual Channel */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-amber-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        Manual Input / COD
                      </span>
                      <span className="font-mono font-black text-slate-700">
                        {formatRupiah(selectedDayData.avgManual)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${selectedDayData.avgRevenue > 0 ? (selectedDayData.avgManual / selectedDayData.avgRevenue) * 100 : 0}%` 
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[9.5px] text-slate-400 font-bold">
                      <span>Kontribusi: {selectedDayData.avgRevenue > 0 ? ((selectedDayData.avgManual / selectedDayData.avgRevenue) * 100).toFixed(1) : 0}%</span>
                      <span>Total Tx Manual: {selectedDayData.txManual}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Historical Dates Table */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  Riwayat Transaksi Harian pada Hari {selectedDayName} (Urutan Omzet Terbesar)
                </h4>
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white max-h-[250px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white z-10 shadow-sm">
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="py-2.5 px-4">Tanggal</th>
                        <th className="py-2.5 px-4 text-center">Transaksi</th>
                        <th className="py-2.5 px-4 text-center">Nilai AOV</th>
                        <th className="py-2.5 px-4 text-right pr-6">Omzet Harian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDayDates.map((item) => {
                        const dateAov = item.txAll > 0 ? item.totalAll / item.txAll : 0;
                        const isAboveAvg = item.totalAll >= selectedDayData.avgRevenue;
                        return (
                          <tr 
                            key={item.date} 
                            className="border-b border-slate-100/60 last:border-0 hover:bg-slate-50/60 text-xs text-slate-600 font-semibold"
                          >
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="text-slate-800 font-bold">{formatDateIndo(item.date)}</span>
                                {isAboveAvg ? (
                                  <span className="text-[8px] bg-emerald-50 text-emerald-600 font-black px-1.5 py-0.5 rounded border border-emerald-100/50">
                                    Diatas Rerata
                                  </span>
                                ) : (
                                  <span className="text-[8px] bg-slate-100 text-slate-400 font-bold px-1.5 py-0.5 rounded">
                                    Dibawah Rerata
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-600 font-mono font-bold">
                              {item.txAll} Tx
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-500 font-mono">
                              {formatRupiahCompact(dateAov)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-indigo-600 font-mono font-black pr-6">
                              {formatRupiah(item.totalAll)}
                            </td>
                          </tr>
                        );
                      })}
                      {selectedDayDates.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 font-bold italic">
                            Tidak ada data untuk hari ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedDayName(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-900 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm hover:shadow"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
