import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, User, Mail, Lock, LogOut } from "lucide-react";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";

// Define Zod schemas for validation
const profileSchema = z.object({
  firstName: z.string().min(2, "Primeiro nome deve ter pelo menos 2 caracteres").optional(),
  lastName: z.string().min(2, "Sobrenome deve ter pelo menos 2 caracteres").optional(),
  email: z.string().email("Email inválido").optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, "Senha atual deve ter pelo menos 6 caracteres"),
  newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "As senhas não coincidem",
  path: ["confirmNewPassword"],
});

// Query client for react-query
const queryClient = new QueryClient();

interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  createdAt: string;
}

// Main Profile Component
function ProfileContent() {
  const { toast } = useToast();
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Fetch user data
  const { data: user, isLoading, error, refetch } = useQuery<UserProfile, Error>({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const response = await fetch('/api/users/me', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Falha ao buscar dados do usuário');
      }
      return response.json();
    },
  });

  // Profile update form
  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
    },
    values: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
    }, // Keep form in sync with query data
  });

  const updateProfileMutation = useMutation<UserProfile, Error, z.infer<typeof profileSchema>>({
    mutationFn: async (updatedData) => {
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Falha ao atualizar perfil');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Perfil atualizado com sucesso!" });
      refetch(); // Re-fetch user data to update UI
    },
    onError: (err) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Password change form
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const changePasswordMutation = useMutation<any, Error, z.infer<typeof passwordSchema>>({
    mutationFn: async (data) => {
      const response = await fetch('/api/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao alterar senha');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Senha alterada com sucesso!" });
      passwordForm.reset(); // Clear form
      setShowPasswordForm(false);
    },
    onError: (err) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      if (response.ok) {
        toast({ title: "Desconectado", description: "Você foi desconectado com sucesso." });
        // Redirect to login page or home
        window.location.href = '/login'; // Or use wouter's navigate if available globally
      } else {
        throw new Error('Falha ao desconectar');
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-gray-600">Carregando perfil...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-red-500">
        <p>Erro ao carregar perfil: {error.message}</p>
        <Button onClick={() => refetch()} className="mt-4">Tentar Novamente</Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        <p>Nenhum dado de usuário encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-md mx-auto">
      <h1 className="text-3xl font-bold text-center text-gray-900 mb-6">Meu Perfil</h1>

      {/* User Information Card */}
      <Card className="rounded-lg shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><User className="mr-2 h-6 w-6" /> Informações do Usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-700">
          <div>
            <Label className="text-sm font-semibold">Nome Completo</Label>
            <p className="text-lg font-medium mt-1">{user.firstName} {user.lastName}</p>
          </div>
          <div>
            <Label className="text-sm font-semibold">Email</Label>
            <p className="text-lg font-medium mt-1">{user.email}</p>
          </div>
          <div>
            <Label className="text-sm font-semibold">Cargo</Label>
            <p className="text-lg font-medium capitalize mt-1">{user.role}</p>
          </div>
          <div>
            <Label className="text-sm font-semibold">Membro Desde</Label>
            <p className="text-lg font-medium mt-1">{new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Form */}
      <Card className="rounded-lg shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><Mail className="mr-2 h-6 w-6" /> Editar Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(updateProfileMutation.mutate)} className="space-y-4">
              <FormField
                control={profileForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primeiro Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu primeiro nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sobrenome</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu sobrenome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="seu@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <User className="mr-2 h-4 w-4" />
                )}
                Salvar Alterações
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Change Password Section */}
      <Card className="rounded-lg shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center text-xl"><Lock className="mr-2 h-6 w-6" /> Alterar Senha</CardTitle>
        </CardHeader>
        <CardContent>
          {!showPasswordForm ? (
            <Button onClick={() => setShowPasswordForm(true)} className="w-full">
              Alterar Senha
            </Button>
          ) : (
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(changePasswordMutation.mutate)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha Atual</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Sua senha atual" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Sua nova senha" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmNewPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Nova Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirme sua nova senha" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowPasswordForm(false)} 
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={changePasswordMutation.isPending}>
                    {changePasswordMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}
                    Salvar Nova Senha
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      {/* Logout Button */}
      <Card className="rounded-lg shadow-md">
        <CardContent className="p-4">
          <Button onClick={handleLogout} className="w-full" variant="destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Wrapper component to provide QueryClientProvider
export default function MobileProfile() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileContent />
    </QueryClientProvider>
  );
}
