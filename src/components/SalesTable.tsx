import React, { useState, useMemo } from 'react';
import { DailySales } from '../types';
import { formatRupiah, formatNumberIndo, formatDateIndo } from '../utils';
import { 
  Search, ArrowUpDown, ChevronDown, Download, Filter, 
  Calendar, RotateCcw, AlertCircle, FileDown
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SalesTableProps {
  salesData: DailySales[];
  globalStartDate?: string;
  globalEndDate?: string;
  onStartDateChange?: (val: string) => void;
  onEndDateChange?: (val: string) => void;
}

type SortField = 'date' | 'totalAll' | 'txAll' | 'totalInstan' | 'totalReguler' | 'totalManual';
type SortOrder = 'asc' | 'desc';

export default function SalesTable({ 
  salesData,
  globalStartDate = '',
  globalEndDate = '',
  onStartDateChange,
  onEndDateChange
}: SalesTableProps) {
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

    // Save as PDF
    doc.save(`Laporan_Penjualan_${new Date().toISOString().substring(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      
      {/* Search and Filters Drawer */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4.5 h-4.5 text-indigo-500" />
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Pencarian & Filter Parameter</h4>
          </div>

          <button 
            onClick={resetFilters}
            className="text-[10px] text-slate-400 hover:text-indigo-600 font-extrabold flex items-center gap-1.5 uppercase tracking-wider bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all"
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
              className="text-xs font-black uppercase tracking-wider text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-55 disabled:pointer-events-none"
            >
              <Download className="w-4 h-4" />
              Ekspor CSV
            </button>

            <button
              onClick={handleExportPDF}
              disabled={filteredSortedData.length === 0}
              className="text-xs font-black uppercase tracking-wider text-rose-600 border border-rose-200 hover:bg-rose-50 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-55 disabled:pointer-events-none"
            >
              <FileDown className="w-4 h-4" />
              Ekspor PDF
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
                {paginatedData.map((row) => (
                  <tr key={row.date} className="hover:bg-slate-50/50 transition-colors">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <AlertCircle className="w-8 h-8 text-slate-300" />
            <p className="font-bold">Tidak ada data penjualan yang cocok dengan filter aktif.</p>
            <button 
              onClick={resetFilters}
              className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg mt-2 hover:bg-indigo-50 transition-all"
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
                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all"
              >
                Kembali
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all"
              >
                Lanjut
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
