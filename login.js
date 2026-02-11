import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";

const COOKIES_PATH = path.resolve("./cookies.json");

async function getBrowserAndPage() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    try {
        const cookiesString = await fs.readFile(COOKIES_PATH, "utf8");
        const cookies = JSON.parse(cookiesString);
        await page.setCookie(...cookies);
        console.log("✅ Cookies carregados");
    } catch {
        console.log("⚠️ Nenhum cookie salvo ainda");
    }

    return { browser, page };
}

async function ensureLoggedIn(page) {
    await page.goto("https://site-exemplo.com/pagina-privada", {
        waitUntil: "networkidle2",
    });

    if (await page.$("#campoUsuario")) {
        console.log("🔐 Fazendo login...");
        await page.type("#campoUsuario", process.env.USERNAME);
        await page.type("#campoSenha", process.env.PASSWORD);
        await page.click("#botaoLogin");
        await page.waitForNavigation({ waitUntil: "networkidle2" });

        const cookies = await page.cookies();
        await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));
        console.log("💾 Cookies salvos");
    } else {
        console.log("🔓 Já estava logado");
    }
}

export async function criarSessao() {
    const { browser, page } = await getBrowserAndPage();
    await ensureLoggedIn(page);
    return { browser, page };
}
