export type ImageHistoryActions={undo:()=>void;redo:()=>void;deleteSelected?:()=>void;blocked:boolean};
/** Capture at the window before editor/textarea handlers so image edits never undo the post. */
export function installImageHistoryKeys(target:EventTarget,actions:()=>ImageHistoryActions):()=>void {
 const keydown=(raw:Event)=>{
  const event=raw as KeyboardEvent;
  if(event.key==='Backspace'||event.key==='Delete'){
   const target=event.target as (Element&{isContentEditable?:boolean})|null;
   if(target?.isContentEditable||(typeof target?.closest==='function'&&target.closest('input:not([type="range"]),textarea,select,[contenteditable="true"],[data-image-text-control]')))return;
   event.stopImmediatePropagation();if(event.isComposing)return;event.preventDefault();
   const current=actions();if(!current.blocked)current.deleteSelected?.();
   return;
  }
  if(!(event.ctrlKey||event.metaKey)||event.altKey||!(event.key.toLowerCase()==='z'||event.code==='KeyZ'))return;
  event.stopImmediatePropagation();
  if(event.isComposing)return;
  event.preventDefault();
  const current=actions();if(current.blocked)return;
  if(event.shiftKey)current.redo();else current.undo();
 };
 const options={capture:true};
 target.addEventListener('keydown',keydown,options);
 return()=>target.removeEventListener('keydown',keydown,options);
}
