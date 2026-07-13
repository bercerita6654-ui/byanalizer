import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { DailySales } from '../types';
import { formatRupiah, formatNumberIndo, formatRupiahCompact } from '../utils';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, AreaChart, Area
} from 'recharts';
import { 
  ShoppingBag, Calendar, BarChart3, TrendingUp, 
  Sparkles, Zap, ArrowRight, Truck, ClipboardList, Info
} from 'lucide-react';

interface SalesChannelCompositionProps {
  salesData: DailySales[];
}

type PeriodTab = 'harian' | 'mingguan' | 'bulanan';
type MetricType = 'sales' | 'tx';

export default function SalesChannelComposition({ salesData }: SalesChannelCompositionProps) {
  const [activePeriod, setActivePeriod] = useState<PeriodTab>('harian');
  const [activeMetric, setActiveMetric] = useState<MetricType>('sales');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // 1. Get all available months in the dataset, sorted descending (latest first)
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    salesData.forEach(d => {
      if (d.date) {
        monthsSet.add(d.date.substring(0, 7));
      }
    });
    
    const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
    
    const monthNamesIndo = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    
    return sortedMonths.map(ym => {
      const [year, monthStr] = ym.split('-');
      const monthIndex = parseInt(monthStr, 10) - 1;
      return {
        yearMonth: ym,
        name: `${monthNamesIndo[monthIndex]} ${year}`
      };
    });
  }, [salesData]);

  // Set the default selected month to the latest month (bulan berjalan)
  useEffect(() => {
    if (!selectedMonth && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0].yearMonth);
    }
  }, [availableMonths, selectedMonth]);

  // 2. Filter data for the chosen month
  const monthData = useMemo(() => {
    if (!selectedMonth) return [];
    return salesData.filter(d => d.date && d.date.startsWith(selectedMonth));
  }, [salesData, selectedMonth]);

  // 3. Current month name for labels
  const currentMonthName = useMemo(() => {
    const found = availableMonths.find(m => m.yearMonth === selectedMonth);
    return found ? found.name : '';
  }, [availableMonths, selectedMonth]);

  // 4. Daily Chart Data (Harian)
  const dailyChartData = useMemo(() => {
    return monthData.map(d => {
      const dayNum = d.date.split('-')[2];
      return {
        date: d.date,
        label: dayNum, // Show only the day number (01, 02...) for cleaner chart axis
        dayOfWeek: d.dayOfWeek,
        
        // Revenue values
        totalInstan: d.totalInstan,
        totalReguler: d.totalReguler,
        totalManual: d.totalManual,
        totalAll: d.totalAll,
        
        // Transaction counts
        txInstan: d.txInstan,
        txReguler: d.txReguler,
        txManual: d.txManual,
        txAll: d.txAll,
      };
    });
  }, [monthData]);

  // 5. Weekly Chart Data (Mingguan)
  const weeklyChartData = useMemo(() => {
    const weeklyMap: { [key: string]: DailySales[] } = {
      'W1': [], // Tgl 1 - 7
      'W2': [], // Tgl 8 - 14
      'W3': [], // Tgl 15 - 21
      'W4': [], // Tgl 22 - 28
      'W5': []  // Tgl 29+
    };
    
    monthData.forEach(d => {
      const dayNum = parseInt(d.date.split('-')[2], 10);
      if (dayNum <= 7) weeklyMap['W1'].push(d);
      else if (dayNum <= 14) weeklyMap['W2'].push(d);
      else if (dayNum <= 21) weeklyMap['W3'].push(d);
      else if (dayNum <= 28) weeklyMap['W4'].push(d);
      else weeklyMap['W5'].push(d);
    });
    
    return Object.entries(weeklyMap)
      .filter(([_, days]) => days.length > 0)
      .map(([weekKey, days]) => {
        const totalInstan = days.reduce((sum, d) => sum + d.totalInstan, 0);
        const totalReguler = days.reduce((sum, d) => sum + d.totalReguler, 0);
        const totalManual = days.reduce((sum, d) => sum + d.totalManual, 0);
        const totalAll = days.reduce((sum, d) => sum + d.totalAll, 0);
        
        const txInstan = days.reduce((sum, d) => sum + d.txInstan, 0);
        const txReguler = days.reduce((sum, d) => sum + d.txReguler, 0);
        const txManual = days.reduce((sum, d) => sum + d.txManual, 0);
        const txAll = days.reduce((sum, d) => sum + d.txAll, 0);
        
        let label = '';
        if (weekKey === 'W1') label = 'Minggu 1 (Tgl 1-7)';
        else if (weekKey === 'W2') label = 'Minggu 2 (Tgl 8-14)';
        else if (weekKey === 'W3') label = 'Minggu 3 (Tgl 15-21)';
        else if (weekKey === 'W4') label = 'Minggu 4 (Tgl 22-28)';
        else label = 'Minggu 5 (Tgl 29+)';
        
        return {
          weekKey,
          label,
          totalInstan,
          totalReguler,
          totalManual,
          totalAll,
          txInstan,
          txReguler,
          txManual,
          txAll
        };
      });
  }, [monthData]);

  // 6. Monthly Chart Data (Bulanan) - Show all available months
  const monthlyChartData = useMemo(() => {
    const monthlyMap: { [key: string]: DailySales[] } = {};
    salesData.forEach(d => {
      if (d.date) {
        const ym = d.date.substring(0, 7);
        if (!monthlyMap[ym]) monthlyMap[ym] = [];
        monthlyMap[ym].push(d);
      }
    });
    
    const monthNamesIndoShort = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    
    return Object.entries(monthlyMap)
      .map(([ym, days]) => {
        const [year, monthStr] = ym.split('-');
        const monthIndex = parseInt(monthStr, 10) - 1;
        const label = `${monthNamesIndoShort[monthIndex]} ${year.substring(2)}`;
        
        const totalInstan = days.reduce((sum, d) => sum + d.totalInstan, 0);
        const totalReguler = days.reduce((sum, d) => sum + d.totalReguler, 0);
        const totalManual = days.reduce((sum, d) => sum + d.totalManual, 0);
        const totalAll = days.reduce((sum, d) => sum + d.totalAll, 0);
        
        const txInstan = days.reduce((sum, d) => sum + d.txInstan, 0);
        const txReguler = days.reduce((sum, d) => sum + d.txReguler, 0);
        const txManual = days.reduce((sum, d) => sum + d.txManual, 0);
        const txAll = days.reduce((sum, d) => sum + d.txAll, 0);
        
        return {
          yearMonth: ym,
          label,
          totalInstan,
          totalReguler,
          totalManual,
          totalAll,
          txInstan,
          txReguler,
          txManual,
          txAll
        };
      })
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  }, [salesData]);

  // 7. Month overall summary for side cards
  const selectedMonthSummary = useMemo(() => {
    let totalInstanSales = 0;
    let totalRegulerSales = 0;
    let totalManualSales = 0;
    let totalAllSales = 0;
    
    let txInstanCount = 0;
    let txRegulerCount = 0;
    let txManualCount = 0;
    let txAllCount = 0;
    
    monthData.forEach(d => {
      totalInstanSales += d.totalInstan;
      totalRegulerSales += d.totalReguler;
      totalManualSales += d.totalManual;
      totalAllSales += d.totalAll;
      
      txInstanCount += d.txInstan;
      txRegulerCount += d.txReguler;
      txManualCount += d.txManual;
      txAllCount += d.txAll;
    });
    
    const totalSales = totalAllSales || 1;
    const totalTx = txAllCount || 1;
    
    return {
      totalSales: totalAllSales,
      totalTx: txAllCount,
      instan: {
        sales: totalInstanSales,
        tx: txInstanCount,
        pctSales: (totalInstanSales / totalSales) * 100,
        pctTx: (txInstanCount / totalTx) * 100,
        aov: txInstanCount > 0 ? totalInstanSales / txInstanCount : 0,
      },
      reguler: {
        sales: totalRegulerSales,
        tx: txRegulerCount,
        pctSales: (totalRegulerSales / totalSales) * 100,
        pctTx: (txRegulerCount / totalTx) * 100,
        aov: txRegulerCount > 0 ? totalRegulerSales / txRegulerCount : 0,
      },
      manual: {
        sales: totalManualSales,
        tx: txManualCount,
        pctSales: (totalManualSales / totalSales) * 100,
        pctTx: (txManualCount / totalTx) * 100,
        aov: txManualCount > 0 ? totalManualSales / txManualCount : 0,
      }
    };
  }, [monthData]);

  // 8. Auto insights generation based on data
  const insights = useMemo(() => {
    const summary = selectedMonthSummary;
    if (summary.totalSales === 0) return { title: 'Belum ada data', desc: '' };
    
    const channels = [
      { id: 'Instan', name: 'Instant Delivery', sales: summary.instan.sales, pct: summary.instan.pctSales, aov: summary.instan.aov },
      { id: 'Reguler', name: 'Reguler Ekspedisi', sales: summary.reguler.sales, pct: summary.reguler.pctSales, aov: summary.reguler.aov },
      { id: 'Manual', name: 'Manual COD / Admin', sales: summary.manual.sales, pct: summary.manual.pctSales, aov: summary.manual.aov }
    ];
    
    channels.sort((a, b) => b.sales - a.sales);
    const topChannel = channels[0];
    
    // Find the one with highest AOV
    const sortedAov = [...channels].sort((a, b) => b.aov - a.aov);
    const topAovChannel = sortedAov[0];

    return {
      topChannelName: topChannel.id,
      topChannelPct: topChannel.pct.toFixed(1),
      topChannelSales: formatRupiah(topChannel.sales),
      topAovName: topAovChannel.id,
      topAovVal: formatRupiah(topAovChannel.aov)
    };
  }, [selectedMonthSummary]);

  // Determine current active chart data source
  const chartData = useMemo(() => {
    if (activePeriod === 'harian') return dailyChartData;
    if (activePeriod === 'mingguan') return weeklyChartData;
    return monthlyChartData;
  }, [activePeriod, dailyChartData, weeklyChartData, monthlyChartData]);

  // Custom tooltips
  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isDaily = activePeriod === 'harian';
      const isWeekly = activePeriod === 'mingguan';
      
      const valInstan = activeMetric === 'sales' ? payload[0]?.payload?.totalInstan : payload[0]?.payload?.txInstan;
      const valReguler = activeMetric === 'sales' ? payload[0]?.payload?.totalReguler : payload[0]?.payload?.txReguler;
      const valManual = activeMetric === 'sales' ? payload[0]?.payload?.totalManual : payload[0]?.payload?.txManual;
      const valAll = activeMetric === 'sales' ? payload[0]?.payload?.totalAll : payload[0]?.payload?.txAll;
      
      const formatValue = (v: number) => activeMetric === 'sales' ? formatRupiah(v) : `${formatNumberIndo(v)} Tx`;
      
      let headerText = '';
      if (isDaily) {
        const dayOfWeek = payload[0]?.payload?.dayOfWeek || '';
        headerText = `${dayOfWeek}, Tanggal ${label} ${currentMonthName}`;
      } else if (isWeekly) {
        headerText = label;
      } else {
        headerText = `Bulan ${label}`;
      }

      return (
        <div className="bg-slate-900 text-white p-4.5 rounded-2xl border border-slate-700 shadow-2xl space-y-3 text-xs min-w-[280px]">
          <div className="border-b border-slate-800 pb-2">
            <p className="text-[10px] uppercase font-black tracking-widest text-indigo-400">
              {isDaily ? '📅 Detail Harian' : isWeekly ? '📊 Detail Mingguan' : '📈 Detail Bulanan'}
            </p>
            <p className="font-bold text-slate-200 mt-1">{headerText}</p>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-slate-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                Instan (Instant)
              </span>
              <span className="font-mono font-black text-slate-100">{formatValue(valInstan)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-slate-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                Reguler (Ekspedisi)
              </span>
              <span className="font-mono font-black text-slate-100">{formatValue(valReguler)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-slate-300 font-bold">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                Manual (COD / Admin)
              </span>
              <span className="font-mono font-black text-slate-100">{formatValue(valManual)}</span>
            </div>
          </div>
          
          <div className="pt-2 border-t border-slate-800 flex justify-between items-center font-black">
            <span className="text-slate-400">Total Akumulasi:</span>
            <span className="font-mono text-emerald-400 text-[13px]">{formatValue(valAll)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="sales-channel-composition-card" className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      {/* 1. Header and Selectors */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Zap className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
              Komposisi Penjualan per Jalur Distribusi
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
            Analisis komposisi kontribusi saluran penjualan harian, mingguan, dan bulanan secara realtime.
          </p>
        </div>

        {/* Month Selector for Realtime analysis */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
            Bulan Analisa:
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 cursor-pointer"
          >
            {availableMonths.map(m => (
              <option key={m.yearMonth} value={m.yearMonth}>
                {m.name} {availableMonths[0]?.yearMonth === m.yearMonth ? '(Bulan Berjalan)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Primary Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Chart (Takes 8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            {/* Period Tabs: Harian, Mingguan, Bulanan */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 shadow-inner">
              <button
                onClick={() => setActivePeriod('harian')}
                className={`px-3 py-1.5 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  activePeriod === 'harian'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Harian
              </button>
              
              <button
                onClick={() => setActivePeriod('mingguan')}
                className={`px-3 py-1.5 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  activePeriod === 'mingguan'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Mingguan
              </button>

              <button
                onClick={() => setActivePeriod('bulanan')}
                className={`px-3 py-1.5 rounded-lg text-[10.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  activePeriod === 'bulanan'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Semua Bulan
              </button>
            </div>

            {/* Metric Toggle: Omzet vs Transaksi */}
            <div className="flex bg-slate-50 border border-slate-200 p-1 rounded-xl shadow-inner self-end sm:self-auto">
              <button
                onClick={() => setActiveMetric('sales')}
                className={`px-3.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeMetric === 'sales'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Omzet (Rupiah)
              </button>
              <button
                onClick={() => setActiveMetric('tx')}
                className={`px-3.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeMetric === 'tx'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Volume Transaksi
              </button>
            </div>
          </div>

          {/* Recharts Container */}
          <div className="h-[340px] w-full bg-slate-50/50 rounded-2xl p-4 border border-slate-100 relative">
            {chartData.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <Info className="w-8 h-8 mb-2 text-slate-300 animate-bounce" />
                <span className="text-xs font-bold">Data penjualan tidak ditemukan untuk periode ini</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 15, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 9.5, fill: '#64748b', fontWeight: 'bold' }} 
                    axisLine={false} 
                    tickLine={false} 
                    dy={5} 
                  />
                  <YAxis 
                    tickFormatter={v => activeMetric === 'sales' ? formatRupiahCompact(v) : `${formatNumberIndo(v)}`} 
                    tick={{ fontSize: 9.5, fill: '#64748b', fontWeight: 'bold' }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <Tooltip content={customTooltip} cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }} />
                  <Legend 
                    iconType="circle" 
                    wrapperStyle={{ fontSize: 10, fontWeight: 'bold', paddingTop: 10 }} 
                  />
                  
                  {/* Colors matched with main app:
                      Manual = Amber (#f59e0b)
                      Reguler = Blue (#3b82f6)
                      Instan = Emerald (#10b981)
                  */}
                  <Bar 
                    dataKey={activeMetric === 'sales' ? 'totalManual' : 'txManual'} 
                    name="Manual (COD/Admin)" 
                    stackId="a" 
                    fill="#f59e0b" 
                    maxBarSize={activePeriod === 'harian' ? 12 : 35}
                  />
                  <Bar 
                    dataKey={activeMetric === 'sales' ? 'totalReguler' : 'txReguler'} 
                    name="Reguler (Ekspedisi)" 
                    stackId="a" 
                    fill="#3b82f6" 
                    maxBarSize={activePeriod === 'harian' ? 12 : 35}
                  />
                  <Bar 
                    dataKey={activeMetric === 'sales' ? 'totalInstan' : 'txInstan'} 
                    name="Instan (Instant)" 
                    stackId="a" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={activePeriod === 'harian' ? 12 : 35}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          
          {/* Label indicating status */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {activePeriod === 'harian' 
                ? `Grafik di atas menampilkan rincian dari tgl 1 sampai akhir bulan ${currentMonthName}.`
                : activePeriod === 'mingguan'
                ? `Grafik menampilkan akumulasi per minggu (W1 s/d W5) di bulan ${currentMonthName}.`
                : `Grafik menampilkan tren perkembangan komposisi jalur distribusi untuk seluruh bulan.`}
            </span>
          </div>
        </div>

        {/* Right Column: Key Channel Summary Cards (Takes 4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
          
          <div className="space-y-3.5">
            <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
              Kontribusi Jalur ({currentMonthName})
            </h4>
            
            {/* INSTAN CARD */}
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3 shadow-inner/50">
              <div className="p-2.5 bg-emerald-500 rounded-xl text-white">
                <Zap className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-black text-emerald-950 uppercase tracking-tight">Instan</span>
                  <span className="text-xs font-black text-emerald-600 font-mono">
                    {selectedMonthSummary.instan.pctSales.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-500 mt-0.5">Gojek / Grab / ShopeeFood</p>
                <div className="mt-2.5 flex justify-between items-center border-t border-emerald-100/80 pt-2 text-[11px]">
                  <span className="text-slate-400 font-semibold">Omzet:</span>
                  <span className="font-mono font-bold text-slate-800">{formatRupiah(selectedMonthSummary.instan.sales)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] mt-1">
                  <span className="text-slate-400 font-semibold">Volume:</span>
                  <span className="font-mono text-slate-600">{selectedMonthSummary.instan.tx} Transaksi</span>
                </div>
                <div className="flex justify-between items-center text-[10px] mt-0.5">
                  <span className="text-slate-400 font-semibold">AOV Keranjang:</span>
                  <span className="font-mono text-slate-600">{formatRupiah(selectedMonthSummary.instan.aov)}</span>
                </div>
              </div>
            </div>

            {/* REGULER CARD */}
            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3 shadow-inner/50">
              <div className="p-2.5 bg-blue-500 rounded-xl text-white">
                <Truck className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-black text-blue-950 uppercase tracking-tight">Reguler</span>
                  <span className="text-xs font-black text-blue-600 font-mono">
                    {selectedMonthSummary.reguler.pctSales.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-500 mt-0.5">JNE / J&T / Shopee / Tokopedia</p>
                <div className="mt-2.5 flex justify-between items-center border-t border-blue-100/80 pt-2 text-[11px]">
                  <span className="text-slate-400 font-semibold">Omzet:</span>
                  <span className="font-mono font-bold text-slate-800">{formatRupiah(selectedMonthSummary.reguler.sales)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] mt-1">
                  <span className="text-slate-400 font-semibold">Volume:</span>
                  <span className="font-mono text-slate-600">{selectedMonthSummary.reguler.tx} Transaksi</span>
                </div>
                <div className="flex justify-between items-center text-[10px] mt-0.5">
                  <span className="text-slate-400 font-semibold">AOV Keranjang:</span>
                  <span className="font-mono text-slate-600">{formatRupiah(selectedMonthSummary.reguler.aov)}</span>
                </div>
              </div>
            </div>

            {/* MANUAL CARD */}
            <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3 shadow-inner/50">
              <div className="p-2.5 bg-amber-500 rounded-xl text-white">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-black text-amber-950 uppercase tracking-tight">Manual</span>
                  <span className="text-xs font-black text-amber-600 font-mono">
                    {selectedMonthSummary.manual.pctSales.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-500 mt-0.5">Admin WhatsApp / Cash on Delivery</p>
                <div className="mt-2.5 flex justify-between items-center border-t border-amber-100/80 pt-2 text-[11px]">
                  <span className="text-slate-400 font-semibold">Omzet:</span>
                  <span className="font-mono font-bold text-slate-800">{formatRupiah(selectedMonthSummary.manual.sales)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] mt-1">
                  <span className="text-slate-400 font-semibold">Volume:</span>
                  <span className="font-mono text-slate-600">{selectedMonthSummary.manual.tx} Transaksi</span>
                </div>
                <div className="flex justify-between items-center text-[10px] mt-0.5">
                  <span className="text-slate-400 font-semibold">AOV Keranjang:</span>
                  <span className="font-mono text-slate-600">{formatRupiah(selectedMonthSummary.manual.aov)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Bottom highlight insights box */}
          <div className="bg-gradient-to-br from-indigo-950 to-indigo-900 text-white p-4.5 rounded-2xl border border-indigo-950 space-y-2.5 shadow-md">
            <div className="flex items-center gap-1.5 text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">Wawasan Distribusi</span>
            </div>
            {selectedMonthSummary.totalSales > 0 ? (
              <div className="text-[11.5px] leading-relaxed text-indigo-100 font-medium space-y-1.5">
                <p>
                  Saluran penjualan utama adalah <strong className="text-white font-extrabold">{insights.topChannelName}</strong> dengan kontribusi <strong className="text-yellow-400 font-black">{insights.topChannelPct}%</strong> dari total omzet ({insights.topChannelSales}).
                </p>
                <p className="text-[10.5px] text-indigo-200/90 border-t border-indigo-800/80 pt-1.5">
                  💡 Jalur <strong className="text-white">{insights.topAovName}</strong> mencatat rata-rata belanja terbesar yaitu <strong className="text-yellow-400 font-black">{insights.topAovVal}</strong> per order.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-300">Memuat wawasan data berjalan...</p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
