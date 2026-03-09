import { GoogleGenAI } from '@google/genai';
import { findCategoryByCode, PCG_CATEGORIES } from '@/config/pcg';

const GEMINI_MODEL = 'gemini-2.5-flash';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error('[ocr] GEMINI_API_KEY is not set — OCR will not work.');
    return null;
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

export type OcrExtractedData = {
  vendor: string | null;
  date: string | null;          // ISO YYYY-MM-DD
  amountTtc: number | null;     // euros (float)
  vatRate: number | null;        // percentage (20, 10, 5.5, 2.1, 0)
  vatAmount: number | null;      // euros (float)
  amountHt: number | null;       // euros (float)
  category: string | null;       // suggested label
  accountCode: string | null;    // suggested PCG code
  pieceRef: string | null;       // invoice/receipt number
  note: string | null;           // extra info
  type: 'EXPENSE' | 'INCOME';
  confidence: number;            // 0-100
};

const ALLOWED_MEDIA_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export function isAllowedMediaType(mime: string): boolean {
  return (ALLOWED_MEDIA_TYPES as readonly string[]).includes(mime);
}

const PCG_EXPENSE_LIST = PCG_CATEGORIES
  .filter(c => c.type === 'EXPENSE')
  .map(c => `${c.code} — ${c.label}`)
  .join('\n');

const PCG_INCOME_LIST = PCG_CATEGORIES
  .filter(c => c.type === 'INCOME')
  .map(c => `${c.code} — ${c.label}`)
  .join('\n');

const PCG_ALL_LIST = PCG_CATEGORIES
  .map(c => `${c.code} — ${c.label} (${c.type === 'INCOME' ? 'revenu' : 'charge'})`)
  .join('\n');

const SYSTEM_PROMPT = `Tu es un assistant comptable français expert. On te donne une photo ou un PDF de ticket de caisse, facture, reçu ou justificatif de dépense.

Extrais les informations suivantes au format JSON strict (pas de markdown, pas de commentaires) :
{
  "vendor": "nom du fournisseur/commerçant",
  "date": "YYYY-MM-DD",
  "amountTtc": 123.45,
  "vatRate": 20,
  "vatAmount": 20.57,
  "amountHt": 102.88,
  "category": "label de catégorie suggérée",
  "accountCode": "code PCG 3 chiffres",
  "pieceRef": "numéro de facture ou ticket",
  "note": "détail complémentaire utile (ex: nombre d'articles, description)",
  "type": "EXPENSE",
  "confidence": 85
}

Règles :
- amountTtc = montant TTC total en euros (nombre décimal, pas de symbole €)
- vatRate = taux de TVA principal en pourcentage (20, 10, 5.5, 2.1, 0). Si plusieurs taux, prendre le dominant.
- vatAmount et amountHt : si non visible, calcule-les depuis amountTtc et vatRate
- date : format ISO YYYY-MM-DD. Si l'année n'est pas visible, utilise 2026.
- type : EXPENSE pour les achats/dépenses, INCOME pour les ventes/encaissements
- accountCode : choisis parmi ces codes PCG :
${PCG_EXPENSE_LIST}
${PCG_INCOME_LIST}
- confidence : de 0 à 100, ta confiance sur l'extraction globale
- Si un champ n'est pas trouvable, mets null
- Réponds UNIQUEMENT avec le JSON, sans texte autour`;

export async function extractFromDocument(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<OcrExtractedData | null> {
  const ai = getClient();
  if (!ai) return null;

  if (!isAllowedMediaType(mimeType)) return null;

  const base64 = fileBuffer.toString('base64');

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: 'Extrais les informations de ce justificatif.',
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 1024,
      },
    });
    text = response.text;
  } catch (err) {
    console.error('[ocr] Gemini API error:', err instanceof Error ? err.message : err);
    return null;
  }

  if (!text) return null;

  try {
    // Clean potential markdown wrapping
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    // Validate & normalize accountCode
    let accountCode = parsed.accountCode ? String(parsed.accountCode) : null;
    if (accountCode && !findCategoryByCode(accountCode)) {
      accountCode = null;
    }

    // Normalize vatRate to standard French values
    let vatRate = parsed.vatRate != null ? Number(parsed.vatRate) : null;
    if (vatRate != null && ![20, 10, 5.5, 2.1, 0].includes(vatRate)) {
      if (vatRate > 15) vatRate = 20;
      else if (vatRate > 7) vatRate = 10;
      else if (vatRate > 3) vatRate = 5.5;
      else if (vatRate > 1) vatRate = 2.1;
      else vatRate = 0;
    }

    return {
      vendor: parsed.vendor ?? null,
      date: parsed.date ?? null,
      amountTtc: parsed.amountTtc != null ? Number(parsed.amountTtc) : null,
      vatRate,
      vatAmount: parsed.vatAmount != null ? Number(parsed.vatAmount) : null,
      amountHt: parsed.amountHt != null ? Number(parsed.amountHt) : null,
      category: parsed.category ?? null,
      accountCode,
      pieceRef: parsed.pieceRef ?? null,
      note: parsed.note ?? null,
      type: parsed.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
      confidence: parsed.confidence != null ? Math.min(100, Math.max(0, Number(parsed.confidence))) : 0,
    };
  } catch {
    console.error('[ocr] Failed to parse AI response:', text);
    return null;
  }
}

// ── Auto-categorization ────────────────────────────────────────────────────────

export type CategorizationResult = {
  accountCode: string;
  label: string;
  confidence: number;
};

export type CategorizationInput = {
  id: string;
  category: string;
  vendor: string | null;
  type: 'INCOME' | 'EXPENSE';
  amountCents: string;
};

const CATEGORIZE_PROMPT = `Tu es un assistant comptable français. On te donne une liste d'écritures financières (libellé, fournisseur, type, montant).

Pour chaque écriture, attribue le code PCG le plus adapté parmi cette liste :
${PCG_ALL_LIST}

Réponds UNIQUEMENT avec un JSON array strict (pas de markdown) :
[
  { "id": "...", "accountCode": "613", "label": "Loyer & charges locatives", "confidence": 90 },
  ...
]

Règles :
- id = l'identifiant fourni pour chaque écriture (retourne-le tel quel)
- accountCode = code PCG le plus adapté
- label = libellé PCG correspondant
- confidence = 0 à 100, ta confiance dans le classement
- Pour les EXPENSE, utilise les codes classe 6. Pour les INCOME, utilise les codes classe 7.
- Analyse le libellé ET le fournisseur pour déterminer la catégorie (ex: "OVH" → 626 Télécom, "Uber Eats" → 6253 Restauration)
- Réponds UNIQUEMENT avec le JSON array`;

/**
 * Categorize a single finance entry based on its label, vendor, and type.
 */
export async function categorizeEntry(
  category: string,
  vendor: string | null,
  type: 'INCOME' | 'EXPENSE',
): Promise<CategorizationResult | null> {
  const results = await categorizeBatch([
    { id: '0', category, vendor, type, amountCents: '0' },
  ]);
  return results?.[0] ?? null;
}

/**
 * Categorize multiple finance entries in a single API call.
 * Max ~50 entries per batch for best results.
 */
export async function categorizeBatch(
  entries: CategorizationInput[],
): Promise<CategorizationResult[] | null> {
  const ai = getClient();
  if (!ai) return null;
  if (entries.length === 0) return [];

  const entriesText = entries
    .map(e => `- id="${e.id}" libellé="${e.category}" fournisseur="${e.vendor ?? ''}" type=${e.type} montant=${(Number(e.amountCents) / 100).toFixed(2)}€`)
    .join('\n');

  let text: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: `Classe ces écritures comptables :\n${entriesText}` }],
        },
      ],
      config: {
        systemInstruction: CATEGORIZE_PROMPT,
        maxOutputTokens: 2048,
      },
    });
    text = response.text;
  } catch (err) {
    console.error('[categorize] Gemini API error:', err instanceof Error ? err.message : err);
    return null;
  }

  if (!text) return null;

  try {
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return null;

    return parsed.map((item: { id?: string; accountCode?: string; label?: string; confidence?: number }) => {
      let accountCode = item.accountCode ? String(item.accountCode) : '658';
      if (!findCategoryByCode(accountCode)) {
        accountCode = '658'; // fallback: charges diverses
      }
      const pcg = findCategoryByCode(accountCode);
      return {
        accountCode,
        label: pcg?.label ?? item.label ?? '',
        confidence: item.confidence != null ? Math.min(100, Math.max(0, Number(item.confidence))) : 0,
      };
    });
  } catch {
    console.error('[categorize] Failed to parse AI response:', text);
    return null;
  }
}
