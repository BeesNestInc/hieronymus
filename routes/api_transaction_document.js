import models from '../models/index.js';
const Op = models.Sequelize.Op;
import {print} from '../libs/print.js';
import {DateString} from '../libs/utils.js';

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
        as: 'lines',
        include: [
          {
            model: models.TaxRule,
            as: 'taxRule'
          }
        ]
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
      },
      {
        model: models.TransactionKind,
        as: 'kind',
        include: [
          {
            model: models.VoucherClass,
            as: 'book'
          }
        ]
      }
    ];
    
    if	( !id )	{
      let order = [
        [ "issueDate", "DESC" ],
        [ "lines", "lineNo", "ASC"]
      ];
    	let where;
      console.log('query', req.query);
      if  ( !req.query )  {
        res.json({
          no: company.transactionNo,
          issueDate: new Date(),
        })
      } else
      if	( req.query.order )	{
        if	( req.query.order === 'asc' )	{
          order = [
            [ "issueDate", "ASC" ],
            [ "lines", "lineNo", "ASC"]
          ];
        }
      }
      if	( req.query.company )	{
        include.push(
          {
            model: models.Task,
            as: 'task',
            where: {
              companyId: parseInt(req.query.company)
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
                  kindId: parseInt(req.query.kind)
                }
              ]
            };
          } else {
            where = {
              kindId: parseInt(req.query.kind)
            };
          }
        }
      }
      if	( req.query.task )	{
        if  ( where ) {
          where = {
            [Op.and]: [
              where,
              {
                taskId: parseInt(req.query.task)
              }
            ]
          };
        } else {
          where = {
            taskId: parseInt(req.query.task)
          };
        }
      }
      if	( req.query.voucher )	{
        //console.log('voucher', req.query.voucher);
        if	( req.query.voucher === 'true' )	{
          include.push({
            model: models.TransactionKind,
            as: 'kind',
            where: {
              hasVoucher: true
            }
          });
        } else
        if	( req.query.voucher === 'false' )	{
          include.push({
            model: models.TransactionKind,
            as: 'kind',
            where: {
              hasVoucher: false
            }
          });
        } else {
          include.push({
            model: models.TransactionKind,
            as: 'kind'
          });
        }
      } else {
        include.push({
          model: models.TransactionKind,
          as: 'kind'
        });
      }
      //console.log({where});
      //console.log({order});
      //console.log({include});
      models.TransactionDocument.findAll({
        where: where,
        order: order,
        include: include
      }).then((transactions) => {
        res.json({
          code: 0,
          transactions: transactions
      	});
      });
    } else {
      models.TransactionDocument.findByPk(id, {
        include: include
      }).then((transaction) => {
        //console.log({transaction});
        if	( req.query.print )	{
          if	( !transaction.voucherId )	{
            console.log('create');
						models.Company.findAll({
            	where: {
              	companyClassId: 1
            	}
          	}).then((companies) => {
            	const company = companies[0];
            	print(req.query.print, {
              	transaction: transaction,
              	company: company
            	}).then((pdf) => {
              	res.setHeader('Content-Type', 'application/pdf');
              	res.send(pdf);
            	});
          	})
          } else {
            console.log('exist');
            models.Voucher.findByPk(transaction.voucherId, {
              include: [
                {
                  model: models.VoucherFile,
                  as: 'files'
                }
              ]
            }).then((voucher) => {
              let file;
              for	( let _file of voucher.files )	{
								if	( _file.name === req.query.print )	{
                  file = _file;
                  break;
                }
              }
              if	( file )	{
              	res.setHeader('content-Type', file.mimeType);
              	res.send(file.body);
              } else {
                res.status(404).end();
              }
            })
          }
        } else {
        	res.json({
          	code: 0,
          	transaction: transaction
        	});
        }
      });
    }
  },
  post: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    if  ( req.session.user.companyManagement )    {
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
        for ( let i = 0 ; i < body.lines.length ; i ++ )  {
          let line = body.lines[i];
          if	(( typeof line.itemId === 'number ') ||
               ( line.itemName !== '' ))	{
            line.transactionDocumentId = transaction.id;
            line.lineNo = i;
            line.id = undefined;
            line = await models.TransactionDetail.create(line);
          }
        }
        res.json({
          id: transaction.id,
          documentId: transaction.documentId
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
    if  ( req.session.user.companyManagement )    {
      models.TransactionDocument.findByPk(id, {
        include: [
          {
            model: models.Document,
            as: 'document'
          }, {
            model: models.TransactionKind,
            as: 'kind'
          }
        ]
      }).then(async (transaction) => {
        let kind = transaction.kind;
        let documentId = transaction.documentId;
        transaction.set(body);
        if	( kind.hasDetails )	{
        	await models.TransactionDetail.destroy({
          	where: {
            	transactionDocumentId: transaction.id
          	}
        	});
        }
        if	(( !body.document.descriptionType ) &&
          	 ( transaction.documentId ) )	{
          await models.Document.destroy({
            where: {
              id: transaction.documentId
            }
          })
          transaction.documentDocumentId = null;
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
        //console.log(JSON.stringify(_transaction, ' ', 2 ));
        res.json({
          id: transaction.id,
          documentId: transaction.documentId
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
    if  ( req.session.user.companyManagement )   {
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
  book: async (req, res, next) => {
    const transaction = await models.TransactionDocument.findByPk(req.params.id, {
      include: [
        {
          model: models.Task,
          as: 'task'
        },
        {
          model: models.TransactionDetail,
          as: 'lines',
          include: [
            {
              model: models.TaxRule,
              as: 'taxRule'
            }
          ]
        },
        {
					model: models.Company,
          as: 'company'
        },
        {
          model: models.TransactionKind,
          as: 'kind',
          include: [
            {
              model: models.VoucherClass,
              as: 'book'
            }
          ]
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
        ]
    });
		if	( transaction.kind.book && transaction.kind.book.form )	{
      const company = await models.Company.findOne({
        where: {
          companyClassId: 1
        }
      });
      const pdf = await print(transaction.kind.book.form, {
        transaction: transaction,
        company: company
      });
      let name = `${transaction.companyName}-${transaction.kind.book.form}-${DateString(new Date())} .pdf`;
      if	( transaction.voucherId )	{
        console.log('update');
        const voucher = await models.Voucher.findByPk(transaction.voucherId, {
          include: [
            {
              model: models.VoucherFile,
              as: 'files'
            }
          ]
        })
        let file;
        for ( let _file of voucher.files )	{
          if	( _file.name === transaction.kind.book.form )	{
            file = _file;
            break;
          }
        }
        if	( file )	{
          file.mimeType = 'application/pdf';
          file.body = pdf;
          file.name = name;
          file.save();
        } else {
          models.VoucherFile.create({
            voucherId: voucher.id,
            name: name,
            mimeType: 'application/pdf',
            body: pdf
          });
        }
      } else {
        console.log('create');
        let rule;
        transaction.lines.forEach(async (line) => {
          if  ( rule ) {
            if  ( rule.id !== line.taxRule.id ) {
              rule = await models.TaxRule.findOne({
                where: {
                  taxClass: 9
                }
              });
            }
          } else {
            rule = line.taxRule;
          }
        })
        const voucher = await models.Voucher.create({
          voucherClassId: transaction.kind.bookId,
          issueDate: transaction.issueDate,
          companyId: transaction.companyId,
          amount: transaction.amount,
          tax: transaction.tax,
          taxRule: rule,
          description: transaction.description,
          invoiceNo: transaction.company.invoiceNo,
          createdBy: req.session.user.id,
          updatedBy: req.session.user.id
        });
        transaction.voucherId = voucher.id;
        await transaction.save();
        await models.VoucherFile.create({
          voucherId: voucher.id,
          name: name,
          mimeType: 'application/pdf',
          body: pdf
        });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.send(pdf);
    }
  },
  kindsGet: (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    models.TransactionKind.findAll({
      order: [
        [ 'displayOrder', 'asc']
      ]
    }).then((kinds) => {
      res.json({
        values: kinds
      })
    })
  },
  kindsPut: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let kinds = req.body.values;
    for ( const kind of kinds ) {
      if  ( kind.id ) {
        let result = await models.TransactionKind.findByPk(kind.id);
        if  ( !kind.label )  {
          await result.destroy();
        } else {
            result.set(kind);
            await result.save();
        }
      } else {
        await models.TransactionKind.create(kind);
      }
    }
    models.TransactionKind.findAll({
      order: [
        [ 'displayOrder', 'asc']
      ]
    }).then((kinds) => {
      res.json({
        values: kinds
      })
    })
  }
}