// src/controllers/apiController.js

const claimedTopics = require('../state');
const scraperService = require('../services/scraperService');
// A linha abaixo foi removida, pois não usamos mais o cookie manual.
// const { ALURA_COOKIE } = require('../config');

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

    // Ponto-chave de segurança: Apenas o usuário que pegou pode liberar.
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
        
        // <<< ALTERAÇÃO AQUI >>>
        // Agora chamamos a função sem passar o cookie, pois o scraperService cuidará disso.
        const stats = await scraperService.fetchUserStats(username);
        
        res.json(stats);
    } catch (error) {
        console.error(`Erro ao buscar estatísticas para ${req.query.username}:`, error.message);
        res.status(500).json({ message: `Falha ao buscar ou processar dados para "${req.query.username}". Verifique o nome de usuário.` });
    }
};