import { Address } from "../types";

const MODEL = 'gemini-2.5-flash';

/**
 * Stuurt een verzoek naar de Netlify proxy-functie die de Gemini API aanroept.
 * De API key blijft op de server — nooit zichtbaar in de browser.
 */
async function callGemini(requestBody: object): Promise<string | null> {
  const response = await fetch('/.netlify/functions/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, ...requestBody }),
  });

  if (!response.ok) {
    let errMsg = `Gemini proxy error ${response.status}`;
    try {
      const errData = await response.json();
      errMsg = errData?.error?.message || errData?.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  // Gemini REST-response: candidates[0].content.parts[0].text
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

export async function extractAddressFromImage(
  base64Image: string
): Promise<{ address: Address; pharmacyName: string } | null> {
  try {
    const text = await callGemini({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              text: 'Analyseer dit Nederlandse apotheek-etiket. TAAK 1: Zoek het afleveradres van de patiënt (street, houseNumber, postalCode, city). TAAK 2: Zoek de NAAM van de apotheek die dit label heeft uitgegeven (vaak bovenaan of onderaan met "Apotheek" in de naam). Geef GEEN patiëntnamen of medicatie. Antwoord in JSON.',
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            address: {
              type: 'OBJECT',
              properties: {
                street: { type: 'STRING' },
                houseNumber: { type: 'STRING' },
                postalCode: { type: 'STRING' },
                city: { type: 'STRING' },
              },
              required: ['street', 'houseNumber', 'postalCode', 'city'],
            },
            pharmacyName: {
              type: 'STRING',
              description: 'De volledige naam van de apotheek gevonden op het label.',
            },
          },
          required: ['address', 'pharmacyName'],
        },
      },
    });

    console.log('Gemini raw response (OCR):', text);
    if (!text) return null;
    return JSON.parse(text);
  } catch (error: any) {
    console.error('AI OCR Error:', error);
    if (error.message?.includes('API key not configured')) {
      alert('Configuratie fout: GEMINI_API_KEY ontbreekt op de server. Voeg hem toe via Netlify → Site settings → Environment variables.');
    }
    return null;
  }
}

export async function optimizeRoute(
  addresses: (Address & { id: string })[]
): Promise<string[]> {
  try {
    const text = await callGemini({
      contents: [
        {
          parts: [
            {
              text: `Optimaliseer de meest logische fietsroute langs deze adressen, beginnend in het centrum van de stad. Geef ALLE IDs terug in de nieuwe volgorde. INPUT: ${JSON.stringify(addresses)}`,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
      },
    });

    if (!text) return addresses.map(a => a.id);
    return JSON.parse(text);
  } catch (error: any) {
    console.error('AI Route Error:', error);
    return addresses.map(a => a.id);
  }
}
