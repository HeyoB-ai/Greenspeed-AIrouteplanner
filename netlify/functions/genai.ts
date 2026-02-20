
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
        contents: `Optimaliseer de meest logische fietsroute langs deze adressen, beginnend in het centrum van de stad. Geef ALLE IDs terug in de nieuwe volgorde. INPUT: ${JSON.stringify(payload.addresses)}`,
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
