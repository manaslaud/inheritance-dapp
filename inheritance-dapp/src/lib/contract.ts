import abi from "./abi.json";

export const CONTRACT_ADDRESS = "0x0a3d1643A50EF6AC192F359cD5A6c08Bf444977C";
export const CONTRACT_ABI = abi as any;

export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7"; // 11155111

export const INFURA_PROJECT_ID = process.env.NEXT_PUBLIC_INFURA_ID || "5d772c1beeb54e47b05091d8caa1f9a7";
// Use server-side proxy route to avoid exposing secret in the browser
export const SEPOLIA_RPC_URL = "/api/infura-sepolia";

// (fallback URL not needed; using Infura)


