import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Wand2, Download, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

interface GeneratedAssets {
  cardBack: string | null;
  tableBackground: string | null;
  logo: string | null;
}

export default function AssetGenerator() {
  const { toast } = useToast();
  const [customPrompt, setCustomPrompt] = useState("");
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAssets | null>(null);
  const [customImage, setCustomImage] = useState<string | null>(null);

  const { data: apiStatus, isLoading: statusLoading } = useQuery<{ available: boolean; credits?: number; error?: string }>({
    queryKey: ['/api/leonardo/status']
  });

  const generateAssetsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/leonardo/generate-assets');
      const data = await response.json();
      return data as { success: boolean; assets: GeneratedAssets };
    },
    onSuccess: (data) => {
      setGeneratedAssets(data.assets);
      toast({
        title: "Assets Generated!",
        description: "Your game assets have been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate assets. Please check your API key and credits.",
        variant: "destructive"
      });
    }
  });

  const generateCustomMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest('POST', '/api/leonardo/generate', { prompt, width: 512, height: 512 });
      const data = await response.json();
      return data as { success: boolean; imageUrl: string };
    },
    onSuccess: (data) => {
      setCustomImage(data.imageUrl);
      toast({
        title: "Image Generated!",
        description: "Your custom image has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate image. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleGenerateAssets = () => {
    generateAssetsMutation.mutate();
  };

  const handleGenerateCustom = () => {
    if (customPrompt.trim()) {
      generateCustomMutation.mutate(customPrompt);
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download the image.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white font-fredoka">
            <Wand2 className="inline-block mr-2 h-8 w-8" />
            Leonardo.ai Asset Generator
          </h1>
          <Link href="/">
            <Button variant="outline" data-testid="button-back-home">Back to Home</Button>
          </Link>
        </div>

        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white">API Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <div className="flex items-center text-white">
                <Loader2 className="animate-spin mr-2" />
                Checking API status...
              </div>
            ) : apiStatus?.available ? (
              <div className="flex items-center text-green-400">
                <Check className="mr-2" />
                API Connected - {apiStatus.credits?.toLocaleString() || 0} credits available
              </div>
            ) : (
              <div className="flex items-center text-red-400">
                <AlertCircle className="mr-2" />
                {apiStatus?.error || 'API not available'}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Generate Game Assets</CardTitle>
              <CardDescription className="text-white/70">
                Generate a complete set of UNO game assets including card back, table background, and logo.
                Uses approximately 21 API credits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleGenerateAssets}
                disabled={generateAssetsMutation.isPending || !apiStatus?.available}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                data-testid="button-generate-assets"
              >
                {generateAssetsMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin mr-2" />
                    Generating... (may take 1-2 minutes)
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2" />
                    Generate All Assets
                  </>
                )}
              </Button>

              {generatedAssets && (
                <div className="space-y-4 pt-4">
                  <h3 className="text-white font-semibold">Generated Assets:</h3>
                  
                  {generatedAssets.cardBack && (
                    <div className="space-y-2">
                      <p className="text-white/80 text-sm">Card Back:</p>
                      <img 
                        src={generatedAssets.cardBack} 
                        alt="Card Back" 
                        className="w-32 h-48 object-cover rounded-lg border-2 border-white/30"
                        data-testid="img-card-back"
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => downloadImage(generatedAssets.cardBack!, 'card-back.png')}
                        data-testid="button-download-card-back"
                      >
                        <Download className="mr-1 h-4 w-4" /> Download
                      </Button>
                    </div>
                  )}

                  {generatedAssets.tableBackground && (
                    <div className="space-y-2">
                      <p className="text-white/80 text-sm">Table Background:</p>
                      <img 
                        src={generatedAssets.tableBackground} 
                        alt="Table Background" 
                        className="w-full h-32 object-cover rounded-lg border-2 border-white/30"
                        data-testid="img-table-background"
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => downloadImage(generatedAssets.tableBackground!, 'table-background.png')}
                        data-testid="button-download-table"
                      >
                        <Download className="mr-1 h-4 w-4" /> Download
                      </Button>
                    </div>
                  )}

                  {generatedAssets.logo && (
                    <div className="space-y-2">
                      <p className="text-white/80 text-sm">Game Logo:</p>
                      <img 
                        src={generatedAssets.logo} 
                        alt="Game Logo" 
                        className="w-48 h-24 object-contain rounded-lg border-2 border-white/30 bg-white/10"
                        data-testid="img-logo"
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => downloadImage(generatedAssets.logo!, 'game-logo.png')}
                        data-testid="button-download-logo"
                      >
                        <Download className="mr-1 h-4 w-4" /> Download
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Custom Image Generation</CardTitle>
              <CardDescription className="text-white/70">
                Generate any custom image using a text prompt. Each generation uses approximately 7 API credits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Describe the image you want to generate..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                data-testid="input-custom-prompt"
              />
              
              <Button 
                onClick={handleGenerateCustom}
                disabled={generateCustomMutation.isPending || !apiStatus?.available || !customPrompt.trim()}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                data-testid="button-generate-custom"
              >
                {generateCustomMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2" />
                    Generate Image
                  </>
                )}
              </Button>

              {customImage && (
                <div className="space-y-2 pt-4">
                  <p className="text-white/80 text-sm">Generated Image:</p>
                  <img 
                    src={customImage} 
                    alt="Custom Generated" 
                    className="w-full h-64 object-contain rounded-lg border-2 border-white/30 bg-white/10"
                    data-testid="img-custom-generated"
                  />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => downloadImage(customImage, 'custom-image.png')}
                    data-testid="button-download-custom"
                  >
                    <Download className="mr-1 h-4 w-4" /> Download
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white">How to Use Generated Assets</CardTitle>
          </CardHeader>
          <CardContent className="text-white/80 space-y-2">
            <p>1. Generate the assets using the buttons above</p>
            <p>2. Download the images you want to use</p>
            <p>3. Save them to the <code className="bg-white/20 px-1 rounded">attached_assets</code> folder</p>
            <p>4. The game will automatically use the new assets</p>
            <p className="text-yellow-300 mt-4">
              Note: Each generation costs API credits. Card Back: ~7 credits, Table Background: ~7 credits, Logo: ~7 credits.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
