const axios = require("axios");
const cheerio = require("cheerio");
const { Classifier } = require("../utils/classifier");
const { mapBIRowToStats } = require("../utils/mappers");
const { parseUserStats, parseExtractTopicsFromPage, parseActivityDetails } = require("../utils/parsing");
const URLS = require("../utils/urls");
const { fetchHtml } = require("../infra/httpClient");

const TEAM_STATS_CACHE_DURATION_MS = 60 * 60 * 1000;
let biCache = null;

let teamStatsCache = {
    data: null,
    lastFetched: null,
    usersKey: null,
};

function classifyTopic(topic) {
    const title = topic.title.toLowerCase();

    for (const [, category] of Object.entries(Classifier)) {
        const { label, keywords } = category;
        if (keywords.some((word) => title.includes(word.toLowerCase()))) {
            return label;
        }
    }
    return "Fácil";
}

async function extractTopicsFromPage(pageUrl, useAuth = true) {
    try {
        const response = await fetchHtml(pageUrl, useAuth);
        const $ = cheerio.load(response);
        const topicsList = parseExtractTopicsFromPage($);
        return topicsList;
    } catch (error) {
        console.error(`Erro ao extrair tópicos da URL: ${pageUrl}`, error.message);
        return [];
    }
}

async function fetchBBTopics() {
    try {
        console.log("[Worker BB] Buscando tópicos do Banco do Brasil (logado)...");
        const topics = await extractTopicsFromPage(URLS.BB_URL, true);
        const classifiedTopics = topics.map((topic) => {
            const priority = classifyTopic(topic);
            return { ...topic, priority };
        });

        console.log(`[Worker BB] Encontrados e classificados ${classifiedTopics.length} tópicos.`);
        return classifiedTopics;
    } catch (error) {
        console.error("[Worker BB] Falha:", error.message);
        return [];
    }
}

async function fetchAllTopics() {
    const MAX_PAGES_TO_SCRAPE = 5;
    let allTopics = [];
    let page = 1;

    console.log(`[Worker Geral] Iniciando busca PÚBLICA de tópicos (sem login)...`);

    while (page <= MAX_PAGES_TO_SCRAPE) {
        console.log(`[Worker Geral] Buscando tópicos da página ${page}...`);

        const topicsFromPage = await extractTopicsFromPage(URLS.PAGE_URL(page), false);

        if (topicsFromPage.length === 0) {
            console.log(`[Worker Geral] Página ${page} vazia. Parando.`);
            break;
        }

        allTopics = allTopics.concat(topicsFromPage);
        page++;
    }

    const classifiedTopics = allTopics.map((topic) => {
        const priority = classifyTopic(topic);
        return { ...topic, priority };
    });

    console.log(`[Worker Geral] Finalizado. Total: ${classifiedTopics.length}`);
    return classifiedTopics;
}

async function fetchUserStats(username) {
    const url = URLS.USER_STATS_URL(username);
    const response = await fetchHtml(url, true); // Login BR

    console.log(`Buscando dados de ações em: ${url}`);
    const $ = cheerio.load(response);
    const hoje = getCurrentDateInSP();
    const { contadorDia, contadorMes } = parseUserStats($, hoje);

    console.log(`Stats BR: ${contadorDia} hoje / ${contadorMes} mês.`);
    return { postsToday: contadorDia, postsMonth: contadorMes };
}

async function fetchLatamUserStats(username) {
    const url = URLS.LATAM_USER_STATS_URL(username);
    console.log(`🌎 [LATAM] Buscando ações para: ${username}`);

    try {
        const response = await fetchHtml(url, true);
        const $ = cheerio.load(response);
        const hoje = getCurrentDateInSP();
        const { contadorDia, contadorMes } = parseUserStats($, hoje);

        console.log(`✅ [LATAM] Sucesso: ${contadorDia} hoje / ${contadorMes} mês`);
        return { postsToday: contadorDia, postsMonth: contadorMes, platform: 'LATAM' };
    } catch (error) {
        console.error(`❌ [LATAM] Erro:`, error.message);
        return { postsToday: 0, postsMonth: 0, platform: 'LATAM' };
    }
}

async function fetchUserAvatar(username) {
    try {
        const response = await axios.get(URLS.PROFILE_URL(username));
        const $ = cheerio.load(response.data);
        const avatarUrl = $(".profile-header-avatar").attr("src");
        if (!avatarUrl) return URLS.PLACEHOLDER;
        return avatarUrl;
    } catch (error) { return null; }
}

async function fetchTeamStats(usernames) {
    const now = new Date();
    const currentUserKey = usernames.slice().sort().join(",");
    if (teamStatsCache.data && teamStatsCache.lastFetched && now - teamStatsCache.lastFetched < TEAM_STATS_CACHE_DURATION_MS && teamStatsCache.usersKey === currentUserKey) {
        return teamStatsCache.data;
    }
    const teamStats = [];
    for (const username of usernames) {
        const user = username.trim();
        try {
            const stats = await fetchUserStats(user);
            teamStats.push({ username: user, postsToday: stats.postsToday, success: true });
        } catch (error) {
            teamStats.push({ username: user, postsToday: 0, success: false });
        }
    }
    teamStatsCache.data = teamStats;
    teamStatsCache.lastFetched = new Date();
    teamStatsCache.usersKey = currentUserKey;
    return teamStats;
}

async function fetchUserActivityDetails(username) {
    const url = URLS.USER_STATS_URL(username);
    try {
        const currentYear = new Date().getFullYear();
        const response = await fetchHtml(url, true);
        const $ = cheerio.load(response);
        const activities = parseActivityDetails($, currentYear);
        return activities;
    } catch (error) {
        throw new Error(`Erro ao buscar atividades: ${username}.`);
    }
}

async function fetchGeneralStats() {
    try {
        if (biCache && Date.now() - biCache.timestamp < 600000) return biCache.data;
        const { data: { result: rawData } } = await axios.get(URLS.BI_STATS_URL);
        const stats = rawData ? rawData.map(mapBIRowToStats) : [];
        biCache = { data: stats, timestamp: Date.now() };
        return stats;
    } catch (error) { return []; }
}

module.exports = {
    fetchAllTopics,
    fetchUserStats,
    fetchUserAvatar,
    fetchTeamStats,
    fetchUserActivityDetails,
    extractTopicsFromPage,
    fetchBBTopics,
    fetchGeneralStats,
    fetchLatamUserStats,
};

function getCurrentDateInSP() {
    const agoraSP = new Date().toLocaleString("en-US", {
        timeZone: "America/Sao_Paulo",
    });
    return new Date(agoraSP);
}