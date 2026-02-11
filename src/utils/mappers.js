const mapBIRowToStats = (row) => ({
    post_id: row[0],
    post_date: row[1],
    responder_username: row[2],
    responder_name: row[3],
    topic_id: row[4],
    subject: row[5],
    topic_status: row[6],
    topic_date: row[7],
    student_username: row[8],
    school: row[9] || "Outros",
    course: row[10] || "Geral",
    sla_minutes: parseFloat(row[11]) || 0,
    responded_24h: parseInt(row[12]) || 0,
    is_solution: parseInt(row[13]) || 0,
    link: row[14],
    interaction_order: parseInt(row[15]) || 0,
    post_hour: parseInt(row[16]) || 0,
});

module.exports = { mapBIRowToStats };
