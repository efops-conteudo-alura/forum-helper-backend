const axios = require("axios");
const cheerio = require("cheerio");
const authService = require("./authService");
const { Classifier } = require("../utils/classifier");
const { mapBIRowToStats } = require("../utils/mappers");
const URLS  = require("../utils/urls");

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

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

async function extractTopicsFromPage(pageUrl, cookie = null) {
    try {
        const headers = { ...DEFAULT_HEADERS };

        if (cookie) {
            headers["Cookie"] = cookie;
        }

        const response = await axios.get(pageUrl, { headers });
        const $ = cheerio.load(response.data);
        const topicsList = [];
        $("li.forumList-item").each((index, element) => {
            const title = $(element).find("h2.forumList-item-subject-info-title a").text().trim();
            const link = URLS.BASE_URL + $(element).find("h2.forumList-item-subject-info-title a").attr("href");

            const category = $(element).find("a.topic-breadCrumb-item-link").first().text().trim();
            const daysText = $(element).find(".forumList-item-info-updatedAt").text().trim();

            let authorImage = $(element).find("img.forumList-item-info-avatar").attr("src");

            if (!authorImage || authorImage.includes("avatar_user.png")) {
                authorImage = URLS.PLACEHOLDER_AVATAR;
            }

            topicsList.push({
                title,
                link,
                category,
                daysText,
                authorImage: authorImage,
            });
        });
        return topicsList;
    } catch (error) {
        console.error(`Erro ao extrair tópicos da URL: ${pageUrl}`, error.message);
        return [];
    }
}

async function fetchBBTopics() {
    try {
        console.log("[Worker BB] Buscando tópicos do Banco do Brasil (logado)...");
        const cookie = await authService.getValidCookie();

        const topics = await extractTopicsFromPage(URLS.BB_URL, cookie);

        const classifiedTopics = topics.map((topic) => {
            const priority = classifyTopic(topic);
            return { ...topic, priority };
        });

        console.log(`[Worker BB] Encontrados e classificados ${classifiedTopics.length} tópicos do Banco do Brasil.`);
        return classifiedTopics;
    } catch (error) {
        console.error("[Worker BB] Falha ao buscar tópicos do Banco do Brasil:", error.message);
        return [];
    }
}

async function fetchAllTopics() {
    const MAX_PAGES_TO_SCRAPE = 5;
    let allTopics = [];
    let page = 1;

    console.log(`[Worker Geral] Iniciando busca de tópicos gerais (limite de ${MAX_PAGES_TO_SCRAPE} páginas)...`);

    while (page <= MAX_PAGES_TO_SCRAPE) {
        console.log(`[Worker Geral] Buscando tópicos da página ${page}...`);

        const topicsFromPage = await extractTopicsFromPage(URLS.PAGE_URL(page));

        if (topicsFromPage.length === 0) {
            console.log(`[Worker Geral] Página ${page} vazia. Parando a busca.`);
            break;
        }

        allTopics = allTopics.concat(topicsFromPage);
        page++;
    }

    const classifiedTopics = allTopics.map((topic) => {
        const priority = classifyTopic(topic);
        return { ...topic, priority };
    });

    console.log(`[Worker Geral] Busca e classificação de tópicos gerais finalizada. Total: ${classifiedTopics.length}`);
    return classifiedTopics;
}

async function fetchUserStats(username) {
    const cookie = await authService.getValidCookie();
    const url = URLS.USER_STATS_URL(username);
    console.log(`Buscando dados de ações em: ${url}`);

    const response = await axios.get(url, {
        headers: {
            Cookie: cookie,
            ...DEFAULT_HEADERS
        },
    });

    const $ = cheerio.load(response.data);
    const agoraSP = new Date().toLocaleString("en-US", {
        timeZone: "America/Sao_Paulo",
    });
    const hoje = new Date(agoraSP);

    let contadorDia, contadorMes = 0;
    const diaAtual = hoje.getDate();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    $("table.actions-table tbody tr").each((index, element) => {
        const actionText = $(element).find("td.actions-table-actionName").text().trim();

        if (actionText === "Resposta a tópico do fórum") {
            const actionTimestamp = $(element)
                .find(".actions-table-actionDate")
                .attr("data-action-time");
            if (actionTimestamp) {
                const dataAcao = new Date(actionTimestamp);
                if (dataAcao.getFullYear() === anoAtual && dataAcao.getMonth() + 1 === mesAtual) {
                    contadorMes++;
                    if (dataAcao.getDate() === diaAtual) {
                        contadorDia++;
                    }
                }
            }
        }
    });
    console.log(`Contagem de stats finalizada. Posts hoje: ${contadorDia}, Posts no mês: ${contadorMes}.`);
    return { postsToday: contadorDia, postsMonth: contadorMes };
}

async function fetchUserAvatar(username) {
    try {
        const response = await axios.get(URLS.PROFILE_URL(username));
        const $ = cheerio.load(response.data);
        const avatarUrl = $(".profile-header-avatar").attr("src");

        if (!avatarUrl) {
            return URLS.PLACEHOLDER;
        }

        return avatarUrl;
    } catch (error) {
        return null;
    }
}

async function fetchTeamStats(usernames) {
    const now = new Date();
    const currentUserKey = usernames.slice().sort().join(",");

    if (
        teamStatsCache.data &&
        teamStatsCache.lastFetched &&
        now - teamStatsCache.lastFetched < TEAM_STATS_CACHE_DURATION_MS &&
        teamStatsCache.usersKey === currentUserKey
    ) {
        console.log("Servindo estatísticas da equipe a partir do cache (mesma equipe).");
        return teamStatsCache.data;
    }

    console.log("Cache inválido ou equipe diferente. Buscando novos dados...");

    const teamStats = [];
    for (const username of usernames) {
        const user = username.trim();
        try {
            const stats = await fetchUserStats(user);
            teamStats.push({
                username: user,
                postsToday: stats.postsToday,
                success: true,
            });
        } catch (error) {
            console.error(`Falha ao buscar dados para: ${user}. Erro: ${error.message}`);
            teamStats.push({ username: user, postsToday: 0, success: false });
        }
    }

    teamStatsCache.data = teamStats;
    teamStatsCache.lastFetched = new Date();
    teamStatsCache.usersKey = currentUserKey;
    console.log("Novas estatísticas da equipe salvas no cache.");

    return teamStats;
}

async function fetchUserActivityDetails(username) {
    const cookie = await authService.getValidCookie();
    const url = URLS.USER_STATS_URL(username);
    console.log(`Buscando detalhes de atividade para ${username} em: ${url}`);

    try {
        const response = await axios.get(url, {
            headers: {
                Cookie: cookie,
                ...DEFAULT_HEADERS
            },
        });
        const $ = cheerio.load(response.data);

        const activities = [];
        const currentYear = new Date().getFullYear();

        $("table.actions-table tbody tr").each((index, element) => {
            const actionText = $(element).find("td.actions-table-actionName").text().trim();

            if (actionText === "Resposta a tópico do fórum") {
                const actionTimestamp = $(element)
                    .find(".actions-table-actionDate")
                    .attr("data-action-time");
                if (actionTimestamp) {
                    const activityDate = new Date(actionTimestamp);

                    if (activityDate.getFullYear() < currentYear) {
                        return false;
                    }

                    activities.push({
                        type: "forum-response",
                        date: actionTimestamp,
                    });
                }
            }
        });

        console.log(`Extraídas ${activities.length} respostas do fórum para ${username} (apenas ano atual).`);
        return activities;
    } catch (error) {
        console.error(`Erro crítico ao buscar atividades detalhadas para ${username}:`, error.message);
        throw new Error(`Não foi possível buscar as atividades de ${username}.`);
    }
}

async function fetchGeneralStats() {
    try {
        if (biCache && Date.now() - biCache.timestamp < 600000) return biCache.data;

        console.log("📊 [BI] Baixando dados para o Dashboard...");

        const { data: { result: rawData } } = await axios.get(URLS.BI_STATS_URL);
        const stats = rawData ? rawData.map(mapBIRowToStats) : [];

        biCache = { data: stats, timestamp: Date.now() };
        return stats;
    } catch (error) {
        console.error("Erro BI:", error.message);
        return [];
    }
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
};
