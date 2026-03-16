const puppeteer = require("puppeteer");
const axios = require("axios");
const URLS = require("../utils/urls");

let cachedCookie = null;
let loginPromise = null;
let cookieValidUntil = 0;

async function loginAndGetCookie() {
    console.log("🌎 [LATAM] Iniciando login automático...");

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote"
        ],
    });
    
    const page = await browser.newPage();

    try {
        page.on('error', err => {});
        page.on('pageerror', err => {});
        page.setDefaultNavigationTimeout(60000);
        page.setDefaultTimeout(30000);

        console.log("🌎 [LATAM] Acessando formulário...");
        await page.goto(URLS.LATAM_BASE_URL + "/loginForm", { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#login-email", { visible: true });
        
        await page.type("#login-email", process.env.ALURA_LATAM_USER);
        await page.type("#password", process.env.ALURA_LATAM_PASSWORD);
        
        console.log("⏳ [LATAM] Autenticando...");
        await page.keyboard.press("Enter");

        console.log("⏳ [LATAM] Aguardando redirecionamentos seguros...");
        
        let isLogged = false;
        for (let i = 0; i < 20; i++) { 
            await new Promise(r => setTimeout(r, 1000));
            try {
                const currentUrl = page.url();
                if (currentUrl.includes("dashboard") || currentUrl.includes("user")) {
                    isLogged = true;
                    break;
                }
            } catch (e) {
            }
        }

        if (!isLogged) {
            console.log("⚠️ [LATAM] Tempo esgotado aguardando a URL. Tentando capturar os cookies mesmo assim...");
        } else {
            console.log("✅ [LATAM] Redirecionamento concluído!");
        }

        const cookies = await page.cookies();
        const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

        if (cookieString.length < 20) {
            throw new Error("Cookie vazio ou inválido. O login falhou.");
        }

        console.log("✅ [LATAM] Cookies capturados com sucesso!");
        cachedCookie = cookieString;
        
        cookieValidUntil = Date.now() + (5 * 60 * 1000); 
        
        return cookieString;

    } catch (error) {
        console.error("❌ [LATAM] Falha crítica no login:", error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

async function isCookieValid(cookie) {
    try {
        const response = await axios.get(URLS.LATAM_BASE_URL + "/dashboard?_t=" + Date.now(), {
            headers: { Cookie: cookie, "User-Agent": "Mozilla/5.0" },
            maxRedirects: 0,
            validateStatus: (status) => status === 200 || status === 302,
        });
        return response.status === 200;
    } catch { 
        return false; 
    }
}

async function getValidCookie() {
    const now = Date.now();
    if (cachedCookie && now < cookieValidUntil) return cachedCookie;
    
    if (cachedCookie) {
        const valido = await isCookieValid(cachedCookie);
        if (valido) {
            cookieValidUntil = now + 5 * 60 * 1000; 
            return cachedCookie;
        } else {
            console.log("⚠️ [LATAM] Cookie expirado, gerando um novo login...");
            cachedCookie = null;
            cookieValidUntil = 0;
        }
    }
    
    if (loginPromise) return await loginPromise;
    
    try {
        loginPromise = loginAndGetCookie();
        return await loginPromise;
    } finally { 
        loginPromise = null; 
    }
}

module.exports = { getValidCookie };