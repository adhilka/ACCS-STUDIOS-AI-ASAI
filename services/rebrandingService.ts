import { GoogleGenAI, Type } from "@google/genai";
import { BrandAssets, ApiConfig } from "../types";

const getAiInstance = (apiConfig: ApiConfig) => {
    const key = apiConfig.gemini;
    if (!key) throw new Error("API key is not configured for Gemini. Please go to Settings to add it.");
    return new GoogleGenAI({ apiKey: key });
};

const generateImage = async (ai: GoogleGenAI, prompt: string, isLogo: boolean): Promise<string> => {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: isLogo ? '1:1' : '16:9',
        },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("Image generation failed to return an image.");
    }
    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${base64ImageBytes}`;
};

const generateColors = async (ai: GoogleGenAI, prompt: string): Promise<BrandAssets['colors']> => {
    const colorSchema = {
        type: Type.OBJECT,
        properties: {
            primary: { type: Type.STRING, description: "A vibrant primary color for buttons and links (hex code, e.g., '#3B82F6')." },
            secondary: { type: Type.STRING, description: "A secondary accent color for important UI elements (hex code, e.g., '#8B5CF6')." },
            accent: { type: Type.STRING, description: "A tertiary accent color for highlights and icons (hex code, e.g., '#0EA5E9')." },
            neutral: { type: Type.STRING, description: "A neutral color for secondary text and borders (hex code, e.g., '#6B7280')." },
            'base-content': { type: Type.STRING, description: "The main text color. MUST be a very light color for high contrast (e.g., '#F9FAFB')." },
            'base-100': { type: Type.STRING, description: "The darkest background color for the app shell. MUST be a dark color (e.g., '#111827')." },
            'base-200': { type: Type.STRING, description: "A slightly lighter background for cards and panels. MUST be a dark color (e.g., '#1F2937')." },
            'base-300': { type: Type.STRING, description: "An even lighter background for hovers/borders. MUST be a dark color (e.g., '#374151')." },
        },
        required: ['primary', 'secondary', 'accent', 'neutral', 'base-content', 'base-100', 'base-200', 'base-300']
    };

    const generationPrompt = `You are a UI/UX design expert. Generate a professional, accessible, dark-themed UI color palette based on the theme: "${prompt}".
**CRITICAL INSTRUCTIONS:**
1.  All color values MUST be valid 6-digit hexadecimal codes starting with '#'. For example, '#1A2B3C'.
2.  The palette is for a DARK THEME. This means 'base-100', 'base-200', and 'base-300' MUST be dark colors.
3.  'base-content' MUST be a very light color (like '#FFFFFF' or '#F0F0F0') to ensure high contrast and readability against the dark base colors.
4.  Ensure there is sufficient contrast between 'primary'/'secondary'/'accent' colors and the 'base-content' color if text is placed on them (WCAG AA standard).`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: generationPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: colorSchema,
        },
    });

    try {
        const colors = JSON.parse(response.text.trim());

        // --- Validation Step ---
        const requiredKeys: (keyof BrandAssets['colors'])[] = ['primary', 'secondary', 'accent', 'neutral', 'base-content', 'base-100', 'base-200', 'base-300'];
        const hexRegex = /^#[0-9a-fA-F]{6}$/;

        for (const key of requiredKeys) {
            if (!colors[key] || typeof colors[key] !== 'string' || !hexRegex.test(colors[key])) {
                console.error(`Validation failed for color key '${key}':`, colors[key]);
                throw new Error(`AI generated an invalid or missing color for '${key}'. Please try a different prompt.`);
            }
        }
        
        return colors;

    } catch (e) {
        console.error("Failed to parse or validate color JSON:", response.text, e);
        if (e instanceof Error && e.message.startsWith('AI generated an invalid')) {
            throw e; // Re-throw our custom validation error
        }
        throw new Error("AI failed to generate a valid and complete color palette. Please try again.");
    }
};


export const generateBrandAssets = async (prompt: string, apiConfig: ApiConfig): Promise<BrandAssets> => {
    // FIX: Corrected the condition to check for the Gemini API key directly, as 'provider' does not exist on 'ApiConfig'.
    if (!apiConfig.gemini) {
        throw new Error("AI Rebranding feature currently only supports the Gemini provider. Please add your Gemini API key in settings.");
    }
    
    const ai = getAiInstance(apiConfig);

    const logoPrompt = `A modern, minimalist, abstract logo for a software company with the theme: "${prompt}". The logo should be on a transparent background, suitable for a web app icon. Simple shapes, clean lines, professional.`;
    const backgroundPrompt = `A subtle, abstract, dark background image for a professional software application, with the theme: "${prompt}". It should be elegant and not distracting. Gradient, geometric patterns, or subtle textures are good.`;

    const [logo, background, colors] = await Promise.all([
        generateImage(ai, logoPrompt, true),
        generateImage(ai, backgroundPrompt, false),
        generateColors(ai, prompt)
    ]);

    return { logo, background, colors };
};