const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../dbConection');

class Atividade extends Model {}

Atividade.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'O nome da atividade é obrigatório' },
        len: { args: [3, 255], msg: 'O nome deve ter entre 3 e 255 caracteres' },
      },
    },
    data: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: { msg: 'Data inválida' },
      },
    },
    responsaveis: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      validate: {
        isArray(value) {
          if (!Array.isArray(value) || value.length === 0) {
            throw new Error('Deve haver pelo menos um responsável');
          }
        },
      },
    },
    peso: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: { args: [1], msg: 'O peso mínimo é 1' },
        max: { args: [3], msg: 'O peso máximo é 3' },
        isInt: { msg: 'O peso deve ser um número inteiro entre 1 e 3' },
      },
    },
  },
  {
    sequelize,
    modelName: 'Atividade',
    timestamps: true,
    createdAt: 'data_criacao',
    updatedAt: 'data_atualizacao',
  },
);

module.exports = Atividade;
