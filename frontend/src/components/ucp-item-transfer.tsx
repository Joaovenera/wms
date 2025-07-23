import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ArrowRight, Package, AlertCircle, 
  CheckCircle, Hash, Layers, RefreshCw
} from "lucide-react";

interface UcpItemTransferProps {
  isOpen: boolean;
  onClose: () => void;
  sourceItem: {
    id: number;
    ucpId: number;
    ucpCode: string;
    quantity: string;
    lot?: string;
    internalCode?: string;
    product: {
      id: number;
      name: string;
      sku: string;
      unit?: string;
    };
  };
}

interface UcpOption {
  id: number;
  code: string;
  status: string;
  pallet?: {
    code: string;
  };
  position?: {
    code: string;
  };
}

export default function UcpItemTransfer({ isOpen, onClose, sourceItem }: UcpItemTransferProps) {
  const [targetUcpId, setTargetUcpId] = useState<number | null>(null);
  const [transferQuantity, setTransferQuantity] = useState<number>(parseInt(sourceItem.quantity));
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  // Buscar UCPs disponíveis para transferência (excluindo a UCP de origem)
  const { data: availableUcps, isLoading: ucpsLoading, error: ucpsError } = useQuery<UcpOption[]>({
    queryKey: ['/api/ucps/available-for-transfer'],
    enabled: isOpen,
    staleTime: 0, // Sempre buscar dados frescos
    gcTime: 0, // Não guardar em cache
  });

  // Debug logs
  console.log('UCP Transfer - isOpen:', isOpen);
  console.log('UCP Transfer - ucpsLoading:', ucpsLoading);
  console.log('UCP Transfer - ucpsError:', ucpsError);
  console.log('UCP Transfer - availableUcps:', availableUcps);
  console.log('UCP Transfer - sourceItem.ucpId:', sourceItem.ucpId);

  const transferMutation = useMutation({
    mutationFn: async (data: {
      sourceItemId: number;
      targetUcpId: number;
      quantity: number;
      reason: string;
    }) => {
      console.log('🚀 Frontend: Enviando transferência:', data);
      const response = await apiRequest('POST', `/api/ucps/transfer-item`, data);
      return response.json();
    },
    onSuccess: (result) => {
      console.log('✅ Frontend: Transferência completada:', result);
      
      // Invalidar cache de todas as UCPs relacionadas
      queryClient.invalidateQueries({ queryKey: ['/api/ucps'] });
      queryClient.invalidateQueries({ queryKey: [`/api/ucps/${sourceItem.ucpId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/ucps/${sourceItem.ucpId}/items`] });
      queryClient.invalidateQueries({ queryKey: ['/api/ucps/available-for-transfer'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ucps/stats'] });
      
      // Invalidar UCP de destino
      if (targetUcpId) {
        queryClient.invalidateQueries({ queryKey: [`/api/ucps/${targetUcpId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/ucps/${targetUcpId}/items`] });
      }
      
      // Force refetch de todas as queries relacionadas a UCPs
      queryClient.refetchQueries({ predicate: (query) => {
        const queryKey = query.queryKey as string[];
        return queryKey.some(key => 
          typeof key === 'string' && (
            key.includes('/api/ucps') || 
            key.includes('ucps')
          )
        );
      }});
      
      // Mostrar detalhes da transferência
      toast({
        title: "🎉 Transferência Realizada!",
        description: `${transferQuantity} unidades transferidas com sucesso. ID: ${result.transfer?.id}`,
      });

      console.log('📊 Detalhes da transferência:', {
        transferId: result.transfer?.id,
        sourceUcp: result.transfer?.sourceUcpId,
        targetUcp: result.transfer?.targetUcpId,
        performedBy: result.transfer?.performedBy?.name,
        timestamp: result.transfer?.timestamp
      });

      // Small delay to ensure cache invalidation processes
      setTimeout(() => {
        onClose();
        resetForm();
      }, 500);
    },
    onError: (error: any) => {
      console.error('❌ Frontend: Erro na transferência:', error);
      
      toast({
        title: "Erro na Transferência",
        description: error.message || "Erro desconhecido na transferência",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setTargetUcpId(null);
    setTransferQuantity(parseInt(sourceItem.quantity));
    setReason("");
  };

  const handleTransfer = () => {
    console.log('🔍 Frontend: Validando dados da transferência...');

    // Validações do frontend
    if (!targetUcpId) {
      console.log('❌ Frontend: UCP de destino não selecionada');
      toast({
        title: "Erro de Validação",
        description: "Por favor, selecione uma UCP de destino",
        variant: "destructive",
      });
      return;
    }

    if (transferQuantity <= 0 || transferQuantity > parseInt(sourceItem.quantity)) {
      console.log('❌ Frontend: Quantidade inválida:', {
        transferQuantity,
        maxQuantity: parseInt(sourceItem.quantity)
      });
      toast({
        title: "Quantidade Inválida",
        description: `Quantidade deve ser entre 1 e ${parseInt(sourceItem.quantity)}`,
        variant: "destructive",
      });
      return;
    }

    if (!reason.trim()) {
      console.log('❌ Frontend: Motivo não informado');
      toast({
        title: "Motivo Obrigatório",
        description: "Por favor, informe o motivo da transferência",
        variant: "destructive",
      });
      return;
    }

    if (targetUcpId === sourceItem.ucpId) {
      console.log('❌ Frontend: UCP de destino igual à origem');
      toast({
        title: "Erro de Destino",
        description: "A UCP de destino deve ser diferente da origem",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ Frontend: Validações aprovadas, enviando transferência...');

    const transferData = {
      sourceItemId: sourceItem.id,
      targetUcpId,
      quantity: transferQuantity,
      reason: reason.trim(),
    };

    console.log('📤 Frontend: Dados da transferência:', transferData);

    transferMutation.mutate(transferData);
  };

  const selectedTargetUcp = availableUcps?.find(ucp => ucp.id === targetUcpId);
  const maxQuantity = parseInt(sourceItem.quantity);
  const isPartialTransfer = transferQuantity < maxQuantity;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Transferir Item entre UCPs
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item de Origem */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">Item de Origem</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{sourceItem.product.name}</span>
                  <Badge variant="outline">{sourceItem.product.sku}</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">UCP:</span> {sourceItem.ucpCode}
                  </div>
                  <div>
                    <span className="font-medium">Quantidade:</span> {sourceItem.quantity} {sourceItem.product.unit || 'un'}
                  </div>
                  {sourceItem.lot && (
                    <div>
                      <span className="font-medium">Lote:</span> {sourceItem.lot}
                    </div>
                  )}
                  {sourceItem.internalCode && (
                    <div>
                      <span className="font-medium">CI:</span> {sourceItem.internalCode}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuração da Transferência */}
          <div className="space-y-4">
            {/* UCP de Destino */}
            <div>
              <Label htmlFor="target-ucp">UCP de Destino</Label>
              <Select onValueChange={(value) => setTargetUcpId(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder={
                    ucpsLoading ? "Carregando UCPs..." : 
                    ucpsError ? "Erro ao carregar UCPs" :
                    !availableUcps ? "Nenhuma UCP disponível" :
                    "Selecione a UCP de destino..."
                  } />
                </SelectTrigger>
                <SelectContent>
                  {ucpsLoading && (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      Carregando UCPs...
                    </div>
                  )}
                  {ucpsError && (
                    <div className="p-2 text-center text-sm text-red-600">
                      Erro: {ucpsError.message}
                    </div>
                  )}
                  {availableUcps && availableUcps.length === 0 && (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      Nenhuma UCP ativa disponível
                    </div>
                  )}
                  {availableUcps?.filter(ucp => ucp.id !== sourceItem.ucpId).map((ucp) => (
                    <SelectItem key={ucp.id} value={ucp.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{ucp.code}</span>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                          {ucp.status}
                        </Badge>
                        {ucp.pallet && (
                          <Badge variant="outline" className="text-xs">
                            {ucp.pallet.code}
                          </Badge>
                        )}
                        {ucp.position && (
                          <Badge variant="outline" className="text-xs">
                            {ucp.position.code}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Debug info */}
              {availableUcps && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Debug: {availableUcps.length} UCPs encontradas, {availableUcps.filter(ucp => ucp.id !== sourceItem.ucpId).length} disponíveis para transferência
                </div>
              )}
            </div>

            {/* Quantidade a Transferir */}
            <div>
              <Label htmlFor="quantity">
                Quantidade a Transferir (máx: {maxQuantity})
              </Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={maxQuantity}
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(parseInt(e.target.value) || 0)}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">
                  {sourceItem.product.unit || 'un'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTransferQuantity(maxQuantity)}
                >
                  Máx
                </Button>
              </div>
              
              {isPartialTransfer && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-yellow-800">
                      Transferência parcial: {maxQuantity - transferQuantity} unidades permanecerão na UCP original
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Motivo da Transferência */}
            <div>
              <Label htmlFor="reason">Motivo da Transferência</Label>
              <Textarea
                id="reason"
                placeholder="Ex: Reorganização de estoque, consolidação de lotes, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Preview da Transferência */}
          {selectedTargetUcp && transferQuantity > 0 && (
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-900">Preview da Transferência</span>
                  <Badge 
                    variant="outline" 
                    className={`ml-auto text-xs ${isPartialTransfer ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : 'bg-red-50 text-red-700 border-red-300'}`}
                  >
                    {isPartialTransfer ? 'Transferência Parcial' : 'Transferência Total'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4 items-center">
                  {/* Origem */}
                  <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="font-medium text-blue-900 mb-1">Origem</div>
                    <Badge variant="outline" className="mb-2">{sourceItem.ucpCode}</Badge>
                    <div className="text-xs text-blue-700">
                      <div className="font-medium">{sourceItem.product.name}</div>
                      <div className="mt-1">
                        {isPartialTransfer ? (
                          <>Ficará com: <span className="font-bold">{maxQuantity - transferQuantity}</span> {sourceItem.product.unit || 'un'}</>
                        ) : (
                          <span className="text-red-600 font-bold">Item será removido</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Seta e quantidade */}
                  <div className="text-center">
                    <div className="flex justify-center items-center mb-2">
                      <ArrowRight className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="bg-green-100 border border-green-300 rounded-lg p-2">
                      <div className="text-sm font-medium text-green-800">Transferindo</div>
                      <div className="text-lg font-bold text-green-900">
                        {transferQuantity} {sourceItem.product.unit || 'un'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Destino */}
                  <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="font-medium text-green-900 mb-1">Destino</div>
                    <Badge variant="outline" className="mb-2">{selectedTargetUcp.code}</Badge>
                    <div className="text-xs text-green-700">
                      <div>Receberá: <span className="font-bold">{transferQuantity}</span> {sourceItem.product.unit || 'un'}</div>
                      {selectedTargetUcp.pallet && (
                        <div className="mt-1">Pallet: {selectedTargetUcp.pallet.code}</div>
                      )}
                      {selectedTargetUcp.position && (
                        <div>Posição: {selectedTargetUcp.position.code}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resumo do motivo */}
                {reason.trim() && (
                  <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-1">Motivo da Transferência:</div>
                    <div className="text-sm text-gray-600 italic">"{reason.trim()}"</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Botões */}
          <div className="flex justify-between items-center">
            {/* Status */}
            <div className="flex items-center gap-2">
              {transferMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processando transferência...</span>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={onClose}
                disabled={transferMutation.isPending}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleTransfer}
                disabled={
                  !targetUcpId || 
                  transferQuantity <= 0 || 
                  transferQuantity > maxQuantity ||
                  !reason.trim() || 
                  transferMutation.isPending ||
                  targetUcpId === sourceItem.ucpId
                }
                className="bg-green-600 hover:bg-green-700"
              >
                {transferMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Transferindo...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Confirmar Transferência
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 