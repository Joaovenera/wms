import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Info, CheckCircle, Package, Users } from "lucide-react";

/**
 * Example integration component showing how to use the new composition system
 * This demonstrates the complete integration between packaging and composition management
 */
export function CompositionIntegrationExample() {
  return (
    <div className="space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Sistema de Composições Integrado</h1>
        <p className="text-muted-foreground">
          Gerenciamento completo de embalagens e composições multi-produto
        </p>
      </div>

      {/* Integration Overview */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Integração Completa:</strong> O sistema agora permite criar composições otimizadas
          de múltiplos produtos em pallets, com validação em tempo real e visualização 3D/2D.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Packaging Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Funcionalidades de Embalagem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Gestão hierárquica de embalagens</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Escaneamento de códigos de barra</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Otimização de separação</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Conversão entre tipos de embalagem</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Controle de estoque consolidado</span>
            </div>
          </CardContent>
        </Card>

        {/* Composition Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Funcionalidades de Composição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Composições multi-produto</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Validação em tempo real</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Otimização de layout 3D</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Análise de eficiência</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Relatórios detalhados</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Como Usar o Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Badge variant="outline" className="mb-2">Passo 1</Badge>
            <p className="text-sm">
              <strong>Gestão de Embalagens:</strong> Use o <code>PackagingManager</code> para configurar
              diferentes tipos de embalagem para seus produtos, incluindo embalagens hierárquicas.
            </p>
          </div>

          <div className="space-y-2">
            <Badge variant="outline" className="mb-2">Passo 2</Badge>
            <p className="text-sm">
              <strong>Criação de Composições:</strong> No <code>CompositionManager</code>, crie composições
              selecionando múltiplos produtos, quantidades e restrições de peso/volume.
            </p>
          </div>

          <div className="space-y-2">
            <Badge variant="outline" className="mb-2">Passo 3</Badge>
            <p className="text-sm">
              <strong>Validação:</strong> O <code>CompositionValidator</code> verifica automaticamente se
              a composição atende às restrições do pallet e fornece recomendações.
            </p>
          </div>

          <div className="space-y-2">
            <Badge variant="outline" className="mb-2">Passo 4</Badge>
            <p className="text-sm">
              <strong>Visualização:</strong> Use o <code>CompositionVisualization</code> para ver o layout
              3D/2D da composição e métricas detalhadas de eficiência.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Integration Points */}
      <Card>
        <CardHeader>
          <CardTitle>Pontos de Integração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium mb-2">API Hooks</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <code>useComposition</code> - CRUD de composições</li>
                <li>• <code>useValidateComposition</code> - Validação</li>
                <li>• <code>useProductPackaging</code> - Embalagens</li>
                <li>• <code>useOptimizePicking</code> - Otimização</li>
              </ul>
            </div>

            <div className="p-3 border rounded-lg">
              <h4 className="font-medium mb-2">Componentes UI</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <code>CompositionManager</code> - Gestão principal</li>
                <li>• <code>CompositionAssembly</code> - Criação</li>
                <li>• <code>CompositionValidator</code> - Validação</li>
                <li>• <code>CompositionVisualization</code> - Visualização</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Optimizations */}
      <Card>
        <CardHeader>
          <CardTitle>Otimizações para Ambiente de Armazém</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm">Interface otimizada para tablets e dispositivos móveis</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm">Botões touch-friendly com feedback visual</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm">Cacheable queries para melhor performance em rede lenta</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm">Validação debounced para evitar requisições excessivas</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm">Layout responsivo para diferentes tamanhos de tela</span>
          </div>
        </CardContent>
      </Card>

      {/* Example Code Snippet */}
      <Card>
        <CardHeader>
          <CardTitle>Exemplo de Uso</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Exemplo de integração em uma página de produto
import { CompositionManager } from '@/components/composition-manager';
import { PackagingManager } from '@/components/packaging-manager';

function ProductPage({ product }) {
  return (
    <div>
      <PackagingManager product={product} />
      {/* Composições são automaticamente integradas via tabs */}
    </div>
  );
}

// Exemplo de uso standalone do gerenciador de composições
import { CompositionManager } from '@/components/composition-manager';

function CompositionsPage() {
  return <CompositionManager />;
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}