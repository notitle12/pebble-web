import {Plugin,PluginKey} from '@tiptap/pm/state';
import type {EditorView} from '@tiptap/pm/view';
import type {Node} from '@tiptap/pm/model';

export const columnViewportKey=new PluginKey<boolean>('columnViewport');
function layoutShape(doc:Node):string {
 const shapes:unknown[]=[];
 doc.descendants(node=>{
  if(node.type.name!=='imageTextLayout')return;
  const columns:string[][]=[];
  node.forEach(column=>{const types:string[]=[];column.forEach(child=>types.push(child.type.name));columns.push(types);});
  shapes.push([node.attrs.ratio,columns]);
 });
 return JSON.stringify(shapes);
}
/** A mapped caret can be far from a moved block. Do not scroll to it during layout edits. */
type ViewportSnapshot={window:Window;x:number;y:number;ancestors:{element:HTMLElement;left:number;top:number}[]};
function captureViewport(dom:HTMLElement):ViewportSnapshot|null {
 const window=dom.ownerDocument.defaultView;if(!window)return null;
 const ancestors:ViewportSnapshot['ancestors']=[];
 for(let element=dom.parentElement;element;element=element.parentElement){
  if(element!==dom.ownerDocument.scrollingElement&&(element.scrollHeight>element.clientHeight||element.scrollWidth>element.clientWidth))ancestors.push({element,left:element.scrollLeft,top:element.scrollTop});
 }
 return {window,x:window.scrollX,y:window.scrollY,ancestors};
}
function restoreViewport(snapshot:ViewportSnapshot) {
 for(const {element,left,top} of snapshot.ancestors)if(element.isConnected)element.scrollTo({left,top,behavior:'instant'});
 snapshot.window.scrollTo({left:snapshot.x,top:snapshot.y,behavior:'instant'});
}
export function columnViewportPlugin():Plugin<boolean> {
 let currentView:EditorView|null=null,pending:ViewportSnapshot|null=null,frame:number|null=null;
 const cancelFrame=()=>{if(frame!==null&&currentView){currentView.dom.ownerDocument.defaultView?.cancelAnimationFrame(frame);frame=null;}};
 return new Plugin({
  key:columnViewportKey,
  state:{init:()=>false,apply(tr,previous,oldState,newState){
   const preserve=tr.getMeta(columnViewportKey)===true||tr.docChanged&&layoutShape(oldState.doc)!==layoutShape(newState.doc)||!!tr.getMeta('appendedTransaction')&&previous;
   if(preserve&&tr.docChanged&&currentView&&!pending)pending=captureViewport(currentView.dom);
   return preserve;
  }},
  props:{handleScrollToSelection(view){return columnViewportKey.getState(view.state)===true;}},
  view(view){
   currentView=view;const window=view.dom.ownerDocument.defaultView;
   // A new user action takes precedence over a scheduled correction.
   for(const event of ['wheel','touchmove','pointerdown','keydown'])window?.addEventListener(event,cancelFrame,{capture:true,passive:true});
   return {
    update(view){
     if(!pending)return;
     const snapshot=pending;pending=null;cancelFrame();
     view.dom.getBoundingClientRect();restoreViewport(snapshot);
     // ProseMirror and native scroll anchoring run after plugin updates.
     frame=snapshot.window.requestAnimationFrame(()=>{frame=null;if(!view.isDestroyed)restoreViewport(snapshot);});
    },
    destroy(){cancelFrame();pending=null;currentView=null;for(const event of ['wheel','touchmove','pointerdown','keydown'])window?.removeEventListener(event,cancelFrame,{capture:true});},
   };
  },
 });
}
