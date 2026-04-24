"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

const PAGE_SIZE = 50;

function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded shadow-lg text-white text-sm flex items-center gap-3 ${type === "success" ? "bg-green-600" : "bg-red-600"}`}>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 text-white/70 hover:text-white">✕</button>
    </div>
  );
}

function EditModal({ product, onClose, onSave }: { product: any; onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({ name: product.name, price: product.price ?? "", quantity: product.quantity, is_active: product.is_active });
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold">Edit Product</h2>
        <div className="text-xs text-gray-400 font-mono">{product.sku}</div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Name</label>
            <input className="mt-1 w-full border rounded px-3 py-2 text-sm" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Price</label>
            <input className="mt-1 w-full border rounded px-3 py-2 text-sm" type="number" step="0.01" value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Quantity</label>
            <input className="mt-1 w-full border rounded px-3 py-2 text-sm" type="number" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_active" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active</label>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("sku");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["products", search, status, page, sortBy, sortDir],
    queryFn: () =>
      api.get("/api/products", {
        params: { name: search || undefined, status: status || undefined, page, limit: PAGE_SIZE, sort_by: sortBy, sort_dir: sortDir },
      }).then(r => r.data),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/api/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); showToast("Product deleted"); },
    onError: () => showToast("Failed to delete", "error"),
  });

  const bulkDel = useMutation({
    mutationFn: (ids: string[]) => api.post("/api/products/bulk-delete", { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      showToast(`Deleted ${selected.size} products`);
      setSelected(new Set());
    },
    onError: () => showToast("Bulk delete failed", "error"),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/api/products/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); showToast("Product updated"); setEditing(null); },
    onError: () => showToast("Update failed", "error"),
  });

  const totalPages = data?.total ? Math.ceil(data.total / PAGE_SIZE) : 1;
  const allSelected = data?.items?.length > 0 && data.items.every((p: any) => selected.has(p.id));

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => (
    <span className="ml-1 text-gray-400">
      {sortBy === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const exportCsv = () => { window.open(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/products/export/csv`, "_blank"); };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {editing && <EditModal product={editing} onClose={() => setEditing(null)}
        onSave={(form) => update.mutate({ id: editing.id, data: form })} />}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">Export CSV</button>
          <a href="/import" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Import CSV</a>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input className="border rounded px-3 py-2 flex-1 text-sm" placeholder="Search by name..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="border rounded px-3 py-2 text-sm" value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded px-4 py-2 text-sm">
          <span className="text-blue-700 font-medium">{selected.size} selected</span>
          <button onClick={() => bulkDel.mutate(Array.from(selected))}
            className="text-red-600 hover:text-red-800 font-medium">Delete selected</button>
          <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:text-gray-700">Clear</button>
        </div>
      )}

      {isLoading ? <p className="text-gray-500 text-sm">Loading...</p> : (
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allSelected}
                    onChange={e => setSelected(e.target.checked ? new Set(data.items.map((p: any) => p.id)) : new Set())} />
                </th>
                {[["sku","SKU"],["name","Name"],["price","Price"],["quantity","Qty"]].map(([col, label]) => (
                  <th key={col} className="px-4 py-3 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900"
                    onClick={() => toggleSort(col)}>
                    {label}<SortIcon col={col} />
                  </th>
                ))}
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data?.items?.map((p: any) => (
                <tr key={p.id} className="border-t hover:bg-gray-50 cursor-pointer"
                  onClick={() => setEditing(p)}>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(p.id)}
                      onChange={e => {
                        const s = new Set(selected);
                        e.target.checked ? s.add(p.id) : s.delete(p.id);
                        setSelected(s);
                      }} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3">{p.price != null ? `$${p.price}` : "—"}</td>
                  <td className="px-4 py-3">{p.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${p.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => del.mutate(p.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
            <span>{data?.total ?? 0} total products</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50">← Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50">Next →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
