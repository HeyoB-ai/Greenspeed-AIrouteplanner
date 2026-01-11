import { GoogleGenAI, Type } from "@google/genai";

export const handler = async (event: any) => {
  // Alleen POST verzoeken toestaan
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

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(JSON.parse(response.text || "{}")),
      };
    }

    if (action === "optimizeRoute") {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Optimaliseer de meest efficiënte bezorgroute. Geef alleen een gesorteerde lijst van IDs terug: ${JSON.stringify(payload.addresses)}`,
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