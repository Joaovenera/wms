import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Search, RefreshCw, Scan, MapPin, QrCode, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { insertPositionSchema, type Position, type InsertPosition } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import QRCodeDialog from "@/components/qr-code-dialog";
import QrScanner from "@/components/qr-scanner";

export default function Positions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [streetFilter, setStreetFilter] = useState<string>("all");
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [scannedPosition, setScannedPosition] = useState<Position | null>(null);
  const [qrCodeDialog, setQrCodeDialog] = useState<{ isOpen: boolean; position?: Position }>({ isOpen: false });

  const form = useForm({
    resolver: zodResolver(insertPositionSchema),
    defaultValues: {
      code: "",
      street: "1",
      position: 1,
      level: 1,
      side: "E",
      rackType: "convencional",
      status: "available",
      maxPallets: 1,
      hasDivision: false,
      restrictions: "",
      observations: ""
    },
  });

  // Automatic refresh with debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm, statusFilter, streetFilter, queryClient]);

  const { data: positions = [], isLoading, refetch } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertPosition) => {
      const response = await apiRequest('POST', '/api/positions', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Posição criada com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar posição",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertPosition) => {
      if (!editingPosition) throw new Error("No position selected for editing");
      const response = await apiRequest('PATCH', `/api/positions/${editingPosition.id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setIsDialogOpen(false);
      setEditingPosition(null);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Posição atualizada com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar posição",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/positions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      toast({
        title: "Sucesso",
        description: "Posição excluída com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir posição",
        variant: "destructive",
      });
    },
  });

  const handleQrCodeScan = async (scannedCode: string) => {
    try {
      const position = positions.find(p => p.code === scannedCode);
      
      if (position) {
        setScannedPosition(position);
        setIsQrScannerOpen(false);
        
        const statusText = position.status === 'available' ? 'Disponível' : 
                          position.status === 'occupied' ? 'Ocupada' : 
                          position.status === 'reserved' ? 'Reservada' : 
                          position.status === 'maintenance' ? 'Em Manutenção' : 'Bloqueada';
        
        const statusColor = position.status === 'available' ? 'default' : 'destructive';
        
        toast({
          title: `Posição ${position.code}`,
          description: `Status: ${statusText} | Rua: ${position.street} | Lado: ${position.side} | Nível: ${position.level}`,
          variant: statusColor,
        });
      } else {
        toast({
          title: "Posição não encontrada",
          description: `Código ${scannedCode} não corresponde a nenhuma posição cadastrada.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao processar QR Code",
        description: "Não foi possível processar o código escaneado.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: InsertPosition) => {
    if (editingPosition) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (position: Position) => {
    setEditingPosition(position);
    form.reset({
      street: position.street,
      position: position.position,
      level: position.level,
      side: position.side,
      rackType: position.rackType || "convencional",
      status: position.status,
      maxPallets: position.maxPallets,
      hasDivision: Boolean(position.hasDivision),
      restrictions: position.restrictions || "",
      observations: position.observations || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (position: Position) => {
    if (window.confirm(`Tem certeza que deseja excluir a posição ${position.code}?`)) {
      deleteMutation.mutate(position.id);
    }
  };

  const getStatusIcon = (position: Position) => {
    switch (position.status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'occupied':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'reserved':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'maintenance':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      available: { label: "Disponível", variant: "default" as const },
      occupied: { label: "Ocupada", variant: "destructive" as const },
      reserved: { label: "Reservada", variant: "secondary" as const },
      maintenance: { label: "Manutenção", variant: "outline" as const },
      blocked: { label: "Bloqueada", variant: "destructive" as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.blocked;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleShowQRCode = (position: Position) => {
    setQrCodeDialog({ isOpen: true, position });
  };

  const handleCloseQRCode = () => {
    setQrCodeDialog({ isOpen: false });
  };

  const filteredPositions = positions.filter(position => {
    const matchesSearch = 
      position.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      position.street.toString().includes(searchTerm) ||
      position.position.toString().includes(searchTerm);
    
    const matchesStatus = statusFilter === "all" || position.status === statusFilter;
    const matchesStreet = streetFilter === "all" || position.street.toString() === streetFilter;
    
    return matchesSearch && matchesStatus && matchesStreet;
  });

  const uniqueStreets = Array.from(new Set(positions.map(p => p.street))).sort();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Posições</h1>
          <p className="text-muted-foreground">
            Gerencie as posições de armazenamento do armazém
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsQrScannerOpen(true)}
            variant="outline"
          >
            <Scan className="h-4 w-4 mr-2" />
            Escanear Vaga
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setEditingPosition(null);
                  form.reset();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Posição
              </Button>
            </DialogTrigger>
            
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingPosition ? "Editar Posição" : "Nova Posição"}
                </DialogTitle>
                <DialogDescription>
                  {editingPosition 
                    ? "Atualize as informações da posição." 
                    : "Crie uma nova posição de armazenamento. O código será gerado automaticamente."
                  }
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rua</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              placeholder="1" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Posição</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              placeholder="1" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nível</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0" 
                              placeholder="0" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="side"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lado</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o lado" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="E">Esquerdo (E)</SelectItem>
                              <SelectItem value="D">Direito (D)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rackType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Porta-Pallet</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="convencional">Convencional</SelectItem>
                              <SelectItem value="dupla_profundidade">Dupla Profundidade</SelectItem>
                              <SelectItem value="flow_rack">Flow Rack</SelectItem>
                              <SelectItem value="push_back">Push Back</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="available">Disponível</SelectItem>
                              <SelectItem value="occupied">Ocupada</SelectItem>
                              <SelectItem value="reserved">Reservada</SelectItem>
                              <SelectItem value="maintenance">Em Manutenção</SelectItem>
                              <SelectItem value="blocked">Bloqueada</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maxPallets"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacidade (Pallets)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              max="2" 
                              placeholder="1" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="restrictions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Restrições</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descreva restrições de peso, altura, tipo de produto, etc."
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="observations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Observações adicionais sobre a posição"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código, rua ou posição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
                    }
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="available">Disponível</SelectItem>
                  <SelectItem value="occupied">Ocupada</SelectItem>
                  <SelectItem value="reserved">Reservada</SelectItem>
                  <SelectItem value="maintenance">Em Manutenção</SelectItem>
                  <SelectItem value="blocked">Bloqueada</SelectItem>
                </SelectContent>
              </Select>

              <Select value={streetFilter} onValueChange={setStreetFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Rua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueStreets.map(street => (
                    <SelectItem key={street} value={street.toString()}>
                      Rua {street}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                onClick={() => refetch()} 
                variant="outline" 
                size="icon"
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Lista de Posições */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando posições...</p>
        </div>
      ) : filteredPositions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma posição encontrada</h3>
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== "all" || streetFilter !== "all" 
                ? "Tente ajustar os filtros de busca." 
                : "Crie sua primeira posição para começar."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPositions.map((position) => (
            <Card key={position.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(position)}
                    <div>
                      <CardTitle className="text-lg font-mono">{position.code}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Rua {position.street} • {position.side === 'E' ? 'Esquerdo' : 'Direito'} • Nível {position.level}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(position.status)}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Capacidade:</span>
                      <p className="font-medium">{position.maxPallets} pallet(s)</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>
                      <p className="font-medium">{position.rackType || 'Convencional'}</p>
                    </div>
                  </div>
                  
                  {position.restrictions && (
                    <div>
                      <span className="text-muted-foreground text-sm">Restrições:</span>
                      <p className="text-sm">{position.restrictions}</p>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleShowQRCode(position)}
                      className="flex-1"
                    >
                      <QrCode className="h-4 w-4 mr-1" />
                      QR Code
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEdit(position)}
                    >
                      Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDelete(position)}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Dialog */}
      <QRCodeDialog
        isOpen={qrCodeDialog.isOpen}
        onClose={handleCloseQRCode}
        palletCode={qrCodeDialog.position?.code || ""}
        palletData={qrCodeDialog.position ? {
          code: qrCodeDialog.position.code,
          type: "Posição",
          material: qrCodeDialog.position.rackType || "Convencional",
          dimensions: `Rua ${qrCodeDialog.position.street} - Posição ${qrCodeDialog.position.position} - Nível ${qrCodeDialog.position.level}`,
          maxWeight: `${qrCodeDialog.position.maxPallets} pallet(s)`
        } : undefined}
      />

      {/* QR Scanner for Position Verification */}
      {isQrScannerOpen && (
        <QrScanner
          onScan={handleQrCodeScan}
          onClose={() => setIsQrScannerOpen(false)}
        />
      )}

      {/* Scanned Position Info Dialog */}
      {scannedPosition && (
        <Dialog open={!!scannedPosition} onOpenChange={() => setScannedPosition(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Informações da Vaga Escaneada</DialogTitle>
              <DialogDescription>
                Verificação de disponibilidade da posição {scannedPosition.code}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Código</Label>
                  <p className="text-lg font-mono">{scannedPosition.code}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(scannedPosition.status)}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Rua</Label>
                  <p>{scannedPosition.street}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Lado</Label>
                  <p>{scannedPosition.side === 'E' ? 'Esquerdo' : 'Direito'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Nível</Label>
                  <p>{scannedPosition.level}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Capacidade</Label>
                  <p>{scannedPosition.maxPallets} pallet(s)</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Tipo</Label>
                  <p>{scannedPosition.rackType || 'Convencional'}</p>
                </div>
              </div>
              
              {scannedPosition.restrictions && (
                <div>
                  <Label className="text-sm font-medium">Restrições</Label>
                  <p className="text-sm text-muted-foreground">{scannedPosition.restrictions}</p>
                </div>
              )}
              
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                {getStatusIcon(scannedPosition)}
                <span className="font-medium">
                  {scannedPosition.status === 'available' ? 
                    'Esta vaga está DISPONÍVEL para armazenamento' : 
                    'Esta vaga NÃO está disponível'
                  }
                </span>
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={() => setScannedPosition(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}