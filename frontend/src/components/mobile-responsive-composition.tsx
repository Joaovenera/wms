import React, { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "./ui/drawer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { useMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Minus,
  Package, 
  Search, 
  Trash2, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Settings,
  Layers,
  Scale,
  Ruler,
  Target,
  Zap,
  TrendingUp,
  Brain,
  Lightbulb,
  BarChart3,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Home,
  Filter,
  SortAsc,
  Smartphone,
  Tablet,
  Monitor
} from "lucide-react";
import {
  CompositionRequest,
  CompositionResult,
  CompositionProduct,
  CompositionConstraints,
  Product,
  Pallet,
  PackagingType,
  ValidationResult,
  PackagingComposition
} from "../types/api";
import { IntelligentCompositionBuilder } from "./intelligent-composition-builder";
import { RealtimeValidationFeedback } from "./realtime-validation-feedback";
import { CompositionVisualization } from "./composition-visualization";

interface MobileResponsiveCompositionProps {
  onCompositionCreate?: (request: CompositionRequest, metadata: { name: string; description?: string }) => void;
  onCompositionUpdate?: (request: CompositionRequest, validation?: ValidationResult) => void;
  onOptimizationApply?: (request: CompositionRequest) => void;
  initialComposition?: PackagingComposition;
  className?: string;
}

interface ViewportInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

export function MobileResponsiveComposition({
  onCompositionCreate,
  onCompositionUpdate,
  onOptimizationApply,
  initialComposition,
  className
}: MobileResponsiveCompositionProps) {
  const isMobile = useMobile();
  const { toast } = useToast();
  
  // State for responsive behavior
  const [currentStep, setCurrentStep] = useState<'builder' | 'validation' | 'preview'>('builder');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showValidationPanel, setShowValidationPanel] = useState(!isMobile);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  // Composition state
  const [compositionRequest, setCompositionRequest] = useState<CompositionRequest | null>(null);
  const [validationData, setValidationData] = useState<ValidationResult | null>(null);
  
  // Viewport information
  const [viewportInfo, setViewportInfo] = useState<ViewportInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1920,
    height: 1080,
    orientation: 'landscape'
  });

  // Update viewport information
  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setViewportInfo({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        width,
        height,
        orientation: width > height ? 'landscape' : 'portrait'
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  // Handle composition updates
  const handleCompositionUpdate = useCallback((request: CompositionRequest, validation?: ValidationResult) => {
    setCompositionRequest(request);
    if (validation) {
      setValidationData(validation);
    }
    onCompositionUpdate?.(request, validation);
  }, [onCompositionUpdate]);

  // Handle quick fixes from validation
  const handleQuickFix = useCallback((fixAction: any) => {
    toast({
      title: "Correção aplicada",
      description: fixAction.title,
    });
    
    // Apply the fix logic here
    // This would typically update the composition request
  }, [toast]);

  // Toggle section collapse
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Navigation for mobile
  const navigateStep = useCallback((step: 'builder' | 'validation' | 'preview') => {
    setCurrentStep(step);
    setMobileNavOpen(false);
  }, []);

  // Responsive navigation component
  const ResponsiveNavigation = () => (
    <div className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {viewportInfo.isMobile ? (
            <Smartphone className="h-4 w-4 text-blue-600" />
          ) : viewportInfo.isTablet ? (
            <Tablet className="h-4 w-4 text-green-600" />
          ) : (
            <Monitor className="h-4 w-4 text-purple-600" />
          )}
          <span className="text-sm font-medium">
            {viewportInfo.width}×{viewportInfo.height}
          </span>
        </div>
        <Badge variant="outline" className="text-xs">
          {viewportInfo.orientation}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {isMobile ? (
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle>Navegação</SheetTitle>
                <SheetDescription>
                  Escolha a seção para trabalhar
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <Button
                  variant={currentStep === 'builder' ? 'default' : 'outline'}
                  onClick={() => navigateStep('builder')}
                  className="w-full justify-start"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Construtor Inteligente
                </Button>
                <Button
                  variant={currentStep === 'validation' ? 'default' : 'outline'}
                  onClick={() => navigateStep('validation')}
                  className="w-full justify-start"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Validação em Tempo Real
                </Button>
                <Button
                  variant={currentStep === 'preview' ? 'default' : 'outline'}
                  onClick={() => navigateStep('preview')}
                  className="w-full justify-start"
                  disabled={!compositionRequest}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Visualização
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Tabs value={currentStep} onValueChange={(value) => setCurrentStep(value as any)}>
            <TabsList>
              <TabsTrigger value="builder">
                <Brain className="h-4 w-4 mr-2" />
                Construtor
              </TabsTrigger>
              <TabsTrigger value="validation">
                <CheckCircle className="h-4 w-4 mr-2" />
                Validação
              </TabsTrigger>
              <TabsTrigger value="preview" disabled={!compositionRequest}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  // Mobile step navigation
  const MobileStepNavigation = () => (
    <div className="flex items-center justify-between p-3 border-t bg-background sticky bottom-0">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (currentStep === 'validation') navigateStep('builder');
          else if (currentStep === 'preview') navigateStep('validation');
        }}
        disabled={currentStep === 'builder'}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Anterior
      </Button>

      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${currentStep === 'builder' ? 'bg-blue-600' : 'bg-gray-300'}`} />
        <div className={`w-2 h-2 rounded-full ${currentStep === 'validation' ? 'bg-blue-600' : 'bg-gray-300'}`} />
        <div className={`w-2 h-2 rounded-full ${currentStep === 'preview' ? 'bg-blue-600' : 'bg-gray-300'}`} />
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (currentStep === 'builder') navigateStep('validation');
          else if (currentStep === 'validation') navigateStep('preview');
        }}
        disabled={currentStep === 'preview' || (currentStep === 'builder' && !compositionRequest)}
      >
        Próximo
        <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );

  // Collapsible section component
  const CollapsibleSection = ({ 
    id, 
    title, 
    icon: Icon, 
    children, 
    badge,
    defaultOpen = true 
  }: {
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    badge?: string;
    defaultOpen?: boolean;
  }) => {
    const isOpen = !collapsedSections.has(id);
    
    useEffect(() => {
      if (!defaultOpen && !collapsedSections.has(id)) {
        setCollapsedSections(prev => new Set([...prev, id]));
      }
    }, [id, defaultOpen]);

    return (
      <Collapsible open={isOpen} onOpenChange={() => toggleSection(id)}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="font-medium">{title}</span>
              {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Render content based on current step and viewport
  const renderContent = () => {
    if (viewportInfo.isMobile) {
      // Mobile single-panel view
      return (
        <div className="space-y-4">
          {currentStep === 'builder' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  Construtor Inteligente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <IntelligentCompositionBuilder
                  onCompositionUpdate={handleCompositionUpdate}
                  onOptimizationApply={onOptimizationApply}
                  initialProducts={initialComposition?.products}
                  initialPalletId={initialComposition?.palletId}
                  initialConstraints={initialComposition?.constraints}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 'validation' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Validação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RealtimeValidationFeedback
                  compositionRequest={compositionRequest}
                  onValidationChange={setValidationData}
                  onQuickFix={handleQuickFix}
                  showAdvanced={false}
                  autoRefresh={true}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 'preview' && compositionRequest && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-purple-600" />
                  Visualização
                </CardTitle>
              </CardHeader>
              <CardContent>
                {initialComposition ? (
                  <CompositionVisualization composition={initialComposition} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Crie uma composição para visualizar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      );
    } else if (viewportInfo.isTablet) {
      // Tablet two-column view
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <CollapsibleSection id="builder" title="Construtor Inteligente" icon={Brain}>
              <IntelligentCompositionBuilder
                onCompositionUpdate={handleCompositionUpdate}
                onOptimizationApply={onOptimizationApply}
                initialProducts={initialComposition?.products}
                initialPalletId={initialComposition?.palletId}
                initialConstraints={initialComposition?.constraints}
              />
            </CollapsibleSection>
          </div>
          
          <div className="space-y-4">
            <CollapsibleSection 
              id="validation" 
              title="Validação em Tempo Real" 
              icon={CheckCircle}
              badge={validationData?.isValid ? 'Válida' : validationData ? 'Inválida' : undefined}
            >
              <RealtimeValidationFeedback
                compositionRequest={compositionRequest}
                onValidationChange={setValidationData}
                onQuickFix={handleQuickFix}
                showAdvanced={true}
                autoRefresh={true}
              />
            </CollapsibleSection>

            {compositionRequest && (
              <CollapsibleSection 
                id="preview" 
                title="Visualização" 
                icon={Eye}
                defaultOpen={false}
              >
                {initialComposition ? (
                  <CompositionVisualization composition={initialComposition} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aguardando criação da composição</p>
                  </div>
                )}
              </CollapsibleSection>
            )}
          </div>
        </div>
      );
    } else {
      // Desktop three-column view
      return (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  Construtor Inteligente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <IntelligentCompositionBuilder
                  onCompositionUpdate={handleCompositionUpdate}
                  onOptimizationApply={onOptimizationApply}
                  initialProducts={initialComposition?.products}
                  initialPalletId={initialComposition?.palletId}
                  initialConstraints={initialComposition?.constraints}
                />
              </CardContent>
            </Card>
          </div>
          
          <div className="col-span-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Validação em Tempo Real
                  </CardTitle>
                  {validationData && (
                    <Badge variant={validationData.isValid ? 'default' : 'destructive'}>
                      {validationData.isValid ? 'Válida' : 'Inválida'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <RealtimeValidationFeedback
                  compositionRequest={compositionRequest}
                  onValidationChange={setValidationData}
                  onQuickFix={handleQuickFix}
                  showAdvanced={true}
                  autoRefresh={true}
                />
              </CardContent>
            </Card>
          </div>
          
          <div className="col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-purple-600" />
                  Visualização
                </CardTitle>
              </CardHeader>
              <CardContent>
                {compositionRequest && initialComposition ? (
                  <CompositionVisualization composition={initialComposition} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Crie uma composição para visualizar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }
  };

  // Main render with fullscreen support
  return (
    <div className={`${className} ${isFullscreen ? 'fixed inset-0 z-50 bg-background overflow-auto' : ''}`}>
      <ResponsiveNavigation />
      
      <div className="p-4">
        {renderContent()}
      </div>

      {viewportInfo.isMobile && <MobileStepNavigation />}

      {/* Quick action buttons for mobile */}
      {viewportInfo.isMobile && compositionRequest && (
        <div className="fixed bottom-20 right-4 flex flex-col gap-2">
          <Button
            size="sm"
            onClick={() => setShowValidationPanel(!showValidationPanel)}
            className="rounded-full shadow-lg"
          >
            {showValidationPanel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          
          {onCompositionCreate && (
            <Button
              size="sm"
              onClick={() => {
                if (compositionRequest) {
                  onCompositionCreate(compositionRequest, {
                    name: `Composição ${new Date().toLocaleString()}`,
                    description: 'Criada via interface móvel'
                  });
                }
              }}
              className="rounded-full shadow-lg"
              disabled={!compositionRequest}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Mobile validation overlay */}
      {viewportInfo.isMobile && showValidationPanel && compositionRequest && (
        <Drawer open={showValidationPanel} onOpenChange={setShowValidationPanel}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Validação da Composição</DrawerTitle>
              <DrawerDescription>
                Status da validação em tempo real
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4">
              <RealtimeValidationFeedback
                compositionRequest={compositionRequest}
                onValidationChange={setValidationData}
                onQuickFix={handleQuickFix}
                showAdvanced={false}
                autoRefresh={true}
              />
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Fechar</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}

      {/* Development viewport indicator */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-20 right-4 bg-black text-white text-xs px-2 py-1 rounded opacity-75 z-50">
          {viewportInfo.width}×{viewportInfo.height} • {viewportInfo.isMobile ? 'Mobile' : viewportInfo.isTablet ? 'Tablet' : 'Desktop'}
        </div>
      )}
    </div>
  );
}