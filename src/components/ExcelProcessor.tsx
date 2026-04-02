import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { FileSpreadsheet, Upload, Download, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";
import { computePricing, type PricingParams, fmt } from "@/lib/pricing";

interface ColumnMapping {
  prixAchat: string;
  reference: string;
  nomProduit: string;
  prixExistant: string;
}

interface ExcelProcessorProps {
  params: Omit<PricingParams, "prixAchat">;
}

const SelectColumn = ({ label, value, onChange, columns, required }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  columns: string[];
  required?: boolean;
}) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-muted-foreground">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <option value="">— Aucune —</option>
        {columns.map((col) => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
    </div>
  </div>
);

export default function ExcelProcessor({ params }: ExcelProcessorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ prixAchat: "", reference: "", nomProduit: "", prixExistant: "" });
  const [status, setStatus] = useState<"idle" | "loaded" | "error" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [processedCount, setProcessedCount] = useState(0);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setStatus("idle");
    setErrorMsg("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        if (json.length === 0) {
          setErrorMsg("Le fichier est vide.");
          setStatus("error");
          return;
        }
        const cols = Object.keys(json[0]);
        setHeaders(cols);
        setRawData(json);
        setStatus("loaded");

        // Auto-detect columns
        const autoMap: ColumnMapping = { prixAchat: "", reference: "", nomProduit: "", prixExistant: "" };
        for (const col of cols) {
          const lower = col.toLowerCase();
          if (!autoMap.prixAchat && (lower.includes("achat") || lower.includes("cost") || lower.includes("prix"))) autoMap.prixAchat = col;
          else if (!autoMap.reference && (lower.includes("ref") || lower.includes("sku") || lower.includes("code"))) autoMap.reference = col;
          else if (!autoMap.nomProduit && (lower.includes("nom") || lower.includes("name") || lower.includes("produit") || lower.includes("désignation") || lower.includes("designation"))) autoMap.nomProduit = col;
          else if (!autoMap.prixExistant && (lower.includes("exist") || lower.includes("actuel") || lower.includes("current"))) autoMap.prixExistant = col;
        }
        setMapping(autoMap);
      } catch {
        setErrorMsg("Impossible de lire le fichier. Vérifiez le format (.xlsx).");
        setStatus("error");
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  const handleGenerate = useCallback(() => {
    if (!mapping.prixAchat) {
      setErrorMsg("Veuillez mapper la colonne « Coût d'achat ».");
      setStatus("error");
      return;
    }

    const outputRows: Record<string, unknown>[] = [];
    let errors = 0;

    for (const row of rawData) {
      const achatVal = parseFloat(String(row[mapping.prixAchat] ?? ""));
      if (isNaN(achatVal) || achatVal <= 0) {
        errors++;
        // Keep row with error marker
        outputRows.push({ ...row, "⚠ Erreur": "Prix d'achat invalide" });
        continue;
      }

      const result = computePricing({ ...params, prixAchat: achatVal });

      outputRows.push({
        ...row,
        "Coût de revient": Math.round(result.coutRevient * 100) / 100,
        "Prix après SAV": Math.round(result.prixApresSAV * 100) / 100,
        "Prix après Marketing": Math.round(result.prixApresMarketing * 100) / 100,
        "Prix sortie Importateur": Math.round(result.prixSortieImportateur * 100) / 100,
        "Prix sortie Distributeur": Math.round(result.prixSortieDistributeur * 100) / 100,
        "Prix Revendeur HT": Math.round(result.prixRevendeurHT * 100) / 100,
        "Prix Final TTC": Math.round(result.prixTTC * 100) / 100,
        "Gain arrondi (€)": Math.round(result.totalRoundingGain * 100) / 100,
        "Gain arrondi (%)": Math.round(result.roundingGainPct * 100) / 100,
        "Marge globale (€)": Math.round(result.maMargeEuros * 100) / 100,
        "Marge globale (%)": Math.round(result.maMargePct * 100) / 100,
      });
    }

    // Generate file
    const ws = XLSX.utils.json_to_sheet(outputRows);

    // Auto-size columns
    const colWidths = Object.keys(outputRows[0] || {}).map((key) => ({
      wch: Math.max(key.length + 2, 14),
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pricing");
    XLSX.writeFile(wb, "pricing_output.xlsx");

    setProcessedCount(rawData.length - errors);
    setStatus("done");
    if (errors > 0) {
      setErrorMsg(`${errors} ligne(s) ignorée(s) (prix d'achat invalide).`);
    } else {
      setErrorMsg("");
    }
  }, [rawData, mapping, params]);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.25 }}
      className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5"
    >
      <h2 className="font-semibold text-foreground flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5 text-primary" />
        Traitement Excel (batch)
      </h2>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Importez un fichier Excel pour appliquer automatiquement les paramètres actuels du simulateur à tous vos produits.
      </p>

      {/* Upload */}
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors">
        <Upload className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {file ? file.name : "Cliquer pour importer un fichier .xlsx"}
        </span>
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
      </label>

      {/* Column mapping */}
      {status === "loaded" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="bg-secondary/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">
              📄 {rawData.length} lignes détectées · {headers.length} colonnes
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectColumn label="Coût d'achat" value={mapping.prixAchat} onChange={(v) => setMapping((m) => ({ ...m, prixAchat: v }))} columns={headers} required />
            <SelectColumn label="Référence produit" value={mapping.reference} onChange={(v) => setMapping((m) => ({ ...m, reference: v }))} columns={headers} />
            <SelectColumn label="Nom produit" value={mapping.nomProduit} onChange={(v) => setMapping((m) => ({ ...m, nomProduit: v }))} columns={headers} />
            <SelectColumn label="Prix existant" value={mapping.prixExistant} onChange={(v) => setMapping((m) => ({ ...m, prixExistant: v }))} columns={headers} />
          </div>

          {/* Current params summary */}
          <div className="bg-secondary/40 rounded-lg p-3 text-xs text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground text-xs mb-1">Paramètres appliqués :</p>
            <p>Frais d'approche : {fmt(params.tauxFraisApproche)}% · SAV : {fmt(params.margeSAV)}% · Marketing : {fmt(params.margeMarketing)}%</p>
            <p>Importateur : {fmt(params.margeImportateur)}% · Distributeur : {fmt(params.margeDistributeur)}% · Revendeur : {fmt(params.margeRevendeur)}%</p>
            <p>Arrondis : {[params.roundFrais && "Frais", params.roundSAV && "SAV", params.roundMarketing && "Mktg", params.roundImportateur && "Import."].filter(Boolean).join(", ") || "Aucun"}</p>
          </div>

          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <Download className="w-4 h-4" />
            Générer le fichier
          </button>
        </motion.div>
      )}

      {/* Status messages */}
      {status === "error" && errorMsg && (
        <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {status === "done" && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-accent text-sm bg-accent/10 rounded-lg p-3">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            {processedCount} produit(s) traité(s) — fichier téléchargé !
          </div>
          {errorMsg && (
            <div className="flex items-start gap-2 text-destructive text-xs bg-destructive/10 rounded-lg p-2.5">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {errorMsg}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}