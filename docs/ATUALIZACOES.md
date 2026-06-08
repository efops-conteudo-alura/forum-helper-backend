# Atualizações de Performance e Otimização

## Substituição do Puppeteer por requisições HTTP diretas

O login automático na Alura era feito via Puppeteer (Chromium headless), que consumia aproximadamente 300MB de RAM por instância e era disparado a cada renovação de cookie. O mecanismo foi substituído por requisições HTTP diretas com axios, utilizando cheerio apenas para parsear o formulário de login e extrair eventuais tokens CSRF. O fluxo manual de redirecionamentos acumula cookies etapa por etapa, eliminando completamente a necessidade de abrir um navegador. Isso libera centenas de megabytes de memória que antes eram reservados pelo Chromium.

## Pool de conexões HTTP com keepAlive

Todas as requisições HTTP do sistema agora compartilham agents HTTP e HTTPS configurados com keepAlive ativo e limite de 10 sockets simultâneos. Antes, cada requisição abria e fechava uma conexão TCP do zero, gerando overhead de handshake TLS e consumo de recursos do sistema operacional. Com o reaproveitamento de conexões, a latência cai e o uso de CPU durante as raspagens periódicas é reduzido.

## Cache condicional com If-Modified-Since

O cliente HTTP passou a armazenar em memória o resultado de requisições a páginas públicas (lista de tópicos do fórum) com um TTL de 30 segundos. Quando o cache expira, a nova requisição envia os cabeçalhos If-Modified-Since e If-None-Match baseados na resposta anterior. Se o servidor retornar 304 (Not Modified), o dado em cache é reaproveitado sem baixar o HTML novamente. Isso reduz o tráfego de rede e o tempo de processamento com cheerio, já que páginas que não mudaram são ignoradas.

## Cache em disco dos tópicos

Os três caches de tópicos (BR, LATAM e Banco do Brasil) agora são persistidos em arquivos JSON na pasta `data/` a cada atualização. Na inicialização do servidor, esses arquivos são carregados antes da primeira raspagem, permitindo que a API responda imediatamente com dados mesmo que os workers ainda não tenham completado o primeiro ciclo de atualização. Isso também dá resiliência contra falhas temporárias de rede.

## Limpeza automática de tópicos antigos na fila de resgate

A fila de resgate mantida em memória (rescueCache) acumulava tópicos indefinidamente, incluindo aqueles com status de erro após 3 tentativas falhas de análise pela IA. Foi adicionado um processo de limpeza que executa a cada 1 hora e remove automaticamente tópicos com status ERROR com mais de 1 dia e tópicos com status PENDING ou CLAIMED com mais de 7 dias. Isso impede o crescimento infinito do mapa em memória e mantém a fila enxuta.
