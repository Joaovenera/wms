import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, RefreshCw } from "lucide-react";
import {
  type InsertPallet,
  type Pallet,
} from "@/types/api";
import { insertPalletSchema } from "@/types/schemas";

// Valores padrão para cada tipo de pallet
const palletTypeDefaults = {
  PBR: {
    width: 100,
    length: 120,
    height: 14,
    maxWeight: 1500,
  },
  Europeu: {
    width: 80,
    length: 120,
    height: 14.4,
    maxWeight: 1500,
  },
  Chep: {
    width: 110,
    length: 110,
    height: 15,
    maxWeight: 1250,
  },
  Americano: {
    width: 101.6,
    length: 121.9,
    height: 14,
    maxWeight: 1360,
  },
};

interface PalletFormProps {
  editingPallet?: Pallet | null;
  onSubmit: (data: InsertPallet) => void;
  isLoading?: boolean;
}

export default function PalletForm({ editingPallet, onSubmit, isLoading }: PalletFormProps) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState<string | null>(null);

  const form = useForm<InsertPallet>({
    resolver: zodResolver(insertPalletSchema),
    defaultValues: {
      code: "",
      type: "",
      material: "",
      width: 0,
      length: 0,
      height: 0,
      maxWeight: "0",
      createdBy: 1,
      status: "disponivel",
      photoUrl: "",
      observations: "",
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (editingPallet) {
      form.reset({
        code: editingPallet.code,
        type: editingPallet.type,
        material: editingPallet.material,
        width: editingPallet.width,
        length: editingPallet.length,
        height: editingPallet.height,
        maxWeight: editingPallet.maxWeight.toString(),
        createdBy: editingPallet.createdBy,
        status: editingPallet.status,
        photoUrl: editingPallet.photoUrl || "",
        observations: editingPallet.observations || "",
      });
      setPhotoPreview(editingPallet.photoUrl || null);
    } else {
      form.reset();
      setPhotoPreview(null);
      generateNextCode();
    }
  }, [editingPallet, form]);

  // Generate next code
  const generateNextCode = async () => {
    if (!editingPallet) {
      try {
        const response = await fetch('/api/pallets/next-code');
        if (response.ok) {
          const data = await response.json();
          form.setValue('code', data.code);
        }
      } catch (error) {
        console.error('Erro ao gerar próximo código:', error);
      }
    }
  };

  const handleCameraCapture = (imageData: string) => {
    if (imageData && imageData !== "data:,") {
      setPhotoPreview(imageData);
      form.setValue("photoUrl", imageData);
    }
    setIsCameraOpen(false);
  };

  const handleSubmit = (data: InsertPallet) => {
    onSubmit(data);
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código</FormLabel>
                <FormControl>
                  <div className="flex space-x-2">
                    <Input placeholder="PLT0001" {...field} className="flex-1" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateNextCode}
                      title="Gerar código automático"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    const defaults = palletTypeDefaults[value as keyof typeof palletTypeDefaults];
                    if (defaults) {
                      form.setValue("width", defaults.width);
                      form.setValue("length", defaults.length);
                      form.setValue("height", defaults.height);
                      form.setValue("maxWeight", defaults.maxWeight.toString());
                    }
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PBR">PBR</SelectItem>
                    <SelectItem value="Europeu">Europeu</SelectItem>
                    <SelectItem value="Chep">Chep</SelectItem>
                    <SelectItem value="Americano">Americano</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="material"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Material</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o material" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Madeira">Madeira</SelectItem>
                    <SelectItem value="Plástico">Plástico</SelectItem>
                    <SelectItem value="Metal">Metal</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-2">
            <FormField
              control={form.control}
              name="width"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Largura (cm)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="length"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comprimento (cm)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <FormField
              control={form.control}
              name="height"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Altura (cm)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxWeight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Peso Máx (kg)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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
                                    <SelectItem value="disponivel">Disponível</SelectItem>
                <SelectItem value="em_uso">Em Uso</SelectItem>
                <SelectItem value="defeituoso">Defeituoso</SelectItem>
                <SelectItem value="recuperacao">Manutenção</SelectItem>
                <SelectItem value="descarte">Descarte</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Photo Section */}
          <div className="space-y-2">
            <FormLabel className="text-sm font-medium">Foto do Pallet</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCameraOpen(true)}
              className="w-full h-10"
            >
              <Camera className="h-4 w-4 mr-2" />
              {photoPreview ? "Alterar Foto" : "Tirar Foto"}
            </Button>

            {photoPreview && (
              <div className="mt-2">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-24 object-cover rounded border cursor-pointer"
                  onClick={() => setShowImageViewer(photoPreview)}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="photoUrl"
              render={({ field }) => (
                <FormControl>
                  <Input type="hidden" {...field} value={field.value || ""} />
                </FormControl>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="observations"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl>
                  <Textarea {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {editingPallet ? "Atualizar" : "Criar"} Pallet
          </Button>
        </form>
      </Form>

      {/* Camera Capture - Only render when needed */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-black">
          <div className="relative h-full">
            <button
              onClick={() => setIsCameraOpen(false)}
              className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 text-black"
            >
              ✕
            </button>
            <div className="h-full flex items-center justify-center">
              <div className="text-white text-center">
                <Camera className="h-16 w-16 mx-auto mb-4" />
                <p>Funcionalidade de câmera em desenvolvimento</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsCameraOpen(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer */}
      {showImageViewer && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center"
          onClick={() => setShowImageViewer(null)}
        >
          <div className="max-w-full max-h-full p-4">
            <img
              src={showImageViewer}
              alt="Foto ampliada"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}