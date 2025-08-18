import React, { useState } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { AlertCircle, CheckCircle, ChevronRight, ChevronDown, Package, Barcode, Ruler, Weight, AlertTriangle, Info } from "lucide-react";
import { PackagingType } from "../types/api";
import { cn } from "../lib/utils";

interface HierarchyNode extends PackagingType {
  children: HierarchyNode[];
  depth: number;
  path: number[];
  effectiveWeight?: number;
  effectiveVolume?: number;
}

interface PackagingHierarchyTreeProps {
  hierarchy: HierarchyNode[];
  metadata?: {
    totalLevels: number;
    totalPackagings: number;
    hasBaseUnit: boolean;
    rootCount: number;
  };
  validation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  onEdit?: (packaging: PackagingType) => void;
  onDelete?: (packaging: PackagingType) => void;
  className?: string;
}

export function PackagingHierarchyTree({ 
  hierarchy, 
  metadata, 
  validation,
  onEdit, 
  onDelete, 
  className 
}: PackagingHierarchyTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  const toggleNode = (nodeId: number) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderDimensions = (dimensions: any) => {
    if (!dimensions) return null;
    
    const { length = 0, width = 0, height = 0, weight = 0 } = dimensions;
    
    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Ruler className="h-3 w-3" />
          <span>{length}×{width}×{height}cm</span>
        </div>
        {weight > 0 && (
          <div className="flex items-center gap-1">
            <Weight className="h-3 w-3" />
            <span>{weight}kg</span>
          </div>
        )}
      </div>
    );
  };

  const getValidationIcon = (packaging: PackagingType) => {
    if (!validation || !validation.errors || !validation.warnings) return null;
    
    const hasError = validation.errors.some(error => error.includes(packaging.name));
    const hasWarning = validation.warnings.some(warning => warning.includes(packaging.name));
    
    if (hasError) {
      return <AlertCircle className="h-4 w-4 text-destructive" title="Erro na hierarquia" />;
    }
    if (hasWarning) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" title="Aviso na hierarquia" />;
    }
    
    return <CheckCircle className="h-4 w-4 text-green-500" title="Válido" />;
  };

  const renderNode = (node: HierarchyNode, isLast = false) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const nodeLevel = node.level || 1;

    return (
      <div key={node.id} className="relative">
        {/* Linha de conexão vertical */}
        {node.depth > 0 && (
          <div 
            className="absolute left-4 top-0 w-0.5 bg-border"
            style={{ 
              height: isLast ? '1.5rem' : '100%',
              marginLeft: `${(node.depth - 1) * 1.5}rem`
            }}
          />
        )}
        
        {/* Linha de conexão horizontal */}
        {node.depth > 0 && (
          <div 
            className="absolute top-6 w-6 h-0.5 bg-border"
            style={{ 
              left: `${node.depth * 1.5 + 0.875}rem`
            }}
          />
        )}

        <div 
          className="flex items-start gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors"
          style={{ marginLeft: `${node.depth * 1.5}rem` }}
        >
          {/* Indicador de expansão */}
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => toggleNode(node.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <div className="h-6 w-6 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-border" />
            </div>
          )}

          {/* Conteúdo do nó */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-medium truncate">{node.name}</span>
              
              {/* Badges de status */}
              <Badge variant="outline" className="text-xs">
                Nível {nodeLevel}
              </Badge>
              
              <Badge variant="secondary" className="text-xs">
                {node.baseUnitQuantity} un. base
              </Badge>
              
              {node.isBaseUnit && (
                <Badge variant="default" className="text-xs">
                  Base
                </Badge>
              )}

              {/* Ícone de validação */}
              {getValidationIcon(node)}
            </div>

            {/* Código de barras */}
            {node.barcode && (
              <div className="flex items-center gap-1 mb-2">
                <Barcode className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono">
                  {node.barcode}
                </span>
              </div>
            )}

            {/* Dimensões */}
            {renderDimensions(node.dimensions)}

            {/* Metadados adicionais */}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>Profundidade: {node.depth}</span>
              {node.effectiveVolume && (
                <span>Volume: {node.effectiveVolume.toFixed(2)}cm³</span>
              )}
              {hasChildren && (
                <span>{node.children.length} filho(s)</span>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2 mt-3">
              {onEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(node)}
                  className="h-7 px-2 text-xs"
                >
                  Editar
                </Button>
              )}
              {onDelete && !node.isBaseUnit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(node)}
                  className="h-7 px-2 text-xs"
                >
                  Remover
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Nós filhos */}
        {hasChildren && isExpanded && (
          <div className="mt-2">
            {node.children.map((child, index) => 
              renderNode(child, index === node.children.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  if (!hierarchy || hierarchy.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Nenhuma embalagem encontrada</h3>
          <p className="text-muted-foreground">
            Crie embalagens para visualizar a hierarquia
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Metadados da hierarquia */}
      {metadata && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-primary" />
              <span className="font-medium">Resumo da Hierarquia</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium">{metadata.totalPackagings}</div>
                <div className="text-muted-foreground">Total de Embalagens</div>
              </div>
              <div>
                <div className="font-medium">{metadata.totalLevels}</div>
                <div className="text-muted-foreground">Níveis</div>
              </div>
              <div>
                <div className="font-medium">{metadata.rootCount}</div>
                <div className="text-muted-foreground">Embalagens Raiz</div>
              </div>
              <div>
                <div className={cn(
                  "font-medium",
                  metadata.hasBaseUnit ? "text-green-600" : "text-red-600"
                )}>
                  {metadata.hasBaseUnit ? "Sim" : "Não"}
                </div>
                <div className="text-muted-foreground">Tem Unidade Base</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validação da hierarquia */}
      {validation && !validation.isValid && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="font-medium text-destructive">Problemas na Hierarquia</span>
            </div>
            {validation.errors && validation.errors.length > 0 && (
              <div className="mb-3">
                <div className="text-sm font-medium mb-2">Erros:</div>
                <ul className="text-sm text-destructive space-y-1">
                  {(validation.errors || []).map((error, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="block w-1 h-1 rounded-full bg-destructive mt-2 flex-shrink-0" />
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {validation.warnings && validation.warnings.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Avisos:</div>
                <ul className="text-sm text-yellow-600 space-y-1">
                  {(validation.warnings || []).map((warning, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="block w-1 h-1 rounded-full bg-yellow-600 mt-2 flex-shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Árvore hierárquica */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            {hierarchy.map((node, index) => 
              renderNode(node, index === hierarchy.length - 1)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}