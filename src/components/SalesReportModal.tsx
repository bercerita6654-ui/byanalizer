import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DailySales, MarketingEvent } from '../types';
import { formatRupiah, formatNumberIndo, formatDateIndo } from '../utils';
import { Download, CheckCircle2, X, Calendar, FileText, Check } from 'lucide-react';
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

  // Selected months state for downloading
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Initialize selected months to all available months when open is triggered
  useEffect(() => {
    if (isOpen && availableMonths.length > 0) {
      setSelectedMonths(availableMonths.map(m => m.yearMonth));
    }
  }, [isOpen, availableMonths]);

  // Set default selected month to latest month in dataset
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0].yearMonth);
    }
  }, [availableMonths, selectedMonth]);

  const reportTitle = 'Laporan Evaluasi & Kinerja Penjualan Bulanan';

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
      
      let totalInstan = 0;
      let totalReguler = 0;
      let totalManual = 0;
      filtered.forEach(day => {
        totalInstan += day.totalInstan;
        totalReguler += day.totalReguler;
        totalManual += day.totalManual;
      });

      return {
        key,
        label: formatMonthLabel(key),
        totalSales,
        totalTx,
        activeDays,
        avgDailySales,
        aov,
        hasData: filtered.length > 0,
        channelSplit: { instan: totalInstan, reguler: totalReguler, manual: totalManual }
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
      doc.text(`LAPORAN PENJUALAN BULAN ${monthLabel.toUpperCase()}`, 14, 20);

      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(0.5);
      doc.line(14, 25, 196, 25);

      // Section 1: Ringkasan Eksekutif
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(79, 70, 229); // Indigo 600
      doc.text('I. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)', 14, 32);

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
        comp.current.label,
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
        didParseCell: function(dataCell) {
          if (dataCell.section === 'body' && dataCell.row.index === 2) {
            dataCell.cell.styles.textColor = [29, 78, 216]; // Blue font
          }
        },
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
          doc.setTextColor(4, 120, 87); // Emerald 700 (Green)
          doc.text(`TERCAPAI (${lvl.pct.toFixed(1)}%)`, tx + 4, targetY + 15);
        } else {
          doc.setTextColor(220, 38, 38); // Red 600 (Red)
          doc.text(`TERCAPAI (${lvl.pct.toFixed(1)}%)`, tx + 4, targetY + 15);
        }
      });

      // Add MoM Growth
      if (comp.growthVsPrior1 !== null && comp.txGrowthVsPrior1 !== null) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(79, 70, 229);
        doc.text('IV. PERTUMBUHAN BULANAN (MoM GROWTH)', 14, targetY + 25);

        const drawMoMBox = (x: number, y: number, w: number, h: number, title: string, growth: number, currentVal: number, priorVal: number, isSales: boolean) => {
          const isSurplus = growth >= 0;
          const bgColor = isSurplus ? [240, 253, 244] : [255, 241, 242]; // Emerald 50 vs Rose 50
          const borderColor = isSurplus ? [187, 247, 208] : [254, 205, 211]; // Emerald 200 vs Rose 200
          const textColor = isSurplus ? [6, 78, 59] : [159, 18, 57]; // Emerald 800 vs Rose 800
          
          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
          doc.roundedRect(x, y, w, h, 2, 2, 'FD');
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(title.toUpperCase(), x + 4, y + 6);
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.text((isSurplus ? '+' : '') + growth.toFixed(2) + '%', x + 4, y + 12);
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(71, 85, 105);
          doc.text(`Bulan Ini: ${isSales ? formatRupiah(currentVal) : formatNumberIndo(currentVal) + ' Tx'}`, x + 4, y + 16);
          doc.text(`Bulan Lalu: ${isSales ? formatRupiah(priorVal) : formatNumberIndo(priorVal) + ' Tx'}`, x + 4, y + 20);
        };

        const momY = targetY + 28;
        const momW = 89;
        const momH = 22;
        drawMoMBox(14, momY, momW, momH, 'PERTUMBUHAN OMZET', comp.growthVsPrior1, comp.current.totalSales, comp.prior1.totalSales, true);
        drawMoMBox(14 + momW + 4, momY, momW, momH, 'PERTUMBUHAN TRANSAKSI', comp.txGrowthVsPrior1, comp.current.totalTx, comp.prior1.totalTx, false);
      }

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
        { label: 'Instan (Kurir Instan)', sales: summary.channelSplit.instan.sales, priorSales: comp.prior1.channelSplit.instan, tx: summary.channelSplit.instan.tx, pct: summary.channelSplit.instan.pct, bg: [240, 253, 244], border: [187, 247, 208], text: [21, 128, 61] },
        { label: 'Reguler (Ekspedisi)', sales: summary.channelSplit.reguler.sales, priorSales: comp.prior1.channelSplit.reguler, tx: summary.channelSplit.reguler.tx, pct: summary.channelSplit.reguler.pct, bg: [239, 246, 255], border: [191, 219, 254], text: [29, 78, 216] },
        { label: 'Manual (Offline/Custom)', sales: summary.channelSplit.manual.sales, priorSales: comp.prior1.channelSplit.manual, tx: summary.channelSplit.manual.tx, pct: summary.channelSplit.manual.pct, bg: [255, 251, 235], border: [253, 242, 175], text: [180, 83, 9] }
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
        doc.text(`${split.tx} Tx (${split.pct.toFixed(1)}%)`, cx + 3, channelY + 16);
        doc.text(`vs Bln Lalu: ${formatRupiah(split.priorSales)}`, cx + 3, channelY + 20);
      });

      // Section VII: Strategic Recommendations
      let recY = channelY + channelH + 6;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, recY, 182, 30, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('VII. ANALISIS & REKOMENDASI (berdasarkan AI)', 18, recY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);

      const primaryChannel = summary.channelSplit.instan.pct > 40 ? 'Instan' : 'Reguler';
      
      const recText1 = `1. Kinerja omzet bulan ini didorong secara signifikan oleh penjualan melalui saluran ${primaryChannel}. Disarankan untuk terus memberikan promo voucher khusus untuk meningkatkan volume transaksi.`;
      const recText2 = `2. Rekomendasi operasional: Alokasikan sumber daya logistik ekstra pada hari-hari sibuk (terutama hari kerja aktif) untuk meminimalkan waktu pemrosesan dan menjaga loyalitas pelanggan setia.`;
      const recText3 = `3. Optimasi pada periode promo Double Date 6.6, 7.7, 8.8, dst, terbukti efektif meningkatkan trafik.`;

      const lines = doc.splitTextToSize(`${recText1}\n${recText2}\n${recText3}`, 174);

      let textY = recY + 12;
      lines.forEach((l: string) => {
        doc.text(l, 18, textY);
        textY += 4.2;
      });

      // Chart: Performance by Day of Week
      const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      const salesByDay: Record<string, number> = {};
      const txByDay: Record<string, number> = {};
      daysOfWeek.forEach(d => {
          salesByDay[d] = 0;
          txByDay[d] = 0;
      });
      data.forEach(d => {
          if (salesByDay[d.dayOfWeek] !== undefined) {
              salesByDay[d.dayOfWeek] += d.totalAll;
              txByDay[d.dayOfWeek] += d.txAll;
          }
      });

      const chartY = recY + 35;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('TOTAL PERFORMA PENJUALAN BERDASARKAN HARI', 14, chartY);

      const barMaxWidth = 110;
      const maxSales = Math.max(...Object.values(salesByDay), 1);
      let barY = chartY + 8;
      daysOfWeek.forEach(day => {
          const sales = salesByDay[day];
          const width = (sales / maxSales) * barMaxWidth;
          doc.setFillColor(79, 70, 229); // Indigo 600
          doc.rect(40, barY, width, 4, 'F');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(71, 85, 105);
          doc.text(day, 14, barY + 3.5);
          doc.text(formatRupiah(sales), 40 + width + 2, barY + 3.5);
          barY += 7;
      });

      // Add transaction ranking
      const txStatsY = barY + 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('Peringkat Hari Berdasarkan Volume Transaksi:', 14, txStatsY);
      
      const sortedDays = Object.entries(txByDay).sort((a, b) => b[1] - a[1]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      sortedDays.forEach((dayTx, index) => {
          doc.text(`${index + 1}. ${dayTx[0]}: ${formatNumberIndo(dayTx[1])} Tx`, 14, txStatsY + 5 + (index * 4));
      });

      // ==========================================
      // PAGE 3+: DETAILED DAILY SALES TRANSACTIONS LIST
      // ==========================================
      setExportStep(`Menyusun ${monthLabel} - Halaman Rincian Transaksi Harian...`);
      await new Promise(resolve => setTimeout(resolve, 50));

      doc.addPage();

      const dailyHeaders = [['Tanggal', 'Hari', 'Omzet Instan', 'Omzet Reguler', 'Omzet Manual', 'Omzet Total', 'Tx Total', 'Event / Kampanye']];
      const dailyRows = data.map(day => {
        const dayEvents = events.filter(e => e.date === day.date);
        const eventTitles = dayEvents.map(e => e.title).join(', ');
        
        let holidayInfo = '';
        // Add hardcoded holiday checks for Bali/National
        // This is a simplified approach based on the request
        const holidayMap: Record<string, string> = {
          '2026-03-29': 'Nyepi',
          '2026-04-01': 'Galungan',
          '2026-04-11': 'Kuningan',
          '2026-06-01': 'Hari Lahir Pancasila',
          '2026-06-10': 'Galungan',
          '2026-06-20': 'Kuningan'
        };
        if (holidayMap[day.date]) {
          holidayInfo = `[Libur: ${holidayMap[day.date]}] `;
        }
        
        return [
          day.date,
          day.dayOfWeek,
          formatRupiah(day.totalInstan),
          formatRupiah(day.totalReguler),
          formatRupiah(day.totalManual),
          formatRupiah(day.totalAll),
          `${day.txAll} Tx`,
          `${holidayInfo}${eventTitles || '-'}`
        ];
      });

      autoTable(doc, {
        head: dailyHeaders,
        body: dailyRows,
        startY: 28,
        theme: 'striped',
        didParseCell: function(dataCell) {
          if (dataCell.section === 'body') {
            const dayValue = dataCell.row.raw[1];
            if (typeof dayValue === 'string' && (dayValue.toLowerCase() === 'minggu' || dayValue.toLowerCase() === 'sunday')) {
              dataCell.cell.styles.textColor = [220, 38, 38]; // Red font for Sunday
            }
          }
        },
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

  // Start download sequentially for chosen months
  const handleStartDownload = async () => {
    if (selectedMonths.length === 0) return;
    setIsExporting(true);
    
    // Sort selected months chronologically ascending (oldest first)
    const sortedSelected = [...availableMonths]
      .filter(m => selectedMonths.includes(m.yearMonth))
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

    try {
      for (let i = 0; i < sortedSelected.length; i++) {
        const currentMonthObj = sortedSelected[i];
        setActiveExportIndex(i);
        setSelectedMonth(currentMonthObj.yearMonth);
        
        setExportStep(`Mempersiapkan data laporan ${currentMonthObj.label}...`);
        // Wait 250ms for state and currentMonthSummary useMemo to update and settle
        await new Promise(resolve => setTimeout(resolve, 250));
        
        // Execute the PDF generation for this specific month
        await executeMonthPDFDownload(currentMonthObj.label);
      }
    } catch (error) {
      console.error('Kesalahan ekspor laporan:', error);
    } finally {
      setIsExporting(false);
      setActiveExportIndex(-1);
      setExportStep('');
      onClose(); // Automatically close when done
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in font-sans">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh] relative animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide leading-none">Unduh Laporan Kinerja Bulanan</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Pilih periode bulan evaluasi untuk diekspor ke PDF</p>
            </div>
          </div>
          
          {!isExporting && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all border border-slate-200/50 bg-white shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isExporting ? (
          /* Progress State View */
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 flex-1 my-auto">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-12 w-12 bg-indigo-600 items-center justify-center shadow-lg shadow-indigo-200">
                <Download className="w-5 h-5 text-white animate-bounce" />
              </span>
            </div>

            <div className="space-y-2 max-w-xs">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Mengekspor Laporan PDF...</h4>
              <p className="text-[10.5px] font-semibold text-slate-500 leading-normal">
                Harap tunggu, laporan bulanan sedang dikonversi ke format PDF secara berurutan.
              </p>
            </div>

            {/* Progress bar and step info */}
            <div className="w-full max-w-sm bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <span>Progress Ekspor</span>
                <span className="text-indigo-600 font-bold">
                  {activeExportIndex >= 0 ? `${activeExportIndex + 1} / ${selectedMonths.length} Laporan` : 'Memulai...'}
                </span>
              </div>

              <div className="space-y-2">
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${selectedMonths.length > 0 ? ((activeExportIndex + 1) / selectedMonths.length) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10.5px] font-bold text-slate-600 animate-pulse truncate leading-tight">
                  {exportStep || 'Mempersiapkan...'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold justify-center pt-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Vektor Tajam • Bebas Error Rendering • Tanpa Tanda Tangan</span>
            </div>
          </div>
        ) : (
          /* Selection Form View */
          <>
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              
              {/* Quick info panel */}
              <div className="bg-amber-50 border border-amber-200/40 p-4 rounded-2xl flex gap-3 text-[11px] font-semibold text-amber-800 leading-normal">
                <div className="mt-0.5 shrink-0">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-100 text-amber-700 rounded-full font-bold">!</span>
                </div>
                <p>
                  Sistem mendeteksi <strong className="text-amber-950">{availableMonths.length} bulan</strong> data penjualan. Pilih bulan yang ingin Anda unduh secara bersamaan. Laporan akan diunduh secara berurutan.
                </p>
              </div>

              {/* Selection Actions (Select All, Clear) */}
              <div className="flex items-center justify-between pb-1 text-[11px] font-bold">
                <span className="text-slate-400 uppercase tracking-wider">Daftar Bulan Tersedia</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMonths(availableMonths.map(m => m.yearMonth))}
                    className="text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-wider"
                  >
                    Pilih Semua
                  </button>
                  <span className="text-slate-200">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedMonths([])}
                    className="text-rose-600 hover:text-rose-800 transition-colors uppercase tracking-wider"
                  >
                    Batalkan Pilihan
                  </button>
                </div>
              </div>

              {/* Month List */}
              <div className="space-y-2 border border-slate-100 rounded-2xl p-2 max-h-[35vh] overflow-y-auto bg-slate-50/50">
                {availableMonths.map(month => {
                  const isChecked = selectedMonths.includes(month.yearMonth);
                  
                  // Target status indicator based on sales thresholds
                  const isGold = month.totalSales >= 800000000;
                  const isSilver = month.totalSales >= 700000000;
                  const isBronze = month.totalSales >= 600000000;
                  
                  const targetLabel = isGold ? '🥇 Gold' : isSilver ? '🥈 Silver' : isBronze ? '🥉 Bronze' : '❌ No Level';
                  const targetColor = isGold 
                    ? 'bg-amber-50 text-amber-700 border-amber-200/60' 
                    : isSilver 
                    ? 'bg-slate-100 text-slate-700 border-slate-200/60' 
                    : isBronze 
                    ? 'bg-amber-100 text-amber-800 border-amber-200/60' 
                    : 'bg-rose-50 text-rose-600 border-rose-100';

                  return (
                    <button
                      key={month.yearMonth}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setSelectedMonths(prev => prev.filter(m => m !== month.yearMonth));
                        } else {
                          setSelectedMonths(prev => [...prev, month.yearMonth]);
                        }
                      }}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left group ${
                        isChecked 
                          ? 'bg-white border-indigo-200 shadow-sm' 
                          : 'bg-transparent border-transparent hover:bg-slate-100/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1 rounded-md border transition-all ${
                          isChecked 
                            ? 'bg-indigo-600 border-indigo-600 text-white' 
                            : 'bg-white border-slate-200 text-transparent group-hover:border-slate-300'
                        }`}>
                          <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-slate-800">{month.label}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">{formatRupiah(month.totalSales)}</p>
                        </div>
                      </div>

                      <span className={`text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-lg border ${targetColor}`}>
                        {targetLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                Terpilih: <strong className="text-indigo-600 font-extrabold">{selectedMonths.length} Bulan</strong>
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-black uppercase text-slate-500 hover:text-slate-700 transition-colors bg-white shadow-sm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleStartDownload}
                  disabled={selectedMonths.length === 0}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-indigo-100 disabled:opacity-45 hover:scale-[1.01]"
                >
                  <Download className="w-4 h-4 text-white" />
                  Mulai Unduh
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
