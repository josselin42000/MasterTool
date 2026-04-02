import { motion } from "framer-motion";
import { Calculator, TrendingUp, ArrowRight, Package, Zap } from "lucide-react";

interface HomeProps {
  onSelectTool: (tool: "import" | "leasing") => void;
}

export default function Home({ onSelectTool }: HomeProps) {
  const tools = [
    {
      id: "import" as const,
      icon: <TrendingUp className="w-10 h-10 text-primary" />,
      badge: "Outil 1",
      badgeColor: "bg-primary/10 text-primary",
      title: "Simulateur de Prix Import",
      description: "Calculez vos prix de vente à partir du prix d'achat en intégrant les frais d'approche, marges SAV, marketing, importateur, distributeur et revendeur.",
      features: ["Marges en cascade", "Mode prix cible", "Traitement Excel", "Arrondi optimisé"],
      borderColor: "border-primary/30",
      hoverColor: "hover:border-primary/60",
      buttonColor: "bg-primary text-primary-foreground hover:bg-primary/90",
      accent: "bg-primary/5",
    },
    {
      id: "leasing" as const,
      icon: <Calculator className="w-10 h-10 text-emerald-500" />,
      badge: "Outil 2",
      badgeColor: "bg-emerald-500/10 text-emerald-600",
      title: "Calculateur de Loyer",
      description: "Simulez un loyer mensuel de location longue durée avec valeur résiduelle, composante service, assurance, options de sortie anticipée et tableau d'amortissement.",
      features: ["Loyer mensuel HT/TTC", "Tableau d'amortissement", "Options sortie 6/12 mois", "Comparatif toutes durées"],
      borderColor: "border-emerald-500/30",
      hoverColor: "hover:border-emerald-500/60",
      buttonColor: "bg-emerald-500 text-white hover:bg-emerald-600",
      accent: "bg-emerald-500/5",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-3 mb-12"
      >
        <div className="inline-flex items-center gap-2 bg-secondary rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground">
          <Zap className="w-4 h-4 text-primary" />
          Cost Cruiser Pro
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
          Vos outils de simulation
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Calculez vos prix d'import et simulez vos offres de location en quelques secondes.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-3xl">
        {tools.map((tool, i) => (
          <motion.div
            key={tool.id}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.1 }}
            className={`bg-card rounded-2xl border-2 ${tool.borderColor} ${tool.hoverColor} p-7 shadow-sm transition-all duration-200 cursor-pointer group`}
            onClick={() => onSelectTool(tool.id)}
          >
            {/* Top */}
            <div className="flex items-start justify-between mb-5">
              <div className={`${tool.accent} rounded-xl p-3`}>
                {tool.icon}
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tool.badgeColor}`}>
                {tool.badge}
              </span>
            </div>

            {/* Content */}
            <h2 className="text-xl font-bold text-foreground mb-2">{tool.title}</h2>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{tool.description}</p>

            {/* Features */}
            <div className="grid grid-cols-2 gap-1.5 mb-6">
              {tool.features.map(f => (
                <div key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            {/* CTA */}
            <button className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${tool.buttonColor}`}>
              Ouvrir l'outil
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 text-xs text-muted-foreground flex items-center gap-1.5"
      >
        <Package className="w-3.5 h-3.5" />
        Cost Cruiser Pro — Simulateurs de pricing et de location
      </motion.p>
    </div>
  );
}
