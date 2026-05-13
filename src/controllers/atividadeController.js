const atividadeService = require('../services/atividadeService');

class AtividadeController {
  async index(req, res) {
    try {
      const atividades = await atividadeService.listar(req.query);
      res.json(atividades);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao listar atividades', detalhe: error.message });
    }
  }

  async show(req, res) {
    try {
      const atividade = await atividadeService.buscarPorId(req.params.id);
      res.json(atividade);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ erro: error.message });
    }
  }

  async store(req, res) {
    try {
      const atividade = await atividadeService.criar(req.body);
      res.status(201).json(atividade);
    } catch (error) {
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ erro: 'Erro de validação', detalhes: error.errors?.map(e => e.message) });
      }
      res.status(500).json({ erro: 'Erro ao criar atividade', detalhe: error.message });
    }
  }

  async update(req, res) {
    try {
      const atividade = await atividadeService.atualizar(req.params.id, req.body);
      res.json(atividade);
    } catch (error) {
      if (error.status === 404) return res.status(404).json({ erro: error.message });
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ erro: 'Erro de validação', detalhes: error.errors?.map(e => e.message) });
      }
      res.status(500).json({ erro: 'Erro ao atualizar atividade', detalhe: error.message });
    }
  }

  async destroy(req, res) {
    try {
      const resultado = await atividadeService.excluir(req.params.id);
      res.json(resultado);
    } catch (error) {
      const status = error.status || 500;
      res.status(status).json({ erro: error.message });
    }
  }
}

module.exports = new AtividadeController();
