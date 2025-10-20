import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QrCode, Search } from "lucide-react";
import { Link } from "wouter";

export default function MobileUcpListPage() {
  const [q, setQ] = useState("");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/ucps", q],
    queryFn: async () => (await apiRequest("GET", "/api/ucps")).json(),
  });

  const items = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter((u: any) =>
      (u.code?.toLowerCase().includes(s)) ||
      (u.pallet?.code?.toLowerCase().includes(s)) ||
      (u.position?.code?.toLowerCase().includes(s))
    );
  }, [data, q]);

  useEffect(() => { refetch(); }, []);

  return (
    <div className="space-y-3 p-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, pallet ou posição" className="pl-9" />
        </div>
        <Link href="/scanner">
          <Button variant="outline" size="icon"><QrCode className="h-5 w-5" /></Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="p-6 text-center text-sm text-gray-500">Carregando...</div>
      ) : (
        <div className="space-y-2">
          {items.map((u: any) => (
            <Link key={u.id} href={`/ucps/${u.id}`}>
              <Card className="active:scale-[0.99] transition">
                <CardContent className="p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-base font-semibold">{u.code}</div>
                      <div className="text-xs text-gray-600">Pallet: {u.pallet?.code || "-"}</div>
                      <div className="text-xs text-gray-600">Posição: {u.position?.code || "-"}</div>
                    </div>
                    <div className="text-xs px-2 py-1 rounded bg-gray-100">{u.status || "-"}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {!items.length && (
            <div className="p-6 text-center text-sm text-gray-500">Nenhuma UCP encontrada</div>
          )}
        </div>
      )}
    </div>
  );
}









