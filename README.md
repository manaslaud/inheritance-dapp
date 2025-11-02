### README: Inheritance Wallet dApp (Next.js + ethers.js)

A simple Next.js dApp to interact with the Inheritance Wallet smart contract on Sepolia. The UI supports owner and guardian workflows: configure guardians and beneficiaries, set heartbeat liveness, check-in, declare deceased, and distribute ETH/ERC‑20.

### Contract
- Network: Sepolia (chainId 11155111)
- Address: `0xeB783b6C91Ca5d80544Ee96DC2B25D36FCFA2275`
- ABI: `src/lib/abi.json`
- Solidity source (reference): `/home/manas/Code/Web3/SC Lab Proj/inheritance.sol`

### Stack
- Next.js (App Router), TypeScript
- ethers.js v6, MetaMask
- OpenZeppelin Ownable, ReentrancyGuard (in contract)
- Node.js 18+

### Features
- Wallet connect and automatic Sepolia network switch
- Read: `owner`, `isDeceased`, `heartbeatInterval`, `lastCheckIn` (formatted), beneficiaries
- Owner actions: `checkIn`, `setHeartbeatInterval`, `addBeneficiary`, `removeBeneficiary`, `updateBeneficiaryShare`
- Guardian action: `declareDeceased` (distributes ETH)
- Post‑declaration: `distributeERC20(tokenAddress)`
- UX safeguards: network/code preflight checks, hydration‑safe rendering, clear status messages

### Prerequisites
- Node.js 18+
- MetaMask browser extension
- Sepolia ETH for gas on the connected EOA

### Getting Started
```bash
cd "/home/manas/Code/Web3/SC Lab Proj/inheritance-dapp"
npm install
npm run dev
```
Then open `http://localhost:3000`.

- Click “Connect Wallet”
- If prompted, click “Switch to Sepolia”
- Interact with the contract using the sections in the UI

### Project Structure
```text
inheritance-dapp/
  src/
    app/
      page.tsx           # Main UI: reads, actions, formatting, preflight checks
    lib/
      contract.ts        # CONTRACT_ADDRESS, ABI import, Sepolia chain ID
      abi.json           # Contract ABI used by the frontend
  next.config.ts
  tsconfig.json
  package.json
  README.md
```

### Configuration
- Contract address and chain ID are defined in `src/lib/contract.ts`. If you redeploy, update:
```ts
export const CONTRACT_ADDRESS = "0xeB783b6C91Ca5d80544Ee96DC2B25D36FCFA2275";
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7"; // 11155111
```

### Usage Notes
- Owner-only calls require the connected account to equal `owner()`.
- Guardian-only call: `declareDeceased` requires the connected account to be a guardian and the heartbeat interval to have elapsed since `lastCheckIn`.
- Depositing ETH uses a normal value transfer to the contract address (triggers `receive()`).

### Common Actions
- Connect & switch network: Use the top buttons to connect and switch to Sepolia.
- Refresh state: “Refresh” button in the “Contract State” section.
- Deposit ETH: Enter amount in ETH and click “Send”.
- Owner:
  - Check-in: Click “checkIn”.
  - Set heartbeat: Enter seconds (≥ 86400) and click “Update”.
  - Add beneficiary: Enter wallet and percent share, click “Add”.
  - Remove beneficiary: Enter wallet, click “Remove”.
  - Update share: Enter wallet + new percent, click “Update Share”.
- Guardian:
  - Declare deceased: Click “declareDeceased” (distributes ETH).
- ERC‑20 distribution:
  - Enter token address and click “Distribute” (requires `isDeceased = true`).

### Troubleshooting
- Hydration mismatch on first load:
  - The page defers provider-dependent UI until mount; if you still see a warning, refresh the page. Avoid browser extensions that change DOM before React loads.
- could not decode result data (BAD_DATA):
  - Cause: Wrong network or no contract code at the configured address.
  - Fix: Click “Switch to Sepolia”. If still failing, verify the address is deployed on Sepolia.
- could not coalesce error: “External transactions to internal accounts cannot include data”:
  - Cause: The selected “from” is the contract address (or a non‑EOA). You must select your EOA in MetaMask.
- execution reverted: “Too short” when updating heartbeat:
  - Contract enforces `>= 1 days` (≥ 86400 seconds). Enter a value ≥ 86400.
- Metamask “owner only” failures:
  - Ensure the connected account equals the `owner()` value shown in the state panel.

### Scripts
```bash
npm run dev     # start dev server
npm run build   # production build
npm run start   # start production server after build
npm run lint    # run ESLint
```

### Security Considerations
- Owner and guardian roles are enforced on-chain via `onlyOwner` and `onlyGuardians`.
- Distribution uses ReentrancyGuard for safety.
- Shares are percentages (0–100 per beneficiary); total is not enforced to sum to 100—configure carefully.
- Consider multiple guardians and social processes to mitigate collusion risk.

### License
- Smart contract SPDX: MIT (see `inheritance.sol`)
- Frontend code: MIT unless otherwise noted

### References
- Contract: `/home/manas/Code/Web3/SC Lab Proj/inheritance.sol`
- Frontend: `/home/manas/Code/Web3/SC Lab Proj/inheritance-dapp`
- ABI: `src/lib/abi.json`
