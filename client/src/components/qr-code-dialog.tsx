import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, QrCode } from "lucide-react";

interface QRCodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  palletCode: string;
  palletData?: {
    code: string;
    type: string;
    material: string;
    dimensions: string;
    maxWeight: string;
  };
}

export default function QRCodeDialog({ isOpen, onClose, palletCode, palletData }: QRCodeDialogProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && palletCode) {
      generateQRCode();
    }
  }, [isOpen, palletCode]);

  const generateQRCode = async () => {
    try {
      // Detectar tipo baseado no código ou nos dados fornecidos
      let itemType = "PALLET";
      if (palletCode.startsWith('PP-')) {
        itemType = "POSITION";
      } else if (palletCode.includes('Porta-Pallet')) {
        itemType = "STRUCTURE";
      }
      
      // Gerar QR code com dados do item
      const qrData = JSON.stringify({
        type: itemType,
        code: palletCode
      });
      
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrCodeUrl(qrCodeDataUrl);
    } catch (error) {
      console.error("Erro ao gerar QR code:", error);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && qrCodeUrl) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${palletCode}</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              background: white;
            }
            .qr-container {
              text-align: center;
              border: 2px solid #000;
              padding: 20px;
              background: white;
            }
            .qr-code {
              margin: 10px 0;
            }
            .pallet-code {
              font-size: 24px;
              font-weight: bold;
              margin: 10px 0;
              letter-spacing: 2px;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .qr-container { margin: 0; border: none; }
              @page { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="qr-code">
              <img src="${qrCodeUrl}" alt="QR Code ${palletCode}" />
            </div>
            <div class="pallet-code">${palletCode}</div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const handleDownload = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.download = `qrcode-${palletCode}.png`;
      link.href = qrCodeUrl;
      link.click();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code - {palletCode}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4 py-4">
          {qrCodeUrl && (
            <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
              <img 
                src={qrCodeUrl} 
                alt={`QR Code ${palletCode}`}
                className="w-64 h-64"
              />
            </div>
          )}
          
          <div className="text-center">
            <div className="text-lg font-bold tracking-wider">{palletCode}</div>
            <div className="text-sm text-gray-600 mt-1">
              Escaneie para identificar {
                palletCode.startsWith('PP-') ? 'a posição' : 
                palletCode.includes('Porta-Pallet') ? 'a estrutura' : 
                'o pallet'
              }
            </div>
          </div>

          {palletData && (
            <div className="w-full bg-gray-50 rounded-lg p-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Tipo:</strong> {palletData.type}</div>
                <div><strong>Material:</strong> {palletData.material}</div>
                <div><strong>Dimensões:</strong> {palletData.dimensions}</div>
                <div><strong>Carga Máx:</strong> {palletData.maxWeight}</div>
              </div>
            </div>
          )}
          
          <div className="flex gap-2 w-full">
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex-1"
              disabled={!qrCodeUrl}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
            <Button
              onClick={handlePrint}
              className="flex-1"
              disabled={!qrCodeUrl}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}