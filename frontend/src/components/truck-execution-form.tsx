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
  Truck,
  Camera,
  FileText,
  User,
  Shield,
  Info,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Phone
} from 'lucide-react';

interface TruckExecutionData {
  vehiclePlate: string;
  driverInfo: {
    name: string;
    license: string;
    phone: string;
    document: string;
  };
  transporterInfo: {
    name: string;
    contact: string;
    document: string;
  };
  conditionAssessment: 'good' | 'damaged' | 'mixed' | 'unknown';
  specialInstructions: string;
  executionPhotos: Array<{
    url: string;
    description: string;
    timestamp: string;
  }>;
}

interface TruckExecutionFormProps {
  onSubmit: (data: TruckExecutionData) => void;
  isSubmitting?: boolean;
  initialData?: Partial<TruckExecutionData>;
}

export function TruckExecutionForm({ 
  onSubmit, 
  isSubmitting = false,
  initialData = {}
}: TruckExecutionFormProps) {
  const [formData, setFormData] = useState<TruckExecutionData>({
    vehiclePlate: initialData.vehiclePlate || '',
    driverInfo: {
      name: initialData.driverInfo?.name || '',
      license: initialData.driverInfo?.license || '',
      phone: initialData.driverInfo?.phone || '',
      document: initialData.driverInfo?.document || '',
    },
    transporterInfo: {
      name: initialData.transporterInfo?.name || '',
      contact: initialData.transporterInfo?.contact || '',
      document: initialData.transporterInfo?.document || '',
    },
    conditionAssessment: initialData.conditionAssessment || 'good',
    specialInstructions: initialData.specialInstructions || '',
    executionPhotos: initialData.executionPhotos || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.vehiclePlate.trim()) {
      newErrors.vehiclePlate = 'Placa do veículo é obrigatória';
    }

    if (!formData.driverInfo.name.trim()) {
      newErrors.driverName = 'Nome do motorista é obrigatório';
    }

    if (!formData.driverInfo.license.trim()) {
      newErrors.driverLicense = 'CNH do motorista é obrigatória';
    }

    if (!formData.transporterInfo.name.trim()) {
      newErrors.transporterName = 'Nome da transportadora é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const updateDriverInfo = (field: keyof typeof formData.driverInfo, value: string) => {
    setFormData(prev => ({
      ...prev,
      driverInfo: {
        ...prev.driverInfo,
        [field]: value
      }
    }));
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

  const formatPlate = (value: string) => {
    // Format Brazilian license plate (ABC-1234 or ABC1D23)
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}`;
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
      {/* Vehicle Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-green-600" />
            Informações do Veículo
          </CardTitle>
          <CardDescription>
            Dados do caminhão que está realizando a operação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehiclePlate">Placa do Veículo *</Label>
            <Input
              id="vehiclePlate"
              value={formData.vehiclePlate}
              onChange={(e) => setFormData(prev => ({ ...prev, vehiclePlate: formatPlate(e.target.value) }))}
              placeholder="Ex: ABC-1234 ou ABC1D23"
              className={errors.vehiclePlate ? 'border-red-500' : ''}
              maxLength={8}
            />
            {errors.vehiclePlate && (
              <p className="text-sm text-red-600">{errors.vehiclePlate}</p>
            )}
            <p className="text-xs text-gray-500">
              Formato aceito: ABC-1234 (padrão antigo) ou ABC1D23 (Mercosul)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Driver Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Informações do Motorista
          </CardTitle>
          <CardDescription>
            Dados do condutor responsável pelo transporte
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="driverName">Nome Completo *</Label>
              <Input
                id="driverName"
                value={formData.driverInfo.name}
                onChange={(e) => updateDriverInfo('name', e.target.value)}
                placeholder="Ex: João Silva Santos"
                className={errors.driverName ? 'border-red-500' : ''}
              />
              {errors.driverName && (
                <p className="text-sm text-red-600">{errors.driverName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="driverLicense">CNH *</Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="driverLicense"
                  value={formData.driverInfo.license}
                  onChange={(e) => updateDriverInfo('license', e.target.value)}
                  placeholder="Ex: 12345678901"
                  className={`pl-10 ${errors.driverLicense ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.driverLicense && (
                <p className="text-sm text-red-600">{errors.driverLicense}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="driverPhone">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="driverPhone"
                  value={formData.driverInfo.phone}
                  onChange={(e) => updateDriverInfo('phone', e.target.value)}
                  placeholder="Ex: (11) 99999-9999"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driverDocument">CPF</Label>
              <Input
                id="driverDocument"
                value={formData.driverInfo.document}
                onChange={(e) => updateDriverInfo('document', e.target.value)}
                placeholder="Ex: 123.456.789-00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transporter Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-purple-600" />
            Informações da Transportadora
          </CardTitle>
          <CardDescription>
            Dados da empresa responsável pelo transporte
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
                placeholder="Ex: Transportes XYZ Ltda"
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

      {/* Condition Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-600" />
            Avaliação da Condição
          </CardTitle>
          <CardDescription>
            Avalie a condição geral do veículo e dos itens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Condição Geral</Label>
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
                    <span>Avariado</span>
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
            <Label htmlFor="specialInstructions">Observações e Instruções Especiais</Label>
            <Textarea
              id="specialInstructions"
              value={formData.specialInstructions}
              onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
              placeholder="Descreva quaisquer observações importantes sobre o veículo, motorista ou processo de carregamento..."
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
            Registro Fotográfico
          </CardTitle>
          <CardDescription>
            Fotos do veículo, motorista (CNH) e condições gerais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Camera className="h-4 w-4" />
            <AlertDescription>
              As fotos serão capturadas durante o processo de execução. 
              Recomenda-se fotografar: veículo (frente e traseira), CNH do motorista, 
              estado geral dos itens e possíveis avarias.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
              <Truck className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Fotos do Veículo</p>
              <p className="text-xs text-gray-500">Frente, traseira, placas</p>
            </div>
            
            <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
              <CreditCard className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">CNH do Motorista</p>
              <p className="text-xs text-gray-500">Documento de habilitação</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              <span className="font-medium">Iniciar Execução do Caminhão</span>
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
                  <Truck className="h-4 w-4" />
                  Iniciar Carregamento
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}