import React, { useState, useEffect, useMemo } from 'react';
import { ProductPerformance } from '../types';
import { parseProductPerformanceCSV, formatRupiah, formatNumberIndo, formatRupiahCompact } from '../utils';
import { getProductsCache, setProductsCache } from '../dbCache';
import { 
  Package, Search, Filter, ArrowUpDown, Tag, Compass, 
  TrendingUp, BarChart2, DollarSign, Flame, FolderOpen, 
  RefreshCw, AlertCircle, Award, Check, SlidersHorizontal,
  ChevronLeft, ChevronRight, Download, X, Sparkles, TrendingDown, Zap
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, Legend, LineChart, Line
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

function formatDateIndo(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const monthsIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const month = monthsIndo[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

const TrendMiniBarChart = ({ data, dates }: { data: number[], dates: string[] }) => {
  const maxVal = Math.max(...data, 0);
  return (
    <div className="flex items-end gap-1 h-7 w-20 justify-between px-1" title="Tren volume penjualan (Qty) 7 hari terakhir">
      {data.map((val, idx) => {
        const heightPct = maxVal > 0 ? (val / maxVal) * 80 : 0;
        const formattedDate = dates[idx] ? formatDateIndo(dates[idx]) : '';
        return (
          <div 
            key={idx} 
            className="group/bar relative flex-1 flex items-end h-full cursor-help"
          >
            <div 
              className={`w-full rounded-[1.5px] transition-all duration-200 ${
                val > 0 
                  ? 'bg-indigo-500 hover:bg-indigo-600 shadow-[0_1px_2px_rgba(99,102,241,0.2)]' 
                  : 'bg-slate-100 hover:bg-slate-200'
              }`}
              style={{ height: val > 0 ? `${Math.max(15, heightPct)}%` : '10%' }}
            />
            {/* Tooltip on top of the bar */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/bar:block bg-slate-900 text-white text-[9px] px-2 py-1 rounded-lg shadow-xl whitespace-nowrap z-50 font-mono pointer-events-none border border-slate-800">
              <span className="font-sans block text-slate-400 text-[8px] leading-none mb-0.5">{formattedDate}</span>
              <span className="font-extrabold text-indigo-400">{val}</span> <span className="text-slate-300">pcs</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

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
  const [selectedTrendProductSku, setSelectedTrendProductSku] = useState<string | null>(null);
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<string | null>(null);

  // Product comparison state
  const [selectedCompProductASku, setSelectedCompProductASku] = useState<string>('');
  const [selectedCompProductBSku, setSelectedCompProductBSku] = useState<string>('');
  const [compMetric, setCompMetric] = useState<'qty' | 'sales'>('qty');

  // Time-based filtering states (column 2 based daily/weekly/monthly filtering)
  const [timeFilterType, setTimeFilterType] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('monthly');
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const [isUsingCache, setIsUsingCache] = useState<boolean>(false);

  // Fetch product CSV data
  const fetchProductData = async (forceNetwork: boolean = false) => {
    setIsLoading(true);
    setIsError(null);
    try {
      if (forceNetwork === false || (typeof forceNetwork !== 'boolean')) {
        // Cek data di IndexedDB terlebih dahulu untuk loading instan
        const cachedData = await getProductsCache(PRODUCTS_CSV_URL);
        if (cachedData && cachedData.length > 0) {
          setProducts(cachedData);
          setIsUsingCache(true);
          setIsLoading(false);
          return;
        }
      }

      // Tarik data baru dari Google Sheets
      const response = await fetch(PRODUCTS_CSV_URL);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const text = await response.text();
      const parsed = parseProductPerformanceCSV(text);
      if (parsed.length === 0) {
        throw new Error('Gagal memproses data produk atau format kolom tidak sesuai.');
      }
      setProducts(parsed);
      await setProductsCache(PRODUCTS_CSV_URL, parsed);
      setIsUsingCache(false);
    } catch (err: any) {
      console.error(err);
      setIsError(err.message || 'Gagal memuat data produk. Pastikan koneksi internet aktif.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductData(false);
  }, []);

  // Get all unique days from the dataset
  const availableDays = useMemo(() => {
    const daysSet = new Set<string>();
    products.forEach(p => {
      if (p.date) {
        daysSet.add(p.date); // "YYYY-MM-DD"
      }
    });
    return Array.from(daysSet).sort((a, b) => b.localeCompare(a)); // Sort descending (latest first)
  }, [products]);

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

  // Pre-calculate 7-day sales trend (Qty & Sales) for all products
  const productTrendMap = useMemo(() => {
    if (products.length === 0) return { last7Days: [], trends: {} as Record<string, { qty: number[]; sales: number[] }> };

    // Get the latest 7 unique days from availableDays
    const last7Days = [...availableDays.slice(0, 7)].reverse();
    const K = last7Days.length;

    const trends: Record<string, { qty: number[]; sales: number[] }> = {};

    products.forEach(p => {
      if (!p.sku || !p.date) return;
      const dayIdx = last7Days.indexOf(p.date);
      if (dayIdx !== -1) {
        if (!trends[p.sku]) {
          trends[p.sku] = {
            qty: Array(K).fill(0),
            sales: Array(K).fill(0)
          };
        }
        trends[p.sku].qty[dayIdx] += p.totalQty;
        trends[p.sku].sales[dayIdx] += p.totalSales;
      }
    });

    return {
      last7Days,
      trends
    };
  }, [products, availableDays]);

  // Selected product and its 7-day trend chart data for the popup detailed view
  const selectedTrendProduct = useMemo(() => {
    if (!selectedTrendProductSku) return null;
    // Find the product details by SKU (could be from products array or aggregated list)
    return products.find(p => p.sku === selectedTrendProductSku) || null;
  }, [selectedTrendProductSku, products]);

  const selectedProductChartData = useMemo(() => {
    if (!selectedTrendProductSku || !productTrendMap.trends[selectedTrendProductSku]) return [];
    
    const trend = productTrendMap.trends[selectedTrendProductSku];
    return productTrendMap.last7Days.map((date, idx) => {
      return {
        date,
        formattedDate: formatDateIndo(date),
        qty: trend.qty[idx] || 0,
        sales: trend.sales[idx] || 0
      };
    });
  }, [selectedTrendProductSku, productTrendMap]);

  const productTrendTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length && selectedTrendProduct) {
      const data = payload[0].payload;
      const avgPrice = data.qty > 0 ? Math.round(data.sales / data.qty) : 0;
      return (
        <div className="bg-slate-950/95 backdrop-blur-md text-white p-4 rounded-2xl border border-slate-800 shadow-2xl space-y-2.5 text-xs min-w-[240px]">
          <div className="border-b border-slate-800/80 pb-1.5">
            <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] block mb-0.5">📈 Tren Penjualan</span>
            <span className="font-mono text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded text-[10px]">
              {data.formattedDate}
            </span>
          </div>
          
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-400">Volume Terjual:</span>
              <span className="font-black text-indigo-400">{formatNumberIndo(data.qty)} {selectedTrendProduct.unit}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-400">Omzet Harian:</span>
              <span className="font-black text-emerald-400">{formatRupiah(data.sales)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-900/60 pt-1">
              <span className="font-semibold text-slate-500">Rerata Harga Jual:</span>
              <span className="font-black text-slate-300">{formatRupiah(avgPrice)}/{selectedTrendProduct.unit}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Dynamic aggregation based on date period filters
  const aggregatedProducts = useMemo(() => {
    let filteredTransactions = [...products];

    // Filter by date first
    if (timeFilterType === 'daily' && selectedDay !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => t.date === selectedDay);
    } else if (timeFilterType === 'weekly' && selectedWeek !== 'all') {
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
  }, [products, timeFilterType, selectedDay, selectedWeek, selectedMonth]);

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
      const averageUnitPrice = data.totalQty > 0 ? Math.round(data.totalSales / data.totalQty) : 0;
      return (
        <div className="bg-slate-950/95 backdrop-blur-md text-white p-4.5 rounded-2xl border border-slate-800 shadow-2xl space-y-3 max-w-sm text-xs">
          <div className="border-b border-slate-800/80 pb-2">
            <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] block mb-1">📦 Detail Produk</span>
            <p className="font-black text-slate-200 leading-snug">
              {data.name}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono">
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
            <span className="text-slate-500 font-semibold text-[10.5px] border-t border-slate-900/60 pt-1">Rerata Harga:</span>
            <span className="text-right font-black text-slate-300 text-[10.5px] border-t border-slate-900/60 pt-1">{formatRupiah(averageUnitPrice)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const BRAND_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#f43f5e', // Rose
    '#f59e0b', // Amber
    '#8b5cf6', // Violet
    '#0ea5e9', // Sky
    '#14b8a6', // Teal
    '#ec4899', // Pink
    '#f97316', // Orange
    '#a855f7', // Purple
    '#84cc16'  // Lime
  ];

  const brandPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const totalRevenue = stats?.totalRevenue || 0;
      const pct = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;
      const avgBrandPrice = data.qty > 0 ? Math.round(data.revenue / data.qty) : 0;
      return (
        <div className="bg-slate-950/95 backdrop-blur-md text-white p-4 rounded-2xl border border-slate-800 shadow-2xl space-y-2.5 font-sans text-xs min-w-[220px]">
          <div className="border-b border-slate-800/80 pb-1.5">
            <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] block mb-0.5">🏷️ Detail Merk</span>
            <p className="font-black text-slate-200 leading-snug">
              {data.name}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono">
            <span className="text-slate-400 font-bold">Terjual:</span>
            <span className="text-right font-black text-emerald-400">{formatNumberIndo(data.qty)} pcs</span>
            <span className="text-slate-400 font-bold">Omzet:</span>
            <span className="text-right font-black text-indigo-400">{formatRupiah(data.revenue)}</span>
            <span className="text-slate-400 font-bold">Dominasi:</span>
            <span className="text-right font-black text-pink-400">{pct.toFixed(1)}%</span>
            <span className="text-slate-500 font-semibold text-[10.5px] border-t border-slate-900/60 pt-1">Rerata Nilai:</span>
            <span className="text-right font-black text-slate-300 text-[10.5px] border-t border-slate-900/60 pt-1">{formatRupiah(avgBrandPrice)}/pc</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Brand Chart Data formatted for clean Donut Chart representation (Top 5 + Lain-lain)
  const brandPieChartData = useMemo(() => {
    if (!stats || !stats.brandSummary || stats.brandSummary.length === 0) return [];
    
    const summary = [...stats.brandSummary];
    if (summary.length <= 6) {
      return summary;
    }
    
    const top5 = summary.slice(0, 5);
    const others = summary.slice(5);
    const othersRevenue = others.reduce((acc, curr) => acc + curr.revenue, 0);
    const othersQty = others.reduce((acc, curr) => acc + curr.qty, 0);
    
    return [
      ...top5,
      {
        name: 'Lain-lain',
        revenue: othersRevenue,
        qty: othersQty
      }
    ];
  }, [stats]);

  const handleBrandClick = (brandName: string) => {
    if (brandName === 'Lain-lain') return;
    if (selectedBrand === brandName) {
      setSelectedBrand('all');
    } else {
      setSelectedBrand(brandName);
    }
    setCurrentPage(1);
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

  // Selected category 7-day trend chart data for popup detailed view
  const selectedCategoryChartData = useMemo(() => {
    if (!selectedCategoryDetail) return [];
    
    const last7Days = productTrendMap.last7Days;
    const K = last7Days.length;
    const qtyTrend = Array(K).fill(0);
    const salesTrend = Array(K).fill(0);

    products.forEach(p => {
      if (p.category !== selectedCategoryDetail) return;
      if (!p.date) return;
      const dayIdx = last7Days.indexOf(p.date);
      if (dayIdx !== -1) {
        qtyTrend[dayIdx] += p.totalQty;
        salesTrend[dayIdx] += p.totalSales;
      }
    });

    return last7Days.map((date, idx) => ({
      date,
      formattedDate: formatDateIndo(date),
      qty: qtyTrend[idx],
      sales: salesTrend[idx]
    }));
  }, [selectedCategoryDetail, products, productTrendMap]);

  const categoryTrendTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length && selectedCategoryDetail) {
      const data = payload[0].payload;
      const avgPrice = data.qty > 0 ? Math.round(data.sales / data.qty) : 0;
      return (
        <div className="bg-slate-950/95 backdrop-blur-md text-white p-4 rounded-2xl border border-slate-800 shadow-2xl space-y-2.5 text-xs min-w-[240px]">
          <div className="border-b border-slate-800/80 pb-1.5">
            <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] block mb-0.5">📈 Tren Kategori</span>
            <span className="font-mono text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded text-[10px]">
              {data.formattedDate}
            </span>
          </div>
          
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-400">Volume Terjual:</span>
              <span className="font-black text-indigo-400">{formatNumberIndo(data.qty)} pcs</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-400">Omzet Harian:</span>
              <span className="font-black text-emerald-400">{formatRupiah(data.sales)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-900/60 pt-1">
              <span className="font-semibold text-slate-500">Rerata Harga:</span>
              <span className="font-black text-slate-300">{formatRupiah(avgPrice)}/pc</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Products belonging to the selected category, aggregated and sorted by sales
  const selectedCategoryProducts = useMemo(() => {
    if (!selectedCategoryDetail) return [];
    return filteredAndSortedProducts
      .filter(p => p.category === selectedCategoryDetail)
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [selectedCategoryDetail, filteredAndSortedProducts]);

  // AI Growth and Trend Insight Engine
  const aiGrowthInsights = useMemo(() => {
    if (filteredAndSortedProducts.length === 0) return null;

    const last7Days = productTrendMap.last7Days;
    const K = last7Days.length;

    const productsWithGrowth = filteredAndSortedProducts.map(p => {
      let growthQty = 0;
      let trendSalesGrowth = 0;
      let startQty = 0;
      let endQty = 0;

      const trend = productTrendMap.trends[p.sku];
      if (trend && K >= 2) {
        const half = Math.floor(K / 2);
        const firstHalfQty = trend.qty.slice(0, half).reduce((a, b) => a + b, 0);
        const secondHalfQty = trend.qty.slice(half).reduce((a, b) => a + b, 0);
        
        const firstHalfSales = trend.sales.slice(0, half).reduce((a, b) => a + b, 0);
        const secondHalfSales = trend.sales.slice(half).reduce((a, b) => a + b, 0);

        growthQty = secondHalfQty - firstHalfQty;
        trendSalesGrowth = secondHalfSales - firstHalfSales;
        startQty = firstHalfQty;
        endQty = secondHalfQty;
      } else {
        growthQty = p.totalQty * 0.1;
        trendSalesGrowth = p.totalSales * 0.1;
      }

      const pctGrowth = startQty > 0 ? (growthQty / startQty) * 100 : endQty > 0 ? 100 : 0;

      return {
        ...p,
        growthQty,
        trendSalesGrowth,
        pctGrowth,
        startQty,
        endQty
      };
    });

    // 1. To Promote Candidates
    const promoteCandidates = [...productsWithGrowth]
      .filter(p => p.growthQty > 0 && p.endQty > 0)
      .sort((a, b) => b.growthQty - a.growthQty || b.endQty - a.endQty);

    const finalPromote = promoteCandidates.length > 0 
      ? promoteCandidates.slice(0, 2) 
      : [...productsWithGrowth].sort((a, b) => b.totalQty - a.totalQty).slice(0, 2);

    // 2. To Reduce Stock Candidates
    const reduceCandidates = [...productsWithGrowth]
      .filter(p => p.growthQty < 0 || (p.totalQty > 0 && p.endQty === 0))
      .sort((a, b) => a.growthQty - b.growthQty || a.endQty - b.endQty);

    const finalReduce = reduceCandidates.length > 0 
      ? reduceCandidates.slice(0, 2) 
      : [...productsWithGrowth].sort((a, b) => b.totalQty - a.totalQty).slice(0, 2);

    return {
      toPromote: finalPromote.filter(p => p.totalQty > 0),
      toReduce: finalReduce.filter(p => p.totalQty > 0)
    };
  }, [filteredAndSortedProducts, productTrendMap]);

  // Get all unique dates matching active period filters, sorted chronologically
  const comparisonDates = useMemo(() => {
    let filteredDays = [...availableDays];
    
    // Sort ascending so dates flow from past to future
    filteredDays.sort((a, b) => a.localeCompare(b));

    if (timeFilterType === 'daily' && selectedDay !== 'all') {
      filteredDays = [selectedDay];
    } else if (timeFilterType === 'weekly' && selectedWeek !== 'all') {
      filteredDays = filteredDays.filter(d => getMondayOfWeek(d) === selectedWeek);
    } else if (timeFilterType === 'monthly' && selectedMonth !== 'all') {
      filteredDays = filteredDays.filter(d => d.substring(0, 7) === selectedMonth);
    }

    return filteredDays;
  }, [availableDays, timeFilterType, selectedDay, selectedWeek, selectedMonth]);

  // Available options for product comparison (from the aggregated list)
  const comparisonProductOptions = useMemo(() => {
    return [...aggregatedProducts].sort((a, b) => b.totalSales - a.totalSales);
  }, [aggregatedProducts]);

  // Selected product A & B details
  const selectedCompProductA = useMemo(() => {
    if (!selectedCompProductASku) return null;
    return aggregatedProducts.find(p => p.sku === selectedCompProductASku) || products.find(p => p.sku === selectedCompProductASku) || null;
  }, [selectedCompProductASku, aggregatedProducts, products]);

  const selectedCompProductB = useMemo(() => {
    if (!selectedCompProductBSku) return null;
    return aggregatedProducts.find(p => p.sku === selectedCompProductBSku) || products.find(p => p.sku === selectedCompProductBSku) || null;
  }, [selectedCompProductBSku, aggregatedProducts, products]);

  // Combined daily trend data for the two selected products
  const comparisonChartData = useMemo(() => {
    if (!selectedCompProductASku || !selectedCompProductBSku) return [];

    return comparisonDates.map(date => {
      let qtyA = 0;
      let salesA = 0;
      let qtyB = 0;
      let salesB = 0;

      products.forEach(p => {
        if (p.date === date) {
          if (p.sku === selectedCompProductASku) {
            qtyA += p.totalQty;
            salesA += p.totalSales;
          } else if (p.sku === selectedCompProductBSku) {
            qtyB += p.totalQty;
            salesB += p.totalSales;
          }
        }
      });

      return {
        date,
        formattedDate: formatDateIndo(date),
        qtyA,
        salesA,
        qtyB,
        salesB
      };
    });
  }, [comparisonDates, products, selectedCompProductASku, selectedCompProductBSku]);

  const comparisonTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length && selectedCompProductA && selectedCompProductB) {
      const data = payload[0].payload;
      const isSales = compMetric === 'sales';
      const valA = isSales ? data.salesA : data.qtyA;
      const valB = isSales ? data.salesB : data.qtyB;
      
      const diffVal = valA - valB;
      const diffPct = valB > 0 ? (diffVal / valB) * 100 : 0;
      
      return (
        <div className="bg-slate-950/95 backdrop-blur-md text-white p-4 rounded-2xl border border-slate-800 shadow-2xl space-y-3 text-xs min-w-[280px]">
          <div className="border-b border-slate-800/80 pb-2">
            <span className="font-black text-slate-400 uppercase tracking-widest text-[9px] block mb-0.5">⚔️ Perbandingan Produk</span>
            <span className="font-mono text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded text-[10px]">
              {data.formattedDate}
            </span>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center gap-4 text-[11px]">
              <span className="font-bold flex items-center gap-1.5 text-indigo-400">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                [A] {selectedCompProductA.sku}:
              </span>
              <span className="font-mono font-bold text-slate-200">
                {isSales ? formatRupiah(data.salesA) : `${formatNumberIndo(data.qtyA)} ${selectedCompProductA.unit || 'unit'}`}
              </span>
            </div>

            <div className="flex justify-between items-center gap-4 text-[11px]">
              <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                [B] {selectedCompProductB.sku}:
              </span>
              <span className="font-mono font-bold text-slate-200">
                {isSales ? formatRupiah(data.salesB) : `${formatNumberIndo(data.qtyB)} ${selectedCompProductB.unit || 'unit'}`}
              </span>
            </div>
          </div>
          
          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10.5px]">
            <span className="font-bold text-slate-400">Selisih (A vs B):</span>
            <div className="font-mono font-black text-right">
              <span className={diffVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {diffVal >= 0 ? '+' : ''}{isSales ? formatRupiah(diffVal) : `${formatNumberIndo(diffVal)} unit`}
              </span>
              {valB > 0 && (
                <span className={`text-[9.5px] ml-1.5 px-1.5 py-0.5 rounded font-extrabold ${diffVal >= 0 ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/50' : 'bg-rose-950/80 text-rose-400 border border-rose-900/50'}`}>
                  {diffVal >= 0 ? '+' : ''}{diffPct.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Automatically select top 2 bestselling products as defaults
  useEffect(() => {
    if (comparisonProductOptions.length >= 2) {
      if (!selectedCompProductASku) {
        setSelectedCompProductASku(comparisonProductOptions[0].sku);
      }
      if (!selectedCompProductBSku) {
        setSelectedCompProductBSku(comparisonProductOptions[1].sku);
      }
    } else if (comparisonProductOptions.length === 1) {
      if (!selectedCompProductASku) {
        setSelectedCompProductASku(comparisonProductOptions[0].sku);
      }
    }
  }, [comparisonProductOptions, selectedCompProductASku, selectedCompProductBSku]);

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

  const downloadPDFReport = () => {
    if (!stats) return;

    // Create a new jsPDF instance (A4 size, portrait, mm)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    }) as any;

    const pageTitle = "LAPORAN ANALISA KINERJA PRODUK";
    
    // Header styling
    doc.setFillColor(30, 41, 59); // Slate-800 background for top banner
    doc.rect(0, 0, 210, 38, 'F');

    // Title text inside banner
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(pageTitle, 15, 16);

    // Subtitle / metadata inside banner
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(194, 205, 220); // light slate color
    const printDate = new Date().toLocaleString('id-ID', { 
      year: 'numeric', month: 'long', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
    doc.text(`Dicetak pada: ${printDate} WIB`, 15, 23);
    doc.text(`Sumber Data: Google Spreadsheet - Transaksi Penjualan`, 15, 28);
    doc.text(`Sistem: Analisa Produk & Dashboard Omzet`, 15, 33);

    // Active filters summary box on the right side of the header
    doc.setFillColor(51, 65, 85); // Slate-700
    doc.roundedRect(125, 6, 70, 26, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text("FILTER AKTIF:", 129, 11);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(226, 232, 240);
    
    let timeLabel = "Semua Waktu";
    if (timeFilterType === 'daily' && selectedDay !== 'all') timeLabel = `Harian: ${formatDateIndo(selectedDay)}`;
    else if (timeFilterType === 'weekly' && selectedWeek !== 'all') timeLabel = `${formatWeekIndo(selectedWeek)}`;
    else if (timeFilterType === 'monthly' && selectedMonth !== 'all') timeLabel = `${formatMonthIndo(selectedMonth)}`;
    
    doc.text(`- Rentang: ${timeLabel}`, 129, 15);
    doc.text(`- Kategori: ${selectedCategory === 'all' ? 'Semua Kategori' : selectedCategory}`, 129, 19);
    doc.text(`- Brand: ${selectedBrand === 'all' ? 'Semua Brand' : selectedBrand}`, 129, 23);
    doc.text(`- Cari SKU/Nama: ${searchQuery.trim() === '' ? 'Tidak ada' : searchQuery}`, 129, 27);

    // Line separator below header banner
    let currentY = 46;

    // Title for Metrics Section
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text("I. RINGKASAN METRIK ANALITIK (KPI)", 15, currentY);
    currentY += 5;

    // Draw grid of KPI Cards (2 rows of boxes)
    // Card dimensions
    const cardW = 58;
    const cardH = 20;
    const cardGap = 3;
    const startX = 15;

    const drawKPICard = (x: number, y: number, label: string, value: string, subtext: string, bgColor: [number, number, number]) => {
      // Background card
      doc.setFillColor(248, 250, 252); // Slate-50 background
      doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F');
      
      // Left indicator accent line
      doc.setFillColor(...bgColor);
      doc.rect(x, y, 1.5, cardH, 'F');

      // Text labels inside card
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(label.toUpperCase(), x + 4, y + 5.5);

      doc.setTextColor(15, 23, 42); // Slate-900
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(value, x + 4, y + 11.5);

      doc.setTextColor(148, 163, 184); // Slate-400
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(subtext, x + 4, y + 16.5);
    };

    // First Row KPIs
    // 1. Total Omzet
    drawKPICard(startX, currentY, "Total Omzet Penjualan", formatRupiah(stats.totalRevenue), `Dari produk terfilter`, [99, 102, 241]); // Indigo
    // 2. Qty Terjual
    drawKPICard(startX + cardW + cardGap, currentY, "Total Produk Terjual", `${formatNumberIndo(stats.totalQty)} pcs`, `Volume penjualan`, [16, 185, 129]); // Emerald
    // 3. Unique SKU
    drawKPICard(startX + (cardW + cardGap) * 2, currentY, "Jumlah SKU Terjual", `${formatNumberIndo(stats.uniqueProducts)} SKU`, `Produk unik aktif`, [14, 165, 233]); // Sky

    currentY += cardH + cardGap;

    // Second Row KPIs
    // 4. Bestselling SKU
    const bestsellerLabel = stats.bestseller ? `${stats.bestseller.sku}` : "Tidak ada";
    const bestsellerSub = stats.bestseller 
      ? `${stats.bestseller.name.substring(0, 25)}${stats.bestseller.name.length > 25 ? '...' : ''}` 
      : "Tidak ada transaksi";
    drawKPICard(startX, currentY, "Produk Terlaris (SKU)", bestsellerLabel, bestsellerSub, [244, 63, 94]); // Rose

    // 5. Kategori Utama
    const topCatName = stats.topCategory || "Tidak ada";
    const topCatSub = stats.topCategoryRevenue > 0 ? `Omzet: ${formatRupiahCompact(stats.topCategoryRevenue)}` : "Tidak ada transaksi";
    drawKPICard(startX + cardW + cardGap, currentY, "Kategori Terlaris", topCatName, topCatSub, [245, 158, 11]); // Amber

    // 6. Bestseller Omzet
    const bestsellerVal = stats.bestseller ? formatRupiah(stats.bestseller.totalSales) : "Rp 0";
    drawKPICard(startX + (cardW + cardGap) * 2, currentY, "Omzet SKU Terlaris", bestsellerVal, stats.bestseller ? `Terjual ${stats.bestseller.totalQty} pcs` : "", [139, 92, 246]); // Violet

    currentY += cardH + 10;

    // II. Brand and Category Dominance Tables side-by-side or stacked
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text("II. RINGKASAN PENJUALAN PER MERK & KATEGORI", 15, currentY);
    currentY += 5;

    // Generate brand table content
    const brandRows = stats.brandSummary.map((b, i) => {
      const pct = stats.totalRevenue > 0 ? (b.revenue / stats.totalRevenue) * 100 : 0;
      return [
        (i + 1).toString(),
        b.name,
        `${formatNumberIndo(b.qty)} pcs`,
        formatRupiah(b.revenue),
        `${pct.toFixed(1)}%`
      ];
    });

    // Generate category table content
    const categoryRows = stats.categorySummary.map((c, i) => {
      const pct = stats.totalRevenue > 0 ? (c.revenue / stats.totalRevenue) * 100 : 0;
      return [
        (i + 1).toString(),
        c.name,
        `${formatNumberIndo(c.qty)} pcs`,
        formatRupiah(c.revenue),
        `${pct.toFixed(1)}%`
      ];
    });

    // Draw the two summaries in autotable
    // First, Brand Summary Table
    autoTable(doc, {
      startY: currentY,
      margin: { left: 15, right: 110 },
      head: [['No', 'Merk / Brand', 'Qty', 'Total Omzet', 'Kontr.']],
      body: brandRows.slice(0, 10), // Show top 10 brands
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], fontSize: 7, fontStyle: 'bold', halign: 'center' }, // Indigo-600
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 32 },
        2: { cellWidth: 15, halign: 'right' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 12, halign: 'right' }
      },
      styles: { cellPadding: 1.5 }
    });

    // Next, Category Summary Table on the right side
    autoTable(doc, {
      startY: currentY,
      margin: { left: 110, right: 15 },
      head: [['No', 'Kategori', 'Qty', 'Total Omzet', 'Kontr.']],
      body: categoryRows.slice(0, 10), // Show top 10 categories
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129], fontSize: 7, fontStyle: 'bold', halign: 'center' }, // Emerald-500
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 32 },
        2: { cellWidth: 15, halign: 'right' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 12, halign: 'right' }
      },
      styles: { cellPadding: 1.5 }
    });

    // Get the bottom-most Y of both tables to continue
    currentY = Math.max(doc.lastAutoTable.finalY || currentY, 130) + 12;

    // Check if we have enough space for the third section header, else add page
    if (currentY > 240) {
      doc.addPage();
      currentY = 18;
    }

    // III. Detailed Product Performance Table
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text("III. LAPORAN DETIL PERFORMA PRODUK (SKU)", 15, currentY);
    currentY += 5;

    const productRows = filteredAndSortedProducts.map((p, i) => [
      (i + 1).toString(),
      p.sku,
      p.name,
      p.category,
      p.brand,
      `${formatNumberIndo(p.totalQty)} ${p.unit || 'PCS'}`,
      formatRupiah(p.totalSales)
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: 15, right: 15 },
      head: [['No', 'SKU', 'Nama Produk', 'Kategori', 'Brand', 'Qty Terjual', 'Omzet']],
      body: productRows,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], fontSize: 8, fontStyle: 'bold', halign: 'center' }, // Slate-800
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 25, fontStyle: 'bold' },
        2: { cellWidth: 60 },
        3: { cellWidth: 25 },
        4: { cellWidth: 22 },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 24, halign: 'right' }
      },
      styles: { cellPadding: 1.8 },
      // Footer page numbering and decoration
      didDrawPage: (data: any) => {
        // Footer text on each page
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.setFont('helvetica', 'normal');
        
        // Horizontal line separator in footer
        doc.setFillColor(241, 245, 249);
        doc.rect(15, 282, 180, 0.5, 'F');
        
        doc.text("Laporan Analisa Kinerja Produk - Otomatisasi Sistem Google Sheet & Dashboard Penjualan", 15, 287);
        doc.text(`Halaman ${data.pageNumber} dari ${doc.getNumberOfPages()}`, 180, 287);
      }
    });

    // Save PDF file
    let filterFilename = "Semua_Waktu";
    if (timeFilterType === 'daily' && selectedDay !== 'all') filterFilename = `Harian_${selectedDay}`;
    else if (timeFilterType === 'weekly' && selectedWeek !== 'all') filterFilename = `Mingguan_${selectedWeek}`;
    else if (timeFilterType === 'monthly' && selectedMonth !== 'all') filterFilename = `Bulanan_${selectedMonth}`;

    const filename = `Laporan_Performa_Produk_${filterFilename}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="space-y-6">
      
      {/* Header section with fetch option */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-800 uppercase tracking-wide leading-none">Analisa Performa Produk</h2>
              {isUsingCache ? (
                <span className="text-[9px] bg-amber-50/85 text-amber-800 border border-amber-200/50 font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-sm animate-pulse">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                  </span>
                  ⚡ Cache Lokal
                </span>
              ) : (
                <span className="text-[9px] bg-emerald-50/85 text-emerald-800 border border-emerald-200/50 font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  🟢 Live Sheet
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-bold mt-1.5">Menganalisa data omzet dan volume penjualan per SKU secara detail</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={downloadPDFReport}
            disabled={isLoading || !stats}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-sm disabled:pointer-events-none"
          >
            <Download className="w-3.5 h-3.5" />
            Unduh Laporan PDF
          </button>

          <button
            onClick={() => fetchProductData(true)}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-200/50 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Sinkronkan Data Produk
          </button>
        </div>
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
            onClick={() => fetchProductData(true)}
            className="text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl shadow-sm transition-all"
          >
            Coba Sinkronkan Ulang
          </button>
        </div>
      )}

      {!isLoading && !isError && (
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
                      setSelectedDay('all');
                      setSelectedWeek('all');
                      setSelectedMonth('all');
                    }}
                    className="px-3 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-bold text-slate-600 min-w-[140px]"
                  >
                    <option value="all">Semua Waktu</option>
                    <option value="daily">Filter Harian</option>
                    <option value="weekly">Filter Mingguan</option>
                    <option value="monthly">Filter Bulanan</option>
                  </select>
                </div>

                {/* Conditional Sub-filters for Daily / Weekly / Monthly */}
                {timeFilterType === 'daily' && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Pilih Hari (Kolom 2):</span>
                    <select
                      value={selectedDay}
                      onChange={e => setSelectedDay(e.target.value)}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200 text-indigo-700 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-xs font-bold min-w-[160px]"
                    >
                      <option value="all">Semua Hari ({availableDays.length})</option>
                      {availableDays.map(dy => (
                        <option key={dy} value={dy}>{formatDateIndo(dy)}</option>
                      ))}
                    </select>
                  </div>
                )}

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
              <span>Menampilkan total <strong>{formatNumberIndo(stats ? stats.uniqueProducts : 0)}</strong> produk unik dengan akumulasi omzet <strong>{formatRupiah(stats ? stats.totalRevenue : 0)}</strong></span>
              {selectedCategory !== 'all' && (
                <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">Kategori: {selectedCategory}</span>
              )}
              {selectedBrand !== 'all' && (
                <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100">Merk: {selectedBrand}</span>
              )}
              {timeFilterType === 'daily' && selectedDay !== 'all' && (
                <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-100">{formatDateIndo(selectedDay)}</span>
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
                    setSelectedDay('all');
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

          {!stats ? (
            <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm space-y-5 flex flex-col items-center justify-center min-h-[350px]">
              <div className="p-4 bg-indigo-50 border border-indigo-100 text-indigo-500 rounded-full">
                <AlertCircle className="w-10 h-10 animate-bounce" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Tidak Ada Data Penjualan</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Tidak ditemukan transaksi penjualan untuk filter atau periode yang sedang aktif (Bulan Berjalan: {timeFilterType === 'monthly' && selectedMonth !== 'all' ? formatMonthIndo(selectedMonth) : 'N/A'}). 
                  Silakan ganti rentang waktu atau kategori untuk menganalisa produk.
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedBrand('all');
                  setTimeFilterType('all');
                  setSelectedDay('all');
                  setSelectedWeek('all');
                  setSelectedMonth('all');
                  setSearchQuery('');
                }}
                className="text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                Tampilkan Semua Waktu &amp; Produk
              </button>
            </div>
          ) : (
            <>

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
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Grafik perbandingan 10 produk terlaris. Klik pada batang grafik untuk melihat rincian tren harian dan performa produk.</p>
                </div>
              </div>
              <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full uppercase tracking-wider font-black">Top 10 Omzet (Klik Bar)</span>
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
                      cursor="pointer"
                    >
                      {top10ChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={index === 0 ? 'url(#productBarGrad)' : index === 1 ? '#6366f1' : index === 2 ? '#818cf8' : '#c7d2fe'} 
                          onClick={() => setSelectedTrendProductSku(entry.sku)}
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
                    <div 
                      key={cat.name} 
                      className="space-y-1.5 cursor-pointer hover:bg-slate-50 p-2 -mx-2 rounded-2xl transition-all border border-transparent hover:border-slate-100"
                      onClick={() => setSelectedCategoryDetail(cat.name)}
                      title={`Klik untuk melihat detail rincian & tren kategori ${cat.name}`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-4 h-4 flex items-center justify-center text-[10px] font-extrabold bg-indigo-50 text-indigo-600 rounded-md shrink-0 border border-indigo-100/60">
                            {idx + 1}
                          </span>
                          <span className="truncate text-slate-800 font-extrabold">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-right font-mono">
                          <span className="text-slate-400 text-[10px]">{formatNumberIndo(cat.qty)} pcs</span>
                          <span className="text-indigo-600 font-black">{formatRupiah(cat.revenue)}</span>
                          <span className="text-[10px] text-indigo-500 font-black min-w-[36px] bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/30">{pct.toFixed(1)}%</span>
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
                {selectedBrand !== 'all' ? (
                  <button 
                    onClick={() => setSelectedBrand('all')}
                    className="text-[9px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Batal Filter
                  </button>
                ) : (
                  <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">Dominasi Brand (Donut)</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                {/* Donut Chart */}
                <div className="md:col-span-5 h-[230px] flex items-center justify-center relative">
                  {brandPieChartData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={brandPieChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="revenue"
                          >
                            {brandPieChartData.map((entry, index) => {
                              const isSelected = selectedBrand === entry.name;
                              const hasSelection = selectedBrand !== 'all';
                              const baseColor = BRAND_COLORS[index % BRAND_COLORS.length];
                              return (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={baseColor} 
                                  stroke={isSelected ? '#1e293b' : '#fff'}
                                  strokeWidth={isSelected ? 3 : 1}
                                  opacity={hasSelection ? (isSelected ? 1 : 0.4) : 1}
                                  onClick={() => handleBrandClick(entry.name)}
                                  className="cursor-pointer outline-none transition-all duration-200"
                                />
                              );
                            })}
                          </Pie>
                          <Tooltip content={brandPieTooltip} />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Absolute Center Text */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
                        {selectedBrand !== 'all' ? (
                          <>
                            <span className="text-[8px] uppercase font-black tracking-wider text-indigo-500">Filter Aktif</span>
                            <span className="text-[11px] font-black text-slate-800 mt-0.5 truncate max-w-[100px]" title={selectedBrand}>
                              {selectedBrand}
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold mt-0.5">Klik untuk reset</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Total Brand</span>
                            <span className="text-xs font-black text-slate-700 mt-0.5">{stats.brandSummary.length} Merk</span>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-400 text-xs italic font-bold">Tidak ada data</span>
                  )}
                </div>

                {/* Brand List */}
                <div className="md:col-span-7 space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {stats.brandSummary.map((br, idx) => {
                    const pct = stats.totalRevenue > 0 ? (br.revenue / stats.totalRevenue) * 100 : 0;
                    const color = BRAND_COLORS[idx % BRAND_COLORS.length] || '#94a3b8';
                    const isSelected = selectedBrand === br.name;
                    const hasSelection = selectedBrand !== 'all';
                    return (
                      <div 
                        key={br.name} 
                        onClick={() => handleBrandClick(br.name)}
                        className={`space-y-1 p-2 rounded-xl transition-all cursor-pointer border ${
                          isSelected 
                            ? 'bg-indigo-50/70 border-indigo-200 shadow-sm' 
                            : 'border-transparent hover:bg-slate-50'
                        } ${hasSelection && !isSelected ? 'opacity-40 hover:opacity-75' : ''}`}
                      >
                        <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold text-slate-700">
                          <div className="flex items-center gap-1.5 truncate">
                            <span 
                              className="w-4 h-4 flex items-center justify-center text-[9px] font-extrabold text-white rounded shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {idx + 1}
                            </span>
                            <span className="truncate" title={br.name}>{br.name}</span>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0 text-right font-mono">
                            <span className="text-slate-400 text-[10px]">{formatNumberIndo(br.qty)} pcs</span>
                            <span className="text-slate-600 font-extrabold">{formatRupiah(br.revenue)}</span>
                            <span className="text-[10px] text-indigo-600 font-black min-w-[32px]">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${pct}%`,
                              backgroundColor: color
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* PANEL PERBANDINGAN PRODUK SECARA BERDAMPINGAN */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl">
                  <ArrowUpDown className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Perbandingan Produk Secara Berdampingan</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Bandingkan tren volume penjualan dan omzet antara dua produk dalam periode waktu yang sama</p>
                </div>
              </div>
              
              {/* Metric Select Toggle */}
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/50 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCompMetric('qty')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    compMetric === 'qty'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Volume (Qty)
                </button>
                <button
                  type="button"
                  onClick={() => setCompMetric('sales')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    compMetric === 'sales'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Omzet (IDR)
                </button>
              </div>
            </div>

            {/* Selection Dropdowns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              {/* Product A Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  Produk Pertama (A):
                </span>
                <select
                  value={selectedCompProductASku}
                  onChange={e => setSelectedCompProductASku(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-bold text-slate-700"
                >
                  <option value="" disabled>Pilih Produk A</option>
                  {comparisonProductOptions.map(prod => (
                    <option key={`comp-a-${prod.sku}`} value={prod.sku}>
                      [{prod.sku}] {prod.name} ({formatNumberIndo(prod.totalQty)} pcs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Product B Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase text-emerald-600 tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Produk Kedua (B):
                </span>
                <select
                  value={selectedCompProductBSku}
                  onChange={e => setSelectedCompProductBSku(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs font-bold text-slate-700"
                >
                  <option value="" disabled>Pilih Produk B</option>
                  {comparisonProductOptions.map(prod => (
                    <option key={`comp-b-${prod.sku}`} value={prod.sku}>
                      [{prod.sku}] {prod.name} ({formatNumberIndo(prod.totalQty)} pcs)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comparison Cards Side-by-Side & Combined Chart */}
            {selectedCompProductA && selectedCompProductB ? (
              <div className="space-y-6 animate-fade-in">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Card Product A */}
                  <div className="bg-gradient-to-br from-indigo-50/45 to-white border border-indigo-100 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded uppercase font-mono">
                          Produk A - {selectedCompProductA.sku}
                        </span>
                        <h4 className="text-xs font-black text-slate-800 mt-2 line-clamp-2 min-h-[2rem]">
                          {selectedCompProductA.name}
                        </h4>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold block">Brand</span>
                        <span className="text-xs font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded mt-0.5 inline-block">{selectedCompProductA.brand}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-indigo-100/40">
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Volume Jual</span>
                        <p className="text-xs font-black text-slate-800 mt-1 font-mono">
                          {formatNumberIndo(selectedCompProductA.totalQty)} <span className="text-[9px] text-slate-400 font-normal">{selectedCompProductA.unit}</span>
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Total Omzet</span>
                        <p className="text-xs font-black text-indigo-600 mt-1 font-mono truncate">
                          {formatRupiah(selectedCompProductA.totalSales)}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Harga Rerata</span>
                        <p className="text-xs font-black text-slate-700 mt-1 font-mono truncate">
                          {formatRupiah(selectedCompProductA.totalQty > 0 ? selectedCompProductA.totalSales / selectedCompProductA.totalQty : 0)}
                        </p>
                      </div>
                    </div>

                    {/* Contribution Share Badge */}
                    {stats && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold pt-1.5 border-t border-indigo-100/30">
                        <span>Kontribusi Toko:</span>
                        <span className="text-indigo-600 font-black">
                          {((selectedCompProductA.totalSales / (stats.totalRevenue || 1)) * 100).toFixed(1)}% Omzet
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Product B */}
                  <div className="bg-gradient-to-br from-emerald-50/45 to-white border border-emerald-100 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9px] bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded uppercase font-mono">
                          Produk B - {selectedCompProductB.sku}
                        </span>
                        <h4 className="text-xs font-black text-slate-800 mt-2 line-clamp-2 min-h-[2rem]">
                          {selectedCompProductB.name}
                        </h4>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold block">Brand</span>
                        <span className="text-xs font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded mt-0.5 inline-block">{selectedCompProductB.brand}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-emerald-100/40">
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Volume Jual</span>
                        <p className="text-xs font-black text-slate-800 mt-1 font-mono">
                          {formatNumberIndo(selectedCompProductB.totalQty)} <span className="text-[9px] text-slate-400 font-normal">{selectedCompProductB.unit}</span>
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Total Omzet</span>
                        <p className="text-xs font-black text-emerald-600 mt-1 font-mono truncate">
                          {formatRupiah(selectedCompProductB.totalSales)}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Harga Rerata</span>
                        <p className="text-xs font-black text-slate-700 mt-1 font-mono truncate">
                          {formatRupiah(selectedCompProductB.totalQty > 0 ? selectedCompProductB.totalSales / selectedCompProductB.totalQty : 0)}
                        </p>
                      </div>
                    </div>

                    {/* Contribution Share Badge */}
                    {stats && (
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold pt-1.5 border-t border-emerald-100/30">
                        <span>Kontribusi Toko:</span>
                        <span className="text-emerald-600 font-black">
                          {((selectedCompProductB.totalSales / (stats.totalRevenue || 1)) * 100).toFixed(1)}% Omzet
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Combined Trend Chart */}
                <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-indigo-500" />
                      Visualisasi Tren Perbandingan ({compMetric === 'qty' ? 'Volume Unit' : 'Nilai Omzet'})
                    </h4>
                    <span className="text-[8px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded font-black uppercase">
                      Rentang Waktu Sama
                    </span>
                  </div>

                  <div className="h-72 w-full pt-1">
                    {comparisonChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={comparisonChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis 
                            dataKey="formattedDate" 
                            tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }} 
                            axisLine={false} 
                            tickLine={false} 
                          />
                          <YAxis 
                            tick={{ fontSize: 9, fill: '#475569', fontWeight: 'bold' }} 
                            axisLine={false} 
                            tickLine={false} 
                            tickFormatter={(v) => compMetric === 'sales' ? formatRupiahCompact(v) : formatNumberIndo(v)}
                          />
                          <Tooltip content={comparisonTooltip} />
                          <Legend 
                            verticalAlign="top" 
                            height={36} 
                            iconType="circle" 
                            wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} 
                          />
                          <Line 
                            type="monotone" 
                            dataKey={compMetric === 'qty' ? 'qtyA' : 'salesA'} 
                            name={`[A] ${selectedCompProductA.name.substring(0, 20)}...`} 
                            stroke="#6366f1" 
                            strokeWidth={3}
                            activeDot={{ r: 6 }} 
                            dot={{ strokeWidth: 1 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey={compMetric === 'qty' ? 'qtyB' : 'salesB'} 
                            name={`[B] ${selectedCompProductB.name.substring(0, 20)}...`} 
                            stroke="#10b981" 
                            strokeWidth={3}
                            activeDot={{ r: 6 }} 
                            dot={{ strokeWidth: 1 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 italic text-xs font-bold">
                        Pilih dua produk di atas untuk memuat grafik tren performa.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 font-bold text-xs italic">
                Pilih dua produk di atas untuk memulai analisa perbandingan.
              </div>
            )}
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

          {/* AI INSIGHT CARD */}
          {aiGrowthInsights && (aiGrowthInsights.toPromote.length > 0 || aiGrowthInsights.toReduce.length > 0) && (
            <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-indigo-50/30 border border-indigo-100 rounded-3xl p-5 md:p-6 shadow-sm space-y-4 no-print animate-fade-in">
              <div className="flex items-center justify-between border-b border-indigo-100/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1.5">
                      Saran Pintar Penjualan <span className="text-[9px] bg-indigo-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase tracking-widest font-sans">AI Insight</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">Analisis pertumbuhan volume penjualan 7 hari terakhir untuk optimasi stok & promosi</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. REKOMENDASI PROMOSI */}
                {aiGrowthInsights.toPromote.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-xs">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      <span>REKOMENDASI PROMOSI (TREN NAIK)</span>
                    </div>
                    <div className="space-y-2">
                      {aiGrowthInsights.toPromote.map((prod, idx) => {
                        const growthLabel = prod.growthQty > 0 ? `+${prod.growthQty}` : prod.growthQty;
                        const pctLabel = prod.pctGrowth > 0 ? `(+${prod.pctGrowth.toFixed(0)}%)` : '';
                        return (
                          <div key={prod.sku} className="bg-white/85 border border-slate-200/60 p-3 rounded-2xl shadow-sm flex items-start gap-3 hover:border-indigo-200 transition-all">
                            <div className="p-2 bg-emerald-50 border border-emerald-100/60 text-emerald-600 rounded-xl font-black text-xs font-mono shrink-0">
                              #{idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-1.5 py-0.5 rounded border border-slate-200/40">
                                  {prod.sku}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {prod.brand}
                                </span>
                              </div>
                              <h5 className="text-xs font-black text-slate-800 mt-1 truncate">
                                {prod.name}
                              </h5>
                              <p className="text-[10px] text-slate-500 font-bold mt-1.5 flex flex-wrap items-center gap-x-2">
                                <span>Total Terjual: <strong className="text-slate-700">{formatNumberIndo(prod.totalQty)} {prod.unit}</strong></span>
                                <span className="text-slate-300">•</span>
                                <span className="text-emerald-600 font-black">
                                  Tren: {growthLabel} {prod.unit} {pctLabel}
                                </span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-indigo-950 bg-indigo-50/50 border border-indigo-100/30 p-2.5 rounded-xl font-bold leading-relaxed flex items-start gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <span><strong>Saran Tindakan:</strong> Produk di atas memiliki pertumbuhan volume transaksi yang kuat. Tingkatkan anggaran iklan, buat penawaran bundle eksklusif, atau letakkan produk ini di halaman depan / media sosial untuk mendongkrak omzet lebih lanjut.</span>
                    </p>
                  </div>
                )}

                {/* 2. REKOMENDASI EVALUASI STOK */}
                {aiGrowthInsights.toReduce.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-rose-700 font-extrabold text-xs">
                      <TrendingDown className="w-4 h-4 text-rose-500" />
                      <span>REKOMENDASI EVALUASI STOK (TREN TURUN)</span>
                    </div>
                    <div className="space-y-2">
                      {aiGrowthInsights.toReduce.map((prod, idx) => {
                        const growthLabel = prod.growthQty;
                        const pctLabel = prod.pctGrowth !== 0 ? `(${prod.pctGrowth.toFixed(0)}%)` : '';
                        return (
                          <div key={prod.sku} className="bg-white/85 border border-slate-200/60 p-3 rounded-2xl shadow-sm flex items-start gap-3 hover:border-rose-200 transition-all">
                            <div className="p-2 bg-rose-50 border border-rose-100/60 text-rose-600 rounded-xl font-black text-xs font-mono shrink-0">
                              #{idx + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-1.5 py-0.5 rounded border border-slate-200/40">
                                  {prod.sku}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {prod.brand}
                                </span>
                              </div>
                              <h5 className="text-xs font-black text-slate-800 mt-1 truncate">
                                {prod.name}
                              </h5>
                              <p className="text-[10px] text-slate-500 font-bold mt-1.5 flex flex-wrap items-center gap-x-2">
                                <span>Total Terjual: <strong className="text-slate-700">{formatNumberIndo(prod.totalQty)} {prod.unit}</strong></span>
                                <span className="text-slate-300">•</span>
                                <span className="text-rose-600 font-black">
                                  Tren: {growthLabel} {prod.unit} {pctLabel}
                                </span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-rose-950 bg-rose-50/30 border border-rose-100/30 p-2.5 rounded-xl font-bold leading-relaxed flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span><strong>Saran Tindakan:</strong> Penjualan produk ini mengalami penurunan atau stagnasi dalam beberapa hari terakhir. Pertimbangkan untuk mengurangi kuantitas restok berikutnya, berikan promosi cuci gudang (clearance sale), atau bundle sebagai bonus produk terlaris.</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

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
                    <th className="py-3 px-4 text-center w-28">Tren 7 Hari</th>
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
                          <td 
                            className="py-3.5 px-4 cursor-pointer hover:bg-indigo-50/40 transition-colors group/trend"
                            onClick={() => setSelectedTrendProductSku(p.sku)}
                            title="Klik untuk melihat detail grafik tren 7 hari"
                          >
                            <div className="flex flex-col justify-center items-center gap-0.5">
                              <TrendMiniBarChart 
                                data={productTrendMap.trends[p.sku]?.qty || Array(productTrendMap.last7Days.length).fill(0)} 
                                dates={productTrendMap.last7Days} 
                              />
                              <span className="text-[8px] font-black uppercase text-indigo-500 opacity-0 group-hover/trend:opacity-100 transition-opacity leading-none mt-1">
                                Klik Detail
                              </span>
                            </div>
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
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-bold">
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
        </>
      )}

      {/* DETAILED 7-DAY TREND POPUP MODAL */}
      {selectedTrendProductSku && selectedTrendProduct && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in no-print"
          onClick={() => setSelectedTrendProductSku(null)}
        >
          <div 
            className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-indigo-50 border border-indigo-100/60 text-indigo-600 rounded-2xl shrink-0">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-slate-800 leading-tight">
                      {selectedTrendProduct.name}
                    </h3>
                    <span className="text-[10px] bg-slate-100 text-slate-500 font-extrabold px-2 py-0.5 rounded-md font-mono border border-slate-200/40">
                      {selectedTrendProduct.sku}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-bold">
                    <span>Brand: <strong className="text-slate-600">{selectedTrendProduct.brand}</strong></span>
                    <span className="text-slate-200">•</span>
                    <span>Kategori: <strong className="text-slate-600">{selectedTrendProduct.category}</strong></span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTrendProductSku(null)}
                className="p-2 hover:bg-slate-200/60 rounded-xl transition-all text-slate-400 hover:text-slate-800 cursor-pointer border border-transparent hover:border-slate-200/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-indigo-50/40 border border-indigo-100 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Total Terjual (7 Hari)</span>
                  <p className="text-lg font-black text-indigo-950 mt-1 font-mono">
                    {formatNumberIndo(selectedProductChartData.reduce((sum, d) => sum + d.qty, 0))} <span className="text-xs font-bold text-indigo-500">{selectedTrendProduct.unit}</span>
                  </p>
                </div>
                <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Total Omzet (7 Hari)</span>
                  <p className="text-lg font-black text-emerald-950 mt-1 font-mono">
                    {formatRupiah(selectedProductChartData.reduce((sum, d) => sum + d.sales, 0))}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Rerata Harga Jual</span>
                  <p className="text-lg font-black text-slate-800 mt-1 font-mono">
                    {(() => {
                      const totalQty = selectedProductChartData.reduce((sum, d) => sum + d.qty, 0);
                      const totalSales = selectedProductChartData.reduce((sum, d) => sum + d.sales, 0);
                      return formatRupiah(totalQty > 0 ? totalSales / totalQty : 0);
                    })()}
                  </p>
                </div>
              </div>

              {/* Chart Visualizer */}
              <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                    Grafik Tren Volume & Omzet (7 Hari Terakhir)
                  </h4>
                  <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Double Axis Chart
                  </span>
                </div>
                
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedProductChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="formattedDate" 
                        tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }} 
                        axisLine={false} 
                        tickLine={false} 
                      />
                      <YAxis 
                        yAxisId="left" 
                        tick={{ fontSize: 9, fill: '#6366f1', fontWeight: 'bold' }} 
                        axisLine={false} 
                        tickLine={false}
                        label={{ 
                          value: `Volume (${selectedTrendProduct.unit})`, 
                          angle: -90, 
                          position: 'insideLeft', 
                          style: { fontSize: 9, fill: '#6366f1', fontWeight: 'bold', textAnchor: 'middle' },
                          offset: 0
                        }} 
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        tick={{ fontSize: 9, fill: '#10b981', fontWeight: 'bold' }} 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(v) => formatRupiahCompact(v)}
                        label={{ 
                          value: 'Omzet (IDR)', 
                          angle: 90, 
                          position: 'insideRight', 
                          style: { fontSize: 9, fill: '#10b981', fontWeight: 'bold', textAnchor: 'middle' },
                          offset: 10
                        }} 
                      />
                      <Tooltip content={productTrendTooltip} />
                      <Legend 
                        verticalAlign="top" 
                        height={36} 
                        iconType="circle" 
                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} 
                      />
                      <Bar yAxisId="left" dataKey="qty" name="Volume Terjual" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar yAxisId="right" dataKey="sales" name="Omzet Penjualan" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabular Breakdown */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  Rincian Data Harian
                </h4>
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="py-2.5 px-4">Hari & Tanggal</th>
                        <th className="py-2.5 px-4 text-center">Volume</th>
                        <th className="py-2.5 px-4 text-right">Total Omzet</th>
                        <th className="py-2.5 px-4 text-right">Rerata Harga</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProductChartData.map((item, idx) => {
                        const price = item.qty > 0 ? item.sales / item.qty : 0;
                        return (
                          <tr key={idx} className="border-b border-slate-100/60 last:border-0 hover:bg-slate-50/40 text-xs text-slate-600 font-bold">
                            <td className="py-2.5 px-4 text-slate-800">
                              {item.formattedDate}
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-900 font-mono">
                              {item.qty} {selectedTrendProduct.unit}
                            </td>
                            <td className="py-2.5 px-4 text-right text-emerald-600 font-mono">
                              {formatRupiah(item.sales)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-400 font-mono">
                              {formatRupiah(price)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedTrendProductSku(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-900 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm hover:shadow"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED CATEGORY POPUP MODAL */}
      {selectedCategoryDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in no-print"
          onClick={() => setSelectedCategoryDetail(null)}
        >
          <div 
            className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-indigo-50 border border-indigo-100/60 text-indigo-600 rounded-2xl shrink-0">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800 leading-tight">
                    Kategori: {selectedCategoryDetail}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    Rincian data performa penjualan dan kontribusi produk dalam kategori ini
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCategoryDetail(null)}
                className="p-2 hover:bg-slate-200/60 rounded-xl transition-all text-slate-400 hover:text-slate-800 cursor-pointer border border-transparent hover:border-slate-200/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-indigo-50/40 border border-indigo-100 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Total Terjual (Periode)</span>
                  <p className="text-lg font-black text-indigo-950 mt-1 font-mono">
                    {formatNumberIndo(selectedCategoryProducts.reduce((sum, p) => sum + p.totalQty, 0))} <span className="text-xs font-bold text-indigo-500">pcs</span>
                  </p>
                </div>
                <div className="bg-emerald-50/40 border border-emerald-100 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Total Omzet (Periode)</span>
                  <p className="text-lg font-black text-emerald-950 mt-1 font-mono">
                    {formatRupiah(selectedCategoryProducts.reduce((sum, p) => sum + p.totalSales, 0))}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Jumlah Produk Aktif</span>
                  <p className="text-lg font-black text-slate-800 mt-1 font-mono">
                    {selectedCategoryProducts.length} <span className="text-xs font-bold text-slate-500">Item</span>
                  </p>
                </div>
              </div>

              {/* Chart Visualizer */}
              <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                    Grafik Tren Volume & Omzet Kategori (7 Hari Terakhir)
                  </h4>
                  <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Kombinasi Kategori
                  </span>
                </div>
                
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedCategoryChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="formattedDate" 
                        tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }} 
                        axisLine={false} 
                        tickLine={false} 
                      />
                      <YAxis 
                        yAxisId="left" 
                        tick={{ fontSize: 9, fill: '#6366f1', fontWeight: 'bold' }} 
                        axisLine={false} 
                        tickLine={false}
                        label={{ 
                          value: 'Volume (pcs)', 
                          angle: -90, 
                          position: 'insideLeft', 
                          style: { fontSize: 9, fill: '#6366f1', fontWeight: 'bold', textAnchor: 'middle' },
                          offset: 0
                        }} 
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        tick={{ fontSize: 9, fill: '#10b981', fontWeight: 'bold' }} 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(v) => formatRupiahCompact(v)}
                        label={{ 
                          value: 'Omzet (IDR)', 
                          angle: 90, 
                          position: 'insideRight', 
                          style: { fontSize: 9, fill: '#10b981', fontWeight: 'bold', textAnchor: 'middle' },
                          offset: 10
                        }} 
                      />
                      <Tooltip content={categoryTrendTooltip} />
                      <Legend 
                        verticalAlign="top" 
                        height={36} 
                        iconType="circle" 
                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} 
                      />
                      <Bar yAxisId="left" dataKey="qty" name="Volume Terjual" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar yAxisId="right" dataKey="sales" name="Omzet Penjualan" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Products List Breakdown */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  Daftar Kontribusi Produk dalam Kategori (Periode Ini)
                </h4>
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="py-2.5 px-4">Nama Produk</th>
                        <th className="py-2.5 px-4 text-center">Brand</th>
                        <th className="py-2.5 px-4 text-center">Volume</th>
                        <th className="py-2.5 px-4 text-right">Omzet Penjualan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCategoryProducts.slice(0, 15).map((prod) => {
                        return (
                          <tr 
                            key={prod.sku} 
                            onClick={() => {
                              setSelectedTrendProductSku(prod.sku);
                            }}
                            className="border-b border-slate-100/60 last:border-0 hover:bg-slate-50/70 text-xs text-slate-600 font-bold cursor-pointer transition-all"
                            title="Klik untuk melihat rincian grafik tren harian produk ini"
                          >
                            <td className="py-2.5 px-4">
                              <div className="flex flex-col">
                                <span className="text-slate-800 font-extrabold truncate max-w-[250px]">{prod.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">{prod.sku}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-500">
                              {prod.brand}
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-900 font-mono">
                              {formatNumberIndo(prod.totalQty)} {prod.unit}
                            </td>
                            <td className="py-2.5 px-4 text-right text-indigo-600 font-mono font-black">
                              {formatRupiah(prod.totalSales)}
                            </td>
                          </tr>
                        );
                      })}
                      {selectedCategoryProducts.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 font-bold italic">
                            Tidak ada data produk.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {selectedCategoryProducts.length > 15 && (
                    <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center text-[10px] text-slate-400 font-bold">
                      Menampilkan 15 produk teratas dari total {selectedCategoryProducts.length} produk.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedCategoryDetail(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-900 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm hover:shadow"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
