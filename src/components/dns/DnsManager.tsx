"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Globe, AlertCircle, Shield } from "lucide-react";

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  comment?: string | null;
}

export function DnsManager() {
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  // Add form state
  const [type, setType] = useState("A");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [proxied, setProxied] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/dns", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setRecords(json.records ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal load DNS.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, content, proxied, ttl: 1 })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal create.");
      setShowAdd(false);
      setName("");
      setContent("");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string, name: string) {
    if (!confirm(`Hapus record ${name}?`)) return;
    try {
      const res = await fetch(`/api/dns/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal hapus.");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat DNS records...
      </div>
    );
  }

  if (err) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-3 text-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
            <div>
              <div className="font-medium text-slate-900">Cloudflare belum dikonfigurasi</div>
              <div className="mt-1 text-slate-600">{err}</div>
              <div className="mt-2 text-xs text-slate-500">
                Set <code className="rounded bg-slate-100 px-1">CLOUDFLARE_API_TOKEN</code> dan{" "}
                <code className="rounded bg-slate-100 px-1">CLOUDFLARE_ZONE_ID</code> di .env.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={() => setShowAdd((v) => !v)} variant={showAdd ? "outline" : "default"}>
          <Plus className="h-4 w-4" />
          {showAdd ? "Batal" : "Tambah Record"}
        </Button>
        <span className="ml-auto text-xs text-slate-500">{records.length} records</span>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={add} className="grid gap-3 md:grid-cols-5">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="A">A</option>
                <option value="AAAA">AAAA</option>
                <option value="CNAME">CNAME</option>
                <option value="TXT">TXT</option>
              </select>
              <Input
                placeholder="subdomain.example.com"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                placeholder="1.2.3.4 atau target.example.com"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                className="md:col-span-2"
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={proxied}
                  onChange={(e) => setProxied(e.target.checked)}
                  className="h-4 w-4"
                />
                Proxied
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Content</th>
                  <th className="px-3 py-2">Proxied</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Badge variant="outline">{r.type}</Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.content}</td>
                    <td className="px-3 py-2">
                      {r.proxied ? (
                        <Badge variant="info" className="gap-1">
                          <Shield className="h-3 w-3" />
                          Proxied
                        </Badge>
                      ) : (
                        <Badge variant="outline">DNS only</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => del(r.id, r.name)}
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {records.length === 0 && (
              <div className="p-12 text-center text-sm text-slate-500">
                <Globe className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                Belum ada DNS record. Klik &ldquo;Tambah Record&rdquo; untuk mulai.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
