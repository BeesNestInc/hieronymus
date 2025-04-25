import axios from 'axios';
export default async () => {
  let company;
  const result = await axios.get('/api/company?kind=1');
  if	( result.data.companies.length > 0 )	{
    company = result.data.companies[0];
  }
  return  (company)
}

