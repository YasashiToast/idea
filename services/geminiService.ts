import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Platform, AnalysisResult, ImageResult, ImageSource } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const UNSPLASH_ACCESS_KEY = '9j7inZGvmHPnuN9ww-BV-JVIWDsEo9YdGPB02kjzQFo';
const PIXABAY_API_KEY = '53764731-9bcaae045e92bba71589e692f';

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    titles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "The generated title" },
          reason: { type: Type.STRING, description: "Brief rationale (MAX 60 CHARACTERS)" }
        },
        required: ["text", "reason"]
      },
      description: "3 unique, high-quality titles"
    },
    keywords: {
      type: Type.ARRAY,
      items: { 
        type: Type.OBJECT,
        properties: {
          cn: { type: Type.STRING, description: "Chinese keyword for platform tags" },
          en: { type: Type.STRING, description: "English translation of the keyword for image search" }
        },
        required: ["cn", "en"]
      },
      description: "10 relevant keyword pairs (Chinese and English)"
    },
    imageSearchTerms: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "5 relevant English keywords to use for searching stock images"
    }
  },
  required: ["titles", "keywords", "imageSearchTerms"]
};

// 1. Text Analysis
export const generateContentAnalysis = async (
  text: string,
  platform: Platform
): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  const modelId = "gemini-2.5-flash";

  const prompt = `
    Analyze the following text content for the platform: ${platform}.
    
    Content:
    "${text}"

    Task:
    1. Generate 3 unique, high-quality Chinese titles suitable for ${platform}. 
       IMPORTANT: The 'reason' for each title must be extremely concise, STRICTLY UNDER 60 CHINESE CHARACTERS.
    2. Extract 10 most relevant keywords. Return them as objects with both Chinese ('cn') for tags and English ('en') for image search.
    3. Provide 5 relevant English keywords that describes the visual imagery suitable for this content.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: "你是一位专业的中文文案策划和编辑。请分析文本并返回JSON格式结果。推荐理由必须精简（60字以内）。",
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.7,
      },
    });

    if (!response.text) {
      throw new Error("No response received from Gemini.");
    }

    const result = JSON.parse(response.text) as AnalysisResult;
    return result;

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw error;
  }
};

// 2. AI Image Generation (Nano Banana)
export const generateAiImages = async (keywords: string[]): Promise<ImageResult[]> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");
  
  // Strict prompt to avoid text
  const promptText = `
    A professional, high-quality, photorealistic image featuring: ${keywords.join(', ')}. 
    Cinematic lighting, 8k resolution, highly detailed. 
    PURE PHOTOGRAPHY. 
    IMPORTANT: NO TEXT, NO WORDS, NO TYPOGRAPHY, NO WATERMARKS, NO LOGOS, NO SIGNATURES. 
    Focus entirely on the visual scenery, objects, or people.
  `;

  try {
    const requests = [1, 2, 3].map(() => 
      ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: promptText }] },
      })
    );

    const responses = await Promise.all(requests);
    const images: ImageResult[] = [];

    responses.forEach((res, idx) => {
      const parts = res.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
             const base64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
             images.push({
               id: `ai-${Date.now()}-${idx}`,
               url: base64,
               source: ImageSource.AI_GENERATION
             });
          }
        }
      }
    });

    return images;

  } catch (error) {
    console.error("AI Image Generation Failed:", error);
    // If AI fails, fallback to stock
    return generateStockImages(keywords, ImageSource.AI_GENERATION); 
  }
};

// 3. Stock Search (Unsplash + Pixabay)
export const generateStockImages = async (keywords: string[], source: ImageSource, page: number = 1): Promise<ImageResult[]> => {
  const results: ImageResult[] = [];
  // Use the first two keywords for a better search context, or just the first if it's long enough
  const query = keywords.slice(0, 2).join(' '); 
  
  try {
    // 1. Try Unsplash First (Higher Quality)
    // Add page parameter
    const unsplashResponse = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=4&page=${page}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`
    );
    
    if (unsplashResponse.ok) {
      const data = await unsplashResponse.json();
      const images = data.results.map((img: any) => ({
        id: `unsplash-${img.id}`,
        url: img.urls.regular, 
        source: ImageSource.STOCK_LIBRARY
      }));
      results.push(...images);
    } else {
      console.warn("Unsplash API limit or error", unsplashResponse.status);
    }
  } catch (e) {
    console.error("Unsplash error", e);
  }

  // 2. Supplement with Pixabay if needed (or if Unsplash failed)
  if (results.length < 5) {
     try {
       const needed = 5 - results.length;
       // Add page parameter
       const pixabayResponse = await fetch(
         `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&page=${page}&per_page=${Math.max(3, needed + 1)}`
       );
       
       if (pixabayResponse.ok) {
         const data = await pixabayResponse.json();
         const images = data.hits.slice(0, needed).map((img: any) => ({
           id: `pixabay-${img.id}`,
           url: img.largeImageURL,
           source: ImageSource.STOCK_LIBRARY
         }));
         results.push(...images);
       }
     } catch (e) {
       console.error("Pixabay error", e);
     }
  }

  // 3. Last Resort Fallback (LoremFlickr) to guarantee an image appears
  if (results.length === 0) {
      const seedBase = Date.now();
      for (let i = 0; i < 4; i++) {
        // Shift seed by page * 10 to ensure new results on refresh
        const lock = seedBase + i + (page * 10);
        const url = `https://loremflickr.com/1280/720/${encodeURIComponent(keywords[0])}?lock=${lock}`;
        results.push({ id: `backup-${i}-${lock}`, url, source });
      }
  }

  return results;
};
