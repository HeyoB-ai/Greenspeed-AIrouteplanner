import { GoogleGenAI, Type } from "@google/genai";
import { Address } from "../types";

// We initialiseren de client pas wanneer nodig
function getAI() {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY niet geconfigureerd in de omgeving.");
  }
  return new GoogleGenAI({ apiKey });
}

export async function extractAddressFromImage(base64Image: string): Promise<Address | null> {
  try {
    const ai = getAI();
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
            text: "Extraheer UITSLUITEND het afleveradres van dit medisch etiket. Velden: street, houseNumber, postalCode, city. PRIVACY REGEL: Negeer alle patiëntnamen, BSN-nummers of medicijnnamen. Geef alleen de adresgegevens terug in JSON formaat.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            street: { type: Type.STRING },
            houseNumber: { type: Type.STRING },
            postalCode: { type: Type.STRING },
            city: { type: Type.STRING },
          },
          required: ["street", "houseNumber", "postalCode", "city"],
        },
      },
    });

    if (!response.text) return null;
    return JSON.parse(response.text) as Address;
  } catch (error) {
    console.error("AI OCR Error:", error);
    // Voor demo doeleinden vallen we niet stil
    return null;
  }
}

export async function optimizeRoute(addresses: (Address & { id: string })[]): Promise<string[]> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Je bent een logistiek expert. Optimaliseer de meest efficiënte bezorgroute voor een lokale koerier op basis van deze adressen. Geef alleen een gesorteerde lijst van IDs terug: ${JSON.stringify(addresses)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    if (!response.text) return addresses.map(a => a.id);
    return JSON.parse(response.text) as string[];
  } catch (error) {
    console.error("AI Route Error:", error);
    return addresses.map(a => a.id);
  }
}