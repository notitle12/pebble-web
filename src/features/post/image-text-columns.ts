import {unwrapColumnLayout,unwrapSelectedColumnLayout} from "./column-layout.ts";
import { closeHistory } from "@tiptap/pm/history";
import { Node, mergeAttributes } from "@tiptap/core";

import {safeColumnRatio,columnRatioStyle,columnLeftPercent,ratioFromPercent,ratioAtPointer} from "./column-ratio.ts";
export {columnRatios,safeColumnRatio} from "./column-ratio.ts";
export const newImageTextLayout = () => ({ type: "imageTextLayout", content: [0, 1].map(() => ({ type: "imageTextColumn", content: [{ type: "paragraph" }] })) });

export const ImageTextColumn = Node.create({
  name: "imageTextColumn", content: "block+", isolating: true,
  parseHTML: () => [{ tag: "div.post-column" }],
  renderHTML: () => ["div", { class: "post-column" }, 0],
});

export const ImageTextLayout = Node.create({
  name: "imageTextLayout", group: "block", content: "imageTextColumn{2}", isolating: true, draggable: true,
  addAttributes: () => ({ ratio: { default: "1:1", parseHTML: element => safeColumnRatio(element.getAttribute("data-ratio")), renderHTML: attrs => ({ "data-ratio": safeColumnRatio(attrs.ratio), style:columnRatioStyle(attrs.ratio) }) } }),
  parseHTML: () => [{ tag: "div.post-columns" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes({ class: "post-columns" }, HTMLAttributes), 0],
  addKeyboardShortcuts(){
    const unwrap=()=>unwrapSelectedColumnLayout(this.editor.state,tr=>this.editor.view.dispatch(tr));
    return {Backspace:unwrap,Delete:unwrap};
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div"); dom.className = "post-columns-editor";
      const contentDOM=document.createElement("div");contentDOM.className="post-columns";
      const actions=document.createElement("div");actions.className="post-columns-actions";actions.contentEditable="false";
      const unwrapButton=document.createElement("button");unwrapButton.type="button";unwrapButton.className="post-columns-unwrap";unwrapButton.setAttribute("aria-label","나란히 배치 해제");unwrapButton.title="이미지와 글을 유지하고 위아래로 배치";
      unwrapButton.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h6v7H4zM14 3h6v7h-6zM4 16h16v5H4zM8 12v2m8-2v2"/></svg>';
      unwrapButton.append(document.createTextNode("배치 해제"));actions.append(unwrapButton);
      const separator=document.createElement("div");separator.className="post-columns-separator";separator.contentEditable="false";
      separator.tabIndex=0;separator.setAttribute("role","separator");separator.setAttribute("aria-label","좌우 영역 너비 조절");separator.setAttribute("aria-orientation","vertical");separator.setAttribute("aria-valuemin","20");separator.setAttribute("aria-valuemax","80");separator.title="드래그해서 너비 조절 · 방향키로 조절 · 두 번 클릭하면 반씩";
      let drag:{pointerId:number;doc:typeof editor.state.doc}|null=null;
      const showRatio=(value:string)=>{
        const ratio=safeColumnRatio(value),percent=columnLeftPercent(ratio);
        contentDOM.dataset.ratio=ratio;contentDOM.style.cssText=columnRatioStyle(ratio);
        separator.style.left=`calc(${percent}% + ${(0.5-percent/100)*24}px)`;
        separator.setAttribute("aria-valuenow",String(Math.round(percent)));separator.setAttribute("aria-valuetext",`왼쪽 ${Math.round(percent)}%, 오른쪽 ${Math.round(100-percent)}%`);
      };
      const sync=()=>{showRatio(node.attrs.ratio);separator.tabIndex=editor.isEditable?0:-1;separator.hidden=!editor.isEditable;actions.hidden=!editor.isEditable;unwrapButton.disabled=!editor.isEditable;};
      const commit=(ratio:string)=>{
        const pos=getPos();
        if(typeof pos==="number"&&editor.isEditable&&!editor.isDestroyed&&safeColumnRatio(node.attrs.ratio)!==ratio)editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos,undefined,{...node.attrs,ratio}));
        else sync();
      };
      const cancel=()=>{drag=null;delete dom.dataset.resizing;sync();};
      const unwrap=()=>{
        if(!editor.isEditable||editor.isDestroyed)return;
        const pos=getPos();if(typeof pos!=="number")return;
        cancel();const tr=unwrapColumnLayout(editor.state.tr,pos);
        if(tr){editor.view.dispatch(tr);editor.view.focus();}
      };
      unwrapButton.addEventListener("pointerdown",event=>{event.preventDefault();event.stopPropagation();});
      unwrapButton.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();unwrap();});
      separator.addEventListener("pointerdown",event=>{
        if(!editor.isEditable||event.button!==0)return;
        event.preventDefault();event.stopPropagation();separator.focus({preventScroll:true});separator.setPointerCapture(event.pointerId);
        drag={pointerId:event.pointerId,doc:editor.state.doc};dom.dataset.resizing="true";
      });
      separator.addEventListener("pointermove",event=>{
        if(!drag)return;event.preventDefault();event.stopPropagation();
        const rect=contentDOM.getBoundingClientRect();showRatio(ratioAtPointer(event.clientX,rect.left,rect.width));
      });
      separator.addEventListener("pointerup",event=>{
        if(!drag)return;event.preventDefault();event.stopPropagation();
        const source=drag;drag=null;delete dom.dataset.resizing;
        if(!editor.state.doc.eq(source.doc)){sync();return;}
        const rect=contentDOM.getBoundingClientRect();commit(ratioAtPointer(event.clientX,rect.left,rect.width));
      });
      separator.addEventListener("pointercancel",cancel);separator.addEventListener("lostpointercapture",()=>{if(drag)cancel();});
      const historyKey=(event:KeyboardEvent)=>{
        if((event.ctrlKey||event.metaKey)&&!event.altKey&&(event.key.toLowerCase()==="z"||event.code==="KeyZ")&&!event.isComposing){
          event.preventDefault();event.stopPropagation();if(editor.isEditable){if(event.shiftKey)editor.commands.redo();else editor.commands.undo();}return true;
        }return false;
      };
      actions.addEventListener("keydown",event=>{historyKey(event);});
      separator.addEventListener("keydown",event=>{
        if(historyKey(event))return;
        if(!event.isComposing&&(event.key==="Backspace"||event.key==="Delete")){event.preventDefault();event.stopPropagation();unwrap();return;}
        if(event.key==="Escape"&&drag){event.preventDefault();event.stopPropagation();cancel();return;}
        if(!editor.isEditable||!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
        event.preventDefault();event.stopPropagation();const step=event.shiftKey?10:2;
        commit(ratioFromPercent(event.key==="Home"?20:event.key==="End"?80:columnLeftPercent(node.attrs.ratio)+(event.key==="ArrowLeft"?-step:step)));
      });
      separator.addEventListener("dblclick",event=>{event.preventDefault();event.stopPropagation();commit("1:1");});
      sync();dom.append(contentDOM,separator,actions);
      return {dom,contentDOM,update(next){if(next.type!==node.type)return false;node=next;if(!drag)sync();return true;},stopEvent:event=>separator.contains(event.target as globalThis.Node)||actions.contains(event.target as globalThis.Node),ignoreMutation:mutation=>separator.contains(mutation.target)||actions.contains(mutation.target)||mutation.type==="attributes"&&(mutation.target===dom||mutation.target===contentDOM),destroy(){drag=null;}};
    };
  },
});
