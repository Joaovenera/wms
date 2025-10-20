import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Package,
  Camera,
  FileText,
  User,
  Shield,
  Info,
  CheckCircle,
  AlertTriangle,
  Truck,
  Signature,
  Receipt
} from 'lucide-react';

interface DeliveryExecutionData {
  transporterInfo: {
    name: string;
    contact: string;
    document: string;
  };
  deliveryReceipt: string;
  clientSignatureUrl: string;
  conditionAssessment: 'good' | 'damaged' | 'mixed' | 'unknown';
  specialInstructions: string;
  executionPhotos: Array<{
    url: string;
    description: string;
    timestamp: string;
  }>;
}

interface DeliveryExecutionFormProps {
  onSubmit: (data: DeliveryExecutionData) => void;
  isSubmitting?: boolean;
  initialData?: Partial<DeliveryExecutionData>;
}

export function DeliveryExecutionForm({ 
  onSubmit, 
  isSubmitting = false,
  initialData = {}
}: DeliveryExecutionFormProps) {
  const [formData, setFormData] = useState<DeliveryExecutionData>({
    transporterInfo: {
      name: initialData.transporterInfo?.name || '',
      contact: initialData.transporterInfo?.contact || '',
      document: initialData.transporterInfo?.document || '',
    },
    deliveryReceipt: initialData.deliveryReceipt || '',
    clientSignatureUrl: initialData.clientSignatureUrl || '',
    conditionAssessment: initialData.conditionAssessment || 'good',
    specialInstructions: initialData.specialInstructions || '',
    executionPhotos: initialData.executionPhotos || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.transporterInfo.name.trim()) {
      newErrors.transporterName = 'Nome da transportadora é obrigatório';
    }

    if (!formData.deliveryReceipt.trim()) {
      newErrors.deliveryReceipt = 'Número do recibo de entrega é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const updateTransporterInfo = (field: keyof typeof formData.transporterInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      transporterInfo: {
        ...prev.transporterInfo,
        [field]: value
      }
    }));
  };

  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'damaged':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'mixed':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'damaged':
        return 'bg-red-100 text-red-800';
      case 'mixed':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Transporter Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Informações da Transportadora
          </CardTitle>
          <CardDescription>
            Dados da empresa responsável pela entrega
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="transporterName">Nome da Transportadora *</Label>
              <Input
                id="transporterName"
                value={formData.transporterInfo.name}
                onChange={(e) => updateTransporterInfo('name', e.target.value)}
                placeholder="Ex: Transportes ABC Ltda"
                className={errors.transporterName ? 'border-red-500' : ''}
              />
              {errors.transporterName && (
                <p className="text-sm text-red-600">{errors.transporterName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="transporterContact">Contato</Label>
              <Input
                id="transporterContact"
                value={formData.transporterInfo.contact}
                onChange={(e) => updateTransporterInfo('contact', e.target.value)}
                placeholder="Ex: (11) 3333-4444"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transporterDocument">CNPJ</Label>
              <Input
                id="transporterDocument"
                value={formData.transporterInfo.document}
                onChange={(e) => updateTransporterInfo('document', e.target.value)}
                placeholder="Ex: 12.345.678/0001-90"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            Documentação de Entrega
          </CardTitle>
          <CardDescription>
            Recibos e comprovantes da entrega realizada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deliveryReceipt">Número do Recibo de Entrega *</Label>
              <div className="relative">
                <Receipt className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="deliveryReceipt"
                  value={formData.deliveryReceipt}
                  onChange={(e) => setFormData(prev => ({ ...prev, deliveryReceipt: e.target.value }))}
                  placeholder="Ex: REC-2024-001234"
                  className={`pl-10 ${errors.deliveryReceipt ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.deliveryReceipt && (
                <p className="text-sm text-red-600">{errors.deliveryReceipt}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSignature">Assinatura do Cliente</Label>
              <div className="relative">
                <Signature className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="clientSignature"
                  value={formData.clientSignatureUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, clientSignatureUrl: e.target.value }))}
                  placeholder="URL da assinatura capturada"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500">
                Opcional: URL da assinatura digital capturada durante a entrega
              </p>
            </div>
          </div>

          {/* Signature Capture Placeholder */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <Signature className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Captura de Assinatura do Cliente
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Durante a execução, uma tela de assinatura será apresentada para confirmação da entrega
              </p>
              <div className="inline-flex items-center gap-2 text-xs text-blue-600">
                <Info className="h-3 w-3" />
                <span>Disponível durante a execução</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Condition Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-600" />
            Avaliação da Condição
          </CardTitle>
          <CardDescription>
            Estado geral dos itens entregues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Condição dos Itens Entregues</Label>
            <Select 
              value={formData.conditionAssessment} 
              onValueChange={(value: any) => setFormData(prev => ({ ...prev, conditionAssessment: value }))}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {getConditionIcon(formData.conditionAssessment)}
                    <Badge className={getConditionColor(formData.conditionAssessment)}>
                      {formData.conditionAssessment === 'good' && 'Boa Condição'}
                      {formData.conditionAssessment === 'damaged' && 'Avariado'}
                      {formData.conditionAssessment === 'mixed' && 'Condição Mista'}
                      {formData.conditionAssessment === 'unknown' && 'A Verificar'}
                    </Badge>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Boa Condição</span>
                  </div>
                </SelectItem>
                <SelectItem value="mixed">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span>Condição Mista</span>
                  </div>
                </SelectItem>
                <SelectItem value="damaged">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span>Itens Avariados</span>
                  </div>
                </SelectItem>
                <SelectItem value="unknown">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-gray-600" />
                    <span>A Verificar</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialInstructions">Observações da Entrega</Label>
            <Textarea
              id="specialInstructions"
              value={formData.specialInstructions}
              onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
              placeholder="Descreva detalhes da entrega: condições dos itens, local de entrega, dificuldades encontradas, etc..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Photos Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-purple-600" />
            Registro Fotográfico da Entrega
          </CardTitle>
          <CardDescription>
            Fotos dos itens entregues e comprovantes de recebimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Camera className="h-4 w-4" />
            <AlertDescription>
              As fotos serão capturadas durante o processo de execução da entrega. 
              Recomenda-se fotografar: itens entregues, recibo assinado, 
              local de entrega e possíveis avarias.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
              <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Itens Entregues</p>
              <p className="text-xs text-gray-500">Estado dos produtos</p>
            </div>
            
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
              <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Recibo Assinado</p>
              <p className="text-xs text-gray-500">Comprovante de recebimento</p>
            </div>

            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
              <User className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Cliente Recebedor</p>
              <p className="text-xs text-gray-500">Identificação visual</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Information Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-600" />
            Informações de Entrega
          </CardTitle>
          <CardDescription>
            Detalhes sobre o processo de entrega e recebimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800 mb-2">Processo de Entrega</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Confirme a identidade do recebedor</li>
                  <li>• Verifique o estado dos itens antes da entrega</li>
                  <li>• Obtenha assinatura de confirmação de recebimento</li>
                  <li>• Fotografe possíveis avarias ou observações especiais</li>
                  <li>• Registre o número do recibo de entrega</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              <span className="font-medium">Iniciar Execução de Entrega</span>
            </div>
            
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Iniciando...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4" />
                  Iniciar Entrega
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}