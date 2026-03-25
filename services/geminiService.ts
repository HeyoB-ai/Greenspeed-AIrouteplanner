import { Address } from "../types";

const MODEL = 'gemini-2.5-flash';

/**
 * Stuurt een verzoek naar de Netlify proxy-functie die de Gemini API aanroept.
 * De API key blijft op de server — nooit zichtbaar in de browser.
 */
async function callGemini(requestBody: object): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, ...requestBody }),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function extractAddressFromImage(
  base64Image: string
): Promise<Address | null> {
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
              text: 'Zoek het afleveradres van de patiënt op dit Nederlandse apotheek-etiket. Geef ALLEEN: straatnaam (street), huisnummer (houseNumber), postcode (postalCode), stad (city). Geen namen, geen medicatie, geen apotheeknaam. Antwoord in JSON.',
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            street: { type: 'STRING' },
            houseNumber: { type: 'STRING' },
            postalCode: { type: 'STRING' },
            city: { type: 'STRING' },
          },
          required: ['street', 'houseNumber', 'postalCode', 'city'],
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
