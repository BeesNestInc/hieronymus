import axios from 'axios';
import {isNode, isBrowser} from './utils.js';

export default async () => {
  let company;
  if  ( isBrowser() ) {
    const result = await axios.get('/api/company?kind=1');
    if	( result.data.companies.length > 0 )	{
      company = result.data.companies[0];
    }
  } else
  if  ( isNode() )  {
    const {default: models} = await import('../models/index.js');
    const found = await models.Company.findOne({
      where: {
        companyClassId: 1
      },
      include: [
        {
          model: models.CompanyClass,
          as: 'companyClass'
        }
      ]
    });
    company = found?.toJSON ? found.toJSON() : found;
  }
  return  (company)
}

