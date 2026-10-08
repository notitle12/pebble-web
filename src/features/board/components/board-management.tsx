"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { MemberGate } from "../../auth/components/member-gate";
import { userSession } from "../../auth/user-session";
import { boardFailure, boardInput, flattenBoards, parseBoards, parseBoardWrite, type Board } from "../api/boards";

type Editor = { id: string | null; name: string; parentId: string | null; displayOrder: string };
const blankEditor = (): Editor => ({ id: null, name: "", parentId: null, displayOrder: "0" });

export function BoardManagement() {
  return <MemberGate>{member => <BoardManagementForMember key={member.id} memberId={member.id} />}</MemberGate>;
}

function BoardManagementForMember({ memberId }: { memberId: string }) {
  const [editorOpen,setEditorOpen]=useState(false);
  const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
  const [mode,setMode]=useState<"edit"|"move"|"create">("create");
  const nameInput=useRef<HTMLInputElement>(null);
  const parentInput=useRef<HTMLSelectElement>(null);
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
    return () => { mounted.current = false; loadSequence.current++; };
  }, [load]);

  useEffect(()=>{if(editorOpen)(mode==="move"?parentInput.current:nameInput.current)?.focus();},[editorOpen,editor.id,mode]);

  function edit(board: Board, nextMode:"edit"|"move"="edit") {
    setMode(nextMode);setEditorOpen(true);
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

  const excludedIds = useMemo(() => {
    if (!editor.id) return new Set<string>();
    const excluded = new Set<string>([editor.id]);
    const collect = (items: Board[]) => items.forEach(item => { if (excluded.has(item.id)) { item.children.forEach(child => excluded.add(child.id)); collect(item.children); } else collect(item.children); });
    collect(boards);
    return excluded;
  }, [boards, editor.id]);

  function height(items:Board[]):number{return Math.max(0,...items.map(board=>1+height(board.children)));}
  const editedBoard=flatBoards.find(board=>board.id===editor.id);
  const subtreeHeight=editedBoard?1+height(editedBoard.children):1;
  const disabled=busy||loading||Boolean(error)||uncertain;
  function create(parent:Board|null=null){
    setEditor({...blankEditor(),parentId:parent?.id??null,displayOrder:String(Math.min(2147483647,Math.max(-1,...(parent?parent.children:boards).map(board=>board.displayOrder))+1))});
    setMode("create");setEditorOpen(true);setFormError("");setPendingDelete(null);
  }
  function toggle(id:string){setCollapsed(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  function visible(items:Board[],depth=0):Array<Board&{depth:number}>{return items.flatMap(board=>[{...board,depth},...(collapsed.has(board.id)?[]:visible(board.children,depth+1))]);}
  return <section className="board-management" aria-labelledby="board-management-title">
    <header className="board-manager-heading"><div><a href="/settings/blog" className="board-manager-back">← 블로그 설정</a><h1 id="board-management-title">게시판 관리</h1><p>글의 자리를 정리하세요. 게시판은 최대 3단계로 구성할 수 있어요.</p></div><button className="button board-add-button" disabled={disabled} onClick={()=>create()}>+ 게시판 추가</button></header>
    <div className="board-manager-workspace">
      <section className="board-tree-panel" aria-label="게시판 목록">
        <div className="board-tree-heading"><h2>내 게시판 <span>{flatBoards.length}</span></h2><button className="board-icon-button" type="button" disabled={busy||loading} onClick={()=>void load()} aria-label="게시판 목록 새로고침"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 8a7 7 0 0 1 11.8-3L20 8M4 16l2.7 3A7 7 0 0 0 18.5 16"/></svg></button></div>
        <div className="board-default-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><div><strong>전체 게시글</strong><p>모든 글을 모아보는 기본 영역</p></div><span className="board-default-badge">기본</span></div>
        {loading&&<div className="list-state" role="status">게시판을 불러오고 있어요.</div>}
        {!loading&&error&&<div className="list-state"><p role="alert">{error}</p><button className="button" disabled={busy} onClick={()=>void load()}>다시 불러오기</button></div>}
        {!loading&&!error&&boards.length===0&&<div className="board-empty"><h3>첫 게시판을 만들어 보세요</h3><p>주제별로 글을 나누고 하위 게시판으로 정리할 수 있어요.</p><button className="button" onClick={()=>create()} disabled={disabled}>게시판 추가</button></div>}
        {!loading&&!error&&boards.length>0&&<ul className="board-tree" aria-label="내 게시판 계층">{visible(boards).map(board=><li key={board.id} className={editorOpen&&editor.id===board.id?"is-selected":""}>
          <div className="board-tree-row" style={{paddingInlineStart:`${16+board.depth*24}px`}}>
            {board.children.length?<button className="board-expand" aria-label={`${board.name} 하위 게시판 ${collapsed.has(board.id)?"펼치기":"접기"}`} aria-expanded={!collapsed.has(board.id)} onClick={()=>toggle(board.id)}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" style={{transform:collapsed.has(board.id)?"rotate(-90deg)":undefined}}><path d="m5 7 5 5 5-5"/></svg></button>:<span className="board-leaf-mark" aria-hidden="true">·</span>}
            <button className="board-name-button" disabled={disabled} onClick={()=>edit(board)}><span>{board.name}</span>{board.children.length>0&&<small>하위 {board.children.length}</small>}</button>
            <div className="board-row-actions"><button disabled={disabled} onClick={()=>edit(board)}>수정</button><button disabled={disabled} onClick={()=>edit(board,"move")}>이동</button>{board.depth<2&&<button disabled={disabled} onClick={()=>create(board)}>하위 추가</button>}<button className="board-delete-action" disabled={disabled||board.children.length>0} title={board.children.length?"하위 게시판을 먼저 이동하거나 삭제해 주세요.":undefined} onClick={()=>{setPendingDelete(board.id);setFormError("");}}>삭제</button></div>
          </div>
          {pendingDelete===board.id&&<div className="board-delete-confirm" role="group" aria-label={`${board.name} 삭제 확인`}><p><strong>{board.name}</strong> 게시판을 삭제할까요? 연결된 글은 전체 게시글에 남습니다.</p><div><button disabled={disabled} onClick={()=>void remove(board)}>삭제 확인</button><button disabled={busy} onClick={()=>setPendingDelete(null)}>취소</button></div></div>}
        </li>)}</ul>}
      </section>
      <aside className="board-editor-panel" aria-label="게시판 편집">
        {editorOpen?<><header><p>{mode==="create"?"새로운 공간":mode==="move"?"위치 변경":"게시판 설정"}</p><h2>{mode==="create"?"게시판 추가":mode==="move"?"게시판 이동":"게시판 수정"}</h2></header><form onSubmit={event=>void save(event)}><fieldset disabled={disabled}>
          <label>게시판 이름<input ref={nameInput} value={editor.name} maxLength={100} aria-invalid={Boolean(formError)} onChange={event=>{setEditor(value=>({...value,name:event.target.value}));setFormError("");}}/></label>
          <label>상위 게시판<select ref={parentInput} value={editor.parentId??""} onChange={event=>setEditor(value=>({...value,parentId:event.target.value||null}))}><option value="">최상위에 배치</option>{flatBoards.filter(board=>!excludedIds.has(board.id)&&board.depth+1+subtreeHeight<=3).map(board=><option key={board.id} value={board.id}>{"　".repeat(board.depth)}{board.name}</option>)}</select></label>
          <label>표시 순서<input type="number" min="0" max="2147483647" step="1" value={editor.displayOrder} onChange={event=>setEditor(value=>({...value,displayOrder:event.target.value}))}/></label><p className="board-editor-help">같은 상위 게시판 안에서 작은 순서부터 표시됩니다.</p>
          {formError&&<p role="alert" className="board-form-error">{formError}</p>}<div className="board-editor-actions"><button className="button board-save-button" disabled={busy} type="submit">{busy?"저장 중…":mode==="create"?"게시판 만들기":"변경 저장"}</button><button className="button" type="button" disabled={busy} onClick={()=>{setEditor(blankEditor());setEditorOpen(false);setFormError("");}}>취소</button></div>
        </fieldset></form>{uncertain&&<button className="button" disabled={busy} onClick={()=>void load()}>서버 목록 다시 확인</button>}</>:<div className="board-editor-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 4v16M14 9h3M14 13h3"/></svg><h2>게시판을 선택하세요</h2><p>목록에서 수정할 게시판을 선택하거나 새로운 게시판을 추가하세요.</p></div>}
      </aside>
    </div>
  </section>;
}
