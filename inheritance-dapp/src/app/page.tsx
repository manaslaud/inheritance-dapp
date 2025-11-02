"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, JsonRpcSigner, parseEther } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID_HEX } from "@/lib/contract";

type Beneficiary = { wallet: string; share: bigint };

export default function Home() {
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const [owner, setOwner] = useState<string>("");
  const [isDeceased, setIsDeceased] = useState<boolean>(false);
  const [heartbeatInterval, setHeartbeatInterval] = useState<bigint>(0n);
  const [lastCheckIn, setLastCheckIn] = useState<bigint>(0n);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);

  const [depositAmount, setDepositAmount] = useState<string>("");
  const [newBeneficiary, setNewBeneficiary] = useState<{ wallet: string; share: string }>({ wallet: "", share: "" });
  const [newHeartbeat, setNewHeartbeat] = useState<string>("");
  const [erc20Address, setErc20Address] = useState<string>("");
  const [removeAddress, setRemoveAddress] = useState<string>("");
  const [updateShareData, setUpdateShareData] = useState<{ wallet: string; share: string }>({ wallet: "", share: "" });
  const [mounted, setMounted] = useState<boolean>(false);

  const hasProvider = mounted && typeof window !== "undefined" && (window as any).ethereum;
  const isSepolia = chainId?.toLowerCase() === SEPOLIA_CHAIN_ID_HEX;

  const provider = useMemo(() => {
    if (!hasProvider) return undefined;
    return new BrowserProvider((window as any).ethereum);
  }, [hasProvider]);

  const getSigner = useCallback(async (): Promise<JsonRpcSigner> => {
    if (!provider) throw new Error("No provider");
    return await provider.getSigner();
  }, [provider]);

  const contractWithProvider = useMemo(() => {
    if (!provider) return undefined;
    return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  }, [provider]);

  const contractWithSigner = useCallback(async () => {
    const signer = await getSigner();
    return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  }, [getSigner]);

  const formatLastCheckIn = useCallback(
    (seconds: bigint) => {
      if (seconds === 0n) return "-";
      if (!mounted) return seconds.toString();
      try {
        const ms = Number(seconds) * 1000;
        return new Date(ms).toLocaleString();
      } catch {
        return seconds.toString();
      }
    },
    [mounted]
  );

  const connect = useCallback(async () => {
    if (!hasProvider) {
      setStatus("Install MetaMask to continue.");
      return;
    }
    try {
      const accounts: string[] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      const cid: string = await (window as any).ethereum.request({ method: "eth_chainId" });
      setAccount(accounts[0] || "");
      setChainId(cid);
      setStatus("");
    } catch (err: any) {
      setStatus(err?.message || "Failed to connect wallet");
    }
  }, [hasProvider]);

  const switchToSepolia = useCallback(async () => {
    if (!hasProvider) return;
    try {
      await (window as any).ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }] });
    } catch (switchError: any) {
      // If the chain has not been added to MetaMask
      if (switchError?.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID_HEX,
                chainName: "Sepolia Test Network",
                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://rpc.sepolia.org"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } catch (addErr: any) {
          setStatus(addErr?.message || "Failed to add Sepolia network");
        }
      } else {
        setStatus(switchError?.message || "Failed to switch network");
      }
    }
  }, [hasProvider]);

  const loadContractState = useCallback(async () => {
    if (!contractWithProvider || !provider) return;
    try {
      if (!isSepolia) {
        setStatus("Switch to Sepolia to load contract state");
        return;
      }

      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (!code || code === "0x") {
        setStatus("No contract code found at this address on current network");
        return;
      }

      const [o, d, hb, lc, list] = await Promise.all([
        contractWithProvider.owner(),
        contractWithProvider.isDeceased(),
        contractWithProvider.heartbeatInterval(),
        contractWithProvider.lastCheckIn(),
        contractWithProvider.getBeneficiaries(),
      ]);
      console.log("o", o);
      console.log("d", d);
      console.log("hb", hb);
      console.log("lc", lc);
      console.log("list", list);
      setOwner(o as string);
      setIsDeceased(Boolean(d));
      setHeartbeatInterval(BigInt(hb));
      setLastCheckIn(BigInt(lc));
      const mapped: Beneficiary[] = (list as any[]).map((b) => ({ wallet: b.wallet as string, share: BigInt(b.share) }));
      setBeneficiaries(mapped);
    } catch (err: any) {
      setStatus(err?.message || "Failed to load state");
    }
  }, [contractWithProvider]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!hasProvider) return;
    const handlerAccounts = (accs: string[]) => setAccount(accs?.[0] || "");
    const handlerChain = (cid: string) => setChainId(cid);
    (window as any).ethereum.on("accountsChanged", handlerAccounts);
    (window as any).ethereum.on("chainChanged", handlerChain);
    return () => {
      try {
        (window as any).ethereum.removeListener("accountsChanged", handlerAccounts);
        (window as any).ethereum.removeListener("chainChanged", handlerChain);
      } catch {}
    };
  }, [hasProvider]);

  useEffect(() => {
    // Load state when provider ready and on network change
    loadContractState();
  }, [loadContractState, chainId, account]);

  const depositEth = useCallback(async () => {
    if (!depositAmount) return;
    try {
      const signer = await getSigner();
      const tx = await signer.sendTransaction({ to: CONTRACT_ADDRESS, value: parseEther(depositAmount) });
      setStatus("Sending deposit...");
      await tx.wait();
      setStatus("Deposit confirmed");
      setDepositAmount("");
      await loadContractState();
    } catch (err: any) {
      setStatus(err?.message || "Deposit failed");
    }
  }, [depositAmount, getSigner, loadContractState]);

  const checkIn = useCallback(async () => {
    try {
      const c = await contractWithSigner();
      const tx = await c.checkIn();
      setStatus("checkIn submitted...");
      await tx.wait();
      setStatus("checkIn confirmed");
      await loadContractState();
    } catch (err: any) {
      setStatus(err?.message || "checkIn failed");
    }
  }, [contractWithSigner, loadContractState]);

  const declareDeceased = useCallback(async () => {
    try {
      const c = await contractWithSigner();
      const tx = await c.declareDeceased();
      setStatus("declareDeceased submitted...");
      await tx.wait();
      setStatus("Deceased declared and distribution executed (ETH)");
      await loadContractState();
    } catch (err: any) {
      setStatus(err?.message || "declareDeceased failed");
    }
  }, [contractWithSigner, loadContractState]);

  const addBeneficiary = useCallback(async () => {
    if (!newBeneficiary.wallet || !newBeneficiary.share) return;
    try {
      const c = await contractWithSigner();
      const tx = await c.addBeneficiary(newBeneficiary.wallet, BigInt(newBeneficiary.share));
      setStatus("addBeneficiary submitted...");
      await tx.wait();
      setStatus("Beneficiary added");
      setNewBeneficiary({ wallet: "", share: "" });
      await loadContractState();
    } catch (err: any) {
      setStatus(err?.message || "addBeneficiary failed");
    }
  }, [newBeneficiary, contractWithSigner, loadContractState]);

  const setHeartbeat = useCallback(async () => {
    if (!newHeartbeat) return;
    try {
      const c = await contractWithSigner();
      const tx = await c.setHeartbeatInterval(BigInt(newHeartbeat));
      setStatus("setHeartbeatInterval submitted...");
      await tx.wait();
      setStatus("Heartbeat interval updated");
      setNewHeartbeat("");
      await loadContractState();
    } catch (err: any) {
      setStatus(err?.message || "setHeartbeatInterval failed");
    }
  }, [newHeartbeat, contractWithSigner, loadContractState]);

  const distributeERC20 = useCallback(async () => {
    if (!erc20Address) return;
    try {
      const c = await contractWithSigner();
      const tx = await c.distributeERC20(erc20Address);
      setStatus("distributeERC20 submitted...");
      await tx.wait();
      setStatus("ERC20 distribution executed");
      setErc20Address("");
      await loadContractState();
    } catch (err: any) {
      setStatus(err?.message || "distributeERC20 failed");
    }
  }, [erc20Address, contractWithSigner, loadContractState]);

  const preflightWrite = useCallback(async (requireOwner?: boolean) => {
    if (!mounted) throw new Error("UI not ready yet");
    if (!isSepolia) throw new Error("Switch to Sepolia to transact");
    if (!provider) throw new Error("No provider");
    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (!code || code === "0x") throw new Error("No contract code at this address on current network");
    const signer = await getSigner();
    const addr = (await signer.getAddress()).toLowerCase();
    if (addr === CONTRACT_ADDRESS.toLowerCase()) throw new Error("Selected account equals contract address; select your EOA account");
    if (requireOwner && owner && addr !== owner.toLowerCase()) throw new Error("Connect as the contract owner to perform this action");
  }, [mounted, isSepolia, provider, getSigner, owner]);

  const removeBeneficiary = useCallback(async () => {
    if (!removeAddress) return;
    try {
      const c = await contractWithSigner();
      const tx = await c.removeBeneficiary(removeAddress);
      setStatus("removeBeneficiary submitted...");
      await tx.wait();
      setStatus("Beneficiary removed");
      setRemoveAddress("");
      await loadContractState();
    } catch (err: any) {
      setStatus(err?.message || "removeBeneficiary failed");
    }
  }, [removeAddress, contractWithSigner, loadContractState]);

  const updateBeneficiaryShare = useCallback(async () => {
    if (!updateShareData.wallet || !updateShareData.share) return;
    try {
      const c = await contractWithSigner();
      const tx = await c.updateBeneficiaryShare(updateShareData.wallet, BigInt(updateShareData.share));
      setStatus("updateBeneficiaryShare submitted...");
      await tx.wait();
      setStatus("Beneficiary share updated");
      setUpdateShareData({ wallet: "", share: "" });
      await loadContractState();
    } catch (err: any) {
      setStatus(err?.message || "updateBeneficiaryShare failed");
    }
  }, [updateShareData, contractWithSigner, loadContractState]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-semibold">Inheritance Wallet (Sepolia)</h1>
        <p className="mt-1 text-sm text-zinc-600 break-all">Contract: {CONTRACT_ADDRESS}</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!account ? (
            <button onClick={connect} className="rounded-md bg-black px-4 py-2 text-white">Connect Wallet</button>
          ) : (
            <div className="text-sm">Connected: <span className="font-mono">{account}</span></div>
          )}
          {account && !isSepolia && (
            <button onClick={switchToSepolia} className="rounded-md border px-3 py-2 text-sm">Switch to Sepolia</button>
          )}
          {status && <div className="text-sm text-amber-700">{status}</div>}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Contract State</h2>
            <div className="space-y-2 text-sm">
              <div><span className="text-zinc-500">Owner:</span> <span className="break-all">{owner || "-"}</span></div>
              <div><span className="text-zinc-500">isDeceased:</span> {isDeceased ? "Yes" : "No"}</div>
              <div><span className="text-zinc-500">heartbeatInterval:</span> {heartbeatInterval.toString()} seconds</div>
              <div><span className="text-zinc-500">lastCheckIn:</span> {formatLastCheckIn(lastCheckIn)}</div>
              <div>
                <span className="text-zinc-500">Beneficiaries:</span>
                <ul className="mt-2 space-y-1">
                  {beneficiaries.length === 0 && <li className="text-zinc-500">None</li>}
                  {beneficiaries.map((b) => (
                    <li key={b.wallet} className="flex items-center justify-between gap-3 break-all rounded border p-2">
                      <span className="font-mono">{b.wallet}</span>
                      <span className="text-sm">Share: {b.share.toString()}%</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button onClick={loadContractState} className="mt-2 rounded-md border px-3 py-2 text-sm">Refresh</button>
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Deposit ETH</h2>
            <div className="flex gap-2">
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="Amount in ETH"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <button onClick={depositEth} className="rounded-md bg-black px-4 py-2 text-white">Send</button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">This sends ETH directly to the contract's receive() function.</p>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Owner Actions</h2>
            <div className="space-y-3">
              <button onClick={checkIn} className="rounded-md bg-black px-4 py-2 text-white">checkIn</button>
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded border px-3 py-2"
                  placeholder="New heartbeat interval (seconds)"
                  value={newHeartbeat}
                  onChange={(e) => setNewHeartbeat(e.target.value)}
                />
                <button onClick={setHeartbeat} className="rounded-md border px-3 py-2">Update</button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded border px-3 py-2"
                  placeholder="Beneficiary wallet"
                  value={newBeneficiary.wallet}
                  onChange={(e) => setNewBeneficiary((s) => ({ ...s, wallet: e.target.value }))}
                />
                <input
                  className="w-32 rounded border px-3 py-2"
                  placeholder="Share %"
                  value={newBeneficiary.share}
                  onChange={(e) => setNewBeneficiary((s) => ({ ...s, share: e.target.value }))}
                />
                <button onClick={addBeneficiary} className="rounded-md border px-3 py-2">Add</button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded border px-3 py-2"
                  placeholder="Remove beneficiary wallet"
                  value={removeAddress}
                  onChange={(e) => setRemoveAddress(e.target.value)}
                />
                <button onClick={removeBeneficiary} className="rounded-md border px-3 py-2">Remove</button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded border px-3 py-2"
                  placeholder="Update share wallet"
                  value={updateShareData.wallet}
                  onChange={(e) => setUpdateShareData((s) => ({ ...s, wallet: e.target.value }))}
                />
                <input
                  className="w-32 rounded border px-3 py-2"
                  placeholder="New share %"
                  value={updateShareData.share}
                  onChange={(e) => setUpdateShareData((s) => ({ ...s, share: e.target.value }))}
                />
                <button onClick={updateBeneficiaryShare} className="rounded-md border px-3 py-2">Update Share</button>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Owner-only: checkIn, setHeartbeatInterval, add/remove/update beneficiaries.</p>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Guardian Action</h2>
            <button onClick={declareDeceased} className="rounded-md bg-red-600 px-4 py-2 text-white">declareDeceased</button>
            <p className="mt-2 text-xs text-zinc-500">Guardian-only: Marks deceased and distributes ETH balances.</p>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Distribute ERC20</h2>
            <div className="flex items-center gap-2">
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="ERC20 token address"
                value={erc20Address}
                onChange={(e) => setErc20Address(e.target.value)}
              />
              <button onClick={distributeERC20} className="rounded-md border px-3 py-2">Distribute</button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Requires isDeceased = true.</p>
          </section>
        </div>

        <div className="mt-8 text-xs text-zinc-500">
          {!mounted ? (
            <div>...</div>
          ) : hasProvider ? (
            <div>Network: {isSepolia ? "Sepolia" : chainId || "-"}</div>
          ) : (
            <div>No injected provider detected. Install MetaMask.</div>
          )}
        </div>
      </div>
    </div>
  );
}
