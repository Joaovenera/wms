
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle } from "lucide-react";

interface FinishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  observations: string;
  setObservations: (observations: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export const FinishDialog = ({ isOpen, onClose, observations, setObservations, onSubmit, isSubmitting }: FinishDialogProps) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Finalizar Carregamento</DialogTitle>
      </DialogHeader>
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Todos os itens foram processados. O carregamento pode ser finalizado.
        </AlertDescription>
      </Alert>
      <div className="space-y-2">
        <Label htmlFor="observations">Observações Finais</Label>
        <Textarea id="observations" value={observations} onChange={(e) => setObservations(e.target.value)} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>Finalizar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
