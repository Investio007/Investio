export type CountryMarket = {
  id: string;
  name: string;
  flag: string;
};

export type CountryStock = {
  id: string;
  name: string;
  ticker: string;
  countryId: string;
};

/** Top 10 countries by global stock market size */
export const COUNTRY_MARKETS: CountryMarket[] = [
  { id: "us", name: "United States", flag: "🇺🇸" },
  { id: "cn", name: "China", flag: "🇨🇳" },
  { id: "jp", name: "Japan", flag: "🇯🇵" },
  { id: "in", name: "India", flag: "🇮🇳" },
  { id: "gb", name: "United Kingdom", flag: "🇬🇧" },
  { id: "fr", name: "France", flag: "🇫🇷" },
  { id: "hk", name: "Hong Kong", flag: "🇭🇰" },
  { id: "ca", name: "Canada", flag: "🇨🇦" },
  { id: "de", name: "Germany", flag: "🇩🇪" },
  { id: "kr", name: "South Korea", flag: "🇰🇷" },
];

export const COUNTRY_STOCKS: CountryStock[] = [
  // United States
  { id: "apple", name: "Apple", ticker: "AAPL", countryId: "us" },
  { id: "microsoft", name: "Microsoft", ticker: "MSFT", countryId: "us" },
  { id: "alphabet", name: "Alphabet", ticker: "GOOGL", countryId: "us" },
  { id: "nvidia", name: "NVIDIA", ticker: "NVDA", countryId: "us" },
  { id: "amazon", name: "Amazon", ticker: "AMZN", countryId: "us" },
  { id: "tesla", name: "Tesla", ticker: "TSLA", countryId: "us" },
  { id: "meta", name: "Meta Platforms", ticker: "META", countryId: "us" },
  { id: "netflix", name: "Netflix", ticker: "NFLX", countryId: "us" },
  { id: "aitech", name: "AI Technology ETF", ticker: "QQQ", countryId: "us" },
  { id: "energy", name: "Global Energy Fund", ticker: "XLE", countryId: "us" },

  // China
  { id: "alibaba", name: "Alibaba Group", ticker: "BABA", countryId: "cn" },
  { id: "tencent", name: "Tencent Holdings", ticker: "TCEHY", countryId: "cn" },
  { id: "baidu", name: "Baidu", ticker: "BIDU", countryId: "cn" },
  { id: "jd", name: "JD.com", ticker: "JD", countryId: "cn" },
  { id: "nio", name: "NIO", ticker: "NIO", countryId: "cn" },

  // Japan
  { id: "toyota", name: "Toyota Motor", ticker: "TM", countryId: "jp" },
  { id: "sony", name: "Sony Group", ticker: "SONY", countryId: "jp" },
  { id: "nintendo", name: "Nintendo", ticker: "NTDOY", countryId: "jp" },

  // India
  { id: "infosys", name: "Infosys", ticker: "INFY", countryId: "in" },
  { id: "hdfc", name: "HDFC Bank", ticker: "HDB", countryId: "in" },
  { id: "wipro", name: "Wipro", ticker: "WIT", countryId: "in" },

  // United Kingdom
  { id: "bp", name: "BP", ticker: "BP", countryId: "gb" },
  { id: "hsbc", name: "HSBC Holdings", ticker: "HSBC", countryId: "gb" },
  { id: "shell", name: "Shell", ticker: "SHEL", countryId: "gb" },
  { id: "astrazeneca", name: "AstraZeneca", ticker: "AZN", countryId: "gb" },

  // France
  { id: "total", name: "TotalEnergies", ticker: "TTE", countryId: "fr" },
  { id: "sanofi", name: "Sanofi", ticker: "SNY", countryId: "fr" },
  { id: "loreal", name: "L'Oréal", ticker: "LRLCY", countryId: "fr" },

  // Hong Kong
  { id: "tencent_hk", name: "Tencent", ticker: "0700.HK", countryId: "hk" },
  { id: "alibaba_hk", name: "Alibaba", ticker: "9988.HK", countryId: "hk" },
  { id: "hsbc_hk", name: "HSBC", ticker: "0005.HK", countryId: "hk" },

  // Canada
  { id: "shopify", name: "Shopify", ticker: "SHOP", countryId: "ca" },
  { id: "royalbank", name: "Royal Bank of Canada", ticker: "RY", countryId: "ca" },
  { id: "tdbank", name: "TD Bank", ticker: "TD", countryId: "ca" },

  // Germany
  { id: "sap", name: "SAP", ticker: "SAP", countryId: "de" },
  { id: "siemens", name: "Siemens", ticker: "SIEGY", countryId: "de" },
  { id: "mercedes", name: "Mercedes-Benz", ticker: "MBGYY", countryId: "de" },

  // South Korea
  { id: "samsung", name: "Samsung Electronics", ticker: "005930.KS", countryId: "kr" },
  { id: "skhynix", name: "SK Hynix", ticker: "000660.KS", countryId: "kr" },
  { id: "lg", name: "LG Electronics", ticker: "066570.KS", countryId: "kr" },
];

export function getStocksForCountry(countryId: string): CountryStock[] {
  return COUNTRY_STOCKS.filter((stock) => stock.countryId === countryId);
}

export function getCountryById(countryId: string): CountryMarket | undefined {
  return COUNTRY_MARKETS.find((country) => country.id === countryId);
}
