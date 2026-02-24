/**
 * Telegram Bot with Flow Crypto Payments — Template
 *
 * A minimal, production-ready Telegram bot that accepts crypto deposits
 * and processes withdrawals using Flow (flow.vylth.com).
 *
 * Run:  node bot.js
 */

require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const { FlowPayments } = require("./flow-payments");

// ── Config ──────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL || "";
const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || "8080");

const flow = new FlowPayments({
  apiKey: process.env.FLOW_API_KEY,
  apiSecret: process.env.FLOW_API_SECRET,
  vendorKey: process.env.FLOW_VENDOR_KEY,
  vendorSecret: process.env.FLOW_VENDOR_SECRET,
  webhookSecret: process.env.FLOW_WEBHOOK_SECRET,
});

// Simple in-memory store. Replace with your database.
const userBalances = new Map(); // telegramId -> balance
const pendingInvoices = new Map(); // invoiceId -> telegramId
const userState = new Map(); // telegramId -> { step, data }

const bot = new Telegraf(BOT_TOKEN);

// ── Networks ────────────────────────────────────────────────────────

const NETWORKS = {
  bsc: "BSC (BEP-20)",
  tron: "Tron (TRC-20)",
  ethereum: "Ethereum (ERC-20)",
  solana: "Solana",
  polygon: "Polygon",
  ton: "TON",
  arbitrum: "Arbitrum",
  avalanche: "Avalanche",
};

// ── Helpers ─────────────────────────────────────────────────────────

function getBalance(uid) {
  return userBalances.get(uid) || 0;
}

function setState(uid, step, data = {}) {
  userState.set(uid, { step, ...data });
}

function getState(uid) {
  return userState.get(uid) || { step: null };
}

function clearState(uid) {
  userState.delete(uid);
}

// ── Commands ────────────────────────────────────────────────────────

bot.start((ctx) => {
  return ctx.reply(
    "Welcome! Choose an option:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback("Deposit", "deposit"),
        Markup.button.callback("Withdraw", "withdraw"),
      ],
      [Markup.button.callback("Balance", "balance")],
    ])
  );
});

bot.command("balance", (ctx) => {
  const balance = getBalance(ctx.from.id);
  return ctx.reply(`Your balance: $${balance.toFixed(2)}`);
});

// ── Balance Button ──────────────────────────────────────────────────

bot.action("balance", (ctx) => {
  ctx.answerCbQuery();
  const balance = getBalance(ctx.from.id);
  return ctx.editMessageText(`Your balance: $${balance.toFixed(2)}`);
});

bot.action("cancel", (ctx) => {
  ctx.answerCbQuery();
  clearState(ctx.from.id);
  return ctx.editMessageText("Cancelled.");
});

// ── Deposit Flow ────────────────────────────────────────────────────

bot.action("deposit", (ctx) => {
  ctx.answerCbQuery();

  const buttons = Object.entries(NETWORKS).map(([net, label]) => [
    Markup.button.callback(label, `deposit_net:${net}`),
  ]);
  buttons.push([Markup.button.callback("Cancel", "cancel")]);

  return ctx.editMessageText(
    "Select a network:",
    Markup.inlineKeyboard(buttons)
  );
});

bot.action(/^deposit_net:(.+)$/, (ctx) => {
  ctx.answerCbQuery();
  const network = ctx.match[1];

  setState(ctx.from.id, "deposit_amount", { network });

  return ctx.editMessageText(
    `Network: ${NETWORKS[network]}\n\nEnter the deposit amount in USD (e.g. 50):`
  );
});

// ── Withdraw Flow ───────────────────────────────────────────────────

bot.action("withdraw", (ctx) => {
  ctx.answerCbQuery();

  const buttons = Object.entries(NETWORKS)
    .slice(0, 3) // BSC, Tron, ETH
    .map(([net, label]) => [
      Markup.button.callback(label, `withdraw_net:${net}`),
    ]);
  buttons.push([Markup.button.callback("Cancel", "cancel")]);

  return ctx.editMessageText(
    "Select withdrawal network:",
    Markup.inlineKeyboard(buttons)
  );
});

bot.action(/^withdraw_net:(.+)$/, (ctx) => {
  ctx.answerCbQuery();
  const network = ctx.match[1];

  setState(ctx.from.id, "withdraw_address", { network });

  return ctx.editMessageText(
    `Network: ${NETWORKS[network]}\n\nSend your wallet address:`
  );
});

// ── Text Router ─────────────────────────────────────────────────────

bot.on("text", async (ctx) => {
  const uid = ctx.from.id;
  const state = getState(uid);
  const text = ctx.message.text.trim();

  // ── Deposit: enter amount
  if (state.step === "deposit_amount") {
    const amount = parseFloat(text.replace("$", ""));
    if (isNaN(amount) || amount < 1) {
      return ctx.reply("Please enter a valid amount (minimum $1).");
    }

    clearState(uid);
    const name = ctx.from.first_name || String(uid);

    await ctx.reply("Creating invoice...");

    try {
      const invoice = await flow.createInvoice({
        amount,
        network: state.network,
        currency: "USDT",
        customerName: `${name} (${uid})`,
        metadata: { telegram_user_id: uid },
        callbackUrl: WEBHOOK_URL,
      });

      pendingInvoices.set(invoice.id, uid);

      return ctx.reply(
        `Send exactly ${invoice.crypto_amount} USDT (${NETWORKS[state.network]})\n\n` +
          `Address:\n\`${invoice.deposit_address}\`\n\n` +
          `Or tap the button below to pay:`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.url("Open Payment Page", invoice.payment_url)],
          ]),
        }
      );
    } catch (err) {
      console.error("Failed to create invoice:", err);
      return ctx.reply("Failed to create invoice. Try again later.");
    }
  }

  // ── Withdraw: enter address
  if (state.step === "withdraw_address") {
    if (text.length < 20) {
      return ctx.reply("Invalid address. Try again.");
    }

    setState(uid, "withdraw_amount", {
      network: state.network,
      address: text,
    });

    const balance = getBalance(uid);
    return ctx.reply(
      `Balance: $${balance.toFixed(2)}\n\nEnter withdrawal amount in USD:`
    );
  }

  // ── Withdraw: enter amount
  if (state.step === "withdraw_amount") {
    const amount = parseFloat(text.replace("$", ""));
    const balance = getBalance(uid);

    if (isNaN(amount) || amount <= 0 || amount > balance) {
      return ctx.reply(
        `Invalid amount. Your balance is $${balance.toFixed(2)}.`
      );
    }

    clearState(uid);

    // Deduct balance
    userBalances.set(uid, balance - amount);

    await ctx.reply("Processing withdrawal...");

    try {
      const payout = await flow.createPayout({
        amount,
        recipientAddress: state.address,
        network: state.network,
        currency: "USDT",
        referenceId: `bot_withdraw_${uid}_${Date.now()}`,
      });

      const payoutId = payout.payout_id || payout.id || "";
      return ctx.reply(
        `Withdrawal submitted!\n\n` +
          `Amount: $${amount.toFixed(2)} USDT\n` +
          `Network: ${NETWORKS[state.network]}\n` +
          `Payout ID: \`${payoutId}\`\n\n` +
          `You'll be notified when it's sent.`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error("Payout failed:", err);
      // Refund
      userBalances.set(uid, (userBalances.get(uid) || 0) + amount);
      return ctx.reply("Withdrawal failed. Balance restored. Try again later.");
    }
  }

  return ctx.reply("Use /start to see options.");
});

// ── Flow Webhook Server ─────────────────────────────────────────────

const app = express();

// Raw body for signature verification
app.use(
  "/webhook/flow",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const signature = req.headers["x-flow-signature"] || "";

    if (!flow.verifyWebhook(req.body, signature)) {
      console.warn("Invalid webhook signature");
      return res.status(401).json({ error: "invalid signature" });
    }

    const data = JSON.parse(req.body.toString());
    const event = data.event || "";
    const payload = data.data || data;

    console.log(`Webhook received: ${event}`);

    if (event === "invoice.paid" || event === "invoice.completed") {
      handleDepositWebhook(payload);
    } else if (event === "payout.completed") {
      handlePayoutWebhook(payload);
    } else if (event === "payout.failed") {
      handlePayoutFailed(payload);
    }

    res.json({ status: "ok" });
  }
);

app.get("/health", (req, res) => res.json({ status: "healthy" }));

function handleDepositWebhook(data) {
  const invoiceId = data.invoice_id || data.id || "";
  const fiatAmount = parseFloat(data.fiat_amount || data.amount || 0);

  // Find the user
  let uid = data.metadata?.telegram_user_id;
  if (!uid) uid = pendingInvoices.get(invoiceId);
  if (!uid) {
    const name = data.customer_name || "";
    const match = name.match(/\((\d+)\)/);
    if (match) uid = parseInt(match[1]);
  }

  if (!uid) {
    console.error(`Could not identify user for invoice ${invoiceId}`);
    return;
  }

  uid = parseInt(uid);
  const newBalance = (userBalances.get(uid) || 0) + fiatAmount;
  userBalances.set(uid, newBalance);
  pendingInvoices.delete(invoiceId);

  console.log(`Credited $${fiatAmount.toFixed(2)} to user ${uid}`);

  // Notify user
  bot.telegram
    .sendMessage(
      uid,
      `Deposit confirmed! +$${fiatAmount.toFixed(2)}\nNew balance: $${newBalance.toFixed(2)}`
    )
    .catch((err) => console.error("Failed to notify user:", err));
}

function handlePayoutWebhook(data) {
  const payoutId = data.payout_id || data.id || "";
  const txHash = data.tx_hash || "";
  console.log(`Payout ${payoutId} completed. TX: ${txHash}`);

  // TODO: Notify user with tx_hash
}

function handlePayoutFailed(data) {
  const payoutId = data.payout_id || data.id || "";
  const amount = parseFloat(data.amount || 0);
  console.error(`Payout ${payoutId} failed. Amount: ${amount}`);

  // TODO: Refund user balance and notify
}

// ── Start ───────────────────────────────────────────────────────────

async function main() {
  bot.launch();
  console.log("Bot started (polling mode)");

  app.listen(WEBHOOK_PORT, () => {
    console.log(`Webhook server on port ${WEBHOOK_PORT}`);
  });

  // Graceful shutdown
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch(console.error);
