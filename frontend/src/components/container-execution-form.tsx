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
  Ship,
  Camera,
  FileText,
  Truck,
  User,
  Shield,
  Info,
  CheckCircle,
  AlertTriangle,
  Check,
  CircleAlert,
  Navigation
} from 'lucide-react';
import { PhotoUploadGrid } from './photo-upload-grid';
import { ContainerPhoto, ContainerPhotoType } from '@/types/container';

interface ContainerExecutionData {
  containerNumber: string;
  sealNumber: string;
  vehiclePlate: string;
  trailerPlate: string;
  transporterInfo: {
    name: string;
    contact: string;
    document: string;
  };
  conditionAssessment: 'good' | 'damaged' | 'mixed' | 'unknown';
  specialInstructions: string;
  executionPhotos: ContainerPhoto[];
}

interface ContainerExecutionFormProps {
  onSubmit: (data: ContainerExecutionData) => void;
  isSubmitting?: boolean;
  initialData?: Partial<ContainerExecutionData>;
}

export function ContainerExecutionForm({ 
  onSubmit, 
  isSubmitting = false,
  initialData = {}
}: ContainerExecutionFormProps) {
  const [formData, setFormData] = useState<ContainerExecutionData>({
    containerNumber: initialData.containerNumber || '',
    sealNumber: initialData.sealNumber || '',
    vehiclePlate: (initialData as any).vehiclePlate || '',
    trailerPlate: (initialData as any).trailerPlate || '',
    transporterInfo: {
      name: initialData.transporterInfo?.name || '',
      contact: initialData.transporterInfo?.contact || '',
      document: initialData.transporterInfo?.document || '',
    },
    conditionAssessment: initialData.conditionAssessment || 'good',
    specialInstructions: initialData.specialInstructions || '',
    executionPhotos: (initialData.executionPhotos as any) || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const REQUIRED_PHOTO_TYPES: Array<ContainerPhotoType['type']> = [
    'container_number',
    'truck_plate',
    'trailer_plate',
    'seal',
    'first_opening'
  ];

  const formatPlate = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}`;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.containerNumber.trim()) {
      newErrors.containerNumber = 'Número do container é obrigatório';
    }

    if (!formData.sealNumber.trim()) {
      newErrors.sealNumber = 'Número do lacre é obrigatório';
    }

    if (!formData.vehiclePlate.trim()) {
      newErrors.vehiclePlate = 'Placa do caminhão é obrigatória';
    }

    if (!formData.trailerPlate.trim()) {
      newErrors.trailerPlate = 'Placa do reboque é obrigatória';
    }

    if (!formData.transporterInfo.name.trim()) {
      newErrors.transporterName = 'Nome da transportadora é obrigatório';
    }

    // Validate required photos
    const photoTypesPresent = new Set(formData.executionPhotos.map(p => p.type));
    const missingRequired = REQUIRED_PHOTO_TYPES.filter(t => !photoTypesPresent.has(t));
    if (missingRequired.length > 0) {
      newErrors.requiredPhotos = 'Anexe todas as fotos obrigatórias antes de iniciar';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit({
        containerNumber: formData.containerNumber,
        sealNumber: formData.sealNumber,
        transporterInfo: formData.transporterInfo,
        conditionAssessment: formData.conditionAssessment,
        specialInstructions: formData.specialInstructions,
        vehiclePlate: formData.vehiclePlate,
        executionPhotos: formData.executionPhotos,
        executionMetadata: {
          trailerPlate: formData.trailerPlate,
          requiredPhotoTypes: REQUIRED_PHOTO_TYPES
        }
      } as any);
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
      {/* Quick Navigation & Status Summary */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b p-3 rounded">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={formData.containerNumber ? 'default' : 'secondary'} className="flex items-center gap-1">
              <Ship className="h-3 w-3" />
              Container {formData.containerNumber ? <Check className="h-3 w-3" /> : 'pendente'}
            </Badge>
            <Badge variant={formData.sealNumber ? 'default' : 'secondary'} className="flex items-center gap-1">
              <Camera className="h-3 w-3" />
              Lacre {formData.sealNumber ? <Check className="h-3 w-3" /> : 'pendente'}
            </Badge>
            <Badge variant={formData.vehiclePlate ? 'default' : 'secondary'} className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              Placa {formData.vehiclePlate ? <Check className="h-3 w-3" /> : 'pendente'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Navigation className="h-4 w-4" />
            <a href="#sec-veiculo" className="hover:underline">Veículo</a>
            <span>·</span>
            <a href="#sec-container" className="hover:underline">Container</a>
            <span>·</span>
            <a href="#sec-transp" className="hover:underline">Transportadora</a>
            <span>·</span>
            <a href="#sec-cond" className="hover:underline">Condição</a>
            <span>·</span>
            <a href="#sec-fotos" className="hover:underline">Fotos</a>
          </div>
        </div>
      </div>
      {/* Vehicle Information */}
      <Card id="sec-veiculo">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-green-600" />
            Informações do Veículo
          </CardTitle>
          <CardDescription>
            Informe as placas do caminhão e do reboque/carreta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehiclePlate">Placa do Caminhão *</Label>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="trailerPlate">Placa do Reboque/Carreta *</Label>
              <Input
                id="trailerPlate"
                value={formData.trailerPlate}
                onChange={(e) => setFormData(prev => ({ ...prev, trailerPlate: formatPlate(e.target.value) }))}
                placeholder="Ex: DEF-5678 ou DEF1G23"
                className={errors.trailerPlate ? 'border-red-500' : ''}
                maxLength={8}
              />
              {errors.trailerPlate && (
                <p className="text-sm text-red-600">{errors.trailerPlate}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Container Information */}
      <Card id="sec-container">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5 text-blue-600" />
            Informações do Container
          </CardTitle>
          <CardDescription>
            Dados específicos do container que está sendo descarregado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="containerNumber">Número do Container *</Label>
              <Input
                id="containerNumber"
                value={formData.containerNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, containerNumber: e.target.value }))}
                placeholder="Ex: TCLU1234567"
                className={errors.containerNumber ? 'border-red-500' : ''}
              />
              {errors.containerNumber && (
                <p className="text-sm text-red-600">{errors.containerNumber}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sealNumber">Número do Lacre *</Label>
              <Input
                id="sealNumber"
                value={formData.sealNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, sealNumber: e.target.value }))}
                placeholder="Ex: 123456"
                className={errors.sealNumber ? 'border-red-500' : ''}
              />
              {errors.sealNumber && (
                <p className="text-sm text-red-600">{errors.sealNumber}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transporter Information */}
      <Card id="sec-transp">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-green-600" />
            Informações da Transportadora
          </CardTitle>
          <CardDescription>
            Dados da empresa responsável pelo transporte do container
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
                placeholder="Ex: (11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transporterDocument">CNPJ/CPF</Label>
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
      <Card id="sec-cond">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-600" />
            Avaliação da Condição
          </CardTitle>
          <CardDescription>
            Avalie a condição geral do container e dos itens
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
              placeholder="Descreva quaisquer observações importantes sobre o container ou processo de descarregamento..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Photos Section */}
      <Card id="sec-fotos">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-purple-600" />
            Registro Fotográfico Obrigatório
          </CardTitle>
          <CardDescription>
            Anexe as fotos exigidas antes de iniciar o descarregamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PhotoUploadGrid 
            photos={formData.executionPhotos}
            onPhotosChange={(photos) => setFormData(prev => ({ ...prev, executionPhotos: photos }))}
            requiredTypes={REQUIRED_PHOTO_TYPES}
          />
          {errors.requiredPhotos && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {errors.requiredPhotos}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sticky Action Bar */}
      <div className="sticky bottom-0 z-30 bg-white/90 backdrop-blur border-t">
        <div className="container mx-auto py-3 flex flex-col md:flex-row items-center gap-3 justify-between">
          <div className="text-sm text-gray-700 flex flex-wrap items-center gap-2">
            <CircleAlert className="h-4 w-4 text-amber-600" />
            <span>
              {(() => {
                const present = new Set(formData.executionPhotos.map(p => p.type));
                const missing = REQUIRED_PHOTO_TYPES.filter(t => !present.has(t));
                const fieldsMissing = [
                  !formData.vehiclePlate && 'Placa do caminhão',
                  !formData.trailerPlate && 'Placa do reboque',
                  !formData.containerNumber && 'Número do container',
                  !formData.sealNumber && 'Número do lacre'
                ].filter(Boolean) as string[];
                const parts: string[] = [];
                if (missing.length > 0) parts.push(`${missing.length} foto(s) obrigatória(s)`);
                if (fieldsMissing.length > 0) parts.push(`${fieldsMissing.length} campo(s)`);
                return parts.length > 0 ? `Faltando: ${parts.join(' e ')}` : 'Pronto para iniciar';
              })()}
            </span>
          </div>
          <Button 
            onClick={handleSubmit}
            disabled={(() => {
              const present = new Set(formData.executionPhotos.map(p => p.type));
              const missing = REQUIRED_PHOTO_TYPES.filter(t => !present.has(t));
              return isSubmitting || missing.length > 0 || !formData.vehiclePlate || !formData.trailerPlate || !formData.containerNumber || !formData.sealNumber;
            })()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Iniciando...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Iniciar Descarregamento
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}