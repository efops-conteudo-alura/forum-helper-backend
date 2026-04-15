const axios = require('axios');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

// --- SISTEMA DE PERSISTÊNCIA EM DISCO ---
const CACHE_FILE = path.join(__dirname, '../../data/rescue_cache.json');

let rescueCache = new Map();
let waitingQueue = [];
let isProcessingQueue = false;

function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            JSON.parse(data).forEach(topic => rescueCache.set(topic.topic_id, topic));
            console.log(`[AI Service] 💾 Banco carregado com ${rescueCache.size} tópicos salvos no JSON.`);
        } else {
            const dir = path.dirname(CACHE_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        }
    } catch (error) {
        console.error('[AI Service] 🛑 Erro ao ler o JSON de cache:', error.message);
    }
}

function saveCache() {
    try {
        const dataToSave = Array.from(rescueCache.values());
        fs.writeFileSync(CACHE_FILE, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
        console.error('[AI Service] 🛑 Erro ao gravar o JSON:', error.message);
    }
}

loadCache();

// --- Integração Profissional com CLAUDE 3.5 HAIKU ---
async function avaliarThreadComIA(threadTexto, subject) {
    const API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!API_KEY) return { sucesso: false, erro: "Sem chave da Anthropic." };

    const API_URL = 'https://api.anthropic.com/v1/messages';

    // Usamos tags XML (<titulo>, <thread>) porque o Claude foi treinado para entendê-las perfeitamente
    const systemPrompt = `
Você é um analista de suporte educacional sênior da Alura avaliando fóruns de tecnologia.
Sua tarefa é ler a dúvida de um aluno e a thread de respostas, decidindo se a equipe oficial (instrutores/monitores) precisa intervir para salvar o tópico.

REGRAS DE INTERVENÇÃO:

🔴 INTERVIR ALTA (intervencao_necessaria: true, prioridade: "ALTA"):
- ERRO DE CURSO: O aluno relata um erro no material oficial (senha errada fornecida na aula, código do instrutor com bug, link quebrado).
- CHAMADO DIRETO: O aluno cobra explicitamente a equipe (ex: "Esperando a Alura", "Cadê o instrutor?").
- FRUSTRAÇÃO: O aluno demonstra irritação extrema com a plataforma ou com o ensino.

🟡 INTERVIR MÉDIA (intervencao_necessaria: true, prioridade: "MEDIA"):
- AJUDANTE EXAUSTO: Um colega tentou ajudar, mas declarou que não consegue mais (ex: "cheguei no meu limite", "não sei mais o que fazer").
- BECO SEM SAÍDA: O autor testou a ajuda do colega, afirmou que não funcionou, e o tópico parou por aí sem solução.

🟢 NÃO INTERVIR (intervencao_necessaria: false, prioridade: "BAIXA"):
- AUTO-RESOLVIDO (SELF-SOLVED): O próprio autor encontrou a solução e postou na thread (ex: "Consegui fazer funcionar", "Resolvi o problema", "Achei o erro").
- RESOLVIDO PELO COLEGA: O colega ajudou e o autor confirmou que deu certo ou apenas agradeceu encerrando o assunto.
- SILÊNCIO (ABANDONO): Um colega deu uma resposta que parece coerente e o autor nunca mais voltou para responder (assuma que resolveu e seguiu a vida).

RETORNE EXCLUSIVAMENTE UM OBJETO JSON NESTE FORMATO, SEM NENHUMA PALAVRA EXTRA OU FORMATAÇÃO MARKDOWN:
{
  "intervencao_necessaria": true,
  "prioridade": "ALTA",
  "motivo_intervencao": "Explicação direta em uma frase curta relatando o que travou o aluno.",
  "sentimento_autor": "FRUSTRADO"
}
`;

    const userMessage = `
<titulo>${subject}</titulo>
<thread>
${threadTexto ? threadTexto.substring(0, 4000) : 'Sem texto.'}
</thread>
`;

    try {
        const response = await axios.post(API_URL, {
            model: "claude-3-5-haiku-20241022",
            max_tokens: 300,
            temperature: 0.1, // Super baixo para evitar alucinações e garantir o JSON
            system: systemPrompt,
            messages: [
                { role: "user", content: userMessage }
            ]
        }, {
            headers: {
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        });

        let textResponse = response.data.content[0].text.trim();

        // Blindagem clássica contra markdowns fujões
        textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        return { sucesso: true, dados: JSON.parse(textResponse) };

    } catch (error) {
        const msg = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`[Claude ERRO] Tópico "${subject}":`, msg);
        return { sucesso: false, erro: "Falha na API da Anthropic." };
    }
}

// --- WORKER: Busca do BI ---
async function fetchFromBIAndQueue() {
    const biUrl = "https://bi.caelumalura.com.br/public/result?id=6a0650d8-31f5-11f1-834e-02001701fe60".trim();
    const results = [];

    try {
        const response = await axios({ method: 'get', url: biUrl, responseType: 'stream' });
        response.data.pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                const umMesAtras = new Date();
                umMesAtras.setDate(umMesAtras.getDate() - 30);

                const topicosDoMes = results.filter(row => {
                    if (!row.topic_createdAt) return false;
                    const dataTopico = new Date(row.topic_createdAt.replace(' ', 'T'));
                    return dataTopico >= umMesAtras;
                });

                let novos = 0;
                topicosDoMes.forEach(row => {
                    const id = parseInt(row.topic_id);
                    if (id && !rescueCache.has(id) && !waitingQueue.some(t => t.topic_id === id)) {
                        // Injetamos o contador de tentativas da Dead Letter Queue
                        waitingQueue.push({ ...row, topic_id: id, tentativas_ia: 0 });
                        novos++;
                    }
                });

                if (novos > 0) console.log(`[AI Worker] +${novos} tópicos entraram na esteira.`);
            });
    } catch (error) {
        console.error("[AI Worker] Erro no BI:", error.message);
    }
}

// --- WORKER: A Esteira Resiliente ---
async function processQueue() {
    if (isProcessingQueue || waitingQueue.length === 0) return;
    isProcessingQueue = true;

    // Remove o primeiro da fila (nós vamos recolocar se falhar)
    const topic = waitingQueue.shift();
    topic.tentativas_ia = (topic.tentativas_ia || 0) + 1;

    console.log(`[AI Worker] Analisando: "${topic.subject}" (Tentativa ${topic.tentativas_ia}/3)...`);

    const analise = await avaliarThreadComIA(topic.thread_texto_ia, topic.subject);

    if (analise.sucesso) {
        // Deu tudo certo!
        rescueCache.set(topic.topic_id, {
            ...topic,
            total_interacoes_alunos: parseInt(topic.total_interacoes_alunos) || 0,
            ia_analysis: analise.dados,
            rescue_status: 'PENDING',
            claimed_by: null
        });
        saveCache();
        console.log(`[AI Worker] ✅ Sucesso! Tópico salvo.`);

    } else {
        // Falhou! O que fazer?
        if (topic.tentativas_ia < 3) {
            console.log(`[AI Worker] ⚠️ Erro na IA. Devolvendo tópico para o fim da fila.`);
            waitingQueue.push(topic); // Vai pro final da fila para não travar os outros
        } else {
            console.log(`[AI Worker] 🛑 Tópico descartado após 3 falhas. Movendo para analisados com status de Erro.`);
            // Aborta e salva como ERRO para o Front-end mostrar e a esteira seguir a vida
            rescueCache.set(topic.topic_id, {
                ...topic,
                total_interacoes_alunos: parseInt(topic.total_interacoes_alunos) || 0,
                ia_analysis: {
                    intervencao_necessaria: false,
                    prioridade: "BAIXA",
                    motivo_intervencao: "Falha irreversível na leitura deste tópico.",
                    sentimento_autor: "NEUTRO"
                },
                rescue_status: 'ERROR',
                claimed_by: null
            });
            saveCache();
        }
    }

    isProcessingQueue = false;
}

setInterval(fetchFromBIAndQueue, 10 * 60 * 1000);

// A API da Anthropic suporta limites melhores, podemos processar a cada 3 segundos
setInterval(processQueue, 3000);

fetchFromBIAndQueue();

// --- EXPORTAÇÕES ---
function getRescueQueueData() {
    return {
        topics: Array.from(rescueCache.values()),
        waiting_queue: waitingQueue
    };
}

function claimRescueTopic(topicId, userObj) {
    const topic = rescueCache.get(parseInt(topicId));
    if (topic) {
        topic.rescue_status = 'CLAIMED';
        topic.claimed_by = userObj;
        rescueCache.set(parseInt(topicId), topic);
        saveCache();
        return true;
    }
    return false;
}

function unclaimRescueTopic(topicId) {
    const topic = rescueCache.get(parseInt(topicId));
    if (topic) {
        topic.rescue_status = 'PENDING';
        topic.claimed_by = null;
        rescueCache.set(parseInt(topicId), topic);
        saveCache();
        return true;
    }
    return false;
}

module.exports = {
    getRescueQueueData,
    claimRescueTopic,
    unclaimRescueTopic
};