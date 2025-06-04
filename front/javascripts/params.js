export const parseParams = () => {
  let _params = location.search.substring(1);
  let params = new Map();
  if  ( _params )	{
    _params.split('&').map((item) => {
      let kv = item.split('=');
      params.set(decodeURI(kv[0]), decodeURI(kv[1]));
    });
  }
  return  (params);
}
export const buildParam = (status, _params) => {
  if	( !status.params )	{
    status.params = new Map();
  }
  if	( _params )	{
    Object.keys(_params).map((key) => {
      if	( !_params[key] )	{
        status.params.delete(key);
      } else {
        status.params.set(key,_params[key]);
      }
    });
  }
  console.log('params', status.params);
  let _array = [];
  status.params.forEach((value, key) => {
    //console.log('key, value', key, value);
    _array.push(encodeURI(`${key}=${value}`));
  });
  return (_array.join('&'));
}