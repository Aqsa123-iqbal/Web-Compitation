import { useEffect, useRef } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Eraser, Heading1, Heading2, Image, Italic, Link, List, ListOrdered, Redo2, Underline, Undo2 } from 'lucide-react';
import { sanitizeRichText } from './lib/sanitizeRichText';

const commands = [
  [Bold, 'Bold', 'bold'], [Italic, 'Italic', 'italic'], [Underline, 'Underline', 'underline'],
  [Heading1, 'Heading 1', 'formatBlock', 'h1'], [Heading2, 'Heading 2', 'formatBlock', 'h2'],
  [List, 'Bulleted list', 'insertUnorderedList'], [ListOrdered, 'Numbered list', 'insertOrderedList'],
  [AlignLeft, 'Align left', 'justifyLeft'], [AlignCenter, 'Align center', 'justifyCenter'], [AlignRight, 'Align right', 'justifyRight'],
  [Undo2, 'Undo', 'undo'], [Redo2, 'Redo', 'redo'],
];

export default function RichTextEditor({ label, value = '', placeholder = 'Write here…', onChange, className = '' }) {
  const editor = useRef(null);
  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== value) editor.current.innerHTML = value || '';
  }, [value]);
  const update = () => onChange(editor.current?.innerHTML || '');
  const run = (command, arg) => {
    editor.current?.focus();
    if (command === 'createLink') {
      const url = window.prompt('Enter an https:// link');
      if (!url || !/^https?:\/\//i.test(url)) return;
      arg = url;
    }
    document.execCommand(command, false, arg);
    update();
  };
  const setColor = (command, value) => { editor.current?.focus(); document.execCommand(command, false, value); update(); };
  const clear = () => { editor.current?.focus(); document.execCommand('removeFormat'); document.execCommand('formatBlock', false, 'p'); update(); };
  const addImage = () => { const url = window.prompt('Enter a public https:// image URL'); if (url && /^https:\/\//i.test(url)) run('insertImage', url); };
  return <div className={`field full-width rich-field ${className}`}>
    <span>{label}</span>
    <div className="rich-toolbar" role="toolbar" aria-label={`${label} formatting`}>
      {commands.map(([Icon, title, command, arg]) => <button key={title} type="button" title={title} aria-label={title} onMouseDown={e => e.preventDefault()} onClick={() => run(command, arg)}><Icon size={15}/></button>)}
      <label className="rich-color" title="Font color">A<input type="color" aria-label="Font color" defaultValue="#0f172a" onChange={e => setColor('foreColor', e.target.value)}/></label>
      <label className="rich-color highlight-color" title="Highlight color">▧<input type="color" aria-label="Highlight color" defaultValue="#fff2a8" onChange={e => setColor('hiliteColor', e.target.value)}/></label>
      <label className="rich-select-label" title="Font size"><select aria-label="Font size" defaultValue="3" onChange={e => run('fontSize', e.target.value)}><option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">XL</option></select></label>
      <button type="button" title="Insert hyperlink" aria-label="Insert hyperlink" onMouseDown={e => e.preventDefault()} onClick={() => { const url = window.prompt('Enter an https:// link'); if (url && /^https?:\/\//i.test(url)) run('createLink', url); }}><Link size={15}/></button>
      <button type="button" title="Insert image URL" aria-label="Insert image URL" onMouseDown={e => e.preventDefault()} onClick={addImage}><Image size={15}/></button>
      <button type="button" title="Clear formatting" aria-label="Clear formatting" onMouseDown={e => e.preventDefault()} onClick={clear}><Eraser size={15}/></button>
    </div>
    <div ref={editor} className="rich-editor" contentEditable role="textbox" aria-multiline="true" data-placeholder={placeholder} onInput={update}/>
  </div>;
}
