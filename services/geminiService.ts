import { Address } from "../types";

export async function extractAddressFromImage(base64Image: string): Promise<Address | null> {
  try {
    const response = await fetch("/.netlify/functions/genai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "extractAddress",
        payload: { base64Image }
      }),
    });

    if (!response.ok) throw new Error("Server error");
    return await response.json();
  } catch (error) {
    console.error("AI OCR Error (via Proxy):", error);
    return null;
  }
}

export async function optimizeRoute(addresses: (Address & { id: string })[]): Promise<string[]> {
  try {
    const response = await fetch("/.netlify/functions/genai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "optimizeRoute",
        payload: { addresses }
      }),
    });

    if (!response.ok) throw new Error("Server error");
    return await response.json();
  } catch (error) {
    console.error("AI Route Error (via Proxy):", error);
    return addresses.map(a => a.id);
  }
}