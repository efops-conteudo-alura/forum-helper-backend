const fs = require("fs");
const path = require("path");
const scraperService = require("./scraperService");
const claimedTopics = require("../state");

const GENERAL_TOPICS_INTERVAL = 15000;
const BB_TOPICS_INTERVAL = 300000;

const CACHE_DIR = path.join(__dirname, "../../data");
const BR_CACHE_FILE = path.join(CACHE_DIR, "cache_topics_br.json");
const BB_CACHE_FILE = path.join(CACHE_DIR, "cache_topics_bb.json");
const LATAM_CACHE_FILE = path.join(CACHE_DIR, "cache_topics_latam.json");

let generalTopicsCache = [];
let bbTopicsCache = [];
let latamTopicsCache = [];

function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

function loadFromDisk(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, "utf8");
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.data)) {
                console.log(`[Cache] Carregado do disco: ${filePath} (${parsed.data.length} itens)`);
                return parsed.data;
            }
        }
    } catch (error) {
        console.error(`[Cache] Erro ao ler ${filePath}:`, error.message);
    }
    return null;
}

function saveToDisk(filePath, data) {
    try {
        ensureCacheDir();
        fs.writeFileSync(
            filePath,
            JSON.stringify({ data, timestamp: Date.now() }, null, 2)
        );
    } catch (error) {
        console.error(`[Cache] Erro ao salvar ${filePath}:`, error.message);
    }
}

function loadAllFromDisk() {
    const br = loadFromDisk(BR_CACHE_FILE);
    const bb = loadFromDisk(BB_CACHE_FILE);
    const latam = loadFromDisk(LATAM_CACHE_FILE);
    if (br) generalTopicsCache = br;
    if (bb) bbTopicsCache = bb;
    if (latam) latamTopicsCache = latam;
}

function parseDaysTextToMinutes(daysText) {
    if (!daysText || daysText === "") return 9999999;

    const text = daysText.toLowerCase();

    const match = text.match(/(\d+)\s+(min|hor|di|d.a|sem|m.s|an|a.o)/i);

    if (!match) return 9999998;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    if (unit.startsWith("min")) return value;
    if (unit.startsWith("hor")) return value * 60;
    if (unit.startsWith("di") || unit.startsWith("d.a")) return value * 60 * 24;
    if (unit.startsWith("sem")) return value * 60 * 24 * 7;
    if (unit.startsWith("m")) return value * 60 * 24 * 30;
    if (unit.startsWith("an") || unit.startsWith("a.o")) return value * 60 * 24 * 365;

    return 9999997;
}

function pruneGhostClaims() {
    const liveTopicLinks = new Set([
        ...generalTopicsCache.map((t) => t.link),
        ...bbTopicsCache.map((t) => t.link),
        ...latamTopicsCache.map((t) => t.link),
    ]);

    let prunedCount = 0;
    for (const claimedLink of claimedTopics.keys()) {
        if (!liveTopicLinks.has(claimedLink)) {
            claimedTopics.delete(claimedLink);
            prunedCount++;
        }
    }
    if (prunedCount > 0) {
        console.log(`[Cache] Limpeza: Removidos ${prunedCount} tópicos fantasma.`);
    }
}

async function updateGeneralTopics() {
    console.log("[Worker Geral] Buscando tópicos BR...");
    try {
        generalTopicsCache = await scraperService.fetchAllTopics();
        console.log(`[Worker Geral] Cache BR atualizado com ${generalTopicsCache.length} tópicos.`);
        saveToDisk(BR_CACHE_FILE, generalTopicsCache);
        pruneGhostClaims();
    } catch (error) {
        console.error("[Worker Geral] Erro:", error.message);
    } finally {
        setTimeout(updateGeneralTopics, GENERAL_TOPICS_INTERVAL);
    }
}

async function updateLatamTopics() {
    console.log("[Worker LATAM] Buscando tópicos LATAM...");
    try {
        latamTopicsCache = await scraperService.fetchLatamTopics();
        console.log(`[Worker LATAM] Cache LATAM atualizado com ${latamTopicsCache.length} tópicos.`);
        saveToDisk(LATAM_CACHE_FILE, latamTopicsCache);
        pruneGhostClaims();
    } catch (error) {
        console.error("[Worker LATAM] Erro:", error.message);
    } finally {
        setTimeout(updateLatamTopics, GENERAL_TOPICS_INTERVAL);
    }
}

async function updateBBTopics() {
    console.log("[Worker BB] Buscando tópicos Banco do Brasil...");
    try {
        bbTopicsCache = await scraperService.fetchBBTopics();
        console.log(`[Worker BB] Cache BB atualizado com ${bbTopicsCache.length} tópicos.`);
        saveToDisk(BB_CACHE_FILE, bbTopicsCache);
        pruneGhostClaims();
    } catch (error) {
        console.error("[Worker BB] Erro:", error.message);
    } finally {
        setTimeout(updateBBTopics, BB_TOPICS_INTERVAL);
    }
}

exports.startTopicWorkers = () => {
    console.log("Iniciando workers de tópicos...");
    loadAllFromDisk();
    setTimeout(updateGeneralTopics, 0);
    setTimeout(updateBBTopics, 0);
    setTimeout(updateLatamTopics, 0);
};

function formatTopicsForResponse(topicsArray) {
    const uniqueTopicsMap = new Map();
    topicsArray.forEach((topic) => uniqueTopicsMap.set(topic.link, topic));

    const allTopics = Array.from(uniqueTopicsMap.values());

    allTopics.sort((a, b) => parseDaysTextToMinutes(a.daysText) - parseDaysTextToMinutes(b.daysText));

    return allTopics.map((topic) => {
        if (claimedTopics.has(topic.link)) {
            return {
                ...topic,
                isClaimed: true,
                claimedBy: claimedTopics.get(topic.link),
            };
        }
        return { ...topic, isClaimed: false };
    });
}

exports.getBRTopicsWithStatus = () => {
    return formatTopicsForResponse([...generalTopicsCache, ...bbTopicsCache]);
};

exports.getLatamTopicsWithStatus = () => {
    return formatTopicsForResponse([...latamTopicsCache]);
};
