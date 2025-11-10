import axios from 'axios';

const bind_file = async (file) => {
  console.log('bind_file', file.id, file.documentId);
  let	result = await axios.put('/api/document/bind', {
    id: file.id,
    documentId: file.documentId
  });
  return	(result);
}
  
export const bindFile = async (files, documentId) => {
  if  ( files && files.length > 0 ) {
    console.log('files', files.length);
    let promises = [];
    for	( let i = 0; i < files.length ; i += 1 )	{
      //console.log('documentId', files[i].documentId);
      if	( !files[i].documentId )	{
        files[i].documentId = documentId;
        promises.push(bind_file(files[i]));
      }
    }
    await Promise.all(promises);
  }
}
  