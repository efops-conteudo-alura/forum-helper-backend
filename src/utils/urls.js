const BASE_URL = "https://cursos.alura.com.br";

module.exports = {
    BASE_URL,

    PLACEHOLDER_AVATAR: "https://upload.wikimedia.org/wikipedia/commons/8/89/Portrait_Placeholder.png?20170328184010",
    PLACEHOLDER: "https://via.placeholder.com/40/CCCCCC/FFFFFF?text=?",

    BB_URL: `${BASE_URL}/forum/customSearch/filter/1?restriction=sem-resposta&categoryUrlName=Todas+as+categorias&subCategoryUrlName=&companyIds=7012`,
    BI_STATS_URL: "https://bi.caelumalura.com.br/public/result?id=a41d8792-0079-11f1-bbf5-02001700bcbe&format=json",

    PAGE_URL: (page) => `${BASE_URL}/forum/sem-resposta/${page}`,
    USER_STATS_URL: (username) => `${BASE_URL}/user/${username}/actions`,
    PROFILE_URL: (username) => `${BASE_URL}/user/${username}`
}