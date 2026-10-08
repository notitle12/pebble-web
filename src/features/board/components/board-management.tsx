"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { MemberGate } from "../../auth/components/member-gate";
import { userSession } from "../../auth/user-session";
import { boardFailure, boardInput, flattenBoards, parseBoards, parseBoardWrite, type Board } from "../api/boards";

import { boardMove, type BoardDrop } from "../api/board-order";

type Editor = { id: string | null; name: string; parentId: string | null; displayOrder: string };
const blankEditor = (): Editor => ({ id: null, name: "", parentId: null, displayOrder: "0" });

export function BoardManagement() {
  return <MemberGate>{member => <BoardManagementForMember key={member.id} memberId={member.id} />}</MemberGate>;
}

function BoardManagementForMember({ memberId }: { memberId: string }) {
  const [editorOpen,setEditorOpen]=useState(false);
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
  const nameInput=useRef<HTMLInputElement>(null);
  const [dragId,setDragId]=useState<string|null>(null);
  const dragRef=useRef<string|null>(null);
  const [drop,setDrop]=useState<BoardDrop|null>(null);
  const dropRef=useRef<BoardDrop|null>(null);
  const hoverTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const hoverKey=useRef("");
  function clearDrag(){if(hoverTimer.current)clearTimeout(hoverTimer.current);hoverKey.current="";dragRef.current=null;dropRef.current=null;setDragId(null);setDrop(null);}
  function hover(id:string,position:BoardDrop["position"]){
    const key=id+position;if(hoverKey.current===key)return;
    if(hoverTimer.current)clearTimeout(hoverTimer.current);hoverKey.current=key;
    const next={id,position:position==="inside"?"before" as const:position};dropRef.current=next;setDrop(next);
    if(position==="inside")hoverTimer.current=setTimeout(()=>{
      if(!current()||!dragRef.current)return;
      dropRef.current={id,position:"inside"};setDrop(dropRef.current);
    },2000);
  }
  const pointer=useRef<{id:string;x:number;y:number;active:boolean}|null>(null);
  function pointerMove(event:PointerEvent<HTMLButtonElement>){
    const start=pointer.current;if(!start||disabled)return;
    if(!start.active){if(Math.hypot(event.clientX-start.x,event.clientY-start.y)<5)return;start.active=true;dragRef.current=start.id;setDragId(start.id);setFormError("");}
    const row=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-board-id]");
    if(!row){if(hoverTimer.current)clearTimeout(hoverTimer.current);hoverKey.current="";dropRef.current=null;setDrop(null);return;}
    const rect=row.getBoundingClientRect(),ratio=(event.clientY-rect.top)/rect.height;
    hover(row.dataset.boardId!,ratio<.25?"before":ratio>.75?"after":"inside");
  }
  async function move(){
    const source=dragRef.current,target=dropRef.current;clearDrag();
    if(!source||!target||disabled||busyRef.current||!current())return;
    let changes:ReturnType<typeof boardMove>;
    try{changes=boardMove(boards,source,target);}catch(cause){setFormError(cause instanceof Error?cause.message:"이동할 수 없습니다.");return;}
    await write(async()=>{for(const change of changes){if(!current())return;parseBoardWrite(await userSession.request(`/boards/${change.id}`,{method:"PATCH",body:{parentId:change.parentId,displayOrder:change.displayOrder}}),change.id);}});
  }
  async function write(action:()=>Promise<void>){
    if(busyRef.current||!current()||disabled)return;busyRef.current=true;setBusy(true);setFormError("");
    try{await action();if(current())await load();}catch(cause){if(current()){setUncertain(true);setFormError(`${boardFailure(cause)} 일부 변경이 저장됐을 수 있습니다. 목록을 다시 확인해 주세요.`);}}finally{busyRef.current=false;if(current())setBusy(false);}
  }
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor>(blankEditor);
  const [formError, setFormError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [uncertain,setUncertain]=useState(false);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const loadSequence = useRef(0);
  const flatBoards = useMemo(() => flattenBoards(boards), [boards]);
  const current = useCallback(() => mounted.current && userSession.snapshot().phase==="ready" && userSession.snapshot().member?.id === memberId, [memberId]);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    try {
      const value = await userSession.request("/members/me/boards", { method: "GET" });
      const parsed = parseBoards(value, true);
      if (current() && sequence === loadSequence.current) {setBoards(parsed);setUncertain(false);}
    } catch (cause) {
      if (current() && sequence === loadSequence.current) setError(boardFailure(cause));
    } finally {
      if (current() && sequence === loadSequence.current) setLoading(false);
    }
  }, [current]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; loadSequence.current++; if(hoverTimer.current)clearTimeout(hoverTimer.current); };
  }, [load]);

  useEffect(()=>{if(editorOpen&&!busy){nameInput.current?.focus();nameInput.current?.select();}},[editorOpen,editor.id,busy]);

  function edit(board: Board) {
    setEditorOpen(true);
    setEditor({ id: board.id, name: board.name, parentId: board.parentId ?? null, displayOrder: String(board.displayOrder) });
    setFormError("");
    setPendingDelete(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current||uncertain||loading||error||!current()) return;
    let body: ReturnType<typeof boardInput>;
    try {
      const order = editor.displayOrder.trim() === "" ? NaN : Number(editor.displayOrder);
      body = boardInput(editor.name, editor.parentId, order);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "입력을 확인해 주세요.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setFormError("");
    try {
      const value=await userSession.request(editor.id ? `/boards/${editor.id}` : "/boards", {
        method: editor.id ? "PATCH" : "POST",
        body,
      });
      parseBoardWrite(value,editor.id??undefined);
      if (!current()) return;
      setEditor(blankEditor());setEditorOpen(false);
      await load();
    } catch (cause) {
      if (current()){setUncertain(true);setFormError(`${boardFailure(cause)} 저장 여부가 확정되지 않았다면 재시도하기 전에 목록을 새로고침해 확인해 주세요.`);}
    } finally {
      busyRef.current = false;
      if (current()) setBusy(false);
    }
  }

  async function remove(board: Board) {
    if (busyRef.current || uncertain || loading || error || !current() || board.children.length > 0) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const value=await userSession.request(`/boards/${board.id}`, { method: "DELETE" });
      if(value!==null)throw new Error("삭제 결과를 확인하지 못했습니다.");
      if (!current()) return;
      setPendingDelete(null);
      if (editor.id === board.id) {setEditor(blankEditor());setEditorOpen(false);}
      await load();
    } catch (cause) {
      if (current()){setUncertain(true);setError(`${boardFailure(cause)} 삭제 여부가 확정되지 않았다면 재시도하기 전에 목록을 새로고침해 확인해 주세요.`);}
    } finally {
      busyRef.current = false;
      if (current()) setBusy(false);
    }
  }

  const disabled=busy||loading||Boolean(error)||uncertain;
  async function create(){
    if(disabled||busyRef.current)return;
    let name="새 게시판",suffix=2;
    while(boards.some(board=>board.name===name))name=`새 게시판 ${suffix++}`;
    await write(async()=>{
      // The new root must precede existing roots even if their old order is zero.
      for(let i=boards.length-1;i>=0;i--){if(!current())return;const board=boards[i];parseBoardWrite(await userSession.request(`/boards/${board.id}`,{method:"PATCH",body:{displayOrder:i+1}}),board.id);}
      if(!current())return;
      const board=parseBoardWrite(await userSession.request("/boards",{method:"POST",body:boardInput(name,null,0)}));
      if(current())edit(board);
    });
  }
  function toggle(id:string){setCollapsed(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  function visible(items:Board[],depth=0):Array<Board&{depth:number}>{return items.flatMap(board=>[{...board,depth},...(collapsed.has(board.id)?[]:visible(board.children,depth+1))]);}
  return <section className="board-management" aria-labelledby="board-management-title">
    <header className="board-manager-heading"><div><a href="/settings/blog" className="board-manager-back">← 블로그 설정</a><h1 id="board-management-title">게시판 관리</h1><p>글의 자리를 정리하세요. 게시판은 최대 3단계로 구성할 수 있어요.</p></div><button className="button board-add-button" disabled={disabled} onClick={()=>void create()}>+ 게시판 추가</button></header>
    <div className="board-manager-workspace">
      <section className="board-tree-panel" aria-label="게시판 목록">
        <div className="board-tree-heading"><h2>내 게시판 <span>{flatBoards.length}</span></h2><button className="board-icon-button" type="button" disabled={busy||loading} onClick={()=>void load()} aria-label="게시판 목록 새로고침"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 8a7 7 0 0 1 11.8-3L20 8M4 16l2.7 3A7 7 0 0 0 18.5 16"/></svg></button></div>
        <div className="board-default-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><div><strong>전체 게시글</strong><p>모든 글을 모아보는 기본 영역</p></div><span className="board-default-badge">기본</span></div>
        {loading&&<div className="list-state" role="status">게시판을 불러오고 있어요.</div>}
        {!loading&&error&&<div className="list-state"><p role="alert">{error}</p><button className="button" disabled={busy} onClick={()=>void load()}>다시 불러오기</button></div>}
        {!loading&&!error&&boards.length===0&&<div className="board-empty"><h3>첫 게시판을 만들어 보세요</h3><p>주제별로 글을 나누고 하위 게시판으로 정리할 수 있어요.</p><button className="button" onClick={()=>void create()} disabled={disabled}>게시판 추가</button></div>}
        {!loading&&!error&&boards.length>0&&<ul className="board-tree" aria-label="내 게시판 계층">{visible(boards).map(board=><li key={board.id} className={[editorOpen&&editor.id===board.id?"is-selected":"",dragId===board.id?"is-dragging":"",drop?.id===board.id?`drop-${drop.position}`:""].join(" ")} data-board-id={board.id}>
          <div className="board-tree-row" style={{paddingInlineStart:`${16+board.depth*24}px`}}>
            <button className="board-drag-handle" disabled={disabled||editorOpen} aria-label={`${board.name} 순서 이동`} onPointerDown={event=>{if(disabled||editorOpen||event.button!==0)return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);pointer.current={id:board.id,x:event.clientX,y:event.clientY,active:false};}} onPointerMove={pointerMove} onPointerUp={event=>{const active=pointer.current?.active;pointer.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(active)void move();}} onPointerCancel={()=>{pointer.current=null;clearDrag();}} onKeyDown={event=>{
              if(event.key==="Escape"){clearDrag();return;}
              if(event.key===" "||event.key==="Enter"){event.preventDefault();if(dragRef.current)void move();else{dragRef.current=board.id;setDragId(board.id);}return;}
              if(!dragRef.current)return;
              const rows=visible(boards);const at=rows.findIndex(row=>row.id===(dropRef.current?.id??board.id));
              if(event.key==="ArrowUp"||event.key==="ArrowDown"){event.preventDefault();const next=rows[Math.max(0,Math.min(rows.length-1,at+(event.key==="ArrowUp"?-1:1)))];hover(next.id,event.key==="ArrowUp"?"before":"after");}
              if(event.key==="ArrowRight"&&dropRef.current){event.preventDefault();hover(dropRef.current.id,"inside");}
            }}><svg viewBox="0 0 16 20" fill="currentColor" aria-hidden="true">{[5,10,15].flatMap(y=>[5,11].map(x=><circle key={`${x}-${y}`} cx={x} cy={y} r="1.2"/>))}</svg></button>
            {board.children.length?<button className="board-expand" aria-label={`${board.name} 하위 게시판 ${collapsed.has(board.id)?"펼치기":"접기"}`} aria-expanded={!collapsed.has(board.id)} onClick={()=>toggle(board.id)}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" style={{transform:collapsed.has(board.id)?"rotate(-90deg)":undefined}}><path d="m5 7 5 5 5-5"/></svg></button>:<span className="board-leaf-mark" aria-hidden="true">·</span>}
            {editorOpen&&editor.id===board.id?<form className="board-inline-name" onSubmit={event=>void save(event)}><input ref={nameInput} aria-label="게시판 이름" maxLength={100} disabled={disabled} value={editor.name} onChange={event=>setEditor(old=>({...old,name:event.target.value}))} onKeyDown={event=>{if(event.key==="Escape"){setEditorOpen(false);setFormError("");}}}/><button type="submit" disabled={disabled}>저장</button><button type="button" disabled={busy} onClick={()=>setEditorOpen(false)}>취소</button></form>:<span className="board-name-button"><span>{board.name}</span>{board.children.length>0&&<small>하위 {board.children.length}</small>}</span>}
            <div className="board-row-actions"><button disabled={disabled} onClick={()=>edit(board)}>수정</button><button className="board-delete-action" disabled={disabled||board.children.length>0} title={board.children.length?"하위 게시판을 먼저 이동하거나 삭제해 주세요.":undefined} onClick={()=>{setPendingDelete(board.id);setFormError("");}}>삭제</button></div>
          </div>
          {pendingDelete===board.id&&<div className="board-delete-confirm" role="group" aria-label={`${board.name} 삭제 확인`}><p><strong>{board.name}</strong> 게시판을 삭제할까요? 연결된 글은 전체 게시글에 남습니다.</p><div><button disabled={disabled} onClick={()=>void remove(board)}>삭제 확인</button><button disabled={busy} onClick={()=>setPendingDelete(null)}>취소</button></div></div>}
        </li>)}</ul>}
        <p className="board-drag-help">손잡이를 드래그해 순서를 변경하세요. 게시판 가운데에서 2초 머물면 하위로 이동합니다. 키보드: 손잡이에서 Space → ↑↓ 선택 → → 2초 대기(하위 이동) → Enter. Esc 취소.</p>
        {formError&&<p role="alert" className="board-form-error">{formError}</p>}
        {uncertain&&<button className="button" disabled={busy} onClick={()=>void load()}>서버 목록 다시 확인</button>}
      </section>
    </div>
  </section>;
}
