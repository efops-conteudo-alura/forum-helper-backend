const axios = require('axios');
const cheerio = require('cheerio');
const authService = require('./authService');


const BI_STATS_URL = "https://bi.caelumalura.com.br/public/result?id=a41d8792-0079-11f1-bbf5-02001700bcbe&format=json"
let biCache = null;

let teamStatsCache = {
    data: null,
    lastFetched: null,
    usersKey: null
};
const TEAM_STATS_CACHE_DURATION_MS = 60 * 60 * 1000; 

function classifyTopic(topic) {
    const title = topic.title.toLowerCase();

    const errorKeywords = [
        '[bug]', '[reclamação]', 'erro', 'não funciona', 'não consigo', 'não aparece',
        'problema', 'exception', 'falha', 'não abre', 'não roda', 'não carrega',
        'travando', 'crash', 'bugado', 'não compila', 'não imprime', 'não executa',
        'message:', 'traceback', 'stack overflow'
    ];
    if (errorKeywords.some(keyword => title.includes(keyword))) {
        return 'Complexo';
    }

    const challengeKeywords = ['tentei fazer', 'extra', 'melhoria', 'otimizar'];
    if (challengeKeywords.some(keyword => title.includes(keyword))) {
        return 'Complexo';
    }

    const feedbackKeywords = [
        '[projeto]','[Projeto]', 'meu projeto', 'minha resolução', 'minha solução',
        'meu codigo', 'meu exercício', 'meu exercicio', 'meu portfólio',
        'portifólio', 'projeto final', 'projeto concluído', 'quero feedback',
        'avaliação', 'dêem feedback', 'meu site', 'meu app', 'desafios finais', 
        'desafio - hora da pratica','resolução','desafio'
    ];
    if (feedbackKeywords.some(keyword => title.includes(keyword))) {
        return 'Feedback';
    }

    const advancedConceptKeywords = [
        'arquitetura', 'performance', 'melhorar', 'estratégia', 'gestão',
        'otimizar', 'melhor forma', 'qual a melhor', 'boas práticas',
        'padrão de projeto', 'design pattern', 'estrutura', 'pipeline',
        'ambiente', 'sobrecarga', 'comportamento estranho', 'variáveis de ambiente',
        'testes automatizados', 'deploy', 'banco de dados', 'api rest',
        'persistência', 'thread', 'assíncrono', 'async', 'await', 'kernel',
        'hook', 'encapsulamento', 'parâmetro', 'modularização'
    ];
    if (advancedConceptKeywords.some(keyword => title.includes(keyword))) {
        return 'Complexo';
    }

    const easyKeywords = [
        'dúvida', 'como faço', 'o que é', 'para que serve', 'iniciante',
        'primeiros passos', 'ajuda', 'não entendi', 'explicação', 'passo a passo',
        'erro simples', 'como começo', 'aprendendo agora', 'sou novo', 'primeira vez'
    ];
    if (easyKeywords.some(keyword => title.includes(keyword))) {
        return 'Fácil';
    }

    return 'Fácil';
}


async function extractTopicsFromPage(pageUrl, cookie = null) {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };

        if (cookie) {
            headers['Cookie'] = cookie;
        }

        const response = await axios.get(pageUrl, { headers });
        const $ = cheerio.load(response.data);
        const topicsList = [];
        $('li.forumList-item').each((index, element) => {
            const title = $(element).find('h2.forumList-item-subject-info-title a').text().trim();
            const link = 'https://cursos.alura.com.br' + $(element).find('h2.forumList-item-subject-info-title a').attr('href');
            const category = $(element).find('a.topic-breadCrumb-item-link').first().text().trim();
            const daysText = $(element).find('.forumList-item-info-updatedAt').text().trim(); 
            
            let authorImage = $(element).find('img.forumList-item-info-avatar').attr('src');
            const placeholderAvatar = 'https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png?20170328184010';
            
            if (!authorImage || authorImage.includes('avatar_user.png')) {
                authorImage = placeholderAvatar; 
            }

            topicsList.push({
                title, link, category, daysText,
                authorImage: authorImage 
            });
        });
        return topicsList;
    } catch (error) {
        console.error(`Erro ao extrair tópicos da URL: ${pageUrl}`, error.message);
        return [];
    }
}

async function fetchBBTopics() {
    const bbUrl = 'https://cursos.alura.com.br/forum/customSearch/filter/1?restriction=sem-resposta&categoryUrlName=Todas+as+categorias&subCategoryUrlName=&companyIds=7012';
    try {
        console.log('[Worker BB] Buscando tópicos do Banco do Brasil (logado)...');
        const cookie = await authService.getValidCookie();
        
        const topics = await extractTopicsFromPage(bbUrl, cookie);
        
        const classifiedTopics = topics.map(topic => {
            const priority = classifyTopic(topic);
            return { ...topic, priority };
        });

        console.log(`[Worker BB] Encontrados e classificados ${classifiedTopics.length} tópicos do Banco do Brasil.`);
        return classifiedTopics; 

    } catch (error) {
        console.error('[Worker BB] Falha ao buscar tópicos do Banco do Brasil:', error.message);
        return [];
    }
}

async function fetchAllTopics() {
    const MAX_PAGES_TO_SCRAPE = 5;
    let allTopics = [];
    let page = 1;

    console.log(`[Worker Geral] Iniciando busca de tópicos gerais (limite de ${MAX_PAGES_TO_SCRAPE} páginas)...`);

    while (page <= MAX_PAGES_TO_SCRAPE) {
        const pageUrl = `https://cursos.alura.com.br/forum/sem-resposta/${page}`;
        console.log(`[Worker Geral] Buscando tópicos da página ${page}...`);
        
        const topicsFromPage = await extractTopicsFromPage(pageUrl); 
        
        if (topicsFromPage.length === 0) {
            console.log(`[Worker Geral] Página ${page} vazia. Parando a busca.`);
            break;
        }
        
        allTopics = allTopics.concat(topicsFromPage);
        page++;
    }

    const classifiedTopics = allTopics.map(topic => {
        const priority = classifyTopic(topic);
        return { ...topic, priority };
    });

    console.log(`[Worker Geral] Busca e classificação de tópicos gerais finalizada. Total: ${classifiedTopics.length}`);
    return classifiedTopics;
}

async function fetchUserStats(username) {
    const cookie = await authService.getValidCookie();
    const url = `https://cursos.alura.com.br/user/${username}/actions`;
    console.log(`Buscando dados de ações em: ${url}`);
    
    const response = await axios.get(url, { 
        headers: { 
            'Cookie': cookie, 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 
        } 
    });
    
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
        const response = await axios.get(profileUrl);
        const $ = cheerio.load(response.data);
        const avatarUrl = $('.profile-header-avatar').attr('src');
        if (!avatarUrl) {
            
            return 'https://via.placeholder.com/40/CCCCCC/FFFFFF?text=?';
        }
        
        return avatarUrl;
    } catch (error) {
        return null;
    }
}

async function fetchTeamStats(usernames) {
    const now = new Date();
    const currentUserKey = usernames.slice().sort().join(',');

    if (
        teamStatsCache.data &&
        teamStatsCache.lastFetched &&
        (now - teamStatsCache.lastFetched < TEAM_STATS_CACHE_DURATION_MS) &&
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
        const currentYear = new Date().getFullYear(); 

        $('table.actions-table tbody tr').each((index, element) => {
            const actionText = $(element).find('td.actions-table-actionName').text().trim();

            if (actionText === 'Resposta a tópico do fórum') { 
                const actionTimestamp = $(element).find('.actions-table-actionDate').attr('data-action-time');
                if (actionTimestamp) {
                    const activityDate = new Date(actionTimestamp);

                    if (activityDate.getFullYear() < currentYear) {
                        return false; 
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

async function fetchGeneralStats() {
    try {
        if (biCache && (Date.now() - biCache.timestamp < 600000)) return biCache.data;

        console.log("📊 [BI] Baixando dados para o Dashboard...");
        const response = await axios.get(BI_STATS_URL);
        const data = response.data.result; 

        if (!data) return [];

        const stats = data.map(row => ({
            post_id: row[0],
            post_date: row[1],
            responder_username: row[2],
            responder_name: row[3],
            topic_id: row[4],
            subject: row[5],
            topic_status: row[6],
            topic_date: row[7],
            student_username: row[8],
            
            school: row[9] || 'Outros',
            course: row[10] || 'Geral',

            sla_minutes: parseFloat(row[11]),
            responded_24h: parseInt(row[12]),
            is_solution: parseInt(row[13]),
            link: row[14],

            interaction_order: parseInt(row[15]), 
            post_hour: parseInt(row[16]) 
        }));

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
    fetchGeneralStats
};