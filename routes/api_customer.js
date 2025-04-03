import models from '../models/index.js';
const Op = models.Sequelize.Op;

export default {
  get: async (req, res, next) => {
    let id =  req.params.id;
    console.log('/api/customer/', id);
		let include = [
      {
        model: models.CustomerClass,
        as: 'customerClass'
      }
    ];
    if	( !id )	{
      let where;
      if	( req.query )	{
        if	( req.query.kind )	{
          let kind = parseInt(req.query.kind);
          if	( kind > 0 )	{
            where = {
              customerClassId: kind
            }
          }
        }
        if  ( req.query.clientOnly )  {
          include[0].where = {
            isClient: true
          };
        }
      }
      let pr;
      if	( where )	{
      	pr = models.Customer.findAll({
        	order: [
          	['name', 'ASC']
        	],
        	include: include,
          where: where
        });
      } else {
      	pr = models.Customer.findAll({
        	order: [
          	['name', 'ASC']
        	],
        	include: include
        });
      }
      pr.then((customers) => {
        res.json({
          code: 0,
          customers: customers
      	});
      });
    } else {
      models.Customer.findOne({
        where: {
          id: id
        }
      }).then((customer) => {
        res.json({
          code: 0,
          customer: customer
        });
      });
    }
  },
  post: async(req, res, next) => {
    let body = req.body;
    //console.log('body:', body);

    let customer = await models.Customer.create(body)
    //console.log(customer);
    
    res.json({
      id: customer.id
    });
  },
  update: async(req, res, next) => {
    let body = req.body;
    let id = req.params.id ? req.params.id : body.id;

    let customer = await models.Customer.findOne({
      where: {
        id: id
      }
    });
    if	( customer )	{
      customer.set(body);
      customer.save().then(() => {
        res.json(customer);
      });
    }
  },
  delete: async(req, res, next) => {
    let body = req.body;
    let id = req.params.id ? req.params.id : body.id;

    let customer = await models.Customer.findOne({
      where: {
        id: id
      }
    });
    if	( customer )	{
      customer.destroy().then(() => {
        res.json({
          code: 0});
      });
    }
  },
  kindsGet: (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    models.CustomerClass.findAll({
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
        let result = await models.CustomerClass.findByPk(kind.id);
        if  ( !kind.name )  {
          await result.destroy();
        } else {
          result.set(kind);
          await result.save();
        }
      } else {
        await models.CustomerClass.create(kind);
      }
    }
    models.CustomerClass.findAll({
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
