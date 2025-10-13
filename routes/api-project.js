import models from '../models/index.js';

export default {
  get: async (req, res, next) => {
    const id = req.params.id;
    try {
      if (id) {
        // Get single project
        const project = await models.Project.findByPk(id);
        if (project) {
          res.json(project);
        } else {
          res.status(404).send('Project not found');
        }
      } else {
        // Get project list
        const projects = await models.Project.findAll({
          order: [['code', 'ASC']]
        });
        res.json(projects);
      }
    } catch (err) {
      next(err);
    }
  },

  create: async (req, res, next) => {
    try {
      const project = await models.Project.create(req.body);
      res.status(201).json(project);
    } catch (err) {
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const project = await models.Project.findByPk(req.params.id);
      if (project) {
        await project.update(req.body);
        res.json(project);
      } else {
        res.status(404).send('Project not found');
      }
    } catch (err) {
      next(err);
    }
  },

  delete: async (req, res, next) => {
    try {
      const project = await models.Project.findByPk(req.params.id);
      if (project) {
        await project.destroy();
        res.status(204).send();
      } else {
        res.status(404).send('Project not found');
      }
    } catch (err) {
      next(err);
    }
  },

  getLabels: async (req, res, next) => {
    try {
      const project = await models.Project.findByPk(req.params.id);
      if (!project) {
        return res.status(404).send('Project not found');
      }
      const labels = await project.getLabels({
        joinTableAttributes: ['displayOrder'],
        order: [
          [models.sequelize.literal('"ProjectLabels"."displayOrder"'), 'ASC']
        ]
      });
      res.json(labels);
    } catch (err) {
      next(err);
    }
  },

  updateLabels: async (req, res, next) => {
    try {
      const projectId = req.params.id;
      const project = await models.Project.findByPk(projectId);
      if (!project) {
        return res.status(404).send('Project not found');
      }
      
      const labelsData = req.body.labels || []; // [{labelId: 1, displayOrder: 0}, ...]

      // 既存の関連をすべて削除
      await models.ProjectLabel.destroy({
        where: { projectId: projectId }
      });

      // 新しい関連をバルクインサート
      if (labelsData.length > 0) {
        const newAssociations = labelsData.map(item => ({
          projectId: projectId,
          labelId: item.labelId,
          displayOrder: item.displayOrder
        }));
        await models.ProjectLabel.bulkCreate(newAssociations);
      }
      
      res.status(200).send();
    } catch (err) {
      next(err);
    }
  }
};