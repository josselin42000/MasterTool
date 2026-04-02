import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Calculator, TrendingUp, Shield, Wrench, Clock, ChevronDown, ChevronUp,
  Zap, BarChart3, ArrowLeft, Info, Copy, Check, Sun, Moon, FileDown
} from "lucide-react";
import { fmt } from "@/lib/pricing";

interface LeasingParams {
  prixHT: number; tauxAnnuel: number; dureeSelectionnee: number;
  vrEuros: number; serviceEuros: number; assurancePct: number;
  appPremium: number; optionSortie6: boolean; optionSortie12: boolean;
}

interface LeasingResult {
  loyerFinancier: number; loyerService: number; loyerAssurance: number;
  loyerApp: number; loyerTotal: number; loyerTotalTTC: number; vr: number;
  totalLoyers: number; totalEncaisse: number;
  totalLoyersTTC: number; totalAvecVR: number;
  surcout: number; surcoutPct: number; coeff: number;
  loyerSortie6?: number; loyerSortie12?: number; vr6?: number; vr12?: number;
}

interface AmortRow {
  mois: number; capitalDebut: number; interets: number;
  amortissement: number; capitalFin: number; pctRembourse: number;
}

function computeLeasing(p: LeasingParams): LeasingResult {
  const { prixHT, tauxAnnuel, dureeSelectionnee: n, vrEuros, serviceEuros, assurancePct, appPremium } = p;
  const tm = tauxAnnuel / 12 / 100;
  const vr = vrEuros;
  const loyerFinancier = tm > 0
    ? (prixHT - vr / Math.pow(1 + tm, n)) * tm / (1 - Math.pow(1 + tm, -n))
    : (prixHT - vr) / n;
  const coeff = prixHT > 0 ? loyerFinancier / prixHT : 0;
  const loyerAssurance = prixHT * assurancePct / 100 / 12;
  const loyerTotal = loyerFinancier + serviceEuros + loyerAssurance + appPremium;
  const loyerTotalTTC = loyerTotal * 1.2;
  const totalLoyers = loyerTotal * n;
  const totalEncaisse = totalLoyers + vr;
  const totalLoyersTTC = loyerTotalTTC * n;
  const totalAvecVR = totalLoyersTTC + vr;
  const surcout = totalEncaisse - prixHT;
  const surcoutPct = prixHT > 0 ? (surcout / prixHT) * 100 : 0;
  const cs = (nC: number, vrP: number) => {
    const tm2 = 0.12 / 12; const vrC = prixHT * vrP / 100;
    const L = (prixHT - vrC / Math.pow(1 + tm2, nC)) * tm2 / (1 - Math.pow(1 + tm2, -nC));
    return { loyer: L + serviceEuros + loyerAssurance + appPremium, vr: vrC };
  };
  const s6 = cs(6, 82); const s12 = cs(12, 68);
  const r = (v: number) => Math.round(v * 100) / 100;
  return {
    loyerFinancier: r(loyerFinancier), loyerService: serviceEuros,
    loyerAssurance: r(loyerAssurance), loyerApp: appPremium,
    loyerTotal: r(loyerTotal), loyerTotalTTC: r(loyerTotalTTC), vr: r(vr),
    totalLoyers: r(totalLoyers), totalEncaisse: r(totalEncaisse),
    totalLoyersTTC: r(totalLoyersTTC), totalAvecVR: r(totalAvecVR),
    surcout: r(surcout), surcoutPct: Math.round(surcoutPct * 10) / 10,
    coeff: Math.round(coeff * 1000000) / 1000000,
    loyerSortie6: p.optionSortie6 ? r(s6.loyer) : undefined,
    loyerSortie12: p.optionSortie12 ? r(s12.loyer) : undefined,
    vr6: p.optionSortie6 ? r(s6.vr) : undefined,
    vr12: p.optionSortie12 ? r(s12.vr) : undefined,
  };
}

function computeVRFromLoyerCible(prixHT: number, tauxAnnuel: number, n: number, loyerFinCible: number): number {
  const tm = tauxAnnuel / 12 / 100;
  if (tm <= 0) return Math.max(0, prixHT - loyerFinCible * n);
  const factor = tm / (1 - Math.pow(1 + tm, -n));
  return Math.max(0, Math.round((prixHT - loyerFinCible / factor) * Math.pow(1 + tm, n) * 100) / 100);
}

function computeAmort(prixHT: number, tauxAnnuel: number, duree: number, loyerFin: number): AmortRow[] {
  const tm = tauxAnnuel / 12 / 100;
  const rows: AmortRow[] = [];
  let cap = prixHT;
  for (let i = 1; i <= duree; i++) {
    const int = Math.round(cap * tm * 100) / 100;
    const am = Math.round((loyerFin - int) * 100) / 100;
    const cf = Math.round(Math.max(cap - am, 0) * 100) / 100;
    rows.push({ mois: i, capitalDebut: cap, interets: int, amortissement: am, capitalFin: cf, pctRembourse: Math.round((1 - cf / prixHT) * 1000) / 10 });
    cap = cf;
  }
  return rows;
}

const DUREES = [12, 24, 36, 48, 60];
const VR_MAP: Record<number, number> = { 12: 12, 24: 8, 36: 5, 48: 3, 60: 1 };
type VRMode = "auto" | "pct" | "montant" | "loyerCible";

export default function LeasingSimulator({ initialPrixHT, onBack }: { initialPrixHT?: number; onBack: () => void }) {
  const [prixHT, setPrixHT] = useState(initialPrixHT?.toFixed(2) ?? "490.00");
  const [tauxAnnuel, setTauxAnnuel] = useState("8");
  const [duree, setDuree] = useState(36);
  const [vrMode, setVrMode] = useState<VRMode>("auto");
  const [vrPct, setVrPct] = useState(5);
  const [vrMontant, setVrMontant] = useState("");
  const [loyerCible, setLoyerCible] = useState("");
  const [serviceEuros, setServiceEuros] = useState("8");
  const [assurancePct, setAssurancePct] = useState("1.5");
  const [appPremium, setAppPremium] = useState("0");
  const [optionSortie6, setOptionSortie6] = useState(false);
  const [optionSortie12, setOptionSortie12] = useState(false);
  const [showAmort, setShowAmort] = useState(false);
  const [showAllAmort, setShowAllAmort] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);

  const prixHTNum = parseFloat(prixHT) || 0;
  const tauxNum = parseFloat(tauxAnnuel) || 0;
  const serviceParsed = parseFloat(serviceEuros) || 0;
  const assuranceParsed = parseFloat(assurancePct) || 0;
  const appParsed = parseFloat(appPremium) || 0;

  const handleDureeChange = (d: number) => {
    setDuree(d);
    if (vrMode === "auto") setVrPct(VR_MAP[d] ?? 5);
  };

  const vrEuros = useMemo(() => {
    if (vrMode === "montant") return parseFloat(vrMontant) || 0;
    if (vrMode === "loyerCible") {
      const lc = parseFloat(loyerCible) || 0;
      const extra = serviceParsed + (prixHTNum * assuranceParsed / 100 / 12) + appParsed;
      return computeVRFromLoyerCible(prixHTNum, tauxNum, duree, Math.max(0, lc - extra));
    }
    return prixHTNum * vrPct / 100;
  }, [vrMode, vrMontant, loyerCible, vrPct, prixHTNum, tauxNum, duree, serviceParsed, assuranceParsed, appParsed]);

  const vrPctEff = prixHTNum > 0 ? (vrEuros / prixHTNum) * 100 : 0;

  const params: LeasingParams = {
    prixHT: prixHTNum, tauxAnnuel: tauxNum, dureeSelectionnee: duree,
    vrEuros, serviceEuros: serviceParsed, assurancePct: assuranceParsed,
    appPremium: appParsed, optionSortie6, optionSortie12,
  };

  const result = useMemo(() => computeLeasing(params),
    [prixHT, tauxAnnuel, duree, vrEuros, serviceEuros, assurancePct, appPremium, optionSortie6, optionSortie12]);

  const amortRows = useMemo(() => computeAmort(prixHTNum, tauxNum, duree, result.loyerFinancier),
    [prixHT, tauxAnnuel, duree, result.loyerFinancier]);

  const visibleRows = showAllAmort ? amortRows : amortRows.filter((_, i, arr) =>
    i < 3 || i === Math.floor(arr.length / 3) || i === Math.floor(2 * arr.length / 3) || i >= arr.length - 3);

  const downloadAmortPDF = () => {
    const rows = amortRows;
    const totalInterets = rows.reduce((s, r) => s + r.interets, 0);
    const totalAmort = rows.reduce((s, r) => s + r.amortissement, 0);
    const totalLoyer = rows.reduce((s, r) => s + r.interets + r.amortissement, 0);

    const tableRows = rows.map((row, i) => {
      const isFirst = i === 0;
      const isLast = i === rows.length - 1;
      const bg = isFirst || isLast ? "#e8f5e9" : i % 2 === 0 ? "#f9f9f9" : "#ffffff";
      return `
        <tr style="background:${bg}">
          <td style="padding:5px 10px;border-bottom:1px solid #e5e7eb;font-weight:${isFirst||isLast?"600":"400"}">
            M${String(row.mois).padStart(2,"0")}
          </td>
          <td style="padding:5px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(row.capitalDebut)} €</td>
          <td style="padding:5px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#ef4444">${fmt(row.interets)} €</td>
          <td style="padding:5px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#16a34a">${fmt(row.amortissement)} €</td>
          <td style="padding:5px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:${isFirst||isLast?"600":"400"}">${fmt(row.capitalFin)} €</td>
          <td style="padding:5px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#6b7280">${row.pctRembourse}%</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="fr"><head>
      <meta charset="UTF-8"/>
      <title>Tableau d'amortissement — ${duree} mois</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 24px; }
        .header { margin-bottom: 20px; }
        .header h1 { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 4px; }
        .header p { font-size: 11px; color: #6b7280; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
        .summary-card { background: #f3f4f6; border-radius: 8px; padding: 10px 12px; }
        .summary-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 3px; }
        .summary-card .value { font-size: 14px; font-weight: 700; color: #111; }
        .summary-card.green { background: #d1fae5; }
        .summary-card.green .value { color: #065f46; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #1d4ed8; color: white; }
        thead th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; }
        thead th:not(:first-child) { text-align: right; }
        tfoot tr { background: #1e3a5f; color: white; }
        tfoot td { padding: 7px 10px; font-weight: 700; font-size: 10px; }
        tfoot td:not(:first-child) { text-align: right; }
        .footer { margin-top: 16px; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; display: flex; justify-content: space-between; }
        @page { margin: 15mm; size: A4 portrait; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <div class="header">
        <h1>Tableau d'amortissement — ${duree} mois</h1>
        <p>Article : ${fmt(prixHTNum)} € HT · Taux : ${tauxNum}%/an · VR : ${fmt(result.vr)} € (${fmt(vrPctEff)}%) · Généré le ${new Date().toLocaleDateString("fr-FR")}</p>
      </div>
      <div class="summary">
        <div class="summary-card">
          <div class="label">Loyer financier</div>
          <div class="value">${fmt(result.loyerFinancier)} €/mois</div>
        </div>
        <div class="summary-card">
          <div class="label">Loyer total HT</div>
          <div class="value">${fmt(result.loyerTotal)} €/mois</div>
        </div>
        <div class="summary-card">
          <div class="label">Total intérêts</div>
          <div class="value" style="color:#ef4444">${fmt(totalInterets)} €</div>
        </div>
        <div class="summary-card green">
          <div class="label">VR / Capital résiduel</div>
          <div class="value">${fmt(result.vr)} €</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Mois</th>
            <th style="text-align:right">Capital début</th>
            <th style="text-align:right">Intérêts</th>
            <th style="text-align:right">Amortissement</th>
            <th style="text-align:right">Capital fin</th>
            <th style="text-align:right">% remb.</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr>
            <td>TOTAL (${duree} mois)</td>
            <td></td>
            <td style="color:#fca5a5">${fmt(totalInterets)} €</td>
            <td style="color:#6ee7b7">${fmt(totalAmort)} €</td>
            <td></td>
            <td style="color:#6ee7b7">100%</td>
          </tr>
        </tfoot>
      </table>
      <div class="footer">
        <span>Cost Cruiser Pro — Simulateur de Location</span>
        <span>Total loyers financiers : ${fmt(totalLoyer)} € · VR : ${fmt(result.vr)} € · Coût total si rachat : ${fmt(result.totalAvecVR)} € TTC</span>
      </div>
    </body></html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const handleCopy = () => {
    const t = [
      `=== SIMULATION LOCATION ===`,
      `Article : ${fmt(prixHTNum)} € HT (${fmt(prixHTNum * 1.2)} € TTC)`,
      `Durée : ${duree} mois | Taux : ${tauxNum}%/an | VR : ${fmt(vrEuros)} € (${fmt(vrPctEff)}%)`,
      ``,
      `Loyer mensuel HT : ${fmt(result.loyerTotal)} €  (TTC : ${fmt(result.loyerTotalTTC)} €)`,
      `  Financier : ${fmt(result.loyerFinancier)} €  Service : ${fmt(result.loyerService)} €  Assurance : ${fmt(result.loyerAssurance)} €`,
      ``,
      `Total loyers TTC (${duree} mois) : ${fmt(result.totalLoyersTTC)} €`,
      `Coût total si rachat (loyers TTC + VR) : ${fmt(result.totalAvecVR)} €`,
      `Surcoût vs achat HT : +${fmt(result.surcout)} € (+${result.surcoutPct}%)`,
    ].join("\n");
    navigator.clipboard.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const segments = [
    { label: "Financier", value: result.loyerFinancier, color: "bg-primary" },
    { label: "Service", value: result.loyerService, color: "bg-blue-500" },
    { label: "Assurance", value: result.loyerAssurance, color: "bg-emerald-500" },
    { label: "App", value: result.loyerApp, color: "bg-purple-500" },
  ].filter(s => s.value > 0);

  const inputCls = "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-foreground text-right focus:outline-none focus:ring-2 transition-shadow";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 transition-colors">
      <div className="max-w-5xl mx-auto space-y-6">

        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
            <button onClick={() => setDark(!dark)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground" title="Basculer dark mode">
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-600 rounded-full px-4 py-1.5 text-sm font-semibold">
              <Calculator className="w-4 h-4" /> Calculateur de Loyer
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Simulateur de Location</h1>
            <p className="text-muted-foreground">Loyer mensuel · VR configurable · Coût total · Amortissement</p>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── LEFT ── */}
          <div className="space-y-5">

            {/* Prix base */}
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.05 }}
              className="bg-card rounded-2xl border-2 border-emerald-500/30 p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-500" /> Prix de base
              </h2>
              {initialPrixHT && (
                <div className="flex items-center gap-2 bg-emerald-500/10 rounded-lg px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                  <Zap className="w-3.5 h-3.5" /> Prix importé : {fmt(initialPrixHT)} €
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">Prix HT de l'article</label>
                <div className="relative">
                  <input type="number" min="0" step="0.01" value={prixHT} onChange={e => setPrixHT(e.target.value)}
                    className={inputCls + " pr-10 focus:ring-emerald-500/40"} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">€</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">TTC : {fmt(prixHTNum * 1.2)} €</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">Taux financier annuel</label>
                <div className="relative">
                  <input type="number" min="0" max="30" step="0.5" value={tauxAnnuel} onChange={e => setTauxAnnuel(e.target.value)}
                    className={inputCls + " pr-14 focus:ring-emerald-500/40"} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">%/an</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Taux mensuel : {fmt(tauxNum / 12)} %</p>
              </div>
            </motion.div>

            {/* Durée */}
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }}
              className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Durée du contrat
              </h2>
              <div className="grid grid-cols-5 gap-2">
                {DUREES.map(d => (
                  <button key={d} onClick={() => handleDureeChange(d)}
                    className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${duree === d ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}>
                    {d}m
                  </button>
                ))}
              </div>
            </motion.div>

            {/* VR — 4 modes */}
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.15 }}
              className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-500" /> Valeur Résiduelle (VR)
              </h2>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { id: "auto" as VRMode, label: "Auto (durée)", hint: "VR suggérée selon durée" },
                  { id: "pct" as VRMode, label: "% personnalisé", hint: "Saisir un % + slider" },
                  { id: "montant" as VRMode, label: "Montant € fixe", hint: "Saisir la VR en euros" },
                  { id: "loyerCible" as VRMode, label: "Loyer cible →VR", hint: "Calculer la VR inverse" },
                ]).map(({ id, label, hint }) => (
                  <button key={id} onClick={() => setVrMode(id)}
                    className={`rounded-lg p-2.5 text-left transition-all border ${vrMode === id ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400" : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary"}`}>
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="text-[10px] opacity-70 mt-0.5">{hint}</p>
                  </button>
                ))}
              </div>

              {(vrMode === "auto" || vrMode === "pct") && (
                <div className="space-y-2">
                  {vrMode === "pct" && (
                    <div className="relative mb-2">
                      <input type="number" min="0" max="100" step="0.5" value={vrPct}
                        onChange={e => setVrPct(parseFloat(e.target.value) || 0)}
                        className={inputCls + " pr-10 focus:ring-amber-500/40"} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">%</span>
                    </div>
                  )}
                  <input type="range" min={0} max={50} step={0.5} value={vrPct}
                    onChange={e => { setVrPct(parseFloat(e.target.value)); if (vrMode === "auto") setVrMode("pct"); }}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-amber-500 bg-secondary" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span>
                    <span className="font-bold text-foreground">{vrPct}% = {fmt(vrEuros)} €</span>
                    <span>50%</span>
                  </div>
                  {vrMode === "auto" && <p className="text-xs text-muted-foreground">Suggéré pour {duree}m : {VR_MAP[duree] ?? 5}%</p>}
                </div>
              )}

              {vrMode === "montant" && (
                <div className="space-y-2">
                  <div className="relative">
                    <input type="number" min="0" step="1" value={vrMontant}
                      onChange={e => setVrMontant(e.target.value)}
                      placeholder={fmt(prixHTNum * 0.05)}
                      className={inputCls + " pr-10 border-amber-500/40 focus:ring-amber-500/40"} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">€</span>
                  </div>
                  <p className="text-xs text-muted-foreground">= {fmt(vrPctEff)}% du prix HT</p>
                  {(parseFloat(vrMontant) || 0) > prixHTNum * 0.5 && (
                    <p className="text-xs text-amber-600">⚠ VR élevée → loyer réduit mais rachat plus coûteux</p>
                  )}
                </div>
              )}

              {vrMode === "loyerCible" && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Loyer mensuel HT cible (tout compris)</label>
                  <div className="relative">
                    <input type="number" min="0" step="0.5" value={loyerCible}
                      onChange={e => setLoyerCible(e.target.value)}
                      placeholder="Ex: 19.90"
                      className={inputCls + " pr-16 border-amber-500/40 focus:ring-amber-500/40"} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">€/mois</span>
                  </div>
                  {parseFloat(loyerCible) > 0 && (
                    <div className="bg-amber-500/10 rounded-lg p-3 space-y-1 text-xs border border-amber-500/20">
                      <p className="text-amber-700 dark:text-amber-400 font-semibold">VR calculée : {fmt(vrEuros)} € ({fmt(vrPctEff)}%)</p>
                      <p className="text-muted-foreground">Pour {fmt(parseFloat(loyerCible))} €/mois, la VR doit être {fmt(vrEuros)} €</p>
                      {vrEuros > prixHTNum * 0.6 && <p className="text-red-500">⚠ VR très élevée — vérifier la cohérence</p>}
                      {vrEuros <= 0 && <p className="text-red-500">⚠ Loyer cible trop bas pour ce prix / taux / durée</p>}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                <span className="text-xs text-muted-foreground font-medium">VR retenue</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{fmt(vrEuros)} € ({fmt(vrPctEff)}%)</span>
              </div>
            </motion.div>

            {/* Composantes */}
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}
              className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-500" /> Composantes du loyer
              </h2>
              {[
                { label: "Service / maintenance", value: serviceEuros, onChange: setServiceEuros, suffix: "€/mois", hint: "SAV, remplacement, garantie" },
                { label: "Assurance (%/an du prix HT)", value: assurancePct, onChange: setAssurancePct, suffix: "%/an", hint: `= ${fmt(prixHTNum * assuranceParsed / 100 / 12)} €/mois` },
                { label: "App / services premium", value: appPremium, onChange: setAppPremium, suffix: "€/mois", hint: "Wi-Fi, stats, API…" },
              ].map(({ label, value, onChange, suffix, hint }) => (
                <div key={label}>
                  <label className="text-sm font-medium text-muted-foreground block mb-1.5">{label}</label>
                  <div className="relative">
                    <input type="number" min="0" step="0.01" value={value} onChange={e => onChange(e.target.value)}
                      className={inputCls + " pr-16 focus:ring-blue-500/40"} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">{suffix}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{hint}</p>
                </div>
              ))}
            </motion.div>

            {/* Sortie anticipée */}
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.25 }}
              className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-3">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" /> Options de sortie anticipée
              </h2>
              <p className="text-xs text-muted-foreground">Taux majoré 12%/an — loyer plus élevé, flexibilité garantie</p>
              {[
                { label: "Option sortie 6 mois", checked: optionSortie6, onChange: setOptionSortie6, vr: "82% HT", s: "+30%" },
                { label: "Option sortie 12 mois", checked: optionSortie12, onChange: setOptionSortie12, vr: "68% HT", s: "+17%" },
              ].map(({ label, checked, onChange, vr: vd, s }) => (
                <label key={label} className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors border ${checked ? "bg-orange-500/10 border-orange-500/20" : "bg-secondary/40 border-transparent"}`}>
                  <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 rounded accent-orange-500 w-4 h-4 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">VR si exercée : {vd} · Loyer : {s} vs standard</p>
                  </div>
                </label>
              ))}
            </motion.div>
          </div>

          {/* ── RIGHT ── */}
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="space-y-4">

            {/* Main result */}
            <div className="bg-card rounded-2xl border-2 border-emerald-500/40 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-500" /> Résultat
                </h2>
                <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-secondary rounded-lg px-3 py-1.5 transition-colors">
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copié</> : <><Copy className="w-3.5 h-3.5" /> Copier résumé</>}
                </button>
              </div>

              <div className="bg-emerald-500/10 rounded-xl p-5 text-center">
                <p className="text-xs uppercase tracking-wider text-emerald-600 mb-1">Loyer mensuel HT</p>
                <p className="text-5xl font-bold text-emerald-600">{fmt(result.loyerTotal)} €</p>
                <p className="text-sm text-muted-foreground mt-1">{fmt(result.loyerTotalTTC)} € TTC / mois</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Décomposition loyer HT</p>
                {segments.map(seg => (
                  <div key={seg.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className={`w-2 h-2 rounded-full ${seg.color}`} />
                      {seg.label}
                    </span>
                    <span className="font-medium text-foreground">{fmt(seg.value)} €</span>
                  </div>
                ))}
                <div className="flex rounded-md overflow-hidden h-5 mt-1">
                  {segments.map(seg => {
                    const pct = result.loyerTotal > 0 ? (seg.value / result.loyerTotal) * 100 : 0;
                    return pct > 0 ? (
                      <div key={seg.label} className={`${seg.color} flex items-center justify-center text-[10px] text-white font-medium transition-all`}
                        style={{ width: `${pct}%` }}>{pct > 14 ? seg.label : ""}</div>
                    ) : null;
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 bg-secondary">
                  <p className="text-xs text-muted-foreground mb-0.5">Coefficient</p>
                  <p className="text-sm font-bold text-foreground">{result.coeff.toFixed(6)}</p>
                </div>
                <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-muted-foreground mb-0.5">VR retenue</p>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{fmt(result.vr)} €</p>
                </div>
              </div>

              {/* ── Coût total bloc ── */}
              <div className="bg-secondary/60 rounded-xl p-4 space-y-2.5 border border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coût total sur {duree} mois</p>
                {[
                  { label: `Loyers cumulés HT (${duree} × ${fmt(result.loyerTotal)} €)`, value: fmt(result.totalLoyers) + " €", highlight: false, bold: false },
                  { label: `Loyers cumulés TTC (${duree} × ${fmt(result.loyerTotalTTC)} €)`, value: fmt(result.totalLoyersTTC) + " €", highlight: false, bold: false },
                  { label: `VR — rachat en fin de contrat`, value: fmt(result.vr) + " €", highlight: false, bold: false },
                  { label: "💰 Coût total si rachat (loyers TTC + VR)", value: fmt(result.totalAvecVR) + " €", highlight: true, bold: true },
                  { label: `Surcoût vs achat HT`, value: `+${fmt(result.surcout)} € (+${result.surcoutPct}%)`, highlight: false, bold: false },
                ].map(({ label, value, highlight, bold }, i) => (
                  <div key={i} className={`flex items-start justify-between gap-2 ${highlight ? "pt-2.5 border-t border-border" : ""}`}>
                    <p className={`text-xs ${bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</p>
                    <p className={`text-sm flex-shrink-0 ${bold ? "font-bold text-primary" : "font-medium text-foreground"}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Comparatif */}
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" /> Comparatif toutes durées
              </h3>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      {["Durée","VR","Loyer HT","Loyer TTC","Total TTC","Rachat (TTC+VR)"].map((h, i) => (
                        <th key={h} className={`pb-2 font-medium px-1 ${i === 0 ? "text-left" : "text-right"} ${i === 5 ? "text-primary" : ""}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DUREES.map(d => {
                      const vr_e = (vrMode === "auto") ? prixHTNum * (VR_MAP[d] ?? 5) / 100
                        : (vrMode === "pct") ? prixHTNum * vrPct / 100
                        : vrEuros;
                      const r = computeLeasing({ ...params, dureeSelectionnee: d, vrEuros: vr_e });
                      const isSelected = d === duree;
                      const vrPctRow = prixHTNum > 0 ? (vr_e / prixHTNum * 100).toFixed(0) : "0";
                      return (
                        <tr key={d}
                          className={`border-b border-border/50 cursor-pointer hover:bg-secondary/50 transition-colors ${isSelected ? "bg-primary/5 font-semibold" : ""}`}
                          onClick={() => handleDureeChange(d)}>
                          <td className="py-1.5 px-1">{isSelected && <span className="text-primary mr-1">▶</span>}{d}m</td>
                          <td className="py-1.5 px-1 text-right text-muted-foreground">{vrPctRow}%</td>
                          <td className={`py-1.5 px-1 text-right ${isSelected ? "text-emerald-600" : ""}`}>{fmt(r.loyerTotal)} €</td>
                          <td className="py-1.5 px-1 text-right text-muted-foreground">{fmt(r.loyerTotalTTC)} €</td>
                          <td className="py-1.5 px-1 text-right text-muted-foreground">{fmt(r.totalLoyersTTC)} €</td>
                          <td className="py-1.5 px-1 text-right font-bold text-primary">{fmt(r.totalAvecVR)} €</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                "Rachat (TTC+VR)" = coût réel total si le client rachète l'article en fin de contrat
              </p>
            </div>

            {/* Sortie anticipée résultats */}
            {(optionSortie6 || optionSortie12) && (
              <div className="bg-card rounded-2xl border border-orange-500/30 p-5 shadow-sm space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" /> Loyers options sortie anticipée
                </h3>
                {[
                  { active: optionSortie6, label: "Sortie 6 mois", loyer: result.loyerSortie6, vr: result.vr6 },
                  { active: optionSortie12, label: "Sortie 12 mois", loyer: result.loyerSortie12, vr: result.vr12 },
                ].filter(o => o.active && o.loyer).map(o => (
                  <div key={o.label} className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold text-orange-600 uppercase">{o.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">VR si exercée : {fmt(o.vr ?? 0)} €</p>
                        <p className="text-xs text-muted-foreground">Si non exercée → {fmt(result.loyerTotal)} €/mois (36m)</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-orange-600">{fmt(o.loyer!)} €</p>
                        <p className="text-xs text-muted-foreground">HT · {fmt(o.loyer! * 1.2)} € TTC</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tableau d'amortissement */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <button onClick={() => setShowAmort(!showAmort)}
                  className="flex items-center gap-2 text-foreground font-semibold">
                  <BarChart3 className="w-4 h-4 text-primary" /> Tableau d'amortissement ({duree} mois)
                  {showAmort ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-1" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />}
                </button>
                <button
                  onClick={downloadAmortPDF}
                  title="Télécharger en PDF"
                  className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
              {showAmort && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="border-t border-border">
                  <div className="p-3 bg-secondary/20 flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      Loyer financier : <strong className="text-foreground">{fmt(result.loyerFinancier)} €/mois</strong> ·
                      <span className="text-red-500 ml-1">Intérêts décroissants</span> ·
                      <span className="text-emerald-600 ml-1">Amortissement croissant</span>
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-secondary text-muted-foreground">
                          <th className="px-3 py-2 text-left font-medium">Mois</th>
                          <th className="px-3 py-2 text-right font-medium">Cap. début</th>
                          <th className="px-3 py-2 text-right font-medium text-red-500">Intérêts</th>
                          <th className="px-3 py-2 text-right font-medium text-emerald-600">Amortis.</th>
                          <th className="px-3 py-2 text-right font-medium">Cap. fin</th>
                          <th className="px-3 py-2 text-right font-medium">% remb.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((row, idx, arr) => {
                          const ai = amortRows.indexOf(row);
                          const pi = idx > 0 ? amortRows.indexOf(arr[idx - 1]) : -1;
                          return (
                            <>
                              {idx > 0 && ai > pi + 1 && (
                                <tr key={`e${idx}`} className="bg-secondary/30">
                                  <td colSpan={6} className="px-3 py-1 text-center text-muted-foreground">···</td>
                                </tr>
                              )}
                              <tr key={row.mois}
                                className={`border-b border-border/40 ${row.mois === 1 || row.mois === duree ? "bg-primary/5 font-semibold" : row.mois % 2 === 0 ? "bg-secondary/20" : ""}`}>
                                <td className="px-3 py-1.5">M{String(row.mois).padStart(2, "0")}</td>
                                <td className="px-3 py-1.5 text-right">{fmt(row.capitalDebut)} €</td>
                                <td className="px-3 py-1.5 text-right text-red-500">{fmt(row.interets)} €</td>
                                <td className="px-3 py-1.5 text-right text-emerald-600">{fmt(row.amortissement)} €</td>
                                <td className="px-3 py-1.5 text-right">{fmt(row.capitalFin)} €</td>
                                <td className="px-3 py-1.5 text-right text-muted-foreground">{row.pctRembourse}%</td>
                              </tr>
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 border-t border-border bg-emerald-500/5 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Capital résiduel M{duree} = VR contractuelle</span>
                    <span className="font-bold text-emerald-600">{fmt(result.vr)} €</span>
                  </div>
                  {amortRows.length > 10 && (
                    <button onClick={() => setShowAllAmort(!showAllAmort)}
                      className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors border-t border-border">
                      {showAllAmort ? `▲ Réduire` : `▼ Afficher les ${amortRows.length} mois`}
                    </button>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
