'use client';

import { useState, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, ArrowLeft,
  Package, AlertTriangle, TrendingDown, Loader2, RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { posImportApi } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PreviewRow {
  posProductId: string;
  productCode: string;
  description: string;
  barcode: string;
  qty: number;
  unitPrice: number;
  total: number;
}

interface ResultRow {
  posProductId: string;
  productCode: string;
  description: string;
  barcode: string;
  qty: number;
  matched: boolean;
  matchedBy?: 'posProductId' | 'barcode';
  variantId?: string;
  variantName?: string;
  productName?: string;
  previousStock?: number;
  newStock?: number;
  reason?: string;
}

interface ImportSummary {
  totalRows: number;
  matched: number;
  unmatched: number;
  totalQtyDeducted: number;
  results: ResultRow[];
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-16 cursor-pointer transition-all',
        dragging
          ? 'border-indigo-400 bg-indigo-50'
          : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <div className={cn('flex h-16 w-16 items-center justify-center rounded-2xl transition-colors', dragging ? 'bg-indigo-100' : 'bg-white border border-slate-200')}>
        <FileSpreadsheet size={32} className={dragging ? 'text-indigo-600' : 'text-slate-400'} />
      </div>
      <div className="text-center">
        <p className="font-semibold text-slate-700">Drop your POS Excel file here</p>
        <p className="text-sm text-slate-400 mt-1">or click to browse · .xlsx files only</p>
      </div>
      <div className="flex items-center gap-6 text-xs text-slate-400">
        <span>✓ Omega Software export format</span>
        <span>✓ Matches by POS Product ID</span>
        <span>✓ Barcode fallback</span>
      </div>
    </div>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className={cn('rounded-xl border p-4 flex items-center gap-3', color)}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs opacity-70">{label}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PosImportPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; totalRows: number } | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched'>('all');

  const previewMutation = useMutation({
    mutationFn: (f: File) => posImportApi.preview(f),
    onSuccess: (data) => setPreview(data),
    onError: () => toast('Failed to parse file — check the format', 'error'),
  });

  const importMutation = useMutation({
    mutationFn: (f: File) => posImportApi.import(f),
    onSuccess: (data: ImportSummary) => {
      setResult(data);
      setPreview(null);
      toast(`Import complete — ${data.matched} items updated`, 'success');
    },
    onError: () => toast('Import failed', 'error'),
  });

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    previewMutation.mutate(f);
  };

  const reset = () => {
    setFile(null); setPreview(null); setResult(null);
  };

  const filteredResults = result?.results.filter((r) => {
    if (filter === 'matched')   return r.matched;
    if (filter === 'unmatched') return !r.matched;
    return true;
  }) ?? [];

  return (
    <div className="flex flex-col h-full">
      <Header title="POS Sales Import" subtitle="Sync offline sales from Omega Software — deducts stock automatically" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Back + breadcrumb */}
        <Link href="/products" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 w-fit">
          <ArrowLeft size={14} /> Back to Products
        </Link>

        {/* Step 1 — Upload */}
        {!preview && !result && (
          <div className="space-y-4">
            <DropZone onFile={handleFile} />

            {previewMutation.isPending && (
              <div className="flex items-center justify-center gap-3 py-6 text-slate-500">
                <Loader2 size={20} className="animate-spin text-indigo-500" />
                <span className="text-sm">Parsing Excel file…</span>
              </div>
            )}

            {/* Format guide */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Expected File Format</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-600 border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      {['Product Code', 'Description', 'Barcode', 'Product ID ✦', 'Qty ✦', 'Unit Price', 'Total'].map(h => (
                        <th key={h} className="border border-slate-200 px-3 py-2 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-200 px-3 py-2">Alchohol 70/250 spray</td>
                      <td className="border border-slate-200 px-3 py-2">-Alchohol 70/250 spray</td>
                      <td className="border border-slate-200 px-3 py-2">528500195338</td>
                      <td className="border border-slate-200 px-3 py-2 font-mono font-bold text-indigo-700">1533</td>
                      <td className="border border-slate-200 px-3 py-2 font-bold">1</td>
                      <td className="border border-slate-200 px-3 py-2">0.66</td>
                      <td className="border border-slate-200 px-3 py-2">0.66</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                ✦ Columns D (Product ID) and E (Qty) are required. Header/footer rows are automatically skipped.
                Matching priority: <strong>POS Product ID</strong> first, then <strong>Barcode</strong> as fallback.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 — Preview */}
        {preview && file && !result && (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={20} className="text-indigo-600 shrink-0" />
                <div>
                  <p className="font-semibold text-indigo-900">{file.name}</p>
                  <p className="text-xs text-indigo-600">{preview.totalRows} product rows parsed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={reset}>
                  <RotateCcw size={14} /> Change file
                </Button>
                <Button
                  onClick={() => importMutation.mutate(file)}
                  loading={importMutation.isPending}
                >
                  <Upload size={15} /> Run Import
                </Button>
              </div>
            </div>

            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              ⚠️ Clicking <strong>Run Import</strong> will immediately deduct the quantities from your product stock. This cannot be undone automatically.
            </p>

            {/* Preview table */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-sm font-semibold text-slate-700">Preview — {preview.totalRows} rows</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">POS ID</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Product Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Barcode</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Qty Sold</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-indigo-700 font-semibold">{row.posProductId}</td>
                        <td className="px-4 py-2.5 text-slate-700 max-w-xs truncate">{row.productCode || row.description}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{row.barcode}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{row.qty}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">${row.unitPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Results */}
        {result && (
          <div className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard icon={<Package size={20} className="text-indigo-600" />} label="Total Rows" value={result.totalRows} color="bg-indigo-50 border-indigo-200 text-indigo-900" />
              <SummaryCard icon={<CheckCircle2 size={20} className="text-emerald-600" />} label="Matched & Updated" value={result.matched} color="bg-emerald-50 border-emerald-200 text-emerald-900" />
              <SummaryCard icon={<XCircle size={20} className="text-red-500" />} label="Not Matched" value={result.unmatched} color="bg-red-50 border-red-200 text-red-900" />
              <SummaryCard icon={<TrendingDown size={20} className="text-amber-600" />} label="Total Qty Deducted" value={result.totalQtyDeducted} color="bg-amber-50 border-amber-200 text-amber-900" />
            </div>

            {result.unmatched > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">{result.unmatched} items could not be matched</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Go to <strong>Products → Edit Variant</strong> and fill in the <strong>POS Product ID</strong> field for these items, then re-import.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {(['all', 'matched', 'unmatched'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn('rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-all', filter === f ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}
                  >
                    {f} {f === 'all' ? `(${result.totalRows})` : f === 'matched' ? `(${result.matched})` : `(${result.unmatched})`}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={reset}>
                <Upload size={14} /> Import Another File
              </Button>
            </div>

            {/* Results table */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-8"></th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">POS ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">POS Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Matched To</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Via</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Stock Before</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">Stock After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredResults.map((row, i) => (
                      <tr key={i} className={cn('hover:bg-slate-50', !row.matched && 'bg-red-50/40')}>
                        <td className="px-4 py-3">
                          {row.matched
                            ? <CheckCircle2 size={15} className="text-emerald-500" />
                            : <XCircle size={15} className="text-red-400" />}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-indigo-700 font-semibold">{row.posProductId}</td>
                        <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate" title={row.productCode}>{row.productCode || row.description}</td>
                        <td className="px-4 py-3">
                          {row.matched ? (
                            <div>
                              <p className="font-medium text-slate-800 truncate max-w-[160px]">{row.productName}</p>
                              {row.variantName && <p className="text-xs text-slate-400">{row.variantName}</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-red-500 italic">Not found in system</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.matchedBy && (
                            <Badge variant={row.matchedBy === 'posProductId' ? 'default' : 'warning'} className="text-[10px]">
                              {row.matchedBy === 'posProductId' ? 'POS ID' : 'Barcode'}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">{row.qty}</td>
                        <td className="px-4 py-3 text-right text-slate-500">{row.previousStock ?? '—'}</td>
                        <td className="px-4 py-3 text-right">
                          {row.newStock !== undefined ? (
                            <span className={cn('font-semibold', row.newStock === 0 ? 'text-red-600' : row.newStock <= 3 ? 'text-amber-600' : 'text-emerald-600')}>
                              {row.newStock}
                              {row.newStock === 0 && ' ⚠'}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
