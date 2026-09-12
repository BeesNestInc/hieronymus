export const validateDay = (year, month, day) => {
  if ( ( !day ) || ( day < 1 ) || ( day > 31 ) ) {
    return '日付が正しくありません。';
  }
  return null;
};

// 科目コードの正規化: 空白のみ・'null'・'undefined' 文字列は未入力(null)扱いにする。
// AIが「不明な項目は null」を文字列 "null" と書く混入対策。有効なコードは前後の空白を除去する。
const nullAccount = (code) => {
  if ( code === null || code === undefined ) return null;
  if ( typeof code !== 'string' ) return code;
  const t = code.trim();
  const lower = t.toLowerCase();
  if ( t === '' || lower === 'null' || lower === 'undefined' ) return null;
  return t;
};

export const normalizeLines = (lines) => {
  return (lines || []).map((line) => {
    const l = { ...line };
    if ( l.debitAccount === 'sundries' ) {
      l.debitAccount = null;
    } else {
      l.debitAccount = nullAccount(l.debitAccount);
    }
    if ( l.creditAccount === 'sundries' ) {
      l.creditAccount = null;
    } else {
      l.creditAccount = nullAccount(l.creditAccount);
    }
    return l;
  });
};

const isTaxAccount = (code) => {
  if ( !code ) return false;
  return Boolean(String(code).match(/^114|^308/));
};

// accounts（get_accounts の戻り値）を渡すと、未登録の勘定科目も検証する（税仮勘定 114*/308* を除く）。
export const validateLines = (lines, accounts) => {
  if ( !Array.isArray(lines) || lines.length === 0 ) {
    return '明細行がありません。';
  }
  for ( let i = 0; i < lines.length; i += 1 ) {
    const line = lines[i];
    if ( ( parseFloat(line.debitAmount) > 0 ) && !line.debitAccount ) {
      return `${i + 1}行目 : 借方科目が未入力です。`;
    }
    if ( ( parseFloat(line.creditAmount) > 0 ) && !line.creditAccount ) {
      return `${i + 1}行目 : 貸方科目が未入力です。`;
    }
    if ( accounts ) {
      if ( line.debitAccount && !isTaxAccount(line.debitAccount) &&
           !accounts.find((a) => a.code === line.debitAccount) ) {
        return `${i + 1}行目 : 借方科目に未登録の勘定科目が入力されています (${line.debitAccount})。get_accounts で確認してください。`;
      }
      if ( line.creditAccount && !isTaxAccount(line.creditAccount) &&
           !accounts.find((a) => a.code === line.creditAccount) ) {
        return `${i + 1}行目 : 貸方科目に未登録の勘定科目が入力されています (${line.creditAccount})。get_accounts で確認してください。`;
      }
    }
  }
  return null;
};

export default {
  validateDay: validateDay,
  normalizeLines: normalizeLines,
  validateLines: validateLines
};
