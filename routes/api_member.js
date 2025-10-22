import models from '../models/index.js';
const Op = models.Sequelize.Op;

export default {
  get: async (req, res, next) => {
    let id =  req.params.id;
    //console.log('/api/member/', id);
    let include = [
      {
        model: models.MemberClass,
        as: 'memberClass'
      },
      {
        model: models.User,
        as: 'user'
      }
    ];
    if	( !id )	{
      let query = {
        order: [
          ['legalName', 'ASC']
        ],
        include: include
      };
      console.log('query', req.query);
      if  ( req.query.memberClassId ) {
        if  ( query.where ) {
          query.where.memberClassId = parseInt(req.query.memberClassId);
        } else {
          query.where = {
            memberClassId: parseInt(req.query.memberClassId)
          }
        }
      }
      //console.log(JSON.stringify(query, ' ', 2));
      models.Member.findAll(query).then( async(members) => {
        res.json({
          members: members
        });
      });
    } else {
      models.Member.findByPk(id, {
        include: include
      }).then((member) => {
        res.json({
          member: member
        });
      });
    }
  },
  post: (req, res, next) => {
    let body = req.body;
    models.Member.create(body).then((member) => {
      //console.log(member);
      res.json({
        member: member
      });
    }).catch ((e) => {
      console.log(e);
      res.status(500);
      res.json({
        code: -1,
        message: 'DB error at post'
      })
    });
  },
  update: async(req, res, next) => {
    let body = req.body;
    let id = req.params.id ? req.params.id : body.id;

    let member = await models.Member.findByPk(id)
    if	( member )	{
      member.set(body);
      member.save().then(() => {
        res.json({
          member: member
        });
      }).catch((e) => {
        console.log(e);
        res.status(500);
        res.json({
          code: -1
        });
      })
    }
  },
  delete: async(req, res, next) => {
    let body = req.body;
    let id = req.params.id ? req.params.id : body.id;

    let member = await models.Member.findByPk(id);
    if	( member )	{
      member.destroy().then(() => {
        res.json({
          code: 0});
      });
    }
  },
  classesGet: (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    models.MemberClass.findAll({
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
        let result = await models.MemberClass.findByPk(kind.id);
        if  ( !kind.name )  {
          await result.destroy();
        } else {
          result.set(kind);
          await result.save();
        }
      } else {
        if  ( kind.name ) {
          await models.MemberClass.create(kind);
        }
      }
    }
    models.MemberClass.findAll({
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
