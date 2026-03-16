const axios = require("axios");
const authService = require("../services/authService");
const authServiceLatam = require("../services/authServiceLatam");

const DEFAULT_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
};

async function fetchHtml(url, useAuth = true) {
    let cookie = null;

    if (useAuth) {
        if (url.includes("aluracursos.com")) {
            cookie = await authServiceLatam.getValidCookie();
        } else {
            cookie = await authService.getValidCookie();
        }
    }

    const headers = { ...DEFAULT_HEADERS };

    if (cookie) {
        headers.Cookie = cookie;
    }

    const separator = url.includes("?") ? "&" : "?";
    const urlAntiCache = `${url}${separator}_t=${Date.now()}`;

    const response = await axios.get(urlAntiCache, { headers });
    return response.data;
}

module.exports = { fetchHtml };