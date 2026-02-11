const scraperService = require("./scraperService");
const claimedTopics = require("../state");

const GENERAL_TOPICS_INTERVAL = 15000;
const BB_TOPICS_INTERVAL = 300000;

let generalTopicsCache = [];
let bbTopicsCache = [];

function parseDaysTextToMinutes(daysText) {
    if (!daysText || daysText === "") {
        return 9999999;
    }

    const text = daysText.toLowerCase();
    const match = text.match(/(\d+)\s+(minuto|hora|dia|semana|mês|ano)s?/);

    if (!match) {
        return 9999998;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case "minuto":
            return value;
        case "hora":
            return value * 60;
        case "dia":
            return value * 60 * 24;
        case "semana":
            return value * 60 * 24 * 7;
        case "mês": // Aproximado
            return value * 60 * 24 * 30;
        case "ano": // Aproximado
            return value * 60 * 24 * 365;
        default:
            return 9999997;
    }
}

async function updateGeneralTopics() {
    console.log("[Worker Geral] Buscando tópicos gerais...");
    try {
        const topics = await scraperService.fetchAllTopics();
        generalTopicsCache = topics;
        console.log(`[Worker Geral] Cache atualizado com ${topics.length} tópicos.`);
    } catch (error) {
        console.error("[Worker Geral] Erro ao buscar tópicos:", error.message);
    } finally {
        setTimeout(updateGeneralTopics, GENERAL_TOPICS_INTERVAL);
    }
}

async function updateBBTopics() {
    console.log("[Worker BB] Buscando tópicos do Banco do Brasil...");
    try {
        const topics = await scraperService.fetchBBTopics();
        bbTopicsCache = topics; // Atualiza o cache
        console.log(`[Worker BB] Cache atualizado com ${topics.length} tópicos.`);
    } catch (error) {
        console.error("[Worker BB] Erro ao buscar tópicos do BB:", error.message);
    } finally {
        setTimeout(updateBBTopics, BB_TOPICS_INTERVAL);
    }
}

exports.startTopicWorkers = () => {
    console.log("Iniciando workers de tópicos...");
    setTimeout(updateGeneralTopics, 0);
    setTimeout(updateBBTopics, 0);
};

exports.getMergedTopicsWithStatus = () => {
    const uniqueTopicsMap = new Map();
    [...generalTopicsCache, ...bbTopicsCache].forEach((topic) => {
        uniqueTopicsMap.set(topic.link, topic);
    });

    const allTopics = Array.from(uniqueTopicsMap.values());

    allTopics.sort((a, b) => {
        const minutesA = parseDaysTextToMinutes(a.daysText);
        const minutesB = parseDaysTextToMinutes(b.daysText);
        return minutesA - minutesB;
    });

    const liveTopicLinks = new Set(allTopics.map((t) => t.link));

    let prunedCount = 0;
    for (const claimedLink of claimedTopics.keys()) {
        if (!liveTopicLinks.has(claimedLink)) {
            claimedTopics.delete(claimedLink);
            prunedCount++;
        }
    }
    if (prunedCount > 0) {
        console.log(
            `[getTopics] Limpeza: Removidos ${prunedCount} tópicos fantasma (já respondidos).`
        );
    }

    const topicsWithStatus = allTopics.map((topic) => {
        if (claimedTopics.has(topic.link)) {
            return {
                ...topic,
                isClaimed: true,
                claimedBy: claimedTopics.get(topic.link),
            };
        } else {
            return { ...topic, isClaimed: false };
        }
    });

    return topicsWithStatus;
};
