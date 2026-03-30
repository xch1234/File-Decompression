import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { 
  FileArchive, 
  Upload, 
  Download, 
  File, 
  X, 
  CheckCircle2, 
  Loader2,
  FolderOpen,
  ChevronRight,
  HardDrive,
  Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface ExtractedFile {
  name: string;
  size: number;
  type: string;
  data: Blob;
  id: string;
}

export default function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [files, setFiles] = useState<ExtractedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const processZip = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please upload a valid .zip file');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setFiles([]);

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      const extractedFiles: ExtractedFile[] = [];

      const promises = Object.keys(contents.files).map(async (filename) => {
        const zipFile = contents.files[filename];
        if (!zipFile.dir) {
          const blob = await zipFile.async('blob');
          extractedFiles.push({
            name: filename,
            size: blob.size,
            type: blob.type || 'application/octet-stream',
            data: blob,
            id: Math.random().toString(36).substring(7)
          });
        }
      });

      await Promise.all(promises);
      setFiles(extractedFiles);
      if (extractedFiles.length === 0) {
        setError('The zip file is empty or contains only directories.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to process the zip file. It might be corrupted or encrypted.');
    } finally {
      setIsProcessing(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processZip(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processZip(file);
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        if (base64) resolve(base64);
        else reject(new Error('Base64 conversion failed'));
      };
      reader.onerror = () => reject(new Error('Read error'));
      reader.readAsDataURL(blob);
    });
  };

  const downloadFile = async (file: ExtractedFile) => {
    console.log('Download initiated for:', file.name);
    
    if (Capacitor.isNativePlatform()) {
      try {
        setIsProcessing(true);
        setError(null);
        
        const base64Data = await blobToBase64(file.data);
        const fileName = file.name.split('/').pop() || 'file';
        
        // 1. 写入临时文件
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        console.log('File written to:', result.uri);

        // 2. 调用原生分享/保存
        await Share.share({
          title: fileName,
          text: `Saving ${fileName}`,
          url: result.uri,
        });
        
      } catch (err: any) {
        console.error('Native download error:', err);
        setError(`Save failed: ${err.message || 'Unknown error'}`);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // 网页版逻辑
      const url = URL.createObjectURL(file.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.split('/').pop() || 'file';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const downloadAll = async () => {
    if (files.length === 0) return;
    
    for (const file of files) {
      await downloadFile(file);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const reset = () => {
    setFiles([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-4xl mb-12 text-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center justify-center p-3 bg-blue-50 rounded-2xl mb-4"
        >
          <FileArchive className="w-8 h-8 text-blue-600" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-4xl font-bold tracking-tight mb-2"
        >
          Zip Extractor
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-slate-500 text-lg"
        >
          Extract and download files from your archives instantly.
        </motion.p>
      </header>

      <main className="w-full max-w-4xl space-y-6">
        <AnimatePresence mode="wait">
          {files.length === 0 && !isProcessing ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative group cursor-pointer border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all duration-300 min-h-[300px]",
                isDragging 
                  ? "border-blue-500 bg-blue-50/50 scale-[1.02]" 
                  : "border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50/50"
              )}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={onFileChange} 
                accept=".zip" 
                className="hidden" 
              />
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors">
                <Upload className="w-10 h-10 text-slate-400 group-hover:text-blue-500 transition-colors" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Choose a ZIP file</h3>
              <p className="text-slate-500 text-center max-w-xs">
                Drag and drop your archive here, or click to browse your files.
              </p>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  {error}
                </motion.div>
              )}
            </motion.div>
          ) : isProcessing ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white border border-slate-200 rounded-3xl p-20 flex flex-col items-center justify-center text-center"
            >
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-6" />
              <h3 className="text-xl font-semibold mb-2">Processing Archive...</h3>
              <p className="text-slate-500">Reading contents and preparing files.</p>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{files.length} Files Extracted</h3>
                    <p className="text-xs text-slate-500">Ready for download</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={reset}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Clear All
                  </button>
                  <button 
                    onClick={downloadAll}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all shadow-sm flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download All
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100">
                  {files.map((file, index) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      key={file.id}
                      className="group p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors">
                          <File className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate pr-4">{file.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{formatSize(file.size)}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => downloadFile(file)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center gap-2"
                        title={Capacitor.isNativePlatform() ? "Share/Save file" : "Download file"}
                      >
                        {Capacitor.isNativePlatform() ? <Share2 className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8">
          {[
            { icon: HardDrive, title: "Client Side", desc: "Files are processed in your browser. No data is uploaded to any server." },
            { icon: FolderOpen, title: "Structure Preserved", desc: "Maintains the original folder structure of your archive." },
            { icon: ChevronRight, title: "Fast & Free", desc: "No file size limits. Extract as many files as you need." }
          ].map((feature, i) => (
            <div key={i} className="p-6 bg-white border border-slate-200 rounded-2xl">
              <feature.icon className="w-6 h-6 text-blue-500 mb-4" />
              <h4 className="font-semibold mb-2">{feature.title}</h4>
              <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="mt-auto py-8 text-slate-400 text-sm">
        <p>© 2026 Zip Extractor Online • Secure & Private</p>
      </footer>
    </div>
  );
}

