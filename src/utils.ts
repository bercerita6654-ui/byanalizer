import { DailySales, MarketingEvent, ProductPerformance, SalesOrder } from './types';

// Helper to normalize Google Sheet URLs to CSV export format
export function normalizeGoogleSheetUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.includes('export?format=csv') || trimmed.includes('/pub?')) {
    return trimmed;
  }
  const match = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    const sheetId = match[1];
    const sheetMatch = trimmed.match(/[?&#]sheet=([^&#]+)/);
    const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
    if (sheetMatch) {
      return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${sheetMatch[1]}`;
    }
    // GID 287037765 corresponds directly to sheet "LIST MENU PENJUALAN"
    const gid = gidMatch ? gidMatch[1] : '287037765';
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }
  return trimmed;
}

// Customers that count as Instan if Status === 'DIAMBIL'
export const INSTAN_CUSTOMERS = [
  'ONLINE TIKTOK TOKOPEDIA BALIST',
  'ONLINE SHOPEE',
  'ONLINE SHOPEE GOMART',
  'ONLINE TIKTOK TOPED GOMALL'
] as const;

export function isInstanCustomer(customer: string): boolean {
  if (!customer) return false;
  const upper = customer.trim().toUpperCase().replace(/\s+/g, ' ');
  return INSTAN_CUSTOMERS.some(c => c === upper);
}

// Helper to parse double-quoted CSV fields correctly
export function parseCSVRow(rowStr: string): string[] {
  const result: string[] = [];
  let insideQuote = false;
  let currentVal = '';
  
  for (let i = 0; i < rowStr.length; i++) {
    const char = rowStr[i];
    if (char === '"') {
      if (insideQuote && rowStr[i + 1] === '"') {
        currentVal += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
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

// Convert DD/MM/YYYY or ISO to YYYY-MM-DD
export function parseCSVDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  // Standard ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  // ISO with timestamp e.g. "2026-10-30 11:29:21"
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    return clean.substring(0, 10);
  }
  // DD/MM/YYYY
  const parts = clean.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }
  return parseIndonesianDate(clean);
}

// Convert Indonesian textual dates like "28 Mei 26" to YYYY-MM-DD
export function parseIndonesianDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim().replace(/\s+/g, ' ');
  const parts = cleanStr.split(' ');
  if (parts.length !== 3) {
    // Check if it's in DD/MM/YYYY format or similar
    const slashParts = cleanStr.split(/[-/]/);
    if (slashParts.length === 3) {
      const day = slashParts[0].padStart(2, '0');
      const month = slashParts[1].padStart(2, '0');
      let year = slashParts[2];
      if (year.length === 2) year = '20' + year;
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  const [dayStr, monthStr, yearStr] = parts;
  const day = dayStr.padStart(2, '0');
  let year = yearStr;
  if (year.length === 2) {
    year = '20' + year;
  }

  const monthsMap: Record<string, string> = {
    jan: '01', peb: '02', feb: '02', mar: '03', apr: '04', mei: '05', jun: '06',
    jul: '07', ags: '08', aug: '08', sep: '09', okt: '10', oct: '10',
    nov: '11', des: '12', dec: '12',
    januari: '01', februari: '02', maret: '03', april: '04', juni: '06',
    juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12'
  };

  const mLow = monthStr.toLowerCase();
  const month = monthsMap[mLow] || '01';

  return `${year}-${month}-${day}`;
}

// Parse Indonesian or standard float currency/numbers (handles 82500.00, 82.500, 82.500,00, etc.)
export function parseNumber(valStr: string | number | undefined | null): number {
  if (typeof valStr === 'number') return isNaN(valStr) ? 0 : valStr;
  if (!valStr) return 0;
  const s = String(valStr).replace(/Rp/gi, '').trim();
  if (!s || s === '-') return 0;

  // Case 1: Both dot and comma present (e.g. "82.500,00" Indonesian or "82,500.00" US)
  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // Indonesian format: dot is thousands, comma is decimal
      return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      // US format: comma is thousands, dot is decimal
      return parseFloat(s.replace(/,/g, '')) || 0;
    }
  }

  // Case 2: Only comma present (e.g. "82,500" US thousands or "82500,00" Indonesian decimal)
  if (s.includes(',') && !s.includes('.')) {
    const parts = s.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      return parseFloat(s.replace(/,/g, '')) || 0;
    }
    return parseFloat(s.replace(',', '.')) || 0;
  }

  // Case 3: Only dot present (e.g. "82500.00" US decimal vs "82.500" Indonesian thousands)
  if (s.includes('.') && !s.includes(',')) {
    const parts = s.split('.');
    // Multiple dots e.g. "1.500.000" -> dots are thousands
    if (parts.length > 2) {
      return parseFloat(s.replace(/\./g, '')) || 0;
    }
    // Single dot with exactly 3 digits after dot, and before dot is 1..3 digits: "82.500" -> 82500
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3) {
      return parseFloat(s.replace(/\./g, '')) || 0;
    }
    // e.g. "82500.00" -> 2 decimals, dot is decimal separator -> 82500
    return parseFloat(s) || 0;
  }

  const clean = s.replace(/\s+/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

// Parse US style formatted numbers (e.g., "29,088" or "5,000" where commas are thousands separators)
export function parseProductNumber(valStr: string): number {
  if (!valStr) return 0;
  const clean = valStr
    .replace(/Rp/gi, '')
    .replace(/\s+/g, '')
    .replace(/,/g, ''); // Simply strip out the commas (thousands separators)
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

// Format numbers to Indonesian standard thousand dots: e.g. 82500.00 -> "82.500"
export function formatNumberIndo(num: number | string | undefined | null): string {
  if (num === undefined || num === null || num === '') return '0';
  const val = typeof num === 'number' ? num : parseNumber(num);
  if (isNaN(val)) return '0';
  const rounded = Math.round(val);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Format numbers to Indonesian Currency: e.g. 82500.00 -> "Rp 82.500"
export function formatRupiah(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return 'Rp 0';
  const val = typeof value === 'number' ? value : parseNumber(value);
  if (isNaN(val)) return 'Rp 0';
  return `Rp ${formatNumberIndo(val)}`;
}

// Compact currency formatting for charts (e.g. 14.2jt)
export function formatRupiahCompact(value: number): string {
  if (!value || isNaN(value)) return 'Rp 0';
  if (value >= 1000000000) return `Rp ${(value / 1000000000).toFixed(1).replace('.', ',')}M`;
  if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1).replace('.', ',')}jt`;
  if (value >= 1000) return `Rp ${formatNumberIndo(Math.round(value / 1000))}rb`;
  return `Rp ${formatNumberIndo(value)}`;
}

export const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];
export const INDO_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
];

/**
 * Timezone-safe date parser.
 * ISO date strings "YYYY-MM-DD" are instantiated at local noon (12:00:00)
 * to avoid UTC midnight timezone rollback (which in UTC-X timezones turns
 * "2026-10-30" into Thursday, 29 October 2026).
 */
export function parseDateSafe(dateStr: string): Date {
  if (!dateStr) return new Date();
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day, 12, 0, 0);
  }
  const slashMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = parseInt(slashMatch[3], 10);
    return new Date(year, month, day, 12, 0, 0);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Returns Indonesian Day name (Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu)
 * strictly evaluated without timezone drift. E.g. "2026-10-30" -> "Jumat".
 */
export function getDayOfWeekIndo(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseDateSafe(dateStr);
  return INDO_DAYS[d.getDay()] || '';
}

/**
 * Formats date into standard Indonesian format strictly based on Kolom 3.
 * E.g. "2026-10-30" -> "Jumat, 30 Oktober 2026" (or "30 Oktober 2026" if withDay is false).
 */
export function formatDateIndo(dateStr: string, withDay: boolean = true): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  const match = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const year = match[1];
    const monthNum = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const monthName = INDO_MONTHS[monthNum - 1] || match[2];
    if (withDay) {
      const dayName = getDayOfWeekIndo(clean);
      return `${dayName}, ${day} ${monthName} ${year}`;
    }
    return `${day} ${monthName} ${year}`;
  }
  const d = parseDateSafe(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dayName = INDO_DAYS[d.getDay()];
  const day = d.getDate();
  const monthName = INDO_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  if (withDay) {
    return `${dayName}, ${day} ${monthName} ${year}`;
  }
  return `${day} ${monthName} ${year}`;
}

/**
 * Formats Year-Month or Date into Indonesian Month & Year.
 * E.g. "2026-10" or "2026-10-30" -> "Oktober 2026".
 */
export function formatMonthIndo(dateOrYearMonth: string): string {
  if (!dateOrYearMonth) return '';
  const clean = dateOrYearMonth.trim();
  const match = clean.match(/^(\d{4})-(\d{1,2})/);
  if (match) {
    const year = match[1];
    const monthNum = parseInt(match[2], 10);
    const monthName = INDO_MONTHS[monthNum - 1] || match[2];
    return `${monthName} ${year}`;
  }
  return dateOrYearMonth;
}

/**
 * Parse Kolom 2 (Tgl Input) to extract:
 * - date: YYYY-MM-DD
 * - jam: HH:mm:ss (or HH:mm)
 * - dayOfWeek: Indonesian day of week (Senin..Minggu)
 * Fallback to Kolom 3 (Tanggal) if Kolom 2 is empty.
 */
export function parseTglInput(tglInputStr: string, fallbackDateStr?: string): {
  date: string;
  jam: string;
  dayOfWeek: string;
} {
  const cleanInput = (tglInputStr || '').trim();
  let datePart = '';
  let jamPart = '';

  if (cleanInput) {
    // Check for space between date and time e.g. "2026-10-30 15:58:18"
    const spaceIdx = cleanInput.indexOf(' ');
    if (spaceIdx !== -1) {
      datePart = cleanInput.substring(0, spaceIdx).trim();
      jamPart = cleanInput.substring(spaceIdx + 1).trim();
    } else {
      const tIdx = cleanInput.indexOf('T');
      if (tIdx !== -1) {
        datePart = cleanInput.substring(0, tIdx).trim();
        jamPart = cleanInput.substring(tIdx + 1).trim();
      } else {
        datePart = cleanInput;
      }
    }
  }

  // Parse candidate date from Kolom 2
  let finalDate = parseCSVDate(datePart);

  // If Kolom 2 did not give a valid date, fallback to Kolom 3 (Tanggal)
  if (!finalDate && fallbackDateStr) {
    finalDate = parseCSVDate(fallbackDateStr);
  }

  const validDate = finalDate || datePart || fallbackDateStr || '';
  const dayOfWeek = validDate ? getDayOfWeekIndo(validDate) : '';

  return {
    date: validDate,
    jam: jamPart,
    dayOfWeek
  };
}

// Parse Google Sheet Sales CSV
// Specifically optimized for sheet "LIST MENU PENJUALAN":
// Kolom 1 (Index 0): No. Nota / ID
// Kolom 2 (Index 1): Tgl Input (Hari, Tanggal, Jam)
// Kolom 3 (Index 2): Tanggal
// Kolom 5 (Index 4): No. Pemesanan
// Kolom 6 (Index 5): Nama Toko Online (Customer)
// Kolom 8 (Index 7): Total Nominal
// Kolom 10 (Index 9): Admin yang Proses Nota (Created by)
// Kolom 13 (Index 12): Status
// Kolom 16 (Index 15): Void
export function parseDailySalesCSV(text: string): DailySales[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];
  
  // Find where header row starts
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const row = parseCSVRow(lines[i]);
    if (row.some(col => {
      const lower = col.toLowerCase();
      return lower.includes('tanggal') || lower.includes('date') || lower.includes('customer') || lower.includes('instan') || lower.includes('created');
    })) {
      headerIdx = i;
      break;
    }
  }

  const rawHeaders = parseCSVRow(lines[headerIdx]);
  const headers = rawHeaders.map(h => h.toLowerCase());

  // Detect whether this is the Raw Transactions format (LIST MENU PENJUALAN)
  const isRawFormat = headers.some(h => h === 'customer' || h.includes('pelanggan') || h === 'id') &&
                      headers.some(h => h === 'status' || h.includes('total'));

  if (isRawFormat) {
    // Dynamic index resolution with explicit column defaults (Kolom 1..N = Index 0..N-1)
    const custIdx = headers.findIndex(h => h === 'customer' || h.includes('toko') || h.includes('pelanggan'));
    const statusIdx = headers.findIndex(h => h === 'status');
    const totalIdx = headers.findIndex(h => h === 'total' || h.includes('nominal'));
    const voidIdx = headers.findIndex(h => h === 'void');

    const effectiveTglInputIdx = 1; // Kolom ke-2 (Tgl Input)
    const effectiveDateIdx = 2; // Kolom ke-3 (Tanggal)
    const effectiveCustIdx = custIdx !== -1 ? custIdx : 5; // Kolom ke-6
    const effectiveTotalIdx = totalIdx !== -1 ? totalIdx : 7; // Kolom ke-8
    const effectiveStatusIdx = statusIdx !== -1 ? statusIdx : 12; // Kolom ke-13
    const effectiveVoidIdx = voidIdx !== -1 ? voidIdx : 15; // Kolom ke-16

    const dateMap: Record<string, DailySales> = {};

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const row = parseCSVRow(lines[i]);
      if (row.length < 3) continue;

      // Skip voided transactions (e.g. Void === 'TRUE')
      if (effectiveVoidIdx < row.length && (row[effectiveVoidIdx] || '').trim().toUpperCase() === 'TRUE') {
        continue;
      }

      // Kolom 2 (Tgl Input) as primary source for date & day
      const rawTglInput = row[effectiveTglInputIdx] || '';
      const rawDate = row[effectiveDateIdx] || '';
      const { date: parsedDate } = parseTglInput(rawTglInput, rawDate);
      if (!parsedDate) continue;

      const total = parseNumber(row[effectiveTotalIdx]);
      const customer = (row[effectiveCustIdx] || '').trim().toUpperCase();
      const status = (row[effectiveStatusIdx] || '').trim().toUpperCase();

      if (!dateMap[parsedDate]) {
        dateMap[parsedDate] = {
          date: parsedDate,
          txInstan: 0,
          totalInstan: 0,
          txReguler: 0,
          totalReguler: 0,
          txManual: 0,
          totalManual: 0,
          txAll: 0,
          totalAll: 0,
          dayOfWeek: getDayOfWeekIndo(parsedDate)
        };
      }

      const d = dateMap[parsedDate];
      if (customer.includes('MANUAL')) {
        d.txManual += 1;
        d.totalManual += total;
      } else if (isInstanCustomer(customer) && status === 'DIAMBIL') {
        d.txInstan += 1;
        d.totalInstan += total;
      } else {
        d.txReguler += 1;
        d.totalReguler += total;
      }
    }

    const result = Object.values(dateMap).map(d => {
      d.txAll = d.txInstan + d.txReguler + d.txManual;
      d.totalAll = Math.round(d.totalInstan + d.totalReguler + d.totalManual);
      d.dayOfWeek = getDayOfWeekIndo(d.date);
      return d;
    }).sort((a, b) => a.date.localeCompare(b.date));

    return result;
  }

  // Fallback: Legacy Pre-Aggregated Sheet Format
  const result: DailySales[] = [];
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

    const dayOfWeek = getDayOfWeekIndo(parsedDate);

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

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// Parse Individual Sales Orders from sheet "LIST MENU PENJUALAN"
// Explicit Column Mappings:
// Kolom 1 (Index 0): No Nota / ID (e.g. "ONL.2610.03117")
// Kolom 2 (Index 1): Tgl Input
// Kolom 3 (Index 2): Tanggal
// Kolom 4 (Index 3): No. SO
// Kolom 5 (Index 4): No Pemesanan (e.g. "586864942941505492")
// Kolom 6 (Index 5): Nama Toko Online nya (Customer)
// Kolom 7 (Index 6): Kepada
// Kolom 8 (Index 7): Total Nominal
// Kolom 9 (Index 8): Type
// Kolom 10 (Index 9): Admin yang proses nota (Created by)
// Kolom 11 (Index 10): Sales
// Kolom 13 (Index 12): Status
// Kolom 16 (Index 15): Void
export function parseSalesOrders(text: string, maxRows: number = 100000): SalesOrder[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const row = parseCSVRow(lines[i]);
    if (row.some(col => col.toLowerCase().includes('customer') || col.toLowerCase().includes('status') || col.toLowerCase().includes('created'))) {
      headerIdx = i;
      break;
    }
  }

  const rawHeaders = parseCSVRow(lines[headerIdx]);
  const headers = rawHeaders.map(h => h.toLowerCase());

  // Find column indices dynamically with user's exact 1-indexed column numbering as direct defaults
  const dateIdx = headers.findIndex(h => h === 'tanggal' || h === 'date');
  const custIdx = headers.findIndex(h => h === 'customer' || h.includes('toko'));
  const statusIdx = headers.findIndex(h => h === 'status');
  const totalIdx = headers.findIndex(h => h === 'total' || h.includes('nominal'));
  const adminIdx = headers.findIndex(h => h.includes('created') || h.includes('admin'));
  const voidIdx = headers.findIndex(h => h === 'void');

  // Exact indices:
  // Kolom 1 = Index 0 (No Nota)
  // Kolom 2 = Index 1 (Tgl Input)
  // Kolom 3 = Index 2 (Tanggal)
  // Kolom 4 = Index 3 (No. SO)
  // Kolom 5 = Index 4 (No Pemesanan)
  // Kolom 6 = Index 5 (Nama Toko Online)
  // Kolom 7 = Index 6 (Kepada)
  // Kolom 8 = Index 7 (Total Nominal)
  // Kolom 9 = Index 8 (Type)
  // Kolom 10 = Index 9 (Admin proses nota)
  // Kolom 11 = Index 10 (Sales)
  // Kolom 13 = Index 12 (Status)
  // Kolom 16 = Index 15 (Void)
  const idxNoNota = 0; // Kolom 1
  const idxTglInput = 1; // Kolom 2
  const idxTanggal = dateIdx !== -1 ? dateIdx : 2; // Kolom 3
  const idxNoSo = 3; // Kolom 4
  const idxNoPemesanan = 4; // Kolom 5
  const idxNamaToko = custIdx !== -1 ? custIdx : 5; // Kolom 6
  const idxKepada = 6; // Kolom 7
  const idxTotalNominal = totalIdx !== -1 ? totalIdx : 7; // Kolom 8
  const idxType = 8; // Kolom 9
  const idxAdmin = adminIdx !== -1 ? adminIdx : 9; // Kolom 10
  const idxSales = 10; // Kolom 11
  const idxStatus = statusIdx !== -1 ? statusIdx : 12; // Kolom 13
  const idxVoid = voidIdx !== -1 ? voidIdx : 15; // Kolom 16

  const orders: SalesOrder[] = [];
  const limit = Math.min(lines.length, headerIdx + 1 + maxRows);

  for (let i = headerIdx + 1; i < limit; i++) {
    const row = parseCSVRow(lines[i]);
    if (row.length < 3) continue;

    const noNota = (row[idxNoNota] || `ORD-${i}`).trim();
    const tglInput = (row[idxTglInput] || '').trim();
    const rawDate = (row[idxTanggal] || '').trim();
    
    // Primary source for Hari, Tanggal, dan Jam is Kolom 2 (Tgl Input), fallback to Kolom 3 (Tanggal)
    const { date: parsedDate, jam, dayOfWeek } = parseTglInput(tglInput, rawDate);

    const noSo = (row[idxNoSo] || '').trim();
    const noPemesanan = (row[idxNoPemesanan] || '').trim();
    const tokoOnline = (row[idxNamaToko] || '').trim();
    const kepada = (row[idxKepada] || '').trim();
    const total = parseNumber(row[idxTotalNominal]);
    const type = (row[idxType] || '').trim();
    const admin = (row[idxAdmin] || '').trim();
    const sales = (row[idxSales] || '').trim();
    const status = (row[idxStatus] || '').trim();
    const isVoid = idxVoid < row.length ? (row[idxVoid] || '').trim().toUpperCase() === 'TRUE' : false;

    // Rule:
    // Status DIAMBIL + tokoOnline in INSTAN_CUSTOMERS => Pesanan Instan
    // tokoOnline includes MANUAL => Pesanan Manual
    // Others => Pesanan Reguler
    let orderCategory: 'instan' | 'reguler' | 'manual' = 'reguler';
    if (tokoOnline.toUpperCase().includes('MANUAL')) {
      orderCategory = 'manual';
    } else if (isInstanCustomer(tokoOnline) && status.toUpperCase() === 'DIAMBIL') {
      orderCategory = 'instan';
    } else {
      orderCategory = 'reguler';
    }

    orders.push({
      id: noNota,
      noNota,
      tglInput,
      date: parsedDate,
      jam,
      dayOfWeek,
      noSo,
      noPemesanan,
      tokoOnline,
      customer: tokoOnline,
      kepada,
      total,
      type,
      admin,
      createdBy: admin,
      sales,
      status,
      isVoid,
      orderCategory
    });
  }

  return orders;
}

/**
 * Aggregates daily sales from raw SalesOrder[] transactions,
 * computing tx counts and totals for Instan, Reguler, Manual, and All,
 * with timezone-safe Indonesian day of week.
 */
export function aggregateDailySalesFromOrders(orders: SalesOrder[]): DailySales[] {
  const dateMap: Record<string, DailySales> = {};
  
  orders.forEach(ord => {
    if (ord.isVoid) return;
    const parsedDate = ord.date;
    if (!parsedDate) return;
    
    if (!dateMap[parsedDate]) {
      dateMap[parsedDate] = {
        date: parsedDate,
        txInstan: 0,
        totalInstan: 0,
        txReguler: 0,
        totalReguler: 0,
        txManual: 0,
        totalManual: 0,
        txAll: 0,
        totalAll: 0,
        dayOfWeek: getDayOfWeekIndo(parsedDate)
      };
    }
    
    const d = dateMap[parsedDate];
    const total = ord.total || 0;
    if (ord.orderCategory === 'manual') {
      d.txManual += 1;
      d.totalManual += total;
    } else if (ord.orderCategory === 'instan') {
      d.txInstan += 1;
      d.totalInstan += total;
    } else {
      d.txReguler += 1;
      d.totalReguler += total;
    }
  });

  return Object.values(dateMap).map(d => {
    d.txAll = d.txInstan + d.txReguler + d.txManual;
    d.totalAll = Math.round(d.totalInstan + d.totalReguler + d.totalManual);
    d.dayOfWeek = getDayOfWeekIndo(d.date);
    return d;
  }).sort((a, b) => a.date.localeCompare(b.date));
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

// Parse Product Performance CSV from transactional history
export function parseProductPerformanceCSV(text: string): ProductPerformance[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  // Find where header row starts
  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const row = parseCSVRow(lines[i]);
    if (row.some(col => col.toLowerCase().includes('tanggal') || col.toLowerCase().includes('nomer') || col.toLowerCase().includes('code'))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) headerIdx = 0;

  const headers = parseCSVRow(lines[headerIdx]);
  const hasLeadingEmpty = headers[0] === '';

  // Dynamically map column indices based on header names
  // SKU/Code: Column 5 (index 4 in 1-based header starting with "")
  let skuIdx = headers.findIndex(h => h.toLowerCase() === 'code' || h.toLowerCase() === 'sku');
  // Kategori: Column 8 (index 7 in 1-based header starting with "")
  let categoryIdx = headers.findIndex(h => h.toLowerCase() === 'kategory' || h.toLowerCase() === 'kategori' || h.toLowerCase() === 'category');
  // Nama Produk: Column 7 (index 6 in 1-based header starting with "")
  let nameIdx = headers.findIndex(h => h.toLowerCase() === 'nama barang' || h.toLowerCase() === 'nama produk' || h.toLowerCase() === 'product');
  // Unit: Column 11 (index 10 in 1-based header starting with "")
  let unitIdx = headers.findIndex(h => h.toLowerCase() === 'unit');
  // Harga: Column 12 (index 11 in 1-based header starting with "")
  let priceIdx = headers.findIndex(h => h.toLowerCase() === 'harga' || h.toLowerCase() === 'price');
  // Merk: Column 9 (index 8 in 1-based header starting with "")
  let brandIdx = headers.findIndex(h => h.toLowerCase() === 'merk' || h.toLowerCase() === 'brand');
  // Tanggal: Column 2 (index 1 in 1-based header starting with "")
  let dateIdx = headers.findIndex(h => h.toLowerCase() === 'tanggal' || h.toLowerCase() === 'date' || h.toLowerCase() === 'tgl');
  // Qty: Column 10 (index 9 in 1-based header starting with "")
  let qtyIdx = headers.findIndex(h => h.toLowerCase() === 'qty' || h.toLowerCase() === 'quantity');
  // Invoice/Nomer: Column 3 (index 2 in 1-based header starting with "")
  let nomerIdx = headers.findIndex(h => h.toLowerCase() === 'nomer' || h.toLowerCase() === 'invoice' || h.toLowerCase() === 'no' || h.toLowerCase() === 'nomor');
  // Foto Produk:
  let fotoIdx = headers.findIndex(h => h.toLowerCase() === 'foto produk' || h.toLowerCase() === 'foto' || h.toLowerCase() === 'image' || h.toLowerCase() === 'gambar' || h.toLowerCase().includes('foto'));

  const result: ProductPerformance[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    if (row.length < 5) continue;

    // Shift indices if data row does not have a leading empty cell but the header does
    let sIdx = skuIdx;
    let cIdx = categoryIdx;
    let nIdx = nameIdx;
    let uIdx = unitIdx;
    let pIdx = priceIdx;
    let bIdx = brandIdx;
    let dIdx = dateIdx;
    let qIdx = qtyIdx;
    let nomIdx = nomerIdx;
    let fIdx = fotoIdx;

    const rowHasLeadingEmpty = row[0] === '';
    const needShift = hasLeadingEmpty && !rowHasLeadingEmpty;

    if (needShift) {
      if (sIdx > 0) sIdx--;
      if (cIdx > 0) cIdx--;
      if (nIdx > 0) nIdx--;
      if (uIdx > 0) uIdx--;
      if (pIdx > 0) pIdx--;
      if (bIdx > 0) bIdx--;
      if (dIdx > 0) dIdx--;
      if (qIdx > 0) qIdx--;
      if (nomIdx > 0) nomIdx--;
      if (fIdx > 0) fIdx--;
    }

    const defaultSkuIdx = needShift ? 3 : 4;
    const defaultCatIdx = needShift ? 6 : 7;
    const defaultNameIdx = needShift ? 5 : 6;
    const defaultUnitIdx = needShift ? 9 : 10;
    const defaultQtyIdx = needShift ? 8 : 9;
    const defaultPriceIdx = needShift ? 10 : 11;
    const defaultDateIdx = needShift ? 0 : 1;
    const defaultBrandIdx = needShift ? 7 : 8;

    // Extract values with safe fallbacks
    const sku = (row[sIdx] || row[defaultSkuIdx] || '').trim();
    if (!sku || sku.toLowerCase() === 'code' || sku.toLowerCase() === 'sku' || sku.toLowerCase() === 'barcode') continue;

    const category = (row[cIdx] || row[defaultCatIdx] || '').trim() || 'Uncategorized';
    const name = (row[nIdx] || row[defaultNameIdx] || '').trim() || 'Produk Tanpa Nama';
    const unit = (row[uIdx] || row[defaultUnitIdx] || 'PCS').trim();
    const qty = parseProductNumber(row[qIdx] || row[defaultQtyIdx] || '1');
    const price = parseProductNumber(row[pIdx] || row[defaultPriceIdx] || '0');
    const rawDate = (row[dIdx] || row[defaultDateIdx] || '').trim();
    const parsedDate = parseIndonesianDate(rawDate) || '2026-01-01';
    const imageUrl = (fIdx !== -1 ? row[fIdx] : '') || '';
    
    let brand = (row[bIdx] || row[defaultBrandIdx] || '').trim();
    if (!brand || brand === '#N/A' || brand.toLowerCase() === 'n/a' || brand === '') {
      brand = 'No Brand';
    }

    result.push({
      sku,
      category,
      name,
      totalQty: qty, // Use parsed Qty from Column 10
      unit,
      totalSales: price * qty, // Calculate correct line-item Sales as Price * Qty
      brand,
      date: parsedDate,
      imageUrl
    });
  }

  return result;
}

// Parse Stock List CSV (gid 1285691610) to map SKU to Foto Produk (Column 24)
export function parseStockListImageMap(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return {};
  const headers = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase());
  let codeIdx = headers.findIndex(h => h === 'code' || h === 'sku' || h === 'kode');
  if (codeIdx === -1) codeIdx = 0;
  let fotoIdx = headers.findIndex(h => h === 'foto produk' || h === 'fotoproduk' || h.includes('foto') || h.includes('image') || h.includes('photo'));
  if (fotoIdx === -1) fotoIdx = 23; // Column 24 (1-based) is index 23

  const map: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    if (!row || row.length <= Math.max(codeIdx, fotoIdx)) continue;
    const sku = String(row[codeIdx] || '').trim();
    const foto = String(row[fotoIdx] || '').trim();
    if (sku && foto && foto !== 'undefined' && foto !== 'null') {
      const url = foto.startsWith('http') ? foto : `https://lh3.googleusercontent.com/d/${foto}`;
      map[sku] = url;
      map[sku.toLowerCase()] = url;
      const numSku = sku.replace(/^0+/, '');
      if (numSku) {
        map[numSku] = url;
      }
    }
  }
  return map;
}
