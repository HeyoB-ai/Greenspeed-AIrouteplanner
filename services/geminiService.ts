
import { GoogleGenAI, Type } from "@google/genai";
import { Address } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Extracts address components from an image of a delivery label.
 * Specifically avoids PII like names or medication.
 */
export async function extractAddressFromImage(base64Image: string): Promise<Address | null> {
  try {
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
            text: "Exctract only the destination address from this medicine label. Respond ONLY with a JSON object containing 'street', 'houseNumber', 'postalCode', and 'city'. DO NOT extract patient names, phone numbers, tracking numbers, or medical information. This is for privacy-by-design compliance.",
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

    const result = JSON.parse(response.text);
    return result as Address;
  } catch (error) {
    console.error("Error extracting address:", error);
    return null;
  }
}

/**
 * Optimizes a list of addresses for the best delivery route.
 */
export async function optimizeRoute(addresses: (Address & { id: string })[]): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Given the following list of addresses (JSON format), determine the most efficient delivery sequence based on postal codes and street proximity. Return only a JSON array of the IDs in the optimized order.\n\n${JSON.stringify(addresses)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const result = JSON.parse(response.text);
    return result as string[];
  } catch (error) {
    console.error("Error optimizing route:", error);
    return addresses.map(a => a.id); // Fallback to original order
  }
}
