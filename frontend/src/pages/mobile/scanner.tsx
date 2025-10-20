import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Camera, Search, Package, MapPin, Layers as PalletIcon, Loader2 } from "lucide-react";
import QrScanner from "@/components/qr-scanner";
import { useLocation } from "wouter"; // Import useLocation from wouter

interface ScanResultItem {
  type: 'pallet' | 'position' | 'ucp' | 'product';
  code: string;
  data: any;
}

export default function MobileScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [searchResults, setSearchResults] = useState<ScanResultItem[] | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation(); // Get the navigate function from wouter

  const handleScan = async (code: string) => {
    setIsScanning(false); // Close scanner after a scan
    await handleSearch(code);
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsLoadingSearch(true);
    setSearchResults(null); // Clear previous results

    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data: ScanResultItem[] = await response.json();
        if (data.length > 0) {
          setSearchResults(data);
          toast({
            title: "Resultados encontrados!",
            description: `${data.length} item(s) localizado(s) para "${query}"`, 
          });
        } else {
          toast({
            title: "Nenhum resultado encontrado",
            description: `Nenhum item encontrado para "${query}"`, 
            variant: "destructive",
          });
        }
      } else {
        const errorData = await response.json();
        toast({
          title: "Erro na busca",
          description: errorData.message || "Ocorreu um erro ao buscar os dados.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Erro de conexão",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(manualCode.trim());
  };

  const handleItemClick = (item: ScanResultItem) => {
    let url = '';
    switch (item.type) {
      case 'pallet':
        url = `/pallets/${item.data.id}`;
        break;
      case 'position':
        url = `/positions/${item.data.id}`;
        break;
      case 'ucp':
        url = `/ucps/${item.data.id}`;
        break;
      case 'product':
        url = `/products/${item.data.id}`;
        break;
      default:
        console.warn('Unknown item type for navigation:', item.type);
        return;
    }
    navigate(url);
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
          onClick={() => {
            setSearchResults(null); // Clear previous results when opening scanner
            setIsScanning(true);
          }}
          className="h-16 flex flex-col items-center space-y-1"
          disabled={isScanning}
        >
          <Camera className="h-6 w-6" />
          <span>Escanear</span>
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => {
            setSearchResults(null);
            setManualCode("");
          }}
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
            <Button type="submit" className="w-full touch-button" disabled={isLoadingSearch}>
              {isLoadingSearch ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
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

      {/* Scan Results */}
      {searchResults && searchResults.length > 0 && (
        <div className="space-y-4">
          {searchResults.map((item, index) => (
            <Card 
              key={index} 
              onClick={() => handleItemClick(item)} 
              className="cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(item.type)}
                      <h3 className="text-lg font-bold">
                        {getTypeLabel(item.type)} Encontrado
                      </h3>
                    </div>
                    {item.data.status && (
                      <Badge className={getStatusColor(item.data.status)}>
                        {getStatusLabel(item.data.status)}
                      </Badge>
                    )}
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Código:</p>
                    <p className="text-lg font-mono font-bold text-primary">{item.code}</p>
                  </div>

                  {/* Type-specific information */}
                  {item.type === 'pallet' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tipo:</span>
                        <span className="font-medium">{item.data.type}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Material:</span>
                        <span className="font-medium">{item.data.material}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Dimensões:</span>
                        <span className="font-medium">
                          {item.data.width}×{item.data.length}×{item.data.height}cm
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Carga máx:</span>
                        <span className="font-medium">{item.data.maxWeight}kg</span>
                      </div>
                    </div>
                  )}

                  {item.type === 'position' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Rua:</span>
                        <span className="font-medium">{item.data.street}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Lado:</span>
                        <span className="font-medium">{item.data.side}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Corredor:</span>
                        <span className="font-medium">{item.data.corridor}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Nível:</span>
                        <span className="font-medium">{item.data.level}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Capacidade:</span>
                        <span className="font-medium">{item.data.maxPallets} pallet(s)</span>
                      </div>
                    </div>
                  )}

                  {item.type === 'ucp' && (
                    <div className="space-y-2">
                      {item.data.pallet && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Layers:</span>
                          <span className="font-medium">{item.data.pallet.code}</span>
                        </div>
                      )}
                      {item.data.position && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Posição:</span>
                          <span className="font-medium">{item.data.position.code}</span>
                        </div>
                      )}
                      {item.data.items && (
                        <div className="text-sm">
                          <span className="text-gray-600">Itens na UCP:</span>
                          <span className="font-medium ml-2">{item.data.items.length}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {item.type === 'product' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Nome:</span>
                        <span className="font-medium">{item.data.name}</span>
                      </div>
                      {item.data.category && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Categoria:</span>
                          <span className="font-medium">{item.data.category}</span>
                        </div>
                      )}
                      {item.data.brand && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Marca:</span>
                          <span className="font-medium">{item.data.brand}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Unidade:</span>
                        <span className="font-medium">{item.data.unit}</span>
                      </div>
                    </div>
                  )}

                  {item.data.observations && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Observações:</strong> {item.data.observations}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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