const axios = require("axios");
const cheerio = require("cheerio");
const URLS = require("../utils/urls");

let cachedCookie = null;
let loginPromise = null;
let cookieValidUntil = 0;

const CLIENT_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};

function mergeCookies(existing, setCookieArray) {
    if (!setCookieArray) return existing;
    let cookieMap = {};
    if (existing) {
        existing.split(";").forEach((pair) => {
            const [k, ...v] = pair.trim().split("=");
            cookieMap[k.trim()] = v.join("=");
        });
    }
    setCookieArray.forEach((entry) => {
        const [nv] = entry.split(";");
        const [k, ...v] = nv.split("=");
        cookieMap[k.trim()] = v.join("=");
    });
    return Object.entries(cookieMap)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
}

async function loginAndGetCookie() {
    console.log("🔐 Iniciando login automático com axios...");
    const loginPageUrl = URLS.BASE_URL + "/loginForm";
    let cookieStr = "";

    const getResp = await axios.get(loginPageUrl, {
        headers: CLIENT_HEADERS,
        maxRedirects: 0,
        validateStatus: (s) => s < 400,
    });
    cookieStr = mergeCookies(cookieStr, getResp.headers["set-cookie"]);

    const $ = cheerio.load(getResp.data);
    const form = $("form").first();
    let formAction = form.attr("action") || "/loginForm";
    if (formAction && !formAction.startsWith("http")) {
        formAction = URLS.BASE_URL + formAction;
    }
    const csrfToken =
        $('input[name="_csrf"]').val() ||
        $('input[name="csrf_token"]').val() ||
        $('input[name="__csrf"]').val() ||
        $('input[name="csrfmiddlewaretoken"]').val();

    const params = new URLSearchParams();
    params.append("login-email", process.env.ALURA_USER);
    params.append("password", process.env.ALURA_PASSWORD);
    if (csrfToken) params.append("_csrf", csrfToken);

    let postResp = await axios.post(formAction, params.toString(), {
        headers: {
            ...CLIENT_HEADERS,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: cookieStr,
            Referer: loginPageUrl,
        },
        maxRedirects: 0,
        validateStatus: (s) => s < 400 || (s >= 300 && s < 400),
    });
    cookieStr = mergeCookies(cookieStr, postResp.headers["set-cookie"]);

    let redirectCount = 0;
    while (
        postResp.status >= 300 &&
        postResp.status < 400 &&
        redirectCount < 5
    ) {
        const location = postResp.headers["location"];
        const redirectUrl = location.startsWith("http")
            ? location
            : URLS.BASE_URL + location;

        postResp = await axios.get(redirectUrl, {
            headers: { ...CLIENT_HEADERS, Cookie: cookieStr, Referer: formAction },
            maxRedirects: 0,
            validateStatus: (s) => s < 400 || (s >= 300 && s < 400),
        });
        cookieStr = mergeCookies(cookieStr, postResp.headers["set-cookie"]);
        redirectCount++;
    }

    if (cookieStr.length < 20) {
        throw new Error("Cookie vazio ou inválido. Login falhou.");
    }

    console.log("✅ Login realizado com sucesso!");
    cachedCookie = cookieStr;
    return cookieStr;
}

async function isCookieValid(cookie) {
    try {
        const response = await axios.get(URLS.BASE_URL + "/dashboard", {
            headers: {
                Cookie: cookie,
                "User-Agent": "Mozilla/5.0",
            },
            maxRedirects: 0,
            validateStatus: (status) => status === 200 || status === 302,
        });

        if (response.status === 200 && response.data.includes("meus cursos")) {
            return true;
        }
        return false;
    } catch (error) {
        console.log(error.message);
        return false;
    }
}

async function getValidCookie() {
    const now = Date.now();

    if (cachedCookie && now < cookieValidUntil) {
        return cachedCookie;
    }

    if (cachedCookie) {
        const valido = await isCookieValid(cachedCookie);
        if (valido) {
            console.log("♻️ Usando cookie válido do cache.");
            cookieValidUntil = now + 5 * 60 * 1000;
            return cachedCookie;
        } else {
            console.log("⚠️ Cookie expirado, fazendo novo login...");
            cachedCookie = null;
            cookieValidUntil = 0;
        }
    }
    if (loginPromise) {
        console.log("⏳ Login em andamento, aguardando...");
        return await loginPromise;
    }

    try {
        loginPromise = loginAndGetCookie();
        return await loginPromise;
    } finally {
        loginPromise = null;
    }
}

module.exports = { getValidCookie };
