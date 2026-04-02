import { useState } from "react";
import Home from "./Home";
import PriceSimulator from "@/components/PriceSimulator";
import LeasingSimulator from "@/components/LeasingSimulator";

type Tool = "home" | "import" | "leasing";

const Index = () => {
  const [activeTool, setActiveTool] = useState<Tool>("home");
  const [leasingInitialPrice, setLeasingInitialPrice] = useState<number | undefined>(undefined);

  const handleRentItem = (prixHT: number) => {
    setLeasingInitialPrice(prixHT);
    setActiveTool("leasing");
  };

  const handleBack = () => {
    setActiveTool("home");
    setLeasingInitialPrice(undefined);
  };

  if (activeTool === "import") {
    return <PriceSimulator onBack={handleBack} onRentItem={handleRentItem} />;
  }

  if (activeTool === "leasing") {
    return <LeasingSimulator initialPrixHT={leasingInitialPrice} onBack={handleBack} />;
  }

  return <Home onSelectTool={(tool) => setActiveTool(tool)} />;
};

export default Index;
