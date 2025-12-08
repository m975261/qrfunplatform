import fetch from 'node-fetch';

const LEONARDO_API_URL = 'https://cloud.leonardo.ai/api/rest/v1';
const API_KEY = process.env.LEONARDO_API_KEY;

interface GenerationResponse {
  sdGenerationJob: {
    generationId: string;
    apiCreditCost: number;
  };
}

interface GeneratedImage {
  id: string;
  url: string;
  nsfw: boolean;
}

interface GenerationResult {
  generations_by_pk: {
    status: string;
    generated_images: GeneratedImage[];
  };
}

export async function generateImage(prompt: string, options: {
  width?: number;
  height?: number;
  modelId?: string;
  numImages?: number;
} = {}): Promise<string | null> {
  if (!API_KEY) {
    console.error('Leonardo API key not found');
    return null;
  }

  const {
    width = 512,
    height = 512,
    modelId = '6bef9f1b-29cb-40c7-b9df-32b51c1f67d3',
    numImages = 1
  } = options;

  try {
    const response = await fetch(`${LEONARDO_API_URL}/generations`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        height,
        width,
        modelId,
        prompt,
        num_images: numImages,
        public: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Leonardo API error:', response.status, errorText);
      return null;
    }

    const data = await response.json() as GenerationResponse;
    const generationId = data.sdGenerationJob.generationId;
    console.log(`Started generation ${generationId}, cost: ${data.sdGenerationJob.apiCreditCost} credits`);

    const imageUrl = await pollForCompletion(generationId);
    return imageUrl;
  } catch (error) {
    console.error('Error generating image:', error);
    return null;
  }
}

async function pollForCompletion(generationId: string, maxAttempts = 30): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const response = await fetch(`${LEONARDO_API_URL}/generations/${generationId}`, {
        headers: {
          'accept': 'application/json',
          'authorization': `Bearer ${API_KEY}`
        }
      });

      if (!response.ok) continue;

      const data = await response.json() as GenerationResult;
      const status = data.generations_by_pk?.status;

      if (status === 'COMPLETE' && data.generations_by_pk?.generated_images?.length > 0) {
        return data.generations_by_pk.generated_images[0].url;
      } else if (status === 'FAILED') {
        console.error('Generation failed');
        return null;
      }
    } catch (error) {
      console.error('Error polling generation:', error);
    }
  }

  console.error('Generation timed out');
  return null;
}

export async function generateGameAssets(): Promise<{
  cardBack: string | null;
  tableBackground: string | null;
  logo: string | null;
}> {
  console.log('Generating UNO game assets with Leonardo.ai...');
  
  const [cardBack, tableBackground, logo] = await Promise.all([
    generateImage(
      'UNO card back design, elegant swirl pattern, deep red and black colors, premium game card, centered symmetrical design, no text, high quality digital art',
      { width: 256, height: 384 }
    ),
    generateImage(
      'Premium casino game table surface, green felt texture with subtle pattern, elegant border, top-down view, perfect for card game background, no cards visible',
      { width: 1024, height: 1024 }
    ),
    generateImage(
      'UNO game logo, colorful letters, Nintendo style, playful design, 3D effect, vibrant red blue green yellow colors, white background, centered',
      { width: 512, height: 256 }
    )
  ]);

  return { cardBack, tableBackground, logo };
}

export async function checkApiStatus(): Promise<{
  available: boolean;
  credits?: number;
  error?: string;
}> {
  if (!API_KEY) {
    return { available: false, error: 'API key not configured' };
  }

  try {
    const response = await fetch(`${LEONARDO_API_URL}/me`, {
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${API_KEY}`
      }
    });

    if (!response.ok) {
      return { available: false, error: `API error: ${response.status}` };
    }

    const data = await response.json() as any;
    const credits = data.user_details?.[0]?.apiPaidTokens || 0;
    
    return { available: true, credits };
  } catch (error) {
    return { available: false, error: String(error) };
  }
}
