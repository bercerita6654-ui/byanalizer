import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DailySales, SalesOrder } from '../types';
import { formatRupiah, formatNumberIndo, formatDateIndo } from '../utils';
import { 
  Search, ArrowUpDown, ChevronDown, Download, Filter, 
  Calendar, RotateCcw, AlertCircle, FileDown, Eye, Zap, Package, ShoppingBag, FileText, CheckCircle2
} from 'lucide-react';
import { PdfPreviewModal, PdfPreviewData } from './PdfPreviewModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SalesTableProps {
  salesData: DailySales[];
  rawOrders?: SalesOrder[];
  globalStartDate?: string;
  globalEndDate?: string;
  onStartDateChange?: (val: string) => void;
  onEndDateChange?: (val: string) => void;
}

type SortField = 'date' | 'totalAll' | 'txAll' | 'totalInstan' | 'totalReguler' | 'totalManual';
type SortOrder = 'asc' | 'desc';

export default function SalesTable({ 
  salesData,
  rawOrders = [],
  globalStartDate = '',
  globalEndDate = '',
  onStartDateChange,
  onEndDateChange
}: SalesTableProps) {
  // View Mode: 'daily' (Ringkasan Harian) vs 'orders' (Rincian Transaksi Pesanan)
  const [viewMode, setViewMode] = useState<'daily' | 'orders'>('daily');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  
  const [localStartDate, setLocalStartDate] = useState('');
  const [localEndDate, setLocalEndDate] = useState('');

  const startDate = onStartDateChange ? globalStartDate : localStartDate;
  const endDate = onEndDateChange ? globalEndDate : localEndDate;

  const setStartDate = (val: string) => {
    if (onStartDateChange) {
      onStartDateChange(val);
    } else {
      setLocalStartDate(val);
    }
  };

  const setEndDate = (val: string) => {
    if (onEndDateChange) {
      onEndDateChange(val);
    } else {
      setLocalEndDate(val);
    }
  };

  const [minSales, setMinSales] = useState<number | ''>('');
  const [maxSales, setMaxSales] = useState<number | ''>('');
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // PDF Preview State
  const [pdfPreviewData, setPdfPreviewData] = useState<PdfPreviewData | null>(null);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState<boolean>(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setMinSales('');
    setMaxSales('');
    setSortField('date');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  // Filter & Sort Data
  const filteredSortedData = useMemo(() => {
    let result = [...salesData];

    // Search query (day of week name or date text)
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(day => 
        day.date.includes(query) || 
        day.dayOfWeek.toLowerCase().includes(query)
      );
    }

    // Date range filter
    if (startDate) {
      result = result.filter(day => day.date >= startDate);
    }
    if (endDate) {
      result = result.filter(day => day.date <= endDate);
    }

    // Sales Revenue filters
    if (minSales !== '') {
      result = result.filter(day => day.totalAll >= minSales);
    }
    if (maxSales !== '') {
      result = result.filter(day => day.totalAll <= maxSales);
    }

    // Apply Sorting
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortOrder === 'asc' 
          ? (valA as number) - (valB as number) 
          : (valB as number) - (valA as number);
      }
    });

    return result;
  }, [salesData, searchQuery, startDate, endDate, minSales, maxSales, sortField, sortOrder]);

  // Paginated Results
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSortedData, currentPage]);

  const totalPages = Math.ceil(filteredSortedData.length / itemsPerPage) || 1;

  // Order breakdown filters & state
  const [orderCategoryFilter, setOrderCategoryFilter] = useState<'all' | 'instan' | 'reguler' | 'manual'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderCustomerFilter, setOrderCustomerFilter] = useState<string>('all');
  const [orderAdminFilter, setOrderAdminFilter] = useState<string>('all');
  const [orderCurrentPage, setOrderCurrentPage] = useState(1);
  const ordersPerPage = 20;

  const uniqueOrderCustomers = useMemo(() => {
    const set = new Set<string>();
    rawOrders.forEach(o => { 
      const name = o.tokoOnline || o.customer;
      if (name) set.add(name); 
    });
    return Array.from(set).sort();
  }, [rawOrders]);

  const uniqueOrderStatuses = useMemo(() => {
    const set = new Set<string>();
    rawOrders.forEach(o => { if (o.status) set.add(o.status); });
    return Array.from(set).sort();
  }, [rawOrders]);

  const uniqueOrderAdmins = useMemo(() => {
    const set = new Set<string>();
    rawOrders.forEach(o => { 
      const adminName = o.admin || o.createdBy;
      if (adminName && adminName !== '-') set.add(adminName); 
    });
    return Array.from(set).sort();
  }, [rawOrders]);

  const orderStats = useMemo(() => {
    let instanCount = 0;
    let regulerCount = 0;
    let manualCount = 0;
    let instanTotal = 0;
    let regulerTotal = 0;
    let manualTotal = 0;

    rawOrders.forEach(o => {
      if (startDate && o.date < startDate) return;
      if (endDate && o.date > endDate) return;
      if (o.orderCategory === 'instan') {
        instanCount++;
        instanTotal += o.total;
      } else if (o.orderCategory === 'manual') {
        manualCount++;
        manualTotal += o.total;
      } else {
        regulerCount++;
        regulerTotal += o.total;
      }
    });

    return {
      instanCount,
      regulerCount,
      manualCount,
      instanTotal,
      regulerTotal,
      manualTotal,
      allCount: instanCount + regulerCount + manualCount,
      allTotal: instanTotal + regulerTotal + manualTotal
    };
  }, [rawOrders, startDate, endDate]);

  const filteredOrders = useMemo(() => {
    return rawOrders.filter(ord => {
      if (startDate && ord.date < startDate) return false;
      if (endDate && ord.date > endDate) return false;
      if (orderCategoryFilter !== 'all' && ord.orderCategory !== orderCategoryFilter) return false;
      if (orderStatusFilter !== 'all' && ord.status !== orderStatusFilter) return false;
      const toko = ord.tokoOnline || ord.customer;
      if (orderCustomerFilter !== 'all' && toko !== orderCustomerFilter) return false;
      const adminName = ord.admin || ord.createdBy;
      if (orderAdminFilter !== 'all' && adminName !== orderAdminFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          ord.noNota.toLowerCase().includes(q) ||
          ord.noPemesanan.toLowerCase().includes(q) ||
          ord.noSo.toLowerCase().includes(q) ||
          toko.toLowerCase().includes(q) ||
          ord.kepada.toLowerCase().includes(q) ||
          adminName.toLowerCase().includes(q) ||
          ord.status.toLowerCase().includes(q) ||
          ord.date.includes(q)
        );
      }
      return true;
    });
  }, [rawOrders, startDate, endDate, orderCategoryFilter, orderStatusFilter, orderCustomerFilter, orderAdminFilter, searchQuery]);

  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  const paginatedOrders = useMemo(() => {
    const start = (orderCurrentPage - 1) * ordersPerPage;
    return filteredOrders.slice(start, start + ordersPerPage);
  }, [filteredOrders, orderCurrentPage, ordersPerPage]);

  const handleExportOrdersCSV = () => {
    if (filteredOrders.length === 0) return;
    const headers = [
      'No. Nota (Kolom 1)',
      'Tgl Input',
      'Tanggal (Kolom 3)',
      'No. SO',
      'No. Pemesanan (Kolom 5)',
      'Nama Toko Online (Kolom 6)',
      'Kepada',
      'Total Nominal (Kolom 8)',
      'Admin Proses Nota (Kolom 10)',
      'Sales',
      'Status',
      'Klasifikasi'
    ];
    const rows = filteredOrders.map(o => [
      `"${o.noNota}"`,
      `"${o.tglInput}"`,
      `"${o.date}"`,
      `"${o.noSo}"`,
      `"${o.noPemesanan}"`,
      `"${o.tokoOnline || o.customer}"`,
      `"${o.kepada.replace(/"/g, '""')}"`,
      o.total,
      `"${o.admin || o.createdBy}"`,
      `"${o.sales}"`,
      `"${o.status}"`,
      `"${o.orderCategory.toUpperCase()}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LIST_MENU_PENJUALAN_${startDate || 'Semua'}_sd_${endDate || 'Semua'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to CSV helper
  const handleExportCSV = () => {
    if (filteredSortedData.length === 0) return;
    
    // Header
    const csvRows = [
      ['Tanggal', 'Hari', 'Tx Instan', 'Total Instan', 'Tx Reguler', 'Total Reguler', 'Tx Manual', 'Total Manual', 'Total Transaksi All', 'Total Omzet All'].join(',')
    ];

    // Rows
    filteredSortedData.forEach(row => {
      csvRows.push([
        row.date,
        row.dayOfWeek,
        row.txInstan,
        row.totalInstan,
        row.txReguler,
        row.totalReguler,
        row.txManual,
        row.totalManual,
        row.txAll,
        row.totalAll
      ].join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales_analysis_export_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export currently filtered table data as PDF
  const handleExportPDF = () => {
    if (filteredSortedData.length === 0) return;

    // Create a new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Theme branding colors (matches dashboard Indigo, Slate theme)
    const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo 600 (#4f46e5)
    const darkSlate: [number, number, number] = [15, 23, 42]; // Slate 900 (#0f172a)
    const lightSlate: [number, number, number] = [100, 116, 139]; // Slate 500 (#64748b)
    const lightBg: [number, number, number] = [248, 250, 252]; // Slate 50 (#f8fafc)

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.text('LAPORAN RINCIAN PENJUALAN HARIAN', 14, 20);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(lightSlate[0], lightSlate[1], lightSlate[2]);
    doc.text('Ekspor data penjualan harian terfilter - Semester 1 (H1) 2026', 14, 25);

    // Export metadata container block
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(14, 30, 182, 22, 2, 2, 'F');

    doc.setFontSize(8.5);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    
    // Column 1
    doc.setFont('helvetica', 'bold');
    doc.text('Rentang Filter:', 18, 36);
    doc.setFont('helvetica', 'normal');
    const displayRange = `${startDate || 'Semua'} s/d ${endDate || 'Semua'}`;
    doc.text(displayRange, 42, 36);

    doc.setFont('helvetica', 'bold');
    doc.text('Total Record:', 18, 41);
    doc.setFont('helvetica', 'normal');
    doc.text(`${filteredSortedData.length} baris data`, 42, 41);

    doc.setFont('helvetica', 'bold');
    doc.text('Tanggal Ekspor:', 18, 46);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDateIndo(new Date().toISOString().substring(0, 10)), 42, 46);

    // Column 2 - Sum details
    const totalOmzet = filteredSortedData.reduce((acc, curr) => acc + curr.totalAll, 0);
    const totalTx = filteredSortedData.reduce((acc, curr) => acc + curr.txAll, 0);

    doc.setFont('helvetica', 'bold');
    doc.text('Total Omzet Terfilter:', 110, 36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(formatRupiah(totalOmzet), 146, 36);

    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Transaksi:', 110, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(`${formatNumberIndo(totalTx)} Tx`, 146, 42);

    // Table setup using jspdf-autotable
    const headers = [['Hari & Tanggal', 'Grand Omzet (Rp)', 'Total Order', 'Instan (Rp)', 'Reguler (Rp)', 'Manual (Rp)']];
    
    const rows = filteredSortedData.map(row => [
      `${row.dayOfWeek}, ${row.date}`,
      formatRupiah(row.totalAll),
      `${formatNumberIndo(row.txAll)} Tx`,
      formatRupiah(row.totalInstan),
      formatRupiah(row.totalReguler),
      formatRupiah(row.totalManual)
    ]);

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 58,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'right'
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 }, // Date
        1: { halign: 'right', fontStyle: 'bold' }, // Grand Omzet
        2: { halign: 'right' }, // Total Tx
        3: { halign: 'right' }, // Instan
        4: { halign: 'right' }, // Reguler
        5: { halign: 'right' }  // Manual
      },
      didParseCell: (data) => {
        if (data.row.section === 'head' && data.column.index === 0) {
          data.cell.styles.halign = 'left';
        }
      },
      alternateRowStyles: {
        fillColor: [250, 251, 253]
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
        valign: 'middle'
      },
      margin: { top: 20, bottom: 20, left: 14, right: 14 },
      didDrawPage: (data) => {
        // Simple elegant footer on each page
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(lightSlate[0], lightSlate[1], lightSlate[2]);
        
        // Page number
        const pageStr = `Halaman ${data.pageNumber}`;
        doc.text(pageStr, doc.internal.pageSize.width - 14 - doc.getTextWidth(pageStr), doc.internal.pageSize.height - 10);
        
        // Brand string
        doc.text('Laporan Ekspor Penjualan H1 2026 - Analitik Dashboard', 14, doc.internal.pageSize.height - 10);
      }
    });

    // Generate Preview Blob and Open Preview Modal
    const fileName = `Laporan_Penjualan_${new Date().toISOString().substring(0, 10)}.pdf`;
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    setPdfPreviewData({
      blobUrl,
      fileName,
      title: 'Laporan Rincian Penjualan Harian',
      pageCount: doc.getNumberOfPages(),
      fileSizeBytes: blob.size,
      onDownloadConfirm: () => doc.save(fileName)
    });
    setIsPdfPreviewOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Information Banner on Google Sheet Rules */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-50 border border-amber-500/25 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 shrink-0 mt-0.5">
            <Zap className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-100/90 px-2.5 py-0.5 rounded-md border border-amber-200">
                Sheet: LIST MENU PENJUALAN
              </span>
              <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                Google Sheets Terhubung
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              Pemetaan kolom: <strong>Kolom 1</strong> (No. Nota) • <strong>Kolom 3</strong> (Tanggal) • <strong>Kolom 5</strong> (No. Pemesanan) • <strong>Kolom 6</strong> (Nama Toko Online) • <strong>Kolom 8</strong> (Total Nominal) • <strong>Kolom 10</strong> (Admin yang Proses Nota).
            </p>
            <p className="text-[11px] text-amber-900 leading-relaxed font-semibold">
              ⚡ Status <span className="font-black text-amber-950 bg-amber-200/90 px-1.5 py-0.5 rounded text-[10px]">DIAMBIL</span> otomatis menjadi <strong className="text-amber-950">Pesanan Instan</strong> khusus: ONLINE TIKTOK TOKOPEDIA BALIST, ONLINE SHOPEE, ONLINE SHOPEE GOMART, ONLINE TIKTOK TOPED GOMALL.
            </p>
          </div>
        </div>

        {rawOrders && rawOrders.length > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1.5 rounded-2xl shrink-0 self-stretch md:self-auto justify-center shadow-inner">
            <button
              onClick={() => { setViewMode('daily'); setCurrentPage(1); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                viewMode === 'daily'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Ringkasan Harian</span>
              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600 font-bold">{salesData.length}</span>
            </button>
            <button
              onClick={() => { setViewMode('orders'); setOrderCurrentPage(1); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                viewMode === 'orders'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Rincian Pesanan</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${viewMode === 'orders' ? 'bg-amber-600/70 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {rawOrders.length.toLocaleString('id-ID')}
              </span>
            </button>
          </div>
        )}
      </div>

      {viewMode === 'daily' ? (
        <>
          {/* Search and Filters Drawer for Daily Sales */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4.5 h-4.5 text-indigo-500" />
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Pencarian &amp; Filter Parameter Harian</h4>
              </div>

              <button 
                onClick={resetFilters}
                className="text-[10px] text-slate-400 hover:text-indigo-600 font-extrabold flex items-center gap-1.5 uppercase tracking-wider bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filter
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Query search */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cari Tanggal / Hari</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Contoh: 2026-01-02, Sabtu..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full text-xs font-semibold pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
                  />
                </div>
              </div>

              {/* Date range start */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tanggal Mulai</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }}
                  className="w-full text-xs font-semibold px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
                />
              </div>

              {/* Date range end */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tanggal Selesai</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }}
                  className="w-full text-xs font-semibold px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
                />
              </div>

              {/* Min Sales */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Min Omzet Harian</label>
                <input
                  type="number"
                  placeholder="Jumlah IDR"
                  value={minSales}
                  onChange={e => { setMinSales(e.target.value === '' ? '' : Number(e.target.value)); setCurrentPage(1); }}
                  className="w-full text-xs font-semibold px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Main Grid View */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 leading-none">Rincian Penjualan Harian</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Ditemukan {filteredSortedData.length} records dari total {salesData.length} baris data</p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleExportCSV}
                  disabled={filteredSortedData.length === 0}
                  className="text-xs font-black uppercase tracking-wider text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-55 disabled:pointer-events-none cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Ekspor CSV
                </button>

                <button
                  onClick={handleExportPDF}
                  disabled={filteredSortedData.length === 0}
                  className="text-xs font-black uppercase tracking-wider text-rose-600 border border-rose-200 hover:bg-rose-50 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-55 disabled:pointer-events-none cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  Pratinjau &amp; Ekspor PDF
                </button>
              </div>
            </div>

            {filteredSortedData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th onClick={() => handleSort('date')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 select-none">
                        <div className="flex items-center gap-1.5">
                          Hari &amp; Tanggal
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('totalAll')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 select-none text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          Grand Omzet
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('txAll')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 select-none text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          Grand Order
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('totalInstan')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 select-none text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          Instan (IDR)
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('totalReguler')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 select-none text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          Reguler (IDR)
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('totalManual')} className="px-6 py-4 cursor-pointer hover:bg-slate-100 select-none text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          Manual (IDR)
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    <AnimatePresence mode="popLayout">
                      {paginatedData.map((row, index) => (
                        <motion.tr 
                          key={row.date} 
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25, delay: Math.min(index * 0.015, 0.15), ease: "easeOut" }}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4.5 font-bold text-slate-800">
                            <span className="text-[10px] bg-slate-100 text-slate-500 font-extrabold px-2 py-0.5 rounded mr-2 uppercase">{row.dayOfWeek}</span>
                            {row.date}
                          </td>
                          <td className="px-6 py-4.5 text-right font-black text-indigo-600 font-mono">
                            {formatRupiah(row.totalAll)}
                          </td>
                          <td className="px-6 py-4.5 text-right font-bold text-slate-800">
                            {formatNumberIndo(row.txAll)} <span className="text-[10px] text-slate-400 font-medium">Tx</span>
                          </td>
                          <td className="px-6 py-4.5 text-right font-bold text-emerald-600 font-mono">
                            {formatRupiah(row.totalInstan)}
                          </td>
                          <td className="px-6 py-4.5 text-right font-bold text-blue-600 font-mono">
                            {formatRupiah(row.totalReguler)}
                          </td>
                          <td className="px-6 py-4.5 text-right font-bold text-amber-600 font-mono">
                            {formatRupiah(row.totalManual)}
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="w-8 h-8 text-slate-300" />
                <p className="font-bold">Tidak ada data penjualan yang cocok dengan filter aktif.</p>
                <button 
                  onClick={resetFilters}
                  className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg mt-2 hover:bg-indigo-50 transition-all cursor-pointer"
                >
                  Kosongkan Filter
                </button>
              </div>
            )}

            {/* Pagination Section */}
            {filteredSortedData.length > 0 && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                  Halaman {currentPage} dari {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    Lanjut
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Order Level Breakdown View */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <h4 className="text-sm font-black text-slate-800">Filter Rincian Pesanan</h4>
                <p className="text-[11px] text-slate-400 font-bold">Telusuri seluruh riwayat pesanan dari Google Sheets secara langsung</p>
              </div>

              <button 
                onClick={() => {
                  setSearchQuery('');
                  setOrderCategoryFilter('all');
                  setOrderStatusFilter('all');
                  setOrderCustomerFilter('all');
                  setOrderAdminFilter('all');
                  setOrderCurrentPage(1);
                }}
                className="text-[10px] text-slate-400 hover:text-amber-600 font-extrabold flex items-center gap-1.5 uppercase tracking-wider bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filter Pesanan
              </button>
            </div>

            {/* Category Quick Filter Pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setOrderCategoryFilter('all'); setOrderCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  orderCategoryFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Semua Pesanan</span>
                <span className="text-[10px] opacity-80 font-black">({orderStats.allCount.toLocaleString('id-ID')})</span>
              </button>

              <button
                onClick={() => { setOrderCategoryFilter('instan'); setOrderCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  orderCategoryFilter === 'instan'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>⚡ Instan [DIAMBIL]</span>
                <span className="text-[10px] font-black">({orderStats.instanCount.toLocaleString('id-ID')})</span>
                <span className="text-[10px] font-mono opacity-90">• {formatRupiah(orderStats.instanTotal)}</span>
              </button>

              <button
                onClick={() => { setOrderCategoryFilter('reguler'); setOrderCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  orderCategoryFilter === 'reguler'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-blue-50 text-blue-800 border border-blue-200/60 hover:bg-blue-100'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>📦 Reguler</span>
                <span className="text-[10px] font-black">({orderStats.regulerCount.toLocaleString('id-ID')})</span>
                <span className="text-[10px] font-mono opacity-90">• {formatRupiah(orderStats.regulerTotal)}</span>
              </button>

              <button
                onClick={() => { setOrderCategoryFilter('manual'); setOrderCurrentPage(1); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  orderCategoryFilter === 'manual'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60 hover:bg-emerald-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📝 Manual</span>
                <span className="text-[10px] font-black">({orderStats.manualCount.toLocaleString('id-ID')})</span>
                <span className="text-[10px] font-mono opacity-90">• {formatRupiah(orderStats.manualTotal)}</span>
              </button>
            </div>

            {/* Filter inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2">
              {/* Search text */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cari Nota / SO / Admin</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="No. Nota, SO, Admin..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setOrderCurrentPage(1); }}
                    className="w-full text-xs font-semibold pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-slate-800"
                  />
                </div>
              </div>

              {/* Customer dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Toko Online (Kolom 6)</label>
                <select
                  value={orderCustomerFilter}
                  onChange={e => { setOrderCustomerFilter(e.target.value); setOrderCurrentPage(1); }}
                  className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-slate-800 truncate"
                >
                  <option value="all">Semua Toko ({uniqueOrderCustomers.length})</option>
                  {uniqueOrderCustomers.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Admin dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Admin Proses (Kolom 10)</label>
                <select
                  value={orderAdminFilter}
                  onChange={e => { setOrderAdminFilter(e.target.value); setOrderCurrentPage(1); }}
                  className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-slate-800 truncate"
                >
                  <option value="all">Semua Admin ({uniqueOrderAdmins.length})</option>
                  {uniqueOrderAdmins.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              {/* Status dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Status Pesanan</label>
                <select
                  value={orderStatusFilter}
                  onChange={e => { setOrderStatusFilter(e.target.value); setOrderCurrentPage(1); }}
                  className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-slate-800"
                >
                  <option value="all">Semua Status ({uniqueOrderStatuses.length})</option>
                  {uniqueOrderStatuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Date range filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tanggal (Kolom 3)</label>
                <div className="flex gap-1.5">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => { setStartDate(e.target.value); setOrderCurrentPage(1); }}
                    className="w-1/2 text-[11px] font-semibold px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-slate-800"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => { setEndDate(e.target.value); setOrderCurrentPage(1); }}
                    className="w-1/2 text-[11px] font-semibold px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 leading-none">Daftar Transaksi Sheet: LIST MENU PENJUALAN</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  Menampilkan {paginatedOrders.length} dari total {filteredOrders.length.toLocaleString('id-ID')} pesanan yang terfilter
                </p>
              </div>

              <button
                onClick={handleExportOrdersCSV}
                disabled={filteredOrders.length === 0}
                className="text-xs font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-55 disabled:pointer-events-none cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Ekspor CSV ({filteredOrders.length.toLocaleString('id-ID')} Baris)
              </button>
            </div>

            {filteredOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="px-4 py-3.5 whitespace-nowrap">No. Nota (Kol 1)</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Tanggal (Kol 3)</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">No. Pemesanan (Kol 5)</th>
                      <th className="px-4 py-3.5">Nama Toko Online (Kol 6)</th>
                      <th className="px-4 py-3.5">Kepada</th>
                      <th className="px-4 py-3.5">Admin Proses (Kol 10)</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Klasifikasi</th>
                      <th className="px-4 py-3.5 text-right whitespace-nowrap">Total Nominal (Rp) (Kol 8)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {paginatedOrders.map((ord) => (
                      <tr key={ord.id + ord.noPemesanan} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-slate-800">
                          {ord.noNota || ord.id}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-800">{ord.date}</div>
                          {ord.tglInput && (
                            <div className="text-[10px] text-slate-400 font-medium">{ord.tglInput.split(' ')[1] || ord.tglInput}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono">
                          <div className="font-bold text-indigo-700">{ord.noPemesanan || '-'}</div>
                          {ord.noSo && <div className="text-[10px] text-slate-400">SO: {ord.noSo}</div>}
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-800 max-w-[190px] truncate" title={ord.tokoOnline || ord.customer}>
                          {ord.tokoOnline || ord.customer}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 max-w-[180px] truncate font-medium" title={ord.kepada}>
                          {ord.kepada || '-'}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-700 bg-slate-100/90 border border-slate-200/80 px-2 py-0.5 rounded-md text-[11px]">
                            {ord.admin || ord.createdBy || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider uppercase ${
                            ord.status === 'DIAMBIL'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : ord.status === 'SUCCESS'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {ord.status || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {ord.orderCategory === 'instan' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-500 text-white shadow-xs">
                              <Zap className="w-3 h-3" />
                              ⚡ INSTAN
                            </span>
                          ) : ord.orderCategory === 'manual' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <FileText className="w-3 h-3" />
                              📝 MANUAL
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                              <Package className="w-3 h-3" />
                              📦 REGULER
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-slate-900 font-mono whitespace-nowrap" title={formatRupiah(ord.total)}>
                          {formatNumberIndo(ord.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="w-8 h-8 text-slate-300" />
                <p className="font-bold">Tidak ada rincian pesanan yang cocok dengan kriteria filter.</p>
              </div>
            )}

            {/* Pagination for orders */}
            {filteredOrders.length > 0 && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                  Halaman {orderCurrentPage} dari {totalOrderPages} ({filteredOrders.length.toLocaleString('id-ID')} Total Pesanan)
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={orderCurrentPage === 1}
                    onClick={() => setOrderCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    disabled={orderCurrentPage === totalOrderPages}
                    onClick={() => setOrderCurrentPage(prev => Math.min(totalOrderPages, prev + 1))}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    Lanjut
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* PDF Document Preview Modal */}
      <PdfPreviewModal
        isOpen={isPdfPreviewOpen}
        data={pdfPreviewData}
        onClose={() => setIsPdfPreviewOpen(false)}
      />

    </div>
  );
}
