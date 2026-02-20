import { GoogleGenAI, Type } from "@google/genai";
import { Address } from "../types";

// Initialiseer de AI client direct in de frontend
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractAddressFromImage(base64Image: string): Promise<Address | null> {
  try {
    const response = await genAI.models.generateContent({
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
            text: "Analyseer dit Nederlandse apotheek-etiket. Zoek het afleveradres van de patiënt (meestal het grootste adres in het midden). Als velden ontbreken, doe een best-guess op basis van de context (bijv. stad op basis van postcode). TAAK: Extraheer street, houseNumber, postalCode, city. Geef GEEN namen of medicatie. Antwoord in JSON.",
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

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("AI OCR Error:", error);
    return null;
  }
}

export async function optimizeRoute(addresses: (Address & { id: string })[]): Promise<string[]> {
  try {
    const response = await genAI.models.generateContent({
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
  } catch (error) {
    console.error("AI Route Error:", error);
    return addresses.map(a => a.id);
  }
}
