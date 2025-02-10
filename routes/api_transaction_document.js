import models from '../models/index.js';
const Op = models.Sequelize.Op;
import company from '../config/company.js';

export default {
  get: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let id =  req.params.id;
    console.log('/api/transaction/', id);
    let include = [
      {
        model: models.Task,
        as: 'task'
      },
      {
        model: models.TransactionDetail,
        as: 'lines'
      },
      {
        model: models.User,
        as: 'handleUser',
        attributes: ['name'],
        include: [
          {
            model: models.Member,
            as: 'member',
            attributes: ['legalName', 'tradingName']
          }
        ]
      },
      {
        model: models.Document,
        as: 'document'
      }
    ];
    
    if	( !id )	{
      let	order;
      let where;
      console.log('query', req.query);
      if  ( !req.query )  {
        res.json({
          no: company.transactionNo,
          issueDate: new Date(),
        })
      } else
      if	( req.query.order )	{
        order = req.params.order;
      } else {
        order = [
          [ "issueDate", "DESC" ],
          [ "lines", "lineNo", "ASC"]
        ]
      }
      if	( req.query.customer )	{
        include.push(
          {
            model: models.Task,
            as: 'task',
            where: {
              customerId: parseInt(req.query.customer)
            }
          })
      } else {
        include.push(
          {
            model: models.Task,
            as: 'task'
          });
      }
      if	( req.query.kind )	{
        let kind = parseInt(req.query.kind);
        if  ( kind > 0 )  {
          if  ( where ) {
            where = {
              [Op.and]: [
                where,
                {
                  kind: parseInt(req.query.kind)
                }
              ]
            };
          } else {
            where = {
              kind: parseInt(req.query.kind)
            };
          }
        }
      }
      //console.log({where});
      //console.log({order});
      //console.log({include});
      models.TransactionDocument.findAll({
        where: where,
        order: order,
        include: include
      }).then((transaction) => {
        res.json(transaction);
      });
    } else {
      models.TransactionDocument.findByPk(id, {
        include: include,
        order: [
          [ "lines", "lineNo", "ASC"]
        ]
      }).then((transaction) => {
        res.json({
          transaction: transaction
        });
      });
    }
  },
  post: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if  ( req.session.user.customerManagement )    {
      let body = req.body;
      body.createdBy = req.session.user.id;
      body.updatedBy = req.session.user.id;
      if  ( !body.no )  {
        let fy = await models.FiscalYear.findOne({
          where: {
            term: req.session.term
          }
        });
        fy.transactionCount += 1;
        fy.save();
        body.no = `${fy.year}-${fy.transactionCount}`;
      }
      body.id = undefined;
      console.log(JSON.stringify(body, ' ', 2 ));
      if	( body.document.descriptionType )	{
        let document = await models.Document.create({
        	issueDate: body.issueDate,
        	title: body.subject,
        	descriptionType: body.document.descriptionType,
        	description: body.document.description,
        	handledBy: body.handledBy,
        	createdBy: body.createdBy,
        	updatedBy: body.updatedBy
      	});
      	body.documentId = document.id;
      }
      models.TransactionDocument.create(body).then(async (transaction)=> {
        let lines = [];
        for ( let i = 0 ; i < body.lines.length ; i ++ )  {
          let line = body.lines[i];
          if	(( typeof line.itemId === 'number') ||
        			 ( line.itemName !== '' ))	{
          	line.transactionDocumentId = transaction.id;
          	line.lineNo = i;
          	line.id = undefined;
          	line = await models.TransactionDetail.create(line);
          	lines.push(line.dataValues);
          }
        }
        console.log(lines);
        let _transaction = transaction.dataValues;
        _transaction.lines = lines;
        console.log(JSON.stringify(_transaction, ' ', 2 ));
        res.json({
          transaction: _transaction
      	});
      }).catch ((e) => {
        console.log(e);
        res.json({ code: -1 });
      });
    } else {
      res.json({ code: -2 });
    }
  },
  update: (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
		let body = req.body;
		body.updatedBy = req.session.user.id;
		let id = req.params.id ? parseInt(req.params.id) : body.id;
    if  ( req.session.user.customerManagement )    {
      models.TransactionDocument.findByPk(id, {
              include: [
                {
                  model: models.Document,
                  as: 'document'
                }
              ]
      }).then(async (transaction) => {
        let kind = transaction.kind;
        let documentId = transaction.documentId;
        transaction.set(body);
        if	( kind < 10 )	{
        	await models.TransactionDetail.destroy({
          	where: {
            	transactionDocumentId: transaction.id
          	}
        	});
        } else {
          if	(( !body.document.descriptionType ) &&
          		 ( transaction.documentId ) )	{
          	await models.Document.destroy({
            	where: {
              	id: transaction.documentId
            	}
          	})
            transaction.documentDocumentId = null;
          }
        }
        let lines = [];
        let _transaction = transaction.dataValues;
        for ( let i = 0 ; i < body.lines.length ; i ++ )  {
          let line = body.lines[i];
          if	(( typeof line.itemId === 'number') ||
            	 ( line.itemName !== '' ))	{
         		line.transactionDocumentId = transaction.id;
          	line.lineNo = i;
          	line.id = undefined;
          	let _line = await models.TransactionDetail.create(line);
          	lines.push(_line.dataValues);
          }
        }
        if	(( body.document ) &&
        		 ( body.document.descriptionType ))	{
          if	( documentId )	{
            _transaction.document.issueDate = body.issueDate;
          	_transaction.document.title = body.subject;
          	_transaction.document.descriptionType = body.document.descriptionType;
          	_transaction.document.description = body.document.description;
          	_transaction.document.handledBy = body.handledBy;
          	_transaction.document.createdBy = body.createdBy;
          	_transaction.document.updatedBy = body.updatedBy;
            await _transaction.document.save();
          } else {
            let document = await models.Document.create({
	            issueDate: body.issueDate,
  	          title: body.subject,
    	        descriptionType: body.document.descriptionType,
      	      description: body.document.description,
      	      handledBy: body.handledBy,
        	    createdBy: body.createdBy,
          	  updatedBy: body.updatedBy
          	});
            transaction.documentId = document.id;
          }
        }
        await transaction.save();
        _transaction.lines = lines;
        console.log(JSON.stringify(_transaction, ' ', 2 ));
        res.json({
          transaction: _transaction
      	});
      }).catch ((e) => {
        console.log(e);
        res.json({ code: -1 });
      });
    } else {
      res.json({ code: -2 });
    }
  },
  delete: (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let id = parseInt(req.params.id);
    if  ( req.session.user.customerManagement )   {
      models.TransactionDocument.findByPk(id).then((transaction) => {
        transaction.destroy().then(() => {
          res.json({ code: 0});
        }).catch (()=> {
          res.json({ code: -1});
        })
      })
    } else {
      res.json({ code: -2});
    }
  },
  allocateReceivable: (req, res, next) => {

  },
  
}