import React, { useState, useMemo } from 'react';
import { DailySales, MarketingEvent, EVENT_TYPES } from '../types';
import { getMonthDays, formatRupiahCompact } from '../utils';
import { 
  ChevronLeft, ChevronRight, Calendar as LucideCalendar, 
  Tag, Video, Megaphone, Check, PlusCircle
} from 'lucide-react';

interface SalesCalendarProps {
  salesData: DailySales[];
  events: MarketingEvent[];
  onSelectDate: (dateStr: string) => void;
}

export default function SalesCalendar({ salesData, events, onSelectDate }: SalesCalendarProps) {
  // The dataset is primarily in Jan 2026 - Jun 2026. Let's initialize to Jan 2026!
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(0); // 0 = January

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const gridDays = useMemo(() => {
    return getMonthDays(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  // Index sales data by YYYY-MM-DD for O(1) lookups
  const salesMap = useMemo(() => {
    const map: { [key: string]: DailySales } = {};
    salesData.forEach(day => {
      map[day.date] = day;
    });
    return map;
  }, [salesData]);

  // Index events by YYYY-MM-DD
  const eventsMap = useMemo(() => {
    const map: { [key: string]: MarketingEvent[] } = {};
    events.forEach(event => {
      if (!map[event.date]) {
        map[event.date] = [];
      }
      map[event.date].push(event);
    });
    return map;
  }, [events]);

  // Calculate average daily sales in the dataset to color code cells
  const averageSales = useMemo(() => {
    if (salesData.length === 0) return 0;
    const total = salesData.reduce((sum, d) => sum + d.totalAll, 0);
    return total / salesData.length;
  }, [salesData]);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <LucideCalendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 leading-none">Kalender Kinerja & Event</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Korelasi langsung omzet penjualan dengan agenda promosi</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
            title="Bulan Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-xs font-black text-slate-800 uppercase tracking-widest min-w-[130px] text-center">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
            title="Bulan Berikutnya"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Weekday Labels (Indonesian style, starting with Senin) */}
      <div className="grid grid-cols-7 gap-2.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
        <div>Minggu</div>
        <div>Senin</div>
        <div>Selasa</div>
        <div>Rabu</div>
        <div>Kamis</div>
        <div>Jumat</div>
        <div>Sabtu</div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-2.5">
        {gridDays.map((dateObj, idx) => {
          const isCurrentMonth = dateObj.getMonth() === currentMonth;
          
          // ISO Date format: YYYY-MM-DD using local numbers
          const yearStr = dateObj.getFullYear();
          const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
          const dayStr = String(dateObj.getDate()).padStart(2, '0');
          const dateString = `${yearStr}-${monthStr}-${dayStr}`;

          const daySales = salesMap[dateString];
          const dayEvents = eventsMap[dateString] || [];

          // Color classification based on sales compared to average
          let salesBg = 'hover:bg-slate-50 border-slate-100';
          let textTheme = 'text-slate-800';
          
          if (!isCurrentMonth) {
            salesBg = 'opacity-30 bg-slate-50/50 border-slate-50 pointer-events-none';
            textTheme = 'text-slate-400';
          } else if (daySales && daySales.totalAll > 0) {
            const ratio = daySales.totalAll / averageSales;
            if (ratio >= 1.5) {
              salesBg = 'bg-emerald-50/90 hover:bg-emerald-100 border-emerald-100/85'; // High sales
            } else if (ratio >= 0.7) {
              salesBg = 'bg-indigo-50/70 hover:bg-indigo-100/80 border-indigo-100/70'; // Normal/Average sales
            } else {
              salesBg = 'bg-rose-50/50 hover:bg-rose-100/70 border-rose-100/50'; // Low sales
            }
          }

          return (
            <div
              key={idx}
              onClick={() => isCurrentMonth && onSelectDate(dateString)}
              className={`min-h-[85px] p-2 border rounded-2xl flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-sm ${salesBg}`}
            >
              {/* Day Number and Tiny Event indicator */}
              <div className="flex justify-between items-start">
                <span className={`text-xs font-black ${textTheme}`}>{dateObj.getDate()}</span>
                
                {/* Event Markers Count Badge */}
                {isCurrentMonth && dayEvents.length > 0 && (
                  <div className="flex gap-0.5">
                    {dayEvents.map(ev => {
                      const foundType = EVENT_TYPES.find(t => t.id === ev.type);
                      return (
                        <span 
                          key={ev.id} 
                          className={`w-2 h-2 rounded-full ${foundType?.color || 'bg-slate-400'}`}
                          title={ev.title}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sales Figure compact */}
              {isCurrentMonth && (
                <div className="mt-auto space-y-1">
                  {daySales && daySales.totalAll > 0 ? (
                    <div>
                      <div className="text-[10px] font-black text-slate-800 tracking-tight leading-none">
                        {formatRupiahCompact(daySales.totalAll)}
                      </div>
                      <div className="text-[8px] font-bold text-slate-400 mt-0.5 leading-none">
                        {daySales.txAll} Order
                      </div>
                    </div>
                  ) : isCurrentMonth ? (
                    <div className="text-[8px] font-bold text-slate-300 italic">
                      Tanpa Transaksi
                    </div>
                  ) : null}
                  
                  {/* Event labels inside cells if space permits */}
                  {dayEvents.length > 0 && (
                    <div className="hidden sm:block overflow-hidden text-ellipsis whitespace-nowrap text-[7px] font-black uppercase tracking-wider text-slate-500 bg-white/80 border border-slate-100 px-1 rounded">
                      📢 {dayEvents[0].title}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend Information */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
        <div className="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-emerald-100 border border-emerald-200 rounded-md" />
            Omzet Tinggi (&ge; 150%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-indigo-50 border border-indigo-100 rounded-md" />
            Normal (70% - 149%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-rose-50 border border-rose-100 rounded-md" />
            Omzet Rendah (&lt; 70%)
          </span>
        </div>

        <div className="text-[10px] text-slate-400 font-bold">
          💡 Klik tanggal mana saja untuk detail penjualan harian dan menambahkan catatan kegiatan (event).
        </div>
      </div>
    </div>
  );
}
