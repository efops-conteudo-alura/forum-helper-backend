// src/services/scraperService.js

const axios = require('axios');
const cheerio = require('cheerio');
const authService = require('./authService');


let teamStatsCache = {
    data: null,
    lastFetched: null,
};
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

function classifyTopic(topic) {
    const title = topic.title.toLowerCase();

    // --- Firewall de Regras v5 ---
    // A primeira regra que corresponder define a categoria. A ordem é crucial.

    // REGRA 1: Erros explícitos, problemas graves ou reclamações são SEMPRE Complexos.
    const errorKeywords = [
        '[bug]', '[reclamação]', 'erro', 'não funciona', 'não consigo', 'não aparece',
        'problema', 'exception'
    ];
    if (errorKeywords.some(keyword => title.includes(keyword))) {
        return 'Complexo';
    }

    // REGRA 2: A palavra "Desafio" indica um problema a ser resolvido, portanto, Complexo.
    const challengeKeywords = ['desafio'];
    if (challengeKeywords.some(keyword => title.includes(keyword))) {
        return 'Complexo';
    }

    // REGRA 3: Submissões de projetos, portfólios e resoluções são para Feedback e incentivo.
    const feedbackKeywords = [
        '[projeto]', 'meu projeto', 'minha resolução', 'minha solução',
        'meu codigo', 'meu exercicio', 'portfolio', 'portifólio' // Adicionada grafia comum
    ];
    if (feedbackKeywords.some(keyword => title.includes(keyword))) {
        return 'Feedback';
    }

    // REGRA 4: Tópicos sobre conceitos avançados, abstratos ou de planejamento são Complexos.
    const advancedConceptKeywords = [
        'arquitetura', 'performance', 'melhorar', 'estratégia', 'campanha',
        'gestão', 'plano', 'otimizar', 'como seria', 'qual a melhor',
        'capacidade', 'kernel', 'batching', 'encapsulamento', 'parâmetros',
        'ambiente', 'sobrecarga', 'conflito', 'comportamento estranho'
    ];
    if (advancedConceptKeywords.some(keyword => title.includes(keyword))) {
        return 'Complexo';
    }

    // REGRA 5: Dúvidas que não caíram nas regras de complexidade são Fáceis.
    const easyKeywords = [
        'dúvida', 'como faço', 'o que é', 'iniciante', 'primeiros passos', 'ajuda'
    ];
    if (easyKeywords.some(keyword => title.includes(keyword))) {
        return 'Fácil';
    }

    // REGRA 6 (Padrão): Se o tópico passou por todos os firewalls, é mais seguro classificá-lo como Fácil.
    return 'Fácil';
}

async function extractTopicsFromPage(pageUrl) {
    try {
        const response = await axios.get(pageUrl);
        const $ = cheerio.load(response.data);
        const topicsList = [];

        $('li.forumList-item').each((index, element) => {
            const title = $(element).find('h2.forumList-item-subject-info-title a').text().trim();
            const link = 'https://cursos.alura.com.br' + $(element).find('h2.forumList-item-subject-info-title a').attr('href');
            const category = $(element).find('a.topic-breadCrumb-item-link').first().text().trim();
            const daysText = $(element).find('span.forumList-item-info-updatedAt').text().trim();
            const authorImage = $(element).find('img.forumList-item-info-avatar').attr('src');

            topicsList.push({
                title, link, category, daysText,
                authorImage: authorImage || 'https://via.placeholder.com/40/CCCCCC/FFFFFF?text=?'
            });
        });
        return topicsList;
    } catch (error) {
        console.error(`Erro ao extrair tópicos da URL: ${pageUrl}`, error.message);
        return [];
    }
}

async function fetchAllTopics() {
    let allTopics = [];
    let page = 1;
    while (true) {
        const pageUrl = `https://cursos.alura.com.br/forum/sem-resposta/${page}`;
        console.log(`Buscando tópicos da página ${page}...`);
        const topicsFromPage = await extractTopicsFromPage(pageUrl);
        if (topicsFromPage.length === 0) break;
        allTopics = allTopics.concat(topicsFromPage);
        page++;
    }

    const classifiedTopics = allTopics.map(topic => {
        const priority = classifyTopic(topic);
        return { ...topic, priority };
    });

    console.log(`Busca e classificação de tópicos finalizada. Total: ${classifiedTopics.length}`);
    return classifiedTopics;
}

async function fetchUserStats(username) {
    const cookie = await authService.getValidCookie();
    const url = `https://cursos.alura.com.br/user/${username}/actions`;
    console.log(`Buscando dados de ações em: ${url}`);
    const response = await axios.get(url, { headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
    const $ = cheerio.load(response.data);
    const agoraSP = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    const hoje = new Date(agoraSP);

    let contadorDia = 0;
    let contadorMes = 0;
    const diaAtual = hoje.getDate();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    $('table.actions-table tbody tr').each((index, element) => {
        const actionText = $(element).find('td.actions-table-actionName').text().trim();
        if (actionText === 'Resposta a tópico do fórum') {
            const actionTimestamp = $(element).find('.actions-table-actionDate').attr('data-action-time');
            if (actionTimestamp) {
                const dataAcao = new Date(actionTimestamp);
                if (dataAcao.getFullYear() === anoAtual && (dataAcao.getMonth() + 1) === mesAtual) {
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
        const profileUrl = `https://cursos.alura.com.br/user/${username}`;
        console.log(`Buscando avatar em: ${profileUrl}`);
        const response = await axios.get(profileUrl);
        const $ = cheerio.load(response.data);
        const avatarUrl = $('.profile-header-avatar').attr('src');
        if (!avatarUrl) {
            console.warn(`Avatar não encontrado para o usuário: ${username}`);
            return 'https://via.placeholder.com/40/CCCCCC/FFFFFF?text=?';
        }
        console.log(`Avatar encontrado para ${username}: ${avatarUrl}`);
        return avatarUrl;
    } catch (error) {
        console.error(`Erro ao buscar avatar para o usuário ${username}:`, error.message);
        return null;
    }
}

async function fetchTeamStats(usernames) {
    const now = new Date();
    const currentUserKey = usernames.slice().sort().join(',');

    if (
        teamStatsCache.data &&
        teamStatsCache.lastFetched &&
        (now - teamStatsCache.lastFetched < CACHE_DURATION_MS) &&
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
            teamStats.push({ username: user, postsToday: stats.postsToday, success: true });
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
    const url = `https://cursos.alura.com.br/user/${username}/actions`;
    console.log(`Buscando detalhes de atividade para ${username} em: ${url}`);

    try {
        const response = await axios.get(url, {
            headers: {
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);

        const activities = [];
        const currentYear = new Date().getFullYear(); // <<< OTIMIZAÇÃO: Pega o ano atual

        $('table.actions-table tbody tr').each((index, element) => {
            const actionText = $(element).find('td.actions-table-actionName').text().trim();

            if (actionText === 'Resposta a tópico do fórum') {
                const actionTimestamp = $(element).find('.actions-table-actionDate').attr('data-action-time');
                if (actionTimestamp) {
                    const activityDate = new Date(actionTimestamp);

                    // <<< OTIMIZAÇÃO: Pára de ler o HTML se a atividade for mais antiga que o ano atual
                    if (activityDate.getFullYear() < currentYear) {
                        console.log(`[${username}] Atividade de ${activityDate.getFullYear()} encontrada. Parando a busca para otimizar.`);
                        return false; // Interrompe o loop .each do Cheerio
                    }

                    activities.push({
                        type: 'forum-response',
                        date: actionTimestamp
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


module.exports = {
    fetchAllTopics,
    fetchUserStats,
    fetchUserAvatar,
    fetchTeamStats,
    fetchUserActivityDetails,
};

