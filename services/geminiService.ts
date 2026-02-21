import { GoogleGenAI, Type } from "@google/genai";
import { Address } from "../types";

/**
 * Veilige helper om omgevingsvariabelen op te halen.
 * Voorkomt 'undefined' crashes in verschillende JS runtimes.
 */
const getEnvVar = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[key];
    }
  } catch (e) {}
  
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) {}

  return undefined;
};

// Gebruik een variabele om de client op te slaan na initialisatie
let genAI: GoogleGenAI | null = null;

function getGenAI() {
  if (!genAI) {
    // Probeer verschillende mogelijke namen voor de API key
    const apiKey = getEnvVar('VITE_GEMINI_API_KEY') || 
                   getEnvVar('GEMINI_API_KEY') || 
                   getEnvVar('API_KEY');
    
    if (!apiKey) {
      throw new Error("Gemini API Key is niet geconfigureerd. Voeg VITE_GEMINI_API_KEY toe aan je omgevingsvariabelen.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export async function extractAddressFromImage(base64Image: string): Promise<{ address: Address; pharmacyName: string } | null> {
  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: "Analyseer dit Nederlandse apotheek-etiket. TAAK 1: Zoek het afleveradres van de patiënt (street, houseNumber, postalCode, city). TAAK 2: Zoek de NAAM van de apotheek die dit label heeft uitgegeven (vaak bovenaan of onderaan met 'Apotheek' in de naam). Geef GEEN patiëntnamen of medicatie. Antwoord in JSON.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            address: {
              type: Type.OBJECT,
              properties: {
                street: { type: Type.STRING },
                houseNumber: { type: Type.STRING },
                postalCode: { type: Type.STRING },
                city: { type: Type.STRING },
              },
              required: ["street", "houseNumber", "postalCode", "city"],
            },
            pharmacyName: { 
              type: Type.STRING,
              description: "De volledige naam van de apotheek gevonden op het label."
            },
          },
          required: ["address", "pharmacyName"],
        },
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error: any) {
    console.error("AI OCR Error:", error);
    if (error.message?.includes("API Key") || error.message?.includes("geconfigureerd")) {
      alert("Configuratie fout: De Gemini API Key ontbreekt. Zorg dat VITE_GEMINI_API_KEY is ingesteld in Netlify.");
    }
    return null;
  }
}

export async function optimizeRoute(addresses: (Address & { id: string })[]): Promise<string[]> {
  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Optimaliseer de meest logische fietsroute langs deze adressen, beginnend in het centrum van de stad. Geef ALLE IDs terug in de nieuwe volgorde. INPUT: ${JSON.stringify(addresses)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (!text) return addresses.map(a => a.id);
    return JSON.parse(text);
  } catch (error: any) {
    console.error("AI Route Error:", error);
    return addresses.map(a => a.id);
  }
}
