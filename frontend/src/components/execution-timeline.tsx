import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Play,
  Target,
  Flag,
  Zap,
  Calendar,
  TrendingUp,
  Activity,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingItem {
  id: number;
  productName: string;
  productSku: string;
  requestedQuantity: string;
  loadedQuantity: string;
  scannedAt?: string;
  confirmedAt?: string;
  divergenceReason?: string;
}

interface ExecutionData {
  id: number;
  transferRequestCode: string;
  operatorName: string;
  startedAt: string;
  finishedAt?: string;
  status: string;
  items: LoadingItem[];
}

interface TimelineEvent {
  id: string;
  type: 'milestone' | 'item' | 'divergence' | 'note';
  timestamp: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  data?: any;
}

interface ExecutionTimelineProps {
  execution: ExecutionData;
  className?: string;
}

export function ExecutionTimeline({ execution, className }: ExecutionTimelineProps) {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);

  const events = generateTimelineEvents(execution);
  const milestones = calculateMilestones(execution);
  const visibleEvents = showAllEvents ? events : events.slice(0, 10);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Milestone Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Marcos do Processo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={milestones.overallProgress} className="h-3" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {milestones.stages.map((stage, index) => (
                <MilestoneCard
                  key={stage.name}
                  stage={stage}
                  isActive={index === milestones.currentStageIndex}
                  isCompleted={stage.completed}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Linha do Tempo
              <Badge variant="secondary">{events.length} eventos</Badge>
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Badge 
                variant={execution.status === 'em_andamento' ? 'default' : 'secondary'}
                className="flex items-center gap-1"
              >
                <Zap className="h-3 w-3" />
                {execution.status === 'em_andamento' ? 'Ao Vivo' : 'Finalizado'}
              </Badge>
              
              {!showAllEvents && events.length > 10 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllEvents(true)}
                >
                  Ver Todos ({events.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
            
            {/* Events */}
            <div className="space-y-6">
              {visibleEvents.map((event, index) => (
                <TimelineEventCard
                  key={event.id}
                  event={event}
                  isFirst={index === 0}
                  isLast={index === visibleEvents.length - 1}
                  isSelected={selectedEvent?.id === event.id}
                  onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                />
              ))}
            </div>
            
            {/* Show More Button */}
            {showAllEvents && events.length > 10 && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllEvents(false)}
                >
                  Mostrar Menos
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Event Details */}
      {selectedEvent && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <selectedEvent.icon className="h-5 w-5" />
              Detalhes do Evento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="text-lg font-semibold">{selectedEvent.title}</div>
                <div className="text-sm text-gray-600">
                  {new Date(selectedEvent.timestamp).toLocaleString('pt-BR')}
                </div>
              </div>
              
              <div className="text-gray-700">
                {selectedEvent.description}
              </div>
              
              {selectedEvent.data && (
                <div className="bg-white rounded p-3 border">
                  <pre className="text-sm text-gray-600">
                    {JSON.stringify(selectedEvent.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface MilestoneCardProps {
  stage: {
    name: string;
    progress: number;
    completed: boolean;
    estimatedTime?: string;
  };
  isActive: boolean;
  isCompleted: boolean;
}

function MilestoneCard({ stage, isActive, isCompleted }: MilestoneCardProps) {
  return (
    <div className={cn(
      "p-3 rounded-lg border-2 transition-colors",
      isCompleted 
        ? "bg-green-50 border-green-200" 
        : isActive 
          ? "bg-blue-50 border-blue-200" 
          : "bg-gray-50 border-gray-200"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{stage.name}</div>
        {isCompleted ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : isActive ? (
          <Activity className="h-4 w-4 text-blue-600" />
        ) : (
          <Clock className="h-4 w-4 text-gray-400" />
        )}
      </div>
      
      <Progress value={stage.progress} className="h-2 mb-2" />
      
      <div className="text-xs text-gray-600">
        {stage.progress.toFixed(0)}% completo
      </div>
      
      {stage.estimatedTime && !isCompleted && (
        <div className="text-xs text-gray-500 mt-1">
          Est: {stage.estimatedTime}
        </div>
      )}
    </div>
  );
}

interface TimelineEventCardProps {
  event: TimelineEvent;
  isFirst: boolean;
  isLast: boolean;
  isSelected: boolean;
  onClick: () => void;
}

function TimelineEventCard({ event, isFirst, isLast, isSelected, onClick }: TimelineEventCardProps) {
  const colorClasses = {
    blue: { bg: 'bg-blue-500', text: 'text-blue-700', bgLight: 'bg-blue-50' },
    green: { bg: 'bg-green-500', text: 'text-green-700', bgLight: 'bg-green-50' },
    red: { bg: 'bg-red-500', text: 'text-red-700', bgLight: 'bg-red-50' },
    yellow: { bg: 'bg-yellow-500', text: 'text-yellow-700', bgLight: 'bg-yellow-50' },
    purple: { bg: 'bg-purple-500', text: 'text-purple-700', bgLight: 'bg-purple-50' }
  };

  const colors = colorClasses[event.color];
  const EventIcon = event.icon;

  return (
    <div 
      className={cn(
        "relative flex items-start gap-4 cursor-pointer transition-all duration-200",
        isSelected && "scale-[1.02]"
      )}
      onClick={onClick}
    >
      {/* Timeline Dot */}
      <div className={cn(
        "relative z-10 flex items-center justify-center w-8 h-8 rounded-full",
        colors.bg,
        isFirst && "ring-4 ring-blue-100",
        isSelected && "ring-4 ring-blue-200"
      )}>
        <EventIcon className="h-4 w-4 text-white" />
      </div>

      {/* Event Content */}
      <div className={cn(
        "flex-1 p-4 rounded-lg border transition-colors",
        isSelected ? `${colors.bgLight} border-current` : "bg-white hover:bg-gray-50"
      )}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium">{event.title}</h4>
              <Badge 
                variant="secondary" 
                className={cn("text-xs", colors.text)}
              >
                {event.type}
              </Badge>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">{event.description}</p>
            
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              {new Date(event.timestamp).toLocaleString('pt-BR')}
            </div>
          </div>
          
          {isSelected && (
            <div className="ml-4">
              <TrendingUp className="h-4 w-4 text-gray-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function generateTimelineEvents(execution: ExecutionData): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Start event
  events.push({
    id: 'start',
    type: 'milestone',
    timestamp: execution.startedAt,
    title: 'Execução Iniciada',
    description: `Carregamento iniciado pelo operador ${execution.operatorName}`,
    icon: Play,
    color: 'blue'
  });

  // Item events
  execution.items.forEach((item, index) => {
    if (item.scannedAt) {
      events.push({
        id: `scan-${item.id}`,
        type: 'item',
        timestamp: item.scannedAt,
        title: `Item Escaneado`,
        description: `${item.productName} (${item.productSku})`,
        icon: MapPin,
        color: 'blue',
        data: {
          productName: item.productName,
          productSku: item.productSku,
          requestedQuantity: item.requestedQuantity
        }
      });
    }

    if (item.confirmedAt) {
      const loaded = parseFloat(item.loadedQuantity);
      const requested = parseFloat(item.requestedQuantity);
      const isComplete = loaded === requested;
      
      events.push({
        id: `confirm-${item.id}`,
        type: 'item',
        timestamp: item.confirmedAt,
        title: isComplete ? 'Item Carregado Completamente' : 'Item Carregado Parcialmente',
        description: `${item.productName}: ${item.loadedQuantity}/${item.requestedQuantity}`,
        icon: isComplete ? CheckCircle : AlertTriangle,
        color: isComplete ? 'green' : 'yellow',
        data: {
          productName: item.productName,
          productSku: item.productSku,
          loadedQuantity: item.loadedQuantity,
          requestedQuantity: item.requestedQuantity
        }
      });
    }

    if (item.divergenceReason) {
      events.push({
        id: `divergence-${item.id}`,
        type: 'divergence',
        timestamp: item.confirmedAt || item.scannedAt || execution.startedAt,
        title: 'Divergência Registrada',
        description: `${item.productName}: ${getDivergenceReasonLabel(item.divergenceReason)}`,
        icon: AlertTriangle,
        color: 'red',
        data: {
          productName: item.productName,
          productSku: item.productSku,
          divergenceReason: item.divergenceReason
        }
      });
    }
  });

  // Milestone events (25%, 50%, 75% completion)
  const stats = calculateExecutionStats(execution);
  const milestonePercentages = [25, 50, 75];
  
  milestonePercentages.forEach(percentage => {
    if (stats.percentage >= percentage) {
      // Estimate timestamp based on progress
      const startTime = new Date(execution.startedAt).getTime();
      const now = new Date().getTime();
      const elapsedTime = now - startTime;
      const estimatedMilestoneTime = startTime + (elapsedTime * (percentage / stats.percentage));
      
      events.push({
        id: `milestone-${percentage}`,
        type: 'milestone',
        timestamp: new Date(estimatedMilestoneTime).toISOString(),
        title: `${percentage}% Concluído`,
        description: `Marco de ${percentage}% do carregamento atingido`,
        icon: Target,
        color: 'purple'
      });
    }
  });

  // Finish event
  if (execution.finishedAt) {
    events.push({
      id: 'finish',
      type: 'milestone',
      timestamp: execution.finishedAt,
      title: 'Execução Finalizada',
      description: `Carregamento concluído com ${stats.completed}/${stats.total} itens processados`,
      icon: Flag,
      color: 'green'
    });
  }

  // Sort events by timestamp
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function calculateMilestones(execution: ExecutionData) {
  const stats = calculateExecutionStats(execution);
  
  const stages = [
    {
      name: 'Início',
      progress: 100, // Always completed if we're viewing this
      completed: true
    },
    {
      name: '25%',
      progress: Math.min((stats.percentage / 25) * 100, 100),
      completed: stats.percentage >= 25
    },
    {
      name: '50%',
      progress: Math.min((stats.percentage / 50) * 100, 100),
      completed: stats.percentage >= 50
    },
    {
      name: '75%',
      progress: Math.min((stats.percentage / 75) * 100, 100),
      completed: stats.percentage >= 75
    },
    {
      name: 'Finalização',
      progress: stats.percentage >= 100 ? 100 : 0,
      completed: execution.status === 'finalizado'
    }
  ];

  const currentStageIndex = stages.findIndex(stage => !stage.completed);
  const overallProgress = stats.percentage;

  return {
    stages,
    currentStageIndex: currentStageIndex === -1 ? stages.length - 1 : currentStageIndex,
    overallProgress
  };
}

function calculateExecutionStats(execution: ExecutionData) {
  const total = execution.items.length;
  const completed = execution.items.filter(item => item.confirmedAt).length;
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return {
    total,
    completed,
    percentage
  };
}

function getDivergenceReasonLabel(reason?: string): string {
  const reasons = {
    'falta_espaco': 'Falta de espaço no caminhão',
    'item_avariado': 'Item avariado',
    'divergencia_estoque': 'Divergência de estoque',
    'item_nao_localizado': 'Item não localizado'
  };
  return reasons[reason as keyof typeof reasons] || reason || 'Não especificado';
}