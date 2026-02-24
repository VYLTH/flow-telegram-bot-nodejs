# Telegram Bot + Crypto Payments (Node.js)

Accept USDT, BTC, ETH, and 20+ cryptocurrencies in your Telegram bot — across 12 blockchain networks — with a single API integration.

**No custody risk. 0.5% fees. Funds go directly to your wallet.**

Built on [Flow](https://flow.vylth.com) — the self-custody crypto payment rail.

---

## What This Is

A production-ready Telegram bot template with crypto payments baked in. Clone it, add your keys, and your bot accepts deposits and processes withdrawals in minutes.

**Two files do everything:**

| File | Purpose |
|------|---------|
| `flow-payments.js` | Drop-in Flow API client — invoices, payouts, webhook verification |
| `bot.js` | Telegram bot with deposit/withdraw flow wired up |

Zero external payment SDKs. No build step. Just Node.js.

## Supported Networks

| Network | Tokens |
|---------|--------|
| BSC (BNB Chain) | USDT, USDC, BNB |
| Tron | USDT, TRX |
| Ethereum | USDT, USDC, ETH |
| Solana | USDT, USDC, SOL |
| Polygon | USDT, USDC, MATIC |
| TON | USDT, TON |
| Arbitrum | USDT, USDC |
| Avalanche | USDT, USDC |
| Bitcoin | BTC |
| Litecoin | LTC |
| Dogecoin | DOGE |
| XRP Ledger | XRP |

## Quick Start

### 1. Clone

```bash
git clone https://github.com/VYLTH/flow-telegram-bot-nodejs.git
cd flow-telegram-bot-nodejs
```

### 2. Get Your Keys

- **Telegram:** Talk to [@BotFather](https://t.me/BotFather) → create a bot → copy the token
- **Flow:** Sign up at [flow.vylth.com](https://flow.vylth.com) → API Keys → Create Key → Enable Auto-Payout

### 3. Configure

```bash
cp .env.example .env
# Edit .env with your tokens
```

### 4. Run

**With Docker:**
```bash
docker compose up -d
```

**Without Docker:**
```bash
npm install
node bot.js
```

Your bot is now accepting crypto payments.

## How It Works

```
User taps "Deposit" in your bot
        │
        ▼
Selects network (BSC, Tron, ETH, etc.)
        │
        ▼
Enters amount ($50)
        │
        ▼
Flow generates a unique deposit address
        │
        ▼
User sends crypto (via payment page or directly)
        │
        ▼
Flow monitors the blockchain
        │
        ▼
Payment confirmed → webhook fires → balance credited
```

## The Flow API Client

`flow-payments.js` is a standalone module you can drop into any Node.js project:

```javascript
const { FlowPayments } = require("./flow-payments");

const flow = new FlowPayments({
  apiKey: "fl_your_key",
  apiSecret: "your_secret",
  webhookSecret: "your_webhook_secret", // optional
});

// Create a payment invoice
const invoice = await flow.createInvoice({
  amount: 25.0,
  network: "bsc",
  currency: "USDT",
  customerName: "john",
  metadata: { userId: 12345 },
  callbackUrl: "https://yourdomain.com/webhook/flow",
});

console.log(invoice.payment_url);     // Send this to the customer
console.log(invoice.deposit_address); // Or show the address directly
console.log(invoice.crypto_amount);   // Exact amount to send

// Check invoice status
const status = await flow.getInvoice(invoice.id);
console.log(status.status); // pending, confirming, completed, expired

// Send a payout (requires vendor keys)
const payout = await flow.createPayout({
  amount: 100.0,
  recipientAddress: "0x1234...",
  network: "bsc",
  currency: "USDT",
});
```

## Webhooks

Flow sends HTTP POST requests to your `callbackUrl` when payments are confirmed:

```json
{
  "event": "invoice.completed",
  "data": {
    "invoice_id": "inv_abc123",
    "fiat_amount": 25.00,
    "crypto_amount": "25.12",
    "crypto_currency": "USDT",
    "network": "bsc",
    "tx_hash": "0xabc...",
    "status": "completed",
    "metadata": { "userId": 12345 },
    "customer_name": "john"
  }
}
```

Verify the signature:

```javascript
app.use("/webhook/flow", express.raw({ type: "application/json" }), (req, res) => {
  const isValid = flow.verifyWebhook(req.body, req.headers["x-flow-signature"]);
  if (!isValid) return res.status(401).json({ error: "invalid signature" });

  const data = JSON.parse(req.body.toString());
  // Process the payment...
});
```

## Adding Payments to an Existing Bot

You don't need this whole template. Just copy `flow-payments.js` into your project:

```javascript
// your-existing-bot.js
const { FlowPayments } = require("./flow-payments");
const flow = new FlowPayments({ apiKey: "fl_...", apiSecret: "..." });

// Anywhere in your bot handler:
const invoice = await flow.createInvoice({ amount: 10, network: "bsc" });
await ctx.reply(`Pay here: ${invoice.payment_url}`);
```

That's it. One file, one function call, crypto payments.

## Local Development

For testing webhooks locally, use [ngrok](https://ngrok.com):

```bash
ngrok http 8080
# Copy the HTTPS URL → set as WEBHOOK_URL in .env
```

## Why Flow?

| | Flow | Typical Gateway |
|---|---|---|
| Fee | **0.5%** | 1-3% |
| Self-custody | **Yes** | No — they hold your funds |
| Chains | **12+** | 3-8 |
| Settlement | **Minutes** | Hours to days |
| Integration | **1 API call** | SDK + dashboard setup |

Your keys, your wallets, your funds. Flow never touches your money.

## Also Available

- **[Python version](https://github.com/VYLTH/flow-telegram-bot-python)** — same template using `python-telegram-bot`

## License

MIT — use it however you want.

---

Built with [Flow](https://flow.vylth.com) — the self-custody crypto payment rail.
