import React, { useState } from 'react';
import { DailySales, MarketingEvent, EVENT_TYPES } from '../types';
import { formatRupiah, formatNumberIndo, formatDateIndo } from '../utils';
import { 
  X, Tag, DollarSign, PlusCircle, Trash2, Calendar, 
  ShoppingBag, Sparkles, AlertCircle, BookmarkPlus
} from 'lucide-react';

interface EventModalProps {
  dateStr: string;
  daySales: DailySales | undefined;
  dayEvents: MarketingEvent[];
  onClose: () => void;
  onAddEvent: (event: Omit<MarketingEvent, 'id'>) => void;
  onDeleteEvent: (id: string) => void;
}

export default function EventModal({ 
  dateStr, 
  daySales, 
  dayEvents, 
  onClose, 
  onAddEvent, 
  onDeleteEvent 
}: EventModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MarketingEvent['type']>('promo');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState<number | ''>('');

  const [showAddForm, setShowAddForm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddEvent({
      date: dateStr,
      title: title.trim(),
      type,
      description: description.trim() || undefined,
      budget: budget === '' ? undefined : Number(budget)
    });

    // Reset Form
    setTitle('');
    setType('promo');
    setDescription('');
    setBudget('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col justify-between overflow-hidden relative border-l border-slate-200">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 leading-none">Rincian Hari Operasional</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">{formatDateIndo(dateStr)}</p>
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all border border-slate-200/50 bg-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section 1: Sales metrics of that day */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-slate-400" />
              Performa Penjualan Harian
            </h4>

            {daySales ? (
              <div className="grid grid-cols-1 gap-3">
                {/* Grand total sales */}
                <div className="p-4 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl text-white shadow-md relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 opacity-15 translate-x-3 translate-y-3">
                    <Sparkles className="w-32 h-32" />
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-indigo-100">Total Omzet (All Channels)</p>
                  <h4 className="text-2xl font-black mt-1 font-mono tracking-tight">{formatRupiah(daySales.totalAll)}</h4>
                  <div className="flex justify-between items-center mt-3 text-[10px] font-extrabold text-indigo-100 border-t border-indigo-400/40 pt-2.5">
                    <span>Jumlah Order:</span>
                    <span>{formatNumberIndo(daySales.txAll)} Transaksi</span>
                  </div>
                </div>

                {/* Grid channel details */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    <p className="text-[8px] font-black uppercase text-emerald-600 mb-1">Instan</p>
                    <p className="text-xs font-black text-slate-800 font-mono leading-tight">{formatRupiah(daySales.totalInstan)}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{daySales.txInstan} Tx</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    <p className="text-[8px] font-black uppercase text-blue-600 mb-1">Reguler</p>
                    <p className="text-xs font-black text-slate-800 font-mono leading-tight">{formatRupiah(daySales.totalReguler)}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{daySales.txReguler} Tx</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    <p className="text-[8px] font-black uppercase text-amber-600 mb-1">Manual</p>
                    <p className="text-xs font-black text-slate-800 font-mono leading-tight">{formatRupiah(daySales.totalManual)}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{daySales.txManual} Tx</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs font-semibold">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <span>Hari ini tidak terekam dalam Google Sheet (Toko Libur / Belum Sinkron).</span>
              </div>
            )}
          </div>

          {/* Section 2: Marketing & Operational Activities logs */}
          <div className="space-y-3.5 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-slate-400" />
                Daftar Event / Catatan Kegiatan
              </h4>
              
              {!showAddForm && (
                <button 
                  onClick={() => setShowAddForm(true)}
                  className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Tambah
                </button>
              )}
            </div>

            {/* List of events on this day */}
            {dayEvents.length > 0 ? (
              <div className="space-y-3">
                {dayEvents.map(event => {
                  const typeInfo = EVENT_TYPES.find(t => t.id === event.type);
                  return (
                    <div 
                      key={event.id}
                      className={`p-4 rounded-2xl border ${typeInfo?.bgClass || 'bg-slate-50 border-slate-200'} flex justify-between items-start gap-4 transition-all hover:scale-[1.01]`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${typeInfo?.color || 'bg-slate-500'} text-white`}>
                            {typeInfo?.name}
                          </span>
                          {event.budget !== undefined && (
                            <span className="text-[9px] font-extrabold text-slate-500">
                              Budget: {formatRupiah(event.budget)}
                            </span>
                          )}
                        </div>
                        <h5 className="text-xs font-black text-slate-800">{event.title}</h5>
                        {event.description && (
                          <p className="text-[10px] font-bold text-slate-500 leading-relaxed">{event.description}</p>
                        )}
                      </div>

                      <button
                        onClick={() => onDeleteEvent(event.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-white rounded-lg border border-transparent hover:border-rose-100 transition-all self-start"
                        title="Hapus Event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 font-bold italic py-2">
                Tidak ada agenda khusus atau catatan log promosi di tanggal ini.
              </p>
            )}

            {/* Add Event Form Inline */}
            {showAddForm && (
              <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-3.5 animate-fade-in-up">
                <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Agenda Baru</span>
                  <button 
                    type="button" 
                    onClick={() => setShowAddForm(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase"
                  >
                    Batal
                  </button>
                </div>

                {/* Form Field: Title */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Judul Event / Catatan</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Flash Sale Tokopedia 2.2"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
                  />
                </div>

                {/* Form Field: Category Type */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Kategori Kegiatan</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as MarketingEvent['type'])}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
                  >
                    {EVENT_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Form Field: Budget */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Anggaran / Budget (IDR - Opsional)</label>
                  <input
                    type="number"
                    placeholder="Masukkan angka saja"
                    value={budget}
                    onChange={e => setBudget(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
                  />
                </div>

                {/* Form Field: Description */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Keterangan / Deskripsi</label>
                  <textarea
                    placeholder="Rincian kampanye atau catatan..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  Simpan Catatan
                </button>
              </form>
            )}

          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            Aplikasi Analisa Penjualan Harian
          </p>
        </div>

      </div>
    </div>
  );
}
