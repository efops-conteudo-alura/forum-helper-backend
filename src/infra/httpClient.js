const axios = require("axios");
const http = require("http");
const https = require("https");
const authService = require("../services/authService");
const authServiceLatam = require("../services/authServiceLatam");

const KEEP_ALIVE_MS = 30000;

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10, timeout: KEEP_ALIVE_MS });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10, timeout: KEEP_ALIVE_MS });

const DEFAULT_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
};

const CACHE_TTL_MS = 30000;
const responseCache = new Map();

function getCacheKey(url) {
    return url.split("?")[0];
}

async function fetchHtml(url, useAuth = true) {
    const cacheKey = getCacheKey(url);
    const cached = responseCache.get(cacheKey);
    const now = Date.now();
    const headers = { ...DEFAULT_HEADERS };

    if (!useAuth && cached && now - cached.timestamp < CACHE_TTL_MS) {
        return cached.html;
    }

    if (!useAuth && cached) {
        if (cached.lastModified) {
            headers["If-Modified-Since"] = cached.lastModified;
        }
        if (cached.etag) {
            headers["If-None-Match"] = cached.etag;
        }
    }

    let cookie = null;
    if (useAuth) {
        if (url.includes("aluracursos.com")) {
            cookie = await authServiceLatam.getValidCookie();
        } else {
            cookie = await authService.getValidCookie();
        }
    }
    if (cookie) {
        headers.Cookie = cookie;
    }

    const separator = url.includes("?") ? "&" : "?";
    const urlAntiCache = `${url}${separator}_t=${now}`;

    const axiosConfig = {
        headers,
        httpAgent: url.startsWith("https") ? httpsAgent : httpAgent,
        httpsAgent,
        validateStatus: (status) => status === 200 || status === 304,
    };

    const response = await axios.get(urlAntiCache, axiosConfig);

    if (response.status === 304 && cached) {
        cached.timestamp = now;
        return cached.html;
    }

    if (!useAuth) {
        responseCache.set(cacheKey, {
            html: response.data,
            lastModified: response.headers["last-modified"],
            etag: response.headers["etag"],
            timestamp: now,
        });
    }

    return response.data;
}

module.exports = { fetchHtml };
