import models from '../models/index.js';
import fs from 'fs';
const Op = models.Sequelize.Op;
import Mime from 'mime';

export default {
  get: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let id =  req.params.id;
    let include = [
      {
        model: models.Document,
      	as: 'document',
      	include: [
        	{
	          model: models.DocumentFile,
  	        as: 'files',
    	      attributes: [ 'id', 'mimeType']
      	  }
      	]
      }
    ];
  //console.log('/api/item/', id);
    if	( !id )	{
      let query = {
        order: [
          ['name', 'ASC']
        ],
        include: include
      };
      console.log('query', req.query);
      if  ( !req.query.product ) {
        query.include.push({
          model: models.ItemClass,
          as: 'itemClass'
        });
      } else {
        query.include.push({
          model: models.ItemClass,
          as: 'itemClass',
          where: {
            product: ( req.query.product === 'true' ) ? true : false
          }
        });
      }
      if	( req.query.key )	{
        query.where = {
          key: {
            [Op.like]: `%${req.query.key}%`
          }
        };
      }
      if  ( req.query.itemClassId ) {
        if  ( query.where ) {
          query.where.itemClassId = parseInt(req.query.itemClassId);
        } else {
          query.where = {
            itemClassId: parseInt(req.query.itemClassId)
          }
        }
      }
      console.log(JSON.stringify(query, ' ', 2));
      models.Item.findAll(query).then( async(items) => {
        res.json({
          items: items
        });
      });
    } else {
      models.Item.findByPk(id, {
        include: include
      }).then((item) => {
        res.json({
          item: item
        });
      });
    }
  },
  post: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let body = req.body;
    body.createdBy = req.session.user.id;
    body.updatedBy = req.session.user.id;
    body.id = undefined;
    console.log(JSON.stringify(body, ' ', 2 ));
    if	( body.document.descriptionType )	{
      let document = await models.Document.create({
        issueDate: new Date(),
        title: body.name,
        descriptionType: body.document.descriptionType,
        description: body.document.description,
        handledBy: body.handledBy,
        createdBy: body.createdBy,
        updatedBy: body.updatedBy
      });
      body.documentId = document.id;
    }
    models.Item.create(body).then((item) => {
      //console.log(item);
      res.json({
        item: item
    	});
    });
  },
  update: (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let body = req.body;
    let id = req.params.id ? req.params.id : body.id;
    models.Item.findByPk(id, {
      include: [
        {
          model: models.Document,
          as: 'document'
        }
      ]
    }).then(async(item) => {
      console.log(item);
      let documentId = item.documentId;
      let _item = item.dataValues;
      item.set(body);
      if	(( !body.document.descriptionType ) &&
           ( item.documentId ) )	{
        await models.Document.destroy({
          where: {
            id: item.documentId
          }
        })
        item.documentDocumentId = null;
      }
      if	(( body.document ) &&
           ( body.document.descriptionType ))	{
        if	( documentId )	{
          _item.document.issueDate = body.issueDate;
          _item.document.title = body.name;
          _item.document.descriptionType = body.document.descriptionType;
          _item.document.description = body.document.description;
          _item.document.handledBy = body.handledBy;
          _item.document.createdBy = body.createdBy;
          _item.document.updatedBy = body.updatedBy;
          console.log(_item.document);
          await _item.document.save();
        } else {
          let document = await models.Document.create({
            issueDate: new Date(),
            title: body.subject,
            descriptionType: body.document.descriptionType,
            description: body.document.description,
            handledBy: body.handledBy,
            createdBy: body.createdBy,
            updatedBy: body.updatedBy
          });
          item.documentId = document.id;
        }
      }
      item.save().then(() => {
        res.json({
          item: item
      	});
      });
    });
  },
  delete: async(req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let body = req.body;
    let id = req.params.id ? req.params.id : body.id;

    let item = await models.Item.findByPk(id);
    if	( item )	{
      item.destroy().then(() => {
        res.json({
          code: 0});
      });
    }
  },
  classesGet: (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    models.ItemClass.findAll({
      order: [
        [ 'displayOrder', 'asc']
      ]
    }).then((result) => {
      res.json({
        values: result
      })
    }).catch((e) => {
      console.log(e);
      res.json({
        code: -1
      });
    })
  },
  classesPut: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let kinds = req.body.values;
    for ( const kind of kinds ) {
      if  ( kind.id ) {
        let result = await models.ItemClass.findByPk(kind.id);
        if  ( !kind.name )  {
          await result.destroy();
        } else {
          result.set(kind);
          await result.save();
        }
      } else {
        await models.ItemClass.create(kind);
      }
    }
    models.ItemClass.findAll({
      order: [
        [ 'displayOrder', 'asc']
      ]
    }).then((kinds) => {
      res.json({
        values: kinds
      })
    })
  }
};
