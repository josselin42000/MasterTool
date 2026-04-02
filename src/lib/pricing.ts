/** Apply margin on selling price: price / (1 - rate) */
export const applyMargin = (price: number, ratePercent: number): number => {
  if (ratePercent >= 100) return price;
  return price / (1 - ratePercent / 100);
};

export interface StepOverride {
  roundUp: boolean;
  manualPrice: number | null;
}

export interface PricingParams {
  prixAchat: number;
  tauxFraisApproche: number;
  margeSAV: number;
  margeMarketing: number;
  margeImportateur: number;
  margeDistributeur: number;
  margeRevendeur: number;
  roundFrais?: boolean;
  roundSAV?: boolean;
  roundMarketing?: boolean;
  roundImportateur?: boolean;
  optimiseMode?: boolean;
  lockedPrixSortieImportateur?: number | null;
  overrideCoutRevient?: StepOverride;
  overrideSAV?: StepOverride;
  overrideMarketing?: StepOverride;
  overrideImportateur?: StepOverride;
}

export interface PricingResult {
  coutRevientBrut: number;
  coutRevient: number;
  prixApresSAV: number;
  prixApresMarketing: number;
  prixSortieImportateur: number;
  prixSortieDistributeur: number;
  prixRevendeurHT: number;
  prixTTC: number;
  totalRoundingGain: number;
  roundingGainPct: number;
  maMargeEuros: number;
  maMargePct: number;
  margeImportateurEffective: number;
}

export function computePricing(params: PricingParams): PricingResult {
  const {
    prixAchat, tauxFraisApproche,
    margeSAV, margeMarketing, margeImportateur,
    margeDistributeur, margeRevendeur,
    roundFrais = false,
    roundSAV = false,
    roundMarketing = false,
    roundImportateur = false,
    optimiseMode = false,
    lockedPrixSortieImportateur = null,
    overrideCoutRevient,
    overrideSAV,
    overrideMarketing,
    overrideImportateur,
  } = params;

  const coutRevientBrut = prixAchat * (1 + tauxFraisApproche / 100);

  const normalizeOverride = (override?: StepOverride): StepOverride => ({
    roundUp: override?.roundUp ?? false,
    manualPrice: override?.manualPrice ?? null,
  });

  const resolveStep = (val: number, fallbackRound: boolean, override?: StepOverride) => {
    const normalized = normalizeOverride(override);
    if (normalized.manualPrice !== null) return normalized.manualPrice;
    if (normalized.roundUp || fallbackRound) return Math.ceil(val);
    return val;
  };

  const getRoundingGain = (val: number, fallbackRound: boolean, override?: StepOverride) => {
    const normalized = normalizeOverride(override);
    if (normalized.manualPrice !== null) return 0;
    if (normalized.roundUp || fallbackRound) return Math.ceil(val) - val;
    return 0;
  };

  const coutRevient = resolveStep(coutRevientBrut, roundFrais, overrideCoutRevient);

  const prixApresSAVBrut = applyMargin(coutRevient, margeSAV);
  const prixApresSAV = resolveStep(prixApresSAVBrut, roundSAV, overrideSAV);

  const prixApresMarketingBrut = applyMargin(prixApresSAV, margeMarketing);
  const prixApresMarketing = resolveStep(prixApresMarketingBrut, roundMarketing, overrideMarketing);

  const prixApresSAVOptimise = applyMargin(coutRevientBrut, margeSAV);
  const prixApresMarketingOptimise = applyMargin(prixApresSAVOptimise, margeMarketing);

  let margeImportateurEffective = margeImportateur;
  if (optimiseMode && lockedPrixSortieImportateur && lockedPrixSortieImportateur > 0) {
    margeImportateurEffective = (1 - prixApresMarketingOptimise / lockedPrixSortieImportateur) * 100;
  }

  const prixSortieImportateurBrut = applyMargin(prixApresMarketing, margeImportateurEffective);
  const prixSortieImportateur = resolveStep(prixSortieImportateurBrut, roundImportateur, overrideImportateur);

  const totalRoundingGain =
    getRoundingGain(coutRevientBrut, roundFrais, overrideCoutRevient) +
    getRoundingGain(prixApresSAVBrut, roundSAV, overrideSAV) +
    getRoundingGain(prixApresMarketingBrut, roundMarketing, overrideMarketing) +
    getRoundingGain(prixSortieImportateurBrut, roundImportateur, overrideImportateur);

  const prixSortieDistributeur = applyMargin(prixSortieImportateur, margeDistributeur);
  const prixRevendeurHT = applyMargin(prixSortieDistributeur, margeRevendeur);
  const prixTTC = prixRevendeurHT * 1.2;

  const maMargeEuros = prixSortieImportateur - coutRevientBrut;
  const maMargePct = prixSortieImportateur > 0 ? (maMargeEuros / prixSortieImportateur) * 100 : 0;

  const roundingGainPct = prixRevendeurHT > 0 ? (totalRoundingGain / prixRevendeurHT) * 100 : 0;

  return {
    coutRevientBrut, coutRevient,
    prixApresSAV, prixApresMarketing,
    prixSortieImportateur, prixSortieDistributeur,
    prixRevendeurHT, prixTTC,
    totalRoundingGain, roundingGainPct,
    maMargeEuros, maMargePct,
    margeImportateurEffective,
  };
}

export const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface ReversePricingParams {
  prixTTCCible: number;
  margeDistributeur: number;
  margeRevendeur: number;
  coutRevientBrut: number;
  margeSAV: number;
  margeMarketing: number;
}

export interface ReversePricingResult {
  prixRevendeurHT: number;
  prixSortieDistributeur: number;
  prixSortieImportateur: number;
  prixApresMarketing: number;
  margeGlobaleEuros: number;
  margeGlobalePct: number;
  margeImportateurNetteEuros: number;
  margeImportateurNettePct: number;
}

/** Reverse calculation: from target TTC price, derive importer selling price and margin */
export function computeReversePricing(params: ReversePricingParams): ReversePricingResult {
  const { prixTTCCible, margeDistributeur, margeRevendeur, coutRevientBrut, margeSAV, margeMarketing } = params;

  const prixRevendeurHT = prixTTCCible / 1.2;
  const prixSortieDistributeur = prixRevendeurHT * (1 - margeRevendeur / 100);
  const prixSortieImportateur = prixSortieDistributeur * (1 - margeDistributeur / 100);

  // Forward: cost base including SAV + Marketing
  const prixApresMarketing = applyMargin(applyMargin(coutRevientBrut, margeSAV), margeMarketing);

  // Global margin (everything above cost)
  const margeGlobaleEuros = prixSortieImportateur - coutRevientBrut;
  const margeGlobalePct = prixSortieImportateur > 0
    ? (margeGlobaleEuros / prixSortieImportateur) * 100
    : 0;

  // Net importer margin (after SAV + Marketing are covered)
  const margeImportateurNetteEuros = prixSortieImportateur - prixApresMarketing;
  const margeImportateurNettePct = prixSortieImportateur > 0
    ? (margeImportateurNetteEuros / prixSortieImportateur) * 100
    : 0;

  return {
    prixRevendeurHT,
    prixSortieDistributeur,
    prixSortieImportateur,
    prixApresMarketing,
    margeGlobaleEuros,
    margeGlobalePct,
    margeImportateurNetteEuros,
    margeImportateurNettePct,
  };
}