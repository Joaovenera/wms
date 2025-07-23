import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Camera, Search, Package, MapPin, Layers as PalletIcon } from "lucide-react";
import QrScanner from "@/components/qr-scanner";

interface ScanResult {
  type: 'pallet' | 'position' | 'ucp' | 'product';
  code: string;
  data: any;
}

export default function MobileScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const { toast } = useToast();

  const handleScan = async (code: string) => {
    try {
      // Try to determine what type of code this is and fetch data
      let result: ScanResult | null = null;

      // Try pallet first
      try {
        const response = await fetch(`/api/pallets/code/${code}`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          result = { type: 'pallet', code, data };
        }
      } catch (e) {
        // Continue to next type
      }

      // Try position if not pallet
      if (!result) {
        try {
          const response = await fetch(`/api/positions/code/${code}`, {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            result = { type: 'position', code, data };
          }
        } catch (e) {
          // Continue to next type
        }
      }

      // Try UCP if not position
      if (!result) {
        try {
          const response = await fetch(`/api/ucps/code/${code}`, {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            result = { type: 'ucp', code, data };
          }
        } catch (e) {
          // Continue to next type
        }
      }

      // Try product SKU if nothing else
      if (!result) {
        try {
          const response = await fetch(`/api/products/sku/${code}`, {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            result = { type: 'product', code, data };
          }
        } catch (e) {
          // No matches found
        }
      }

      if (result) {
        setScanResult(result);
        setIsScanning(false);
        toast({
          title: "Código encontrado!",
          description: `${result.type.toUpperCase()} ${result.code} localizado`,
        });
      } else {
        toast({
          title: "Código não encontrado",
          description: `Nenhum item encontrado com o código ${code}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao buscar código",
        description: "Verifique sua conexão e tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pallet': return <PalletIcon className="h-5 w-5" />;
      case 'position': return <MapPin className="h-5 w-5" />;
      case 'ucp': return <Package className="h-5 w-5" />;
      case 'product': return <Package className="h-5 w-5" />;
      default: return <QrCode className="h-5 w-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'pallet': return 'Layers';
      case 'position': return 'Posição';
      case 'ucp': return 'UCP';
      case 'product': return 'Produto';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'disponivel': return 'bg-success';
      case 'em_uso': 
      case 'occupied': return 'bg-destructive';
      case 'active': return 'bg-success';
      case 'defeituoso': return 'bg-warning';
      case 'manutencao': return 'bg-primary';
      case 'reserved': return 'bg-warning';
      case 'blocked': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'disponivel': return 'Disponível';
      case 'em_uso': return 'Em Uso';
      case 'occupied': return 'Ocupada';
      case 'active': return 'Ativa';
      case 'defeituoso': return 'Defeituoso';
      case 'manutencao': return 'Manutenção';
      case 'reserved': return 'Reservada';
      case 'blocked': return 'Bloqueada';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Scanner Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Scanner QR Code</h1>
        <p className="text-gray-600">Escaneie ou digite o código para localizar itens</p>
      </div>

      {/* Scanner Options */}
      <div className="grid grid-cols-2 gap-4">
        <Button 
          onClick={() => setIsScanning(true)}
          className="h-16 flex flex-col items-center space-y-1"
          disabled={isScanning}
        >
          <Camera className="h-6 w-6" />
          <span>Escanear</span>
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => setScanResult(null)}
          className="h-16 flex flex-col items-center space-y-1"
        >
          <Search className="h-6 w-6" />
          <span>Limpar</span>
        </Button>
      </div>

      {/* Manual Input */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <Label htmlFor="manual-code">Código Manual</Label>
              <Input
                id="manual-code"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Digite o código (PLT001, RUA01-E-A01-N01, etc.)"
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full touch-button">
              <Search className="h-4 w-4 mr-2" />
              Buscar Código
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* QR Scanner Component */}
      {isScanning && (
        <QrScanner
          onScan={handleScan}
          onClose={() => setIsScanning(false)}
        />
      )}

      {/* Scan Result */}
      {scanResult && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(scanResult.type)}
                  <h3 className="text-lg font-bold">
                    {getTypeLabel(scanResult.type)} Encontrado
                  </h3>
                </div>
                <Badge className={getStatusColor(scanResult.data.status)}>
                  {getStatusLabel(scanResult.data.status)}
                </Badge>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Código:</p>
                <p className="text-lg font-mono font-bold text-primary">{scanResult.code}</p>
              </div>

              {/* Type-specific information */}
              {scanResult.type === 'pallet' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-medium">{scanResult.data.type}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Material:</span>
                    <span className="font-medium">{scanResult.data.material}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Dimensões:</span>
                    <span className="font-medium">
                      {scanResult.data.width}×{scanResult.data.length}×{scanResult.data.height}cm
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Carga máx:</span>
                    <span className="font-medium">{scanResult.data.maxWeight}kg</span>
                  </div>
                </div>
              )}

              {scanResult.type === 'position' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Rua:</span>
                    <span className="font-medium">{scanResult.data.street}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Lado:</span>
                    <span className="font-medium">{scanResult.data.side}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Corredor:</span>
                    <span className="font-medium">{scanResult.data.corridor}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Nível:</span>
                    <span className="font-medium">{scanResult.data.level}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Capacidade:</span>
                    <span className="font-medium">{scanResult.data.maxPallets} pallet(s)</span>
                  </div>
                </div>
              )}

              {scanResult.type === 'ucp' && (
                <div className="space-y-2">
                  {scanResult.data.pallet && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Layers:</span>
                      <span className="font-medium">{scanResult.data.pallet.code}</span>
                    </div>
                  )}
                  {scanResult.data.position && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Posição:</span>
                      <span className="font-medium">{scanResult.data.position.code}</span>
                    </div>
                  )}
                  {scanResult.data.items && (
                    <div className="text-sm">
                      <span className="text-gray-600">Itens na UCP:</span>
                      <span className="font-medium ml-2">{scanResult.data.items.length}</span>
                    </div>
                  )}
                </div>
              )}

              {scanResult.type === 'product' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Nome:</span>
                    <span className="font-medium">{scanResult.data.name}</span>
                  </div>
                  {scanResult.data.category && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Categoria:</span>
                      <span className="font-medium">{scanResult.data.category}</span>
                    </div>
                  )}
                  {scanResult.data.brand && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Marca:</span>
                      <span className="font-medium">{scanResult.data.brand}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Unidade:</span>
                    <span className="font-medium">{scanResult.data.unit}</span>
                  </div>
                </div>
              )}

              {scanResult.data.observations && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Observações:</strong> {scanResult.data.observations}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium text-gray-800 mb-2">Como usar:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Clique em "Escanear" para abrir a câmera</li>
            <li>• Posicione o QR Code dentro do quadro</li>
            <li>• Ou digite o código manualmente</li>
            <li>• Suporta códigos de pallets, posições, UCPs e produtos</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
