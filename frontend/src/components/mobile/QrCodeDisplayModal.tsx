import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Download } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface QrCodeDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string; // The string to encode in the QR code (e.g., product SKU)
  title?: string; // Optional title for the modal
  description?: string; // Optional description for the modal
}

export default function QrCodeDisplayModal({
  isOpen,
  onClose,
  value,
  title = "QR Code do Produto",
  description = "Escaneie para ver os detalhes do produto",
}: QrCodeDisplayModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  useEffect(() => {
    const generate = async () => {
      try {
        // Generate a Data URL directly to avoid timing issues with canvas mounting
        const url = await QRCode.toDataURL(value, { width: 512, margin: 1 });
        setQrCodeUrl(url);
      } catch (error) {
        console.error(error);
        // Fallback to canvas method if DataURL fails
        try {
          if (canvasRef.current) {
            await QRCode.toCanvas(canvasRef.current, value, { scale: 8, margin: 1 });
            const url = canvasRef.current.toDataURL("image/png");
            setQrCodeUrl(url || null);
          }
        } catch (err) {
          toast({
            title: "Erro ao gerar QR Code",
            description: "Não foi possível gerar o QR Code. Tente novamente.",
            variant: "destructive",
          });
        }
      }
    };
    if (isOpen) generate();
    else setQrCodeUrl(null);
  }, [isOpen, value, toast]);

  const handleDownload = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `qrcode-${value}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: "Download Iniciado",
        description: "O QR Code está sendo baixado.",
      });
    } else {
      toast({
        title: "Erro",
        description: "QR Code não disponível para download.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[340px] rounded-lg p-4">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold flex items-center justify-center">
            <QrCode className="mr-2 h-6 w-6" /> {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center p-4">
          {qrCodeUrl ? (
            <img src={qrCodeUrl} alt="QR Code" className="w-full h-auto max-w-[280px] border border-gray-200 rounded-md" />
          ) : (
            <canvas ref={canvasRef} className="w-full h-auto max-w-[280px] border border-gray-200 rounded-md" />
          )}
        </div>
        <Button onClick={handleDownload} className="w-full">
          <Download className="mr-2 h-4 w-4" /> Baixar QR Code
        </Button>
      </DialogContent>
    </Dialog>
  );
}
