const puppeteer = require("puppeteer");
const axios = require("axios");

const baseUrl = "https://cursos.alura.com.br/";

let cachedCookie = null;
let loginPromise = null;

async function loginAndGetCookie() {
    console.log("🔐 Iniciando login automático com Puppeteer...");

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    try {
        await page.goto(baseUrl + "loginForm", { waitUntil: "networkidle2" });
        await page.waitForSelector("#login-email", { timeout: 10000 });
        await page.type("#login-email", process.env.ALURA_USER);
        await page.type("#password", process.env.ALURA_PASSWORD);
        await page.keyboard.press("Enter");
        await page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: 20000,
        });

        console.log("✅ Login realizado com sucesso!");
        const cookies = await page.cookies();
        const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

        cachedCookie = cookieString;
        return cookieString;
    } catch (error) {
        console.error("❌ Falha no login automático:", error.message);
        throw new Error("Não foi possível fazer login.");
    } finally {
        await browser.close();
    }
}

async function isCookieValid(cookie) {
    try {
        const response = await axios.get(baseUrl + "dashboard", {
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
    } catch {
        return false;
    }
}

async function getValidCookie() {
    if (cachedCookie) {
        const valido = await isCookieValid(cachedCookie);
        if (valido) {
            console.log("♻️ Usando cookie válido do cache.");
            return cachedCookie;
        } else {
            console.log("⚠️ Cookie expirado, fazendo novo login...");
            cachedCookie = null;
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
