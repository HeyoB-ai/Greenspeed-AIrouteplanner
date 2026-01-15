import { GoogleGenAI, Type } from "@google/genai";

export const handler = async (event: any) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { action, payload } = JSON.parse(event.body);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    if (action === "extractAddress") {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: payload.base64Image,
              },
            },
            {
              text: "Analyseer dit Nederlandse apotheek-etiket. Er staan vaak twee adressen op: 1. Het adres van de apotheek (afzender, vaak bovenaan bij een logo of kleine letters). 2. Het afleveradres van de patiënt (ontvanger, meestal centraal en in groter lettertype). TAAK: Extraheer UITSLUITEND het afleveradres van de patiënt. Velden: street, houseNumber, postalCode, city. PRIVACY REGEL: Negeer namen, BSN, telefoonnummers en medicijnnamen. Geef alleen het adres van de patiënt terug in JSON formaat.",
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

      const result = JSON.parse(response.text || "{}");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      };
    }

    if (action === "optimizeRoute") {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Je bent een logistiek expert. Optimaliseer de meest efficiënte route voor een fietser die medicijnen bezorgt. 
        STARTPUNT: De apotheek (Lamberts Hilversum).
        OPDRACHT: Sorteer de onderstaande adressen in de meest logische geografische volgorde (Traveling Salesman Problem). 
        BELANGRIJK: Groepeer adressen die dicht bij elkaar liggen. Geef ALLEEN de IDs terug in een platte JSON array in de nieuwe volgorde.
        ADRESSEN: ${JSON.stringify(payload.addresses)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(JSON.parse(response.text || "[]")),
      };
    }

    return { statusCode: 400, body: "Invalid Action" };
  } catch (error: any) {
    console.error("GenAI Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};