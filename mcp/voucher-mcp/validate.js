export const validateDay = (year, month, day) => {
  if ( ( !day ) || ( day < 1 ) || ( day > 31 ) ) {
    return '日付が正しくありません。';
  }
  return null;
};

export const validateLines = (lines) => {
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
  }
  return null;
};

export default {
  validateDay: validateDay,
  validateLines: validateLines
};