/**
 * Flow Payment Integration — Drop-in crypto payments for Telegram bots.
 *
 * Usage:
 *   const { FlowPayments } = require('./flow-payments');
 *   const flow = new FlowPayments({ apiKey: 'fl_...', apiSecret: '...' });
 *   const invoice = await flow.createInvoice({ amount: 25, network: 'bsc' });
 *   // Send invoice.payment_url to your user
 */

const crypto = require("crypto");

const FLOW_API_URL = "https://flow.vylth.com/api/flow";

class FlowPayments {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey        - Flow API key (fl_...)
   * @param {string} opts.apiSecret     - Flow API secret
   * @param {string} [opts.vendorKey]   - Vendor key (for payouts)
   * @param {string} [opts.vendorSecret]- Vendor secret (for payouts)
   * @param {string} [opts.webhookSecret] - For verifying webhook signatures
   * @param {string} [opts.apiUrl]      - Override API base URL
   */
  constructor({
    apiKey,
    apiSecret,
    vendorKey,
    vendorSecret,
    webhookSecret,
    apiUrl,
  }) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.vendorKey = vendorKey || "";
    this.vendorSecret = vendorSecret || "";
    this.webhookSecret = webhookSecret || "";
    this.apiUrl = (apiUrl || FLOW_API_URL).replace(/\/$/, "");
  }

  // ── Invoices (Deposits) ──────────────────────────────────────────

  /**
   * Create a payment invoice.
   * @param {object} opts
   * @param {number} opts.amount         - Amount in USD
   * @param {string} [opts.network]      - Blockchain network (bsc, tron, ethereum, etc.)
   * @param {string} [opts.currency]     - Crypto currency (USDT, BTC, ETH, etc.)
   * @param {string} [opts.customerName] - Customer identifier
   * @param {string} [opts.customerEmail]
   * @param {object} [opts.metadata]     - Arbitrary metadata (returned in webhooks)
   * @param {string} [opts.callbackUrl]  - Webhook URL for payment notifications
   * @returns {Promise<object>} Invoice with id, payment_url, deposit_address, crypto_amount, expires_at
   */
  async createInvoice({
    amount,
    network = "bsc",
    currency = "USDT",
    customerName = "",
    customerEmail = "",
    metadata = null,
    callbackUrl = null,
  }) {
    const payload = {
      amount: parseFloat(amount.toFixed(2)),
      crypto_currency: currency.toUpperCase(),
      network: network.toLowerCase(),
      customer_name: customerName,
    };
    if (customerEmail) payload.customer_email = customerEmail;
    if (metadata) payload.metadata = metadata;
    if (callbackUrl) payload.callback_url = callbackUrl;

    return this._request("POST", "/invoices/", payload, "merchant");
  }

  /**
   * Get invoice status.
   * @param {string} invoiceId
   * @returns {Promise<object>} Invoice with status: pending, confirming, completed, expired
   */
  async getInvoice(invoiceId) {
    return this._request("GET", `/invoices/${invoiceId}`, null, "merchant");
  }

  // ── Payouts (Withdrawals) ────────────────────────────────────────

  /**
   * Send crypto to an address. Requires vendor keys.
   * @param {object} opts
   * @param {number} opts.amount           - Amount in USD
   * @param {string} opts.recipientAddress - Wallet address
   * @param {string} [opts.network]        - Blockchain network
   * @param {string} [opts.currency]       - Crypto currency
   * @param {string} [opts.referenceId]    - Your internal reference
   * @param {string} [opts.recipientName]
   * @param {string} [opts.note]
   * @returns {Promise<object>} Payout with payout_id
   */
  async createPayout({
    amount,
    recipientAddress,
    network = "bsc",
    currency = "USDT",
    referenceId = "",
    recipientName = "",
    note = "",
  }) {
    if (!this.vendorKey || !this.vendorSecret) {
      throw new FlowAPIError(0, { error: "Vendor keys required for payouts" });
    }

    const payload = {
      amount: parseFloat(amount.toFixed(2)),
      currency: currency.toUpperCase(),
      network: network.toLowerCase(),
      recipient_address: recipientAddress,
    };
    if (referenceId) payload.reference_id = referenceId;
    if (recipientName) payload.recipient_name = recipientName;
    if (note) payload.note = note;

    return this._request("POST", "/vendor/payout", payload, "vendor");
  }

  // ── Webhook Verification ─────────────────────────────────────────

  /**
   * Verify a Flow webhook signature.
   * @param {Buffer|string} rawBody - Raw request body
   * @param {string} signature      - X-Flow-Signature header value
   * @returns {boolean}
   */
  verifyWebhook(rawBody, signature) {
    if (!this.webhookSecret) return true;

    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");

    const sig = signature.replace("sha256=", "");
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(sig, "hex")
    );
  }

  // ── Internal ─────────────────────────────────────────────────────

  async _request(method, path, body, authType) {
    const headers = { "Content-Type": "application/json" };

    if (authType === "vendor") {
      headers["X-Vendor-Key"] = this.vendorKey;
      headers["X-Vendor-Secret"] = this.vendorSecret;
    } else {
      headers["X-API-Key"] = this.apiKey;
      headers["X-API-Secret"] = this.apiSecret;
    }

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.apiUrl}${path}`, opts);
    const data = await res.json();

    if (!res.ok) throw new FlowAPIError(res.status, data);
    return data;
  }
}

class FlowAPIError extends Error {
  constructor(status, data) {
    super(`Flow API error ${status}: ${JSON.stringify(data)}`);
    this.status = status;
    this.data = data;
  }
}

module.exports = { FlowPayments, FlowAPIError };
