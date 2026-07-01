import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DailySales, MarketingEvent } from '../types';
import { formatRupiah, formatNumberIndo, formatDateIndo } from '../utils';
import { Download, CheckCircle2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export default function SalesReportModal({ isOpen, onClose, salesData, events }: SalesReportModalProps) {
  // Extract all available months from the dataset
  const availableMonths = useMemo(() => {
    const monthsMap = new Map<string, { yearMonth: string; label: string; totalSales: number }>();
    const sortedData = [...salesData].sort((a, b) => a.date.localeCompare(b.date));
    
    sortedData.forEach(day => {
      const parts = day.date.split('-');
      if (parts.length >= 2) {
        const yearMonth = `${parts[0]}-${parts[1]}`;
        
        const existing = monthsMap.get(yearMonth);
        if (existing) {
          existing.totalSales += day.totalAll;
        } else {
          monthsMap.set(yearMonth, { yearMonth, label: formatMonthLabel(yearMonth), totalSales: day.totalAll });
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

  const reportTitle = 'Laporan Evaluasi & Kinerja Penjualan Bulanan';
  const preparedBy = 'Koordinator Toko / Operasional';
  const approvedBy = 'Pemilik Toko (Owner)';

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

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportStep, setExportStep] = useState<string>('');
  const [activeExportIndex, setActiveExportIndex] = useState<number>(-1);

  // Stale closure safeguard: create a ref mirroring the latest state
  const stateRef = useRef<{
    currentMonthSummary: any;
    priorComparison: any;
    weeklyAnalysis: any[];
    currentMonthData: DailySales[];
  }>({
    currentMonthSummary: null,
    priorComparison: null,
    weeklyAnalysis: [],
    currentMonthData: [],
  });

  stateRef.current = {
    currentMonthSummary,
    priorComparison,
    weeklyAnalysis,
    currentMonthData,
  };

  const executeMonthPDFDownload = async (monthLabel: string) => {
    try {
      const fileName = `Laporan Evaluasi Penjualan Bulanan (${monthLabel}).pdf`;
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const {
        currentMonthSummary: summary,
        priorComparison: comp,
        weeklyAnalysis: weekly,
        currentMonthData: data
      } = stateRef.current;

      if (!summary || !comp) {
        console.warn('Data ringkasan tidak lengkap untuk ' + monthLabel);
        return;
      }

      setExportStep(`Menyusun ${monthLabel} - Halaman 1 (Ringkasan Eksekutif)...`);
      await new Promise(resolve => setTimeout(resolve, 50));

      // ==========================================
      // PAGE 1: HEADER & EXECUTIVE SUMMARY & TARGETS
      // ==========================================

      // 1. Corporate Header Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text(reportTitle.toUpperCase(), 14, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text('Periode Laporan:', 14, 26);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(monthLabel, 46, 26);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Tanggal Ekspor:', 120, 26);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(formatDateIndo(new Date().toISOString().substring(0, 10)), 150, 26);

      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(0.5);
      doc.line(14, 30, 196, 30);

      // Section 1: Ringkasan Eksekutif
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229); // Indigo 600
      doc.text('I. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)', 14, 37);

      // Draw 6 KPI boxes helper
      const drawKPIBox = (x: number, y: number, w: number, h: number, title: string, value: string, subtext: string, valueColor = [15, 23, 42]) => {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, w, h, 2, 2, 'FD');

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(title.toUpperCase(), x + 3, y + 5);

        // Value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
        if (value.length > 18) doc.setFontSize(8);
        doc.text(value, x + 3, y + 11);

        // Subtext
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        doc.text(subtext, x + 3, y + 17);
      };

      const kpiW = 58;
      const kpiH = 22;
      const gap = 4;

      const latestTargetStatus = 
        summary.totalSales >= 800000000 ? '🥇 Gold Achieved' :
        summary.totalSales >= 700000000 ? '🥈 Silver Achieved' :
        summary.totalSales >= 600000000 ? '🥉 Bronze Achieved' : '❌ Target Belum Tercapai';

      drawKPIBox(14, 42, kpiW, kpiH, 'Omzet Penjualan Bulanan', formatRupiah(summary.totalSales), `Total omzet kotor bulan ${monthLabel}`, [79, 70, 229]);
      drawKPIBox(14 + kpiW + gap, 42, kpiW, kpiH, 'Volume Transaksi (Tx)', `${formatNumberIndo(summary.totalTx)} Order`, 'Total transaksi dalam bulan ini');
      drawKPIBox(14 + 2 * (kpiW + gap), 42, kpiW, kpiH, 'Rata-rata Order (AOV)', formatRupiah(summary.aov), 'Nilai belanja rata-rata per order');
      
      drawKPIBox(14, 68, kpiW, kpiH, 'Rata-rata Omzet / Hari', formatRupiah(summary.avgDailySales), `Rerata dari ${summary.activeDays} hari aktif`);
      drawKPIBox(14 + kpiW + gap, 68, kpiW, kpiH, 'Penjualan Harian Tertinggi', formatRupiah(summary.maxDaySales), `Tercapai pada tgl ${summary.maxDayDate}`, [16, 185, 129]);
      drawKPIBox(14 + 2 * (kpiW + gap), 68, kpiW, kpiH, 'Target Pencapaian Terakhir', latestTargetStatus, 'Target level bulanan berjenjang', [79, 70, 229]);

      // Section 2: Comparison table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text('II. PERBANDINGAN TREN OMZET (2 BULAN SEBELUMNYA)', 14, 98);

      const priorHeaders = [['Periode Bulan', 'Total Omzet Penjualan', 'Total Transaksi', 'Rata-rata / Hari', 'Nilai AOV', 'Hari Kerja']];
      const priorRows = [];
      
      if (comp.prior2.hasData) {
        priorRows.push([
          comp.prior2.label,
          formatRupiah(comp.prior2.totalSales),
          formatNumberIndo(comp.prior2.totalTx) + ' Tx',
          formatRupiah(comp.prior2.avgDailySales),
          formatRupiah(comp.prior2.aov),
          `${comp.prior2.activeDays} Hari`
        ]);
      } else {
        priorRows.push(['Riwayat data 2 bulan sebelumnya tidak ditemukan', '-', '-', '-', '-', '-']);
      }

      if (comp.prior1.hasData) {
        priorRows.push([
          comp.prior1.label,
          formatRupiah(comp.prior1.totalSales),
          formatNumberIndo(comp.prior1.totalTx) + ' Tx',
          formatRupiah(comp.prior1.avgDailySales),
          formatRupiah(comp.prior1.aov),
          `${comp.prior1.activeDays} Hari`
        ]);
      } else {
        priorRows.push(['Riwayat data bulan sebelumnya tidak ditemukan', '-', '-', '-', '-', '-']);
      }

      priorRows.push([
        `${comp.current.label} (Fokus)`,
        formatRupiah(comp.current.totalSales),
        formatNumberIndo(comp.current.totalTx) + ' Tx',
        formatRupiah(comp.current.avgDailySales),
        formatRupiah(comp.current.aov),
        `${comp.current.activeDays} Hari`
      ]);

      autoTable(doc, {
        head: priorHeaders,
        body: priorRows,
        startY: 103,
        theme: 'striped',
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 45 },
          1: { halign: 'right', fontStyle: 'bold' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'center' }
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          valign: 'middle'
        },
        margin: { left: 14, right: 14 }
      });

      let finalY = (doc as any).lastAutoTable.finalY || 135;

      // Draw Growth Highlights
      if (comp.growthVsPrior1 !== null || comp.growthVsPrior2 !== null) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text('Sorotan Pertumbuhan (Growth Highlights):', 14, finalY + 8);

        let boxY = finalY + 11;
        let boxW = 88;
        let boxH = 15;

        if (comp.growthVsPrior1 !== null) {
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(14, boxY, boxW, boxH, 1.5, 1.5, 'FD');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(`Pertumbuhan vs Bulan Lalu (${comp.prior1.label}):`, 17, boxY + 6);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          const growth1 = comp.growthVsPrior1;
          if (growth1 >= 0) {
            doc.setTextColor(16, 185, 129); // Emerald
            doc.text(`+${growth1.toFixed(1)}% (Meningkat)`, 17, boxY + 11);
          } else {
            doc.setTextColor(239, 68, 68); // Rose
            doc.text(`${growth1.toFixed(1)}% (Menurun)`, 17, boxY + 11);
          }
        }

        if (comp.growthVsPrior2 !== null) {
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(108, boxY, boxW, boxH, 1.5, 1.5, 'FD');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(`Pertumbuhan vs 2 Bulan Lalu (${comp.prior2.label}):`, 111, boxY + 6);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          const growth2 = comp.growthVsPrior2;
          if (growth2 >= 0) {
            doc.setTextColor(79, 70, 229); // Indigo
            doc.text(`+${growth2.toFixed(1)}% (Meningkat)`, 111, boxY + 11);
          } else {
            doc.setTextColor(239, 68, 68); // Rose
            doc.text(`${growth2.toFixed(1)}% (Menurun)`, 111, boxY + 11);
          }
        }

        finalY = boxY + boxH + 5;
      }

      // Section 3: Target Bulanan Berjenjang
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text('III. EVALUASI TARGET BERJENJANG BULANAN', 14, finalY + 8);

      let targetY = finalY + 13;
      let targetW = 58;
      let targetH = 18;
      
      targetAchievementsList.forEach((lvl, idx) => {
        let tx = 14 + idx * (targetW + 4);
        
        if (lvl.achieved) {
          doc.setFillColor(240, 253, 250); // Emerald 50
          doc.setDrawColor(167, 243, 208); // Emerald 200
        } else {
          doc.setFillColor(248, 250, 252); // Slate 50
          doc.setDrawColor(226, 232, 240); // Slate 200
        }
        doc.roundedRect(tx, targetY, targetW, targetH, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(lvl.label, tx + 4, targetY + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Target: Rp ${formatNumberIndo(lvl.target)}`, tx + 4, targetY + 10);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        if (lvl.achieved) {
          doc.setTextColor(4, 120, 87); // Emerald 700
          doc.text(`TERCAPAI (${lvl.pct.toFixed(1)}%)`, tx + 4, targetY + 15);
        } else {
          doc.setTextColor(100, 116, 139); // Slate 500
          doc.text(`BELUM TERCAPAI (${lvl.pct.toFixed(1)}%)`, tx + 4, targetY + 15);
        }
      });

      // ==========================================
      // PAGE 2: WEEKLY BREAKDOWN & CHANNELS & RECOMMENDATIONS
      // ==========================================
      setExportStep(`Menyusun ${monthLabel} - Halaman 2 (Analisa Mingguan & Saluran)...`);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      doc.addPage();

      // Section IV: Weekly Performance
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text('IV. ANALISIS KINERJA MINGGUAN (WEEKLY PERFORMANCE)', 14, 26);

      const weeklyHeaders = [['Minggu Ke-', 'Total Omzet', 'Total Transaksi (Tx)', 'Rerata Omzet Harian', 'Hari Operasional', 'Estimasi Kontribusi']];
      const weeklyRows = weekly.map(week => {
        const totalMonthSales = summary.totalSales || 1;
        const contributionPct = (week.totalSales / totalMonthSales) * 100;
        return [
          week.label,
          formatRupiah(week.totalSales),
          `${formatNumberIndo(week.totalTx)} Tx`,
          formatRupiah(week.avgSales),
          `${week.activeDays} Hari`,
          `${contributionPct.toFixed(1)}%`
        ];
      });

      autoTable(doc, {
        head: weeklyHeaders,
        body: weeklyRows,
        startY: 31,
        theme: 'striped',
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 45 },
          1: { halign: 'right', fontStyle: 'bold' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'center' },
          5: { halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] }
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          valign: 'middle'
        },
        margin: { left: 14, right: 14 }
      });

      let p2Y = (doc as any).lastAutoTable.finalY || 70;

      // Section V: Sales Channel Split
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229);
      doc.text('V. DISTRIBUSI SALURAN PENJUALAN (SALES CHANNEL SPLIT)', 14, p2Y + 8);

      let channelY = p2Y + 13;
      let channelW = 58;
      let channelH = 22;

      const splits = [
        { label: 'Instan (Kurir Instan)', sales: summary.channelSplit.instan.sales, tx: summary.channelSplit.instan.tx, pct: summary.channelSplit.instan.pct, bg: [240, 253, 244], border: [187, 247, 208], text: [21, 128, 61] },
        { label: 'Reguler (Ekspedisi)', sales: summary.channelSplit.reguler.sales, tx: summary.channelSplit.reguler.tx, pct: summary.channelSplit.reguler.pct, bg: [239, 246, 255], border: [191, 219, 254], text: [29, 78, 216] },
        { label: 'Manual (Offline/Custom)', sales: summary.channelSplit.manual.sales, tx: summary.channelSplit.manual.tx, pct: summary.channelSplit.manual.pct, bg: [255, 251, 235], border: [253, 242, 175], text: [180, 83, 9] }
      ];

      splits.forEach((split, idx) => {
        let cx = 14 + idx * (channelW + 4);
        doc.setFillColor(split.bg[0], split.bg[1], split.bg[2]);
        doc.setDrawColor(split.border[0], split.border[1], split.border[2]);
        doc.roundedRect(cx, channelY, channelW, channelH, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(split.text[0], split.text[1], split.text[2]);
        doc.text(split.label, cx + 3, channelY + 5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(formatRupiah(split.sales), cx + 3, channelY + 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`${split.tx} Transaksi (${split.pct.toFixed(1)}%)`, cx + 3, channelY + 18);
      });

      // Section VII: Strategic Recommendations
      let recY = channelY + channelH + 6;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, recY, 182, 30, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('💡 VII. ANALISIS & REKOMENDASI STRATEGIS', 18, recY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);

      const primaryChannel = summary.channelSplit.instan.pct > 40 ? 'Instan' : 'Reguler';
      
      const recText1 = `1. Kinerja omzet bulan ini didorong secara signifikan oleh penjualan melalui saluran ${primaryChannel}. Disarankan untuk terus memberikan promo voucher khusus untuk meningkatkan volume transaksi.`;
      const recText2 = `2. Rekomendasi operasional: Alokasikan sumber daya logistik ekstra pada hari-hari sibuk (terutama hari kerja aktif) untuk meminimalkan waktu pemrosesan dan menjaga loyalitas pelanggan setia.`;

      const lines1 = doc.splitTextToSize(recText1, 174);
      const lines2 = doc.splitTextToSize(recText2, 174);

      let textY = recY + 12;
      lines1.forEach((l: string) => {
        doc.text(l, 18, textY);
        textY += 4.2;
      });
      lines2.forEach((l: string) => {
        doc.text(l, 18, textY);
        textY += 4.2;
      });

      // Signatures
      let sigY = recY + 30 + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('LEMBAR PENGESAHAN LAPORAN:', 14, sigY);

      let pX = 14;
      let pY = sigY + 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('DIPERSIAPKAN OLEH:', pX, pY);
      
      doc.setDrawColor(226, 232, 240);
      doc.line(pX, pY + 18, pX + 60, pY + 18);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(preparedBy, pX, pY + 23);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Koordinator Toko / Operasional', pX, pY + 27);

      let aX = 120;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('DISETUJUI OLEH:', aX, pY);
      
      doc.line(aX, pY + 18, aX + 60, pY + 18);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(approvedBy, aX, pY + 23);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Pemilik Toko (Owner)', aX, pY + 27);

      // ==========================================
      // PAGE 3+: DETAILED DAILY SALES TRANSACTIONS LIST
      // ==========================================
      setExportStep(`Menyusun ${monthLabel} - Halaman Rincian Transaksi Harian...`);
      await new Promise(resolve => setTimeout(resolve, 50));

      doc.addPage();

      const dailyHeaders = [['Tanggal', 'Hari', 'Omzet Instan', 'Omzet Reguler', 'Omzet Manual', 'Omzet Total', 'Tx Total', 'Event / Kampanye']];
      const dailyRows = data.map(day => {
        const dayEvents = events.filter(e => e.date === day.date);
        const eventTitles = dayEvents.map(e => e.title).join(', ') || '-';
        return [
          day.date,
          day.dayOfWeek,
          formatRupiah(day.totalInstan),
          formatRupiah(day.totalReguler),
          formatRupiah(day.totalManual),
          formatRupiah(day.totalAll),
          `${day.txAll} Tx`,
          eventTitles
        ];
      });

      autoTable(doc, {
        head: dailyHeaders,
        body: dailyRows,
        startY: 28,
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42], // Slate 900
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 20 },
          1: { halign: 'left', cellWidth: 15 },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] },
          6: { halign: 'right' },
          7: { halign: 'left', cellWidth: 40 }
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2.2,
          valign: 'middle'
        },
        margin: { top: 25, bottom: 20, left: 14, right: 14 }
      });

      // ==========================================
      // POST-PROCESSING: HEADERS, FOOTERS & PAGE NUMBERS
      // ==========================================
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Draw running headers on Page 2 and Page 3+
        if (i > 1) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          
          const runningHeaderTitle = i === 2 
            ? 'IV. ANALISIS KINERJA MINGGUAN (WEEKLY PERFORMANCE)' 
            : 'VI. DAFTAR RINCIAN PENJUALAN HARIAN';
            
          doc.text(runningHeaderTitle, 14, 15);
          doc.text(`Periode: ${monthLabel}`, 196 - doc.getTextWidth(`Periode: ${monthLabel}`), 15);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.line(14, 18, 196, 18);
        }

        // Draw footers on ALL pages
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`${reportTitle} - Periode ${monthLabel}`, 14, 287);

        const pageStr = `Halaman ${i} dari ${totalPages}`;
        doc.text(pageStr, doc.internal.pageSize.width - 14 - doc.getTextWidth(pageStr), 287);
      }

      setExportStep(`Mengunduh PDF ${monthLabel}...`);
      doc.save(fileName);
    } catch (error) {
      console.error(`Gagal menghasilkan PDF untuk ${monthLabel}:`, error);
    }
  };

  // Automate sequential PDF generation for all available months when open is triggered
  useEffect(() => {
    if (isOpen && availableMonths.length > 0) {
      const runAutomatedExport = async () => {
        setIsExporting(true);
        // Sort chronologically ascending (oldest first, latest last)
        const sorted = [...availableMonths].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
        
        try {
          for (let i = 0; i < sorted.length; i++) {
            const currentMonthObj = sorted[i];
            setActiveExportIndex(i);
            setSelectedMonth(currentMonthObj.yearMonth);
            
            setExportStep(`Mempersiapkan data laporan ${currentMonthObj.label}...`);
            // Wait 200ms for state to sync and update
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Execute the PDF generation for this specific month
            await executeMonthPDFDownload(currentMonthObj.label);
          }
        } catch (error) {
          console.error('Kesalahan ekspor laporan otomatis:', error);
        } finally {
          setIsExporting(false);
          setActiveExportIndex(-1);
          setExportStep('');
          onClose(); // Automatically close the progress loader when done
        }
      };

      runAutomatedExport();
    }
  }, [isOpen, availableMonths, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] select-none pointer-events-none flex flex-col items-end gap-3 font-sans">
      {/* Sleek, Non-blocking Floating Progress Toast */}
      <div className="pointer-events-auto max-w-sm w-[360px] bg-white border border-slate-200 rounded-2xl p-4 shadow-2xl space-y-3.5 relative overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
        <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-indigo-50/50 blur-2xl opacity-70" />
        
        <div className="flex items-start gap-3 relative">
          <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center shrink-0">
            <span className="relative flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-indigo-500 items-center justify-center">
                <Download className="w-3 h-3 text-white" />
              </span>
            </span>
          </div>
          
          <div className="space-y-1 min-w-0 flex-1">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Mengekspor Laporan PDF...</h4>
            <p className="text-[10.5px] font-semibold text-slate-500 leading-normal">
              Laporan bulanan sedang dikonversi ke ukuran <strong className="text-slate-800">A4 Potret</strong> secara otomatis.
            </p>
          </div>
        </div>

        {/* Progress bar and step info */}
        <div className="space-y-2 bg-slate-50 border border-slate-100 p-3 rounded-xl relative z-10">
          <div className="flex items-center justify-between text-[9px] font-black uppercase text-slate-400 tracking-wider">
            <span>Progress Ekspor</span>
            <span className="text-indigo-600 font-bold">
              {activeExportIndex >= 0 ? `${activeExportIndex + 1} / ${availableMonths.length} Laporan` : 'Memulai...'}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${availableMonths.length > 0 ? ((activeExportIndex + 1) / availableMonths.length) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[10px] font-bold text-slate-600 animate-pulse truncate leading-tight">
              {exportStep || 'Mempersiapkan...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold justify-center pt-2 border-t border-slate-100">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>Vektor Tajam • Bebas Error Rendering • Instan</span>
        </div>
      </div>
    </div>
  );
}
