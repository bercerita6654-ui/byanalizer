import React, { useState, useMemo, useEffect } from 'react';
import { DailySales, SalesOrder } from '../types';
import { formatRupiah, formatNumberIndo, formatRupiahCompact } from '../utils';
import { 
  Target, Sparkles, TrendingUp, Sliders, CheckCircle2, 
  HelpCircle, AlertCircle, TrendingDown, RefreshCw, Calendar, ChevronDown
} from 'lucide-react';

interface SalesPredictionsProps {
  salesData: DailySales[];
  allOrders?: SalesOrder[];
  selectedAdmin?: string;
}

export default function SalesPredictions({ salesData, allOrders = [], selectedAdmin = '' }: SalesPredictionsProps) {
  // Extract months strictly from Kolom 3: Tanggal of sheet LIST MENU PENJUALAN
  const availableMonths = useMemo(() => {
    if (allOrders && allOrders.length > 0) {
      const monthsMap = new Map<string, { yearMonth: string; label: string; totalSales: number; totalTx: number }>();
      allOrders.forEach(ord => {
        if (ord.isVoid) return;
        if (selectedAdmin && (ord.admin || ord.createdBy || '').trim() !== selectedAdmin) return;
        
        const dateStr = ord.date; // Kolom ke 3 Tanggal
        if (!dateStr || dateStr.length < 7) return;
        const yearMonth = dateStr.substring(0, 7);
        
        if (!monthsMap.has(yearMonth)) {
          const dateObj = new Date(`${yearMonth}-02`);
          let label = yearMonth;
          if (!isNaN(dateObj.getTime())) {
            label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(dateObj);
          }
          monthsMap.set(yearMonth, { yearMonth, label, totalSales: 0, totalTx: 0 });
        }
        
        const m = monthsMap.get(yearMonth)!;
        m.totalSales += ord.total || 0;
        m.totalTx += 1;
      });
      return Array.from(monthsMap.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    }

    // Fallback using salesData
    const monthsMap = new Map<string, { yearMonth: string; label: string; totalSales: number; totalTx: number }>();
    salesData.forEach(day => {
      const yearMonth = day.date.substring(0, 7);
      if (!monthsMap.has(yearMonth)) {
        const dateObj = new Date(`${yearMonth}-02`);
        let label = yearMonth;
        if (!isNaN(dateObj.getTime())) {
          label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(dateObj);
        }
        monthsMap.set(yearMonth, { yearMonth, label, totalSales: 0, totalTx: 0 });
      }
      const m = monthsMap.get(yearMonth)!;
      m.totalSales += day.totalAll;
      m.totalTx += day.txAll;
    });
    return Array.from(monthsMap.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  }, [allOrders, salesData, selectedAdmin]);

  // Selected month state ('all' or specific yearMonth like '2026-10')
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Simulator targets calibrated to LIST MENU PENJUALAN
  const [targetOmzet, setTargetOmzet] = useState<number>(450000000); // Level 1 (Bronze) Target: 450M
  const [targetOrder, setTargetOrder] = useState<number>(4000); // Average monthly tx: ~4000 Tx

  // Simulator coefficients
  const [multiplierInstan, setMultiplierInstan] = useState<number>(100); // default 100% (no change)
  const [multiplierReguler, setMultiplierReguler] = useState<number>(100);
  const [multiplierManual, setMultiplierManual] = useState<number>(100);

  // Active dataset filtered by selected month if specified
  const activeData = useMemo(() => {
    if (selectedMonth === 'all') return salesData;
    return salesData.filter(d => d.date.startsWith(selectedMonth));
  }, [salesData, selectedMonth]);

  // General run rate stats
  const runRateStats = useMemo(() => {
    if (activeData.length === 0) return null;

    let totalSales = 0;
    let totalTx = 0;
    let totalInstanSales = 0;
    let totalRegulerSales = 0;
    let totalManualSales = 0;

    activeData.forEach(d => {
      totalSales += d.totalAll;
      totalTx += d.txAll;
      totalInstanSales += d.totalInstan;
      totalRegulerSales += d.totalReguler;
      totalManualSales += d.totalManual;
    });

    const daysCount = activeData.length;
    const avgDailySales = totalSales / daysCount;
    const avgDailyTx = totalTx / daysCount;

    // Projection for 30 days based on run rate
    const project30DaysSales = avgDailySales * 30;
    const project30DaysTx = avgDailyTx * 30;

    // Simulation calculation based on multipliers
    const simInstan = totalInstanSales * (multiplierInstan / 100);
    const simReguler = totalRegulerSales * (multiplierReguler / 100);
    const simManual = totalManualSales * (multiplierManual / 100);
    const simTotalSales = simInstan + simReguler + simManual;

    // Simulation project for 30 days
    const simDailySales = simTotalSales / daysCount;
    const simProject30DaysSales = simDailySales * 30;

    return {
      daysCount,
      totalSales,
      totalTx,
      avgDailySales,
      avgDailyTx,
      project30DaysSales,
      project30DaysTx,
      simTotalSales,
      simDailySales,
      simProject30DaysSales,
      difference: simTotalSales - totalSales
    };
  }, [activeData, multiplierInstan, multiplierReguler, multiplierManual]);

  const resetSimulator = () => {
    setMultiplierInstan(100);
    setMultiplierReguler(100);
    setMultiplierManual(100);
  };

  if (!runRateStats) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-200 text-slate-500 font-bold rounded-2xl">
        Belum ada data penjualan harian untuk membuat simulasi prediksi.
      </div>
    );
  }

  // Target completeness percentages
  const pctOmzet = Math.min((runRateStats.totalSales / targetOmzet) * 100, 100);
  const pctOrder = Math.min((runRateStats.totalTx / targetOrder) * 100, 100);

  // Run rate progress targets
  const pctOmzetRunRate = Math.min((runRateStats.project30DaysSales / targetOmzet) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Month Selector from Kolom 3 Tanggal of LIST MENU PENJUALAN */}
      {availableMonths.length > 0 && (
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                  Periode Target (Kolom 3: Tanggal)
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  Pilih bulan dari sheet LIST MENU PENJUALAN untuk analisa dan simulasi target
                </p>
              </div>
            </div>
            {selectedMonth !== 'all' && (
              <button
                onClick={() => setSelectedMonth('all')}
                className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 transition-all cursor-pointer self-start sm:self-auto"
              >
                Tampilkan Semua Periode
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 pt-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <button
              type="button"
              onClick={() => setSelectedMonth('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all shrink-0 cursor-pointer ${
                selectedMonth === 'all'
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Semua Periode ({salesData.length} Hari)
            </button>
            {availableMonths.map((m) => (
              <button
                key={m.yearMonth}
                type="button"
                onClick={() => {
                  setSelectedMonth(m.yearMonth);
                  // Auto-suggest realistic target omzet for this month if appropriate
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  selectedMonth === m.yearMonth
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{m.label}</span>
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                  selectedMonth === m.yearMonth
                    ? 'bg-indigo-700 text-white'
                    : 'bg-slate-200 text-slate-700 font-mono'
                }`}>
                  {formatRupiahCompact(m.totalSales)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Set Targets Panel & Progress */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Target className="w-4.5 h-4.5 text-indigo-500" />
              Pengaturan Target &amp; Realisasi
            </h4>

            {/* Form input */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Target Akumulasi Omzet (IDR)</label>
                <input
                  type="number"
                  value={targetOmzet}
                  onChange={e => setTargetOmzet(Math.max(0, Number(e.target.value)))}
                  className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800 font-mono"
                />
                {/* Presets calibrated to LIST MENU PENJUALAN */}
                <div className="flex gap-1.5 pt-1.5">
                  {[
                    { label: 'Lvl 1 (450M)', val: 450000000 },
                    { label: 'Lvl 2 (525M)', val: 525000000 },
                    { label: 'Lvl 3 (600M)', val: 600000000 }
                  ].map(p => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setTargetOmzet(p.val)}
                      className={`flex-1 px-2 py-1 rounded-lg text-[9px] font-black transition-all border cursor-pointer ${
                        targetOmzet === p.val
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Target Akumulasi Transaksi (Tx)</label>
                <input
                  type="number"
                  value={targetOrder}
                  onChange={e => setTargetOrder(Math.max(0, Number(e.target.value)))}
                  className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800 font-mono"
                />
                {/* Presets for Target Transaksi */}
                <div className="flex gap-1.5 pt-1.5">
                  {[
                    { label: '3.500 Tx', val: 3500 },
                    { label: '4.000 Tx', val: 4000 },
                    { label: '4.500 Tx', val: 4500 }
                  ].map(p => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setTargetOrder(p.val)}
                      className={`flex-1 px-2 py-1 rounded-lg text-[9px] font-black transition-all border cursor-pointer ${
                        targetOrder === p.val
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          {/* Progress Omzet */}
          <div className="space-y-2">
            <div className="flex justify-between items-end text-xs">
              <span className="font-bold text-slate-600">Pencapaian Omzet</span>
              <span className="font-black text-slate-800">{pctOmzet.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-1000"
                style={{ width: `${pctOmzet}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-400 font-bold">
              {formatRupiah(runRateStats.totalSales)} terealisasi dari target {formatRupiah(targetOmzet)}
            </p>
          </div>

          {/* Progress Order Volume */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-end text-xs">
              <span className="font-bold text-slate-600">Pencapaian Volume</span>
              <span className="font-black text-slate-800">{pctOrder.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-1000"
                style={{ width: `${pctOrder}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-400 font-bold">
              {formatNumberIndo(runRateStats.totalTx)} Tx terealisasi dari target {formatNumberIndo(targetOrder)} Tx
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 text-[10px] text-slate-400 font-bold flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>Atur target di atas untuk menguji tingkat kesiapan performa omzet Anda secara berkala.</span>
        </div>
      </div>

      {/* Prediction Run Rate Panel */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
        <div className="space-y-4">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-4.5 h-4.5 text-indigo-500" />
            Metode Proyeksi Run-Rate &amp; Estimasi
          </h4>

          {/* KPI Projection blocks */}
          <div className="space-y-3">
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
              <p className="text-[9px] font-black uppercase text-indigo-600">Rata-rata Run Rate Bulanan (30 Hari)</p>
              <h5 className="text-xl font-black text-indigo-950 mt-1 leading-none">{formatRupiah(runRateStats.project30DaysSales)}</h5>
              <p className="text-[10px] text-indigo-500 font-semibold mt-1.5">Berdasarkan kecepatan omzet harian: {formatRupiah(runRateStats.avgDailySales)} / hari.</p>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
              <p className="text-[9px] font-black uppercase text-emerald-600">Estimasi Transaksi Bulanan (30 Hari)</p>
              <h5 className="text-xl font-black text-emerald-950 mt-1 leading-none">{formatNumberIndo(Math.round(runRateStats.project30DaysTx))} Tx</h5>
              <p className="text-[10px] text-emerald-500 font-semibold mt-1.5">Berdasarkan kecepatan transaksi harian: {Math.round(runRateStats.avgDailyTx)} order / hari.</p>
            </div>
          </div>

          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
            <div className="flex justify-between font-bold text-slate-700">
              <span>Rasio Target vs Run Rate:</span>
              <span className={pctOmzetRunRate >= 100 ? 'text-emerald-600' : 'text-slate-600'}>{pctOmzetRunRate.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${pctOmzetRunRate >= 100 ? 'bg-emerald-500' : 'bg-slate-400'}`}
                style={{ width: `${pctOmzetRunRate}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">
              Dengan laju ini, omzet bulanan Anda akan mencapai {pctOmzetRunRate >= 100 ? 'lebih dari' : 'sekitar'} {pctOmzetRunRate.toFixed(0)}% dari target.
            </p>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 font-bold italic">
          *Proyeksi ini bersifat statistik linear sederhana mengacu pada performa historis.
        </p>
      </div>

      {/* Simulator Coefficients Sliders */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Sliders className="w-4.5 h-4.5 text-indigo-500" />
              Simulator Skenario Dampak
            </h4>
            
            <button 
              onClick={resetSimulator}
              className="p-1 hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
              title="Reset Simulator"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Slider 1: Instan */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-black">
              <span className="text-slate-500">Omzet Instan</span>
              <span className="text-indigo-600 font-mono">{multiplierInstan}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="200"
              value={multiplierInstan}
              onChange={e => setMultiplierInstan(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Slider 2: Reguler */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-black">
              <span className="text-slate-500">Omzet Reguler</span>
              <span className="text-indigo-600 font-mono">{multiplierReguler}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="200"
              value={multiplierReguler}
              onChange={e => setMultiplierReguler(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Slider 3: Manual */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-black">
              <span className="text-slate-500">Omzet Manual</span>
              <span className="text-indigo-600 font-mono">{multiplierManual}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="200"
              value={multiplierManual}
              onChange={e => setMultiplierManual(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Impact block */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-600">Dampak Simulasi Omzet:</span>
              <span className={`font-black flex items-center gap-1 ${
                runRateStats.difference >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {runRateStats.difference >= 0 ? (
                  <>
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{formatRupiahCompact(runRateStats.difference)}
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-3.5 h-3.5" />
                    {formatRupiahCompact(runRateStats.difference)}
                  </>
                )}
              </span>
            </div>
            
            <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-500 leading-relaxed">
              Jika skenario target ini berjalan, total omzet simulasi historis akan berubah menjadi <span className="text-slate-800 font-black">{formatRupiah(runRateStats.simTotalSales)}</span>.
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
          💡 Geser slider untuk memodelkan dampak peningkatan/penurunan penjualan per channel terhadap target bisnis Anda.
        </p>
      </div>
    </div>
  </div>
  );
}
