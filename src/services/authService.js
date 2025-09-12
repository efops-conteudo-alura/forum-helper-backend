// src/services/authService.js

const puppeteer = require('puppeteer');

let cachedCookie = null;
// <<< NOVA VARIÁVEL >>> 
// Para controlar o processo de login que está em andamento.
let loginPromise = null; 

async function loginAndGetCookie() {
    console.log('🔐 Iniciando processo de login automático com Puppeteer...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        await page.goto('https://cursos.alura.com.br/loginForm', { waitUntil: 'networkidle2' });
        await page.type('#login-email', process.env.ALURA_USER);
        await page.type('#password', process.env.ALURA_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log('✅ Login realizado com sucesso!');

        const cookies = await page.cookies();
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
        
        cachedCookie = cookieString;
        return cookieString;

    } catch (error) {
        console.error('❌ Falha no processo de login com Puppeteer:', error);
        throw new Error('Não foi possível fazer o login automático.');
    } finally {
        await browser.close();
    }
}

async function getValidCookie() {
    // 1. Se o cookie já existe no cache, retorne imediatamente.
    if (cachedCookie) {
        console.log('♻️ Usando cookie de sessão em cache.');
        return cachedCookie;
    }

    // 2. <<< NOVA LÓGICA >>> 
    // Se um login já está em andamento, não inicie outro. Apenas espere o que está
    // rolando terminar e retorne o resultado dele.
    if (loginPromise) {
        console.log('⏳ Login já em andamento, aguardando...');
        return await loginPromise;
    }

    // 3. Se não há cookie e nenhum login em andamento, esta é a primeira requisição.
    // Inicie o processo de login.
    try {
        // Guarda a "promessa" de login na nossa variável de controle
        loginPromise = loginAndGetCookie();
        return await loginPromise;
    } finally {
        // 4. <<< IMPORTANTE >>>
        // Após o término do login (sucesso ou falha), limpe a variável de controle.
        // Isso permite que um novo login seja disparado no futuro se o cookie expirar.
        loginPromise = null;
    }
}

module.exports = {
    getValidCookie
};