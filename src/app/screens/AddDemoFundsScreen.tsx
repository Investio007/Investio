import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Wallet } from "lucide-react";
import { Card } from "../components/ui/card";
import { useInvestio } from "../context/InvestioContext";

export function AddDemoFundsScreen() {
  const navigate = useNavigate();
  const { addFunds, toast } = useInvestio();
  const [amount, setAmount] = useState(5000);
  const [selectedChip, setSelectedChip] = useState<number | null>(5000);

  const handleAddFunds = () => {
    addFunds(amount);
    setTimeout(() => navigate("/home"), 1500);
  };

  const quickAmounts = [1000, 5000, 10000, 25000];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-[#0A1F44] text-white px-6 pt-12 pb-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold mb-2">Add Demo Funds</h1>
        <p className="text-white/70 text-sm">
          Add practice money to your portfolio
        </p>
      </div>

      <div className="px-6 py-8">
        {/* Amount Input Card */}
        <Card className="p-6 mb-6 rounded-3xl shadow-lg border-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#0A1F44]/5 rounded-2xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-[#0A1F44]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Amount to Add</p>
              <p className="text-xs text-gray-500">Choose or enter amount</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-[#0A1F44]">
                R
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(Number(e.target.value));
                  setSelectedChip(null);
                }}
                className="w-full bg-[#F5F7FA] rounded-2xl px-4 pl-12 py-4 text-3xl font-bold text-[#0A1F44] border-2 border-transparent focus:border-[#0A1F44] outline-none transition-colors"
                placeholder="0"
              />
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {quickAmounts.map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => {
                  setAmount(quickAmount);
                  setSelectedChip(quickAmount);
                }}
                className={`py-3 px-4 rounded-xl font-medium transition-all ${
                  selectedChip === quickAmount
                    ? "bg-[#0A1F44] text-white"
                    : "bg-[#F5F7FA] text-[#0A1F44] hover:bg-[#0A1F44]/10"
                }`}
              >
                R {quickAmount.toLocaleString()}
              </button>
            ))}
          </div>
        </Card>

        {/* Info Card */}
        <Card className="p-5 mb-6 rounded-2xl shadow-sm border-0 bg-[#FFB612]/10">
          <p className="text-sm text-[#1F2937]">
            This adds virtual funds to your simulation portfolio.{" "}
            <span className="font-medium">No real money is used.</span>
          </p>
        </Card>

        {/* Add Funds Button */}
        <button
          onClick={handleAddFunds}
          className="w-full bg-[#0A1F44] text-white py-4 rounded-2xl font-medium hover:bg-[#0A1F44]/90 transition-colors shadow-lg"
        >
          Add Demo Funds
        </button>

        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-white rounded-2xl">
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            Investio is an AI investment analysis platform. This app does not
            hold funds, execute trades, or manage real investments. All
            portfolio values are simulations for educational purposes.
          </p>
        </div>
      </div>
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