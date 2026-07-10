import React, { useState, useEffect, useMemo } from 'react';
import { ProductPerformance } from '../types';
import { parseProductPerformanceCSV, formatRupiah, formatNumberIndo, formatRupiahCompact } from '../utils';
import { 
  Package, Search, Filter, ArrowUpDown, Tag, Compass, 
  TrendingUp, BarChart2, DollarSign, Flame, FolderOpen, 
  RefreshCw, AlertCircle, Award, Check, SlidersHorizontal,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell 
} from 'recharts';

const PRODUCTS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8ACyi03DJ77mANO19x_hJV82Xs8rNBBLyT9IIGc1tgYGNrv9WMufjm940iEPx4QU6Eta6T8Ekv2-X/pub?gid=68677243&single=true&output=csv';

// Helper functions for Indonesian date/month formatting and Mon-Sun week calculations
function getMondayOfWeek(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(date.setDate(diff));
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMonthIndo(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const monthsIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthIdx = parseInt(month, 10) - 1;
  return `${monthsIndo[monthIdx] || month} ${year}`;
}

function formatWeekIndo(weekMondayStr: string): string {
  const date = new Date(weekMondayStr);
  const day = date.getDate();
  const monthsIndo = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  const month = monthsIndo[date.getMonth()];
  const year = String(date.getFullYear()).substring(2);
  return `Minggu Mulai ${day} ${month} '${year}`;
}

export default function SalesProducts() {
  const [products, setProducts] = useState<ProductPerformance[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('sales-desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Time-based filtering states (column 2 based weekly/monthly filtering)
  const [timeFilterType, setTimeFilterType] = useState<'all' | 'weekly' | 'monthly'>('all');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Fetch product CSV data
  const fetchProductData = async () => {
    setIsLoading(true);
    setIsError(null);
    try {
      const response = await fetch(PRODUCTS_CSV_URL);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const text = await response.text();
      const parsed = parseProductPerformanceCSV(text);
      if (parsed.length === 0) {
        throw new Error('Gagal memproses data produk atau format kolom tidak sesuai.');
      }
      setProducts(parsed);
    } catch (err: any) {
      console.error(err);
      setIsError(err.message || 'Gagal memuat data produk. Pastikan koneksi internet aktif.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductData();
  }, []);

  // Get all unique weeks from the dataset
  const availableWeeks = useMemo(() => {
    const weeksSet = new Set<string>();
    products.forEach(p => {
      if (p.date) {
        weeksSet.add(getMondayOfWeek(p.date));
      }
    });
    return Array.from(weeksSet).sort((a, b) => b.localeCompare(a)); // Sort descending (latest first)
  }, [products]);

  // Get all unique months from the dataset
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    products.forEach(p => {
      if (p.date) {
        monthsSet.add(p.date.substring(0, 7)); // "YYYY-MM"
      }
    });
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a)); // Sort descending (latest first)
  }, [products]);

  // Dynamic aggregation based on date period filters
  const aggregatedProducts = useMemo(() => {
    let filteredTransactions = [...products];

    // Filter by date first
    if (timeFilterType === 'weekly' && selectedWeek !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => {
        if (!t.date) return false;
        const weekMonday = getMondayOfWeek(t.date);
        return weekMonday === selectedWeek;
      });
    } else if (timeFilterType === 'monthly' && selectedMonth !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => {
        if (!t.date) return false;
        const monthStr = t.date.substring(0, 7); // "YYYY-MM"
        return monthStr === selectedMonth;
      });
    }

    // Now aggregate the transaction list by SKU
    const aggregation: Record<string, ProductPerformance> = {};

    filteredTransactions.forEach(t => {
      const sku = t.sku;
      if (!aggregation[sku]) {
        aggregation[sku] = {
          sku: t.sku,
          category: t.category,
          name: t.name,
          totalQty: 0,
          unit: t.unit,
          totalSales: 0,
          brand: t.brand,
          date: t.date
        };
      }
      aggregation[sku].totalQty += t.totalQty;
      aggregation[sku].totalSales += t.totalSales;

      // Keep updating fields in case a previous row was less complete
      if (t.category !== 'Uncategorized' && aggregation[sku].category === 'Uncategorized') {
        aggregation[sku].category = t.category;
      }
      if (t.name !== 'Produk Tanpa Nama' && aggregation[sku].name === 'Produk Tanpa Nama') {
        aggregation[sku].name = t.name;
      }
      if (t.brand !== 'No Brand' && aggregation[sku].brand === 'No Brand') {
        aggregation[sku].brand = t.brand;
      }
    });

    return Object.values(aggregation);
  }, [products, timeFilterType, selectedWeek, selectedMonth]);

  // Products filtered by Category and Brand (for overall stats and charts)
  const filteredProducts = useMemo(() => {
    let result = [...aggregatedProducts];
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }
    if (selectedBrand !== 'all') {
      result = result.filter(p => p.brand === selectedBrand);
    }
    return result;
  }, [aggregatedProducts, selectedCategory, selectedBrand]);

  // Filter Categories & Brands options
  const categories = useMemo(() => {
    const list = new Set<string>();
    products.forEach(p => {
      if (p.category) list.add(p.category);
    });
    return Array.from(list).sort();
  }, [products]);

  const brands = useMemo(() => {
    const list = new Set<string>();
    products.forEach(p => {
      if (p.brand) list.add(p.brand);
    });
    return Array.from(list).sort();
  }, [products]);

  // Overall Statistics (filtered by Category, Brand, and Date)
  const stats = useMemo(() => {
    if (filteredProducts.length === 0) return null;

    let totalRevenue = 0;
    let totalQty = 0;
    let maxSalesProduct: ProductPerformance | null = null;

    const categoryStats: Record<string, { revenue: number; qty: number }> = {};
    const brandStats: Record<string, { revenue: number; qty: number }> = {};

    filteredProducts.forEach(p => {
      totalRevenue += p.totalSales;
      totalQty += p.totalQty;

      if (!maxSalesProduct || p.totalSales > maxSalesProduct.totalSales) {
        maxSalesProduct = p;
      }

      // Category aggregation
      if (!categoryStats[p.category]) {
        categoryStats[p.category] = { revenue: 0, qty: 0 };
      }
      categoryStats[p.category].revenue += p.totalSales;
      categoryStats[p.category].qty += p.totalQty;

      // Brand aggregation
      if (!brandStats[p.brand]) {
        brandStats[p.brand] = { revenue: 0, qty: 0 };
      }
      brandStats[p.brand].revenue += p.totalSales;
      brandStats[p.brand].qty += p.totalQty;
    });

    // Top Category
    let topCategory = '';
    let topCategoryRevenue = -1;
    Object.entries(categoryStats).forEach(([cat, data]) => {
      if (data.revenue > topCategoryRevenue) {
        topCategoryRevenue = data.revenue;
        topCategory = cat;
      }
    });

    // Top Brand
    let topBrand = '';
    let topBrandRevenue = -1;
    Object.entries(brandStats).forEach(([br, data]) => {
      if (data.revenue > topBrandRevenue) {
        topBrandRevenue = data.revenue;
        topBrand = br;
      }
    });

    return {
      totalRevenue,
      totalQty,
      uniqueProducts: filteredProducts.length,
      bestseller: maxSalesProduct as ProductPerformance | null,
      topCategory,
      topCategoryRevenue,
      topBrand,
      topBrandRevenue,
      categorySummary: Object.entries(categoryStats).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue),
      brandSummary: Object.entries(brandStats).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue),
    };
  }, [filteredProducts]);

  // Top 10 Bestselling Products Chart Data
  const top10ChartData = useMemo(() => {
    return [...filteredProducts]
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10)
      .map(p => ({
        ...p,
        displayName: `${p.sku} - ${p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name}`
      }));
  }, [filteredProducts]);

  const chartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ProductPerformance;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl border border-slate-800 shadow-2xl space-y-2 max-w-sm text-xs">
          <p className="font-black text-slate-200 border-b border-slate-800/80 pb-1.5 leading-snug">
            {data.name}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
            <span className="text-slate-400 font-bold">SKU:</span>
            <span className="text-right font-black text-indigo-400">{data.sku}</span>
            <span className="text-slate-400 font-bold">Merk:</span>
            <span className="text-right text-slate-300 font-black">{data.brand}</span>
            <span className="text-slate-400 font-bold">Kategori:</span>
            <span className="text-right text-slate-300 font-black">{data.category}</span>
            <span className="text-slate-400 font-bold">Terjual:</span>
            <span className="text-right font-black text-emerald-400">{formatNumberIndo(data.totalQty)} {data.unit}</span>
            <span className="text-slate-400 font-bold">Omzet:</span>
            <span className="text-right font-black text-indigo-400">{formatRupiah(data.totalSales)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Filtered and Sorted products list
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...aggregatedProducts];

    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.sku.toLowerCase().includes(q) || 
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Brand filter
    if (selectedBrand !== 'all') {
      result = result.filter(p => p.brand === selectedBrand);
    }

    // Sort operations
    result.sort((a, b) => {
      if (sortBy === 'sales-desc') return b.totalSales - a.totalSales;
      if (sortBy === 'sales-asc') return a.totalSales - b.totalSales;
      if (sortBy === 'qty-desc') return b.totalQty - a.totalQty;
      if (sortBy === 'qty-asc') return a.totalQty - b.totalQty;
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'sku-asc') return a.sku.localeCompare(b.sku);
      return 0;
    });

    return result;
  }, [aggregatedProducts, searchQuery, selectedCategory, selectedBrand, sortBy]);

  // Pagination helper
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage) || 1;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedBrand, sortBy, itemsPerPage]);

  return (
    <div className="space-y-6">
      
      {/* Header section with fetch option */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-wide leading-none">Analisa Performa Produk</h2>
            <p className="text-[11px] text-slate-400 font-bold mt-1.5">Menganalisa data omzet dan volume penjualan per SKU secara detail</p>
          </div>
        </div>
        
        <button
          onClick={fetchProductData}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-200/50 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Sinkronkan Data Produk
        </button>
      </div>

      {isLoading && (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm space-y-4 flex flex-col items-center justify-center min-h-[400px]">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Memproses Spreadsheet Produk...</h3>
            <p className="text-xs text-slate-400 font-semibold mt-1">Mengunduh &amp; menganalisa data dari Google Sheet produk secara real-time.</p>
          </div>
        </div>
      )}

      {isError && !isLoading && (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-5 flex flex-col items-center justify-center min-h-[400px]">
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-full">
            <AlertCircle className="w-10 h-10" />
          </div>
          <div className="max-w-md">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Gagal Memuat Data Produk</h3>
            <p className="text-xs text-rose-600/95 font-semibold mt-2 leading-relaxed bg-rose-50/50 p-4 rounded-2xl border border-rose-100">{isError}</p>
          </div>
          
          <button
            onClick={fetchProductData}
            className="text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl shadow-sm transition-all"
          >
            Coba Sinkronkan Ulang
          </button>
        </div>
      )}

      {!isLoading && !isError && stats && (
        <>
          {/* Top Control & Filter Bar */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Dashboard Filter &amp; Analisa</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Filter data performa produk berdasarkan kategori dan periode secara instan</p>
                </div>
              </div>

              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Category Dropdown */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Kategori Produk:</span>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-bold text-slate-600 min-w-[160px]"
                  >
                    <option value="all">Semua Kategori ({categories.length})</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Brand Dropdown */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Merk / Brand:</span>
                  <select
                    value={selectedBrand}
                    onChange={e => setSelectedBrand(e.target.value)}
                    className="px-3 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-bold text-slate-600 min-w-[140px]"
                  >
                    <option value="all">Semua Merk ({brands.length})</option>
                    {brands.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* Time Period Type Dropdown */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Rentang Waktu:</span>
                  <select
                    value={timeFilterType}
                    onChange={e => {
                      setTimeFilterType(e.target.value as any);
                      // Reset sub filters on change
                      setSelectedWeek('all');
                      setSelectedMonth('all');
                    }}
                    className="px-3 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-bold text-slate-600 min-w-[140px]"
                  >
                    <option value="all">Semua Waktu</option>
                    <option value="weekly">Filter Mingguan</option>
                    <option value="monthly">Filter Bulanan</option>
                  </select>
                </div>

                {/* Conditional Sub-filters for Weekly / Monthly */}
                {timeFilterType === 'weekly' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Pilih Minggu (Kolom 2):</span>
                    <select
                      value={selectedWeek}
                      onChange={e => setSelectedWeek(e.target.value)}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200 text-indigo-700 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-bold min-w-[180px]"
                    >
                      <option value="all">Semua Minggu ({availableWeeks.length})</option>
                      {availableWeeks.map(wk => (
                        <option key={wk} value={wk}>{formatWeekIndo(wk)}</option>
                      ))}
                    </select>
                  </div>
                )}

                {timeFilterType === 'monthly' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Pilih Bulan (Kolom 2):</span>
                    <select
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(e.target.value)}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200 text-indigo-700 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-bold min-w-[160px]"
                    >
                      <option value="all">Semua Bulan ({availableMonths.length})</option>
                      {availableMonths.map(m => (
                        <option key={m} value={m}>{formatMonthIndo(m)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
            
            {/* Show an active filter status line */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-bold bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
              <span className="uppercase text-[9px] bg-slate-200/80 text-slate-600 px-1.5 py-0.5 rounded">Status Filter:</span>
              <span>Menampilkan total <strong>{formatNumberIndo(stats.uniqueProducts)}</strong> produk unik dengan akumulasi omzet <strong>{formatRupiah(stats.totalRevenue)}</strong></span>
              {selectedCategory !== 'all' && (
                <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">Kategori: {selectedCategory}</span>
              )}
              {selectedBrand !== 'all' && (
                <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100">Merk: {selectedBrand}</span>
              )}
              {timeFilterType === 'weekly' && selectedWeek !== 'all' && (
                <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-100">{formatWeekIndo(selectedWeek)}</span>
              )}
              {timeFilterType === 'monthly' && selectedMonth !== 'all' && (
                <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-100">{formatMonthIndo(selectedMonth)}</span>
              )}
              {(selectedCategory !== 'all' || selectedBrand !== 'all' || timeFilterType !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedBrand('all');
                    setTimeFilterType('all');
                    setSelectedWeek('all');
                    setSelectedMonth('all');
                  }}
                  className="ml-auto text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer uppercase text-[9px] font-black"
                >
                  Reset Semua Filter
                </button>
              )}
            </div>
          </div>

          {/* Statistics KPI Widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Total Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Penjualan</span>
                <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 leading-none">{formatRupiah(stats.totalRevenue)}</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1.5">Dari {stats.uniqueProducts} produk unik</p>
              </div>
            </div>

            {/* Total Qty Sold */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Unit Terjual</span>
                <div className="p-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 leading-none">{formatNumberIndo(stats.totalQty)} pcs</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1.5">Volume kumulatif terjual</p>
              </div>
            </div>

            {/* Best Seller SKU */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-3 relative overflow-hidden lg:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Produk Terlaris</span>
                <div className="p-1.5 bg-amber-50 border border-amber-100 rounded-lg text-amber-600">
                  <Flame className="w-4 h-4" />
                </div>
              </div>
              <div className="truncate">
                <h3 className="text-xs font-black text-slate-800 leading-snug truncate" title={stats.bestseller?.name || ''}>
                  {stats.bestseller?.name || 'Tidak ada'}
                </h3>
                <p className="text-[10px] text-slate-500 font-bold mt-1.5 flex items-center justify-between">
                  <span>SKU {stats.bestseller?.sku}</span>
                  <span className="text-indigo-600">{formatRupiah(stats.bestseller?.totalSales || 0)}</span>
                </p>
              </div>
            </div>

            {/* Top Category */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Kategori Teratas</span>
                <div className="p-1.5 bg-pink-50 border border-pink-100 rounded-lg text-pink-600">
                  <FolderOpen className="w-4 h-4" />
                </div>
              </div>
              <div className="truncate">
                <h3 className="text-sm font-black text-slate-800 leading-none truncate" title={stats.topCategory}>
                  {stats.topCategory || 'N/A'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1.5">Omzet: <span className="text-slate-700 font-extrabold">{formatRupiah(stats.topCategoryRevenue)}</span></p>
              </div>
            </div>

            {/* Top Brand */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Merk Teratas</span>
                <div className="p-1.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-600">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="truncate">
                <h3 className="text-sm font-black text-slate-800 leading-none truncate" title={stats.topBrand}>
                  {stats.topBrand || 'N/A'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1.5">Omzet: <span className="text-slate-700 font-extrabold">{formatRupiah(stats.topBrandRevenue)}</span></p>
              </div>
            </div>

          </div>

          {/* TOP 10 PRODUCTS VISUALIZATION (BAR CHART) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-500" />
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Visualisasi Top 10 Produk Terlaris (Omzet)</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Grafik perbandingan 10 produk dengan akumulasi omzet penjualan tertinggi</p>
                </div>
              </div>
              <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full uppercase tracking-wider font-black">Top 10 Omzet</span>
            </div>

            {top10ChartData.length > 0 ? (
              <div className="h-[400px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={top10ChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="productBarGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#818cf8" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      tickFormatter={(val) => formatRupiahCompact(val)}
                      tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="displayName"
                      tick={{ fontSize: 9, fill: '#334155', fontWeight: 'bold' }}
                      axisLine={false}
                      tickLine={false}
                      width={160}
                    />
                    <Tooltip content={chartTooltip} cursor={{ fill: '#f8fafc' }} />
                    <Bar
                      dataKey="totalSales"
                      fill="url(#productBarGrad)"
                      radius={[0, 8, 8, 0]}
                      barSize={18}
                    >
                      {top10ChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={index === 0 ? 'url(#productBarGrad)' : index === 1 ? '#6366f1' : index === 2 ? '#818cf8' : '#c7d2fe'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-400 font-bold text-xs italic">
                Data produk tidak tersedia untuk ditampilkan.
              </div>
            )}
          </div>

          {/* Section Grid: Category & Brand Share */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Category Performance Share */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4.5 h-4.5 text-indigo-500" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Kinerja per Kategori Produk</h3>
                </div>
                <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Diurutkan Omzet</span>
              </div>

              <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                {stats.categorySummary.map((cat, idx) => {
                  const pct = stats.totalRevenue > 0 ? (cat.revenue / stats.totalRevenue) * 100 : 0;
                  return (
                    <div key={cat.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-4 h-4 flex items-center justify-center text-[10px] font-extrabold bg-slate-100 text-slate-500 rounded-md shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <span className="text-slate-400 text-[11px]">{formatNumberIndo(cat.qty)} pcs</span>
                          <span className="text-indigo-600">{formatRupiah(cat.revenue)}</span>
                          <span className="text-[10px] text-slate-400 font-black min-w-[36px]">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Brand Performance Share */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4.5 h-4.5 text-indigo-500" />
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Kinerja per Merk / Brand</h3>
                </div>
                <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Diurutkan Omzet</span>
              </div>

              <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                {stats.brandSummary.map((br, idx) => {
                  const pct = stats.totalRevenue > 0 ? (br.revenue / stats.totalRevenue) * 100 : 0;
                  return (
                    <div key={br.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-4 h-4 flex items-center justify-center text-[10px] font-extrabold bg-slate-100 text-slate-500 rounded-md shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate">{br.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <span className="text-slate-400 text-[11px]">{formatNumberIndo(br.qty)} pcs</span>
                          <span className="text-emerald-600">{formatRupiah(br.revenue)}</span>
                          <span className="text-[10px] text-slate-400 font-black min-w-[36px]">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Core Interactive Search & Filter Controls */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Pencarian &amp; Filter Produk</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* Search Bar */}
              <div className="relative md:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari SKU, nama produk, kategori, atau merk..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-bold text-slate-700"
                />
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-bold text-slate-600"
                >
                  <option value="all">Semua Kategori ({categories.length})</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Brand Filter */}
              <div>
                <select
                  value={selectedBrand}
                  onChange={e => setSelectedBrand(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-bold text-slate-600"
                >
                  <option value="all">Semua Merk ({brands.length})</option>
                  {brands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Sorting & Item size selection footer bar */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-100 text-slate-500">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400">Urutkan:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'sales-desc', label: 'Omzet Tertinggi' },
                    { key: 'sales-asc', label: 'Omzet Terendah' },
                    { key: 'qty-desc', label: 'Qty Terbanyak' },
                    { key: 'qty-asc', label: 'Qty Terendah' },
                    { key: 'name-asc', label: 'Nama A-Z' },
                    { key: 'sku-asc', label: 'SKU Urut' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setSortBy(opt.key)}
                      className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${
                        sortBy === opt.key 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200/50 text-slate-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto font-bold shrink-0">
                <span>Baris per halaman:</span>
                <select
                  value={itemsPerPage}
                  onChange={e => setItemsPerPage(Number(e.target.value))}
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* Product Data Table Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4.5 h-4.5 text-indigo-500" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Daftar Kinerja Detail Produk</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase bg-slate-50 border border-slate-100 px-3 py-1 rounded-xl">
                Ditemukan: <strong className="text-indigo-600">{formatNumberIndo(filteredAndSortedProducts.length)} Produk</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-semibold">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5 text-center w-12">No</th>
                    <th className="py-3 px-4 w-20">SKU</th>
                    <th className="py-3 px-4">Nama Produk</th>
                    <th className="py-3 px-4 w-28">Merk / Brand</th>
                    <th className="py-3 px-4 w-36">Kategori</th>
                    <th className="py-3 px-4 text-right w-24">Qty Terjual</th>
                    <th className="py-3 px-4 text-center w-16">Unit</th>
                    <th className="py-3 px-4 text-right w-36">Total Omzet</th>
                    <th className="py-3 px-4 text-right w-28">Harga Rerata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedProducts.length > 0 ? (
                    paginatedProducts.map((p, idx) => {
                      const absoluteRank = (currentPage - 1) * itemsPerPage + idx + 1;
                      const avgPrice = p.totalQty > 0 ? p.totalSales / p.totalQty : 0;
                      return (
                        <tr 
                          key={p.sku + '-' + idx} 
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-3.5 px-5 text-center font-bold text-slate-400 text-[10.5px]">
                            {absoluteRank}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                            {p.sku}
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-slate-800">
                            {p.name}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                              p.brand === 'No Brand' 
                                ? 'bg-slate-50 text-slate-400 border-slate-100' 
                                : 'bg-indigo-50 text-indigo-700 border-indigo-100/40'
                            }`}>
                              {p.brand}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
                            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-600">
                              {p.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-slate-700">
                            {formatNumberIndo(p.totalQty)}
                          </td>
                          <td className="py-3.5 px-4 text-center text-[10px] uppercase font-black text-slate-400">
                            {p.unit}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-indigo-600">
                            {formatRupiah(p.totalSales)}
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-400 text-[11px]">
                            {formatRupiah(avgPrice)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                        Tidak ada produk yang cocok dengan pencarian / filter Anda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer */}
            {totalPages > 1 && (
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold">
                  Halaman <strong className="text-slate-800">{currentPage}</strong> dari <strong className="text-slate-800">{totalPages}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-slate-200 bg-white rounded-lg text-slate-500 hover:text-slate-800 transition-all disabled:opacity-40"
                    title="Sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  {/* Quick page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Center pages around current page
                    let pageNum = currentPage;
                    if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    if (pageNum < 1 || pageNum > totalPages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 font-black rounded-lg transition-all ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'hover:bg-slate-200 border border-transparent text-slate-500'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 border border-slate-200 bg-white rounded-lg text-slate-500 hover:text-slate-800 transition-all disabled:opacity-40"
                    title="Selanjutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </>
      )}

    </div>
  );
}
