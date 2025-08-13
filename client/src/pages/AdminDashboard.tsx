import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  LogOut, 
  Users, 
  Gamepad2, 
  Activity, 
  Database,
  Server,
  AlertTriangle,
  CheckCircle,
  Plus,
  Crown
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AdminData {
  id: string;
  username: string;
  email: string;
  lastLogin: string;
  isInitialSetup: boolean;
}

interface SystemStats {
  activeRooms: number;
  activePlayers: number;
  totalGamesPlayed: number;
  serverUptime: string;
  databaseStatus: string;
}

interface GameData {
  roomCode: string;
  roomId: string;
  status: string;
  playerCount: number;
  gameType: string;
  createdAt: string;
}

interface GuruUser {
  id: string;
  playerName: string;
  email: string;
  gameType: 'uno' | 'xo';
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

// Game Management Component
function GameManagement() {
  const queryClient = useQueryClient();
  const [selectedGameType, setSelectedGameType] = React.useState<'uno' | 'xo'>('uno');

  // Fetch active games
  const { data: gamesData, isLoading: gamesLoading } = useQuery<{ games: GameData[] }>({
    queryKey: ['/api/admin/games'],
    queryFn: async () => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch('/api/admin/games', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch games');
      return response.json();
    }
  });

  // Fetch guru users for selected game
  const { data: guruUsersData, isLoading: guruUsersLoading } = useQuery<{ guruUsers: GuruUser[] }>({
    queryKey: ['/api/admin/guru-users', selectedGameType],
    queryFn: async () => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`/api/admin/guru-users/${selectedGameType}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch guru users');
      return response.json();
    }
  });

  // Restart game mutation
  const restartGameMutation = useMutation({
    mutationFn: async (roomCode: string) => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`/api/admin/games/${roomCode}/restart`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to restart game');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/games'] });
    }
  });

  const games = gamesData?.games || [];
  const guruUsers = guruUsersData?.guruUsers || [];

  return (
    <div className="space-y-6">
      {/* Active Games Section */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gamepad2 className="w-5 h-5" />
            Active Games ({games.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gamesLoading ? (
            <div className="text-center py-4">
              <div className="text-gray-300">Loading games...</div>
            </div>
          ) : games.length > 0 ? (
            <div className="grid gap-4">
              {games.map((game) => (
                <div key={game.roomCode} className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Room: {game.roomCode}</div>
                    <div className="text-gray-300 text-sm">
                      {game.gameType.toUpperCase()} • {game.playerCount} players • {game.status}
                    </div>
                    <div className="text-gray-400 text-xs">
                      Created: {new Date(game.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    onClick={() => restartGameMutation.mutate(game.roomCode)}
                    disabled={restartGameMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white"
                    size="sm"
                  >
                    {restartGameMutation.isPending ? "Restarting..." : "Restart"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Gamepad2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-300">No active games</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guru Users Section */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Guru Users Management
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() => setSelectedGameType('uno')}
                variant={selectedGameType === 'uno' ? 'default' : 'outline'}
                size="sm"
                className={selectedGameType === 'uno' ? 'bg-blue-600 hover:bg-blue-700' : 'border-white/20 text-white hover:bg-white/10'}
              >
                UNO
              </Button>
              <Button
                onClick={() => setSelectedGameType('xo')}
                variant={selectedGameType === 'xo' ? 'default' : 'outline'}
                size="sm"
                className={selectedGameType === 'xo' ? 'bg-blue-600 hover:bg-blue-700' : 'border-white/20 text-white hover:bg-white/10'}
              >
                Tic Tac Toe
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <GuruUserManagement gameType={selectedGameType} guruUsers={guruUsers} isLoading={guruUsersLoading} />
        </CardContent>
      </Card>
    </div>
  );
}

// Guru User Management Component
function GuruUserManagement({ gameType, guruUsers, isLoading }: { 
  gameType: 'uno' | 'xo'; 
  guruUsers: GuruUser[]; 
  isLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = React.useState(false);

  // Create guru user mutation
  const createGuruUserMutation = useMutation({
    mutationFn: async (data: {
      username: string;
      playerName: string;
      email: string;
      password: string;
      gameType: 'uno' | 'xo';
    }) => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch('/api/admin/guru-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create guru user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/guru-users', gameType] });
      setShowCreateForm(false);
    }
  });

  // Toggle guru user mutation
  const toggleGuruUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`/api/admin/guru-users/${userId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to toggle guru user');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/guru-users', gameType] });
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white font-medium">{gameType.toUpperCase()} Guru Users ({guruUsers.length})</h3>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Guru User
        </Button>
      </div>

      {showCreateForm && (
        <CreateGuruUserForm
          gameType={gameType}
          onSubmit={(data) => createGuruUserMutation.mutate(data)}
          onCancel={() => setShowCreateForm(false)}
          isLoading={createGuruUserMutation.isPending}
          error={createGuruUserMutation.error?.message}
        />
      )}

      {isLoading ? (
        <div className="text-center py-4">
          <div className="text-gray-300">Loading guru users...</div>
        </div>
      ) : guruUsers.length > 0 ? (
        <div className="grid gap-3">
          {guruUsers.map((user) => (
            <div key={user.id} className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{user.playerName}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    user.isActive ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-gray-300 text-sm">{user.email}</div>
                <div className="text-gray-400 text-xs">
                  Created: {new Date(user.createdAt).toLocaleDateString()}
                  {user.lastLogin && ` • Last login: ${new Date(user.lastLogin).toLocaleDateString()}`}
                </div>
              </div>
              <Button
                onClick={() => toggleGuruUserMutation.mutate(user.id)}
                disabled={toggleGuruUserMutation.isPending}
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10"
              >
                {user.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Crown className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-300">No guru users for {gameType.toUpperCase()}</p>
          <p className="text-sm text-gray-400 mt-2">Create special authenticated players who can access advanced features</p>
        </div>
      )}
    </div>
  );
}

// Create Guru User Form Component
function CreateGuruUserForm({ 
  gameType, 
  onSubmit, 
  onCancel, 
  isLoading, 
  error 
}: {
  gameType: 'uno' | 'xo';
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}) {
  const [formData, setFormData] = React.useState({
    username: '',
    playerName: '',
    email: '',
    password: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      gameType
    });
  };

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <CardTitle className="text-white text-lg">Create New Guru User - {gameType.toUpperCase()}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-600/20 border border-red-600/50 rounded-lg p-3">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white text-sm font-medium block mb-2">Username (Login)</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                placeholder="Hidden login username"
                required
                minLength={3}
                maxLength={20}
              />
            </div>
            <div>
              <label className="text-white text-sm font-medium block mb-2">Player Name (Visible)</label>
              <input
                type="text"
                value={formData.playerName}
                onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                placeholder="Name shown in games"
                required
                maxLength={20}
              />
            </div>
          </div>

          <div>
            <label className="text-white text-sm font-medium block mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400"
              placeholder="user@example.com"
              required
            />
          </div>

          <div>
            <label className="text-white text-sm font-medium block mb-2">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400"
              placeholder="Minimum 6 characters"
              required
              minLength={6}
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white flex-1"
            >
              {isLoading ? "Creating..." : "Create Guru User"}
            </Button>
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');

  // Validate session on component mount
  useEffect(() => {
    const validateSession = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
          setLocation('/man');
          return;
        }

        const response = await fetch("/api/admin/validate-session", {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setAdminData(data.admin);
        } else {
          localStorage.removeItem('adminToken');
          setLocation('/man');
        }
      } catch (error) {
        console.error('Session validation error:', error);
        localStorage.removeItem('adminToken');
        setLocation('/man');
      }
    };

    validateSession();
  }, [setLocation]);

  // Mock system stats for now - would be replaced with real API calls
  const systemStats: SystemStats = {
    activeRooms: 12,
    activePlayers: 45,
    totalGamesPlayed: 1234,
    serverUptime: "7 days, 14 hours",
    databaseStatus: "Connected"
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setLocation('/man');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (!adminData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-gray-300">Welcome back, {adminData.username}</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" className="text-white border-white hover:bg-white hover:text-black">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* System Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-300">Active Rooms</CardTitle>
                <Gamepad2 className="w-4 h-4 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{systemStats.activeRooms}</div>
              <p className="text-xs text-gray-400">Games in progress</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-300">Active Players</CardTitle>
                <Users className="w-4 h-4 text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{systemStats.activePlayers}</div>
              <p className="text-xs text-gray-400">Online now</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-300">Total Games</CardTitle>
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{systemStats.totalGamesPlayed.toLocaleString()}</div>
              <p className="text-xs text-gray-400">Games completed</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-300">Server Status</CardTitle>
                <Server className="w-4 h-4 text-yellow-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm text-white">Online</span>
              </div>
              <p className="text-xs text-gray-400">{systemStats.serverUptime}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/10 backdrop-blur-sm border-white/20">
            <TabsTrigger value="overview" className="text-white data-[state=active]:bg-white data-[state=active]:text-black">
              Overview
            </TabsTrigger>
            <TabsTrigger value="games" className="text-white data-[state=active]:bg-white data-[state=active]:text-black">
              Games
            </TabsTrigger>
            <TabsTrigger value="players" className="text-white data-[state=active]:bg-white data-[state=active]:text-black">
              Players
            </TabsTrigger>
            <TabsTrigger value="system" className="text-white data-[state=active]:bg-white data-[state=active]:text-black">
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Admin Account</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Username:</span>
                    <Badge variant="secondary">{adminData.username}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Email:</span>
                    <span className="text-white">{adminData.email || 'Not set'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Last Login:</span>
                    <span className="text-white">{formatDate(adminData.lastLogin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">2FA Status:</span>
                    <Badge variant={adminData.isInitialSetup ? "destructive" : "default"}>
                      {adminData.isInitialSetup ? "Setup Required" : "Enabled"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">System Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Database:</span>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white">{systemStats.databaseStatus}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">WebSocket:</span>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white">Active</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Uptime:</span>
                    <span className="text-white">{systemStats.serverUptime}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="games">
            <GameManagement />
          </TabsContent>

          <TabsContent value="players">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Player Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-300">Player management features coming soon</p>
                  <p className="text-sm text-gray-400 mt-2">View player activity, ban users, and manage accounts</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-white">System Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-300">System configuration features coming soon</p>
                  <p className="text-sm text-gray-400 mt-2">Manage server settings, database maintenance, and system logs</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}