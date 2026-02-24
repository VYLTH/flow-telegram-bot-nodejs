---
title: Accept USDT in Your Telegram Bot in 10 Minutes
published: false
description: Add crypto payments to any Telegram bot with a single API call. Python and Node.js examples included.
tags: telegram, crypto, python, javascript
cover_image:
---

# Accept USDT in Your Telegram Bot in 10 Minutes

Telegram bots handle millions of dollars in crypto transactions every day — gaming bots, trading bots, subscription bots, tipping bots. But most developers either roll their own janky wallet system or hand their funds to a custodial gateway that takes 2-3% and settles in days.

There's a better way. Here's how to add crypto payments to any Telegram bot — self-custody, 0.5% fees, settlement in minutes — using a single API call.

## The Problem

If you're building a Telegram bot that handles money, you've probably hit one of these walls:

- **Custodial gateways** hold your funds and charge 1-3% per transaction
- **Rolling your own** means managing wallets, monitoring blockchains, handling confirmations — weeks of work
- **Most APIs** support 3-5 chains. Your users want BSC, Tron, Solana, TON...

What if you could accept USDT (or BTC, ETH, or 20+ other coins) across 12 chains with one function call, and the funds go straight to your wallet?

## The Solution

[Flow](https://flow.vylth.com) is a self-custody payment rail. You generate your own HD wallet. Flow creates unique deposit addresses for each payment, monitors the blockchain, and sweeps funds directly to your wallet when confirmed. You never hand over custody.

Here's what the integration looks like.

## Python Example

**One file does everything.** Copy [`flow_payments.py`](https://github.com/VYLTH/flow-telegram-bot-python/blob/main/flow_payments.py) into your project:

```python
from flow_payments import FlowPayments

flow = FlowPayments(
    api_key="fl_your_key",
    api_secret="your_secret",
)

# Create a payment invoice
invoice = await flow.create_invoice(
    amount=25.00,
    network="bsc",       # or tron, ethereum, solana, ton, polygon...
    currency="USDT",
    customer_name="user_12345",
    metadata={"telegram_user_id": 12345},
    callback_url="https://yourdomain.com/webhook/flow",
)

# Send the payment link to your user
payment_url = invoice["payment_url"]
deposit_address = invoice["deposit_address"]
crypto_amount = invoice["crypto_amount"]
```

That's the entire deposit flow. Three lines of actual logic.

In your Telegram bot handler, it looks like this:

```python
async def handle_deposit(update, context):
    user_id = update.effective_user.id

    invoice = await flow.create_invoice(
        amount=50.00,
        network="bsc",
        currency="USDT",
        customer_name=f"user_{user_id}",
        metadata={"telegram_user_id": user_id},
        callback_url=WEBHOOK_URL,
    )

    keyboard = [[InlineKeyboardButton("Pay", url=invoice["payment_url"])]]

    await update.message.reply_text(
        f"Send {invoice['crypto_amount']} USDT (BSC)\n\n"
        f"Address: `{invoice['deposit_address']}`",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode="Markdown",
    )
```

## Node.js Example

Same pattern, different language. Copy [`flow-payments.js`](https://github.com/VYLTH/flow-telegram-bot-nodejs/blob/main/flow-payments.js) into your project:

```javascript
const { FlowPayments } = require("./flow-payments");

const flow = new FlowPayments({
  apiKey: "fl_your_key",
  apiSecret: "your_secret",
});

const invoice = await flow.createInvoice({
  amount: 25.0,
  network: "bsc",
  currency: "USDT",
  customerName: "user_12345",
  metadata: { telegramUserId: 12345 },
  callbackUrl: "https://yourdomain.com/webhook/flow",
});

console.log(invoice.payment_url);
console.log(invoice.deposit_address);
```

In a Telegraf bot:

```javascript
bot.action("deposit", async (ctx) => {
  const invoice = await flow.createInvoice({
    amount: 50,
    network: "bsc",
    currency: "USDT",
    customerName: `user_${ctx.from.id}`,
    metadata: { telegramUserId: ctx.from.id },
    callbackUrl: WEBHOOK_URL,
  });

  await ctx.reply(
    `Send ${invoice.crypto_amount} USDT (BSC)\n\nAddress: \`${invoice.deposit_address}\``,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.url("Pay", invoice.payment_url)],
      ]),
    }
  );
});
```

## Handling Webhooks

When the user pays, Flow sends a webhook to your `callback_url`:

```json
{
  "event": "invoice.completed",
  "data": {
    "invoice_id": "inv_abc123",
    "fiat_amount": 25.00,
    "crypto_currency": "USDT",
    "network": "bsc",
    "tx_hash": "0xabc...",
    "metadata": { "telegram_user_id": 12345 }
  }
}
```

Handle it and credit the user:

**Python (aiohttp):**
```python
async def handle_webhook(request):
    raw_body = await request.read()
    signature = request.headers.get("X-Flow-Signature", "")

    if not flow.verify_webhook(raw_body, signature):
        return web.json_response({"error": "invalid"}, status=401)

    data = await request.json()
    payload = data["data"]
    user_id = payload["metadata"]["telegram_user_id"]
    amount = payload["fiat_amount"]

    # Credit the user in your database
    await credit_balance(user_id, amount)
    return web.json_response({"status": "ok"})
```

**Node.js (Express):**
```javascript
app.use("/webhook/flow", express.raw({ type: "application/json" }), (req, res) => {
  if (!flow.verifyWebhook(req.body, req.headers["x-flow-signature"])) {
    return res.status(401).json({ error: "invalid" });
  }

  const { data } = JSON.parse(req.body.toString());
  const userId = data.metadata.telegram_user_id;
  const amount = data.fiat_amount;

  // Credit the user in your database
  creditBalance(userId, amount);
  res.json({ status: "ok" });
});
```

## Withdrawals (Payouts)

If your bot also needs to send crypto to users (withdrawals, prizes, payouts):

```python
payout = await flow.create_payout(
    amount=100.00,
    recipient_address="0x1234...",
    network="bsc",
    currency="USDT",
)
```

This requires vendor keys (separate from merchant keys). Get them from your Flow dashboard under Settings → Vendor Keys.

## Supported Chains

| Network | Tokens |
|---------|--------|
| BSC | USDT, USDC, BNB |
| Tron | USDT, TRX |
| Ethereum | USDT, USDC, ETH |
| Solana | USDT, USDC, SOL |
| Polygon | USDT, USDC |
| TON | USDT, TON |
| Arbitrum | USDT, USDC |
| Avalanche | USDT, USDC |
| Bitcoin | BTC |
| Litecoin | LTC |
| Dogecoin | DOGE |
| XRP | XRP |

One API, all chains. Your user picks the network, Flow handles the rest.

## Full Templates

If you want a complete working bot (not just the payment code), grab one of these:

- **Python:** [github.com/VYLTH/flow-telegram-bot-python](https://github.com/VYLTH/flow-telegram-bot-python)
- **Node.js:** [github.com/VYLTH/flow-telegram-bot-nodejs](https://github.com/VYLTH/flow-telegram-bot-nodejs)

Both include deposit flow, withdrawal flow, webhook handling, Docker setup, and are ready to run.

## Why Self-Custody Matters

Most payment gateways work like this: your customer sends crypto → the gateway holds it → you wait 24-48 hours → the gateway sends you your money minus their cut.

That means:
- **Counterparty risk** — if the gateway gets hacked or goes down, your funds are gone
- **Slow settlement** — you're waiting days for money that confirmed on-chain in minutes
- **Higher fees** — they charge more because they're taking custody risk

Self-custody flips this. Flow generates deposit addresses from *your* HD wallet. The crypto goes directly to addresses you control. Flow monitors the blockchain, confirms the transaction, fires the webhook, and sweeps the funds to your main wallet. At no point does anyone else hold your money.

0.5% fee. Minutes, not days. Your keys.

---

**Flow** — [flow.vylth.com](https://flow.vylth.com)
