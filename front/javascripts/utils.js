// browser only utils
import axios from 'axios';

export const isSameOrigin= (targetUrl) => {
  const currentOrigin = window.location.origin;
  const url = new URL(targetUrl, window.location.href); // 相対URLにも対応
  
  return url.origin === currentOrigin;
}

export const fetchTitleFromUrl = async(url) => {
  try {
    const response = await axios.get(url, {
      responseType: 'text' // HTMLとして取得する
    });

    const htmlString = response.data;
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const title = doc.querySelector('title')?.innerText || '(no title)';
    return title;

  } catch (error) {
    console.error('取得失敗:', error);
    return null;
  }
}

//  not work
const link = (href) => {
  let pathes = href.split('/');
  status.current = pathes[1];
  window.history.pushState(status, "", href);
  status.pathname = href;
  console.log({status});
}
