import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface PalletSlot {
  id: string;
  occupied: boolean;
  palletType?: string;
}

interface LayoutConfig {
  maxPallets: number;
  hasDivision: boolean;
  slots: PalletSlot[];
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
  const [selectedLayout, setSelectedLayout] = useState<"single" | "double">(
    config.maxPallets === 1 ? "single" : "double"
  );
  const [hasDivision, setHasDivision] = useState(config.hasDivision);

  const updateLayout = (layout: "single" | "double", withDivision: boolean) => {
    setSelectedLayout(layout);
    setHasDivision(withDivision);
    
    const maxPallets = layout === "single" ? 1 : 2;
    const slots: PalletSlot[] = [];
    
    for (let i = 0; i < maxPallets; i++) {
      slots.push({
        id: `slot-${i}`,
        occupied: false,
        palletType: undefined
      });
    }

    onChange({
      maxPallets,
      hasDivision: withDivision,
      slots
    });
  };

  const renderPalletSlot = (slot: PalletSlot, index: number) => (
    <div
      key={slot.id}
      className={`
        relative w-24 h-16 border-2 border-dashed border-blue-300 
        bg-blue-50 rounded-lg flex items-center justify-center
        ${slot.occupied ? 'bg-orange-100 border-orange-300' : ''}
        transition-all duration-200
      `}
    >
      {slot.occupied ? (
        <div className="text-center">
          <div className="text-xs font-bold text-orange-600">ONIX</div>
          <div className="text-xs text-orange-500">{slot.palletType || 'PBR'}</div>
        </div>
      ) : (
        <div className="text-xs text-blue-400 text-center">
          Posição<br/>{index + 1}
        </div>
      )}
    </div>
  );

  const renderDivision = () => (
    <div className="flex flex-col items-center justify-center h-16">
      <div className="w-2 h-12 bg-red-500 rounded-full shadow-md"></div>
      <div className="text-xs text-red-600 font-medium mt-1">Divisor</div>
    </div>
  );

  const renderLayout = () => {
    const slots = config.slots || [];
    
    return (
      <div className="flex items-center justify-center gap-3 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
        {/* Estrutura de suporte esquerda */}
        <div className="w-3 h-20 bg-red-600 rounded"></div>
        
        {/* Slots de pallets */}
        <div className="flex items-center gap-2">
          {slots.map((slot, index) => (
            <div key={slot.id} className="flex items-center gap-2">
              {renderPalletSlot(slot, index)}
              {index === 0 && config.hasDivision && config.maxPallets === 2 && renderDivision()}
            </div>
          ))}
        </div>
        
        {/* Estrutura de suporte direita */}
        <div className="w-3 h-20 bg-red-600 rounded"></div>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          Configuração Visual do Porta-Pallet
          <Badge variant="outline" className="text-sm">
            {config.maxPallets} Pallet{config.maxPallets > 1 ? 's' : ''}
            {config.hasDivision ? ' + Divisão' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Visualização do layout */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Vista Frontal da Estrutura</h4>
          {renderLayout()}
        </div>

        {!readonly && (
          <>
            <Separator />
            
            {/* Opções de configuração */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Configuração de Layout</h4>
              <div className="grid grid-cols-2 gap-3">
                {/* Layout de 1 pallet */}
                <Card 
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedLayout === "single" ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                  }`}
                  onClick={() => updateLayout("single", false)}
                >
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="w-2 h-8 bg-red-500 rounded"></div>
                        <div className="w-16 h-10 border-2 border-dashed border-blue-300 bg-blue-50 rounded flex items-center justify-center">
                          <span className="text-xs text-blue-600">1</span>
                        </div>
                        <div className="w-2 h-8 bg-red-500 rounded"></div>
                      </div>
                      <p className="text-sm font-medium">1 Pallet</p>
                      <p className="text-xs text-gray-500">Armazenagem simples</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Layout de 2 pallets sem divisão */}
                <Card 
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedLayout === "double" && !hasDivision ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                  }`}
                  onClick={() => updateLayout("double", false)}
                >
                  <CardContent className="p-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-2">
                        <div className="w-2 h-8 bg-red-500 rounded"></div>
                        <div className="w-12 h-8 border-2 border-dashed border-blue-300 bg-blue-50 rounded flex items-center justify-center">
                          <span className="text-xs text-blue-600">1</span>
                        </div>
                        <div className="w-12 h-8 border-2 border-dashed border-blue-300 bg-blue-50 rounded flex items-center justify-center">
                          <span className="text-xs text-blue-600">2</span>
                        </div>
                        <div className="w-2 h-8 bg-red-500 rounded"></div>
                      </div>
                      <p className="text-sm font-medium">2 Pallets</p>
                      <p className="text-xs text-gray-500">Sem divisão</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Opção de divisão para 2 pallets */}
              {selectedLayout === "double" && (
                <div className="mt-3">
                  <Card 
                    className={`cursor-pointer transition-all duration-200 ${
                      hasDivision ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                    }`}
                    onClick={() => updateLayout("double", true)}
                  >
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-2">
                          <div className="w-2 h-8 bg-red-500 rounded"></div>
                          <div className="w-12 h-8 border-2 border-dashed border-blue-300 bg-blue-50 rounded flex items-center justify-center">
                            <span className="text-xs text-blue-600">1</span>
                          </div>
                          <div className="w-1 h-6 bg-red-500 rounded-full"></div>
                          <div className="w-12 h-8 border-2 border-dashed border-blue-300 bg-blue-50 rounded flex items-center justify-center">
                            <span className="text-xs text-blue-600">2</span>
                          </div>
                          <div className="w-2 h-8 bg-red-500 rounded"></div>
                        </div>
                        <p className="text-sm font-medium">2 Pallets + Divisão</p>
                        <p className="text-xs text-gray-500">Com separador central</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Informações adicionais */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Especificações</h5>
              <div className="text-xs text-gray-600 space-y-1">
                <div>• Capacidade: {config.maxPallets} pallet{config.maxPallets > 1 ? 's' : ''}</div>
                <div>• Divisão central: {config.hasDivision ? 'Sim' : 'Não'}</div>
                <div>• Estrutura: Porta-pallet convencional</div>
                <div>• Cores: Vermelho (estrutura), Azul (posições)</div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}