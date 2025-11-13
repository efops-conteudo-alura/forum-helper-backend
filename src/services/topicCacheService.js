// src/services/topicCacheService.js

const scraperService = require('./scraperService');
const claimedTopics = require('../state');

// Nossos caches internos. Eles guardam os dados que os workers buscam.
let generalTopicsCache = [];
let bbTopicsCache = [];

// Constantes de tempo (em milissegundos)
const GENERAL_TOPICS_INTERVAL = 15000; // 15 segundos
const BB_TOPICS_INTERVAL = 300000;      // 5 minutos

/**
 * <<< NOVO: Traduz o texto do tempo para minutos >>>
 * Isso permite ordenar os tópicos corretamente.
 */
function parseDaysTextToMinutes(daysText) {
    // Tópicos sem data (como o "Tópico privado") vão para o final.
    if (!daysText || daysText === "") {
        return 9999999; // Retorna um número bem grande
    }
    
    const text = daysText.toLowerCase();
    // Tenta encontrar um número e uma unidade de tempo (ex: "14", "horas")
    const match = text.match(/(\d+)\s+(minuto|hora|dia|semana|mês|ano)s?/);

    if (!match) {
        return 9999998; // Se não encontrar, também vai para o final
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 'minuto':
            return value;
        case 'hora':
            return value * 60;
        case 'dia':
            return value * 60 * 24;
        case 'semana':
            return value * 60 * 24 * 7;
        case 'mês': // Aproximado
            return value * 60 * 24 * 30; 
        case 'ano': // Aproximado
            return value * 60 * 24 * 365;
        default:
            return 9999997;
    }
}


/**
 * Worker 1: Busca os tópicos gerais.
 */
async function updateGeneralTopics() {
    console.log('[Worker Geral] Buscando tópicos gerais...');
    try {
        const topics = await scraperService.fetchAllTopics();
        generalTopicsCache = topics; // Atualiza o cache
        console.log(`[Worker Geral] Cache atualizado com ${topics.length} tópicos.`);
    } catch (error) {
        console.error('[Worker Geral] Erro ao buscar tópicos:', error.message);
    } finally {
        setTimeout(updateGeneralTopics, GENERAL_TOPICS_INTERVAL);
    }
}

/**
 * Worker 2: Busca os tópicos do Banco do Brasil.
 */
async function updateBBTopics() {
    console.log('[Worker BB] Buscando tópicos do Banco do Brasil...');
    try {
        const topics = await scraperService.fetchBBTopics();
        bbTopicsCache = topics; // Atualiza o cache
        console.log(`[Worker BB] Cache atualizado com ${topics.length} tópicos.`);
    } catch (error) {
        console.error('[Worker BB] Erro ao buscar tópicos do BB:', error.message);
    } finally {
        setTimeout(updateBBTopics, BB_TOPICS_INTERVAL);
    }
}

/**
 * Inicia os dois workers em paralelo.
 */
exports.startTopicWorkers = () => {
    console.log('Iniciando workers de tópicos...');
    setTimeout(updateGeneralTopics, 0); 
    setTimeout(updateBBTopics, 0);
};

/**
 * Esta é a função que o controller vai chamar.
 */
exports.getMergedTopicsWithStatus = () => {
    // 1. Combina e remove duplicatas (a partir dos caches)
    const uniqueTopicsMap = new Map();
    [...generalTopicsCache, ...bbTopicsCache].forEach(topic => {
        uniqueTopicsMap.set(topic.link, topic);
    });
    
    const allTopics = Array.from(uniqueTopicsMap.values());

    // 2. <<< CORREÇÃO: Ordena a lista ANTES de qualquer outra coisa >>>
    // Ordena do menor N de minutos (mais recente) para o maior (mais antigo)
    allTopics.sort((a, b) => {
        const minutesA = parseDaysTextToMinutes(a.daysText);
        const minutesB = parseDaysTextToMinutes(b.daysText);
        return minutesA - minutesB;
    });

    // 3. LÓGICA ANTI-FANTASMA (Agora roda na lista ordenada)
    const liveTopicLinks = new Set(allTopics.map(t => t.link));
    
    let prunedCount = 0;
    for (const claimedLink of claimedTopics.keys()) {
        if (!liveTopicLinks.has(claimedLink)) {
            claimedTopics.delete(claimedLink);
            prunedCount++;
        }
    }
    if (prunedCount > 0) {
        console.log(`[getTopics] Limpeza: Removidos ${prunedCount} tópicos fantasma (já respondidos).`);
    }

    // 4. Mapeia o status
    const topicsWithStatus = allTopics.map(topic => {
        if (claimedTopics.has(topic.link)) {
            return { ...topic, isClaimed: true, claimedBy: claimedTopics.get(topic.link) };
        } else {
            return { ...topic, isClaimed: false };
        }
    });

    return topicsWithStatus;
};