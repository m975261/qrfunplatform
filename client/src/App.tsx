import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import MainHome from "@/pages/MainHome";
import Home from "@/pages/Home";
import RoomLobby from "@/pages/RoomLobby";
import Game from "@/pages/GameFixed";
import XOPlaceholder from "@/pages/XOPlaceholder";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={MainHome} />
      <Route path="/uno" component={Home} />
      <Route path="/xo" component={XOPlaceholder} />
      <Route path="/room/:roomId" component={RoomLobby} />
      <Route path="/game/:roomId" component={Game} />
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
