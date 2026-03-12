import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Users, 
  Plus, 
  Search,
  Loader2,
  RefreshCw,
  UserCheck,
  UserX,
  Shield,
  ShieldOff
} from 'lucide-react';
import { UserWithRoles, AppRole } from '@/types/admin';
import { toast } from 'sonner';

interface AdminUsersSimpleProps {
  users: UserWithRoles[];
  onCreateUser: (email: string, password: string, fullName?: string) => Promise<boolean>;
  onToggleActive: (userId: string, isActive: boolean) => Promise<boolean>;
  onUpdateRole: (userId: string, role: AppRole, add: boolean) => Promise<boolean>;
  onRefresh: () => Promise<void>;
}

export function AdminUsersSimple({
  users,
  onCreateUser,
  onToggleActive,
  onUpdateRole,
  onRefresh,
}: AdminUsersSimpleProps) {
  const [search, setSearch] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    (user.full_name && user.full_name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword) {
      toast.error('Email e senha são obrigatórios');
      return;
    }

    setIsCreating(true);
    const success = await onCreateUser(newEmail, newPassword, newName || undefined);
    if (success) {
      setIsCreateDialogOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
    }
    setIsCreating(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    await onToggleActive(userId, !currentActive);
  };

  const handleToggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    await onUpdateRole(userId, 'admin', !isCurrentlyAdmin);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Usuários
            </CardTitle>
            <CardDescription>
              Gerencie os usuários da plataforma
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário</DialogTitle>
                  <DialogDescription>
                    Crie uma nova conta de usuário
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="usuario@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="********"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome (opcional)</Label>
                    <Input
                      id="name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nome Completo"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateUser} disabled={isCreating}>
                    {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Criar Usuário
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por email ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Funções</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[150px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {search ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const isAdmin = user.roles?.includes('admin');
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || 'Sem nome'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.roles?.map((role) => (
                            <Badge key={role} variant={role === 'admin' ? 'default' : 'secondary'}>
                              {role}
                            </Badge>
                          ))}
                          {(!user.roles || user.roles.length === 0) && (
                            <Badge variant="outline">user</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'destructive'}>
                          {user.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(user.user_id, user.is_active)}
                            title={user.is_active ? 'Desativar usuário' : 'Ativar usuário'}
                          >
                            {user.is_active ? (
                              <UserX className="w-4 h-4 text-destructive" />
                            ) : (
                              <UserCheck className="w-4 h-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleAdmin(user.user_id, isAdmin)}
                            title={isAdmin ? 'Remover admin' : 'Tornar admin'}
                          >
                            {isAdmin ? (
                              <ShieldOff className="w-4 h-4 text-orange-600" />
                            ) : (
                              <Shield className="w-4 h-4 text-blue-600" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Total: {filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''}
        </p>
      </CardContent>
    </Card>
  );
}
