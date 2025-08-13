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
  CheckCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Game Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Gamepad2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-300">Game management features coming soon</p>
                  <p className="text-sm text-gray-400 mt-2">View active games, kick players, and monitor game statistics</p>
                </div>
              </CardContent>
            </Card>
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