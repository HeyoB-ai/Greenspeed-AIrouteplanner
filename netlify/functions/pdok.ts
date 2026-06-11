// PDOK Locatieserver: officiële NL-adresvalidatie (BAG), gratis, geen key.
const PDOK_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';

const json = (statusCode: number, body: any) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event: any) => {
  try {
    const { postalCode, houseNumber } = JSON.parse(event.body || '{}');
    if (!postalCode || houseNumber == null || houseNumber === '') {
      return json(200, { found: false, error: 'postcode of huisnummer ontbreekt' });
    }

    const pc = String(postalCode).replace(/\s+/g, '').toUpperCase();
    const nr = String(houseNumber).trim();

    const params = new URLSearchParams({
      q: `${pc} ${nr}`,
      fq: 'type:adres',
      rows: '1',
      fl: 'weergavenaam,straatnaam,huisnummer,postcode,woonplaatsnaam,centroide_ll',
    });

    const res = await fetch(`${PDOK_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return json(200, { found: false, error: `PDOK status ${res.status}` });

    const data = await res.json();
    const doc = data?.response?.docs?.[0];
    if (!doc) return json(200, { found: false });

    const docPc = String(doc.postcode || '').replace(/\s+/g, '').toUpperCase();
    const nrNum = parseInt(nr, 10);
    const docNrNum = parseInt(String(doc.huisnummer ?? ''), 10);

    let lat: number | null = null;
    let lng: number | null = null;
    const m = String(doc.centroide_ll || '').match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
    if (m) { lng = parseFloat(m[1]); lat = parseFloat(m[2]); }

    const found = docPc === pc && Number.isFinite(nrNum) && nrNum === docNrNum && lat != null;

    return json(200, {
      found,
      street: doc.straatnaam ?? null,
      city: doc.woonplaatsnaam ?? null,
      postalCode: doc.postcode ?? null,
      houseNumber: doc.huisnummer ?? null,
      lat,
      lng,
    });
  } catch (err: any) {
    return json(200, { found: false, error: err?.message ?? 'onbekende fout' });
  }
};
