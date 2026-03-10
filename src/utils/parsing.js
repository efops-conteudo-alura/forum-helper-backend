const URLS = require("../utils/urls");

function parseUserStats($, hoje) {
    const diaAtual = hoje.getDate();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    let contadorDia = 0;
    let contadorMes = 0;

    $("table.actions-table tbody tr").each((index, element) => {
        const actionText = $(element).find("td.actions-table-actionName").text().trim();

        const isForumResponse = 
            actionText === "Resposta a tópico do fórum" || 
            actionText === "Respuesta a tópico del foro" ||
            actionText === "Tópico solucionado";

        if (isForumResponse) {
            const actionTimestamp = $(element)
                .find(".actions-table-actionDate")
                .attr("data-action-time");

            if (actionTimestamp) {
                const dataAcao = new Date(actionTimestamp);

                if (dataAcao.getFullYear() === anoAtual && dataAcao.getMonth() + 1 === mesAtual) {
                    contadorMes++;
                    if (dataAcao.getDate() === diaAtual) {
                        contadorDia++;
                    }
                }
            }
        }
    });

    return { contadorDia, contadorMes };
}

function parseExtractTopicsFromPage($) {
    const topicsList = [];

    $("li.forumList-item").each((index, element) => {
        const title = $(element).find("h2.forumList-item-subject-info-title a").text().trim();
        const link = URLS.BASE_URL + $(element).find("h2.forumList-item-subject-info-title a").attr("href");
        const category = $(element).find("a.topic-breadCrumb-item-link").first().text().trim();
        const daysText = $(element).find(".forumList-item-info-updatedAt").text().trim();

        let authorImage = $(element).find("img.forumList-item-info-avatar").attr("src");
        if (!authorImage || authorImage.includes("avatar_user.png")) {
            authorImage = URLS.PLACEHOLDER_AVATAR;
        }

        topicsList.push({
            title,
            link,
            category,
            daysText,
            authorImage: authorImage,
        });
    });
    return topicsList;
}

function parseActivityDetails($, currentYear) {
    const activities = [];

    $("table.actions-table tbody tr").each((index, element) => {
        const actionText = $(element).find("td.actions-table-actionName").text().trim();

        if (actionText === "Resposta a tópico do fórum" || actionText === "Respuesta a tópico del foro") {
            const actionTimestamp = $(element)
                .find(".actions-table-actionDate")
                .attr("data-action-time");
            if (actionTimestamp) {
                const activityDate = new Date(actionTimestamp);

                if (activityDate.getFullYear() < currentYear) {
                    return false;
                }

                activities.push({
                    type: "forum-response",
                    date: actionTimestamp,
                });
            }
        }
    });

    return activities;
}

module.exports = {
    parseUserStats,
    parseExtractTopicsFromPage,
    parseActivityDetails,
};