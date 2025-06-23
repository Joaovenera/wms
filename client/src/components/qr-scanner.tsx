import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { X, Keyboard, CheckCircle, QrCode } from "lucide-react";

interface QrScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const [manualCode, setManualCode] = useState("");

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleManualSubmit();
    }
  };

  const simulateQRScan = () => {
    // Códigos de exemplo para teste
    const simulatedCodes = [
      'UCP-20250623-2023',
      'PLT0001',
      'PLT0002', 
      'PP-01-D-01-0'
    ];
    
    const randomCode = simulatedCodes[Math.floor(Math.random() * simulatedCodes.length)];
    onScan(randomCode);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Scanner QR Code
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Manual Input */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Keyboard className="h-4 w-4" />
                Digite o código manualmente
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o código QR (ex: UCP-20250623-0001)"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                  autoFocus
                />
                <Button 
                  onClick={handleManualSubmit}
                  disabled={!manualCode.trim()}
                  className="px-3"
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">ou</span>
              </div>
            </div>

            {/* Teste com códigos de exemplo */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">
                Testar com código de exemplo:
              </div>
              
              <Button 
                onClick={simulateQRScan}
                variant="outline"
                className="w-full"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Gerar código aleatório
              </Button>
            </div>

            {/* Códigos de exemplo */}
            <Card className="bg-gray-50">
              <CardContent className="p-3">
                <div className="text-xs text-gray-600 space-y-1">
                  <div><strong>Exemplos de códigos válidos:</strong></div>
                  <div>• UCP-20250623-0001 (UCPs)</div>
                  <div>• PLT0001, PLT0002 (Pallets)</div>
                  <div>• PP-01-D-01-0 (Posições)</div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}