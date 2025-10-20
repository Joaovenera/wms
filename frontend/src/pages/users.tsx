import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";


import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { Search, Users as UsersIcon, Plus, Edit, Trash2, Shield } from "lucide-react";
import { insertUserSchema } from "@/types/schemas";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Local fallback user type since '@/types/api' does not export User
type UserType = {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type UserFormData = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  password: string;
  confirmPassword: string;
};

const userFormSchema = insertUserSchema.extend({
  confirmPassword: insertUserSchema.shape.password,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

const editUserFormSchema = z.object({
  email: z.string().email("Email inválido"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.string().default("operator"),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.password || data.confirmPassword) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

export default function Users() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<UserType[]>({
    queryKey: ['/api/users'],
  });

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const { confirmPassword, ...userData } = data;
      const res = await apiRequest("POST", "/api/users", userData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsAddDialogOpen(false);
      toast({
        title: "Sucesso",
        description: "Usuário criado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<UserFormData> }) => {
      const { confirmPassword, ...userData } = data;
      const res = await apiRequest("PUT", `/api/users/${id}`, userData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setEditingUser(null);
      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Role change mutation can be added when UI is implemented

  const filteredUsers = users?.filter(user =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getInitials = (user: UserType) => {
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';
  };

  // const formatDate = (dateString: string | Date | null) => {
  //   if (!dateString) return 'N/A';
  //   return new Date(dateString).toLocaleDateString('pt-BR');
  // };

  const getRoleBadge = (role: string) => {
    const isAdmin = role === 'admin';
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${isAdmin ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'}`}>
        <Shield className={`h-3 w-3 ${isAdmin ? 'text-red-500' : 'text-cyan-500'}`} />
        <span>{isAdmin ? 'Administrador' : 'Operador'}</span>
      </div>
    );
  };

  // Form handlers
  const UserForm = ({ user, onClose }: { user?: UserType; onClose: () => void }) => {
    const form = useForm<UserFormData>({
      resolver: zodResolver(user ? editUserFormSchema : userFormSchema),
      defaultValues: {
        email: user?.email || "",
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        role: user?.role || "operator",
        password: "",
        confirmPassword: "",
      },
    });

    const onSubmit = (data: UserFormData) => {
      if (user) {
        // Remove password fields if they're empty for updates
        const { confirmPassword, ...updateData } = data;
        if (!data.password) {
          const { password, ...finalUpdateData } = updateData;
          updateUserMutation.mutate({ id: user.id, data: finalUpdateData });
        } else {
          updateUserMutation.mutate({ id: user.id, data: updateData });
        }
      } else {
        createUserMutation.mutate(data);
      }
    };

    const renderInput = (name: keyof UserFormData, label: string, placeholder: string, type: string = "text") => (
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem className="relative">
            <FormLabel className="absolute -top-2 left-3 bg-background px-1 text-xs text-cyan-400">{label}</FormLabel>
            <FormControl>
              <Input 
                type={type} 
                placeholder={placeholder} 
                {...field} 
                value={field.value || ""}
                className="bg-background border-border rounded-lg focus:ring-2 focus:ring-cyan-500 transition-all w-full pt-5"
              />
            </FormControl>
            <FormMessage className="text-destructive text-xs pt-1" />
          </FormItem>
        )}
      />
    );

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
          {renderInput("email", "Email", "usuario@email.com")}
          
          <div className="grid grid-cols-2 gap-4">
            {renderInput("firstName", "Nome", "João")}
            {renderInput("lastName", "Sobrenome", "Silva")}
          </div>

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel className="absolute -top-2 left-3 bg-background px-1 text-xs text-cyan-400">Função</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-background border-border rounded-lg focus:ring-2 focus:ring-cyan-500 w-full pt-5">
                      <SelectValue placeholder="Selecione uma função" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="operator" className="hover:bg-muted">Operador</SelectItem>
                    <SelectItem value="admin" className="hover:bg-muted">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-destructive text-xs pt-1" />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            {renderInput("password", user ? "Nova Senha (opcional)" : "Senha", "••••••••", "password")}
            {renderInput("confirmPassword", user ? "Confirmar Nova Senha" : "Confirmar Senha", "••••••••", "password")}
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="bg-transparent border-border hover:bg-muted text-foreground rounded-full">
              Cancelar
            </Button>
            <Button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending} className="bg-cyan-500 hover:bg-cyan-600 text-foreground rounded-full shadow-lg shadow-cyan-500/20 transition-all duration-300">
              {createUserMutation.isPending || updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </Form>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 space-y-8 font-sans">

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter text-shadow-lg">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground mt-1">
            Interface futurista para administrar usuários do sistema MWS.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-card border border-border rounded-full px-4 py-2 text-sm">
            <UsersIcon className="h-5 w-5 text-cyan-400" />
            <span className="font-medium">
              {users?.length || 0} usuários ativos
            </span>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-cyan-500 hover:bg-cyan-600 text-foreground rounded-full shadow-lg shadow-cyan-500/20 transition-all duration-300">
                <Plus className="h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground backdrop-blur-sm sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-cyan-400">Adicionar Novo Usuário</DialogTitle>
              </DialogHeader>
              <UserForm onClose={() => setIsAddDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Search & Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-cyan-400" />
          <Input
            placeholder="Buscar por nome, email ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 bg-background border-border rounded-full focus:ring-2 focus:ring-cyan-500 transition-all"
          />
        </div>
        {/* TODO: Add role filter dropdown */}
      </div>

      {/* Users Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 space-y-4 animate-pulse">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-14 w-14 rounded-full bg-muted" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[150px] bg-muted" />
                  <Skeleton className="h-3 w-[100px] bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full bg-muted" />
                <Skeleton className="h-3 w-[80%] bg-muted" />
              </div>
              <div className="h-2 w-full bg-muted rounded-full mt-4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="group relative bg-card border border-border rounded-2xl overflow-hidden transition-all duration-300 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/10"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <Avatar className="h-14 w-14 border-2 border-border group-hover:border-cyan-400 transition-colors">
                    <AvatarFallback className="bg-muted text-muted-foreground group-hover:bg-cyan-900 group-hover:text-cyan-300 transition-colors">
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="truncate">
                    <h3 className="font-bold text-lg truncate text-shadow">
                      {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                    </h3>
                    <p className="text-xs text-muted-foreground">ID: {user.id}</p>
                  </div>
                </div>

                <div className="mb-4">{getRoleBadge(user.role)}</div>

                {/* Gamification Element */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Nível de Acesso</span>
                    <span>{user.role === 'admin' ? 'Nível 5' : 'Nível 2'}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${user.role === 'admin' ? 'bg-red-500' : 'bg-cyan-500'}`}
                      style={{ width: user.role === 'admin' ? '100%' : '40%' }}
                    ></div>
                  </div>
                </div>

                {/* Actions Overlay */}
                <div className="absolute inset-0 bg-muted/70 backdrop-blur-sm flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setEditingUser(user)}
                    className="bg-transparent border-cyan-500 text-cyan-500 hover:bg-cyan-500 hover:text-white"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" className="bg-transparent border-red-500 text-red-500 hover:bg-red-500 hover:text-white">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-border text-foreground backdrop-blur-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-500">Excluir Usuário</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                          Tem certeza que deseja excluir permanentemente o usuário {user.firstName} {user.lastName}? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-muted hover:bg-muted/80">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteUserMutation.mutate(user.id)}
                          className="bg-red-600 text-white hover:bg-red-700"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="bg-card border-border text-foreground backdrop-blur-sm sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">Editar Usuário</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <UserForm user={editingUser} onClose={() => setEditingUser(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}