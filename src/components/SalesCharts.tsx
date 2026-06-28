import React, { useState, useMemo } from 'react';
import { DailySales, ChartTab } from '../types';
import { formatRupiahCompact, formatNumberIndo } from '../utils';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, BarChart, Bar, LineChart, Line,
  ReferenceLine
} from 'recharts';
import { BarChart3, LineChart as LucideLineChart, HelpCircle, Activity, Sparkles, Calendar } from 'lucide-react';

// Static definitions for H1 2026 Holidays in Indonesia
const INDONESIAN_HOLIDAYS = [
  { date: '2026-01-01', label: '01-01', name: 'Tahun Baru Masehi', type: 'national' },
  { date: '2026-01-16', label: '01-16', name: "Isra Mi'raj Nabi Muhammad", type: 'national' },
  { date: '2026-02-17', label: '02-17', name: 'Tahun Baru Imlek', type: 'national' },
  { date: '2026-03-19', label: '03-19', name: 'Hari Suci Nyepi', type: 'national' },
  { date: '2026-03-20', label: '03-20', name: 'Idul Fitri 1447 H (H1)', type: 'national' },
  { date: '2026-03-21', label: '03-21', name: 'Idul Fitri 1447 H (H2)', type: 'national' },
  { date: '2026-04-03', label: '04-03', name: 'Wafat Isa Almasih (Good Friday)', type: 'national' },
  { date: '2026-05-01', label: '05-01', name: 'Hari Buruh Internasional', type: 'national' },
  { date: '2026-05-14', label: '05-14', name: 'Kenaikan Isa Almasih', type: 'national' },
  { date: '2026-05-27', label: '05-27', name: 'Hari Raya Idul Adha', type: 'national' },
  { date: '2026-06-01', label: '06-01', name: 'Hari Lahir Pancasila', type: 'national' },
  { date: '2026-06-17', label: '06-17', name: 'Tahun Baru Islam 1448 H', type: 'national' }
];

// Balinese Traditional Holidays in H1 2026
const BALINESE_HOLIDAYS = [
  { date: '2026-01-14', label: '01-14', name: 'Hari Raya Galungan', type: 'balinese' },
  { date: '2026-01-24', label: '01-24', name: 'Hari Raya Kuningan', type: 'balinese' },
  { date: '2026-03-19', label: '03-19', name: 'Hari Suci Nyepi (Saka 1948)', type: 'balinese' }
];

interface SalesChartsProps {
  salesData: DailySales[];
}

export default function SalesCharts({ salesData }: SalesChartsProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('trend');
  const [timeScale, setTimeScale] = useState<'daily' | 'monthly'>('daily');

  // Toggle states for Holiday markers
  const [showNationalHolidays, setShowNationalHolidays] = useState<boolean>(true);
  const [showBalineseHolidays, setShowBalineseHolidays] = useState<boolean>(true);

  const aggregatedData = useMemo(() => {
    if (timeScale === 'daily') {
      return salesData.map(day => ({
        ...day,
        aov: day.txAll > 0 ? Math.round(day.totalAll / day.txAll) : 0,
        label: day.date.substring(5) // MM-DD for cleaner spacing
      }));
    }

    // Monthly aggregation
    const monthlyGroups: { [key: string]: any } = {};
    const monthNamesIndo = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    salesData.forEach(day => {
      const yearMonth = day.date.substring(0, 7); // YYYY-MM
      if (!monthlyGroups[yearMonth]) {
        const monthNum = parseInt(yearMonth.split('-')[1]);
        monthlyGroups[yearMonth] = {
          label: monthNamesIndo[monthNum - 1],
          totalInstan: 0,
          txInstan: 0,
          totalReguler: 0,
          txReguler: 0,
          totalManual: 0,
          txManual: 0,
          totalAll: 0,
          txAll: 0,
          daysCount: 0
        };
      }

      monthlyGroups[yearMonth].totalInstan += day.totalInstan;
      monthlyGroups[yearMonth].txInstan += day.txInstan;
      monthlyGroups[yearMonth].totalReguler += day.totalReguler;
      monthlyGroups[yearMonth].txReguler += day.txReguler;
      monthlyGroups[yearMonth].totalManual += day.totalManual;
      monthlyGroups[yearMonth].txManual += day.txManual;
      monthlyGroups[yearMonth].totalAll += day.totalAll;
      monthlyGroups[yearMonth].txAll += day.txAll;
      monthlyGroups[yearMonth].daysCount += 1;
    });

    return Object.entries(monthlyGroups)
      .map(([key, data]) => ({
        ...data,
        date: key,
        aov: data.txAll > 0 ? Math.round(data.totalAll / data.txAll) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [salesData, timeScale]);

  // Determine holidays currently active based on toggles
  const activeHolidays = useMemo(() => {
    const list: any[] = [];
    if (showNationalHolidays) {
      list.push(...INDONESIAN_HOLIDAYS);
    }
    if (showBalineseHolidays) {
      BALINESE_HOLIDAYS.forEach(h => {
        if (!list.some(existing => existing.label === h.label)) {
          list.push(h);
        }
      });
    }
    return list;
  }, [showNationalHolidays, showBalineseHolidays]);

  // Filter holidays that are actually visible on the chart range (to prevent drawing out of bounds lines)
  const visibleHolidays = useMemo(() => {
    if (timeScale !== 'daily' || activeHolidays.length === 0) return [];
    
    const labelsInChart = new Set(aggregatedData.map(d => d.label));
    return activeHolidays.filter(h => labelsInChart.has(h.label));
  }, [timeScale, aggregatedData, activeHolidays]);

  // Render tooltip specifically customized for Indonesian rupiah and holiday tags
  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Find if there is a holiday on this date
      const holidayOnThisDate = timeScale === 'daily' 
        ? activeHolidays.find(h => h.label === label) 
        : null;

      return (
        <div className="bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-xl space-y-2 text-xs min-w-[220px]">
          <div className="border-b border-slate-800 pb-1.5 mb-1.5">
            <p className="font-black text-slate-400">
              {timeScale === 'daily' ? `Tanggal: ${label}` : `Bulan: ${label}`}
            </p>
            {holidayOnThisDate && (
              <div className={`mt-1.5 px-2 py-0.5 rounded-lg text-[9px] font-extrabold border uppercase tracking-wider text-center ${
                holidayOnThisDate.type === 'national'
                  ? 'bg-rose-950/60 border-rose-800/80 text-rose-300'
                  : 'bg-amber-950/60 border-amber-800/80 text-amber-300'
              }`}>
                🎉 {holidayOnThisDate.name}
              </div>
            )}
          </div>
          
          {payload.map((entry: any, index: number) => {
            const isCurrency = entry.name.toLowerCase().includes('total') || entry.name.toLowerCase().includes('omzet') || entry.name.toLowerCase().includes('aov');
            const valueFormatted = isCurrency ? formatRupiahCompact(entry.value) : `${formatNumberIndo(entry.value)} Tx`;
            return (
              <div key={index} className="flex justify-between items-center gap-4">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.name}
                </span>
                <span className="font-mono text-slate-300 font-bold">{valueFormatted}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
      
      {/* Header and Toggles */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        
        {/* Left Side: Navigation Links */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 shadow-inner">
          <button
            onClick={() => setActiveTab('trend')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'trend'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LucideLineChart className="w-3.5 h-3.5" />
            Tren Total
          </button>
          
          <button
            onClick={() => setActiveTab('channel')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'channel'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Distribusi Channel
          </button>

          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'comparison'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Transaksi
          </button>

          <button
            onClick={() => setActiveTab('aov')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'aov'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Nilai Keranjang (AOV)
          </button>
        </div>

        {/* Right Side: Scale toggle (Daily / Monthly) */}
        <div className="flex bg-slate-50 border border-slate-200 p-1 rounded-xl shadow-inner self-end sm:self-auto">
          <button
            onClick={() => setTimeScale('daily')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              timeScale === 'daily'
                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Harian
          </button>
          <button
            onClick={() => setTimeScale('monthly')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              timeScale === 'monthly'
                ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Bulanan
          </button>
        </div>

      </div>

      {/* Holiday Overlay Toggle Controller Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50 border border-slate-200/60 p-4.5 rounded-2xl">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100/60 shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-wider leading-none">Indikator Hari Libur &amp; Hari Raya 2026</h4>
            <p className="text-[9.5px] text-slate-400 font-bold mt-1">Overlay hari libur pada lini waktu untuk melihat pengaruh atau korelasi omzet</p>
          </div>
        </div>

        {timeScale === 'daily' ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowNationalHolidays(!showNationalHolidays)}
              className={`px-3 py-1.5 rounded-xl text-[9.5px] font-extrabold uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                showNationalHolidays
                  ? 'bg-rose-50 border-rose-200/80 text-rose-700 font-black shadow-sm'
                  : 'bg-white border-slate-200/80 text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showNationalHolidays ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`} />
              Libur Nasional Indonesia
            </button>

            <button
              onClick={() => setShowBalineseHolidays(!showBalineseHolidays)}
              className={`px-3 py-1.5 rounded-xl text-[9.5px] font-extrabold uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                showBalineseHolidays
                  ? 'bg-amber-50 border-amber-200/80 text-amber-700 font-black shadow-sm'
                  : 'bg-white border-slate-200/80 text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showBalineseHolidays ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`} />
              Hari Raya Tradisional Bali
            </button>
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 font-bold italic">
            💡 Overlay indikator hari raya otomatis aktif ketika skala grafik diatur ke &quot;Harian&quot;.
          </div>
        )}
      </div>

      {/* Main Chart Area */}
      <div className="h-[400px] w-full relative">
        {aggregatedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {/* Conditional Render Based on Tab */}
            {activeTab === 'trend' ? (
              <AreaChart data={aggregatedData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tickFormatter={v => formatRupiahCompact(v)} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 'bold', paddingTop: 10 }} />
                <Area type="monotone" name="Total Omzet Penjualan" dataKey="totalAll" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                
                {/* Overlay Holiday Reference Lines */}
                {visibleHolidays.map(holiday => (
                  <ReferenceLine
                    key={`trend-${holiday.type}-${holiday.date}`}
                    x={holiday.label}
                    stroke={holiday.type === 'national' ? '#f43f5e' : '#d97706'}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: holiday.name.length > 15 ? holiday.name.substring(0, 15) + '..' : holiday.name,
                      position: 'top',
                      fill: holiday.type === 'national' ? '#e11d48' : '#b45309',
                      fontSize: 8,
                      fontWeight: 'black',
                      dy: -8
                    }}
                  />
                ))}
              </AreaChart>
            ) : activeTab === 'channel' ? (
              <BarChart data={aggregatedData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tickFormatter={v => formatRupiahCompact(v)} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 'bold', paddingTop: 10 }} />
                <Bar dataKey="totalManual" name="Manual Sales" stackId="a" fill="#f59e0b" maxBarSize={45} />
                <Bar dataKey="totalReguler" name="Reguler Sales" stackId="a" fill="#3b82f6" maxBarSize={45} />
                <Bar dataKey="totalInstan" name="Instan Sales" stackId="a" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={45} />

                {/* Overlay Holiday Reference Lines */}
                {visibleHolidays.map(holiday => (
                  <ReferenceLine
                    key={`channel-${holiday.type}-${holiday.date}`}
                    x={holiday.label}
                    stroke={holiday.type === 'national' ? '#f43f5e' : '#d97706'}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: holiday.name.length > 15 ? holiday.name.substring(0, 15) + '..' : holiday.name,
                      position: 'top',
                      fill: holiday.type === 'national' ? '#e11d48' : '#b45309',
                      fontSize: 8,
                      fontWeight: 'black',
                      dy: -8
                    }}
                  />
                ))}
              </BarChart>
            ) : activeTab === 'comparison' ? (
              <BarChart data={aggregatedData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 'bold', paddingTop: 10 }} />
                <Bar dataKey="txManual" name="Order Manual" fill="#f59e0b" maxBarSize={20} radius={[3, 3, 0, 0]} />
                <Bar dataKey="txReguler" name="Order Reguler" fill="#3b82f6" maxBarSize={20} radius={[3, 3, 0, 0]} />
                <Bar dataKey="txInstan" name="Order Instan" fill="#10b981" maxBarSize={20} radius={[3, 3, 0, 0]} />

                {/* Overlay Holiday Reference Lines */}
                {visibleHolidays.map(holiday => (
                  <ReferenceLine
                    key={`comp-${holiday.type}-${holiday.date}`}
                    x={holiday.label}
                    stroke={holiday.type === 'national' ? '#f43f5e' : '#d97706'}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: holiday.name.length > 15 ? holiday.name.substring(0, 15) + '..' : holiday.name,
                      position: 'top',
                      fill: holiday.type === 'national' ? '#e11d48' : '#b45309',
                      fontSize: 8,
                      fontWeight: 'black',
                      dy: -8
                    }}
                  />
                ))}
              </BarChart>
            ) : (
              <LineChart data={aggregatedData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tickFormatter={v => formatRupiahCompact(v)} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip content={customTooltip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 'bold', paddingTop: 10 }} />
                <Line type="monotone" name="Rata-rata Order (AOV)" dataKey="aov" stroke="#f43f5e" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }} />

                {/* Overlay Holiday Reference Lines */}
                {visibleHolidays.map(holiday => (
                  <ReferenceLine
                    key={`aov-${holiday.type}-${holiday.date}`}
                    x={holiday.label}
                    stroke={holiday.type === 'national' ? '#f43f5e' : '#d97706'}
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: holiday.name.length > 15 ? holiday.name.substring(0, 15) + '..' : holiday.name,
                      position: 'top',
                      fill: holiday.type === 'national' ? '#e11d48' : '#b45309',
                      fontSize: 8,
                      fontWeight: 'black',
                      dy: -8
                    }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 font-bold italic">
            Belum ada data visualisasi yang dapat ditampilkan.
          </div>
        )}
      </div>
    </div>
  );
}
