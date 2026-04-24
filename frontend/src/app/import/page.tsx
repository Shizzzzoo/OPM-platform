"use client";
import { useState, useRef } from "react";
import api from "@/lib/api";
import Link from "next/link";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await api.post("/api/import", form);
    const jobId = res.data.job_id;
    setJob(jobId);
    setUploading(false);
    const es = new EventSource(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/import/${jobId}/progress`);
    esRef.current = es;
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setProgress(data);
      if (data.status === "complete" || data.status === "failed") es.close();
    };
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".csv")) setFile(f);
  };

  const isDone = progress?.status === "complete";
  const isFailed = progress?.status === "failed";

  return (
    <div className="min-h-[calc(100vh-49px)] bg-gray-50 flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Import Products</h1>
          <p className="text-sm text-gray-500 mt-1">Upload a CSV file to bulk import products into the platform.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Drop zone */}
          {!progress && (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`cursor-pointer p-10 flex flex-col items-center justify-center border-2 border-dashed rounded-xl m-4 transition-all
                ${dragging ? "border-blue-400 bg-blue-50" : file ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
            >
              <div className={`text-4xl mb-3 ${file ? "text-green-500" : "text-gray-300"}`}>
                {file ? "✓" : "↑"}
              </div>
              {file ? (
                <>
                  <p className="font-medium text-green-700 text-sm">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB — click to change</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-600 text-sm">Drop your CSV here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">Requires: sku, name, description, price, quantity</p>
                </>
              )}
              <input ref={inputRef} type="file" accept=".csv" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold capitalize ${isDone ? "text-green-600" : isFailed ? "text-red-600" : "text-blue-600"}`}>
                  {isDone ? "✓ Import Complete" : isFailed ? "✗ Import Failed" : `Importing — ${progress.progress}%`}
                </span>
                <span className="text-xs text-gray-400">{progress.processed?.toLocaleString()} / {progress.total?.toLocaleString()} rows</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${isFailed ? "bg-red-500" : isDone ? "bg-green-500" : "bg-blue-500"}`}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xl font-bold text-green-700">{progress.inserted?.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Inserted</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="text-xl font-bold text-yellow-700">{progress.updated?.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Updated</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-xl font-bold text-red-700">{progress.failed?.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Failed</div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 pb-6 space-y-2">
            {!progress && (
              <button onClick={upload} disabled={!file || uploading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
                {uploading ? "Uploading..." : "Upload & Import"}
              </button>
            )}
            {isDone && (
              <div className="flex gap-2">
                <Link href="/products" className="flex-1 text-center bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700">
                  View Products →
                </Link>
                <button onClick={() => { setFile(null); setProgress(null); setJob(null); }}
                  className="flex-1 border py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Import Another
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Format hint */}
        {!progress && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Expected CSV Format</p>
            <code className="text-xs text-gray-600 bg-gray-50 rounded p-2 block">
              sku,name,description,price,quantity<br />
              SKU-001,Widget A,A great widget,4.99,50
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
