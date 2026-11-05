"use client";
import {autoImageTextBox,resizeImageTextBox,type ImageTextBox} from "../image-text-box";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { eraseImagePen } from "../image-pen-eraser";
import { installImageHistoryKeys, type ImageHistoryActions } from "../image-history-keys";
import styles from "./image-editor.module.css";
import { clearImagePen, emptyImageHistory, commitImageEdit, undoImageEdit, redoImageEdit, replaceImageText, type ImageEditHistory } from "../image-edit-history";
import { imageTextInputSurface, placedImageMosaics, replaceImageMosaic, placedImageTexts, imageTextLines, adjustCrop, fullImageCrop, hasCropChanges, clampCropRect, createMosaicOperation, createPenOperation, createTextOperation, safeBitmapSize, type CropOperation, type CropHandle, type ImageEditOperation, type PenPoint, type TextOperation, type PlacedImageText, type PixelSize } from "../image-edit-model";

type ActionName = "crop" | "mosaic" | "text" | "pen" | "eraser" | "clear" | "undo" | "redo" | "check" | "cancel" | "delete";
const actionPaths: Record<ActionName, string[]> = {
  crop: ["M6 3v13a2 2 0 0 0 2 2h13", "M3 6h13a2 2 0 0 1 2 2v13"],
  mosaic: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
  text: ["M4 6V4h16v2", "M12 4v16", "M8 20h8"],
  pen: ["m15 4 5 5", "m4 15 11-11a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L9 20l-6 1z", "m4 15 5 5"],
  eraser: ["m16 3 5 5a2 2 0 0 1 0 3L11 21H7l-5-5a2 2 0 0 1 0-3L12 3a3 3 0 0 1 4 0Z", "m7 8 10 10", "M11 21h10"],
  clear: ["M3 6h18", "M9 6V3h6v3", "m5 6 1 15h12l1-15", "M10 10v7", "M14 10v7"],
  undo: ["M8 4 3 9l5 5", "M3 9h10a7 7 0 0 1 0 14"],
  redo: ["m16 4 5 5-5 5", "M21 9H11a7 7 0 0 0 0 14"],
  check: ["m5 12 4 4L19 6"], cancel: ["m6 6 12 12", "M18 6 6 18"],
  delete: ["M3 6h18", "M8 6V4h8v2", "m19 6-1 14H6L5 6", "M10 11v5", "M14 11v5"],
};
function ActionIcon({ name }: { name: ActionName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{actionPaths[name].map((d, index) => <path key={index} d={d}/>)}</svg>;
}

export type ImageEditorProps = {
  src: string;
  fileName?: string;
  onApply: (file: File) => Promise<void>;
  onCancel: () => void;
};

type ImageTransform = {left:number;top:number;width:number;height:number;pixelWidth:number;pixelHeight:number};
type CropSelection = { startX: number; startY: number; endX: number; endY: number };
type Tool = "crop" | "mosaic" | "text" | "pen" | "eraser";
type ImageTextDraft = {id:string;editingId:string|null;x:number;y:number;sourceX:number;sourceY:number;sourceSize:PixelSize;text:string;maxWidth:number;boxHeight:number;autoSize:boolean;fontSize:number;color:string};

function cropBounds(selection: CropSelection, width: number, height: number): CropOperation | null {
  return clampCropRect(selection.startX, selection.startY, selection.endX, selection.endY, { width, height });
}

function replayHistory(source: ImageBitmap, operations: ImageEditOperation[], cursor: number): HTMLCanvasElement {
  let current = document.createElement("canvas");
  current.width = source.width;
  current.height = source.height;
  current.getContext("2d")!.drawImage(source, 0, 0);
  for (const operation of operations.slice(0, cursor)) {
    if (operation.type === "mosaic") {
      const small = document.createElement("canvas");
      small.width = Math.max(1, Math.ceil(operation.width / operation.blockSize));
      small.height = Math.max(1, Math.ceil(operation.height / operation.blockSize));
      const smallContext = small.getContext("2d")!;
      smallContext.imageSmoothingEnabled = true;
      smallContext.drawImage(current, operation.x, operation.y, operation.width, operation.height, 0, 0, small.width, small.height);
      const next = document.createElement("canvas");
      next.width = current.width;
      next.height = current.height;
      next.getContext("2d")!.drawImage(current, 0, 0);
      const outputContext = next.getContext("2d")!;
      outputContext.imageSmoothingEnabled = false;
      outputContext.drawImage(small, 0, 0, small.width, small.height, operation.x, operation.y, operation.width, operation.height);
      current.width = 0;
      current.height = 0;
      small.width = 0;
      small.height = 0;
      current = next;
      continue;
    }
    if (operation.type === "text") {
      drawTextOperation(current.getContext("2d")!, operation, current.width);
      continue;
    }
    if (operation.type === "pen") {
      if(operation.erasures?.length){
        const ink=document.createElement("canvas");ink.width=current.width;ink.height=current.height;
        const context=ink.getContext("2d")!;
        drawStroke(context,operation.points,operation.width,operation.color);
        context.globalCompositeOperation="destination-out";
        for(const erasure of operation.erasures)drawStroke(context,erasure.points,erasure.width,"#000000");
        current.getContext("2d")!.drawImage(ink,0,0);ink.width=0;ink.height=0;
      }else drawStroke(current.getContext("2d")!,operation.points,operation.width,operation.color);
      continue;
    }
    const next = document.createElement("canvas");
    next.width = operation.width;
    next.height = operation.height;
    next.getContext("2d")!.drawImage(current, operation.x, operation.y, operation.width, operation.height, 0, 0, operation.width, operation.height);
    current.width = 0;
    current.height = 0;
    current = next;
  }
  return current;
}

function drawStroke(context:CanvasRenderingContext2D,points:PenPoint[],width:number,color:string) {
  if(!points.length)return;
  context.strokeStyle=color;context.lineWidth=width;context.lineCap="round";context.lineJoin="round";
  context.beginPath();context.moveTo(points[0].x,points[0].y);
  if(points.length===1)context.lineTo(points[0].x+.1,points[0].y+.1);
  else for(const point of points.slice(1))context.lineTo(point.x,point.y);
  context.stroke();
}

function drawTextOperation(context: CanvasRenderingContext2D, operation: TextOperation, canvasWidth: number) {
  context.fillStyle = operation.color;
  context.font = `${operation.fontSize}px system-ui, sans-serif`;
  context.textBaseline = "top";
  const maxWidth = Math.max(1, Math.min(operation.maxWidth ?? canvasWidth, canvasWidth - operation.x));
  const lineHeight = Math.round(operation.fontSize * 1.25);
  context.save();context.beginPath();context.rect(operation.x,operation.y,maxWidth,operation.boxHeight??context.canvas.height-operation.y);context.clip();
  let y = operation.y;
  for (const line of imageTextLines(operation.text, maxWidth, text => context.measureText(text).width)) {
    context.fillText(line, operation.x, y);
    y += lineHeight;
  }
  context.restore();
}

export function ImageEditor({ src, fileName = "image", onApply, onCancel }: ImageEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [loadError, setLoadError] = useState("");
  const [history, setHistory] = useState<ImageEditHistory>(emptyImageHistory);
  const historyActions = useRef<ImageHistoryActions>({undo:()=>{},redo:()=>{},blocked:true});
  const historyRef = useRef(history); historyRef.current = history;
  const operations = history.present;
  const cursor = operations.length;
  const updateHistory = (next:ImageEditHistory) => {historyRef.current=next;setHistory(next);};
  const commitCommands = (next:ImageEditOperation[]) => updateHistory(commitImageEdit(historyRef.current,next));
  const [cropRect, setCropRect] = useState<CropOperation | null>(null);
  const [cropRedo, setCropRedo] = useState<CropOperation | null>(null);
  const cropDrag = useRef<{ handle: CropHandle; rect: CropOperation; x: number; y: number; transform:ImageTransform } | null>(null);
  const [selection, setSelection] = useState<CropSelection | null>(null);
  const [pointerStart, setPointerStart] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const confirmationRef = useRef<HTMLElement>(null);
  const requestCancel = () => { if (!saving) setConfirmCancel(true); };
  const [saveError, setSaveError] = useState("");
  const [tool, setTool] = useState<Tool | null>(null);
  const [activeMosaicIndex, setActiveMosaicIndex] = useState<number | null>(null);
  const [mosaicBlockSize, setMosaicBlockSize] = useState(12);
  const [mosaicDraft, setMosaicDraft] = useState<{index:number;rect:CropOperation;offset:PenPoint;blockSize:number}|null>(null);
  const mosaicDrag = useRef<{handle:CropHandle;rect:CropOperation;x:number;y:number;transform:ImageTransform}|null>(null);
  const mosaicSizeGesture = useRef(false);
  const [textDraft, setTextDraft] = useState<ImageTextDraft|null>(null);
  const textDraftRef = useRef(textDraft);textDraftRef.current=textDraft;
  const updateTextDraft = (next:ImageTextDraft|null) => {
    if(next?.autoSize){
      const context=document.createElement("canvas").getContext("2d")!;context.font=`${next.fontSize}px system-ui, sans-serif`;
      const box=autoImageTextBox(next.text,next.x,next.y,canvasSize,next.fontSize,text=>context.measureText(text).width);
      next={...next,maxWidth:box.width,boxHeight:box.height};
    }
    textDraftRef.current=next;setTextDraft(next);
  };
  const dismissTextOnPointer = useRef(false);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [textFontSize, setTextFontSize] = useState(32);
  const [textColor, setTextColor] = useState("#24352b");
  const [eraserWidth,setEraserWidth]=useState(32);
  const [eraserPosition,setEraserPosition]=useState<PenPoint|null>(null);
  const [penWidth, setPenWidth] = useState(8);
  const [penColor, setPenColor] = useState("#e53935");
  const [strokePreview, setStrokePreview] = useState<PenPoint[] | null>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const workingRef = useRef<HTMLCanvasElement | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const latestRef = useRef({ saving, confirmCancel });
  latestRef.current = { saving, confirmCancel };

  useEffect(() => {
    setMounted(true);
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const response = await fetch(src, { mode: "cors", credentials: "omit", signal: controller.signal });
        if (!response.ok) throw new Error(`이미지를 불러오지 못했습니다 (${response.status}).`);
        const decoded = await createImageBitmap(await response.blob());
        if (!active) { decoded.close(); return; }
        if (!safeBitmapSize(decoded.width, decoded.height)) {
          decoded.close();
          throw new Error("이미지 크기는 한 변 8,000px, 총 2,000만 픽셀까지 편집할 수 있습니다.");
        }
        bitmapRef.current = decoded;
        setBitmap(decoded);
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setLoadError(error instanceof Error ? error.message : "이미지를 불러오지 못했습니다.");
        }
      }
    })();
    return () => {
      active = false;
      controller.abort();
      bitmapRef.current?.close();
      bitmapRef.current = null;
      if (workingRef.current) { workingRef.current.width = 0; workingRef.current.height = 0; }
      workingRef.current = null;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [src]);

  useEffect(() => {
    if (mounted) (confirmCancel ? confirmationRef : dialogRef).current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [mounted, confirmCancel]);

  const basePreviewOperations = useMemo(()=>{
    const next=textDraft?.editingId?operations.filter(operation=>operation.type!=="text"||operation.id!==textDraft.editingId):operations;
    return mosaicDraft?replaceImageMosaic(next,mosaicDraft.index,mosaicDraft.rect,mosaicDraft.blockSize,mosaicDraft.offset):next;
  },[operations,textDraft?.editingId,mosaicDraft]);
  const previewOperations=useMemo(()=>tool==="eraser"&&strokePreview?eraseImagePen(basePreviewOperations,strokePreview,eraserWidth):basePreviewOperations,[basePreviewOperations,tool,strokePreview,eraserWidth]);
  const mosaicRegions = useMemo(()=>bitmap?placedImageMosaics(operations,bitmap):[],[operations,bitmap]);
  const textRegions = useMemo(()=>{
    if(!bitmap)return [];
    const context=document.createElement("canvas").getContext("2d")!;
    return placedImageTexts(operations,bitmap,(text,fontSize)=>{context.font=`${fontSize}px system-ui, sans-serif`;return context.measureText(text).width;});
  },[operations,bitmap]);
  const redraw = useCallback(() => {
    if (!bitmap || !displayRef.current) return;
    const working = replayHistory(bitmap, previewOperations, previewOperations.length);
    const previous=workingRef.current;workingRef.current=working;
    setCanvasSize(size=>size.width===working.width&&size.height===working.height?size:{width:working.width,height:working.height});
    const display=displayRef.current;
    if(display.width!==working.width||display.height!==working.height){
      display.width=working.width;display.height=working.height;
      setCropRect(fullImageCrop(working));setCropRedo(null);
    }
    const context=display.getContext("2d")!;context.clearRect(0,0,display.width,display.height);context.drawImage(working,0,0);
    if(previous){previous.width=0;previous.height=0;}
  }, [bitmap, previewOperations]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const activeDialog = latestRef.current.confirmCancel ? confirmationRef.current : dialogRef.current;
      if (event.key === "Tab" && activeDialog) {
        const controls = Array.from(activeDialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (event.key !== "Escape" || latestRef.current.saving) return;
      event.preventDefault();
      setConfirmCancel(previous => !previous);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  const pendingText = (draft=textDraftRef.current) => {
    if(!draft)return null;
    const operation=createTextOperation(draft.text,draft.sourceX,draft.sourceY,draft.sourceSize,draft.fontSize,draft.color,draft.maxWidth,draft.boxHeight);
    return operation?{...operation,id:draft.id,autoSize:draft.autoSize}:null;
  };
  const commitText = () => {
    const draft=textDraftRef.current;if(!draft)return;
    const next=replaceImageText(historyRef.current.present,draft.editingId,pendingText(draft));
    updateTextDraft(null);commitCommands(next);
  };
  const editText = (region:PlacedImageText) => {
    commitText();
    const operation=region.operation;
    if(!operation.id)return;
    setTool("text");setTextFontSize(operation.fontSize);setTextColor(operation.color);
    updateTextDraft({id:operation.id,editingId:operation.id,x:region.x,y:region.y,sourceX:operation.x,sourceY:operation.y,sourceSize:region.sourceSize,text:operation.text,maxWidth:region.width,boxHeight:region.height,autoSize:operation.autoSize===true,fontSize:operation.fontSize,color:operation.color});
  };
  const deleteText = () => {
    const draft=textDraftRef.current;if(!draft)return;
    updateTextDraft(null);commitCommands(replaceImageText(historyRef.current.present,draft.editingId,null));
  };
  const finishTextOnOutsidePointer = (event:React.PointerEvent<HTMLElement>) => {
    if(saving||!textDraftRef.current||!(event.target instanceof Element)||event.target.closest("[data-image-text-control],[data-image-text-hit]"))return;
    dismissTextOnPointer.current=!!event.target.closest("[data-image-stage]");commitText();
  };
  useEffect(()=>{if(textDraft)textInputRef.current?.focus({preventScroll:true});},[textDraft?.id]);
  useEffect(()=>{
    const canvas=displayRef.current;if(!canvas)return;
    const observer=new ResizeObserver(()=>setDisplayScale(canvas.clientWidth/Math.max(1,canvas.width)));
    observer.observe(canvas);return()=>observer.disconnect();
  },[bitmap,canvasSize.width,canvasSize.height]);
  const selectTool = (next: Tool) => {
    if (next === tool) return;
    if (textDraftRef.current) commitText();
    if (tool === "crop" && hasCropChanges(cropRect, canvasSize)) {
      commitCommands([...historyRef.current.present, cropRect!]);
    }
    mosaicDrag.current=null;setMosaicDraft(null);mosaicSizeGesture.current=false;
    cropDrag.current = null; setCropRedo(null); setSelection(null); setPointerStart(null); setActiveMosaicIndex(null); setTool(next);
  };
  const editMosaic = (index:number) => {
    commitText();setTool("mosaic");setActiveMosaicIndex(index);mosaicSizeGesture.current=false;
    const operation=historyRef.current.present[index];if(operation?.type==="mosaic")setMosaicBlockSize(operation.blockSize);

  };
  const updateMosaicSize = (size: number) => {
    setMosaicBlockSize(size);
    if(activeMosaicIndex===null)return;
    const current=historyRef.current,operation=current.present[activeMosaicIndex];if(operation?.type!=="mosaic")return;
    const next=current.present.map((value,index)=>index===activeMosaicIndex?{...operation,blockSize:size}:value);
    if(mosaicSizeGesture.current)updateHistory({...current,present:next,future:[]});
    else {commitCommands(next);mosaicSizeGesture.current=true;}
  };
  const startMosaicDrag = (event:React.PointerEvent<HTMLElement>,handle:CropHandle) => {
    if(saving||activeMosaicIndex===null)return;
    const region=mosaicRegions.find(value=>value.index===activeMosaicIndex),transform=imageTransform(),point=pointerCoordinates(event,transform);
    if(!region||!point||!transform)return;
    event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    const rect:CropOperation={type:"crop",x:region.x,y:region.y,width:region.width,height:region.height};
    mosaicDrag.current={handle,rect,...point,transform};
    setMosaicDraft({index:region.index,rect,offset:{x:region.offsetX,y:region.offsetY},blockSize:region.operation.blockSize});
  };
  const moveMosaicKey = (event:React.KeyboardEvent<HTMLElement>,handle:CropHandle) => {
    if(saving||activeMosaicIndex===null||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;
    const region=mosaicRegions.find(value=>value.index===activeMosaicIndex);if(!region)return;
    event.preventDefault();event.stopPropagation();const step=event.shiftKey?10:1;
    const rect=adjustCrop({type:"crop",x:region.x,y:region.y,width:region.width,height:region.height},handle,event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0,event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0,canvasSize);
    commitCommands(replaceImageMosaic(historyRef.current.present,region.index,rect,region.operation.blockSize,{x:region.offsetX,y:region.offsetY}));
  };
  const deleteMosaic = () => {
    if(activeMosaicIndex===null)return;
    commitCommands(replaceImageMosaic(historyRef.current.present,activeMosaicIndex,null,mosaicBlockSize));setActiveMosaicIndex(null);
  };
  const clearPen = () => {
    setStrokePreview(null);setPointerStart(null);
    commitCommands(clearImagePen(historyRef.current.present));
  };
  const undo = () => {
    if(textDraftRef.current)commitText();
    cropDrag.current=null;mosaicDrag.current=null;setMosaicDraft(null);mosaicSizeGesture.current=false;setPointerStart(null);setStrokePreview(null);
    if(tool==="crop"&&hasCropChanges(cropRect,canvasSize)){setCropRedo(cropRect);setCropRect(fullImageCrop(canvasSize));return;}
    setActiveMosaicIndex(null);updateHistory(undoImageEdit(historyRef.current));setSelection(null);
  };
  const redo = () => {
    if(textDraftRef.current)commitText();
    mosaicDrag.current=null;setMosaicDraft(null);mosaicSizeGesture.current=false;
    if(cropRedo){setCropRect(cropRedo);setCropRedo(null);return;}
    const next=redoImageEdit(historyRef.current);updateHistory(next);
    const last=next.present.at(-1);if(tool==="mosaic"&&last?.type==="mosaic"){setActiveMosaicIndex(next.present.length-1);setMosaicBlockSize(last.blockSize);}
    setSelection(null);
  };
  historyActions.current={undo,redo,deleteSelected:deleteMosaic,blocked:saving||confirmCancel};
  useEffect(()=>installImageHistoryKeys(window,()=>historyActions.current),[]);

  const imageTransform = ():ImageTransform|null => {
    const canvas=displayRef.current;if(!canvas)return null;
    const rect=canvas.getBoundingClientRect();return {left:rect.left,top:rect.top,width:rect.width,height:rect.height,pixelWidth:canvas.width,pixelHeight:canvas.height};
  };
  const pointerCoordinates = (event: React.PointerEvent<HTMLElement>,transform=imageTransform()) => {
    if(!transform)return null;
    return {x:Math.max(0,Math.min(transform.pixelWidth,(event.clientX-transform.left)*transform.pixelWidth/Math.max(1,transform.width))),y:Math.max(0,Math.min(transform.pixelHeight,(event.clientY-transform.top)*transform.pixelHeight/Math.max(1,transform.height)))};
  };
  const startCropDrag = (event: React.PointerEvent<HTMLElement>, handle: CropHandle) => {
    if (saving || !cropRect) return;
    const transform=imageTransform(),point=pointerCoordinates(event,transform);
    if (!point||!transform) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    cropDrag.current = {handle, rect: cropRect, ...point,transform}; setCropRedo(null);
  };
  const cropKeys = (event: React.KeyboardEvent<HTMLElement>, handle: CropHandle) => {
    if (saving || !cropRect || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? 10 : 1;
    setCropRect(adjustCrop(cropRect, handle, event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0, canvasSize)); setCropRedo(null);
  };
  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if(dismissTextOnPointer.current){dismissTextOnPointer.current=false;return;}
    if (!workingRef.current || saving || !tool || tool === "crop" || event.button!==0 || !event.isPrimary) return;
    const point = pointerCoordinates(event);
    if (!point) return;
    if (tool === "text") {
      if(textDraftRef.current){commitText();return;}
      const x=Math.max(0,Math.min(canvasSize.width-Math.min(textFontSize*2,canvasSize.width),Math.round(point.x)));
      const y=Math.max(0,Math.min(canvasSize.height-Math.min(textFontSize*1.5,canvasSize.height),Math.round(point.y)));
      updateTextDraft({id:crypto.randomUUID(),editingId:null,x,y,sourceX:x,sourceY:y,sourceSize:{...canvasSize},text:"",maxWidth:Math.min(textFontSize*2,canvasSize.width-x),boxHeight:Math.round(textFontSize*1.25)+2,autoSize:true,fontSize:textFontSize,color:textColor});
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "pen" || tool === "eraser") {
      setStrokePreview([point]);
      return;
    }
    setPointerStart(point);
    setSelection({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });

  };
  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if(mosaicDrag.current){
      const drag=mosaicDrag.current,point=pointerCoordinates(event,drag.transform);
      if(point)setMosaicDraft(previous=>previous?{...previous,rect:adjustCrop(drag.rect,drag.handle,point.x-drag.x,point.y-drag.y,canvasSize)}:null);
      return;
    }
    if (cropDrag.current) {
      const drag=cropDrag.current,point=pointerCoordinates(event,drag.transform);
      if (point) setCropRect(adjustCrop(drag.rect, drag.handle, point.x-drag.x, point.y-drag.y, canvasSize));
      return;
    }
    if(tool==="eraser")setEraserPosition(pointerCoordinates(event));
    if ((tool === "pen" || tool === "eraser") && strokePreview) {
      const point = pointerCoordinates(event);
      if (point) setStrokePreview(previous => {
        if (!previous || previous.length >= 5000) return previous;
        const last = previous[previous.length - 1];
        if (Math.hypot(point.x - last.x, point.y - last.y) < 1) return previous;
        return [...previous, point];
      });
      return;
    }
    if (!pointerStart) return;
    const point = pointerCoordinates(event);
    if (point) setSelection({ startX: pointerStart.x, startY: pointerStart.y, endX: point.x, endY: point.y });
  };
  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if(mosaicDrag.current&&mosaicDraft){
      const drag=mosaicDrag.current,point=pointerCoordinates(event,drag.transform);
      const rect=point?adjustCrop(drag.rect,drag.handle,point.x-drag.x,point.y-drag.y,canvasSize):mosaicDraft.rect;
      commitCommands(replaceImageMosaic(historyRef.current.present,mosaicDraft.index,rect,mosaicDraft.blockSize,mosaicDraft.offset));
      mosaicDrag.current=null;setMosaicDraft(null);return;
    }
    if (cropDrag.current) { pointerMove(event); cropDrag.current = null; return; }
    if ((tool === "pen" || tool === "eraser") && strokePreview && workingRef.current) {
      const point = pointerCoordinates(event);
      const points = point ? [...strokePreview, point] : strokePreview;
      if(tool==="eraser")commitCommands(eraseImagePen(historyRef.current.present,points,eraserWidth));
      else {
        const operation=createPenOperation(points,workingRef.current,penWidth,penColor);
        if(operation)commitCommands([...historyRef.current.present,operation]);
      }
      setStrokePreview(null);
      return;
    }
    if (!pointerStart) return;
    const point = pointerCoordinates(event);
    if (point && tool === "mosaic" && workingRef.current) {
      // A click covers a small patch; a drag uses the exact selected rectangle.
      const clicked = Math.hypot(point.x-pointerStart.x,point.y-pointerStart.y)<2;
      const rect = clicked
        ? clampCropRect(point.x-40,point.y-40,point.x+40,point.y+40,workingRef.current)
        : clampCropRect(pointerStart.x,pointerStart.y,point.x,point.y,workingRef.current);
      if (rect) {
        const current=historyRef.current.present;commitCommands([...current,createMosaicOperation(rect,mosaicBlockSize)]);
        setActiveMosaicIndex(current.length);mosaicSizeGesture.current=true;

      }
    }
    setSelection(null); setPointerStart(null);
  };

  const apply = async () => {
    if (!bitmap || saving) return;
    const draft=textDraftRef.current;
    const exported = draft?replaceImageText(historyRef.current.present,draft.editingId,pendingText(draft)):historyRef.current.present.slice();
    if (tool === "crop" && hasCropChanges(cropRect, canvasSize)) exported.push(cropRect!);
    const canvas = replayHistory(bitmap, exported, exported.length);
    setSaving(true);
    setSaveError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("이미지를 내보내지 못했습니다.")), "image/png"));
      await onApply(new File([blob], `${fileName.replace(/\.[^.]+$/, "")}-edited.png`, { type: "image/png", lastModified: Date.now() }));
      setSaving(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "이미지 저장에 실패했습니다.");
      setSaving(false);
    } finally { canvas.width = 0; canvas.height = 0; }
  };

  if (!mounted) return null;
  const current = workingRef.current;
  const bounds = tool === "crop" ? cropRect : selection && current ? cropBounds(selection, current.width, current.height) : null;
  const selectedMosaic=mosaicRegions.find(region=>region.index===activeMosaicIndex);
  const activeMosaic=mosaicDraft?.rect??selectedMosaic;
  const pendingCrop = tool === "crop" && hasCropChanges(cropRect, canvasSize);
  return createPortal(<div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) {if(textDraftRef.current){commitText();return;}requestCancel();} }}>
    <section ref={dialogRef} onPointerDownCapture={finishTextOnOutsidePointer} inert={confirmCancel} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="image-editor-title" tabIndex={-1}>
      <header className={styles.header}>
        <h2 id="image-editor-title">이미지 편집</h2>

      </header>
      {loadError ? <div className={styles.error} role="alert">{loadError}</div> : !bitmap ? <p className={styles.status} role="status">이미지를 불러오는 중…</p> : <>
        <div className={styles.toolStrip} role="toolbar" aria-label="이미지 편집 도구">
          <div className={styles.toolChoices}>
            {([["crop", "자르기"], ["mosaic", "모자이크"], ["text", "글씨"], ["pen", "펜"], ["eraser", "지우개"]] as const).map(([value, label]) => <button key={value} type="button" className="editor-action" aria-label={label} aria-pressed={tool === value} onClick={() => selectTool(value)} disabled={saving}><ActionIcon name={value}/><span>{label}</span></button>)}
          </div>
          <div className={styles.historyActions}>
            <button type="button" className="editor-action" title="실행 취소" aria-label="실행 취소" onClick={undo} disabled={!history.past.length && !pendingCrop && !textDraft || saving}><ActionIcon name="undo"/></button>
            <button type="button" className="editor-action" title="다시 실행" aria-label="다시 실행" onClick={redo} disabled={!history.future.length && !cropRedo || saving}><ActionIcon name="redo"/></button>
          </div>
        </div>
        <div className={styles.stage} style={{"--image-native-width":`${canvasSize.width}px`,"--image-ratio":canvasSize.width/Math.max(1,canvasSize.height)} as CSSProperties} data-image-stage="" data-tool={tool??"none"} onPointerLeave={()=>setEraserPosition(null)} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { if (cropDrag.current) setCropRect(cropDrag.current.rect); cropDrag.current = null; mosaicDrag.current=null;setMosaicDraft(null);setPointerStart(null); setStrokePreview(null); }}>
          <canvas ref={displayRef} className={styles.canvas} aria-label="편집할 이미지" />
          {tool === "crop" && bounds && current && <div className={styles.cropShade} aria-hidden="true" style={{clipPath:`polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${bounds.x/current.width*100}% ${bounds.y/current.height*100}%, ${bounds.x/current.width*100}% ${(bounds.y+bounds.height)/current.height*100}%, ${(bounds.x+bounds.width)/current.width*100}% ${(bounds.y+bounds.height)/current.height*100}%, ${(bounds.x+bounds.width)/current.width*100}% ${bounds.y/current.height*100}%, ${bounds.x/current.width*100}% ${bounds.y/current.height*100}%)`}}/>}
          {bounds && current && (tool === "crop" ? <div className={styles.cropFrame} role="group" aria-label="자르기 영역 이동" tabIndex={0} onPointerDown={event => startCropDrag(event, "move")} onKeyDown={event => cropKeys(event, "move")} style={{left:`${bounds.x/current.width*100}%`,top:`${bounds.y/current.height*100}%`,width:`${bounds.width/current.width*100}%`,height:`${bounds.height/current.height*100}%`}}>
            <div className={styles.cropGrid} aria-hidden="true"/>
            {([["nw","왼쪽 위"],["ne","오른쪽 위"],["se","오른쪽 아래"],["sw","왼쪽 아래"]] as const).map(([handle,label])=><button key={handle} type="button" className={styles.cropHandle} data-handle={handle} aria-label={`자르기 ${label} 조절점`} disabled={saving} onPointerDown={event=>startCropDrag(event,handle)} onKeyDown={event=>cropKeys(event,handle)}/>)}
          </div> : <div className={styles.cropMarquee} aria-hidden="true" style={{ left: `${bounds.x / current.width * 100}%`, top: `${bounds.y / current.height * 100}%`, width: `${bounds.width / current.width * 100}%`, height: `${bounds.height / current.height * 100}%` }} />)}
          {(tool===null||tool==="mosaic")&&mosaicRegions.filter(region=>region.index!==activeMosaicIndex).map(region=><button key={region.index} type="button" className={styles.mosaicHitArea} aria-label={`모자이크 ${region.index+1} 수정`} title="클릭하여 모자이크 수정" style={{left:`${region.x/canvasSize.width*100}%`,top:`${region.y/canvasSize.height*100}%`,width:`${region.width/canvasSize.width*100}%`,height:`${region.height/canvasSize.height*100}%`}} onPointerDown={event=>{event.preventDefault();event.stopPropagation();editMosaic(region.index);}} onClick={event=>{if(event.detail===0)editMosaic(region.index);}} disabled={saving}/>)}
          {tool === "mosaic" && activeMosaic && current && <div className={styles.mosaicFrame} role="group" aria-label="모자이크 영역 이동" tabIndex={0} onPointerDown={event=>startMosaicDrag(event,"move")} onKeyDown={event=>moveMosaicKey(event,"move")} style={{left:`${activeMosaic.x/current.width*100}%`,top:`${activeMosaic.y/current.height*100}%`,width:`${activeMosaic.width/current.width*100}%`,height:`${activeMosaic.height/current.height*100}%`}}>
            {([["nw","왼쪽 위"],["ne","오른쪽 위"],["se","오른쪽 아래"],["sw","왼쪽 아래"]] as const).map(([handle,label])=><button key={handle} type="button" className={styles.cropHandle} data-handle={handle} aria-label={`모자이크 ${label} 조절점`} disabled={saving} onPointerDown={event=>startMosaicDrag(event,handle)} onKeyDown={event=>moveMosaicKey(event,handle)}/>)}
          </div>}
          {(tool===null||tool==="text")&&textRegions.filter(region=>region.operation.id!==textDraft?.editingId).map(region=><button key={region.operation.id} type="button" className={styles.textHitArea} data-image-text-hit="" aria-label={`글씨 수정: ${region.operation.text.slice(0,40)}`} title="클릭하여 글씨 수정·삭제" style={{left:`${region.x/canvasSize.width*100}%`,top:`${region.y/canvasSize.height*100}%`,width:`${region.width/canvasSize.width*100}%`,height:`${region.height/canvasSize.height*100}%`}} onPointerDown={event=>{event.preventDefault();event.stopPropagation();editText(region);}} onClick={event=>{if(event.detail===0)editText(region);}} disabled={saving}/>)}
          {textDraft && current && <textarea data-image-text-control="" ref={textInputRef} className={styles.textOverlay} aria-label="이미지에 넣을 글씨" placeholder="글씨" value={textDraft.text} maxLength={500} rows={1} style={{left:`${textDraft.x/current.width*100}%`,top:`${textDraft.y/current.height*100}%`,width:`${textDraft.maxWidth/current.width*100}%`,height:`${textDraft.boxHeight/current.height*100}%`,fontSize:`${textDraft.fontSize*displayScale}px`,color:textDraft.color,backgroundColor:imageTextInputSurface(textDraft.color),caretColor:textDraft.color,colorScheme:imageTextInputSurface(textDraft.color)==="#ffffff"?"light":"dark"}} onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onChange={event=>updateTextDraft({...textDraft,text:event.currentTarget.value})} onKeyDown={event=>{event.stopPropagation();if(event.key==="Enter"&&(event.ctrlKey||event.metaKey)&&!event.nativeEvent.isComposing){event.preventDefault();commitText();}}} disabled={saving}/>}
          {textDraft&&current&&<button type="button" className={styles.textDelete} data-image-text-control="" aria-label="글씨 삭제" title="글씨 삭제" style={{left:`clamp(10px, ${(textDraft.x+textDraft.maxWidth)/current.width*100}%, calc(100% - 10px))`,top:`clamp(10px, ${textDraft.y/current.height*100}%, calc(100% - 10px))`}} onPointerDown={event=>{event.preventDefault();event.stopPropagation();}} onClick={deleteText} disabled={saving}><ActionIcon name="cancel"/></button>}
          {tool === "pen" && strokePreview?.length && current && <svg className={styles.penPreview} viewBox={`0 0 ${current.width} ${current.height}`} preserveAspectRatio="none" aria-hidden="true"><polyline className={styles.penLine} points={strokePreview.map(point => `${point.x},${point.y}`).join(" ")} fill="none" stroke={penColor} strokeWidth={penWidth} strokeLinecap="round" strokeLinejoin="round" /></svg>}
          {tool==="eraser"&&eraserPosition&&current&&<svg className={styles.penPreview} viewBox={`0 0 ${current.width} ${current.height}`} preserveAspectRatio="none" aria-hidden="true"><circle cx={eraserPosition.x} cy={eraserPosition.y} r={eraserWidth/2} fill="#ffffff18" stroke="#000" strokeWidth={2/displayScale}/><circle cx={eraserPosition.x} cy={eraserPosition.y} r={eraserWidth/2} fill="none" stroke="#fff" strokeWidth={1/displayScale} strokeDasharray={`${3/displayScale} ${3/displayScale}`}/></svg>}
        </div>
        <div className={styles.toolbar}>
          <div className={styles.actions}>
            {tool === "crop" ? <span className={styles.dimensions}>남길 영역 {bounds?.width} × {bounds?.height}px</span> : tool === "mosaic" ? <>
              <label className={styles.rangeLabel}>모자이크 크기 <input type="range" min="4" max="48" step="2" value={mosaicBlockSize} onPointerDown={()=>{mosaicSizeGesture.current=false;}} onPointerUp={()=>{mosaicSizeGesture.current=false;}} onBlur={()=>{mosaicSizeGesture.current=false;}} onKeyDown={()=>{mosaicSizeGesture.current=false;}} onChange={event => updateMosaicSize(Number(event.currentTarget.value))} disabled={saving} /></label>
              <button type="button" className={styles.mosaicDelete} aria-label="선택한 모자이크 삭제" title="선택한 모자이크 삭제 (Backspace / Delete)" onClick={deleteMosaic} disabled={activeMosaicIndex===null||saving||confirmCancel}><ActionIcon name="delete"/></button>
            </> : tool === "text" ? <div className={styles.textSettings} data-image-text-control="">
              <label className={styles.rangeLabel}>글자 크기 <input type="range" min="16" max="160" step="2" value={textFontSize} onChange={event => {const fontSize=Number(event.currentTarget.value);setTextFontSize(fontSize);if(textDraftRef.current)updateTextDraft({...textDraftRef.current,fontSize});}} disabled={saving} /></label>
              <label className={styles.colorLabel}>글자색 <input type="color" value={textColor} onChange={event => {const color=event.currentTarget.value;setTextColor(color);if(textDraftRef.current)updateTextDraft({...textDraftRef.current,color});}} disabled={saving} /></label>
            </div> : tool === "eraser" ? <label className={styles.rangeLabel}>지우개 크기 <input type="range" min="4" max="128" step="2" value={eraserWidth} onChange={event=>setEraserWidth(Number(event.currentTarget.value))} disabled={saving}/></label> : tool === "pen" ? <>
              <label className={styles.rangeLabel}>펜 굵기 <input type="range" min="1" max="64" value={penWidth} onChange={event => setPenWidth(Number(event.currentTarget.value))} disabled={saving} /></label>
              <label className={styles.colorLabel}>펜 색상 <input type="color" value={penColor} onChange={event => setPenColor(event.currentTarget.value)} disabled={saving} /></label>
            </> : null}
            {(tool==="pen"||tool==="eraser")&&<button type="button" className="editor-action" onClick={clearPen} title="펜으로 그린 내용만 모두 지우기" aria-label="펜 전체 지우기" disabled={saving||!operations.some(operation=>operation.type==="pen")}><ActionIcon name="clear"/><span>전체 지우기</span></button>}
          </div>
          <p className={styles.dimensions}>{canvasSize.width} × {canvasSize.height}px</p>
        </div>
        {saveError && <p className={styles.error} role="alert">{saveError}</p>}
      </>}
      <footer className={styles.footer}>
        {saving && <span className={styles.status} role="status">편집한 이미지를 저장하는 중…</span>}
        <button type="button" className="editor-action" onClick={requestCancel} disabled={saving}><ActionIcon name="cancel"/><span>취소</span></button>
        <button type="button" className={`editor-action ${styles.primary}`} onClick={() => void apply()} disabled={!bitmap || !canvasSize.width || saving || cursor === 0 && !pendingCrop && !pendingText()}><ActionIcon name="check"/><span>저장</span></button>
      </footer>
    </section>
    {confirmCancel && <section ref={confirmationRef} className={styles.confirmation} role="alertdialog" aria-modal="true" aria-labelledby="image-discard-title" aria-describedby="image-discard-description" tabIndex={-1}>
      <h2 id="image-discard-title">이미지 편집을 취소할까요?</h2>
      <p id="image-discard-description">저장하지 않은 이미지 편집 내용이 모두 사라집니다.</p>
      <div className={styles.confirmActions}>
        <button type="button" className="editor-action" onClick={() => setConfirmCancel(false)}>계속 편집</button>
        <button type="button" className={`editor-action ${styles.discard}`} onClick={onCancel}>편집 취소</button>
      </div>
    </section>}
  </div>, document.body);
}
