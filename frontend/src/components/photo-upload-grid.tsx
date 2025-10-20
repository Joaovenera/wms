import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Camera, 
  Upload, 
  X, 
  Eye, 
  Check,
  AlertTriangle,
  Lock,
  Hash,
  DoorOpen,
  Sparkles,
  Image,
  CirclePlus
} from "lucide-react";
import { ContainerPhoto, ContainerPhotoType, CONTAINER_PHOTO_TYPES } from "@/types/container";
import { CameraCapture } from "./camera-capture";

interface PhotoUploadGridProps {
  photos: ContainerPhoto[];
  onPhotosChange: (photos: ContainerPhoto[]) => void;
  disabled?: boolean;
  maxFileSize?: number; // in MB
  requiredTypes?: Array<ContainerPhotoType['type']>;
}

const ICON_MAP = {
  Lock,
  Hash,
  DoorOpen,
  Sparkles
};

export function PhotoUploadGrid({ 
  photos, 
  onPhotosChange, 
  disabled = false,
  maxFileSize = 10,
  requiredTypes
}: PhotoUploadGridProps) {
  const [uploadingTypes, setUploadingTypes] = useState<Set<string>>(new Set());
  const [previewPhoto, setPreviewPhoto] = useState<ContainerPhoto | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const evidenceFileRef = useRef<HTMLInputElement | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraTargetType, setCameraTargetType] = useState<string | null>(null);

  const getPhotoByType = (type: string): ContainerPhoto | undefined => {
    return photos.find(photo => photo.type === type);
  };

  const isTypeComplete = (type: string): boolean => {
    return !!getPhotoByType(type);
  };

  const getRequiredTypes = (): Array<ContainerPhotoType['type']> => {
    return requiredTypes && requiredTypes.length > 0
      ? requiredTypes
      : CONTAINER_PHOTO_TYPES.filter(t => t.required).map(t => t.type);
  };

  const getCompletionPercentage = (): number => {
    const req = getRequiredTypes();
    if (req.length === 0) return 100;
    const completedCount = req.filter(type => isTypeComplete(type)).length;
    return (completedCount / req.length) * 100;
  };

  const missingRequired = () => {
    const req = getRequiredTypes();
    return req.filter(type => !isTypeComplete(type));
  };

  const [showOnlyPending, setShowOnlyPending] = useState<boolean>(true);

  const handleFileSelect = async (type: string, files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;
    
    const file = files[0];
    
    // Validações
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    if (file.size > maxFileSize * 1024 * 1024) {
      alert(`Arquivo muito grande. Tamanho máximo permitido: ${maxFileSize}MB`);
      return;
    }

    setUploadingTypes(prev => new Set(prev.add(type)));

    try {
      // Converter para base64 para preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const newPhoto: ContainerPhoto = {
          id: `temp_${Date.now()}_${type}`,
          type: type as ContainerPhoto['type'],
          url: e.target?.result as string,
          filename: file.name,
          uploadedAt: new Date().toISOString(),
          size: file.size,
          mimeType: file.type
        };

        // Para evidências, acumular; para os demais tipos, substituir o mesmo tipo
        let updatedPhotos: ContainerPhoto[];
        if (type === 'evidence') {
          updatedPhotos = [...photos, newPhoto];
        } else {
          updatedPhotos = photos.filter(photo => photo.type !== type);
          updatedPhotos.push(newPhoto);
        }
        
        onPhotosChange(updatedPhotos);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      alert('Erro ao processar a imagem. Tente novamente.');
    } finally {
      setUploadingTypes(prev => {
        const newSet = new Set(prev);
        newSet.delete(type);
        return newSet;
      });
    }
  };

  const removePhoto = (type: string) => {
    if (disabled) return;
    
    const updatedPhotos = photos.filter(photo => photo.type !== type);
    onPhotosChange(updatedPhotos);
    
    // Reset file input
    if (fileInputRefs.current[type]) {
      fileInputRefs.current[type]!.value = '';
    }
  };

  const openCamera = (type: string) => {
    if (disabled) return;
    setCameraTargetType(type);
    setShowCamera(true);
  };

  const openFileDialog = (type: string) => {
    if (disabled) return;
    
    if (fileInputRefs.current[type]) {
      fileInputRefs.current[type]!.removeAttribute('capture');
      fileInputRefs.current[type]!.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-blue-600" />
              Registro Fotográfico do Container
            </span>
            <div className="flex items-center gap-2">
              <Badge variant={getCompletionPercentage() === 100 ? "default" : "secondary"}>
                {Math.round(getCompletionPercentage())}% Completo
              </Badge>
              {missingRequired().length > 0 && (
                <Badge variant="destructive">{missingRequired().length} pendentes</Badge>
              )}
            </div>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={showOnlyPending ? 'default' : 'outline'} onClick={() => setShowOnlyPending(true)}>
              Pendentes
            </Button>
            <Button size="sm" variant={!showOnlyPending ? 'default' : 'outline'} onClick={() => setShowOnlyPending(false)}>
              Todos
            </Button>
          </div>
          <Progress value={getCompletionPercentage()} className="mt-2" />
        </CardHeader>
      </Card>

      {/* Grid de Upload de Fotos */
      }
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CONTAINER_PHOTO_TYPES
          .filter(t => !showOnlyPending || !isTypeComplete(t.type))
          .map((photoType) => {
          const photo = getPhotoByType(photoType.type);
          const isUploading = uploadingTypes.has(photoType.type);
          const isComplete = isTypeComplete(photoType.type);
          const IconComponent = ICON_MAP[photoType.icon as keyof typeof ICON_MAP];
          const isRequired = getRequiredTypes().includes(photoType.type);

          return (
            <Card 
              key={photoType.type}
              className={`transition-all ${
                isComplete 
                  ? 'border-green-200 bg-green-50/30' 
                  : 'border-gray-200 hover:border-blue-300'
              } ${disabled ? 'opacity-60' : ''}`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <IconComponent className={`h-5 w-5 ${isComplete ? 'text-green-600' : 'text-gray-600'}`} />
                  {photoType.label}
                  {isRequired && (
                    <Badge variant="destructive" className="text-xs ml-2">
                      Obrigatório
                    </Badge>
                  )}
                  {isComplete && (
                    <Check className="h-4 w-4 text-green-600 ml-auto" />
                  )}
                </CardTitle>
                <p className="text-sm text-gray-600">{photoType.description}</p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Input oculto para seleção de arquivo */}
                <input
                  ref={el => fileInputRefs.current[photoType.type] = el}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(photoType.type, e.target.files)}
                  className="hidden"
                />

                {photo ? (
                  /* Foto já carregada */
                  <div className="space-y-3">
                    <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      <img 
                        src={photo.url} 
                        alt={photoType.label}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPreviewPhoto(photo)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removePhoto(photoType.type)}
                          disabled={disabled}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Remover
                        </Button>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      <p><strong>Arquivo:</strong> {photo.filename}</p>
                      <p><strong>Tamanho:</strong> {(photo.size / (1024 * 1024)).toFixed(2)} MB</p>
                      <p><strong>Enviado:</strong> {new Date(photo.uploadedAt).toLocaleString('pt-BR')}</p>
                      {photo.note && (
                        <p><strong>Observação:</strong> {photo.note}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Área de upload */
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                      <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-sm text-gray-600 mb-4">
                        Adicione uma foto de {photoType.label.toLowerCase()}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCamera(photoType.type)}
                          disabled={disabled || isUploading}
                          className="flex items-center gap-2"
                        >
                          <Camera className="h-4 w-4" />
                          Câmera
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openFileDialog(photoType.type)}
                          disabled={disabled || isUploading}
                          className="flex items-center gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          Arquivo
                        </Button>
                      </div>
                    </div>

                    {isUploading && (
                      <div className="flex items-center justify-center text-sm text-blue-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2" />
                        Processando imagem...
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CameraCapture
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={async (blob) => {
          if (!cameraTargetType) return;
          const file = new File([blob], `${cameraTargetType}-${Date.now()}.jpg`, { type: 'image/jpeg' });
          const reader = new FileReader();
          reader.onload = (e) => {
            const newPhoto: ContainerPhoto = {
              id: `temp_${Date.now()}_${cameraTargetType}`,
              type: cameraTargetType as ContainerPhoto['type'],
              url: e.target?.result as string,
              filename: file.name,
              uploadedAt: new Date().toISOString(),
              size: file.size,
              mimeType: file.type
            };
            let updated = photos;
            if (cameraTargetType === 'evidence') {
              updated = [...photos, newPhoto];
            } else {
              updated = photos.filter(p => p.type !== cameraTargetType);
              updated.push(newPhoto);
            }
            onPhotosChange(updated);
          };
          reader.readAsDataURL(file);
        }}
        facingMode="environment"
      />

      {/* Evidências adicionais */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CirclePlus className="h-5 w-5 text-amber-600" />
            Evidências adicionais (opcionais)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {/* Câmera agora usa o overlay CameraCapture; input oculto removido */}
            <input
              ref={el => (evidenceFileRef.current = el)}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect('evidence', e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setCameraTargetType('evidence'); setShowCamera(true); }}
              disabled={disabled}
              className="flex items-center gap-2"
            >
              <Camera className="h-4 w-4" />
              Usar câmera
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => evidenceFileRef.current?.click()}
              disabled={disabled}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Selecionar arquivo
            </Button>
          </div>
          <div className="text-sm text-gray-600">Use evidências para registrar qualquer situação suspeita ou incorreta.</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {photos.filter(p => p.type === 'evidence').map((photo) => (
              <div key={photo.id} className="border rounded p-2 space-y-2">
                <img src={photo.url} alt="Evidência" className="w-full h-40 object-cover rounded" />
                <div>
                  <label className="text-xs text-gray-600">Observação</label>
                  <Input
                    value={photo.note || ''}
                    onChange={(e) => {
                      const updated = photos.map(ph => ph.id === photo.id ? { ...ph, note: e.target.value } : ph);
                      onPhotosChange(updated);
                    }}
                    placeholder="Descreva o que foi observado (opcional)"
                  />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="destructive" onClick={() => {
                    const updated = photos.filter(ph => ph.id !== photo.id);
                    onPhotosChange(updated);
                  }}>
                    <X className="h-4 w-4 mr-1" /> Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerta de Validação */}
      {getCompletionPercentage() < 100 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Documentação Incompleta:</strong> É necessário anexar todas as fotos obrigatórias 
            para completar o registro do container.
          </AlertDescription>
        </Alert>
      )}

      {/* Modal de Preview */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
          <div className="relative max-w-4xl max-h-full bg-white rounded-lg overflow-hidden">
            <div className="absolute top-4 right-4 z-10">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPreviewPhoto(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <img 
              src={previewPhoto.url} 
              alt="Preview"
              className="max-w-full max-h-[80vh] object-contain"
            />
            
            <div className="p-4 bg-white">
              <h3 className="font-semibold text-lg mb-2">
                {CONTAINER_PHOTO_TYPES.find(t => t.type === previewPhoto.type)?.label}
              </h3>
              <div className="text-sm text-gray-600 grid grid-cols-2 gap-4">
                <p><strong>Arquivo:</strong> {previewPhoto.filename}</p>
                <p><strong>Tamanho:</strong> {(previewPhoto.size / (1024 * 1024)).toFixed(2)} MB</p>
                <p><strong>Enviado:</strong> {new Date(previewPhoto.uploadedAt).toLocaleString('pt-BR')}</p>
                <p><strong>Tipo:</strong> {previewPhoto.mimeType}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}