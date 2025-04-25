import models from '../models/index.js';
import fs from 'fs';
const Op = models.Sequelize.Op;
import Mime from 'mime';

const getFiles = async (id) => {
  let files = await models.VoucherFile.findAll({
    where: {
      voucherId: id
    },
    attributes: {
      exclude: ['body']
    }
  });
  for	( let i = 0 ; i < files.length; i += 1 )	{
    if	( files[i].mimeType.match(/^image\//) )	{
      let file = await models.VoucherFile.findOne({
          where: {
            id: files[i].id
          },
          attributes: {
            include: ['body']
          }
        });
      files[i].body = file.body.toString('base64');
    } else {
      files[i].body = '';
    }
  }
  return	(files);
}

export default {
  get: async (req, res, next) => {
    let id =  req.params.id;
    //console.log('/api/voucher/', id);
    let include = [
    	{
        model: models.Company,
        as: 'company'
      },{
        model: models.User,
        as: 'updateUser'
      },{
        model: models.VoucherClass,
        as: 'voucherClass'
      }
    ];

    
    if	( !id )	{
      let	order;
      let where;
      console.log('query', req.query);
      if	( req.query.order )	{
        order = req.params.order;
      } else {
        order = [
          [ "issueDate", "ASC" ]
        ]
      }
      if	( req.query.date )	{
        let date = new Date(req.query.date);
        where = {
          [Op.or]: [
            {
              issueDate: {
                [Op.eq]: date
              }
            },
            {
              paymentDate: {
                [Op.eq]: date
              }
            }
          ]
        };
      } else
      if	( req.query.month )	{
        let ymd = req.query.month.split('-');
        let fromDate = new Date(parseInt(ymd[0]), parseInt(ymd[1]) - 1, 1);
        let toDate = new Date(parseInt(ymd[0]), parseInt(ymd[1]), 1);
        //console.log('month', fromDate, toDate);
        where = {
          [Op.or]: [
            {
              [Op.and]: [
                {
                  issueDate: {
                    [Op.gte]: fromDate
                  }
                }, {
                  issueDate: {
                    [Op.lt]: toDate
                  }
                }
              ]
            },
            {
              [Op.and]: [
                {
                  paymentDate: {
                    [Op.gte]: fromDate
                  }
                }, {
                  paymentDate: {
                    [Op.lt]: toDate
                  }
                }
              ]
            }
          ]
        };
      } else {
        let fy = await models.FiscalYear.findOne({
          where: {
            term: req.session.term
          }
        });
        where = {
            [Op.and]: [
              {
                issueDate: {
                  [Op.gte]: new Date(fy.startDate)
                }
              },
              {
                issueDate: {
                  [Op.lte]: new Date(fy.endDate)
                }
              }
            ]
          };
      }
      if	( req.query.type )	{
        let type = parseInt(req.query.type);
        if	( type > 0 )	{
        	where = {
          	[Op.and]: [
            	where,
            	{
              	voucherClassId: type
            	}
          	]
        	};
        }
      }
      if	( req.query.company )	{
        where = {
          [Op.and]: [
            where,
            {
              companyId: parseInt(req.query.company)
            }
          ]
        };
      }
      if	( req.query.upper )	{
        if	( req.query.lower )	{
          where = {
            [Op.and]: [
              where,
              {
                amount: {
                  [Op.gte]: parseInt(req.query.lower)
                }
              },
              {
                amount: {
                  [Op.lte]: parseInt(req.query.upper)
                }
              }
            ]
          };
        } else {
          where = {
            [Op.and]: [
              where,
              {
                amount: {
                  [Op.lte]: parseInt(req.query.upper)
                }
              }
            ]
          };
        }
      } else
      if	( req.query.lower )	{
        where = {
          [Op.and]: [
            where,
            {
              amount: {
                [Op.gte]: parseInt(req.query.lower)
              }
            }
          ]
        };

      }
      models.Voucher.findAll({
        where: where,
        order: order,
        include: include,
        distinct: true
      }).then( async(_vouchers) => {
        //console.log('_vouchers', _vouchers);
        let vouchers = [];
        for	( let i = 0; i < _vouchers.length ; i += 1 )	{
          let voucher = _vouchers[i].dataValues;
          let files = await getFiles(voucher.id);
          voucher.files = files;
          let details = await models.CrossSlipDetail.findAll({
            where: {
              [Op.or]: [
                {
                  debitVoucherId: voucher.id
                }, {
                  creditVoucherId: voucher.id
                }
              ]
            },
            include: [
              {
                model: models.CrossSlip,
                as: 'crossSlip'
              }
            ]
          });
          voucher.details = details;

          vouchers.push(voucher);
        }
        res.json({
          code: 0,
          vouchers: vouchers
      	});
      });
    } else {
      models.Voucher.findOne({
        where: {
          id: id
        },
        include: include
      }).then((voucher) => {
        res.json({
          code: 0,
          voucher: voucher
        });
      });
    }
  },
  post: async(req, res, next) => {
    let body = req.body;
    body.createdBy = req.session.user.id;
    body.updatedBy = req.session.user.id;
    //console.log('body:', body);
    models.Voucher.create(body).then((voucher) => {
      res.json({
        code: 0,
        voucher: voucher
      });
    }).catch((e) => {
      res.json({
        code: -1
      });
    })
    //console.log(voucher);
    
  },
  update: async(req, res, next) => {
    let body = req.body;
    body.updatedBy = req.session.user.id;
    let id = req.params.id ? req.params.id : body.id;

    let voucher = await models.Voucher.findByPk(id)
    if	( voucher )	{
      voucher.set(body);
      voucher.save().then(() => {
        res.json({
          voucher: voucher
      	});
      }).catch((e) => {
        res.json({
          code: -1
        });
      });
    }
  },
  delete: async(req, res, next) => {
    let body = req.body;
    let id = req.params.id ? req.params.id : body.id;

    models.Voucher.findByPk(id).then((voucher) => {
      voucher.destroy().then(() => {
        res.json({
          code: 0});
      }).catch((err) => {
        res.json({
          code: -2
        })
      });
    }).catch((err) => {
      res.json({
        code: -1
      })
    });
  },
  upload: (req, res, next) => {
    let voucher_id = req.params.id ? parseInt(req.params.id): null;
    let name = req.files.file.name;
    let tmp_name = req.files.file.path;
    let body = fs.readFileSync(tmp_name);
    let	mime_type = Mime.getType(tmp_name);
    models.VoucherFile.create({
      name: name,
      voucherId: voucher_id,
      mimeType: mime_type,
      body: body
    }).then	((ret) => {
      ret.body = ret.body.toString('base64');
      res.json({
            code: 0,
            file: ret
          });
    }).catch((err) => {
      res.json({
            code: -1
          });
    });
  },
  files: async (req, res, next) => {
    let id =  parseInt(req.params.id);
    console.log('/api/voucher/files', id);
    if	( id )	{
      let files = await getFiles(id);
      res.json(files);
    }
  },
  bind: (req, res, next) => {
    let	body = req.body;
    models.VoucherFile.findByPk(body.id).then((file) => {
      file.voucherId = body.voucherId;
      file.save().then(() => {
        res.json({
          code: 0
        });
      }).catch((e) => {
        console.log('error', e);
        res.json({
          code: -1
        });
      })
    })
  },
  deleteFile: (req, res, next) => {
    let id = parseInt(req.body.id);
    console.log('deleteFile', id);
    models.VoucherFile.findByPk(id).then((file) => {
      file.destroy().then(() => {
        res.json({
          code: 0
        });
      }).catch((e) => {
        res.json({
          code: -1
        });
      });
    }).catch((e) => {
      res.json({
        code: -1
      })
    });
  },
  classesGet: (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    models.VoucherClass.findAll({
      order: [
        [ 'displayOrder', 'asc']
      ]
    }).then((classes) => {
      res.json({
        values: classes
      })
    })
  },
  classesPut: async (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    let kinds = req.body.values;
    for ( const kind of kinds ) {
      if  ( kind.id ) {
        let result = await models.VoucherClass.findByPk(kind.id);
        if  ( !kind.name )  {
          await result.destroy();
        } else {
          result.set(kind);
          await result.save();
        }
      } else {
        await models.VoucherClass.create(kind);
      }
    }
    models.VoucherClass.findAll({
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
