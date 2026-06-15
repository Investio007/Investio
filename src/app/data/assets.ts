export type AnalysisValue = {
  label: string;
  color: "green" | "gold" | "red";
  pct: number;
};

export type InvestioAsset = {
  id: string;
  name: string;
  ticker: string;
  type?: string;
  price: string;
  priceRaw: number;
  change: string;
  changePositive: boolean;
  rating?: string;
  ratingColor: "green" | "gold" | "red";
  aiScore: number;
  description: string;
  analysis: {
    growth: AnalysisValue;
    profitability: AnalysisValue;
    stability: AnalysisValue;
    competition: AnalysisValue;
  };
  explanation: string;
  chartPath: string;
};

export const assets: InvestioAsset[] = [
  {
    id: "aitech",
    name: "AI Technology ETF",
    ticker: "AITECH",
    type: "ETF",
    price: "R1,245.50",
    priceRaw: 1245.5,
    change: "+2.3%",
    changePositive: true,
    rating: "Strong Buy",
    ratingColor: "green",
    aiScore: 82,
    description: "This tech fund is growing fast. Good for long-term growth.",
    analysis: {
      growth: { label: "Strong", color: "green", pct: 85 },
      profitability: { label: "Moderate", color: "gold", pct: 60 },
      stability: { label: "Strong", color: "green", pct: 78 },
      competition: { label: "High", color: "red", pct: 30 },
    },
    explanation:
      "This tech fund is growing fast. It holds top AI companies. But prices can change quickly. Good for long-term growth if you can wait.",
    chartPath:
      "M0 45 C40 40 60 50 100 32 C140 18 160 36 200 20 C230 10 260 24 320 8",
  },
  {
    id: "energy",
    name: "Global Energy Fund",
    ticker: "GLENG",
    type: "Fund",
    price: "R850.00",
    priceRaw: 850,
    change: "+0.8%",
    changePositive: true,
    rating: "Hold",
    ratingColor: "gold",
    aiScore: 65,
    description: "This investment is fairly stable. It can give steady returns.",
    analysis: {
      growth: { label: "Moderate", color: "gold", pct: 55 },
      profitability: { label: "Strong", color: "green", pct: 72 },
      stability: { label: "Strong", color: "green", pct: 80 },
      competition: { label: "Moderate", color: "gold", pct: 50 },
    },
    explanation:
      "This energy fund is fairly stable. It invests in global energy companies. Good if you want steady returns with lower risk.",
    chartPath:
      "M0 50 C40 48 60 42 100 45 C140 48 160 40 200 42 C230 44 260 38 320 35",
  },
  {
    id: "crypto",
    name: "High Risk Crypto",
    ticker: "CRYPTO",
    type: "Crypto",
    price: "R2,150.00",
    priceRaw: 2150,
    change: "-5.2%",
    changePositive: false,
    rating: "High Risk",
    ratingColor: "red",
    aiScore: 38,
    description: "This crypto can grow fast. But prices go up and down a lot.",
    analysis: {
      growth: { label: "High", color: "green", pct: 90 },
      profitability: { label: "Weak", color: "red", pct: 25 },
      stability: { label: "Weak", color: "red", pct: 15 },
      competition: { label: "High", color: "red", pct: 20 },
    },
    explanation:
      "This crypto investment can grow very fast. But it can also drop very fast. Only invest money you are okay to lose.",
    chartPath:
      "M0 30 C20 50 40 20 60 55 C80 35 100 60 130 25 C160 45 200 15 230 50 C260 30 290 55 320 20",
  },
];

export const companies: InvestioAsset[] = [
  {
    id: "apple",
    name: "Apple",
    ticker: "AAPL",
    price: "$185.50",
    priceRaw: 185.5,
    change: "+1.2%",
    changePositive: true,
    aiScore: 92,
    ratingColor: "green",
    description:
      "Apple makes great products. The company keeps making money. A safe investment for most people.",
    analysis: {
      growth: { label: "Strong", color: "green", pct: 88 },
      profitability: { label: "Strong", color: "green", pct: 92 },
      stability: { label: "Strong", color: "green", pct: 90 },
      competition: { label: "Moderate", color: "gold", pct: 60 },
    },
    explanation:
      "Apple is one of the most valuable companies in the world. They make iPhones, Macs, and software. Very consistent and profitable.",
    chartPath:
      "M0 40 C40 38 80 30 120 25 C160 20 200 22 240 18 C270 15 290 12 320 8",
  },
  {
    id: "microsoft",
    name: "Microsoft",
    ticker: "MSFT",
    price: "$380.25",
    priceRaw: 380.25,
    change: "+0.8%",
    changePositive: true,
    aiScore: 89,
    ratingColor: "green",
    description:
      "Microsoft is very stable. They provide cloud services to many businesses. Good for long-term growth.",
    analysis: {
      growth: { label: "Strong", color: "green", pct: 85 },
      profitability: { label: "Strong", color: "green", pct: 88 },
      stability: { label: "Strong", color: "green", pct: 92 },
      competition: { label: "Moderate", color: "gold", pct: 55 },
    },
    explanation:
      "Microsoft provides cloud services to millions of businesses worldwide. Very stable and growing steadily.",
    chartPath: "M0 45 C50 40 100 35 150 28 C200 22 250 20 320 12",
  },
  {
    id: "alphabet",
    name: "Alphabet",
    ticker: "GOOGL",
    price: "$140.75",
    priceRaw: 140.75,
    change: "-0.3%",
    changePositive: false,
    aiScore: 75,
    ratingColor: "gold",
    description:
      "Google makes money from ads. But governments are watching them closely. Medium risk investment.",
    analysis: {
      growth: { label: "Strong", color: "green", pct: 78 },
      profitability: { label: "Strong", color: "green", pct: 80 },
      stability: { label: "Moderate", color: "gold", pct: 65 },
      competition: { label: "High", color: "red", pct: 35 },
    },
    explanation:
      "Google earns most of its money from online ads. They are very profitable but face increasing regulation worldwide.",
    chartPath:
      "M0 35 C40 40 80 30 120 38 C160 45 200 35 240 42 C270 48 300 40 320 45",
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    ticker: "NVDA",
    price: "$875.00",
    priceRaw: 875,
    change: "+2.1%",
    changePositive: true,
    aiScore: 88,
    ratingColor: "green",
    description:
      "NVIDIA makes chips that power AI. It is growing very fast but the price can move a lot.",
    analysis: {
      growth: { label: "Strong", color: "green", pct: 95 },
      profitability: { label: "Strong", color: "green", pct: 90 },
      stability: { label: "Moderate", color: "gold", pct: 55 },
      competition: { label: "Moderate", color: "gold", pct: 58 },
    },
    explanation:
      "NVIDIA leads the AI chip market. Huge growth potential, but expect bigger price swings than older tech giants.",
    chartPath:
      "M0 50 C40 45 80 35 120 30 C160 25 200 20 240 15 C280 10 300 8 320 5",
  },
  {
    id: "amazon",
    name: "Amazon",
    ticker: "AMZN",
    price: "$185.00",
    priceRaw: 185,
    change: "+0.6%",
    changePositive: true,
    aiScore: 84,
    ratingColor: "green",
    description:
      "Amazon sells online and runs cloud services. A huge company with steady long-term growth.",
    analysis: {
      growth: { label: "Strong", color: "green", pct: 82 },
      profitability: { label: "Moderate", color: "gold", pct: 58 },
      stability: { label: "Strong", color: "green", pct: 78 },
      competition: { label: "Moderate", color: "gold", pct: 52 },
    },
    explanation:
      "Amazon dominates online shopping and AWS cloud computing. Profits are growing as the business matures.",
    chartPath:
      "M0 42 C50 40 100 38 150 35 C200 32 250 28 320 22",
  },
  {
    id: "meta",
    name: "Meta",
    ticker: "META",
    price: "$505.00",
    priceRaw: 505,
    change: "+1.0%",
    changePositive: true,
    aiScore: 82,
    ratingColor: "green",
    description:
      "Meta owns Facebook, Instagram, and WhatsApp. Strong ad business with AI investments ahead.",
    analysis: {
      growth: { label: "Strong", color: "green", pct: 80 },
      profitability: { label: "Strong", color: "green", pct: 85 },
      stability: { label: "Moderate", color: "gold", pct: 68 },
      competition: { label: "Moderate", color: "gold", pct: 50 },
    },
    explanation:
      "Meta earns from ads across social apps used by billions. Investing heavily in AI and the metaverse.",
    chartPath:
      "M0 38 C40 42 80 36 120 40 C160 44 200 38 240 42 C280 46 300 40 320 38",
  },
  {
    id: "tesla",
    name: "Tesla",
    ticker: "TSLA",
    price: "$245.00",
    priceRaw: 245,
    change: "-1.2%",
    changePositive: false,
    aiScore: 68,
    ratingColor: "gold",
    description:
      "Tesla makes electric cars and energy products. High growth but the stock price moves sharply.",
    analysis: {
      growth: { label: "Strong", color: "green", pct: 88 },
      profitability: { label: "Moderate", color: "gold", pct: 55 },
      stability: { label: "Risky", color: "red", pct: 38 },
      competition: { label: "Moderate", color: "gold", pct: 48 },
    },
    explanation:
      "Tesla is a leader in electric vehicles. Exciting growth story, but expect more ups and downs than stable giants.",
    chartPath:
      "M0 30 C30 50 60 25 90 55 C120 35 180 20 240 45 C280 30 300 50 320 25",
  },
  {
    id: "netflix",
    name: "Netflix",
    ticker: "NFLX",
    price: "$620.00",
    priceRaw: 620,
    change: "+0.4%",
    changePositive: true,
    aiScore: 76,
    ratingColor: "gold",
    description:
      "Netflix is the top streaming service worldwide. Growing subscribers with a strong brand.",
    analysis: {
      growth: { label: "Strong", color: "green", pct: 75 },
      profitability: { label: "Moderate", color: "gold", pct: 62 },
      stability: { label: "Moderate", color: "gold", pct: 60 },
      competition: { label: "High", color: "red", pct: 40 },
    },
    explanation:
      "Netflix leads streaming entertainment globally. Competition is fierce, but the brand and content library are strong.",
    chartPath:
      "M0 40 C50 38 100 42 150 36 C200 32 250 38 320 30",
  },
];
