export interface Wallet {
  id: string;
  hash: string;
  x: number;
  y: number;
  riskScore: number;
  inflow: number;
  outflow: number;
  transactionCount: number;
}

export interface Transaction {
  id: string;
  from_wallet: string;
  to_wallet: string;
  amount: number;
  timestamp?: string;
  token_type: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  dataset?: string;
  createdAt: string;
  userId: string;
  walletCount?: number;
  analyses?: number;
}

export interface AnalysisResult {
  wallets: Wallet[];
  transactions: Transaction[];
  statistics: {
    totalTransactions: number;
    uniqueWallets: number;
    suspiciousWallets: number;
    totalVolume: number;
  };
}
