import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Layers, 
  Settings, 
  Activity, 
  BarChart3, 
  Eye,
  RotateCcw
} from "lucide-react";
import { type PalletStructure, type Position } from "@/types/api";
import EnhancedPalletStructureSimulator from "@/components/enhanced-pallet-structure-simulator";

export default function PalletSimulatorDemo() {
  const [realTimeUpdates, setRealTimeUpdates] = useState(false);
  const [interactive, setInteractive] = useState(true);
  const [showStats, setShowStats] = useState(true);

  // Query para buscar estruturas de porta paletes
  const { data: structures = [], isLoading: structuresLoading } = useQuery<PalletStructure[]>({
    queryKey: ['/api/pallet-structures'],
  });

  // Query para buscar posições
  const { data: positions = [], isLoading: positionsLoading } = useQuery<Position[]>({
    queryKey: ['/api/positions'],
  });

  // Função para obter posições de uma estrutura específica
  const getStructurePositions = (structureId: number) => {
    return positions.filter(pos => pos.structureId === structureId);
  };

  const isLoading = structuresLoading || positionsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando simulador de estruturas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Layers className="h-8 w-8 text-blue-600" />
            Simulador de Estruturas de Pallet
          </h1>
          <p className="text-gray-600 mt-2">
            Visualize e interaja com as estruturas de porta-paletes em tempo real
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            <Activity className="h-3 w-3 mr-1" />
            {structures.length} estruturas
          </Badge>
          <Badge variant="outline" className="text-sm">
            <BarChart3 className="h-3 w-3 mr-1" />
            {positions.length} posições
          </Badge>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações do Simulador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="real-time"
                checked={realTimeUpdates}
                onCheckedChange={setRealTimeUpdates}
              />
              <Label htmlFor="real-time" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Atualizações em Tempo Real
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="interactive"
                checked={interactive}
                onCheckedChange={setInteractive}
              />
              <Label htmlFor="interactive" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Modo Interativo
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="stats"
                checked={showStats}
                onCheckedChange={setShowStats}
              />
              <Label htmlFor="stats" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Mostrar Estatísticas
              </Label>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Dica:</strong> Use as visualizações 2D e 3D para explorar as estruturas. 
              Clique nas posições para ver detalhes quando o modo interativo estiver ativado.
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Structures Grid */}
      {structures.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma estrutura encontrada
            </h3>
            <p className="text-gray-600">
              Crie estruturas de porta-paletes na página de Porta-Paletes para visualizá-las aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {structures.map((structure) => (
            <EnhancedPalletStructureSimulator
              key={structure.id}
              structure={structure}
              positions={getStructurePositions(structure.id)}
              realTimeUpdates={realTimeUpdates}
              interactive={interactive}
              showStats={showStats}
              className="w-full"
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">
          Simulador de Estruturas de Pallet - Versão Aprimorada
        </p>
        <p className="text-xs mt-1">
          Inclui visualizações 2D/3D, estatísticas em tempo real e interatividade avançada
        </p>
      </div>
    </div>
  );
}










