import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import MainHome from "@/pages/MainHome";
import Home from "@/pages/Home";
import RoomLobby from "@/pages/RoomLobby";
import Game from "@/pages/GameFixed";
import BotGame from "@/pages/BotGame";
import StreamPage from "@/pages/StreamPage";
import StreamLobbyPage from "@/pages/StreamLobbyPage";
import StreamHostPage from "@/pages/StreamHostPage";
import StreamGamePage from "@/pages/StreamGamePage";
import StreamPlayerPage from "@/pages/StreamPlayerPage";
import StreamJoinPage from "@/pages/StreamJoinPage";
import StreamSpectatorPage from "@/pages/StreamSpectatorPage";
import XOPlaceholder from "@/pages/XOPlaceholder";
import VmodeRoomLobby from "@/pages/vmode_RoomLobby";
import VmodeGame from "@/pages/vmode_Game";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AssetGenerator from "@/pages/AssetGenerator";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={MainHome} />
      <Route path="/uno" component={Home} />
      <Route path="/uno/bot" component={BotGame} />
      <Route path="/xo" component={XOPlaceholder} />
      <Route path="/room/:roomId" component={RoomLobby} />
      <Route path="/game/:roomId" component={Game} />
      {/* Streaming Mode Routes */}
      <Route path="/stream/:roomId/join" component={StreamJoinPage} />
      <Route path="/stream/:roomId/spectator" component={StreamSpectatorPage} />
      <Route path="/stream/:roomId/lobby" component={StreamLobbyPage} />
      <Route path="/stream/:roomId/game" component={StreamGamePage} />
      <Route path="/stream/:roomId/host" component={StreamHostPage} />
      <Route path="/stream/:roomId/host/game" component={StreamPlayerPage} />
      <Route path="/stream/:roomId/player/:slot" component={StreamPlayerPage} />
      <Route path="/stream/:roomId" component={StreamPage} />
      {/* Viewer Mode Routes */}
      <Route path="/vmode/room/:roomId" component={VmodeRoomLobby} />
      <Route path="/vmode/game/:roomId" component={VmodeGame} />
      <Route path="/man" component={AdminLogin} />
      <Route path="/man/dashboard" component={AdminDashboard} />
      <Route path="/assets" component={AssetGenerator} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
