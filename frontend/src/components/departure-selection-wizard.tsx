import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight,
  Truck,
  UserCheck,
  Clock,
  MapPin,
  AlertCircle,
  Info,
  Package,
  Calendar
} from "lucide-react";
import { DEPARTURE_TYPE_CONFIG, DepartureType } from "@/types/container";

interface DepartureSelectionWizardProps {
  onDepartureTypeSelect: (type: DepartureType) => void;
}

export function DepartureSelectionWizard({ onDepartureTypeSelect }: DepartureSelectionWizardProps) {
  const departureOptions = [
    {
      type: 'transfer' as DepartureType,
      title: 'Transferência',
      subtitle: 'Planejar transferência entre armazéns',
      icon: Truck,
      color: 'blue',
      features: [
        'Definir veículo (placa obrigatória)',
        'Cadastrar motorista',
        'Planejar estimativa de saída',
        'Listar itens obrigatórios',
        'Listar itens opcionais (se sobrar espaço)',
        'Especificar origem e destino'
      ],
      notes: 'Para planejamento: transferências com veículo e motorista pré-definidos'
    },
    {
      type: 'withdrawal' as DepartureType,
      title: 'Retirada',
      subtitle: 'Planejar retirada por cliente',
      icon: UserCheck,
      color: 'orange',
      features: [
        'Cadastrar dados do cliente',
        'Listar itens para retirada',
        'Sem data definida no plano',
        'Sem informações de veículo necessárias',
        'Workflow de aprovação',
        'Controle de disponibilidade'
      ],
      notes: 'Para planejamento: retiradas sem data fixa, cliente define quando retirar'
    }
  ];

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'border-blue-200 hover:border-blue-300 hover:bg-blue-50/50',
      orange: 'border-orange-200 hover:border-orange-300 hover:bg-orange-50/50'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  const getIconColorClasses = (color: string) => {
    const colorMap = {
      blue: 'text-blue-600 bg-blue-100',
      orange: 'text-orange-600 bg-orange-100'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  const getButtonColorClasses = (color: string) => {
    const colorMap = {
      blue: 'bg-blue-600 hover:bg-blue-700',
      orange: 'bg-orange-600 hover:bg-orange-700'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <ArrowRight className="h-6 w-6" />
            Selecione o Tipo de Saída para Planejar
          </CardTitle>
          <CardDescription className="text-blue-700 text-base">
            Escolha o tipo de saída que deseja planejar
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Departure Type Options */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {departureOptions.map((option) => {
          const Icon = option.icon;
          
          return (
            <Card 
              key={option.type}
              className={`cursor-pointer transition-all duration-200 ${getColorClasses(option.color)}`}
              onClick={() => onDepartureTypeSelect(option.type)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className={`p-4 rounded-lg ${getIconColorClasses(option.color)}`}>
                    <Icon className="h-10 w-10" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{option.title}</CardTitle>
                  <CardDescription className="text-base mt-2">
                    {option.subtitle}
                  </CardDescription>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-5">
                {/* Features */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Informações necessárias:
                  </h4>
                  <ul className="space-y-2">
                    {option.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3 text-sm text-gray-600">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          option.color === 'blue' ? 'bg-blue-500' : 'bg-orange-500'
                        }`}></div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Notes */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {option.notes}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <Button 
                  className={`w-full h-12 text-base ${getButtonColorClasses(option.color)}`}
                  onClick={() => onDepartureTypeSelect(option.type)}
                >
                  Planejar {option.title}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-gray-600" />
            Comparação entre Tipos de Saída
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Característica</th>
                  <th className="text-center py-3 px-4 font-medium text-blue-900">Transferência</th>
                  <th className="text-center py-3 px-4 font-medium text-orange-900">Retirada</th>
                </tr>
              </thead>
              <tbody className="space-y-2">
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium">Informações de Veículo</td>
                  <td className="py-3 px-4 text-center">
                    <Badge className="bg-blue-100 text-blue-800">Obrigatório</Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="outline">Não necessário</Badge>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium">Data/Horário</td>
                  <td className="py-3 px-4 text-center">
                    <Badge className="bg-blue-100 text-blue-800">Estimativa definida</Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant="outline">Indefinido</Badge>
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium">Controle de Estoque</td>
                  <td className="py-3 px-4 text-center">
                    <Badge className="bg-blue-100 text-blue-800">Transferência</Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge className="bg-orange-100 text-orange-800">Saída definitiva</Badge>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-medium">Aprovação</td>
                  <td className="py-3 px-4 text-center">
                    <Badge className="bg-blue-100 text-blue-800">Gerencial</Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge className="bg-orange-100 text-orange-800">Por cliente</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Information Banner */}
      <Card className="border-yellow-200 bg-yellow-50/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-yellow-900 mb-1">
                Sobre o Planejamento de Saídas
              </h3>
              <p className="text-yellow-800 text-sm leading-relaxed">
                <strong>Transferências</strong> requerem planejamento detalhado com veículo e horário. 
                <strong>Retiradas</strong> são mais flexíveis, dependendo do cliente. 
                Os planos criados passarão por aprovação antes da execução.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}