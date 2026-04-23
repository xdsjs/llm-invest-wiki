export interface SecRecentFilingSummary {
  filingDate: string;
  form: string;
  accessionNumber: string;
  primaryDocument: string;
}

export interface SecRecentSubmissionsSummary {
  cik: string;
  name: string | null;
  ticker: string | null;
  exchange: string | null;
  recent: SecRecentFilingSummary[];
}

export function secHeaders(): Record<string, string> {
  return {
    Accept: 'application/json,text/plain,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: 'https://www.sec.gov/',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  };
}

export function zeroPadCik(cik: string): string {
  return String(cik).replace(/\D/g, '').padStart(10, '0');
}

export function parseFormsOption(forms?: string): string[] {
  if (!forms) {
    return [];
  }
  return forms
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

export function summarizeRecentSubmissions(
  payload: any,
  forms: string[] = []
): SecRecentSubmissionsSummary {
  const recent = payload.filings?.recent;
  const wanted = forms.length > 0 ? new Set(forms) : null;
  const rows: SecRecentFilingSummary[] = [];

  if (recent) {
    for (let i = 0; i < recent.form.length; i++) {
      if (wanted && !wanted.has(recent.form[i])) {
        continue;
      }

      rows.push({
        filingDate: recent.filingDate[i],
        form: recent.form[i],
        accessionNumber: recent.accessionNumber[i],
        primaryDocument: recent.primaryDocument[i],
      });
    }
  }

  return {
    cik: zeroPadCik(payload.cik ?? ''),
    name: payload.name ?? null,
    ticker: payload.tickers?.[0] ?? null,
    exchange: payload.exchanges?.[0] ?? null,
    recent: rows,
  };
}

export async function fetchSecSubmissionsByCik(cik: string): Promise<any> {
  const padded = zeroPadCik(cik);
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  const response = await fetch(url, {
    headers: secHeaders(),
  });

  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status}`);
  }

  return await response.json();
}
