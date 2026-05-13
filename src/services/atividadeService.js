const { Atividade } = require('../models');

class AtividadeService {
  async listar(filtros = {}) {
    const where = {};
    if (filtros.peso) where.peso = filtros.peso;
    if (filtros.dataInicio && filtros.dataFim) {
      where.data = { [require('sequelize').Op.between]: [filtros.dataInicio, filtros.dataFim] };
    }
    return Atividade.findAll({ where, order: [['data', 'DESC']] });
  }

  async buscarPorId(id) {
    const atividade = await Atividade.findByPk(id);
    if (!atividade) {
      const erro = new Error('Atividade não encontrada');
      erro.status = 404;
      throw erro;
    }
    return atividade;
  }

  async criar(dados) {
    return Atividade.create(dados);
  }

  async atualizar(id, dados) {
    const atividade = await this.buscarPorId(id);
    return atividade.update(dados);
  }

  async excluir(id) {
    const atividade = await this.buscarPorId(id);
    await atividade.destroy();
    return { mensagem: 'Atividade excluída com sucesso' };
  }
}

module.exports = new AtividadeService();
