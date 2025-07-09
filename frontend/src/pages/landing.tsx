import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Warehouse, QrCode, Smartphone, BarChart3 } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Warehouse className="h-16 w-16 text-primary mr-4" />
            <h1 className="text-5xl font-bold text-gray-900">MWS</h1>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Sistema de Controle de Estoque
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Solução completa para gestão de warehouse com operações mobile-first 
            e administração web avançada
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <Card className="text-center card-hover">
            <CardHeader>
              <Smartphone className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Mobile-First</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Interface otimizada para operações em campo com smartphones e tablets
              </p>
            </CardContent>
          </Card>

          <Card className="text-center card-hover">
            <CardHeader>
              <QrCode className="h-12 w-12 text-secondary mx-auto mb-4" />
              <CardTitle>QR Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Rastreamento preciso com códigos QR para pallets, UCPs e posições
              </p>
            </CardContent>
          </Card>

          <Card className="text-center card-hover">
            <CardHeader>
              <Warehouse className="h-12 w-12 text-success mx-auto mb-4" />
              <CardTitle>Gestão Completa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Controle total de pallets, posições, UCPs e movimentações
              </p>
            </CardContent>
          </Card>

          <Card className="text-center card-hover">
            <CardHeader>
              <BarChart3 className="h-12 w-12 text-warning mx-auto mb-4" />
              <CardTitle>Relatórios</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Dashboards e relatórios em tempo real para tomada de decisão
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="pt-6">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  Pronto para começar?
                </h3>
                <p className="text-gray-600">
                  Faça login para acessar o sistema de controle de estoque
                </p>
              </div>
              <Button 
                size="lg" 
                className="w-full touch-button"
                onClick={() => window.location.href = '/api/login'}
              >
                Fazer Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
