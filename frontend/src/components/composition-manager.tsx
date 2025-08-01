import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "./ui/alert";
import { 
  Plus, 
  Package, 
  Users, 
  Edit, 
  Trash2, 
  Save, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  BarChart3,
  Settings,
  Eye,
  RefreshCw
} from "lucide-react";
import { 
  useCompositions,
  useCreateComposition,
  useValidateComposition,
  useSaveComposition,
  useDeleteComposition,
  useUpdateCompositionStatus,
  useGenerateCompositionReport,
  useRealtimeCompositionValidation
} from "../hooks/useComposition";
import { 
  PackagingComposition, 
  CompositionRequest, 
  CompositionResult,
  ValidationResult
} from "../types/api";
import { CompositionAssembly } from "./composition-assembly";
import { CompositionValidator } from "./composition-validator";
import { CompositionVisualization } from "./composition-visualization";

interface CompositionManagerProps {
  className?: string;
}

export function CompositionManager({ className }: CompositionManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingComposition, setEditingComposition] = useState<PackagingComposition | null>(null);
  const [viewingComposition, setViewingComposition] = useState<PackagingComposition | null>(null);
  const [compositionRequest, setCompositionRequest] = useState<CompositionRequest | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();

  // Fetch compositions with filters
  const { data: compositions, isLoading } = useCompositions(
    filterStatus !== "all" ? { status: filterStatus } : undefined
  );

  // Mutations
  const createComposition = useCreateComposition();
  const validateComposition = useValidateComposition();
  const saveComposition = useSaveComposition();
  const deleteComposition = useDeleteComposition();
  const updateStatus = useUpdateCompositionStatus();
  const generateReport = useGenerateCompositionReport();

  // Real-time validation for composition request
  const { data: realtimeValidation } = useRealtimeCompositionValidation(
    compositionRequest,
    !!compositionRequest
  );

  useEffect(() => {
    if (realtimeValidation) {
      setValidationResults(realtimeValidation);
    }
  }, [realtimeValidation]);

  const handleCreateComposition = async (request: CompositionRequest, metadata: {
    name: string;
    description?: string;
  }) => {
    try {
      const result = await createComposition.mutateAsync(request);
      
      if (result.isValid) {
        // Save the composition if valid
        await saveComposition.mutateAsync({
          name: metadata.name,
          description: metadata.description,
          compositionData: result,
          products: request.products,
          palletId: request.palletId || 0,
          status: 'validated',
        });

        toast({
          title: "Sucesso",
          description: "Composição criada e validada com sucesso!",
        });
        setIsCreateDialogOpen(false);
        setCompositionRequest(null);
      } else {
        toast({
          title: "Composição inválida",
          description: "A composição não atende aos requisitos. Verifique as recomendações.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar composição",
        variant: "destructive",
      });
    }
  };

  const handleValidateComposition = async (request: CompositionRequest) => {
    try {
      const validation = await validateComposition.mutateAsync(request);
      setValidationResults(validation);
      
      if (validation.isValid) {
        toast({
          title: "Validação bem-sucedida",
          description: `Composição válida com eficiência de ${(validation.metrics.efficiency * 100).toFixed(1)}%`,
        });
      } else {
        toast({
          title: "Validação falhou",
          description: `${validation.violations.length} violação(ões) encontrada(s)`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro na validação",
        description: error.message || "Erro ao validar composição",
        variant: "destructive",
      });
    }
  };

  const handleUpdateStatus = async (composition: PackagingComposition, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({
        id: composition.id,
        status: newStatus as any,
      });
      
      toast({
        title: "Status atualizado",
        description: `Composição "${composition.name}" marcada como ${getStatusLabel(newStatus)}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar status",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (composition: PackagingComposition) => {
    if (!confirm(`Tem certeza que deseja excluir a composição "${composition.name}"?`)) {
      return;
    }

    try {
      await deleteComposition.mutateAsync(composition.id);
      toast({
        title: "Sucesso",
        description: "Composição excluída com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir composição",
        variant: "destructive",
      });
    }
  };

  const handleGenerateReport = async (composition: PackagingComposition) => {
    try {
      const report = await generateReport.mutateAsync({
        compositionId: composition.id,
        includeMetrics: true,
        includeRecommendations: true,
        includeCostAnalysis: true,
      });
      
      // Here you could open the report in a new dialog or download it
      toast({
        title: "Relatório gerado",
        description: `Relatório da composição "${composition.name}" gerado com sucesso`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao gerar relatório",
        variant: "destructive",
      });
    }
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      draft: "Rascunho",
      validated: "Validado",
      approved: "Aprovado",
      executed: "Executado",
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      validated: "secondary",
      approved: "default",
      executed: "destructive",
    };
    return variants[status] || "outline";
  };

  const getEfficiencyColor = (efficiency: number): string => {
    if (efficiency >= 0.8) return "text-green-600";
    if (efficiency >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Carregando composições...</div>;
  }

  return (
    <div className={`space-y-4 md:space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">Gerenciador de Composições</h2>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie composições otimizadas de produtos em pallets
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="validated">Validado</SelectItem>
              <SelectItem value="approved">Aprovado</SelectItem>
              <SelectItem value="executed">Executado</SelectItem>
            </SelectContent>
          </Select>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden xs:inline">Nova Composição</span>
                <span className="xs:hidden">Nova</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Nova Composição</DialogTitle>
                <DialogDescription>
                  Configure produtos, quantidades e restrições para criar uma composição otimizada
                </DialogDescription>
              </DialogHeader>
              
              <CompositionAssembly
                onCompositionCreate={handleCreateComposition}
                onCompositionValidate={handleValidateComposition}
                onCancel={() => {
                  setIsCreateDialogOpen(false);
                  setCompositionRequest(null);
                  setValidationResults(null);
                }}
                isLoading={createComposition.isPending || validateComposition.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Validation Results */}
      {validationResults && (
        <CompositionValidator 
          validationResults={validationResults}
          onDismiss={() => setValidationResults(null)}
        />
      )}

      {/* Compositions List */}
      <div className="grid gap-4">
        {!compositions || compositions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma composição encontrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {filterStatus !== "all" 
                  ? `Não há composições com status "${getStatusLabel(filterStatus)}"`
                  : "Comece criando uma nova composição de produtos"
                }
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira composição
              </Button>
            </CardContent>
          </Card>
        ) : (
          compositions.map((composition) => (
            <Card key={composition.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{composition.name}</h3>
                      <Badge variant={getStatusBadge(composition.status)}>
                        {getStatusLabel(composition.status)}
                      </Badge>
                      {composition.result.isValid ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    
                    {composition.description && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {composition.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-lg md:text-2xl font-bold">
                          {composition.products.length}
                        </div>
                        <div className="text-xs text-muted-foreground">Produtos</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className={`text-lg md:text-2xl font-bold ${getEfficiencyColor(composition.result.efficiency)}`}>
                          {(composition.result.efficiency * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Eficiência</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-lg md:text-2xl font-bold">
                          {composition.result.weight.utilization.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Peso</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-lg md:text-2xl font-bold">
                          {composition.result.volume.utilization.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Volume</div>
                      </div>
                    </div>

                    {/* Warnings and Recommendations */}
                    {composition.result.warnings.length > 0 && (
                      <Alert className="mb-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Avisos:</strong> {composition.result.warnings.join(", ")}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Criado em {new Date(composition.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>ID: {composition.id}</span>
                      {composition.pallet && (
                        <>
                          <span>•</span>
                          <span>Pallet: {composition.pallet.code}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setViewingComposition(composition);
                        setIsViewDialogOpen(true);
                      }}
                      className="touch-manipulation"
                    >
                      <Eye className="h-3 w-3" />
                      <span className="ml-1 sm:hidden">Ver</span>
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateReport(composition)}
                      disabled={generateReport.isPending}
                      className="touch-manipulation"
                    >
                      <BarChart3 className="h-3 w-3" />
                      <span className="ml-1 sm:hidden">Rel</span>
                    </Button>

                    {composition.status === 'draft' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(composition, 'validated')}
                        disabled={updateStatus.isPending}
                        className="touch-manipulation"
                      >
                        <CheckCircle className="h-3 w-3" />
                        <span className="ml-1 sm:hidden">Val</span>
                      </Button>
                    )}

                    {composition.status === 'validated' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(composition, 'approved')}
                        disabled={updateStatus.isPending}
                        className="touch-manipulation"
                      >
                        <CheckCircle className="h-3 w-3" />
                        <span className="ml-1 sm:hidden">Apr</span>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingComposition(composition);
                        setIsEditDialogOpen(true);
                      }}
                      className="touch-manipulation"
                    >
                      <Edit className="h-3 w-3" />
                      <span className="ml-1 sm:hidden">Edit</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(composition)}
                      disabled={composition.status === 'executed'}
                      className="touch-manipulation text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span className="ml-1 sm:hidden">Del</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Visualizar Composição: {viewingComposition?.name}
            </DialogTitle>
            <DialogDescription>
              Detalhes completos da composição e layout dos produtos
            </DialogDescription>
          </DialogHeader>
          
          {viewingComposition && (
            <CompositionVisualization composition={viewingComposition} />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar Composição: {editingComposition?.name}
            </DialogTitle>
            <DialogDescription>
              Modifique os produtos e configurações da composição
            </DialogDescription>
          </DialogHeader>
          
          {editingComposition && (
            <CompositionAssembly
              initialComposition={editingComposition}
              onCompositionCreate={(request, metadata) => {
                // Handle edit logic here
                setIsEditDialogOpen(false);
                setEditingComposition(null);
              }}
              onCompositionValidate={handleValidateComposition}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setEditingComposition(null);
              }}
              isLoading={saveComposition.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}