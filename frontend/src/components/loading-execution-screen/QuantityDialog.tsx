
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingItem } from "@/types/api";

interface QuantityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: LoadingItem | null;
  quantity: number;
  setQuantity: (quantity: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export const QuantityDialog = ({ isOpen, onClose, item, quantity, setQuantity, onSubmit, isSubmitting }: QuantityDialogProps) => {
  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Informar Quantidade</DialogTitle>
        </DialogHeader>
        <div>
          <h4 className="font-medium">{item.productName}</h4>
          <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
          <p className="text-sm">Solicitado: <strong>{item.requestedQuantity}</strong></p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantidade carregada</Label>
          <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(parseFloat(e.target.value))} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
