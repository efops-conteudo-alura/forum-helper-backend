const axios = require("axios");
const authService = require("../services/authService");
const DEFAULT_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
};

async function fetchHtml(url) {
    const cookie = await authService.getValidCookie();
    const headers = { ...DEFAULT_HEADERS };

    if (cookie) {
        headers.Cookie = cookie;
    }

    const response = await axios.get(url, { headers });

    return response.data;
}

module.exports = { fetchHtml };
