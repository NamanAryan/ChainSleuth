# ChainSleuth 🔍  
### Explainable AML Detection & Transaction Flow Investigation System

ChainSleuth is a **RegTech-focused Anti-Money Laundering (AML) investigation platform** designed to analyze blockchain transaction data, detect suspicious fund movement patterns, and visually explain *why* a wallet is flagged.

Unlike black-box ML systems, ChainSleuth uses **deterministic, rule-based AML typologies**, making every detection **transparent, auditable, and explainable** — just like real-world compliance tools.

---

## 🚀 Key Capabilities

- 📊 **Transaction Network Visualization**
- 🧠 **Rule-based AML Pattern Detection**
- 🔍 **Case-level Investigation Dashboard**
- 📈 **Explainable Risk Scoring**
- 🧾 **Transaction Evidence & Audit Trail**
- 📤 **Exportable Investigation Summary**

Built for **analysts, auditors, and compliance teams**.

---

## 🧠 AML Patterns Detected (No ML)

ChainSleuth detects industry-standard AML typologies using graph analysis and temporal rules:

| Pattern | Description |
|------|------------|
| **Fan-Out** | One wallet distributes funds to many wallets |
| **Fan-In** | Many wallets consolidate funds into one wallet |
| **Circular Transactions** | Funds loop through wallets and return to origin |
| **Layering** | Funds routed through multiple intermediaries to obfuscate origin |
| **Structuring (Smurfing)** | Large value split into many small transfers |
| **Rapid Pass-Through** | Funds quickly received and sent onward |
| **Peel Chain** | Repeated small amounts peeled off across wallets |
| **Mixer Interaction** | Transactions involving known mixer contracts |
| **High-Volume Velocity** | Abnormally fast or high-value movements |

Each pattern is **deterministically detected**, time-bounded, and explainable.

---

## 🧮 Risk Scoring (Explainable)

Every wallet receives a **risk score (0–100)** based on detected patterns.

Example:
