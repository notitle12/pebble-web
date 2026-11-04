import type {ImageEditOperation} from './image-edit-model.ts';
export type ImageEditHistory={past:ImageEditOperation[][];present:ImageEditOperation[];future:ImageEditOperation[][]};
export const emptyImageHistory=():ImageEditHistory=>({past:[],present:[],future:[]});
export function commitImageEdit(history:ImageEditHistory,next:ImageEditOperation[]):ImageEditHistory {
 if(JSON.stringify(history.present)===JSON.stringify(next))return history;
 return {past:[...history.past,history.present].slice(-100),present:next,future:[]};
}
export function undoImageEdit(history:ImageEditHistory):ImageEditHistory {
 if(!history.past.length)return history;
 return {past:history.past.slice(0,-1),present:history.past.at(-1)!,future:[history.present,...history.future]};
}
export function redoImageEdit(history:ImageEditHistory):ImageEditHistory {
 if(!history.future.length)return history;
 return {past:[...history.past,history.present],present:history.future[0],future:history.future.slice(1)};
}

export function replaceImageText(operations:ImageEditOperation[],editingId:string|null,next:Extract<ImageEditOperation,{type:'text'}>|null):ImageEditOperation[]{
 if(editingId===null)return next?[...operations,next]:operations;
 const index=operations.findIndex(operation=>operation.type==='text'&&operation.id===editingId);
 if(index<0)return operations;
 return next?operations.map((operation,i)=>i===index?next:operation):operations.filter((_,i)=>i!==index);
}
