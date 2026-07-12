import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { DailySales, MarketingEvent, ViewTab } from './types';
import { parseDailySalesCSV, generateSampleMarketingEvents, formatDateIndo, formatRupiah, formatNumberIndo } from './utils';
import SalesSummary from './components/SalesSummary';
import SalesMoM from './components/SalesMoM';
import SalesCharts from './components/SalesCharts';
import SalesComparison from './components/SalesComparison';
import SalesCalendar from './components/SalesCalendar';
import SalesDayOfWeek from './components/SalesDayOfWeek';
import SalesTable from './components/SalesTable';
import SalesPredictions from './components/SalesPredictions';
import EventModal from './components/EventModal';
import SalesReportModal from './components/SalesReportModal';
import SalesProducts from './components/SalesProducts';
import SalesHeatmap from './components/SalesHeatmap';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  TrendingUp, Calendar, Table, Target, BarChart2, 
  RefreshCw, Link as LinkIcon, HelpCircle, CheckCircle2, 
  Sparkles, FileSpreadsheet, PlusCircle, AlertCircle, FileText,
  Package, Download
} from 'lucide-react';

const DEFAULT_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8ACyi03DJ77mANO19x_hJV82Xs8rNBBLyT9IIGc1tgYGNrv9WMufjm940iEPx4QU6Eta6T8Ekv2-X/pub?gid=21254849&single=true&output=csv';

export default function App() {
  const [csvUrl, setCsvUrl] = useState<string>(() => {
    return localStorage.getItem('sales_csv_url') || DEFAULT_CSV_URL;
  });
  
  const [salesData, setSalesData] = useState<DailySales[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  
  // Marketing campaign logs persistent states
  const [events, setEvents] = useState<MarketingEvent[]>(() => {
    try {
      const saved = localStorage.getItem('sales_marketing_events');
      return saved ? JSON.parse(saved) : generateSampleMarketingEvents();
    } catch {
      return generateSampleMarketingEvents();
    }
  });

  // Modal selector date details
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  // Global date range filters
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Sync state changes with localStorage
  useEffect(() => {
    localStorage.setItem('sales_marketing_events', JSON.stringify(events));
  }, [events]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  // Fetch data from CSV Google Sheet
  const fetchData = async (urlToFetch: string) => {
    setIsLoading(true);
    setIsError(null);
    try {
      const response = await fetch(urlToFetch);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const text = await response.text();
      const parsed = parseDailySalesCSV(text);
      
      if (parsed.length === 0) {
        throw new Error('Gagal memproses data atau format baris tidak dikenali. Pastikan kolom sesuai.');
      }
      
      setSalesData(parsed);
      localStorage.setItem('sales_csv_url', urlToFetch);
      showToast("Data penjualan berhasil disinkronkan!", "success");
    } catch (err: any) {
      console.error(err);
      setIsError(err.message || 'Gagal memuat data penjualan Google Sheet. Periksa koneksi internet Anda.');
      showToast("Gagal menyinkronkan data Google Sheet", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial Fetch on load
  useEffect(() => {
    fetchData(csvUrl);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    await fetchData(csvUrl);
    setIsSyncing(false);
  };

  const handleResetDefaultUrl = () => {
    setCsvUrl(DEFAULT_CSV_URL);
    fetchData(DEFAULT_CSV_URL);
  };

  // Manage events operations
  const handleAddEvent = (newEventData: Omit<MarketingEvent, 'id'>) => {
    const newEvent: MarketingEvent = {
      ...newEventData,
      id: 'ev_' + Date.now()
    };
    setEvents(prev => [...prev, newEvent]);
    showToast("Event kegiatan berhasil ditambahkan!", "success");
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    showToast("Event kegiatan berhasil dihapus", "success");
  };

  const filteredSalesData = useMemo(() => {
    let result = salesData;
    if (filterStartDate) {
      result = result.filter(day => day.date >= filterStartDate);
    }
    if (filterEndDate) {
      result = result.filter(day => day.date <= filterEndDate);
    }
    return result;
  }, [salesData, filterStartDate, filterEndDate]);

  const dateRangeBounds = useMemo(() => {
    if (salesData.length === 0) return { min: '', max: '' };
    return {
      min: salesData[0].date,
      max: salesData[salesData.length - 1].date
    };
  }, [salesData]);

  const handlePreset = (preset: 'all' | '7days' | '30days' | 'q1' | 'q2' | 'thisMonth') => {
    if (salesData.length === 0) return;
    
    const minDateStr = salesData[0].date;
    const maxDateStr = salesData[salesData.length - 1].date;
    
    if (preset === 'all') {
      setFilterStartDate('');
      setFilterEndDate('');
    } else if (preset === 'q1') {
      const year = maxDateStr.substring(0, 4);
      setFilterStartDate(`${year}-01-01`);
      setFilterEndDate(`${year}-03-31`);
    } else if (preset === 'q2') {
      const year = maxDateStr.substring(0, 4);
      setFilterStartDate(`${year}-04-01`);
      setFilterEndDate(`${year}-06-30`);
    } else if (preset === '30days') {
      const maxDate = new Date(maxDateStr);
      const startDateObj = new Date(maxDate);
      startDateObj.setDate(startDateObj.getDate() - 29);
      
      const startStr = startDateObj.toISOString().substring(0, 10);
      setFilterStartDate(startStr);
      setFilterEndDate(maxDateStr);
    } else if (preset === '7days') {
      const maxDate = new Date(maxDateStr);
      const startDateObj = new Date(maxDate);
      startDateObj.setDate(startDateObj.getDate() - 6);
      
      const startStr = startDateObj.toISOString().substring(0, 10);
      setFilterStartDate(startStr);
      setFilterEndDate(maxDateStr);
    } else if (preset === 'thisMonth') {
      const maxDateParts = maxDateStr.split('-');
      const year = maxDateParts[0];
      const month = maxDateParts[1];
      setFilterStartDate(`${year}-${month}-01`);
      setFilterEndDate(maxDateStr);
    }
  };

  const [isDownloadingDashboard, setIsDownloadingDashboard] = useState<boolean>(false);
  const [downloadStep, setDownloadStep] = useState<string>('');

  const handleDownloadDashboardSummary = async () => {
    setIsDownloadingDashboard(true);
    setDownloadStep('Mempersiapkan visualisasi...');
    try {
      const chartsElement = document.getElementById('sales-charts-section');
      const heatmapElement = document.getElementById('sales-heatmap-section');

      if (!chartsElement || !heatmapElement) {
        throw new Error('Elemen grafik atau heatmap tidak ditemukan di halaman ini.');
      }

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pdfWidth - (margin * 2);

      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, pdfWidth, 40, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.text('RINGKASAN EKSEKUTIF DASHBOARD', margin, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(224, 231, 255);
      const rangeText = filterStartDate && filterEndDate 
        ? `Periode: ${formatDateIndo(filterStartDate)} s/d ${formatDateIndo(filterEndDate)}`
        : 'Periode: Semua Data Historis';
      doc.text(`${rangeText}  |  Dibuat pada: ${formatDateIndo(new Date().toISOString().substring(0, 10))}`, margin, 26);

      doc.setFillColor(245, 158, 11);
      doc.rect(0, 40, pdfWidth, 3, 'F');

      let currentY = 52;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('I. RINGKASAN DATA PENJUALAN', margin, currentY);
      currentY += 6;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL OMZET', margin + 6, currentY + 6);
      doc.text('TOTAL TRANSAKSI', margin + 68, currentY + 6);
      doc.text('NILAI BELANJA (AOV)', margin + 128, currentY + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      const totalOmzetVal = filterSummary ? filterSummary.totalOmzet : 0;
      const totalTxVal = filterSummary ? filterSummary.totalTx : 0;
      const dayCountVal = filterSummary ? filterSummary.dayCount : 0;
      
      doc.text(formatRupiah(totalOmzetVal), margin + 6, currentY + 13);
      
      doc.setTextColor(15, 23, 42);
      doc.text(`${formatNumberIndo(totalTxVal)} Order (Tx)`, margin + 68, currentY + 13);
      doc.text(formatRupiah(totalTxVal > 0 ? totalOmzetVal / totalTxVal : 0), margin + 128, currentY + 13);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Jumlah hari aktif kerja: ${dayCountVal} Hari`, margin + 6, currentY + 19);
      doc.text(`Rerata order per hari: ${dayCountVal > 0 ? (totalTxVal / dayCountVal).toFixed(1) : 0} Tx`, margin + 68, currentY + 19);
      doc.text('Rerata nilai belanja per transaksi', margin + 128, currentY + 19);

      currentY += 34;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('II. GRAFIK TREN PENJUALAN AKTIF', margin, currentY);
      currentY += 6;

      setDownloadStep('Mengonversi grafik tren menjadi gambar...');
      const chartsCanvas = await html2canvas(chartsElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const chartsImgData = chartsCanvas.toDataURL('image/png');

      const chartsRatio = chartsCanvas.height / chartsCanvas.width;
      const chartsPdfHeight = contentWidth * chartsRatio;
      
      doc.addImage(chartsImgData, 'PNG', margin, currentY, contentWidth, chartsPdfHeight);
      currentY += chartsPdfHeight + 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Halaman 1 dari 2', pdfWidth / 2, pdfHeight - 10, { align: 'center' });

      doc.addPage();
      currentY = 20;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('DASHBOARD RINGKASAN (LANJUTAN)', margin, currentY);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY + 4, pdfWidth - margin, currentY + 4);
      currentY += 14;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('III. KEPADATAN PENJUALAN & POLA TRANSAKSI (HEATMAP)', margin, currentY);
      currentY += 6;

      setDownloadStep('Mengonversi heatmap menjadi gambar...');
      const heatmapCanvas = await html2canvas(heatmapElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const heatmapImgData = heatmapCanvas.toDataURL('image/png');

      const heatmapRatio = heatmapCanvas.height / heatmapCanvas.width;
      const heatmapPdfHeight = contentWidth * heatmapRatio;

      doc.addImage(heatmapImgData, 'PNG', margin, currentY, contentWidth, heatmapPdfHeight);
      currentY += heatmapPdfHeight + 12;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('Keterangan Visualisasi & Analisis:', margin + 4, currentY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('1. Grafik tren di atas menunjukkan performa pergerakan omzet harian berdasarkan filter yang Anda tetapkan.', margin + 4, currentY + 10);
      doc.text('2. Heatmap kepadatan menyajikan intensitas transaksi/omzet untuk mempermudah identifikasi hari belanja teramai.', margin + 4, currentY + 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Halaman 2 dari 2', pdfWidth / 2, pdfHeight - 10, { align: 'center' });

      const filterRangeName = filterStartDate && filterEndDate ? `_${filterStartDate}_to_${filterEndDate}` : '';
      doc.save(`Ringkasan_Dashboard${filterRangeName}.pdf`);

      showToast('Berhasil mengunduh ringkasan PDF!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal mengunduh ringkasan PDF.', 'error');
    } finally {
      setIsDownloadingDashboard(false);
      setDownloadStep('');
    }
  };

  const filterSummary = useMemo(() => {
    if (salesData.length === 0) return null;
    const activeData = filteredSalesData;
    const totalOmzet = activeData.reduce((sum, d) => sum + d.totalAll, 0);
    const totalTx = activeData.reduce((sum, d) => sum + d.txAll, 0);
    const dayCount = activeData.length;
    
    let rangeText = '';
    if (filterStartDate && filterEndDate) {
      rangeText = `${filterStartDate} s/d ${filterEndDate}`;
    } else if (filterStartDate) {
      rangeText = `Mulai ${filterStartDate}`;
    } else if (filterEndDate) {
      rangeText = `Hingga ${filterEndDate}`;
    } else {
      rangeText = 'Semua data historis';
    }
    
    return {
      dayCount,
      totalOmzet,
      totalTx,
      rangeText
    };
  }, [salesData, filteredSalesData, filterStartDate, filterEndDate]);

  const selectedDaySales = useMemo(() => {
    if (!selectedDateStr) return undefined;
    return salesData.find(d => d.date === selectedDateStr);
  }, [salesData, selectedDateStr]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDateStr) return [];
    return events.filter(e => e.date === selectedDateStr);
  }, [events, selectedDateStr]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col antialiased">
      
      {/* Toast notification wrapper */}
      {toast && (
        <div className="fixed top-6 right-6 z-[60] px-5 py-4 rounded-2xl shadow-xl border flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-300 bg-slate-900 border-slate-800 text-white text-xs font-bold">
          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${toast.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Header navigation */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-6 py-4 shadow-sm/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Logo Brand Title */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-2xl text-white shadow-md shadow-indigo-200/80">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">by-analyzer</h1>
                <span className="text-[9px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded border border-indigo-100/50 uppercase tracking-wider">v2.0</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Aplikasi Analisa &amp; Pemantau Penjualan Harian</p>
            </div>
          </div>

          {/* Quick status information and Sync controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Input Google Sheet link container */}
            <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200/50 shadow-inner max-w-sm sm:w-[320px]">
              <input
                type="text"
                value={csvUrl}
                onChange={e => setCsvUrl(e.target.value)}
                placeholder="Tautkan URL CSV Google Sheet..."
                className="bg-transparent text-[10px] font-bold text-slate-600 px-3 py-1.5 focus:outline-none w-full"
              />
              <button
                onClick={() => fetchData(csvUrl)}
                className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-sm text-slate-500 hover:text-indigo-600 transition-all hover:scale-[1.02]"
                title="Hubungkan Sheet"
              >
                <LinkIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {csvUrl !== DEFAULT_CSV_URL && (
              <button
                onClick={handleResetDefaultUrl}
                className="text-[9px] text-slate-400 hover:text-indigo-600 font-extrabold uppercase tracking-widest bg-slate-100 px-2.5 py-2.5 rounded-xl border border-slate-200/40 transition-all"
                title="Ganti ke Sheet Penjualan Bawaan"
              >
                Reset Default
              </button>
            )}

            <button
              onClick={handleSync}
              disabled={isSyncing || isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold uppercase tracking-widest px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-100 disabled:opacity-45"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Sinkronkan
            </button>
          </div>

        </div>
      </header>

      {/* Main navigation tabs */}
      <div className="bg-slate-100 border-b border-slate-200/50 sticky top-[73px] z-30 px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {(['dashboard', 'products', 'calendar', 'table', 'predictions'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  activeTab === tab
                    ? 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab === 'dashboard' && (
                  <>
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    Ringkasan Analitik
                  </>
                )}
                {tab === 'products' && (
                  <>
                    <Package className="w-4 h-4 text-indigo-500" />
                    Analisa Produk
                  </>
                )}
                {tab === 'calendar' && (
                  <>
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    Kalender Event &amp; Sales
                  </>
                )}
                {tab === 'table' && (
                  <>
                    <Table className="w-4 h-4 text-indigo-500" />
                    Data Penjualan Harian
                  </>
                )}
                {tab === 'predictions' && (
                  <>
                    <Target className="w-4 h-4 text-indigo-500" />
                    Simulasi Target (AOV/Omzet)
                  </>
                )}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            Terhubung: Google Sheets
          </div>
        </div>
      </div>

      {/* Primary Stage Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Loader Screen */}
        {isLoading && (
          <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm space-y-4 flex flex-col items-center justify-center min-h-[450px]">
            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Menghubungkan Spreadsheet...</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1">Mengambil data penjualan real-time, silakan tunggu beberapa detik.</p>
            </div>
          </div>
        )}

        {/* Error Screen */}
        {isError && !isLoading && (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-5 flex flex-col items-center justify-center min-h-[450px]">
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-full">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="max-w-md">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Gagal Menghubungkan Google Sheet</h3>
              <p className="text-xs text-rose-600/90 font-semibold mt-2 leading-relaxed bg-rose-50/50 p-4 rounded-2xl border border-rose-100">{isError}</p>
            </div>
            
            <button
              onClick={() => fetchData(DEFAULT_CSV_URL)}
              className="text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl shadow-sm transition-all"
            >
              Ganti ke Sheet Penjualan Bawaan
            </button>
          </div>
        )}

        {/* Render content panels if data exists and is not loading */}
        {!isLoading && !isError && salesData.length > 0 && (
          <div className="space-y-6">
            
            {/* Banner Motivasi / Context */}
            <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 border border-indigo-100 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm/50">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-md shadow-indigo-200">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-indigo-950 tracking-tight leading-snug">Visualisasi Penjualan Aktif Berhasil Dimuat</h3>
                  <p className="text-xs text-indigo-700/80 font-semibold mt-0.5 leading-relaxed">
                    Menganalisa total <span className="font-extrabold text-indigo-950">{salesData.length} records</span> harian dari sheet "Penjualan Harian". Klik tab untuk menavigasi ke kalender event, rincian data table, dan simulasi target.
                  </p>
                </div>
              </div>
              <div className="text-[9px] bg-white border border-indigo-100 text-slate-500 font-extrabold px-3 py-2 rounded-xl flex items-center gap-1.5 self-start sm:self-auto shadow-inner">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span>Format CSV Terdeteksi</span>
              </div>
            </div>

            {/* Date Range Filter Panel */}
            {activeTab !== 'calendar' && activeTab !== 'products' && (
              <div id="date-range-filter-container" className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Title & Custom Input Date Pickers */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                        <Calendar className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">Rentang Analisa</h4>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">Saring periode waktu</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Mulai</span>
                        <input
                          type="date"
                          value={filterStartDate}
                          min={dateRangeBounds.min}
                          max={dateRangeBounds.max}
                          onChange={e => setFilterStartDate(e.target.value)}
                          className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Selesai</span>
                        <input
                          type="date"
                          value={filterEndDate}
                          min={dateRangeBounds.min}
                          max={dateRangeBounds.max}
                          onChange={e => setFilterEndDate(e.target.value)}
                          className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                    <button
                      onClick={() => handlePreset('all')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border transition-all ${
                        !filterStartDate && !filterEndDate
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200/60 text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Semua Waktu
                    </button>
                    
                    <button
                      onClick={() => handlePreset('7days')}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border bg-slate-50 border-slate-200/60 text-slate-500 hover:text-slate-800 transition-all"
                    >
                      7 Hari
                    </button>
                    
                    <button
                      onClick={() => handlePreset('30days')}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border bg-slate-50 border-slate-200/60 text-slate-500 hover:text-slate-800 transition-all"
                    >
                      30 Hari
                    </button>
                    
                    <button
                      onClick={() => handlePreset('thisMonth')}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border bg-slate-50 border-slate-200/60 text-slate-500 hover:text-slate-800 transition-all"
                    >
                      Bulan Terakhir
                    </button>

                    <button
                      onClick={() => handlePreset('q1')}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border bg-slate-50 border-slate-200/60 text-slate-500 hover:text-slate-800 transition-all"
                    >
                      Q1 (Jan-Mar)
                    </button>

                    <button
                      onClick={() => handlePreset('q2')}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border bg-slate-50 border-slate-200/60 text-slate-500 hover:text-slate-800 transition-all"
                    >
                      Q2 (Apr-Jun)
                    </button>

                    {(filterStartDate || filterEndDate) && (
                      <button
                        onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 border border-rose-200/50 transition-all"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                </div>

                {/* Range summary status badge */}
                {filterSummary && (
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10.5px] font-semibold text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span>Rentang aktif: <strong className="text-slate-700 font-extrabold">{filterSummary.rangeText}</strong></span>
                      <span className="text-slate-300">|</span>
                      <span>Menampilkan <strong className="text-indigo-600 font-extrabold">{filterSummary.dayCount} hari</strong> data ({Math.round(filterSummary.dayCount / salesData.length * 100)}%)</span>
                    </div>
                    <div className="flex items-center gap-4 text-slate-500 sm:justify-end font-bold">
                      <span>Total Omzet: <strong className="text-indigo-600 font-black">{formatRupiah(filterSummary.totalOmzet)}</strong></span>
                      <span>Total Order: <strong className="text-slate-700 font-black">{formatNumberIndo(filterSummary.totalTx)} Tx</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Product Performance Analysis */}
            {activeTab === 'products' && (
              <motion.div
                key="products"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <SalesProducts />
              </motion.div>
            )}

            {/* TAB: Dashboard Summary */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="space-y-6"
              >
                {/* Print Report PDF CTA Bar */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 border border-indigo-100/50 text-indigo-600 rounded-2xl">
                      <FileSpreadsheet className="w-5 h-5 text-indigo-500 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Ekspor Laporan &amp; Ringkasan Dashboard</h4>
                      <p className="text-[11px] text-slate-400 font-bold mt-1">Unduh analisa kinerja penjualan bulanan, tren grafis, atau visualisasi heatmap kepadatan dalam format PDF rapi.</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      onClick={() => setIsReportModalOpen(true)}
                      disabled={isDownloadingDashboard}
                      className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-extrabold uppercase tracking-widest px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4 text-slate-500" />
                      Laporan Bulanan
                    </button>
                    
                    <button
                      onClick={handleDownloadDashboardSummary}
                      disabled={isDownloadingDashboard}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold uppercase tracking-widest px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-100 cursor-pointer disabled:bg-indigo-400 disabled:cursor-not-allowed"
                    >
                      {isDownloadingDashboard ? (
                        <>
                          <RefreshCw className="w-4 h-4 text-white animate-spin" />
                          <span>{downloadStep}</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 text-white" />
                          <span>Unduh Ringkasan PDF</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <SalesSummary salesData={filteredSalesData} />
                
                <SalesMoM salesData={salesData} />
                
                <SalesComparison salesData={salesData} />

                <div className="pt-4 border-t border-slate-200/50">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-indigo-500" />
                    Grafik Analitik &amp; Fluktuasi Omzet Penjualan
                  </h3>
                  <SalesCharts salesData={filteredSalesData} />
                </div>

                <div className="pt-4 border-t border-slate-200/50">
                  <SalesDayOfWeek salesData={filteredSalesData} />
                </div>

                <div className="pt-4 border-t border-slate-200/50">
                  <SalesHeatmap salesData={filteredSalesData} />
                </div>
              </motion.div>
            )}

            {/* TAB: Interactive Sales Calendar & Campaign planner */}
            {activeTab === 'calendar' && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="space-y-6"
              >
                <SalesCalendar 
                  salesData={salesData} 
                  events={events} 
                  onSelectDate={(dateStr) => setSelectedDateStr(dateStr)} 
                />
              </motion.div>
            )}

            {/* TAB: Editable Sales Table and advanced filtering */}
            {activeTab === 'table' && (
              <motion.div
                key="table"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="space-y-6"
              >
                <SalesTable 
                  salesData={filteredSalesData} 
                  globalStartDate={filterStartDate}
                  globalEndDate={filterEndDate}
                  onStartDateChange={setFilterStartDate}
                  onEndDateChange={setFilterEndDate}
                />
              </motion.div>
            )}

            {/* TAB: Targets and Future Run-Rate predictions */}
            {activeTab === 'predictions' && (
              <motion.div
                key="predictions"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="space-y-6"
              >
                <SalesPredictions salesData={filteredSalesData} />
              </motion.div>
            )}

          </div>
        )}

      </main>

      {/* Slideout detail sidebar modal */}
      {selectedDateStr && (
        <EventModal
          dateStr={selectedDateStr}
          daySales={selectedDaySales}
          dayEvents={selectedDayEvents}
          onClose={() => setSelectedDateStr(null)}
          onAddEvent={handleAddEvent}
          onDeleteEvent={handleDeleteEvent}
        />
      )}

      {/* Monthly Sales PDF Report Modal */}
      <SalesReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        salesData={salesData}
        events={events}
      />

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-200/80 px-6 py-6 text-center text-xs text-slate-400 font-semibold mt-auto">
        <p className="tracking-wide">by-analyzer &copy; 2026. Hak Cipta Dilindungi. Dikembangkan secara khusus untuk menganalisis data penjualan harian toko.</p>
      </footer>

    </div>
  );
}
