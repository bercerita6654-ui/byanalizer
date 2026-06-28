import { DailySales, MarketingEvent } from './types';

// Helper to parse double-quoted CSV fields correctly
export function parseCSVRow(rowStr: string): string[] {
  const result: string[] = [];
  let insideQuote = false;
  let currentVal = '';
  
  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    if (char === '"') {
      insideQuote = !insideQuote;
    } else if (char === ',' && !insideQuote) {
      result.push(currentVal.trim());
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  result.push(currentVal.trim());
  return result.map(v => v.replace(/^"|"$/g, '').trim());
}

// Convert DD/MM/YYYY to YYYY-MM-DD
export function parseCSVDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  
  return `${year}-${month}-${day}`;
}

// Parse Indonesian currency/numbers (e.g., "14.229.013" or "Rp 14.229.013" to number)
export function parseNumber(valStr: string): number {
  if (!valStr) return 0;
  // Remove currency signs, whitespace, and thousands separators (dots)
  const clean = valStr
    .replace(/Rp/gi, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.'); // Convert Indonesian decimal commas if any
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

// Format numbers to Indonesian Currency
export function formatRupiah(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Compact currency formatting for charts (e.g. 14.2jt)
export function formatRupiahCompact(value: number): string {
  if (!value || isNaN(value)) return 'Rp 0';
  if (value >= 1000000000) return `Rp ${(value / 1000000000).toFixed(1)}M`;
  if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}jt`;
  if (value >= 1000) return `Rp ${(value / 1000).toFixed(0)}rb`;
  return `Rp ${value}`;
}

export function formatNumberIndo(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return new Intl.NumberFormat('id-ID').format(num);
}

export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

// Parse Google Sheet Sales CSV
export function parseDailySalesCSV(text: string): DailySales[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];
  
  // Find where header row starts (sometimes there are empty rows or title rows at top)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const row = parseCSVRow(lines[i]);
    if (row.some(col => col.toLowerCase().includes('tanggal') || col.toLowerCase().includes('instan'))) {
      headerIdx = i;
      break;
    }
  }

  const result: DailySales[] = [];
  const headers = parseCSVRow(lines[headerIdx]).map(h => h.toLowerCase());
  
  const dateIdx = headers.findIndex(h => h.includes('tanggal') || h.includes('date') || h.includes('tgl'));
  const txInstanIdx = headers.findIndex(h => h.includes('transaksi instan'));
  const totInstanIdx = headers.findIndex(h => h.includes('total instan'));
  const txRegulerIdx = headers.findIndex(h => h.includes('transaksi reguler'));
  const totRegulerIdx = headers.findIndex(h => h.includes('total reguler'));
  const txManualIdx = headers.findIndex(h => h.includes('transaksi manual'));
  const totManualIdx = headers.findIndex(h => h.includes('total manual'));
  const txAllIdx = headers.findIndex(h => h.includes('transaksi all') || h.includes('transaksi total'));
  const totAllIdx = headers.findIndex(h => h.includes('total all') || h.includes('total total'));

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    if (row.length < 2) continue;
    
    const rawDate = row[dateIdx !== -1 ? dateIdx : 0];
    if (!rawDate || rawDate.toLowerCase().includes('total')) continue;
    
    const parsedDate = parseCSVDate(rawDate);
    if (!parsedDate) continue;
    
    const txInstan = txInstanIdx !== -1 ? parseNumber(row[txInstanIdx]) : 0;
    const totalInstan = totInstanIdx !== -1 ? parseNumber(row[totInstanIdx]) : 0;
    
    const txReguler = txRegulerIdx !== -1 ? parseNumber(row[txRegulerIdx]) : 0;
    const totalReguler = totRegulerIdx !== -1 ? parseNumber(row[totRegulerIdx]) : 0;
    
    const txManual = txManualIdx !== -1 ? parseNumber(row[txManualIdx]) : 0;
    const totalManual = totManualIdx !== -1 ? parseNumber(row[totManualIdx]) : 0;

    const txAll = txAllIdx !== -1 ? parseNumber(row[txAllIdx]) : (txInstan + txReguler + txManual);
    const totalAll = totAllIdx !== -1 ? parseNumber(row[totAllIdx]) : (totalInstan + totalReguler + totalManual);

    // Day of week name in Indonesian
    const dateObj = new Date(parsedDate);
    const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayOfWeek = daysIndo[dateObj.getDay()];

    result.push({
      date: parsedDate,
      txInstan,
      totalInstan,
      txReguler,
      totalReguler,
      txManual,
      totalManual,
      txAll,
      totalAll,
      dayOfWeek
    });
  }

  // Sort by date ascending
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// Calendar Grid generator
export function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  let startDayOfWeek = firstDay.getDay(); 
  
  // Padding days from previous month
  const prevMonthEnd = new Date(year, month, 0);
  const prevMonthDaysCount = prevMonthEnd.getDate();
  
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push(new Date(year, month - 1, prevMonthDaysCount - i));
  }
  
  // Current month days
  const targetMonthEnd = new Date(year, month + 1, 0);
  const targetMonthDaysCount = targetMonthEnd.getDate();
  for (let i = 1; i <= targetMonthDaysCount; i++) {
    days.push(new Date(year, month, i));
  }
  
  // Padding days from next month to complete the 6-week grid (42 cells)
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push(new Date(year, month + 1, i));
  }
  
  return days;
}

// Generate standard sample marketing events to make calendar beautiful initially
export function generateSampleMarketingEvents(): MarketingEvent[] {
  return [
    {
      id: 'm1',
      date: '2026-01-02',
      title: 'Toko Baru Buka Tahun Baru',
      type: 'operational',
      description: 'Layanan liburan tahun baru usai, pengiriman instan kembali beroperasi normal.'
    },
    {
      id: 'm2',
      date: '2026-01-15',
      title: 'Kampanye Gajian (Payday)',
      type: 'promo',
      description: 'Promo cashback 10% untuk seluruh pelanggan reguler dan gratis ongkir.',
      budget: 1500000
    },
    {
      id: 'm3',
      date: '2026-02-02',
      title: 'Mega Promo Double Date 2.2',
      type: 'promo',
      description: 'Diskon kilat up to 50% untuk kategori stationery dan kertas binder.',
      budget: 3500000
    },
    {
      id: 'm4',
      date: '2026-02-25',
      title: 'Livestream Spesial Gajian Tokopedia',
      type: 'livestream',
      description: 'Live shopping bareng KOL, interaksi penonton tinggi mendorong order instan.',
      budget: 800000
    },
    {
      id: 'm5',
      date: '2026-03-03',
      title: 'Double Date 3.3 Super Shopping',
      type: 'promo',
      description: 'Rilisan bundle produk gambar baru, diskon voucher belanja.',
      budget: 4000000
    },
    {
      id: 'm6',
      date: '2026-03-25',
      title: 'Iklan Meta Ramadhan Berkah',
      type: 'ads',
      description: 'Iklan bertarget perlengkapan sekolah menyambut lebaran.',
      budget: 2000000
    },
    {
      id: 'm7',
      date: '2026-04-04',
      title: 'Promo Mudik Hemat 4.4',
      type: 'promo',
      description: 'Diskon tas sekolah anak dan botol minum portabel.',
      budget: 3000000
    },
    {
      id: 'm8',
      date: '2026-05-05',
      title: 'Flash Sale Belanja Cerdas 5.5',
      type: 'promo',
      description: 'Diskon s/d 60% pulpen gel premium dan binder kulit.',
      budget: 5000000
    },
    {
      id: 'm9',
      date: '2026-06-06',
      title: 'Double Date Festival Tengah Tahun 6.6',
      type: 'promo',
      description: 'Mid Year Sale - Clearance stock pulpen & buku tulis.',
      budget: 6500000
    }
  ];
}
