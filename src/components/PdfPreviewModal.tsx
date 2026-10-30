import React, { useState, useEffect } from 'react';
import { 
  X, Download, Eye, ExternalLink, ZoomIn, ZoomOut, RotateCcw, 
  FileText, CheckCircle2, ShieldCheck, Printer, Maximize2, Minimize2 
} from 'lucide-react';

export interface PdfPreviewData {
  blobUrl: string;
  fileName: string;
  title: string;
  pageCount?: number;
  fileSizeBytes?: number;
  onDownloadConfirm?: () => void;
}

interface PdfPreviewModalProps {
  isOpen: boolean;
  data: PdfPreviewData | null;
  onClose: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  data,
  onClose
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isDownloaded, setIsDownloaded] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setZoomLevel(100);
      setIsDownloaded(false);
      setIsFullscreen(false);
    }
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  const handleDownload = () => {
    if (data.onDownloadConfirm) {
      data.onDownloadConfirm();
    } else if (data.blobUrl) {
      const link = document.createElement('a');
      link.href = data.blobUrl;
      link.download = data.fileName || 'Laporan.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setIsDownloaded(true);
    setTimeout(() => setIsDownloaded(false), 3000);
  };

  const handlePrint = () => {
    const iframe = document.getElementById('pdf-preview-frame') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        window.open(data.blobUrl, '_blank');
      }
    } else {
      window.open(data.blobUrl, '_blank');
    }
  };

  const handleOpenNewTab = () => {
    window.open(data.blobUrl, '_blank');
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Standar (~120 KB)';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200 font-sans">
      <div 
        className={`bg-slate-900 text-white rounded-3xl shadow-2xl overflow-hidden border border-slate-700/60 flex flex-col transition-all duration-300 ${
          isFullscreen 
            ? 'w-full h-full rounded-none border-none' 
            : 'w-full max-w-5xl h-[92vh] max-h-[900px]'
        }`}
      >
        {/* Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-100 truncate">
                  {data.title || 'Pratinjau Tampilan Dokumen PDF'}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono font-bold shrink-0">
                  A4 Print Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                {data.fileName}
              </p>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Zoom Controls */}
            <div className="hidden md:flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/50">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(50, prev - 15))}
                title="Perkecil Tampilan"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10.5px] font-mono font-bold text-slate-300 px-2 min-w-[42px] text-center">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(180, prev + 15))}
                title="Perbesar Tampilan"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                title="Reset Zoom"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border-l border-slate-700/60 ml-0.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Print & External Tab */}
            <button
              type="button"
              onClick={handlePrint}
              title="Cetak Dokumen"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-slate-800 cursor-pointer hidden sm:flex items-center gap-1.5 text-xs font-bold"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden lg:inline">Cetak</span>
            </button>

            <button
              type="button"
              onClick={handleOpenNewTab}
              title="Buka di Tab Baru"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-slate-800 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Tab Baru</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(prev => !prev)}
              title={isFullscreen ? "Kecilkan" : "Layar Penuh"}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-slate-800 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Download Button Header */}
            <button
              type="button"
              onClick={handleDownload}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                isDownloaded
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isDownloaded ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span className="hidden sm:inline">Tersimpan!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-white" />
                  <span>Unduh PDF</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-slate-800 cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Info Strip */}
        <div className="bg-slate-950/40 px-4 sm:px-6 py-2 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-medium shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              Pratinjau Hasil Cetak PDF Asli
            </span>
            {data.pageCount && (
              <span className="text-slate-500 hidden sm:inline">• {data.pageCount} Halaman</span>
            )}
            <span className="text-slate-500 hidden sm:inline">• Ukuran: {formatFileSize(data.fileSizeBytes)}</span>
          </div>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Siap Diunduh
          </span>
        </div>

        {/* Interactive PDF Document Viewer Body */}
        <div className="flex-1 bg-slate-950 relative overflow-auto flex items-center justify-center p-2 sm:p-4">
          <div 
            className="w-full h-full max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl bg-white transition-transform duration-150 origin-top flex flex-col"
            style={{ transform: `scale(${zoomLevel / 100})` }}
          >
            <object
              id="pdf-preview-object"
              data={`${data.blobUrl}#toolbar=1&navpanes=0`}
              type="application/pdf"
              className="w-full h-full border-0 bg-white flex-1"
            >
              <iframe
                id="pdf-preview-frame"
                src={`${data.blobUrl}#toolbar=1&navpanes=0`}
                title="PDF Document Preview"
                className="w-full h-full border-0 bg-white flex-1"
              >
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-600 bg-slate-50">
                  <FileText className="w-16 h-16 text-indigo-500 mb-3" />
                  <p className="font-bold text-sm text-slate-800">Pratinjau Dokumen PDF</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Dokumen siap diunduh atau dibuka di jendela peramban.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenNewTab}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                  >
                    Buka Dokumen di Tab Baru
                  </button>
                </div>
              </iframe>
            </object>
          </div>
        </div>

        {/* Bottom Confirmation Action Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            Pastikan seluruh data, tabel, dan diagram telah sesuai sebelum disimpan ke komputer Anda.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700/60 cursor-pointer"
            >
              Tutup Pratinjau
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Unduh File PDF Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
