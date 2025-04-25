import {format as DateFormat, parse as DateParse} from '@formkit/tempo';

export const wareki = (date) => {
  const dateTimeFormat = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', {year: 'numeric'});
  return dateTimeFormat.format(new Date(date));
}

export const DateString = (d) => {
  return	DateFormat(d, 'YYYY-MM-DD');
}

export const StringDate = (s) => {
  return	DateParse(s, 'YYYY-MM-DD');
}

export const age = (s) => {
  let today = new Date();
  let birthDate = parseInt(s.replaceAll('-', ''));
  let today10000 = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return (Math.floor((today10000 - birthDate) / 10000));
}

export const numeric = (s) => {
  let ret;
  let sign;
  
  if ( s ) {
/*
    s = s.replaceAll('０','0')
     		 .replaceAll('１','1')
    		 .replaceAll('２','2')
		     .replaceAll('３','3')
    		 .replaceAll('４','4')
		     .replaceAll('５','5')
		     .replaceAll('６','6')
		     .replaceAll('７','7')
		     .replaceAll('８','8')
		     .replaceAll('９','9')
*/
    if ( typeof s == 'number' ) {
    	ret = s;
    } else {
    if ( s.length > 0 ) {
      if ( s[0] == '-' ) {
      	sign = -1;
      } else {
      	sign = 1;
      }
      let ss = s.replace(/[\D,\s]/g,'');
      if ( ss.length > 0 ) {
      	ret = parseInt(ss) * sign;
      } else {
      	ret = 0;
      }
    } else {
    	ret = 0;
    }
    }
  } else {
    ret = 0;
  }
  return ret;
}

export const formatDate = (_date, lang) => {
  let date;
  if ( _date )	{
    if  ( typeof _date === "string" ) {
      date = new Date(_date);
    } else {
      date = _date;
    }
  } else {
    date = new Date();
  }
  if	( lang === 'ja' )	{
		return	`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  } else {
    return	`${date.getFullYear()}-${('0' + (date.getMonth()+1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`
  }
}

export const burstPage = (lines, number) => {
  let pages = [];
  let page = [];
  for ( let line of lines) {
    if  ( page.length === number ) {
      pages.push(page)
      page = [];
    }
    page.push(line);
  }
  pages.push(page);
  return  (pages);
}

export const formatMoney = (_val) => {
  let val;
  if	( _val )	{
    if	( typeof _val === "string" )	{
      val = parseInt(_val);
    } else {
      val = _val;
    }
    return	`￥${val.toLocaleString()}`;
  } else {
    return	'';
  }
}

export const BANK_ACCOUNT_TYPE = [
  [ 0, '未設定'],
  [ 1, '普通'],
  [ 2, '当座'],
  [ 9, 'その他']
]

export const TAX_CLASS = [
  [ '非課税', 0],
  [ '内税',   1],
  [ '外税',   2],
  [ '別計算', 9]
];
export const taxClass = (tC) => {
  switch(tC) {
    case 0:
      return ("非課税");
    case 1:
      return ('内税');
    case 2:
      return ('外税');
    case 9:
      return ('別計算');
  }
  return ('');
}
