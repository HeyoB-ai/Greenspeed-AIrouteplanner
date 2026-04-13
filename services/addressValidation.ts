export async function validateAddress(
  street: string,
  houseNumber: string,
  postalCode: string,
  city: string
): Promise<{ valid: boolean; suggestion?: string }> {
  const q = encodeURIComponent(`${street} ${houseNumber} ${postalCode} ${city}`);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(
      `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${q}&rows=1&fq=type:adres`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    const data = await res.json();
    const hit = data?.response?.docs?.[0];
    if (!hit) return { valid: false };

    // Postcode is de enige vergelijkingssleutel — spaties en hoofdletters negeren
    const normalize = (s: string) => s.replace(/\s/g, '').toUpperCase();
    const postcodeMatch = normalize(hit.postcode ?? '') === normalize(postalCode);

    if (!postcodeMatch) {
      return { valid: false, suggestion: hit.weergavenaam };
    }
    return { valid: true };
  } catch {
    // Bij netwerktimeout of API-fout: niet blokkeren
    return { valid: true };
  }
}
