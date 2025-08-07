import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface NicknameEditorProps {
  currentNickname: string;
  playerId: string;
  isOpen: boolean;
  onClose: () => void;
  onNicknameChanged: (newNickname: string) => void;
}

export default function NicknameEditor({ 
  currentNickname, 
  playerId, 
  isOpen, 
  onClose, 
  onNicknameChanged 
}: NicknameEditorProps) {
  const [newNickname, setNewNickname] = useState(currentNickname);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleUpdateNickname = async () => {
    if (!newNickname.trim()) {
      // Removed toast notification as requested
      return;
    }

    if (newNickname.trim() === currentNickname) {
      onClose();
      return;
    }

    try {
      setIsUpdating(true);
      
      // Update nickname on server
      const response = await apiRequest("PATCH", `/api/players/${playerId}`, {
        nickname: newNickname.trim()
      });

      if (response.ok) {
        // Update local storage
        localStorage.setItem("playerNickname", newNickname.trim());
        
        // Notify parent component
        onNicknameChanged(newNickname.trim());
        
        // Removed toast notification as requested
        
        onClose();
      } else {
        throw new Error("Failed to update nickname");
      }
    } catch (error) {
      console.error("Error updating nickname:", error);
      // Removed toast notification as requested
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Nickname</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-2">
              New Nickname
            </label>
            <Input
              id="nickname"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              placeholder="Enter your nickname"
              maxLength={20}
              disabled={isUpdating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUpdateNickname();
                }
              }}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateNickname}
              disabled={isUpdating}
              className="bg-uno-blue hover:bg-blue-600"
            >
              {isUpdating ? "Updating..." : "OK"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}