import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";

export default function MobileProductDetails() {
  const { id } = useParams<{ id: string }>();
  const pid = Number(id);
  const { data, isLoading } = useQuery({
    queryKey: ["/api/products", pid],
    queryFn: async () => (await apiRequest("GET", `/api/products/${pid}`)).json(),
    enabled: !Number.isNaN(pid)
  });

  if (Number.isNaN(pid)) return <div className="p-4">ID inválido</div>;
  if (isLoading) return <div className="p-4">Carregando...</div>;
  const p = data || {};

  return (
    <div className="space-y-3 p-2">
      <div className="flex items-center justify-between p-1">
        <div className="text-lg font-semibold">{p.name}</div>
        <Link href="/scanner"><Button variant="outline" size="icon"><QrCode className="h-5 w-5" /></Button></Link>
      </div>

      <Card>
        <CardContent className="p-3 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-gray-600">SKU</div>
              <div className="font-medium">{p.sku}</div>
            </div>
            <div>
              <div className="text-gray-600">Unidade</div>
              <div className="font-medium">{p.unit}</div>
            </div>
            {p.brand && (
              <div>
                <div className="text-gray-600">Marca</div>
                <div className="font-medium">{p.brand}</div>
              </div>
            )}
            {p.barcode && (
              <div>
                <div className="text-gray-600">Código</div>
                <div className="font-mono">{p.barcode}</div>
              </div>
            )}
          </div>
          {p.dimensions && (
            <div>
              <div className="text-gray-600">Dimensões (cm)</div>
              <div className="font-medium">{p.dimensions.length} × {p.dimensions.width} × {p.dimensions.height}</div>
            </div>
          )}
          {p.description && (
            <div>
              <div className="text-gray-600">Descrição</div>
              <div>{p.description}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}









