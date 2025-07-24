import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Grid3X3, RotateCcw } from "lucide-react";

interface PalletSlot {
  id: string;
  row: number;
  col: number;
  width: number;
  height: number;
  ocupada: boolean;
  palletType?: string;
}

interface LayoutConfig {
  rows: number;
  cols: number;
  slots: PalletSlot[];
  totalPallets: number;
}

interface PalletLayoutConfiguratorProps {
  config: LayoutConfig;
  onChange: (config: LayoutConfig) => void;
  readonly?: boolean;
}

export default function PalletLayoutConfigurator({ 
  config, 
  onChange, 
  readonly = false 
}: PalletLayoutConfiguratorProps) {
  const [rows, setRows] = useState(config.rows || 3);
  const [cols, setCols] = useState(config.cols || 3);

  // Templates predefinidos baseados nos exemplos do usuário
  const templates = [
    {
      name: "3x3 Uniforme (BOX BOX BOX)",
      rows: 3,
      cols: 3,
      description: "Layout padrão com 9 slots uniformes",
      slots: Array.from({ length: 9 }, (_, i) => ({
        id: `slot-${i}`,
        row: Math.floor(i / 3),
        col: i % 3,
        width: 1,
        height: 1,
        ocupada: false
      }))
    },
    {
      name: "3x4 Misto (BOX BOX | BOX BOX)",
      rows: 3,
      cols: 4,
      description: "Layout misto com slots duplos e simples",
      slots: [
        // Slots duplos (2x1)
        { id: "slot-0", row: 0, col: 0, width: 2, height: 1, ocupada: false },
        { id: "slot-1", row: 0, col: 2, width: 2, height: 1, ocupada: false },
        { id: "slot-2", row: 1, col: 0, width: 2, height: 1, ocupada: false },
        { id: "slot-3", row: 1, col: 2, width: 2, height: 1, ocupada: false },
        { id: "slot-4", row: 2, col: 0, width: 2, height: 1, ocupada: false },
        { id: "slot-5", row: 2, col: 2, width: 2, height: 1, ocupada: false },
      ]
    },
    {
      name: "3x6 Pequenos (BOX BOX BOX BOX BOX BOX)",
      rows: 3,
      cols: 6,
      description: "Layout com muitos slots pequenos",
      slots: Array.from({ length: 18 }, (_, i) => ({
        id: `slot-${i}`,
        row: Math.floor(i / 6),
        col: i % 6,
        width: 1,
        height: 1,
        ocupada: false
      }))
    },
    {
      name: "3x5 Misto Avançado",
      rows: 3,
      cols: 5,
      description: "Layout com slots de diferentes tamanhos",
      slots: [
        // Primeira linha: 2 slots duplos + 1 simples
        { id: "slot-0", row: 0, col: 0, width: 2, height: 1, ocupada: false },
        { id: "slot-1", row: 0, col: 2, width: 2, height: 1, ocupada: false },
        { id: "slot-2", row: 0, col: 4, width: 1, height: 1, ocupada: false },
        // Segunda linha igual
        { id: "slot-3", row: 1, col: 0, width: 2, height: 1, ocupada: false },
        { id: "slot-4", row: 1, col: 2, width: 2, height: 1, ocupada: false },
        { id: "slot-5", row: 1, col: 4, width: 1, height: 1, ocupada: false },
        // Terceira linha igual
        { id: "slot-6", row: 2, col: 0, width: 2, height: 1, ocupada: false },
        { id: "slot-7", row: 2, col: 2, width: 2, height: 1, ocupada: false },
        { id: "slot-8", row: 2, col: 4, width: 1, height: 1, ocupada: false },
      ]
    }
  ];

  const updateGrid = (newRows: number, newCols: number) => {
    setRows(newRows);
    setCols(newCols);
    
    // Criar grid básico uniforme
    const newSlots: PalletSlot[] = [];
    for (let r = 0; r < newRows; r++) {
      for (let c = 0; c < newCols; c++) {
        newSlots.push({
          id: `slot-${r}-${c}`,
          row: r,
          col: c,
          width: 1,
          height: 1,
          ocupada: false
        });
      }
    }

    onChange({
      rows: newRows,
      cols: newCols,
      slots: newSlots,
      totalPallets: newSlots.length
    });
  };

  const applyTemplate = (template: typeof templates[0]) => {
    setRows(template.rows);
    setCols(template.cols);
    
    onChange({
      rows: template.rows,
      cols: template.cols,
      slots: template.slots,
      totalPallets: template.slots.length
    });
  };

  const toggleSlotOccupied = (slotId: string) => {
    if (readonly) return;
    
    const newSlots = config.slots.map(slot => 
      slot.id === slotId ? { ...slot, ocupada: !slot.ocupada } : slot
    );

    onChange({
      ...config,
      slots: newSlots
    });
  };

  const renderSlot = (slot: PalletSlot) => {
    const slotWidth = slot.width * 40 + (slot.width - 1) * 4;
    const slotHeight = slot.height * 30 + (slot.height - 1) * 4;
    
    return (
      <div
        key={slot.id}
        className={`
          absolute border-2 rounded cursor-pointer transition-all duration-200
          ${slot.occupied 
            ? 'bg-orange-100 border-orange-400 shadow-md' 
            : 'bg-blue-50 border-blue-300 border-dashed hover:border-blue-400'
          }
          ${readonly ? 'cursor-default' : 'hover:shadow-lg'}
        `}
        style={{
          left: slot.col * 44 + 'px',
          top: slot.row * 34 + 'px',
          width: slotWidth + 'px',
          height: slotHeight + 'px'
        }}
        onClick={() => toggleSlotOccupied(slot.id)}
      >
        <div className="w-full h-full flex items-center justify-center text-xs font-medium">
          {slot.occupied ? (
            <div className="text-center">
              <div className="text-orange-600 font-bold">BOX</div>
              {slot.width > 1 || slot.height > 1 ? (
                <div className="text-orange-500">{slot.width}x{slot.height}</div>
              ) : null}
            </div>
          ) : (
            <div className="text-center text-blue-500">
              <div>{slot.width}x{slot.height}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGrid = () => {
    const gridWidth = cols * 44;
    const gridHeight = rows * 34;
    
    return (
      <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
        <div 
          className="relative bg-white border border-gray-200 rounded mx-auto"
          style={{ width: gridWidth + 'px', height: gridHeight + 'px' }}
        >
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {/* Vertical lines */}
            {Array.from({ length: cols + 1 }, (_, i) => (
              <line
                key={`v-${i}`}
                x1={i * 44}
                y1={0}
                x2={i * 44}
                y2={gridHeight}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            ))}
            {/* Horizontal lines */}
            {Array.from({ length: rows + 1 }, (_, i) => (
              <line
                key={`h-${i}`}
                x1={0}
                y1={i * 34}
                x2={gridWidth}
                y2={i * 34}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            ))}
          </svg>
          
          {/* Slots */}
          {config.slots.map(renderSlot)}
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          Configurador de Layout Flexível
          <Badge variant="outline" className="text-sm">
            {config.totalPallets || 0} Slots • {rows}x{cols}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Visualização do grid */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Layout Visual do Porta-Pallet</h4>
          {renderGrid()}
        </div>

        {!readonly && (
          <>
            <Separator />
            
            {/* Controles de dimensão */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Dimensões do Grid</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rows">Linhas</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateGrid(Math.max(1, rows - 1), cols)}
                      disabled={rows <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      id="rows"
                      type="number"
                      min={1}
                      max={10}
                      value={rows}
                      onChange={(e) => updateGrid(parseInt(e.target.value) || 1, cols)}
                      className="text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateGrid(Math.min(10, rows + 1), cols)}
                      disabled={rows >= 10}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="cols">Colunas</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateGrid(rows, Math.max(1, cols - 1))}
                      disabled={cols <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      id="cols"
                      type="number"
                      min={1}
                      max={10}
                      value={cols}
                      onChange={(e) => updateGrid(rows, parseInt(e.target.value) || 1)}
                      className="text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateGrid(rows, Math.min(10, cols + 1))}
                      disabled={cols >= 10}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Templates predefinidos */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Templates Predefinidos</h4>
              <div className="grid grid-cols-1 gap-2">
                {templates.map((template, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    onClick={() => applyTemplate(template)}
                    className="justify-start h-auto p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Grid3X3 className="w-4 h-4 text-gray-500" />
                      <div className="text-left">
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-gray-500">
                          {template.description} • {template.slots.length} slots
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Ferramentas */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Ferramentas</h4>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateGrid(rows, cols)}
                  size="sm"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Limpar Grid
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyTemplate(templates[0])}
                  size="sm"
                >
                  <Grid3X3 className="w-4 h-4 mr-2" />
                  Template Padrão
                </Button>
              </div>
            </div>

            {/* Informações e instruções */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h5 className="text-sm font-medium text-blue-800 mb-2">Como usar:</h5>
              <div className="text-xs text-blue-700 space-y-1">
                <div>• Clique nos slots para alternar entre vazio (azul) e ocupado (laranja)</div>
                <div>• Slots vazios mostram as dimensões (1x1, 2x1, etc.)</div>
                <div>• Slots ocupados mostram "BOX" e representam posições com pallets</div>
                <div>• Use os templates para replicar os layouts dos exemplos mostrados</div>
                <div>• Ajuste linhas e colunas para criar configurações personalizadas</div>
              </div>
            </div>

            {/* Estatísticas */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Estatísticas do Layout</h5>
              <div className="text-xs text-gray-600 space-y-1">
                <div>• Total de slots: {config.slots.length}</div>
                <div>• Slots ocupados: {config.slots.filter(s => s.ocupada).length}</div>
                <div>• Slots vazios: {config.slots.filter(s => !s.ocupada).length}</div>
                <div>• Dimensão: {rows} linhas × {cols} colunas</div>
                <div>• Taxa de ocupação: {config.slots.length > 0 ? Math.round((config.slots.filter(s => s.ocupada).length / config.slots.length) * 100) : 0}%</div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}