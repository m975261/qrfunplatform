import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Camera } from "lucide-react";

interface QRScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onResult, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        
        streamRef.current = stream;
        setHasPermission(true);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError("Camera access denied or not available");
        setHasPermission(false);
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Scan QR Code</h3>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {error ? (
            <div className="text-center py-8">
              <Camera className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={handleClose}>Close</Button>
            </div>
          ) : hasPermission === false ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">Camera permission required to scan QR codes</p>
              <Button onClick={handleClose}>Close</Button>
            </div>
          ) : (
            <div className="text-center">
              <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 border-2 border-white/50 rounded-lg"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white rounded-lg"></div>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Point your camera at a QR code to scan
              </p>
              <Button onClick={handleClose} variant="outline">
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
