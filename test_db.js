require('dotenv').config();
const { Sequelize } = require('sequelize');

async function test() {
  const s = new Sequelize(process.env.STRING_CONNECTION, { dialect: 'postgres', logging: false });
  try {
    await s.authenticate();
    console.log('Banco conectado');

    const [tables] = await s.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tabelas:', tables.map(t => t.table_name));

    const [cols] = await s.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Atividades'");
    if (cols.length === 0) {
      console.log('Tabela Atividades NAO existe');
    } else {
      console.log('Colunas:', cols.map(c => c.column_name + ':' + c.data_type).join(', '));
    }

    const [count] = await s.query('SELECT COUNT(*) as total FROM "Atividades"');
    console.log('Registros:', count[0].total);

    await s.close();
  } catch (e) {
    console.error('ERRO:', e.message);
    if (e.original) console.error('Detalhe:', e.original.message);
  }
}
test();
