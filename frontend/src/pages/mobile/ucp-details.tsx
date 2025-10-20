import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams, Link } from "wouter";
import { QrCode } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function MobileUcpDetails() {
  const { id } = useParams<{ id: string }>();
  const ucpId = parseInt(id);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/ucps", ucpId],
    queryFn: async () => (await apiRequest("GET", `/api/ucps/${ucpId}`)).json(),
    enabled: !Number.isNaN(ucpId)
  });

  const moveMutation = useMutation({
    mutationFn: async (payload: { toPositionCode: string }) => (await apiRequest("POST", `/api/ucps/${ucpId}/move`, payload)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ucps", ucpId] }); toast({ title: "UCP movida" }); },
  });

  const dismantleMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/ucps/${ucpId}/dismantle`, {})).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ucps", ucpId] }); toast({ title: "UCP desmontada" }); },
  });

  useEffect(() => { if (ucpId) refetch(); }, [ucpId, refetch]);

  if (Number.isNaN(ucpId)) return <div className="p-4">ID inválido</div>;
  if (isLoading) return <div className="p-4">Carregando...</div>;
  const u = data || {};

  return (
    <div className="space-y-3 p-2">
      <div className="flex items-center justify-between p-1">
        <div className="text-lg font-semibold">UCP {u.code}</div>
        <Link href="/scanner"><Button variant="outline" size="icon"><QrCode className="h-5 w-5" /></Button></Link>
      </div>

      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="text-sm text-gray-600">Status</div>
          <div className="text-base font-medium">{u.status || '-'}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-gray-600">Pallet</div>
              <div className="font-medium">{u.pallet?.code || '-'}</div>
            </div>
            <div>
              <div className="text-gray-600">Posição</div>
              <div className="font-medium">{u.position?.code || '-'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="text-sm font-semibold">Ações</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              const to = prompt("Mover para posição (código):", "PP-01-D-01-0");
              if (to) moveMutation.mutate({ toPositionCode: to });
            }}>Mover</Button>
            <Button size="sm" variant="destructive" onClick={() => {
              if (confirm("Desmontar esta UCP?")) dismantleMutation.mutate();
            }}>Desmontar</Button>
            <Link href={`/ucps/${ucpId}/history`}><Button size="sm" variant="outline">Histórico</Button></Link>
          </div>
        </CardContent>
      </Card>

      {Array.isArray(u.items) && (
        <Card>
          <CardContent className="p-3">
            <div className="text-sm font-semibold mb-2">Itens ({u.items.length})</div>
            <div className="space-y-2">
              {u.items.map((it: any) => (
                <div key={it.id} className="flex items-center justify-between text-sm p-2 rounded bg-gray-50">
                  <div>
                    <div className="font-medium">{it.product?.name || it.productSku}</div>
                    <div className="text-gray-600 text-xs">SKU {it.productSku}</div>
                  </div>
                  <div className="font-semibold">{it.quantity} {it.unit || ''}</div>
                </div>
              ))}
              {!u.items.length && <div className="text-center text-xs text-gray-500">Sem itens</div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


