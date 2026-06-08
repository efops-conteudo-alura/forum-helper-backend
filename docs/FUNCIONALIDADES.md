# Funcionalidades do Projeto

## 1. Raspagem Automática de Fóruns
Workers em background buscam periodicamente tópicos sem resposta de três origens:
- **Fórum BR** (cursos.alura.com.br) — público, até 5 páginas
- **Fórum LATAM** (app.aluracursos.com) — público, até 5 páginas
- **Fórum Banco do Brasil** — via autenticação, filtro personalizado

Os tópicos são classificados automaticamente como **Fácil**, **Complexo** ou **Feedback** com base em palavras-chave (português e espanhol).

## 2. Sistema de Claim (Pegar Tópico)
Usuários podem reservar um tópico para responder, evitando que duas pessoas respondam o mesmo tópico:
- Claim: associa um usuário (nome + avatar) a um tópico
- Unclaim: libera o tópico
- Expiração automática após 1 hora
- Validação de propriedade (só quem pegou pode liberar)
- Limpeza automática de claims fantasmas (tópicos que sumiram do fórum)

## 3. Estatísticas de Usuário
Raspagem da página de perfil do usuário na Alura para contar:
- Respostas no fórum no dia atual
- Respostas no fórum no mês atual
- Suporte para fóruns BR e LATAM

## 4. Estatísticas de Time
Agregação das estatísticas individuais de múltiplos usuários em uma única chamada, com cache de 1 hora.

## 5. Dashboard Completo
Consulta a um BI público da Alura e monta um painel com:
- Total de respostas no período
- Respostas por data (série temporal)
- Total de soluções marcadas
- Média de SLA (minutos)
- Distribuição por escola
- Detalhamento por usuário (primeiras respostas vs réplicas)
- Filtro por data e lista de usuários

## 6. Fila de Resgate com Inteligência Artificial
Integração com a **API da Anthropic (Claude 3.5 Haiku)** para analisar tópicos do fórum:
- Consome um CSV público do BI da Alura a cada 10 minutos
- Filtra tópicos dos últimos 30 dias
- Envia o título e o texto da thread para o Claude avaliar
- Decide se a equipe precisa intervir (prioridade ALTA, MÉDIA ou BAIXA)
- Identifica motivo da intervenção e sentimento do autor
- Até 3 tentativas por tópico em caso de falha
- Gerencia fila manual (pegar/liberar tópicos para atendimento)
- Persistência em arquivo JSON na pasta `data/`

## 7. CRUD de Atividades
Modelo `Atividade` no PostgreSQL com os campos:
- Nome (obrigatório, 3–255 caracteres)
- Data de início e fim (com validação de ordem)
- Responsáveis (array de strings, mínimo 1)
- Peso (1 a 3)

Operações: listar (com filtros), visualizar, criar, atualizar e excluir.

## 8. Autenticação Automática
Login programático na plataforma Alura para acessar páginas restritas:
- Login no fórum BR (cursos.alura.com.br)
- Login no fórum LATAM (app.aluracursos.com)
- Gerenciamento de sessão com cache de cookies e renovação automática

## 9. API REST
Todos os recursos expostos via API REST no prefixo `/api`:
- Tópicos BR e LATAM com status de claim
- CRUD de atividades
- Estatísticas de usuário, time e dashboard
- Fila de resgate (consulta, claim e unclaim)
- Consulta de avatar de usuário
