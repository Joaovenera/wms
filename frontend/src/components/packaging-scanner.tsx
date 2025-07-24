import React, { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Scan, Package, Barcode, AlertCircle, CheckCircle } from "lucide-react";
import { useScanBarcode } from "../hooks/usePackaging";
import { PackagingType } from "../types/api";

interface PackagingScannerProps {
  onPackagingFound?: (packaging: PackagingType) => void;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

export function PackagingScanner({ onPackagingFound, onClose, trigger }: PackagingScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [lastScanned, setLastScanned] = useState<PackagingType | null>(null);
  const { toast } = useToast();
  
  const scanBarcode = useScanBarcode();

  const handleScan = async (barcode: string) => {
    if (!barcode.trim()) {
      toast({
        title: "Erro",
        description: "Digite um código de barras válido",
        variant: "destructive",
      });
      return;
    }

    try {
      const packaging = await scanBarcode.mutateAsync(barcode);
      setLastScanned(packaging);
      onPackagingFound?.(packaging);
      toast({
        title: "Sucesso",
        description: `Embalagem encontrada: ${packaging.name}`,
      });
      setManualCode("");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Código de barras não encontrado",
        variant: "destructive",
      });
      setLastScanned(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleScan(manualCode);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setManualCode("");
    setLastScanned(null);
    onClose?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Scan className="h-4 w-4 mr-2" />
            Escanear Embalagem
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            Scanner de Embalagens
          </DialogTitle>
          <DialogDescription>
            Escaneie ou digite o código de barras para identificar a embalagem
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Input Manual */}
          <div className="space-y-2">
            <Label htmlFor="barcode-input">Código de Barras</Label>
            <div className="flex space-x-2">
              <Input
                id="barcode-input"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite ou escaneie o código"
                autoFocus
                disabled={scanBarcode.isPending}
              />
              <Button
                onClick={() => handleScan(manualCode)}
                disabled={scanBarcode.isPending || !manualCode.trim()}
              >
                {scanBarcode.isPending ? (
                  "Buscando..."
                ) : (
                  <Scan className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Resultado do Scan */}
          {scanBarcode.error && (
            <Card className="border-destructive">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">
                    {scanBarcode.error.message || "Embalagem não encontrada"}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {lastScanned && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  Embalagem Encontrada
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Package className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium">{lastScanned.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {lastScanned.baseUnitQuantity} unidades base
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {lastScanned.isBaseUnit && (
                      <Badge variant="default">Unidade Base</Badge>
                    )}
                    <Badge variant="outline">Nível {lastScanned.level}</Badge>
                    {lastScanned.barcode && (
                      <Badge variant="secondary">
                        <Barcode className="h-3 w-3 mr-1" />
                        {lastScanned.barcode}
                      </Badge>
                    )}
                  </div>

                  {lastScanned.dimensions && (
                    <div className="text-xs text-muted-foreground">
                      Dimensões: {JSON.stringify(lastScanned.dimensions)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instruções */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>💡 Dicas:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>Use um leitor de código de barras USB ou Bluetooth</li>
              <li>Ou digite o código manualmente e pressione Enter</li>
              <li>Códigos válidos retornarão informações da embalagem</li>
            </ul>
          </div>

          {/* Ações */}
          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              Fechar
            </Button>
            {lastScanned && onPackagingFound && (
              <Button
                onClick={() => {
                  onPackagingFound(lastScanned);
                  handleClose();
                }}
              >
                Usar Embalagem
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Componente simplificado para uso inline
export function InlinePackagingScanner({ 
  onPackagingFound, 
  placeholder = "Código de barras da embalagem" 
}: {
  onPackagingFound: (packaging: PackagingType) => void;
  placeholder?: string;
}) {
  const [code, setCode] = useState("");
  const { toast } = useToast();
  const scanBarcode = useScanBarcode();

  const handleScan = async () => {
    if (!code.trim()) return;

    try {
      const packaging = await scanBarcode.mutateAsync(code);
      onPackagingFound(packaging);
      setCode("");
      toast({
        title: "Sucesso",
        description: `Embalagem encontrada: ${packaging.name}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Código de barras não encontrado",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleScan();
    }
  };

  return (
    <div className="flex space-x-2">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        disabled={scanBarcode.isPending}
      />
      <Button
        onClick={handleScan}
        disabled={scanBarcode.isPending || !code.trim()}
        size="sm"
      >
        {scanBarcode.isPending ? (
          "..."
        ) : (
          <Scan className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}