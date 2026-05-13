require('dotenv').config();

module.exports = {
  development: {
    use_env_variable: 'STRING_CONNECTION',
    dialect: 'postgres'
  },
  test: {
    use_env_variable: 'STRING_CONNECTION',
    dialect: 'postgres'
  },
  production: {
    use_env_variable: 'STRING_CONNECTION',
    dialect: 'postgres'
  }
};