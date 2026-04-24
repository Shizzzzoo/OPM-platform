"use client";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import Link from "next/link";

function fmt(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 min-w-0">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-3xl font-bold truncate ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    complete: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    importing: "bg-blue-100 text-blue-700",
    pending: "bg-gray-100 text-gray-500",
    parsing: "bg-yellow-100 text-yellow-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.get("/api/products/stats/summary").then(r => r.data),
  });

  const { data: jobs } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.get("/api/import").then(r => r.data),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">OPM Platform Overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/import" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Import CSV</Link>
          <Link href="/products" className="border px-4 py-2 rounded hover:bg-gray-50 text-sm">View Products</Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Products" value={stats?.total_products?.toLocaleString() ?? "—"} color="text-gray-900" />
        <StatCard label="Active Products" value={stats?.active_products?.toLocaleString() ?? "—"} color="text-green-600" />
        <StatCard label="Inventory Value" value={stats ? fmt(stats.total_inventory_value) : "—"} color="text-blue-600" />
        <StatCard label="Avg Price" value={stats ? `$${stats.avg_price}` : "—"} color="text-purple-600" />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Recent Imports</h2>
          <Link href="/import" className="text-sm text-blue-600 hover:underline">New import →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              {["File", "Status", "Inserted", "Failed", "Date"].map(h => (
                <th key={h} className="px-6 py-3 font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs?.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No imports yet</td></tr>
            )}
            {jobs?.map((j: any) => (
              <tr key={j.id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-3 font-mono text-xs">{j.filename ?? "—"}</td>
                <td className="px-6 py-3"><StatusBadge status={j.status} /></td>
                <td className="px-6 py-3 text-green-700">{j.inserted?.toLocaleString()}</td>
                <td className="px-6 py-3 text-red-600">{j.failed_rows?.toLocaleString()}</td>
                <td className="px-6 py-3 text-gray-400">{new Date(j.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
