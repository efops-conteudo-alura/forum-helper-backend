const claimedTopics = require("../state");
const scraperService = require("../services/scraperService");
const topicCacheService = require("../services/topicCacheService");

exports.getTopics = async (req, res) => {
    try {
        
        const topicsWithStatus = topicCacheService.getBRTopicsWithStatus();
        res.json(topicsWithStatus);
    } catch (error) {
        console.error("Erro no controller getTopics:", error.message);
        res.status(500).json({ message: "Falha ao processar dados dos tópicos BR." });
    }
};

exports.getLatamTopics = async (req, res) => {
    try {
        
        const topicsWithStatus = topicCacheService.getLatamTopicsWithStatus();
        res.json(topicsWithStatus);
    } catch (error) {
        console.error("Erro no controller getLatamTopics:", error.message);
        res.status(500).json({ message: "Falha ao processar dados dos tópicos LATAM." });
    }
};

exports.claimTopic = async (req, res) => {
    const { topicLink, username } = req.body;

    if (!topicLink || !username) {
        return res.status(400).json({
            message: "Dados incompletos. 'topicLink' e 'username' são obrigatórios.",
        });
    }

    if (claimedTopics.has(topicLink)) {
        return res.status(409).json({ message: "Ops! Alguém já pegou este tópico." });
    }

    try {
        const avatarUrl = await scraperService.fetchUserAvatar(username);

        if (!avatarUrl) {
            return res.status(404).json({
                message: `Usuário "${username}" não encontrado na Alura.`,
            });
        }

        const user = {
            name: username,
            avatar: avatarUrl,
        };

        console.log(`${user.name} pegou o tópico: ${topicLink}`);
        claimedTopics.set(topicLink, user);

        setTimeout(() => {
            claimedTopics.delete(topicLink);
            console.log(`Tópico liberado automaticamente (1h): ${topicLink}`);
        }, 3600000);

        res.status(200).json({ message: "Tópico pego com sucesso!", user });
    } catch (error) {
        console.error("Erro no controller claimTopic:", error.message);
        res.status(500).json({
            message: "Ocorreu um erro interno ao tentar pegar o tópico.",
        });
    }
};

exports.unclaimTopic = (req, res) => {
    const { topicLink, username } = req.body;

    if (!topicLink || !username) {
        return res.status(400).json({ message: "Dados incompletos para liberar o tópico." });
    }

    if (!claimedTopics.has(topicLink)) {
        return res.status(404).json({
            message: "Este tópico não está atualmente pego por ninguém.",
        });
    }

    const claimedUser = claimedTopics.get(topicLink);

    if (claimedUser.name !== username) {
        return res.status(403).json({
            message: "Você não pode liberar um tópico que foi pego por outra pessoa.",
        });
    }

    claimedTopics.delete(topicLink);
    console.log(`${username} liberou o tópico: ${topicLink}`);
    res.status(200).json({ message: "Tópico liberado com sucesso!" });
};

exports.getUserStats = async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            return res.status(400).json({ message: "Username é obrigatório." });
        }
        const stats = await scraperService.fetchUserStats(username);
        res.json(stats);
    } catch (error) {
        console.error(`Erro ao buscar estatísticas para ${req.query.username}:`, error.message);
        res.status(500).json({
            message: `Falha ao buscar ou processar dados.`,
        });
    }
};

exports.getTeamStats = async (req, res) => {
    try {
        const { users } = req.query;
        if (!users) {
            return res.status(400).json({
                message: "A lista de usuários (users) é obrigatória.",
            });
        }
        const usernames = users.split(",");
        const stats = await scraperService.fetchTeamStats(usernames);
        res.json(stats);
    } catch (error) {
        console.error("Erro detalhado no controller getTeamStats:", error);
        res.status(500).json({
            message: "Falha ao buscar as estatísticas da equipe.",
        });
    }
};

exports.getDashboardStats = async (req, res) => {
    const { users, startDate, endDate } = req.query;

    if (!users) {
        return res.status(400).json({ message: 'O parâmetro "users" é obrigatório.' });
    }

    try {
        const allStats = await scraperService.fetchGeneralStats();

        const targetUsers = users.split(",").map((u) => u.trim());

        const startStr = startDate && startDate !== "undefined" ? startDate.substring(0, 10) : null;
        const endStr = endDate && endDate !== "undefined" ? endDate.substring(0, 10) : null;

        const dashboardResponse = {
            summary: {
                totalResponses: 0,
                responsesByDate: {},
                totalSolutions: 0,
                avgSlaMinutes: 0,
                schools: {},
            },
            users: [],
        };

        let totalSla = 0;
        const userMap = {};

        await Promise.all(
            targetUsers.map(async (u) => {
                const avatarUrl = await scraperService.fetchUserAvatar(u);
                userMap[u] = {
                    username: u,
                    avatar: avatarUrl,
                    totalResponses: 0,
                    totalSolutions: 0,

                    firstResponses: 0,
                    replies: 0,
                    schools: {},

                    dailyData: {},
                };
            })
        );

        allStats.forEach((item) => {
            if (!targetUsers.includes(item.responder_username)) return;

            const itemDate = item.post_date.substring(0, 10);
            if (startStr && itemDate < startStr) return;
            if (endStr && itemDate > endStr) return;

            dashboardResponse.summary.totalResponses++;
            dashboardResponse.summary.responsesByDate[itemDate] =
                (dashboardResponse.summary.responsesByDate[itemDate] || 0) + 1;
            const escola = item.school || "Outros";
            if (!dashboardResponse.summary.schools[escola]) {
                dashboardResponse.summary.schools[escola] = 0;
            }
            dashboardResponse.summary.schools[escola]++;

            if (item.is_solution) dashboardResponse.summary.totalSolutions++;
            if (item.sla_minutes) totalSla += parseFloat(item.sla_minutes);

            if (userMap[item.responder_username]) {
                const u = userMap[item.responder_username];

                u.totalResponses++;
                if (item.is_solution) u.totalSolutions++;
                u.dailyData[itemDate] = (u.dailyData[itemDate] || 0) + 1;

                const escola = item.school;
                if (!u.schools[escola]) u.schools[escola] = 0;
                u.schools[escola]++;

                if (item.interaction_order === 1) {
                    u.firstResponses++;
                } else {
                    u.replies++;
                }
            }
        });

        if (dashboardResponse.summary.totalResponses > 0) {
            dashboardResponse.summary.avgSlaMinutes = (
                totalSla / dashboardResponse.summary.totalResponses
            ).toFixed(0);
        }

        dashboardResponse.users = Object.values(userMap);

        res.json(dashboardResponse);
    } catch (error) {
        console.error("Erro no getDashboardStats:", error);
        res.status(500).json({ message: "Erro ao processar dashboard." });
    }
};

exports.getUserAvatar = async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.status(400).json({ success: false });

        const avatarUrl = await scraperService.fetchUserAvatar(username);
        res.json({ success: true, avatarUrl });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

exports.getLatamUserStats = async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) {
            return res.status(400).json({ message: "Username LATAM é obrigatório." });
        }
        
        const stats = await scraperService.fetchLatamUserStats(username);
        res.json(stats);
    } catch (error) {
        console.error(`Erro LATAM Controller:`, error.message);
        res.status(500).json({ message: "Falha ao processar dados LATAM." });
    }
};