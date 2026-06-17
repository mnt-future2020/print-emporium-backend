// Shiprocket API client.
// Docs: https://apidocs.shiprocket.in/
//
// - Credentials are read from the ShiprocketSettings collection (managed via
//   the admin dashboard). Plaintext creds are cached in memory and the cache
//   is invalidated by `invalidateConfigCache()` whenever the admin saves new
//   settings.
// - Auth tokens are valid for ~10 days; we cache them in memory and refresh
//   on demand or whenever the upstream returns 401.

import ShiprocketSettings from "../models/ShiprocketSettings.js";
import { decryptPassword } from "../utils/encryption.js";

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000; // refresh 1 day before the 10-day expiry
const REQUEST_TIMEOUT_MS = 15000;

class ShiprocketError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ShiprocketError";
    this.status = status;
    this.body = body;
  }
}

// Cached config (decrypted) + cached token
let cachedConfig = null;
let cachedToken = null;
let tokenExpiresAt = 0;
let inFlightLogin = null;

/**
 * Forces the next request to re-read settings from the DB and re-login.
 * Call this from the controller after the admin saves new credentials.
 */
export const invalidateConfigCache = () => {
  cachedConfig = null;
  cachedToken = null;
  tokenExpiresAt = 0;
};

const loadConfig = async () => {
  if (cachedConfig) return cachedConfig;
  const settings = await ShiprocketSettings.findOne();
  if (!settings || !settings.enabled) {
    throw new ShiprocketError(
      "Shiprocket is not configured. Add credentials in Settings → Shiprocket.",
      500,
    );
  }
  if (!settings.email || !settings.password) {
    throw new ShiprocketError(
      "Shiprocket credentials are incomplete. Update them in Settings → Shiprocket.",
      500,
    );
  }
  cachedConfig = {
    email: settings.email,
    password: decryptPassword(settings.password),
    pickupLocation: settings.pickupLocation || "Primary",
    pickupPincode: settings.pickupPincode || "",
    webhookToken: settings.webhookToken ? decryptPassword(settings.webhookToken) : null,
  };
  return cachedConfig;
};

/**
 * Returns the decrypted settings for controllers (pickup location, webhook token).
 * Does NOT throw if settings are missing — returns null instead so callers can
 * decide how to respond.
 */
export const getResolvedConfig = async () => {
  try {
    return await loadConfig();
  } catch {
    return null;
  }
};

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const login = async () => {
  const { email, password } = await loadConfig();
  const res = await fetchWithTimeout(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.token) {
    throw new ShiprocketError(
      body?.message || "Shiprocket login failed",
      res.status,
      body,
    );
  }
  cachedToken = body.token;
  tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  return cachedToken;
};

const getToken = async ({ force = false } = {}) => {
  if (!force && cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  if (!inFlightLogin) {
    inFlightLogin = login().finally(() => {
      inFlightLogin = null;
    });
  }
  return inFlightLogin;
};

const request = async (path, { method = "GET", body, query } = {}) => {
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const send = async (token) => {
    return fetchWithTimeout(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let token = await getToken();
  let res = await send(token);
  if (res.status === 401) {
    token = await getToken({ force: true });
    res = await send(token);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ShiprocketError(
      data?.message ||
        data?.errors?.[0]?.message ||
        `Shiprocket request failed (${res.status})`,
      res.status,
      data,
    );
  }
  return data;
};

/**
 * Validate a candidate set of credentials by attempting a login.
 * Used by the settings controller to fail-fast on bad input.
 */
export const verifyCredentials = async ({ email, password }) => {
  const res = await fetchWithTimeout(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.token) {
    throw new ShiprocketError(
      body?.message || "Invalid Shiprocket credentials",
      res.status,
      body,
    );
  }
  return true;
};

// ──────────────────────────────────────────────────────────────
//  Public API
// ──────────────────────────────────────────────────────────────

export const checkServiceability = async ({
  pickupPincode,
  deliveryPincode,
  weightKg,
  codAmount = 0,
  declaredValue = 0,
}) => {
  const query = {
    pickup_postcode: pickupPincode,
    delivery_postcode: deliveryPincode,
    weight: weightKg,
    cod: codAmount > 0 ? 1 : 0,
  };
  if (declaredValue > 0) query.declared_value = declaredValue;

  const data = await request("/courier/serviceability/", {
    method: "GET",
    query,
  });
  const raw = data?.data?.available_courier_companies || [];
  const recommendedId =
    data?.data?.recommended_courier_company_id ||
    data?.data?.shiprocket_recommended_courier_id ||
    null;

  const couriers = raw.map((c) => {
    // Sum every field ending in _charge or _charges to compute the real total
    let totalCharges = 0;
    for (const [key, val] of Object.entries(c)) {
      if ((key.endsWith("_charge") || key.endsWith("_charges")) && key !== "rto_charges") {
        const n = Number(val);
        if (n > 0) totalCharges += n;
      }
    }
    return { ...c, total_charges: totalCharges || c.rate };
  });

  return { couriers, recommendedId };
};

export const createOrder = async (payload) => {
  return request("/orders/create/adhoc", { method: "POST", body: payload });
};

export const assignAwb = async ({ shipmentId, courierId }) => {
  return request("/courier/assign/awb", {
    method: "POST",
    body: { shipment_id: shipmentId, courier_id: courierId },
  });
};

export const requestPickup = async ({ shipmentIds }) => {
  return request("/courier/generate/pickup", {
    method: "POST",
    body: { shipment_id: shipmentIds },
  });
};

export const trackByAwb = async (awb) =>
  request(`/courier/track/awb/${encodeURIComponent(awb)}`);

export const trackByShipmentId = async (shipmentId) =>
  request(`/courier/track/shipment/${encodeURIComponent(shipmentId)}`);

export const generateLabel = async ({ shipmentIds }) =>
  request("/courier/generate/label", {
    method: "POST",
    body: { shipment_id: shipmentIds },
  });

export const generateInvoice = async ({ orderIds }) =>
  request("/orders/print/invoice", {
    method: "POST",
    body: { ids: orderIds },
  });

export const cancelShiprocketOrder = async ({ orderIds }) =>
  request("/orders/cancel", {
    method: "POST",
    body: { ids: orderIds },
  });

export const generateManifest = async ({ shipmentIds }) =>
  request("/manifests/generate", {
    method: "POST",
    body: { shipment_id: shipmentIds },
  });

export const getManifest = async ({ orderId }) =>
  request("/manifests/print", {
    method: "POST",
    body: { order_ids: [orderId] },
  });

/**
 * Fetch all pickup locations configured in the Shiprocket account.
 * Returns array of { id, pickup_location (nickname), pin_code, city, state, ... }.
 */
export const getPickupLocations = async () => {
  const data = await request("/settings/company/pickup");
  const addresses = data?.data?.shipping_address || [];
  return addresses.map((a) => ({
    id: a.id,
    nickname: a.pickup_location,
    pincode: String(a.pin_code),
    address: a.address,
    city: a.city,
    state: a.state,
    phone: a.phone,
  }));
};

export { ShiprocketError };
