import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, 
  LogOut, 
  Users, 
  Gamepad2, 
  Settings,
  AlertTriangle,
  CheckCircle,
  Plus,
  RefreshCw,
  Wrench,
  Activity,
  Server,
  Edit,
  Save,
  X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface GameStatus {
  name: string;
  type: 'uno' | 'xo';
  status: 'up' | 'down' | 'maintenance';
  activeRooms: number;
  activePlayers: number;
}

interface SystemHealth {
  serverUptime: string;
  databaseStatus: 'connected' | 'disconnected';
  websocketStatus: 'active' | 'inactive';
  memoryUsage: string;
}

interface GuruUser {
  id: string;
  playerName: string;
  username: string;
  email: string;
  gameType: 'uno' | 'xo';
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("games");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      setLocation("/man");
    }
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setLocation("/man");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Admin Dashboard
            </h1>
          </div>
          <Button onClick={handleLogout} variant="outline" className="flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="games" className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" />
              Games
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="games" className="space-y-6">
            <GameManagement />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <SystemManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Games Management Component
function GameManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch game statuses
  const { data: gameStatuses, isLoading } = useQuery<GameStatus[]>({
    queryKey: ['/api/admin/game-status'],
    queryFn: async () => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch('/api/admin/game-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch game status');
      return response.json();
    },
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Restart specific game mutation
  const restartGameMutation = useMutation({
    mutationFn: async (gameType: string) => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`/api/admin/restart-game/${gameType}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to restart game');
      return response.json();
    },
    onSuccess: (_, gameType) => {
      toast({
        title: "Success",
        description: `${gameType.toUpperCase()} game restarted successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/game-status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restart game",
        variant: "destructive",
      });
    },
  });

  // Toggle maintenance mode mutation
  const toggleMaintenanceMutation = useMutation({
    mutationFn: async ({ gameType, status }: { gameType: string; status: 'up' | 'maintenance' }) => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`/api/admin/game-maintenance/${gameType}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update maintenance mode');
      return response.json();
    },
    onSuccess: (_, { gameType, status }) => {
      toast({
        title: "Success",
        description: `${gameType.toUpperCase()} ${status === 'maintenance' ? 'maintenance mode enabled' : 'maintenance mode disabled'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/game-status'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update maintenance mode",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading game status...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Game Management</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {gameStatuses?.map((game) => (
          <Card key={game.type} className="relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Gamepad2 className="h-5 w-5" />
                {game.name}
              </CardTitle>
              <Badge 
                variant={
                  game.status === 'up' ? 'default' : 
                  game.status === 'maintenance' ? 'secondary' : 'destructive'
                }
                className="flex items-center gap-1"
              >
                {game.status === 'up' && <CheckCircle className="h-3 w-3" />}
                {game.status === 'maintenance' && <Wrench className="h-3 w-3" />}
                {game.status === 'down' && <AlertTriangle className="h-3 w-3" />}
                {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Rooms</p>
                  <p className="text-2xl font-bold">{game.activeRooms}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Players</p>
                  <p className="text-2xl font-bold">{game.activePlayers}</p>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => restartGameMutation.mutate(game.type)}
                  disabled={restartGameMutation.isPending}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  Restart
                </Button>
                <Button
                  onClick={() => toggleMaintenanceMutation.mutate({
                    gameType: game.type,
                    status: game.status === 'maintenance' ? 'up' : 'maintenance'
                  })}
                  disabled={toggleMaintenanceMutation.isPending}
                  variant={game.status === 'maintenance' ? 'default' : 'secondary'}
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <Wrench className="h-4 w-4" />
                  {game.status === 'maintenance' ? 'Exit Maintenance' : 'Maintenance Mode'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// User Management Component  
function UserManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    playerName: '',
    username: '',
    email: '',
    password: '',
    gameType: 'uno' as 'uno' | 'xo'
  });
  const [editUser, setEditUser] = useState({
    id: '',
    playerName: '',
    username: '',
    email: '',
    gameType: 'uno' as 'uno' | 'xo'
  });

  // Fetch guru users
  const { data: guruUsers, isLoading } = useQuery<GuruUser[]>({
    queryKey: ['/api/admin/guru-users'],
    queryFn: async () => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch('/api/admin/guru-users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch guru users');
      return response.json();
    }
  });

  // Create guru user mutation
  const createGuruUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch('/api/admin/guru-users', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create guru user');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Guru user created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/guru-users'] });
      setShowCreateForm(false);
      setNewUser({ playerName: '', username: '', email: '', password: '', gameType: 'uno' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update guru user mutation
  const updateGuruUserMutation = useMutation({
    mutationFn: async (userData: typeof editUser) => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`/api/admin/guru-users/${userData.id}`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerName: userData.playerName,
          username: userData.username,
          email: userData.email,
          gameType: userData.gameType
        })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update guru user');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Guru user updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/guru-users'] });
      setEditingUser(null);
      setEditUser({ id: '', playerName: '', username: '', email: '', gameType: 'uno' });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle guru user status mutation
  const toggleGuruUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`/api/admin/guru-users/${userId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to toggle guru user status');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Guru user status updated",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/guru-users'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update guru user",
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = () => {
    if (!newUser.playerName || !newUser.username || !newUser.email || !newUser.password) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }
    createGuruUserMutation.mutate(newUser);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading guru users...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Guru User Management</h2>
        <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Guru User
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Guru User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="playerName">Player Name (Visible)</Label>
                <Input
                  id="playerName"
                  value={newUser.playerName}
                  onChange={(e) => setNewUser({ ...newUser, playerName: e.target.value })}
                  placeholder="Enter player display name"
                />
              </div>
              <div>
                <Label htmlFor="username">Username (Hidden)</Label>
                <Input
                  id="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="Enter login username"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Enter password"
                />
              </div>
              <div>
                <Label htmlFor="gameType">Game Type</Label>
                <Select value={newUser.gameType} onValueChange={(value: 'uno' | 'xo') => setNewUser({ ...newUser, gameType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uno">UNO</SelectItem>
                    <SelectItem value="xo">XO (Tic Tac Toe)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleCreateUser} disabled={createGuruUserMutation.isPending}>
                {createGuruUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
              <Button onClick={() => setShowCreateForm(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {guruUsers?.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-6">
              {editingUser === user.id ? (
                // Edit mode
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`edit-playerName-${user.id}`}>Player Name (Visible)</Label>
                      <Input
                        id={`edit-playerName-${user.id}`}
                        value={editUser.playerName}
                        onChange={(e) => setEditUser({ ...editUser, playerName: e.target.value })}
                        placeholder="Enter player display name"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-username-${user.id}`}>Username (Hidden)</Label>
                      <Input
                        id={`edit-username-${user.id}`}
                        value={editUser.username}
                        onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
                        placeholder="Enter login username"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-email-${user.id}`}>Email</Label>
                      <Input
                        id={`edit-email-${user.id}`}
                        type="email"
                        value={editUser.email}
                        onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                        placeholder="Enter email address"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-gameType-${user.id}`}>Game Type</Label>
                      <Select value={editUser.gameType} onValueChange={(value: 'uno' | 'xo') => setEditUser({ ...editUser, gameType: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="uno">UNO</SelectItem>
                          <SelectItem value="xo">XO (Tic Tac Toe)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => updateGuruUserMutation.mutate(editUser)}
                      disabled={updateGuruUserMutation.isPending}
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Save className="h-4 w-4" />
                      {updateGuruUserMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingUser(null);
                        setEditUser({ id: '', playerName: '', username: '', email: '', gameType: 'uno' });
                      }}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{user.playerName}</h3>
                      <Badge variant="outline">{user.gameType.toUpperCase()}</Badge>
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {user.email} • Username: {user.username}
                    </p>
                    <p className="text-xs text-gray-500">
                      Last login: {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setEditingUser(user.id);
                        setEditUser({
                          id: user.id,
                          playerName: user.playerName,
                          username: user.username,
                          email: user.email,
                          gameType: user.gameType
                        });
                      }}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => toggleGuruUserMutation.mutate(user.id)}
                      disabled={toggleGuruUserMutation.isPending}
                      variant={user.isActive ? "destructive" : "default"}
                      size="sm"
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// System Management Component
function SystemManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch system health
  const { data: systemHealth, isLoading } = useQuery<SystemHealth>({
    queryKey: ['/api/admin/system-health'],
    queryFn: async () => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch('/api/admin/system-health', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch system health');
      return response.json();
    },
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // System restart mutation
  const systemRestartMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch('/api/admin/system-restart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to restart system');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "System restart initiated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restart system",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading system health...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Management</h2>
        <Button
          onClick={() => systemRestartMutation.mutate()}
          disabled={systemRestartMutation.isPending}
          variant="destructive"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          System Restart
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Server Uptime</p>
              <p className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {systemHealth?.serverUptime || 'N/A'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Database</p>
              <p className="text-lg font-semibold flex items-center gap-2">
                {systemHealth?.databaseStatus === 'connected' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
                {systemHealth?.databaseStatus || 'Unknown'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">WebSocket</p>
              <p className="text-lg font-semibold flex items-center gap-2">
                {systemHealth?.websocketStatus === 'active' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
                {systemHealth?.websocketStatus || 'Unknown'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Memory Usage</p>
              <p className="text-lg font-semibold flex items-center gap-2">
                <Server className="h-4 w-4 text-blue-500" />
                {systemHealth?.memoryUsage || 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}