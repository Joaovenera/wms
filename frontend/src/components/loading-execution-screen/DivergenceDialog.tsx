
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingItem } from "@/types/api";

const DIVERGENCE_REASONS = [
  { value: 'falta_espaco', label: 'Falta de espaço no caminhão' },
  { value: 'item_avariado', label: 'Item avariado' },
  { value: 'divergencia_estoque', label: 'Divergência de estoque' },
  { value: 'item_nao_localizado', label: 'Item não localizado' },
];

interface DivergenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: LoadingItem | null;
  reason: string;
  setReason: (reason: string) => void;
  comments: string;
  setComments: (comments: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export const DivergenceDialog = ({ isOpen, onClose, item, reason, setReason, comments, setComments, onSubmit, isSubmitting }: DivergenceDialogProps) => {
  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Divergência</DialogTitle>
        </DialogHeader>
        <div>
          <h4 className="font-medium">{item.productName}</h4>
          <p className="text-sm text-gray-600">SKU: {item.productSku}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Motivo</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="reason">
              <SelectValue placeholder="Selecione o motivo" />
            </SelectTrigger>
            <SelectContent>
              {DIVERGENCE_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="comments">Comentários</Label>
          <Textarea id="comments" value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={isSubmitting} variant="destructive">Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
