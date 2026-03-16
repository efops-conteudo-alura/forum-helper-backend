const Classifier = Object.freeze({
    COMPLEXO: {
        label: "Complexo",
        keywords: [
            // --- PT ---
            "[bug]", "[reclamação]", "erro", "não funciona", "não consigo", "não aparece",
            "problema", "exception", "falha", "não abre", "não roda", "não carrega",
            "travando", "crash", "bugado", "não compila", "não imprime", "não executa",
            "arquitetura", "performance", "melhorar", "estratégia", "gestão", "otimizar",
            "melhor forma", "qual a melhor", "boas práticas", "padrão de projeto", 
            "design pattern", "estrutura", "pipeline", "ambiente", "sobrecarga", 
            "comportamento estranho", "variáveis de ambiente", "testes automatizados", 
            "deploy", "banco de dados", "api rest", "persistência", "thread", 
            "assíncrono", "async", "await", "kernel", "hook", "encapsulamento",
            "parâmetro", "modularização", "tentei fazer", "melhoria", "message:", "traceback",

            // --- ES ---
            "error", "no funciona", "no puedo", "no aparece", "falla", "fallo",
            "no abre", "no corre", "no carga", "se congela", "no compila", "no imprime",
            "no ejecuta", "rendimiento", "estrategia", "gestión", "gestion", "optimizar",
            "mejor forma", "cuál es la mejor", "cual es la mejor", "buenas prácticas",
            "buenas practicas", "patrón de diseño", "patron de diseño", "entorno",
            "comportamiento extraño", "variables de entorno", "pruebas automatizadas",
            "base de datos", "persistencia", "asíncrono", "encapsulamiento",
            "parámetro", "parametro", "modularización", "modularizacion", "intenté hacer",
            "intente hacer", "mejora"
        ],
    },

    FEEDBACK: {
        label: "Feedback",
        keywords: [
            // --- PT ---
            "[projeto]", "meu projeto", "minha resolução", "minha solução",
            "meu codigo", "meu código", "meu exercício", "meu exercicio", 
            "meu portfólio", "portifólio", "projeto final", "projeto concluído", 
            "quero feedback", "avaliação", "dêem feedback", "meu site", "meu app", 
            "desafios finais", "desafio - hora da pratica", "resolução", "desafio",

            // --- ES ---
            "mi proyecto", "mi resolución", "mi resolucion", "mi solución", "mi solucion",
            "mi código", "mi codigo", "mi ejercicio", "mi portafolio", "proyecto final",
            "proyecto terminado", "quiero feedback", "evaluación", "evaluacion",
            "denme feedback", "mi sitio", "desafíos finales", "desafios finales",
            "desafío", "desafio", "haz como yo hice"
        ],
    },

    FACIL: {
        label: "Fácil",
        keywords: [
            // --- PT ---
            "dúvida", "como faço", "o que é", "para que serve", "iniciante",
            "primeiros passos", "ajuda", "não entendi", "explicação", "passo a passo",
            "erro simples", "como começo", "aprendendo agora", "sou novo", "primeira vez",

            // --- ES ---
            "duda", "cómo hago", "como hago", "qué es", "que es", "para qué sirve",
            "para que sirve", "principiante", "primeros pasos", "ayuda", "no entendí",
            "no entendi", "explicación", "explicacion", "paso a paso", "error simple",
            "cómo empiezo", "como empiezo", "aprendiendo ahora", "soy nuevo", "primera vez"
        ],
    },
});

module.exports = {
    Classifier,
};