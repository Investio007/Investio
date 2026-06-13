import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { MobileNav } from "../components/MobileNav";
import { useInvestio } from "../context/InvestioContext";

const COLORS = ["#007A4D", "#3B82F6", "#FFB612"];

export function PortfolioBuilderScreen() {
  const navigate = useNavigate();
  const { savePortfolioConfig, toast } = useInvestio();
  const [amount, setAmount] = useState("10000");
  const [riskLevel, setRiskLevel] = useState([1]);
  const [goal, setGoal] = useState<string>("growth");

  // Calculate portfolio allocation based on risk level
  const getRiskLevelName = () => {
    if (riskLevel[0] === 0) return "Low";
    if (riskLevel[0] === 1) return "Medium";
    return "High";
  };

  const getPortfolioData = () => {
    if (riskLevel[0] === 0) {
      return [
        { name: "Growth", value: 20, color: COLORS[0] },
        { name: "Balanced", value: 30, color: COLORS[1] },
        { name: "Safe", value: 50, color: COLORS[2] },
      ];
    } else if (riskLevel[0] === 1) {
      return [
        { name: "Growth", value: 40, color: COLORS[0] },
        { name: "Balanced", value: 40, color: COLORS[1] },
        { name: "Safe", value: 20, color: COLORS[2] },
      ];
    } else {
      return [
        { name: "Growth", value: 60, color: COLORS[0] },
        { name: "Balanced", value: 30, color: COLORS[1] },
        { name: "Safe", value: 10, color: COLORS[2] },
      ];
    }
  };

  const portfolioData = getPortfolioData();

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">
      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 rounded-b-3xl shadow-sm mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 w-10 h-10 bg-[#F5F7FA] rounded-2xl flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-[#0A1F44]" />
        </button>

        <h1 className="text-2xl font-bold text-[#0A1F44]">
          Build Your Demo Portfolio
        </h1>
        <p className="text-gray-600 mt-2">
          Choose how you want to invest your demo money.
        </p>
      </div>

      <div className="px-6 space-y-6 pb-8">
        {/* Investment Amount */}
        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <Label htmlFor="amount" className="text-[#0A1F44] mb-3 block">
            How much do you want to invest?
          </Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
              R
            </span>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-14 pl-10 rounded-2xl bg-[#F5F7FA] border-0 text-[#0A1F44] text-lg"
            />
          </div>
        </Card>

        {/* Risk Level */}
        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <Label className="text-[#0A1F44] mb-4 block">
            Risk Level: {getRiskLevelName()}
          </Label>
          <Slider
            value={riskLevel}
            onValueChange={setRiskLevel}
            max={2}
            step={1}
            className="mb-4"
          />
          <div className="flex justify-between text-sm text-gray-600">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </Card>

        {/* Investment Goal */}
        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <Label className="text-[#0A1F44] mb-3 block">Investment Goal</Label>
          <div className="space-y-2">
            {[
              { id: "growth", label: "Wealth Growth" },
              { id: "income", label: "Passive Income" },
              { id: "retirement", label: "Retirement" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setGoal(option.id)}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                  goal === option.id
                    ? "border-[#0A1F44] bg-[#0A1F44]/5"
                    : "border-gray-200 bg-white"
                }`}
              >
                <span
                  className={`font-medium ${
                    goal === option.id ? "text-[#0A1F44]" : "text-gray-700"
                  }`}
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </Card>

        {/* Recommended Portfolio */}
        <Card className="p-6 rounded-3xl shadow-sm border-0">
          <h3 className="text-xl font-bold text-[#0A1F44] mb-6">
            Recommended Allocation
          </h3>

          <div className="mb-6">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={portfolioData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {portfolioData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {portfolioData.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-700">{item.name}</span>
                </div>
                <span className="font-bold text-[#0A1F44]">{item.value}%</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Create Button */}
        <Button
          onClick={() => {
            const allocation = {
              growth: portfolioData.find((item) => item.name === "Growth")?.value || 0,
              balanced:
                portfolioData.find((item) => item.name === "Balanced")?.value || 0,
              safe: portfolioData.find((item) => item.name === "Safe")?.value || 0,
            };
            savePortfolioConfig({
              amount: Number(amount) || 0,
              risk: getRiskLevelName(),
              goal,
              allocation,
            });
            setTimeout(() => navigate("/home"), 1500);
          }}
          className="w-full bg-[#0A1F44] hover:bg-[#0A1F44]/90 text-white h-14 rounded-2xl text-lg"
        >
          Create Demo Portfolio
        </Button>
      </div>

      {/* Bottom Navigation */}
      <MobileNav />
      {toast.visible && (
        <div
          className="toast"
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0A1F44",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 20,
            fontSize: 13,
            zIndex: 999,
            whiteSpace: "nowrap",
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}