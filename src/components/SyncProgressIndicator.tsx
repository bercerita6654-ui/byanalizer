import React from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Database, CloudDownload, FileSpreadsheet, Sparkles, Check } from 'lucide-react';
import { formatNumberIndo } from '../utils';

export interface SyncProgressState {
  isActive: boolean;
  stage: 'idle' | 'connecting' | 'downloading' | 'parsing' | 'indexing' | 'completed' | 'error';
  percent: number;
  title: string;
  detail: string;
  estimatedSecondsRemaining?: number;
  elapsedSeconds?: number;
  totalBytes?: number;
  itemCount?: number;
}

interface SyncProgressIndicatorProps {
  progress: SyncProgressState;
  variant?: 'card' | 'modal' | 'banner';
  sheetTitle?: string;
  onClose?: () => void;
}

export const SyncProgressIndicator: React.FC<SyncProgressIndicatorProps> = ({
  progress,
  variant = 'card',
  sheetTitle = 'Google Sheet Penjualan',
  onClose
}) => {
  if (!progress.isActive && variant === 'modal') return null;

  const isCompleted = progress.stage === 'completed';
  const isError = progress.stage === 'error';

  // Step definition
  const steps = [
    { id: 'connecting', label: 'Koneksi Spreadsheet', desc: 'Menghubungi server Google' },
    { id: 'downloading', label: 'Unduh Stream CSV', desc: 'Menerima data baris' },
    { id: 'parsing', label: 'Parsing & Validasi', desc: 'Menyusun tanggal & omzet' },
    { id: 'indexing', label: 'Simpan Cache Lokal', desc: 'IndexedDB offline' }
  ];

  const getStepStatus = (stepId: string) => {
    if (isCompleted) return 'done';
    if (isError) return 'error';

    const stageOrder = ['connecting', 'downloading', 'parsing', 'indexing', 'completed'];
    const currentIdx = stageOrder.indexOf(progress.stage);
    const targetIdx = stageOrder.indexOf(stepId);

    if (currentIdx > targetIdx) return 'done';
    if (currentIdx === targetIdx) return 'current';
    return 'pending';
  };

  const estimatedDisplay = () => {
    if (isCompleted) return 'Sinkronisasi selesai (100%)';
    if (isError) return 'Proses terhenti';
    const s = progress.estimatedSecondsRemaining ?? 1;
    if (s <= 0.3) return 'Hampir selesai (< 1 dtk)';
    return `Estimasi tersisa: ~${s.toFixed(1)} detik`;
  };

  // BANNER VARIANT (thin top indicator)
  if (variant === 'banner') {
    if (!progress.isActive) return null;
    return (
      <div className="bg-indigo-900 text-white px-4 py-2 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 shadow-md animate-in fade-in duration-200">
        <div className="flex items-center gap-2.5">
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : isError ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 text-indigo-300 animate-spin shrink-0" />
          )}
          <div>
            <span className="font-bold">{progress.title}</span>
            <span className="text-indigo-200 text-[11px] ml-2 hidden sm:inline">{progress.detail}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-36 bg-indigo-950/80 rounded-full h-2 overflow-hidden border border-indigo-700/50">
            <div
              className={`h-full transition-all duration-300 ${
                isError ? 'bg-rose-500' : isCompleted ? 'bg-emerald-400' : 'bg-linear-to-r from-indigo-400 to-emerald-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
            />
          </div>
          <span className="font-mono font-black text-[11px] min-w-[36px] text-right">
            {Math.round(progress.percent)}%
          </span>
          <span className="text-[10px] text-indigo-300 font-semibold whitespace-nowrap">
            {estimatedDisplay()}
          </span>
        </div>
      </div>
    );
  }

  // MODAL / FLOATING TOAST VARIANT
  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                isCompleted ? 'bg-emerald-100 text-emerald-700' : isError ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
              }`}>
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 animate-bounce" />
                ) : isError ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <CloudDownload className="w-6 h-6 animate-pulse" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-snug">
                  {progress.title || 'Sinkronisasi Data Google Sheet'}
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                  {sheetTitle}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className={`inline-block font-mono font-black text-lg ${
                isCompleted ? 'text-emerald-600' : isError ? 'text-rose-600' : 'text-indigo-600'
              }`}>
                {Math.round(progress.percent)}%
              </span>
            </div>
          </div>

          {/* Progress Bar Container */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-3.5 p-0.5 border border-slate-200 shadow-inner overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out relative ${
                  isError
                    ? 'bg-rose-500'
                    : isCompleted
                    ? 'bg-emerald-500'
                    : 'bg-linear-to-r from-indigo-500 via-indigo-600 to-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(2, progress.percent))}%` }}
              >
                {!isCompleted && !isError && (
                  <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                )}
              </div>
            </div>

            {/* Estimation & detail bar */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-0.5">
              <span className="flex items-center gap-1.5 text-indigo-700 font-bold">
                <Clock className="w-3.5 h-3.5" />
                {estimatedDisplay()}
              </span>
              {progress.elapsedSeconds !== undefined && (
                <span className="text-slate-400 font-mono text-[10px]">
                  Berlalu: {progress.elapsedSeconds.toFixed(1)}s
                </span>
              )}
            </div>
          </div>

          {/* Status Detail Callout */}
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 text-[11.5px] space-y-1">
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-bold flex items-center gap-1.5">
                {!isCompleted && !isError && <RefreshCw className="w-3 h-3 text-indigo-600 animate-spin" />}
                {progress.detail}
              </span>
              {progress.totalBytes ? (
                <span className="font-mono text-[10.5px] text-slate-400">
                  {Math.round(progress.totalBytes / 1024)} KB
                </span>
              ) : progress.itemCount ? (
                <span className="font-mono text-[10.5px] text-emerald-700 font-bold">
                  {formatNumberIndo(progress.itemCount)} Baris
                </span>
              ) : null}
            </div>
          </div>

          {/* Steps Timeline Mini */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {steps.map((st) => {
              const status = getStepStatus(st.id);
              return (
                <div
                  key={st.id}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    status === 'done'
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                      : status === 'current'
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-2xs'
                      : 'bg-white border-slate-100 text-slate-400 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-center mb-1">
                    {status === 'done' ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    ) : status === 'current' ? (
                      <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      </div>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    )}
                  </div>
                  <span className="text-[9.5px] font-black uppercase tracking-tight block truncate">
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // CARD / FULLSCREEN VARIANT (Standard inline in dashboard or main view)
  return (
    <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-sm space-y-6 flex flex-col items-center justify-center min-h-[420px] max-w-2xl mx-auto w-full">
      {/* Visual Animation Icon */}
      <div className="relative">
        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg transition-all ${
          isCompleted
            ? 'bg-emerald-500 text-white shadow-emerald-200'
            : isError
            ? 'bg-rose-500 text-white shadow-rose-200'
            : 'bg-indigo-600 text-white shadow-indigo-200 animate-pulse'
        }`}>
          {isCompleted ? (
            <CheckCircle2 className="w-8 h-8" />
          ) : isError ? (
            <AlertCircle className="w-8 h-8" />
          ) : (
            <CloudDownload className="w-8 h-8" />
          )}
        </div>

        {!isCompleted && !isError && (
          <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow-sm">
            <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
          </div>
        )}
      </div>

      {/* Main Titles */}
      <div className="space-y-1.5 max-w-lg">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10.5px] font-black uppercase tracking-wider mb-1">
          <FileSpreadsheet className="w-3.5 h-3.5" />
          {sheetTitle}
        </div>
        <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
          {progress.title || 'Menyinkronkan Data Penjualan...'}
        </h3>
        <p className="text-xs text-slate-500 font-semibold leading-relaxed">
          {progress.detail || 'Mengambil data penjualan real-time, silakan tunggu beberapa detik.'}
        </p>
      </div>

      {/* Primary Progress Bar Component */}
      <div className="w-full max-w-md space-y-2">
        <div className="w-full bg-slate-100 rounded-full h-4 p-0.5 border border-slate-200 shadow-inner overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out relative ${
              isError
                ? 'bg-rose-500'
                : isCompleted
                ? 'bg-emerald-500'
                : 'bg-linear-to-r from-indigo-500 via-indigo-600 to-emerald-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(3, progress.percent))}%` }}
          >
            {!isCompleted && !isError && (
              <div className="absolute inset-0 bg-white/25 animate-pulse rounded-full" />
            )}
          </div>
        </div>

        {/* Progress Stats bar */}
        <div className="flex items-center justify-between text-xs px-1 font-semibold">
          <span className="flex items-center gap-1.5 text-indigo-700 font-bold">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            {estimatedDisplay()}
          </span>

          <div className="flex items-center gap-2">
            {progress.elapsedSeconds !== undefined && (
              <span className="text-[11px] text-slate-400 font-mono">
                {progress.elapsedSeconds.toFixed(1)}s
              </span>
            )}
            <span className="font-mono font-black text-slate-800 text-sm">
              {Math.round(progress.percent)}%
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Step Pipeline Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full max-w-lg pt-2">
        {steps.map((st, idx) => {
          const status = getStepStatus(st.id);
          return (
            <div
              key={st.id}
              className={`p-3 rounded-2xl border text-left transition-all ${
                status === 'done'
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 shadow-2xs'
                  : status === 'current'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-950 shadow-sm ring-2 ring-indigo-200'
                  : 'bg-slate-50/60 border-slate-200/60 text-slate-400 opacity-65'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-200/70 text-[9.5px] font-black flex items-center justify-center text-slate-600">
                  {idx + 1}
                </span>
                {status === 'done' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                ) : status === 'current' ? (
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                ) : null}
              </div>
              <span className="text-[10px] font-black uppercase tracking-tight block">
                {st.label}
              </span>
              <span className="text-[9px] text-slate-500 font-semibold block mt-0.5 leading-tight">
                {st.desc}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
