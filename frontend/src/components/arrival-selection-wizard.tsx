import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Ship,
  Truck, 
  Package,
  ArrowRight,
  Clock,
  MapPin,
  AlertCircle,
  Info
} from "lucide-react";
import { ARRIVAL_TYPE_CONFIG, ArrivalType } from "@/types/container";

interface ArrivalSelectionWizardProps {
  onArrivalTypeSelect: (type: ArrivalType) => void;
}

export function ArrivalSelectionWizard({ onArrivalTypeSelect }: ArrivalSelectionWizardProps) {
  const arrivalOptions = [
    {
      type: 'container' as ArrivalType,
      title: 'Container',
      subtitle: 'Planejar chegada de container marítimo',
      icon: Ship,
      color: 'blue',
      features: [
        'Definir estimativa de chegada',
        'Listar itens esperados',
        'Número do container (opcional)',
        'Sem informações de placa necessárias',
        'Planejar documentação fotográfica'
      ],
      notes: 'Para planejamento: empresa terceirizada, informações de veículo serão coletadas na execução'
    },
    {
      type: 'truck' as ArrivalType,
      title: 'Caminhão',
      subtitle: 'Planejar chegada via caminhão próprio',
      icon: Truck,
      color: 'green',
      features: [
        'Definir estimativa de chegada',
        'Listar itens a transportar',
        'Especificar informações do veículo',
        'Cadastrar dados do motorista',
        'Definir placa do caminhão/reboque'
      ],
      notes: 'Para planejamento: caminhões próprios com informações de veículo conhecidas'
    },
    {
      type: 'delivery' as ArrivalType,
      title: 'Entrega',
      subtitle: 'Planejar entrega via transportadora',
      icon: Package,
      color: 'purple',
      features: [
        'Definir estimativa de chegada',
        'Listar itens para entrega',
        'Nome da transportadora (opcional)',
        'Sem informações de veículo necessárias',
        'Sem dados de motorista necessários'
      ],
      notes: 'Para planejamento: entregas onde detalhes do veículo serão definidos na execução'
    }
  ];

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'border-blue-200 hover:border-blue-300 hover:bg-blue-50/50',
      green: 'border-green-200 hover:border-green-300 hover:bg-green-50/50',
      purple: 'border-purple-200 hover:border-purple-300 hover:bg-purple-50/50'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  const getIconColorClasses = (color: string) => {
    const colorMap = {
      blue: 'text-blue-600 bg-blue-100',
      green: 'text-green-600 bg-green-100',
      purple: 'text-purple-600 bg-purple-100'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  const getButtonColorClasses = (color: string) => {
    const colorMap = {
      blue: 'bg-blue-600 hover:bg-blue-700',
      green: 'bg-green-600 hover:bg-green-700',
      purple: 'bg-purple-600 hover:bg-purple-700'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-900">
            <Package className="h-6 w-6" />
            Selecione o Tipo de Chegada para Planejar
          </CardTitle>
          <CardDescription className="text-green-700 text-base">
            Escolha o tipo de chegada que deseja planejar
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Arrival Type Options */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {arrivalOptions.map((option) => {
          const Icon = option.icon;
          
          return (
            <Card 
              key={option.type}
              className={`cursor-pointer transition-all duration-200 ${getColorClasses(option.color)}`}
              onClick={() => onArrivalTypeSelect(option.type)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-lg ${getIconColorClasses(option.color)}`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">{option.title}</CardTitle>
                  <CardDescription className="text-base mt-1">
                    {option.subtitle}
                  </CardDescription>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Features */}
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Informações necessárias:
                  </h4>
                  <ul className="space-y-1">
                    {option.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Notes */}
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {option.notes}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <Button 
                  className={`w-full ${getButtonColorClasses(option.color)}`}
                  onClick={() => onArrivalTypeSelect(option.type)}
                >
                  Planejar {option.title}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Information Banner */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900 mb-1">
                Sobre o Planejamento de Chegadas
              </h3>
              <p className="text-blue-800 text-sm leading-relaxed">
                Cada tipo de chegada requer informações específicas para o planejamento. 
                Os planos criados serão enviados para aprovação e posterior execução.
                A execução efetiva acontecerá na página de execução de carregamento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}