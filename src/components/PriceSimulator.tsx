import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Package, Truck, Shield, TrendingUp, Users, Store, Calculator, Wrench, Megaphone, Lock, ArrowUp, Pencil, Target, ChevronDown, ChevronUp, ArrowLeft, Repeat2 } from "lucide-react";
import ExcelProcessor from "./ExcelProcessor";
import { applyMargin, computePricing, computeReversePricing, fmt, type StepOverride } from "@/lib/pricing";

interface InputFieldProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  prefix?: string;
  placeholder?: string;
}

const InputField = ({ label, icon, value, onChange, suffix = "€", prefix, placeholder }: InputFieldProps) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
      {icon}
      {label}
    </label>
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>
      )}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-foreground text-right pr-10 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow placeholder:text-muted-foreground/50"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
        {suffix}
      </span>
    </div>
  </div>
);

const EditablePercent = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      onChange(parsed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        max="100"
        step="0.1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-20 text-right text-lg font-bold bg-secondary rounded px-2 py-0.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value.toFixed(1)); setEditing(true); }}
      className="text-lg font-bold text-foreground hover:text-primary cursor-pointer transition-colors"
      title="Cliquer pour modifier"
    >
      {value.toFixed(1)}%
    </button>
  );
};

/** Editable price display: shows calculated price, allows round-up & manual override */
const EditablePrice = ({ calculatedPrice, overridePrice, onOverride, roundUp, onRoundUpChange, label }: {
  calculatedPrice: number;
  overridePrice: number | null;
  onOverride: (v: number | null) => void;
  roundUp: boolean;
  onRoundUpChange: (v: boolean) => void;
  label: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const roundedPrice = Math.ceil(calculatedPrice);
  const autoPrice = roundUp ? roundedPrice : calculatedPrice;
  const displayPrice = overridePrice !== null ? overridePrice : autoPrice;
  const isManual = overridePrice !== null;
  const isRoundedUp = roundUp && roundedPrice !== calculatedPrice;
  const isOptimized = isManual || isRoundedUp;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed > 0) {
      // If user typed the auto-calculated value, treat as no override
      if (Math.abs(parsed - autoPrice) < 0.001) {
        onOverride(null);
      } else {
        onOverride(parsed);
      }
    }
    setEditing(false);
  };

  const handleRoundUpChange = (checked: boolean) => {
    onRoundUpChange(checked);
    // Clear manual override when toggling round-up
    if (checked && overridePrice !== null) {
      onOverride(null);
    }
  };

  return (
    <div className={`rounded-lg px-3 py-2 transition-colors ${isOptimized ? "bg-accent/10 border border-accent/30" : "bg-secondary/60 border border-transparent"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              min="0"
              step="0.01"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
              className="w-24 text-right text-sm font-bold bg-card rounded px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 border border-border"
            />
          ) : (
            <button
              onClick={() => { setDraft(displayPrice.toFixed(2)); setEditing(true); }}
              className={`text-sm font-bold cursor-pointer transition-colors ${isOptimized ? "text-accent" : "text-foreground hover:text-primary"}`}
              title="Cliquer pour modifier manuellement"
            >
              {fmt(displayPrice)} €
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={roundUp}
            onChange={(e) => handleRoundUpChange(e.target.checked)}
            className="rounded border-border accent-primary w-3 h-3"
          />
          <ArrowUp className="w-2.5 h-2.5" />
          Arrondir sup.
        </label>
        {isOptimized && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-accent">
            <Pencil className="w-2.5 h-2.5" />
            {isManual ? "Optimisé manuellement" : "Arrondi au supérieur"}
            {isRoundedUp && !isManual && (
              <span className="text-accent/70 ml-0.5">+{fmt(roundedPrice - calculatedPrice)} €</span>
            )}
            {isManual && (
              <button
                onClick={() => onOverride(null)}
                className="ml-1 underline hover:text-accent/80"
                title="Revenir au calcul automatique"
              >
                ✕
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  );
};

const SliderField = ({ label, icon, value, onChange, min = 0, max = 100 }: {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
      </label>
      <EditablePercent value={value} onChange={onChange} />
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={0.5}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary bg-secondary"
    />
  </div>
);

const ResultCard = ({ label, value, highlight = false, large = false, subtitle }: {
  label: string;
  value: string;
  highlight?: boolean;
  large?: boolean;
  subtitle?: string;
}) => (
  <motion.div
    initial={{ scale: 0.95, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    className={`rounded-xl p-4 ${highlight ? "bg-result text-result-foreground" : "bg-secondary"} ${large ? "col-span-full" : ""}`}
  >
    <p className={`text-xs uppercase tracking-wider ${highlight ? "text-result-foreground/60" : "text-muted-foreground"} mb-1`}>
      {label}
    </p>
    <p className={`font-bold ${large ? "text-3xl" : "text-xl"} ${highlight ? "text-highlight" : "text-foreground"}`}>
      {value}
    </p>
    {subtitle && (
      <p className={`text-sm mt-0.5 ${highlight ? "text-result-foreground/70" : "text-muted-foreground"}`}>
        {subtitle}
      </p>
    )}
  </motion.div>
);



const defaultOverride = (): StepOverride => ({ roundUp: false, manualPrice: null });

interface PriceSimulatorProps {
  onBack?: () => void;
  onRentItem?: (prixHT: number) => void;
}

export default function PriceSimulator({ onBack, onRentItem }: PriceSimulatorProps) {
  const [prixAchat, setPrixAchat] = useState("100");
  const [prixTransport, setPrixTransport] = useState("15");
  const [prixDouane, setPrixDouane] = useState("10");
  const [fraisApprocheOverride, setFraisApprocheOverride] = useState("");

  const [margeSAV, setMargeSAV] = useState(5);
  const [margeMarketing, setMargeMarketing] = useState(5);
  const [margeImportateur, setMargeImportateur] = useState(30);
  const [margeDistributeur, setMargeDistributeur] = useState(20);
  const [margeRevendeur, setMargeRevendeur] = useState(25);

  const [optimiseMode, setOptimiseMode] = useState(false);
  const [lockedPrixSortieImportateur, setLockedPrixSortieImportateur] = useState<number | null>(null);

  // Per-step overrides
  const [overrideCoutRevient, setOverrideCoutRevient] = useState<StepOverride>(defaultOverride());
  const [overrideSAV, setOverrideSAV] = useState<StepOverride>(defaultOverride());
  const [overrideMarketing, setOverrideMarketing] = useState<StepOverride>(defaultOverride());
  const [overrideImportateur, setOverrideImportateur] = useState<StepOverride>(defaultOverride());

  // Reverse pricing mode
  const [reverseMode, setReverseMode] = useState(false);
  const [prixTTCCible, setPrixTTCCible] = useState("");

  const results = useMemo(() => {
    const achat = parseFloat(prixAchat) || 0;
    const transport = parseFloat(prixTransport) || 0;
    const douane = parseFloat(prixDouane) || 0;

    const tauxFraisCalcule = achat > 0 ? ((transport + douane) / achat) * 100 : 0;
    const tauxFraisEffectif = fraisApprocheOverride !== "" ? (parseFloat(fraisApprocheOverride) || 0) : tauxFraisCalcule;

    const computed = computePricing({
      prixAchat: achat,
      tauxFraisApproche: tauxFraisEffectif,
      margeSAV,
      margeMarketing,
      margeImportateur,
      margeDistributeur,
      margeRevendeur,
      optimiseMode,
      lockedPrixSortieImportateur,
      overrideCoutRevient,
      overrideSAV,
      overrideMarketing,
      overrideImportateur,
    });

    const prixApresSAVBrut = applyMargin(computed.coutRevient, margeSAV);
    const prixApresMarketingBrut = applyMargin(computed.prixApresSAV, margeMarketing);
    const prixSortieImportateurBrut = applyMargin(computed.prixApresMarketing, computed.margeImportateurEffective);

    return {
      ...computed,
      tauxFraisCalcule,
      tauxFraisEffectif,
      prixApresSAVBrut,
      prixApresMarketingBrut,
      prixSortieImportateurBrut,
      achat,
    };
  }, [prixAchat, prixTransport, prixDouane, fraisApprocheOverride, margeSAV, margeMarketing, margeImportateur, margeDistributeur, margeRevendeur, optimiseMode, lockedPrixSortieImportateur, overrideCoutRevient, overrideSAV, overrideMarketing, overrideImportateur]);

  const reverseResults = useMemo(() => {
    const ttc = parseFloat(prixTTCCible) || 0;
    if (ttc <= 0) return null;
    return computeReversePricing({
      prixTTCCible: ttc,
      margeDistributeur,
      margeRevendeur,
      coutRevientBrut: results.coutRevientBrut,
      margeSAV,
      margeMarketing,
    });
  }, [prixTTCCible, margeDistributeur, margeRevendeur, results.coutRevientBrut, margeSAV, margeMarketing]);

  const handleOptimiseToggle = (checked: boolean) => {
    if (checked) {
      const achat = parseFloat(prixAchat) || 0;
      const transport = parseFloat(prixTransport) || 0;
      const douane = parseFloat(prixDouane) || 0;
      const tauxFraisCalcule = achat > 0 ? ((transport + douane) / achat) * 100 : 0;
      const tauxFraisEffectif = fraisApprocheOverride !== "" ? (parseFloat(fraisApprocheOverride) || 0) : tauxFraisCalcule;

      const baseResult = computePricing({
        prixAchat: achat,
        tauxFraisApproche: tauxFraisEffectif,
        margeSAV,
        margeMarketing,
        margeImportateur,
        margeDistributeur,
        margeRevendeur,
      });

      setLockedPrixSortieImportateur(baseResult.prixSortieImportateur);
    } else {
      setLockedPrixSortieImportateur(null);
    }
    setOptimiseMode(checked);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="space-y-2"
        >
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
            </button>
          )}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-semibold">
              <Calculator className="w-4 h-4" />
              Simulateur Pro
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              Simulateur de Prix Import
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Marges sur prix de vente · Prix intermédiaires éditables
            </p>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Inputs */}
          <div className="space-y-6">
            {/* Prix d'achat */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="bg-card rounded-2xl border-2 border-primary/30 p-6 shadow-sm"
            >
              <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-primary" />
                Prix d'achat
              </h2>
              <InputField label="Prix d'achat unitaire" icon={<Package className="w-3.5 h-3.5" />} value={prixAchat} onChange={setPrixAchat} />
            </motion.div>

            {/* Frais d'approche */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-muted/40 rounded-2xl border border-border p-5 space-y-4 shadow-sm"
            >
              <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Calcul du taux de frais d'approche
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Transport" icon={<Truck className="w-3.5 h-3.5" />} value={prixTransport} onChange={setPrixTransport} />
                <InputField label="Douane" icon={<Shield className="w-3.5 h-3.5" />} value={prixDouane} onChange={setPrixDouane} />
              </div>
              <div className="flex items-center justify-between bg-secondary/60 rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground">Taux calculé</span>
                <span className="text-sm font-bold text-foreground">{fmt(results.tauxFraisCalcule)} %</span>
              </div>
              <InputField
                label="Taux frais d'approche (override)"
                icon={<TrendingUp className="w-3.5 h-3.5" />}
                value={fraisApprocheOverride}
                onChange={setFraisApprocheOverride}
                suffix="%"
                placeholder={fmt(results.tauxFraisCalcule)}
              />

              {/* Coût de revient — editable price */}
              <EditablePrice
                calculatedPrice={results.coutRevientBrut}
                overridePrice={overrideCoutRevient.manualPrice}
                onOverride={(v) => setOverrideCoutRevient((prev) => ({ ...prev, manualPrice: v }))}
                roundUp={overrideCoutRevient.roundUp}
                onRoundUpChange={(v) => setOverrideCoutRevient((prev) => ({ ...prev, roundUp: v, manualPrice: null }))}
                label="➜ Coût de revient"
              />

            </motion.div>

            {/* Marges intégrées */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="bg-card rounded-2xl border border-border p-6 space-y-5 shadow-sm"
            >
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                Marges intégrées
              </h2>
              <SliderField label="Marge SAV" icon={<Wrench className="w-3.5 h-3.5" />} value={margeSAV} onChange={setMargeSAV} />
              <EditablePrice
                calculatedPrice={results.prixApresSAVBrut}
                overridePrice={overrideSAV.manualPrice}
                onOverride={(v) => setOverrideSAV((prev) => ({ ...prev, manualPrice: v }))}
                roundUp={overrideSAV.roundUp}
                onRoundUpChange={(v) => setOverrideSAV((prev) => ({ ...prev, roundUp: v, manualPrice: null }))}
                label="➜ Prix après SAV"
              />

              <SliderField label="Marge Marketing" icon={<Megaphone className="w-3.5 h-3.5" />} value={margeMarketing} onChange={setMargeMarketing} />
              <EditablePrice
                calculatedPrice={results.prixApresMarketingBrut}
                overridePrice={overrideMarketing.manualPrice}
                onOverride={(v) => setOverrideMarketing((prev) => ({ ...prev, manualPrice: v }))}
                roundUp={overrideMarketing.roundUp}
                onRoundUpChange={(v) => setOverrideMarketing((prev) => ({ ...prev, roundUp: v, manualPrice: null }))}
                label="➜ Prix après Marketing"
              />
            </motion.div>

            {/* Marges commerciales */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-card rounded-2xl border border-border p-6 space-y-5 shadow-sm"
            >
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                Marges commerciales
              </h2>

              {/* Mode optimisé toggle */}
              <div className={`rounded-lg p-3 space-y-2 transition-colors ${optimiseMode ? "bg-primary/5 border border-primary/20" : "bg-secondary/40"}`}>
                <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={optimiseMode}
                    onChange={(e) => handleOptimiseToggle(e.target.checked)}
                    className="rounded border-border accent-primary w-3.5 h-3.5"
                  />
                  <Lock className="w-3 h-3" />
                  Prix final fixe — ajuster ma marge automatiquement
                </label>
                {optimiseMode && (
                  <p className="text-[11px] text-muted-foreground ml-5.5 leading-relaxed">
                    Le prix final reste à <span className="font-semibold text-foreground">{fmt(lockedPrixSortieImportateur ?? 0)} €</span>.
                    Votre marge importateur s'ajuste : <span className="font-semibold text-primary">{fmt(results.margeImportateurEffective)} %</span>
                    {Math.abs(results.margeImportateurEffective - margeImportateur) > 0.01 && (
                      <span className="text-primary"> (base : {fmt(margeImportateur)} %)</span>
                    )}
                  </p>
                )}
              </div>

              <SliderField label="Votre marge (importateur)" icon={<TrendingUp className="w-3.5 h-3.5" />} value={optimiseMode ? results.margeImportateurEffective : margeImportateur} onChange={optimiseMode ? () => {} : setMargeImportateur} />
              <EditablePrice
                calculatedPrice={results.prixSortieImportateurBrut}
                overridePrice={overrideImportateur.manualPrice}
                onOverride={(v) => setOverrideImportateur((prev) => ({ ...prev, manualPrice: v }))}
                roundUp={overrideImportateur.roundUp}
                onRoundUpChange={(v) => setOverrideImportateur((prev) => ({ ...prev, roundUp: v, manualPrice: null }))}
                label="➜ Prix sortie importateur"
              />

              <SliderField label="Marge distributeur" icon={<Users className="w-3.5 h-3.5" />} value={margeDistributeur} onChange={setMargeDistributeur} />
              <SliderField label="Marge revendeur" icon={<Store className="w-3.5 h-3.5" />} value={margeRevendeur} onChange={setMargeRevendeur} />
            </motion.div>
          </div>

          {/* Right: Results */}
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="space-y-4"
          >
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4 shadow-sm">
              <h2 className="font-semibold text-foreground">📊 Résultats</h2>

              <div className="grid grid-cols-2 gap-3">
                <ResultCard label="Coût de revient" value={`${fmt(results.coutRevient)} €`} />
                <ResultCard label="Taux frais d'approche" value={`${fmt(results.tauxFraisEffectif)} %`} highlight />
              </div>

              <div className="border-t border-border my-2" />

              <ResultCard
                label="🎯 Votre marge globale (SAV + Mktg + Import.)"
                value={`${fmt(results.maMargePct)} %`}
                subtitle={`soit ${fmt(results.maMargeEuros)} € par unité`}
                highlight
                large
              />

              <div className="border-t border-border my-2" />

              <div className="grid grid-cols-1 gap-3">
                <ResultCard label="Prix sortie importateur (HT)" value={`${fmt(results.prixSortieImportateur)} €`} />
                <ResultCard label="Prix sortie distributeur (HT)" value={`${fmt(results.prixSortieDistributeur)} €`} />
                <ResultCard label="Prix revendeur / client final (HT)" value={`${fmt(results.prixRevendeurHT)} €`} />
              </div>

              <div className="border-t border-border my-2" />

              <ResultCard label="💰 Prix client final TTC (TVA 20%)" value={`${fmt(results.prixTTC)} €`} highlight large />
            </div>

            {/* Reverse Pricing Mode */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <button
                onClick={() => setReverseMode(!reverseMode)}
                className="w-full flex items-center justify-between text-foreground"
              >
                <h2 className="font-semibold flex items-center gap-2">
                  <Target className="w-5 h-5 text-accent" />
                  Mode Prix Cible
                </h2>
                {reverseMode ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {reverseMode && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="mt-4 space-y-4"
                >
                  <p className="text-xs text-muted-foreground">
                    Partez d'un prix client final TTC pour calculer à rebours votre prix de vente distributeur et votre marge.
                  </p>
                  <InputField
                    label="Prix cible client final TTC"
                    icon={<Target className="w-3.5 h-3.5" />}
                    value={prixTTCCible}
                    onChange={setPrixTTCCible}
                    suffix="€"
                    placeholder="Ex: 500"
                  />
                  <div className="text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
                    Marges distributeur ({fmt(margeDistributeur)}%) et revendeur ({fmt(margeRevendeur)}%) reprises du simulateur ci-contre.
                  </div>
                  {reverseResults && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <ResultCard label="Prix revendeur HT" value={`${fmt(reverseResults.prixRevendeurHT)} €`} />
                        <ResultCard label="Prix sortie distributeur" value={`${fmt(reverseResults.prixSortieDistributeur)} €`} />
                      </div>
                      <ResultCard
                        label="🎯 Prix de vente au distributeur"
                        value={`${fmt(reverseResults.prixSortieImportateur)} €`}
                        highlight
                        large
                      />
                      <ResultCard
                        label="💰 Marge globale (SAV + Mktg + Import.)"
                        value={`${fmt(reverseResults.margeGlobalePct)} %`}
                        subtitle={`soit ${fmt(reverseResults.margeGlobaleEuros)} € / unité`}
                        highlight
                      />
                      <ResultCard
                        label="🎯 Votre marge importateur nette"
                        value={`${fmt(reverseResults.margeImportateurNettePct)} %`}
                        subtitle={`soit ${fmt(reverseResults.margeImportateurNetteEuros)} € / unité (après SAV ${fmt(margeSAV)}% + Marketing ${fmt(margeMarketing)}%)`}
                        highlight
                        large
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Excel Processor */}
            <ExcelProcessor
              params={{
                tauxFraisApproche: results.tauxFraisEffectif,
                margeSAV,
                margeMarketing,
                margeImportateur,
                margeDistributeur,
                margeRevendeur,
                roundFrais: overrideCoutRevient.roundUp,
                roundSAV: overrideSAV.roundUp,
                roundMarketing: overrideMarketing.roundUp,
                roundImportateur: overrideImportateur.roundUp,
                optimiseMode,
                lockedPrixSortieImportateur,
                overrideCoutRevient,
                overrideSAV,
                overrideMarketing,
                overrideImportateur,
              }}
            />

            {/* Louer cet article */}
            {onRentItem && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-emerald-500/10 rounded-2xl border border-emerald-500/30 p-5 shadow-sm"
              >
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-2">
                  <Repeat2 className="w-5 h-5 text-emerald-500" />
                  Simuler la location de cet article
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Utilisez le prix de vente HT calculé comme base pour simuler une offre de location mensuelle.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                  {[
                    { label: "Prix sortie importateur HT", value: `${fmt(results.prixSortieImportateur)} €` },
                    { label: "Prix revendeur HT", value: `${fmt(results.prixRevendeurHT)} €` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/50 dark:bg-secondary/50 rounded-lg p-2.5">
                      <p className="text-muted-foreground">{label}</p>
                      <p className="font-bold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onRentItem(results.prixSortieImportateur)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                  >
                    <Repeat2 className="w-4 h-4" />
                    Louer au prix importateur ({fmt(results.prixSortieImportateur)} €)
                  </button>
                  <button
                    onClick={() => onRentItem(results.prixRevendeurHT)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold bg-secondary text-foreground hover:bg-secondary/80 transition-colors border border-border"
                  >
                    Prix revendeur ({fmt(results.prixRevendeurHT)} €)
                  </button>
                </div>
              </motion.div>
            )}

            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm mt-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Décomposition du prix TTC</h3>
              <div className="flex rounded-lg overflow-hidden h-8 text-xs font-medium">
                {[
                  { label: "Achat", value: results.achat, color: "bg-primary" },
                  { label: "Frais app.", value: results.coutRevient - results.achat, color: "bg-primary/60" },
                  { label: "SAV+Mktg", value: results.prixApresMarketing - results.coutRevient, color: "bg-primary/35" },
                  { label: "M. Import.", value: results.prixSortieImportateur - results.prixApresMarketing, color: "bg-accent" },
                  { label: "M. Distrib.", value: results.prixSortieDistributeur - results.prixSortieImportateur, color: "bg-accent/70" },
                  { label: "M. Revend.", value: results.prixRevendeurHT - results.prixSortieDistributeur, color: "bg-accent/40" },
                  { label: "TVA", value: results.prixTTC - results.prixRevendeurHT, color: "bg-highlight" },
                ].map((seg) => {
                  const pct = results.prixTTC > 0 ? (seg.value / results.prixTTC) * 100 : 0;
                  if (pct < 1) return null;
                  return (
                    <div
                      key={seg.label}
                      className={`${seg.color} flex items-center justify-center text-primary-foreground transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                      title={`${seg.label}: ${fmt(seg.value)} € (${pct.toFixed(1)}%)`}
                    >
                      {pct > 8 ? `${seg.label} ${pct.toFixed(0)}%` : pct > 4 ? `${pct.toFixed(0)}%` : ""}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                {[
                  { label: "Coûts", color: "bg-primary" },
                  { label: "Marges", color: "bg-accent" },
                  { label: "TVA", color: "bg-highlight" },
                ].map((l) => (
                  <span key={l.label} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
