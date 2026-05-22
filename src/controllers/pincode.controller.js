// Pincode lookup — proxies public pincode APIs with in-memory caching + fallback chain.
// Primary: api.zippopotam.us (valid SSL, no district names).
// Fallback: api.postalpincode.in (accurate district names; cert expired May 2026 so we
// bypass cert validation for this specific call — safe since it's a public read-only API).

import { Agent } from "undici";

const CACHE_MAX = 2000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — pincode data rarely changes
const UPSTREAM_TIMEOUT_MS = 4000;

// Bypass expired cert ONLY for postalpincode.in fallback. Read-only public data, no auth.
const insecureDispatcher = new Agent({
  connect: { rejectUnauthorized: false },
});

const cache = new Map(); // key: pincode (string), value: { data, expiresAt }

const INDIAN_STATES = new Set([
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa",
  "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala",
  "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
  "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
  "Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands",
  "Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi",
  "Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
]);

const matchState = (raw) => {
  if (!raw) return "";
  const found = [...INDIAN_STATES].find(
    (s) => s.toLowerCase() === raw.trim().toLowerCase(),
  );
  return found || raw.trim();
};

const getFromCache = (pincode) => {
  const hit = cache.get(pincode);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(pincode);
    return null;
  }
  // LRU bump
  cache.delete(pincode);
  cache.set(pincode, hit);
  return hit.data;
};

const setCache = (pincode, data) => {
  if (cache.size >= CACHE_MAX) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(pincode, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

export const lookupPincode = async (req, res) => {
  const { pincode } = req.params;
  if (!/^\d{6}$/.test(pincode)) {
    return res.status(400).json({
      success: false,
      message: "Invalid pincode format",
    });
  }

  const cached = getFromCache(pincode);
  if (cached) {
    res.set("Cache-Control", "public, max-age=86400");
    return res.status(200).json({ success: true, cached: true, ...cached });
  }

  const data = await tryPostalPincode(pincode) || await tryZippopotam(pincode);

  if (!data) {
    return res.status(502).json({
      success: false,
      message: "Pincode lookup failed",
    });
  }

  if (data === "not_found") {
    return res.status(404).json({ success: false, message: "Pincode not found" });
  }

  setCache(pincode, data);
  res.set("Cache-Control", "public, max-age=86400");
  return res.status(200).json({ success: true, cached: false, ...data });
};

// Try postalpincode.in (better data with district names). Cert is expired so we use insecure agent.
const tryPostalPincode = async (pincode) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    const upstream = await fetch(
      `https://api.postalpincode.in/pincode/${pincode}`,
      { signal: controller.signal, dispatcher: insecureDispatcher },
    );
    clearTimeout(timer);
    if (!upstream.ok) return null;
    const json = await upstream.json();
    const entry = Array.isArray(json) ? json[0] : null;
    if (!entry || entry.Status !== "Success" || !entry.PostOffice?.length) {
      return entry?.Status === "Error" ? "not_found" : null;
    }
    return {
      state: matchState(entry.PostOffice[0].State),
      district: entry.PostOffice[0].District || "",
      postOffices: entry.PostOffice.map((p) => ({
        name: p.Name,
        district: p.District,
      })),
    };
  } catch {
    return null;
  }
};

// Fallback: zippopotam.us (valid SSL, no district names).
const tryZippopotam = async (pincode) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    const upstream = await fetch(
      `https://api.zippopotam.us/in/${pincode}`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (upstream.status === 404) return "not_found";
    if (!upstream.ok) return null;
    const json = await upstream.json();
    if (!json?.places?.length) return "not_found";
    return {
      state: matchState(json.places[0].state),
      district: json.places[0]["place name"] || "",
      postOffices: json.places.map((p) => ({
        name: p["place name"],
        district: p.state,
      })),
    };
  } catch {
    return null;
  }
};
