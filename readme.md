# 🚀 Alura Forum Helper (Backend API)

![Status](https://img.shields.io/badge/STATUS-EM%20DESENVOLVIMENTO-green?style=for-the-badge)
![Node](https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white)

Backend desenvolvido para otimizar o fluxo de respostas no fórum da Alura. A API realiza **web scraping**, gerencia filas de atendimento (claims) e gera estatísticas de produtividade em tempo real.

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Como Rodar](#-como-rodar)
- [Documentação da API](#-documentação-da-api)
- [Autores](#-autores)

---

## 💻 Sobre o Projeto

Este serviço atua como um facilitador para a equipe de suporte educacional. Ele centraliza tópicos públicos e internos (logados), permitindo que analistas "peguem" (claim) tópicos para responder, evitando colisão de respostas, e visualizem métricas de desempenho.

> **Nota:** O projeto utiliza armazenamento em memória (`Map`). Se o servidor reiniciar, os dados de "claims" e caches são resetados.

---

## 🔨 Funcionalidades

- **Scraping Automático:** Busca tópicos sem resposta (públicos e via login na Alura).
- **Sistema de Claim:** Permite reservar um tópico por 1 hora.
- **Cache Inteligente:** Workers em background atualizam listas a cada 15s (público) e 5min (logado).
- **Dashboard de Métricas:** Contagem de respostas diárias por usuário ou time.
- **Login via Puppeteer:** Autenticação automática para acesso a áreas restritas.

---

## 🛠 Tecnologias

- **[Node.js](https://nodejs.org/)** & **[Express](https://expressjs.com/)**
- **[Puppeteer](https://pptr.dev/)** (Automação de Browser/Login)
- **[Cheerio](https://cheerio.js.org/)** (Parsing de HTML)
- **[Axios](https://axios-http.com/)** (Requisições HTTP)

---

## 🚀 Como Rodar

### 1. Pré-requisitos

- Node.js (LTS)
- NPM ou Yarn

### 2. Instalação

```bash
# Clone o repositório
git clone [https://github.com/seu-usuario/alura-forum-helper-backend.git](https://github.com/seu-usuario/alura-forum-helper-backend.git)

# Entre na pasta
cd alura-forum-helper-backend

# Instale as dependências
npm install
```

### 3. Configuração (.env)

Crie um arquivo `.env` na raiz do projeto com as credenciais para o scraping logado:

```env
ALURA_USER=seu_email@alura.com.br
ALURA_PASSWORD=sua_senha_alura
```

### 4. Executar

```bash
# Rodar em modo de produção
npm start

# Ou rodar em modo desenvolvimento (se configurado)
npm run dev

```

A API estará rodando em: `http://localhost:3000/api`

---

## 📡 Documentação da API

### Tópicos e Claims

| Método | Endpoint      | Descrição                                                  |
| ------ | ------------- | ---------------------------------------------------------- |
| `GET`  | `/api/topics` | Lista todos os tópicos sem resposta (com status de claim). |
| `POST` | `/api/claim`  | Reserva um tópico. <br>                                    |

<br>**Body:** `{ "topicLink": "...", "username": "..." }` |
| `POST` | `/api/unclaim` | Libera um tópico reservado. <br>

<br>**Body:** `{ "topicLink": "...", "username": "..." }` |

### Estatísticas

| Método | Endpoint          | Descrição                            |
| ------ | ----------------- | ------------------------------------ |
| `GET`  | `/api/user-stats` | Stats do dia/mês de um usuário. <br> |

<br>**Query:** `?username=fulano` |
| `GET` | `/api/team-stats` | Stats do dia de múltiplos usuários. <br>

<br>**Query:** `?users=fulano,ciclano` |
| `GET` | `/api/dashboard-stats` | Gráfico de respostas por período. <br>

<br>**Query:** `?users=...&startDate=...` |

---

## 🤝 Autores

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/VictorCostaSantos">
        <img src="https://avatars.githubusercontent.com/u/91506513?v=4" width="100px;" alt="Foto de Victor Costa Santos"><br>
        <sub><b>Victor Costa Santos</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/armanoalves">
        <img src="https://avatars.githubusercontent.com/u/69471768?v=4" width="100px;" alt="Foto de Armano Alves Santos"><br>
        <sub><b>Armano Alves</b></sub>
      </a>
    </td>
  </tr>
</table>
