/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileType, Download, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjs from 'pdfjs-dist';
import pptxgen from 'pptxgenjs';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pptxBlob, setPptxBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      setPptxBlob(null);
      setProgress(0);
    } else {
      setError('PDF 파일만 업로드 가능합니다.');
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
      setPptxBlob(null);
      setProgress(0);
    } else {
      setError('PDF 파일만 업로드 가능합니다.');
    }
  }, []);

  const convertPdfToPptx = async () => {
    if (!file) return;

    setIsGenerating(true);
    setProgress(0);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const pptx = new pptxgen();
      
      const numPages = pdf.numPages;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        
        // Use a high scale for better quality
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) throw new Error('Canvas context could not be created');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas
        }).promise;

        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // Create slide with PDF page dimensions
        // pdfjs units are points (1/72 inch). pptxgenjs uses inches.
        const widthInInches = viewport.width / (72 * 2.0); // divide by scale used
        const heightInInches = viewport.height / (72 * 2.0);

        // Set slide size for this slide (pptxgenjs allows custom sizes globally, but we can try to fit)
        // Note: pptxgenjs usually has a global layout. We'll try to use a layout that fits the first page or standard.
        if (i === 1) {
          pptx.defineLayout({ name: 'PDF_SIZE', width: widthInInches, height: heightInInches });
          pptx.layout = 'PDF_SIZE';
        }

        const slide = pptx.addSlide();
        slide.addImage({
          data: imgData,
          x: 0,
          y: 0,
          w: widthInInches,
          h: heightInInches
        });

        setProgress(Math.round((i / numPages) * 100));
      }

      const output = await pptx.write({ outputType: 'blob' }) as Blob;
      setPptxBlob(output);
      setIsGenerating(false);
    } catch (err) {
      console.error(err);
      setError('변환 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsGenerating(false);
    }
  };

  const downloadPptx = () => {
    if (!pptxBlob || !file) return;
    const url = URL.createObjectURL(pptxBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace('.pdf', '.pptx');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-brand-blue/5">
      {/* Top Navigation / Header */}
      <header className="h-16 border-b border-brand-blue/10 flex items-center justify-between px-8 bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-brand-blue flex items-center justify-center rounded-sm">
            <FileType className="w-5 h-5 text-ivory" />
          </div>
          <h1 className="text-sm font-bold tracking-tighter uppercase">
            PDF <span className="opacity-30">/</span> PPTX <span className="text-brand-blue-light ml-1">PRO</span>
          </h1>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex flex-col items-end">
            <span className="micro-label">System Status</span>
            <span className="text-[10px] font-mono font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              OPERATIONAL
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row">
        {/* Left Pane: Input */}
        <section className="flex-1 border-r border-brand-blue/10 p-8 md:p-12 flex flex-col">
          <div className="mb-12">
            <span className="micro-label mb-2 block">Step 01</span>
            <h2 className="text-3xl font-light tracking-tight mb-2">Source Document</h2>
            <p className="text-sm text-brand-blue/40 max-w-sm">
              고해상도 엔진이 각 페이지를 분석하여 최적화된 슬라이드 레이아웃으로 변환합니다.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col"
          >
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex-1 border border-dashed rounded-sm flex flex-col items-center justify-center p-12 cursor-pointer transition-all duration-500 group relative overflow-hidden",
                file 
                  ? "border-brand-blue-light bg-brand-blue-light/[0.02]" 
                  : "border-brand-blue/10 bg-white hover:border-brand-blue/30 hover:bg-brand-blue/[0.01]"
              )}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf"
                className="hidden"
              />
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 border border-brand-blue/10 flex items-center justify-center mb-8 group-hover:border-brand-blue-light/30 transition-colors duration-500">
                  {file ? (
                    <FileType className="w-8 h-8 text-brand-blue-light" />
                  ) : (
                    <Upload className="w-8 h-8 text-brand-blue/20 group-hover:text-brand-blue/40 transition-colors" />
                  )}
                </div>
                
                <h3 className="text-lg font-medium text-brand-blue mb-1">
                  {file ? file.name : "pdf파일을 넣으세요"}
                </h3>
                <p className="micro-label opacity-30">
                  Drag & Drop or Click to browse
                </p>
              </div>

              {/* Decorative Corner Accents */}
              <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-brand-blue/10" />
              <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-brand-blue/10" />
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-brand-blue/10" />
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-brand-blue/10" />
            </div>

            <div className="mt-8 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="micro-label">File Type</span>
                <span className="text-xs font-mono">PDF/A-1b Standard</span>
              </div>
              {file && !isGenerating && !pptxBlob && (
                <motion.button
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    convertPdfToPptx();
                  }}
                  className="px-10 py-4 bg-brand-blue text-ivory rounded-sm font-bold text-xs uppercase tracking-widest hover:bg-brand-blue-light transition-all shadow-2xl shadow-brand-blue/20 active:scale-95"
                >
                  Initialize Conversion
                </motion.button>
              )}
            </div>
          </motion.div>
        </section>

        {/* Right Pane: Output & Processing */}
        <section className="flex-1 bg-white p-8 md:p-12 flex flex-col relative overflow-hidden">
          <div className="mb-12">
            <span className="micro-label mb-2 block">Step 02</span>
            <h2 className="text-3xl font-light tracking-tight mb-2">Output Generation</h2>
            <p className="text-sm text-brand-blue/40 max-w-sm">
              실시간 렌더링 파이프라인을 통해 고화질 이미지가 슬라이드에 배치됩니다.
            </p>
          </div>

          <div className="flex-1 border border-brand-blue/5 rounded-sm p-12 flex flex-col items-center justify-center relative bg-ivory/30">
            <AnimatePresence mode="wait">
              {!isGenerating && !pptxBlob && !error && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <div className="w-12 h-12 border border-brand-blue/5 flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-6 h-6 text-brand-blue/10" />
                  </div>
                  <span className="micro-label">Awaiting Input</span>
                </motion.div>
              )}

              {isGenerating && (
                <motion.div
                  key="generating"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full max-w-xs"
                >
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <span className="micro-label block mb-1">Processing</span>
                      <h3 className="text-xl font-bold tracking-tighter">생성중입니다</h3>
                    </div>
                    <span className="text-2xl font-mono font-light tracking-tighter">{progress}%</span>
                  </div>
                  
                  <div className="w-full bg-brand-blue/5 h-[2px] relative overflow-hidden">
                    <motion.div 
                      className="absolute inset-y-0 left-0 bg-brand-blue-light"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="p-3 border border-brand-blue/5 bg-white/50">
                      <span className="micro-label block mb-1">Engine</span>
                      <span className="text-[10px] font-mono">V8-RENDER-PRO</span>
                    </div>
                    <div className="p-3 border border-brand-blue/5 bg-white/50">
                      <span className="micro-label block mb-1">Quality</span>
                      <span className="text-[10px] font-mono">LOSSLESS-2X</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {pptxBlob && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center w-full max-w-sm"
                >
                  <div className="w-16 h-16 border border-emerald-500/20 bg-emerald-50/30 flex items-center justify-center mx-auto mb-8">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight mb-2">생성이 완료되었습니다</h3>
                  <p className="text-sm text-brand-blue/40 mb-10">다운받으세요.</p>
                  
                  <button
                    onClick={downloadPptx}
                    className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-brand-blue text-ivory rounded-sm font-bold text-xs uppercase tracking-[0.2em] hover:bg-brand-blue-light transition-all transform hover:-translate-y-1 shadow-2xl shadow-brand-blue/20 active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    Download PPTX
                  </button>
                </motion.div>
              )}

              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center"
                >
                  <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-6" />
                  <p className="text-sm font-mono text-red-500 mb-6">{error}</p>
                  <button 
                    onClick={() => { setError(null); setFile(null); }}
                    className="micro-label underline underline-offset-4 opacity-100 hover:text-brand-blue-light transition-colors"
                  >
                    Reset System
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Background Grid Pattern */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
                 style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          </div>
        </section>
      </main>

      {/* Footer / Status Bar */}
      <footer className="h-10 border-t border-brand-blue/10 bg-white flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <span className="micro-label">Industrial Design v2.0</span>
          <span className="micro-label">© 2024 PDF-PPTX-PRO</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="micro-label">Ready for processing</span>
        </div>
      </footer>
    </div>
  );
}
