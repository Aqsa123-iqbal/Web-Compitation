const allowed = new Set(['P','DIV','BR','H1','H2','H3','H4','B','STRONG','I','EM','U','UL','OL','LI','A','BLOCKQUOTE','SPAN','FONT','IMG']);
export function sanitizeRichText(value = '') {
  if (typeof DOMParser === 'undefined') return String(value).replace(/<[^>]*>/g, '');
  const doc = new DOMParser().parseFromString(String(value), 'text/html');
  const walk = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      if (!allowed.has(child.tagName)) {
        if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG'].includes(child.tagName)) child.remove();
        else child.replaceWith(...child.childNodes);
        continue;
      }
      const href = child.tagName === 'A' ? child.getAttribute('href') : null;
      const src = child.tagName === 'IMG' ? child.getAttribute('src') : null;
      const alt = child.tagName === 'IMG' ? child.getAttribute('alt') : '';
      const alignment = child.getAttribute('align') || child.style?.textAlign;
      const fontColor = child.getAttribute('color') || child.style?.color;
      const highlight = child.style?.backgroundColor;
      const fontSize = child.style?.fontSize || (child.tagName === 'FONT' ? ({1:'10px',2:'13px',3:'16px',4:'18px',5:'24px',6:'32px',7:'48px'}[child.getAttribute('size')]) : '');
      if (child.tagName === 'FONT') {
        const span = doc.createElement('span');
        while (child.firstChild) span.append(child.firstChild);
        child.replaceWith(span);
        if (fontColor && /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(fontColor)) span.style.color = fontColor;
        if (fontSize) span.style.fontSize = fontSize;
        walk(span);
        continue;
      }
      for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
      if (child.tagName === 'A' && href && /^https?:\/\//i.test(href)) {
        child.setAttribute('href', href); child.setAttribute('target','_blank'); child.setAttribute('rel','noreferrer');
      }
      if (['left','center','right','justify'].includes(alignment)) child.style.textAlign = alignment;
      if (fontColor && /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(fontColor)) child.style.color = fontColor;
      if (highlight && /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(highlight)) child.style.backgroundColor = highlight;
      if (fontSize && /^(\d+(\.\d+)?(px|pt|em|rem|%))$/i.test(fontSize)) child.style.fontSize = fontSize;
      if (child.tagName === 'IMG') {
        if (src && /^https:\/\//i.test(src)) { child.setAttribute('src', src); child.setAttribute('alt', String(alt || '').slice(0, 160)); child.setAttribute('loading','lazy'); }
        else { child.remove(); continue; }
      }
      walk(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}
