import React, { useState, useMemo } from 'react';
import { DailySales } from '../types';
import { formatRupiah, formatNumberIndo, formatRupiahCompact } from '../utils';
import { 
  Target, Sparkles, TrendingUp, Sliders, CheckCircle2, 
  HelpCircle, AlertCircle, TrendingDown, RefreshCw
} from 'lucide-react';

interface SalesPredictionsProps {
  salesData: DailySales[];
}

export default function SalesPredictions({ salesData }: SalesPredictionsProps) {
  // Simulator targets
  const [targetOmzet, setTargetOmzet] = useState<number>(500000000); // Default 500jt target
  const [targetOrder, setTargetOrder] = useState<number>(3000); // Default 3000 order target

  // Simulator coefficients
  const [multiplierInstan, setMultiplierInstan] = useState<number>(100); // default 100% (no change)
  const [multiplierReguler, setMultiplierReguler] = useState<number>(100);
  const [multiplierManual, setMultiplierManual] = useState<number>(100);

  // General run rate stats
  const runRateStats = useMemo(() => {
    if (salesData.length === 0) return null;

    let totalSales = 0;
    let totalTx = 0;
    let totalInstanSales = 0;
    let totalRegulerSales = 0;
    let totalManualSales = 0;

    salesData.forEach(d => {
      totalSales += d.totalAll;
      totalTx += d.txAll;
      totalInstanSales += d.totalInstan;
      totalRegulerSales += d.totalReguler;
      totalManualSales += d.totalManual;
    });

    const daysCount = salesData.length;
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
  }, [salesData, multiplierInstan, multiplierReguler, multiplierManual]);

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Set Targets Panel & Progress */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
        <div className="space-y-4">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Target className="w-4.5 h-4.5 text-indigo-500" />
            Pengaturan Target &amp; Progress Belanja
          </h4>

          {/* Form input */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Target Akumulasi Omzet (IDR)</label>
              <input
                type="number"
                value={targetOmzet}
                onChange={e => setTargetOmzet(Math.max(0, Number(e.target.value)))}
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Target Akumulasi Transaksi (Tx)</label>
              <input
                type="number"
                value={targetOrder}
                onChange={e => setTargetOrder(Math.max(0, Number(e.target.value)))}
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
              />
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
  );
}
