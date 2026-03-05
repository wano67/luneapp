export type BankType = 'TRADITIONAL' | 'ONLINE' | 'NEOBANK';

export type Bank = {
  code: string;
  name: string;
  shortName: string;
  type: BankType;
  websiteUrl: string;
};

export const BANKS: Bank[] = [
  // Traditionnelles
  { code: 'BNP',            name: 'BNP Paribas',          shortName: 'BNP',              type: 'TRADITIONAL', websiteUrl: 'https://mabanque.bnpparibas' },
  { code: 'SG',             name: 'Société Générale',      shortName: 'SG',               type: 'TRADITIONAL', websiteUrl: 'https://www.societegenerale.fr' },
  { code: 'CA',             name: 'Crédit Agricole',       shortName: 'Crédit Agricole',  type: 'TRADITIONAL', websiteUrl: 'https://www.credit-agricole.fr' },
  { code: 'CM',             name: 'Crédit Mutuel',         shortName: 'Crédit Mutuel',    type: 'TRADITIONAL', websiteUrl: 'https://www.creditmutuel.fr' },
  { code: 'BP',             name: 'Banque Populaire',      shortName: 'Banque Pop',       type: 'TRADITIONAL', websiteUrl: 'https://www.banquepopulaire.fr' },
  { code: 'CE',             name: "Caisse d'Épargne",      shortName: "Caisse d'Ép.",     type: 'TRADITIONAL', websiteUrl: 'https://www.caisse-epargne.fr' },
  { code: 'LBP',            name: 'La Banque Postale',     shortName: 'La Postale',       type: 'TRADITIONAL', websiteUrl: 'https://www.labanquepostale.fr' },
  { code: 'LCL',            name: 'LCL',                   shortName: 'LCL',              type: 'TRADITIONAL', websiteUrl: 'https://www.lcl.fr' },
  { code: 'CIC',            name: 'CIC',                   shortName: 'CIC',              type: 'TRADITIONAL', websiteUrl: 'https://www.cic.fr' },
  { code: 'HSBC',           name: 'HSBC France',           shortName: 'HSBC',             type: 'TRADITIONAL', websiteUrl: 'https://www.hsbc.fr' },

  // Banques en ligne
  { code: 'BOURSOBANK',     name: 'BoursoBank',            shortName: 'BoursoBank',       type: 'ONLINE', websiteUrl: 'https://www.boursobank.com' },
  { code: 'FORTUNEO',       name: 'Fortuneo',              shortName: 'Fortuneo',         type: 'ONLINE', websiteUrl: 'https://www.fortuneo.fr' },
  { code: 'BFORBANK',       name: 'BforBank',              shortName: 'BforBank',         type: 'ONLINE', websiteUrl: 'https://www.bforbank.com' },
  { code: 'HELLOBANK',      name: 'Hello bank!',           shortName: 'Hello bank!',      type: 'ONLINE', websiteUrl: 'https://www.hellobank.fr' },
  { code: 'MONABANQ',       name: 'Monabanq',              shortName: 'Monabanq',         type: 'ONLINE', websiteUrl: 'https://www.monabanq.com' },

  // Néobanques
  { code: 'REVOLUT',        name: 'Revolut',               shortName: 'Revolut',          type: 'NEOBANK', websiteUrl: 'https://www.revolut.com' },
  { code: 'N26',            name: 'N26',                   shortName: 'N26',              type: 'NEOBANK', websiteUrl: 'https://n26.com' },
  { code: 'LYDIA',          name: 'Lydia',                 shortName: 'Lydia',            type: 'NEOBANK', websiteUrl: 'https://www.lydia-app.com' },
  { code: 'NICKEL',         name: 'Nickel',                shortName: 'Nickel',           type: 'NEOBANK', websiteUrl: 'https://www.nickel.eu' },
  { code: 'MA_FRENCH_BANK', name: 'Ma French Bank',        shortName: 'MFB',              type: 'NEOBANK', websiteUrl: 'https://www.mafrenchbank.fr' },
  { code: 'ORANGE_BANK',    name: 'Orange Bank',           shortName: 'Orange Bank',      type: 'NEOBANK', websiteUrl: 'https://www.orangebank.fr' },
];

export const BANK_MAP = new Map(BANKS.map((b) => [b.code, b]));

export const BANK_TYPE_LABEL: Record<BankType, string> = {
  TRADITIONAL: 'Banques traditionnelles',
  ONLINE: 'Banques en ligne',
  NEOBANK: 'Néobanques',
};
