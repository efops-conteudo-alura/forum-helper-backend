const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.STRING_CONNECTION, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Conexão com banco estabelecida com sucesso.');
  } catch (error) {
    console.error('Não foi possível conectar ao banco:', error);
  }
}

module.exports = { sequelize, testConnection };
