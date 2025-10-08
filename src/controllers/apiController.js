// src/controllers/apiController.js

const claimedTopics = require('../state');
const scraperService = require('../services/scraperService');

// <<< NOVO CACHE PARA O DASHBOARD >>>
let dashboardCache = {
    results: null, // Armazena os resultados brutos da busca
    lastFetched: null,
    usersKey: null
};
const DASHBOARD_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

exports.getTopics = async (req, res) => {
    try {
        const allTopics = await scraperService.fetchAllTopics();

        const topicsWithStatus = allTopics.map(topic => {
            if (claimedTopics.has(topic.link)) {
                return { ...topic, isClaimed: true, claimedBy: claimedTopics.get(topic.link) };
            } else {
                return { ...topic, isClaimed: false };
            }
        });

        res.json(topicsWithStatus);
    } catch (error) {
        console.error("Erro no controller getTopics:", error.message);
        res.status(500).json({ message: "Falha ao buscar dados dos tópicos." });
    }
};

exports.claimTopic = async (req, res) => {
    const { topicLink, username } = req.body;

    if (!topicLink || !username) {
        return res.status(400).json({ message: "Dados incompletos. 'topicLink' e 'username' são obrigatórios." });
    }

    if (claimedTopics.has(topicLink)) {
        return res.status(409).json({ message: "Ops! Alguém já pegou este tópico." });
    }

    try {
        const avatarUrl = await scraperService.fetchUserAvatar(username);

        if (!avatarUrl) {
            return res.status(404).json({ message: `Usuário "${username}" não encontrado na Alura.` });
        }
        
        const user = {
            name: username,
            avatar: avatarUrl
        };

        console.log(`${user.name} pegou o tópico: ${topicLink}`);
        claimedTopics.set(topicLink, user);

        setTimeout(() => {
            claimedTopics.delete(topicLink);
            console.log(`Tópico liberado automaticamente (1h): ${topicLink}`);
        }, 3600000); // 1 hora

        res.status(200).json({ message: "Tópico pego com sucesso!", user });
    
    } catch (error) {
        console.error("Erro no controller claimTopic:", error.message);
        res.status(500).json({ message: "Ocorreu um erro interno ao tentar pegar o tópico." });
    }
};

exports.unclaimTopic = (req, res) => {
    const { topicLink, username } = req.body;

    if (!topicLink || !username) {
        return res.status(400).json({ message: "Dados incompletos para liberar o tópico." });
    }

    if (!claimedTopics.has(topicLink)) {
        return res.status(404).json({ message: "Este tópico não está atualmente pego por ninguém." });
    }

    const claimedUser = claimedTopics.get(topicLink);

    if (claimedUser.name !== username) {
        return res.status(403).json({ message: "Você não pode liberar um tópico que foi pego por outra pessoa." });
    }

    claimedTopics.delete(topicLink);
    console.log(`${username} liberou o tópico: ${topicLink}`);
    res.status(200).json({ message: "Tópico liberado com sucesso!" });
};

exports.getUserStats = async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            return res.status(400).json({ message: 'Username é obrigatório.' });
        }
        
        const stats = await scraperService.fetchUserStats(username);
        
        res.json(stats);
    } catch (error) {
        console.error(`Erro ao buscar estatísticas para ${req.query.username}:`, error.message);
        res.status(500).json({ message: `Falha ao buscar ou processar dados para "${req.query.username}". Verifique o nome de usuário.` });
    }
};

exports.getTeamStats = async (req, res) => {
    try {
        const { users } = req.query; 
        if (!users) {
            return res.status(400).json({ message: 'A lista de usuários (users) é obrigatória.' });
        }
        
        const usernames = users.split(',');
        const stats = await scraperService.fetchTeamStats(usernames);
        
        res.json(stats);

    } catch (error) {
        console.error("Erro detalhado no controller getTeamStats:", error); 
        res.status(500).json({ message: "Falha ao buscar as estatísticas da equipe." });
    }
};


exports.getDashboardStats = async (req, res) => {
    const { users, startDate, endDate } = req.query;

    if (!users) {
        return res.status(400).json({ message: 'O parâmetro "users" (usuários separados por vírgula) é obrigatório.' });
    }
    
    try {
        const usernames = users.split(',');
        const currentUserKey = usernames.slice().sort().join(',');
        const now = new Date();
        let results;

        // <<< LÓGICA DE CACHE >>>
        if (
            dashboardCache.results &&
            dashboardCache.lastFetched &&
            (now - dashboardCache.lastFetched < DASHBOARD_CACHE_DURATION_MS) &&
            dashboardCache.usersKey === currentUserKey
        ) {
            console.log("Servindo dados do dashboard a partir do cache.");
            results = dashboardCache.results; // Usa os resultados salvos
        } else {
            console.log("Cache do dashboard inválido ou expirado. Buscando novos dados...");
            const promises = usernames.map(username => 
                Promise.all([
                    scraperService.fetchUserAvatar(username.trim()),
                    scraperService.fetchUserActivityDetails(username.trim())
                ]).then(([avatar, activities]) => ({
                    username: username.trim(),
                    avatar,
                    activities,
                    success: true
                })).catch(error => ({
                    username: username.trim(),
                    success: false,
                    error: error.message
                }))
            );
            results = await Promise.all(promises);

            // Salva os novos resultados no cache
            dashboardCache.results = results;
            dashboardCache.lastFetched = now;
            dashboardCache.usersKey = currentUserKey;
            console.log("Novos dados do dashboard salvos no cache.");
        }

        // --- A partir daqui, o código de processamento é o mesmo, mas usa os 'results' (do cache ou novos) ---

        const currentYear = new Date().getFullYear();
        const defaultStartDate = new Date(`${currentYear}-01-01T00:00:00.000Z`);
        const start = startDate ? new Date(startDate) : defaultStartDate;
        const end = endDate ? new Date(endDate) : null;
        const todayKey = new Date().toISOString().split('T')[0];

        if ((startDate && isNaN(start)) || (endDate && isNaN(end))) {
            return res.status(400).json({ message: 'Formato de data inválido. Use AAAA-MM-DD.' });
        }
        if (end) end.setHours(23, 59, 59, 999);

        const dashboardData = {
            users: [],
            summary: {
                totalResponses: 0,
                responsesByDate: {},
            }
        };

        for (const userResult of results) {
            if (!userResult.success) {
                dashboardData.users.push({
                    username: userResult.username,
                    totalResponses: 0,
                    dailyData: {},
                    error: userResult.error
                });
                continue;
            }

            const userStats = {
                username: userResult.username,
                avatar: userResult.avatar,
                totalResponses: 0,
                dailyData: {}
            };

            for (const activity of userResult.activities) {
                const activityDate = new Date(activity.date);
                const dayKey = activityDate.toISOString().split('T')[0];

                if (dayKey === todayKey) {
                    continue; 
                }

                if ((start && activityDate < start) || (end && activityDate > end)) {
                    continue;
                }

                userStats.dailyData[dayKey] = (userStats.dailyData[dayKey] || 0) + 1;
                userStats.totalResponses++;

                dashboardData.summary.responsesByDate[dayKey] = (dashboardData.summary.responsesByDate[dayKey] || 0) + 1;
                dashboardData.summary.totalResponses++;
            }
            dashboardData.users.push(userStats);
        }

        res.json(dashboardData);

    } catch (error) {
        console.error("Erro detalhado no controller getDashboardStats:", error);
        res.status(500).json({ message: "Falha geral ao processar os dados para o dashboard." });
    }
};

