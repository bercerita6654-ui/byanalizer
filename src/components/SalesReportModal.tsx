import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DailySales, MarketingEvent } from '../types';
import { formatRupiah, formatNumberIndo, formatDateIndo, formatRupiahCompact } from '../utils';
import { 
  X, Printer, Calendar, FileText, ArrowUpRight, TrendingUp, 
  Trophy, Target, CheckCircle2, ChevronRight, BarChart3, ArrowDown, ArrowUp, Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface SalesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesData: DailySales[];
  events: MarketingEvent[];
}

function getPriorMonths(yearMonthStr: string): string[] {
  const [yearStr, monthStr] = yearMonthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  
  const prior1Month = month === 1 ? 12 : month - 1;
  const prior1Year = month === 1 ? year - 1 : year;
  
  const prior2Month = prior1Month === 1 ? 12 : prior1Month - 1;
  const prior2Year = prior1Month === 1 ? prior1Year - 1 : prior1Year;
  
  const pad = (num: number) => String(num).padStart(2, '0');
  return [
    `${prior1Year}-${pad(prior1Month)}`,
    `${prior2Year}-${pad(prior2Month)}`
  ];
}

function formatMonthLabel(yearMonthStr: string): string {
  if (!yearMonthStr) return '';
  const [year, month] = yearMonthStr.split('-');
  const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  if (isNaN(dateObj.getTime())) return yearMonthStr;
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(dateObj);
}

function parseAndConvertOklch(match: string, content: string): string {
  try {
    const normalized = content.replace(/,/g, ' ').replace(/\//g, ' ').trim();
    const parts = normalized.split(/\s+/);
    if (parts.length < 3) return match;
    
    let lStr = parts[0];
    let l = parseFloat(lStr);
    if (lStr.endsWith('%')) {
      l = l / 100;
    }
    
    let cStr = parts[1];
    let c = parseFloat(cStr);
    if (cStr.endsWith('%')) {
      c = (c / 100) * 0.4;
    }
    
    let hStr = parts[2];
    let h = parseFloat(hStr);
    if (hStr.endsWith('deg')) {
      h = parseFloat(hStr);
    } else if (hStr.endsWith('turn')) {
      h = parseFloat(hStr) * 360;
    } else if (hStr.endsWith('rad')) {
      h = parseFloat(hStr) * (180 / Math.PI);
    } else if (hStr.endsWith('grad')) {
      h = parseFloat(hStr) * 0.9;
    }
    
    if (isNaN(l) || isNaN(c) || isNaN(h)) return match;
    
    const hRad = (h * Math.PI) / 180;
    const a = c * Math.cos(hRad);
    const b_val = c * Math.sin(hRad);
    
    const l_ = l + 0.3963377774 * a + 0.2158037573 * b_val;
    const m_ = l - 0.1055613458 * a - 0.0638541728 * b_val;
    const s_ = l - 0.0894841775 * a - 1.2914855480 * b_val;
    
    const l1 = l_ * l_ * l_;
    const m1 = m_ * m_ * m_;
    const s1 = s_ * s_ * s_;
    
    const r = +4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1;
    const g = -1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1;
    const b_rgb = -0.0041960863 * l1 - 0.7034186147 * m1 + 1.7076147010 * s1;
    
    const fn = (val: number) => {
      const cVal = Math.max(0, val);
      return cVal <= 0.0031308 ? 12.92 * cVal : 1.055 * Math.pow(cVal, 1 / 2.4) - 0.055;
    };
    
    const R = Math.round(Math.max(0, Math.min(1, fn(r))) * 255);
    const G = Math.round(Math.max(0, Math.min(1, fn(g))) * 255);
    const B = Math.round(Math.max(0, Math.min(1, fn(b_rgb))) * 255);
    
    let alphaStr = parts[3];
    if (alphaStr) {
      let alpha = parseFloat(alphaStr);
      if (alphaStr.endsWith('%')) {
        alpha = alpha / 100;
      }
      if (!isNaN(alpha)) {
        return `rgba(${R}, ${G}, ${B}, ${alpha})`;
      }
    }
    
    return `rgb(${R}, ${G}, ${B})`;
  } catch (e) {
    return match;
  }
}

export default function SalesReportModal({ isOpen, onClose, salesData, events }: SalesReportModalProps) {
  // Extract all available months from the dataset
  const availableMonths = useMemo(() => {
    const monthsMap = new Map<string, { yearMonth: string; label: string; totalSales: number }>();
    const sortedData = [...salesData].sort((a, b) => a.date.localeCompare(b.date));
    
    sortedData.forEach(day => {
      const parts = day.date.split('-');
      if (parts.length >= 2) {
        const yearMonth = `${parts[0]}-${parts[1]}`;
        const label = formatMonthLabel(yearMonth);
        
        const existing = monthsMap.get(yearMonth);
        if (existing) {
          existing.totalSales += day.totalAll;
        } else {
          monthsMap.set(yearMonth, { yearMonth, label, totalSales: day.totalAll });
        }
      }
    });

    // Recalculate accurately
    monthsMap.forEach((val, key) => {
      val.totalSales = salesData
        .filter(day => day.date.startsWith(key))
        .reduce((sum, d) => sum + d.totalAll, 0);
    });

    return Array.from(monthsMap.values()).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  }, [salesData]);

  // Selected month state
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Set default selected month to latest month in dataset
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0].yearMonth);
    }
  }, [availableMonths, selectedMonth]);

  // Report details state & configurations
  const [reportTitle, setReportTitle] = useState<string>('Laporan Evaluasi & Kinerja Penjualan Bulanan');
  const [preparedBy, setPreparedBy] = useState<string>('Koordinator Toko / Operasional');
  const [approvedBy, setApprovedBy] = useState<string>('Pemilik Toko (Owner)');

  // Selected Month Data
  const currentMonthData = useMemo(() => {
    if (!selectedMonth) return [];
    return salesData.filter(day => day.date.startsWith(selectedMonth)).sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedMonth, salesData]);

  // Selected Month Summary Stats
  const currentMonthSummary = useMemo(() => {
    if (currentMonthData.length === 0) return null;
    
    let totalSales = 0;
    let totalTx = 0;
    let totalInstan = 0;
    let totalReguler = 0;
    let totalManual = 0;
    let txInstan = 0;
    let txReguler = 0;
    let txManual = 0;
    let maxDaySales = -1;
    let maxDayDate = '';
    let minDaySales = Infinity;
    let minDayDate = '';

    currentMonthData.forEach(day => {
      totalSales += day.totalAll;
      totalTx += day.txAll;
      totalInstan += day.totalInstan;
      totalReguler += day.totalReguler;
      totalManual += day.totalManual;
      txInstan += day.txInstan;
      txReguler += day.txReguler;
      txManual += day.txManual;

      if (day.totalAll > maxDaySales) {
        maxDaySales = day.totalAll;
        maxDayDate = day.date;
      }
      if (day.totalAll > 0 && day.totalAll < minDaySales) {
        minDaySales = day.totalAll;
        minDayDate = day.date;
      }
    });

    const activeDays = currentMonthData.length;
    const avgDailySales = activeDays > 0 ? totalSales / activeDays : 0;
    const avgTxPerDay = activeDays > 0 ? totalTx / activeDays : 0;
    const aov = totalTx > 0 ? totalSales / totalTx : 0;

    return {
      activeDays,
      totalSales,
      totalTx,
      avgDailySales,
      avgTxPerDay,
      aov,
      maxDaySales,
      maxDayDate,
      minDaySales: minDaySales === Infinity ? 0 : minDaySales,
      minDayDate: minDayDate === '' ? '-' : minDayDate,
      channelSplit: {
        instan: { sales: totalInstan, tx: txInstan, pct: totalSales > 0 ? (totalInstan / totalSales) * 100 : 0 },
        reguler: { sales: totalReguler, tx: txReguler, pct: totalSales > 0 ? (totalReguler / totalSales) * 100 : 0 },
        manual: { sales: totalManual, tx: txManual, pct: totalSales > 0 ? (totalManual / totalSales) * 100 : 0 },
      }
    };
  }, [currentMonthData]);

  // Target achievements for the selected month (bronze: 600m, silver: 700m, gold: 800m)
  const targetAchievementsList = useMemo(() => {
    if (!currentMonthSummary) return [];
    const totalSales = currentMonthSummary.totalSales;
    
    return [
      { key: 'bronze', label: 'Bronze (600M)', target: 600000000, achieved: totalSales >= 600000000, pct: (totalSales / 600000000) * 100 },
      { key: 'silver', label: 'Silver (700M)', target: 700000000, achieved: totalSales >= 700000000, pct: (totalSales / 700000000) * 100 },
      { key: 'gold', label: 'Gold (800M)', target: 800000000, achieved: totalSales >= 800000000, pct: (totalSales / 800000000) * 100 },
    ];
  }, [currentMonthSummary]);

  // Weekly Analysis
  const weeklyAnalysis = useMemo(() => {
    if (currentMonthData.length === 0) return [];

    const weeks = [
      { id: 1, label: 'Minggu I (Tgl 01-07)', start: 1, end: 7 },
      { id: 2, label: 'Minggu II (Tgl 08-14)', start: 8, end: 14 },
      { id: 3, label: 'Minggu III (Tgl 15-21)', start: 15, end: 21 },
      { id: 4, label: 'Minggu IV & V (Tgl 22+)', start: 22, end: 31 },
    ];

    return weeks.map(week => {
      const daysInWeek = currentMonthData.filter(day => {
        const dateParts = day.date.split('-');
        if (dateParts.length >= 3) {
          const dateNum = parseInt(dateParts[2], 10);
          return dateNum >= week.start && dateNum <= week.end;
        }
        return false;
      });

      const totalSales = daysInWeek.reduce((sum, d) => sum + d.totalAll, 0);
      const totalTx = daysInWeek.reduce((sum, d) => sum + d.txAll, 0);
      const activeDays = daysInWeek.length;
      const avgSales = activeDays > 0 ? totalSales / activeDays : 0;

      return {
        ...week,
        totalSales,
        totalTx,
        activeDays,
        avgSales
      };
    });
  }, [currentMonthData]);

  // 2 Months Prior Comparison
  const priorComparison = useMemo(() => {
    if (!selectedMonth) return null;
    const [prior1Key, prior2Key] = getPriorMonths(selectedMonth);

    const getMonthStats = (key: string) => {
      const filtered = salesData.filter(d => d.date.startsWith(key));
      const totalSales = filtered.reduce((sum, d) => sum + d.totalAll, 0);
      const totalTx = filtered.reduce((sum, d) => sum + d.txAll, 0);
      const activeDays = filtered.length;
      const avgDailySales = activeDays > 0 ? totalSales / activeDays : 0;
      const aov = totalTx > 0 ? totalSales / totalTx : 0;

      return {
        key,
        label: formatMonthLabel(key),
        totalSales,
        totalTx,
        activeDays,
        avgDailySales,
        aov,
        hasData: filtered.length > 0
      };
    };

    const curStats = {
      label: formatMonthLabel(selectedMonth),
      totalSales: currentMonthSummary?.totalSales || 0,
      totalTx: currentMonthSummary?.totalTx || 0,
      activeDays: currentMonthSummary?.activeDays || 0,
      avgDailySales: currentMonthSummary?.avgDailySales || 0,
      aov: currentMonthSummary?.aov || 0,
      hasData: (currentMonthSummary?.activeDays || 0) > 0
    };

    const prior1Stats = getMonthStats(prior1Key);
    const prior2Stats = getMonthStats(prior2Key);

    // Calculate growth percentages
    const calculateGrowth = (currentVal: number, priorVal: number) => {
      if (priorVal <= 0) return 0;
      return ((currentVal - priorVal) / priorVal) * 100;
    };

    return {
      current: curStats,
      prior1: prior1Stats,
      prior2: prior2Stats,
      growthVsPrior1: prior1Stats.hasData ? calculateGrowth(curStats.totalSales, prior1Stats.totalSales) : null,
      growthVsPrior2: prior2Stats.hasData ? calculateGrowth(curStats.totalSales, prior2Stats.totalSales) : null,
      txGrowthVsPrior1: prior1Stats.hasData ? calculateGrowth(curStats.totalTx, prior1Stats.totalTx) : null,
    };
  }, [selectedMonth, salesData, currentMonthSummary]);

  // Check if we are in an iframe
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }
  }, []);

  // Handlers
  const handlePrint = () => {
    const originalTitle = document.title;
    const formattedMonth = formatMonthLabel(selectedMonth);
    // Set document title exactly as requested so standard print uses it as the file name
    document.title = `Laporan Penjualan (${formattedMonth})`;
    window.focus();
    window.print();
    // Restore original title shortly after
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    
    try {
      const formattedMonth = formatMonthLabel(selectedMonth);
      const fileName = `Laporan Penjualan (${formattedMonth}).pdf`;
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pages = reportRef.current.querySelectorAll('[data-pdf-page]');
      
      for (let idx = 0; idx < pages.length; idx++) {
        const pageEl = pages[idx] as HTMLElement;
        
        const canvas = await html2canvas(pageEl, {
          scale: 2.2, // Extremely sharp resolution for crisp text & charts
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          scrollY: 0,
          scrollX: 0,
          windowWidth: 794, // Standard A4 pixel width at 96 DPI
          onclone: (clonedDoc) => {
            // Reset styles on the cloned page element inside html2canvas to ensure absolute A4 scale
            const clonedPage = clonedDoc.querySelector(`[data-pdf-page="${idx + 1}"]`) as HTMLElement;
            if (clonedPage) {
              clonedPage.style.transform = 'none';
              clonedPage.style.scale = 'none';
              clonedPage.style.margin = '0';
              clonedPage.style.boxShadow = 'none';
              clonedPage.style.border = 'none';
              clonedPage.style.borderRadius = '0';
              clonedPage.style.width = '210mm';
              clonedPage.style.height = '297mm';
              clonedPage.style.boxSizing = 'border-box';
            }

            // Fix tailwind oklch color functions to prevent html2canvas crashes
            const styles = clonedDoc.querySelectorAll('style');
            styles.forEach(style => {
              style.innerHTML = style.innerHTML.replace(/oklch\(([^)]+)\)/gi, (match, content) => {
                return parseAndConvertOklch(match, content);
              });
            });

            const elementsWithInlineStyle = clonedDoc.querySelectorAll('[style]');
            elementsWithInlineStyle.forEach(el => {
              const inlineStyle = el.getAttribute('style');
              if (inlineStyle && inlineStyle.toLowerCase().includes('oklch')) {
                el.setAttribute('style', inlineStyle.replace(/oklch\(([^)]+)\)/gi, (match, content) => {
                  return parseAndConvertOklch(match, content);
                }));
              }
            });
          }
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        
        if (idx > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }
      
      pdf.save(fileName);
    } catch (error) {
      console.error('Failed to generate high-fidelity PDF download:', error);
      // Fallback to standard print
      handlePrint();
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-center items-start overflow-y-auto p-4 sm:p-6 select-none md:select-text modal-backdrop">
      
      {/* Dynamic CSS Stylesheet for printing directly injected */}
      <style>{`
        @media print {
          /* Setup perfect A4 scale print rules */
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          
          /* Hide normal screen elements completely */
          body * {
            visibility: hidden !important;
          }
          
          /* Enforce absolute printable section display */
          .print-section, .print-section * {
            visibility: visible !important;
          }
          
          .print-section {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          
          [data-pdf-page] {
            width: 210mm !important;
            height: 297mm !important;
            page-break-after: always !important;
            break-after: always !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 15mm !important;
            box-sizing: border-box !important;
          }
          
          /* Typography print refinements */
          .print-title {
            font-size: 20pt !important;
            color: #0f172a !important;
          }
          .print-text-slate-500 {
            color: #64748b !important;
          }
          .print-border {
            border: 1px solid #cbd5e1 !important;
          }
          .print-bg-slate-50 {
            background-color: #f8fafc !important;
          }
          .print-shadow-none {
            box-shadow: none !important;
          }
          
          /* Table formatting for print */
          th, td {
            padding: 4px 6px !important;
            font-size: 7.5pt !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col my-4 border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Modal Configuration Header */}
        <div className="bg-white border-b border-slate-200 p-5 rounded-t-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-2xl text-white shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Generator Laporan PDF</h2>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Ekspor ringkasan eksekutif, analisis perbandingan, &amp; data harian</p>
            </div>
          </div>
          
          {/* Controls: Month Select & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pilih Bulan:</span>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
              >
                {availableMonths.map(m => (
                  <option key={m.yearMonth} value={m.yearMonth}>
                    {m.label} ({formatRupiahCompact(m.totalSales)})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleDownloadPDF}
              disabled={currentMonthData.length === 0 || isExporting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold uppercase tracking-widest px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-100 disabled:opacity-45"
            >
              {isExporting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mengunduh...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Unduh PDF
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              disabled={currentMonthData.length === 0 || isExporting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold uppercase tracking-widest px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-100 disabled:opacity-45"
            >
              <Printer className="w-4 h-4" />
              Cetak via Browser
            </button>

            <button
              onClick={onClose}
              className="p-2 bg-slate-50 hover:bg-slate-200 rounded-xl border border-slate-200 text-slate-500 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Main Body (Two Columns: Setup & Live Preview) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 no-print overflow-hidden min-h-[500px]">
          
          {/* Sidebar Configurator (Left Panel) */}
          <div className="p-5 bg-white border-r border-slate-200 space-y-5 lg:col-span-1 overflow-y-auto max-h-[75vh]">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Kustomisasi Laporan</h3>
              
              {/* Title input */}
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Judul Dokumen</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={e => setReportTitle(e.target.value)}
                  placeholder="Ketik judul laporan..."
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3.5">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Petunjuk Ekspor PDF</h4>
              <ul className="text-[10.5px] text-slate-500 font-semibold space-y-2 list-disc list-inside leading-relaxed">
                <li>Klik tombol <strong className="text-emerald-600">Unduh PDF</strong> untuk mengunduh berkas PDF secara instan ke perangkat Anda dengan nama file otomatis yang rapi.</li>
                <li>Jika Anda ingin mencetak langsung menggunakan printer fisik, klik <strong className="text-indigo-600">Cetak via Browser</strong>.</li>
                <li>Pada opsi pencetakan sistem, pilih setelan kertas <strong className="text-slate-800">A4</strong>, orientasi <strong className="text-slate-800">Portrait</strong>, dan aktifkan <strong className="text-slate-800">"Background Graphics"</strong>.</li>
              </ul>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className={`border rounded-xl p-3 space-y-1.5 transition-all duration-300 ${
                isInIframe 
                  ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-sm' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <span className="text-[10px] font-black uppercase tracking-wider block">
                  {isInIframe ? '⚠️ Buka di Tab Baru Untuk Mencetak' : '✅ Mode Cetak Aktif'}
                </span>
                {isInIframe ? (
                  <>
                    <p className="text-[10px] leading-relaxed font-semibold text-amber-900">
                      Sistem keamanan preview (iframe) AI Studio memblokir tombol cetak bawaan browser.
                    </p>
                    <p className="text-[10px] leading-relaxed font-bold text-indigo-900">
                      Silakan klik tombol <strong className="text-indigo-600">Buka di Tab Baru ↗️</strong> (ikon panah keluar di pojok kanan atas preview), lalu coba kembali. Fitur Cetak akan langsung berfungsi 100% lancar!
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] leading-relaxed font-semibold text-emerald-800">
                    Aplikasi berjalan mandiri di tab baru. Tombol <strong>Cetak / Simpan PDF</strong> di atas dapat digunakan dengan lancar!
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Live Preview Area (Right Panel, 3/4) */}
          <div className="lg:col-span-3 p-6 overflow-y-auto max-h-[75vh] flex justify-center bg-white shadow-inner border-l border-slate-100">
            <div ref={reportRef} className="flex flex-col gap-8 w-full max-w-[210mm] origin-top scale-[0.85] sm:scale-100 select-text">
              
              {/* Actual Document to Print */}
              <div className="print-section text-slate-900 font-sans text-xs w-full flex flex-col gap-8">
                
                {/* PAGE 1: HEADER & EXECUTIVE SUMMARY */}
                <div data-pdf-page="1" className="bg-white w-[210mm] h-[297mm] p-10 shadow-2xl border border-slate-300 rounded-lg flex flex-col justify-between relative box-border overflow-hidden">
                  <div className="space-y-5">
                  
                  {/* Corporate Header Section */}
                  <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-end">
                    <div className="space-y-1">
                      <h2 className="text-xl font-black text-slate-800 tracking-tight mt-1 print-title">{reportTitle}</h2>
                      <p className="text-xs text-slate-500 font-semibold">Periode Laporan: <strong className="text-slate-900 font-bold">{formatMonthLabel(selectedMonth)}</strong></p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 font-bold font-mono">Dibuat: {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date())}</p>
                    </div>
                  </div>

                  {/* Section 1: Ringkasan Eksekutif (Executive Summary) */}
                  <div className="space-y-3.5">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-1.5 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-600" /> I. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)
                    </h3>
                    
                    {currentMonthSummary ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-50 print-bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Omzet Penjualan Bulanan</span>
                          <p className="text-sm font-black text-slate-800 font-mono leading-none">{formatRupiah(currentMonthSummary.totalSales)}</p>
                          <span className="text-[9px] text-slate-400 block font-semibold">Total omzet kotor bulan {formatMonthLabel(selectedMonth)}</span>
                        </div>
                        
                        <div className="p-3 bg-slate-50 print-bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Volume Transaksi (Tx)</span>
                          <p className="text-sm font-black text-slate-800 font-mono leading-none">{formatNumberIndo(currentMonthSummary.totalTx)} Order</p>
                          <span className="text-[9px] text-slate-400 block font-semibold">Total transaksi dalam bulan ini</span>
                        </div>

                        <div className="p-3 bg-slate-50 print-bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Rata-rata Order (AOV)</span>
                          <p className="text-sm font-black text-slate-800 font-mono leading-none">{formatRupiah(currentMonthSummary.aov)}</p>
                          <span className="text-[9px] text-slate-400 block font-semibold">Nilai belanja rata-rata per transaksi</span>
                        </div>

                        <div className="p-3 bg-slate-50 print-bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Rata-rata Omzet / Hari</span>
                          <p className="text-sm font-black text-slate-800 font-mono leading-none">{formatRupiah(currentMonthSummary.avgDailySales)}</p>
                          <span className="text-[9px] text-slate-400 block font-semibold">Rerata dari {currentMonthSummary.activeDays} hari kerja</span>
                        </div>

                        <div className="p-3 bg-slate-50 print-bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Penjualan Harian Tertinggi</span>
                          <p className="text-xs font-black text-emerald-700 font-mono leading-none">{formatRupiah(currentMonthSummary.maxDaySales)}</p>
                          <span className="text-[9px] text-slate-400 block font-semibold">Tercapai pada tgl {currentMonthSummary.maxDayDate}</span>
                        </div>

                        <div className="p-3 bg-slate-50 print-bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Target Pencapaian Terakhir</span>
                          <p className="text-xs font-black text-indigo-700 leading-none">
                            {currentMonthSummary.totalSales >= 800000000 ? '🥇 Gold Achieved' :
                             currentMonthSummary.totalSales >= 700000000 ? '🥈 Silver Achieved' :
                             currentMonthSummary.totalSales >= 600000000 ? '🥉 Bronze Achieved' : '❌ Target Lvl 1 Belum Tercapai'}
                          </p>
                          <span className="text-[9px] text-slate-400 block font-semibold">
                            Target level bulanan berjenjang
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">Memproses data ringkasan bulanan...</p>
                    )}
                  </div>

                  {/* Section 2: Prior 2 Months Comparison */}
                  <div className="space-y-3.5">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-1.5 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-600" /> II. PERBANDINGAN TREN OMZET (2 BULAN SEBELUMNYA)
                    </h3>
                    
                    {priorComparison ? (
                      <div className="space-y-3">
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-100 text-[10px] font-black text-slate-600 border-b border-slate-200 uppercase">
                                <th className="p-2 pl-3">Periode Bulan</th>
                                <th className="p-2 text-right">Total Omzet Penjualan</th>
                                <th className="p-2 text-right">Total Transaksi</th>
                                <th className="p-2 text-right">Rata-rata / Hari</th>
                                <th className="p-2 text-right">Nilai AOV</th>
                                <th className="p-2 text-center">Hari Kerja</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[10px] font-semibold text-slate-700">
                              
                              {/* 2 Months ago */}
                              {priorComparison.prior2.hasData ? (
                                <tr className="hover:bg-slate-50/50">
                                  <td className="p-2 pl-3 text-slate-500">{priorComparison.prior2.label}</td>
                                  <td className="p-2 text-right font-mono font-bold">{formatRupiah(priorComparison.prior2.totalSales)}</td>
                                  <td className="p-2 text-right font-mono">{formatNumberIndo(priorComparison.prior2.totalTx)}</td>
                                  <td className="p-2 text-right font-mono text-slate-500">{formatRupiah(priorComparison.prior2.avgDailySales)}</td>
                                  <td className="p-2 text-right font-mono text-slate-500">{formatRupiah(priorComparison.prior2.aov)}</td>
                                  <td className="p-2 text-center text-slate-500">{priorComparison.prior2.activeDays} Hari</td>
                                </tr>
                              ) : (
                                <tr>
                                  <td colSpan={6} className="p-2 text-center text-slate-400 italic">Riwayat data 2 bulan sebelumnya tidak ditemukan</td>
                                </tr>
                              )}

                              {/* 1 Month ago */}
                              {priorComparison.prior1.hasData ? (
                                <tr className="hover:bg-slate-50/50">
                                  <td className="p-2 pl-3 text-slate-500">{priorComparison.prior1.label}</td>
                                  <td className="p-2 text-right font-mono font-bold">{formatRupiah(priorComparison.prior1.totalSales)}</td>
                                  <td className="p-2 text-right font-mono">{formatNumberIndo(priorComparison.prior1.totalTx)}</td>
                                  <td className="p-2 text-right font-mono text-slate-500">{formatRupiah(priorComparison.prior1.avgDailySales)}</td>
                                  <td className="p-2 text-right font-mono text-slate-500">{formatRupiah(priorComparison.prior1.aov)}</td>
                                  <td className="p-2 text-center text-slate-500">{priorComparison.prior1.activeDays} Hari</td>
                                </tr>
                              ) : (
                                <tr>
                                  <td colSpan={6} className="p-2 text-center text-slate-400 italic">Riwayat data bulan sebelumnya tidak ditemukan</td>
                                </tr>
                              )}

                              {/* Current Month */}
                              <tr className="bg-slate-50/75 print-bg-slate-50 font-bold">
                                <td className="p-2 pl-3 text-indigo-600">{priorComparison.current.label} (Fokus)</td>
                                <td className="p-2 text-right font-mono text-indigo-600 font-extrabold">{formatRupiah(priorComparison.current.totalSales)}</td>
                                <td className="p-2 text-right font-mono">{formatNumberIndo(priorComparison.current.totalTx)}</td>
                                <td className="p-2 text-right font-mono">{formatRupiah(priorComparison.current.avgDailySales)}</td>
                                <td className="p-2 text-right font-mono">{formatRupiah(priorComparison.current.aov)}</td>
                                <td className="p-2 text-center">{priorComparison.current.activeDays} Hari</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Growth Highlights */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {priorComparison.growthVsPrior1 !== null && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 print-bg-slate-50 border border-slate-200 rounded-xl">
                              <div className={`p-2 rounded-lg shrink-0 ${priorComparison.growthVsPrior1 >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {priorComparison.growthVsPrior1 >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                              </div>
                              <p className="text-[11px] font-semibold text-slate-600 leading-tight">
                                Pertumbuhan dibanding bulan sebelumnya (<strong className="text-slate-800">{priorComparison.prior1.label}</strong>):{' '}
                                <span className={`font-black font-mono ${priorComparison.growthVsPrior1 >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {priorComparison.growthVsPrior1 >= 0 ? '+' : ''}{priorComparison.growthVsPrior1.toFixed(1)}%
                                </span>
                              </p>
                            </div>
                          )}

                          {priorComparison.growthVsPrior2 !== null && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 print-bg-slate-50 border border-slate-200 rounded-xl">
                              <div className={`p-2 rounded-lg shrink-0 ${priorComparison.growthVsPrior2 >= 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800'}`}>
                                {priorComparison.growthVsPrior2 >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                              </div>
                              <p className="text-[11px] font-semibold text-slate-600 leading-tight">
                                Pertumbuhan dibanding 2 bulan lalu (<strong className="text-slate-800">{priorComparison.prior2.label}</strong>):{' '}
                                <span className={`font-black font-mono ${priorComparison.growthVsPrior2 >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                  {priorComparison.growthVsPrior2 >= 0 ? '+' : ''}{priorComparison.growthVsPrior2.toFixed(1)}%
                                </span>
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">Menganalisis perbandingan data historis...</p>
                    )}
                  </div>

                  {/* Section 3: Target Bulanan Berjenjang */}
                  <div className="space-y-3.5 print-page-break-inside-avoid">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-1.5 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-indigo-600" /> III. EVALUASI TARGET BERJENJANG BULANAN
                    </h3>

                    {targetAchievementsList.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {targetAchievementsList.map((lvl) => (
                          <div 
                            key={lvl.key} 
                            className={`p-3 border rounded-xl flex items-center justify-between ${
                              lvl.achieved 
                                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950' 
                                : 'bg-slate-50 border-slate-200 text-slate-500'
                            }`}
                          >
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold uppercase text-slate-400 block leading-none">Pencapaian Target</span>
                              <h5 className="text-[11px] font-black">{lvl.label}</h5>
                              <p className="text-[10px] font-mono leading-none">Target: Rp {formatNumberIndo(lvl.target)}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                lvl.achieved ? 'bg-emerald-200/60 text-emerald-800' : 'bg-slate-200 text-slate-500'
                              }`}>
                                {lvl.achieved ? 'Achieved' : 'Locked'}
                              </span>
                              <p className="text-[10px] font-mono font-bold mt-1">{lvl.pct.toFixed(1)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div> {/* Closes space-y-5 */}
                
                {/* Page 1 Footer */}
                <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-[8.5px] font-mono text-slate-400 mt-auto">
                  <span>{reportTitle} - Periode {formatMonthLabel(selectedMonth)}</span>
                  <span>Halaman 1 dari 3</span>
                </div>
              </div> {/* Closes data-pdf-page="1" */}

              {/* PAGE 2: WEEKLY BREAKDOWN & CHANNELS */}
                <div data-pdf-page="2" className="bg-white w-[210mm] h-[297mm] p-10 shadow-2xl border border-slate-300 rounded-lg flex flex-col justify-between relative box-border overflow-hidden">
                  <div className="space-y-5">
                    {/* Running Page Header */}
                    <div className="border-b border-slate-200 pb-2 flex justify-between items-center text-[8.5px] font-mono text-slate-400">
                      <span className="font-bold">{reportTitle}</span>
                      <span>Periode: {formatMonthLabel(selectedMonth)}</span>
                    </div>
                    
                    {/* Section 4: Analisis Penjualan Mingguan (Weekly Breakdown) */}
                    <div className="space-y-3.5">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-1.5 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600" /> IV. ANALISIS KINERJA MINGGUAN (WEEKLY PERFORMANCE)
                    </h3>
                    
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-[10px] font-black text-slate-600 border-b border-slate-200 uppercase">
                            <th className="p-2 pl-3">Minggu Ke-</th>
                            <th className="p-2 text-right">Total Omzet</th>
                            <th className="p-2 text-right">Total Transaksi (Tx)</th>
                            <th className="p-2 text-right">Rerata Omzet Harian</th>
                            <th className="p-2 text-center">Hari Operasional</th>
                            <th className="p-2 text-right">Estimasi Kontribusi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[10px] font-semibold text-slate-700">
                          {weeklyAnalysis.map(week => {
                            const totalMonthSales = currentMonthSummary?.totalSales || 1;
                            const contributionPct = (week.totalSales / totalMonthSales) * 100;

                            return (
                              <tr key={week.id} className="hover:bg-slate-50/50">
                                <td className="p-2 pl-3 text-slate-800 font-bold">{week.label}</td>
                                <td className="p-2 text-right font-mono font-bold">{formatRupiah(week.totalSales)}</td>
                                <td className="p-2 text-right font-mono">{formatNumberIndo(week.totalTx)} Tx</td>
                                <td className="p-2 text-right font-mono text-slate-500">{formatRupiah(week.avgSales)}</td>
                                <td className="p-2 text-center text-slate-500">{week.activeDays} Hari</td>
                                <td className="p-2 text-right font-mono text-indigo-600 font-bold">{contributionPct.toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 5: Distribusi Saluran Penjualan (Sales Channel Split) */}
                  <div className="space-y-3.5 print-page-break-inside-avoid">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-1.5 flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-600" /> V. DISTRIBUSI SALURAN PENJUALAN (SALES CHANNEL SPLIT)
                    </h3>

                    {currentMonthSummary && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-1">
                          <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">Instan (Kurir Instan)</span>
                          <p className="text-sm font-black text-emerald-950 font-mono mt-2">{formatRupiah(currentMonthSummary.channelSplit.instan.sales)}</p>
                          <div className="flex justify-between text-[9px] text-emerald-800 font-bold mt-1 pt-1 border-t border-emerald-100">
                            <span>{currentMonthSummary.channelSplit.instan.tx} Transaksi</span>
                            <span>{currentMonthSummary.channelSplit.instan.pct.toFixed(1)}%</span>
                          </div>
                        </div>

                        <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-1">
                          <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md">Reguler (Ekspedisi)</span>
                          <p className="text-sm font-black text-indigo-950 font-mono mt-2">{formatRupiah(currentMonthSummary.channelSplit.reguler.sales)}</p>
                          <div className="flex justify-between text-[9px] text-indigo-800 font-bold mt-1 pt-1 border-t border-indigo-100">
                            <span>{currentMonthSummary.channelSplit.reguler.tx} Transaksi</span>
                            <span>{currentMonthSummary.channelSplit.reguler.pct.toFixed(1)}%</span>
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50/40 border border-amber-100 rounded-xl space-y-1">
                          <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md">Manual (Offline/Custom)</span>
                          <p className="text-sm font-black text-amber-950 font-mono mt-2">{formatRupiah(currentMonthSummary.channelSplit.manual.sales)}</p>
                          <div className="flex justify-between text-[9px] text-amber-800 font-bold mt-1 pt-1 border-t border-amber-100">
                            <span>{currentMonthSummary.channelSplit.manual.tx} Transaksi</span>
                            <span>{currentMonthSummary.channelSplit.manual.pct.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* VII. ANALISIS & REKOMENDASI STRATEGIS (Catatan Analis) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 print-bg-slate-50">
                    <h4 className="text-[9px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      💡 VII. ANALISIS &amp; REKOMENDASI STRATEGIS
                    </h4>
                    <p className="text-[9px] leading-relaxed text-slate-600 font-medium">
                      1. Kinerja omzet bulan ini didorong secara signifikan oleh penjualan melalui saluran <strong className="text-slate-800">
                        {currentMonthSummary && currentMonthSummary.channelSplit.instan.pct > 40 ? 'Instan' : 'Reguler'}
                      </strong>. Disarankan untuk terus memberikan promo voucher khusus untuk meningkatkan volume transaksi.
                      <br />
                      2. Rekomendasi operasional: Alokasikan sumber daya logistik ekstra pada hari-hari sibuk (terutama hari kerja aktif) untuk meminimalkan waktu pemrosesan dan menjaga loyalitas pelanggan setia.
                    </p>
                  </div>
                  
                </div> {/* Closes space-y-5 */}
                
                {/* Page 2 Footer */}
                <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-[8.5px] font-mono text-slate-400 mt-auto">
                  <span>{reportTitle} - Periode {formatMonthLabel(selectedMonth)}</span>
                  <span>Halaman 2 dari 3</span>
                </div>
              </div> {/* Closes data-pdf-page="2" */}

              {/* PAGE 3: DAILY DETAILED TRANSACTIONS LIST */}
                <div data-pdf-page="3" className="bg-white w-[210mm] h-[297mm] p-10 shadow-2xl border border-slate-300 rounded-lg flex flex-col justify-between relative box-border overflow-hidden">
                  <div className="space-y-4">
                    {/* Running Page Header */}
                    <div className="border-b border-slate-200 pb-2 flex justify-between items-center text-[8.5px] font-mono text-slate-400">
                      <span className="font-bold">{reportTitle}</span>
                      <span>Periode: {formatMonthLabel(selectedMonth)}</span>
                    </div>
                    
                    {/* Section 6: Rincian Transaksi Harian (Daily Transactions Detail) */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-end border-b border-slate-200 pb-2">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-4.5 h-4.5 text-indigo-600" /> VI. DAFTAR RINCIAN PENJUALAN HARIAN
                      </h3>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Laporan Transaksi Valid</span>
                    </div>
                    
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[9.5px] font-bold uppercase tracking-wider border-b border-slate-900">
                            <th className="p-3 pl-4">Tanggal</th>
                            <th className="p-3">Hari</th>
                            <th className="p-3 text-right">Omzet Instan</th>
                            <th className="p-3 text-right">Omzet Reguler</th>
                            <th className="p-3 text-right">Omzet Manual</th>
                            <th className="p-3 text-right">Omzet Total</th>
                            <th className="p-3 text-right">Tx Total</th>
                            <th className="p-3 pl-4">Kegiatan Kampanye / Event</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[10px] font-semibold text-slate-700">
                          {currentMonthData.map(day => {
                            // Find matching events
                            const dayEvents = events.filter(e => e.date === day.date);
                            const isWeekend = day.dayOfWeek === 'Sabtu' || day.dayOfWeek === 'Minggu' || day.dayOfWeek === 'Saturday' || day.dayOfWeek === 'Sunday';

                            return (
                              <tr 
                                key={day.date} 
                                className={`transition-colors hover:bg-slate-50/80 ${
                                  isWeekend ? 'bg-amber-50/30' : 'even:bg-slate-50/30'
                                }`}
                              >
                                <td className="p-2.5 pl-4 font-mono font-bold text-slate-800 whitespace-nowrap">{day.date}</td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    isWeekend 
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200/55' 
                                      : 'bg-slate-100 text-slate-600 border border-slate-200/30'
                                  }`}>
                                    {day.dayOfWeek}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-mono text-slate-500 whitespace-nowrap">{formatRupiah(day.totalInstan)}</td>
                                <td className="p-2.5 text-right font-mono text-slate-500 whitespace-nowrap">{formatRupiah(day.totalReguler)}</td>
                                <td className="p-2.5 text-right font-mono text-slate-500 whitespace-nowrap">{formatRupiah(day.totalManual)}</td>
                                <td className="p-2.5 text-right font-mono font-black text-slate-900 bg-indigo-50/10 whitespace-nowrap">
                                  {formatRupiah(day.totalAll)}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-indigo-700 whitespace-nowrap">
                                  {day.txAll} Tx
                                </td>
                                <td className="p-2.5 pl-4">
                                  {dayEvents.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                      {dayEvents.map(e => (
                                        <span 
                                          key={e.id} 
                                          className="bg-indigo-100/80 border border-indigo-200 text-[8px] px-1.5 py-0.5 rounded-md font-bold text-indigo-800 flex items-center gap-0.5 shadow-sm"
                                        >
                                          <span className="animate-pulse">📢</span> {e.title}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 font-normal italic">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div> {/* Closes space-y-4 */}
                
                {/* Page 3 Footer */}
                <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-[8.5px] font-mono text-slate-400 mt-auto">
                  <span>{reportTitle} - Periode {formatMonthLabel(selectedMonth)}</span>
                  <span>Halaman 3 dari 3</span>
                </div>
              </div> {/* Closes data-pdf-page="3" */}

            </div> {/* Closes print-section */}
            
          </div> {/* Closes reportRef */}
        </div> {/* Closes lg:col-span-3 */}

        </div>

      </div>
    </div>
  );
}
