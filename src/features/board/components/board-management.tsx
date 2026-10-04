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

  function edit(board: Board) {
    setEditor({ id: board.id, name: board.name, parentId: board.parentId ?? null, displayOrder: String(board.displayOrder) });
    setFormError("");
    setPendingDelete(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current||uncertain||loading||error) return;
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
      setEditor(blankEditor());
      await load();
    } catch (cause) {
      if (current()){setUncertain(true);setFormError(`${boardFailure(cause)} 저장 여부가 확정되지 않았다면 재시도하기 전에 목록을 새로고침해 확인해 주세요.`);}
    } finally {
      busyRef.current = false;
      if (current()) setBusy(false);
    }
  }

  async function remove(board: Board) {
    if (busyRef.current || board.children.length > 0) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const value=await userSession.request(`/boards/${board.id}`, { method: "DELETE" });
      if(value!==null)throw new Error("삭제 결과를 확인하지 못했습니다.");
      if (!current()) return;
      setPendingDelete(null);
      if (editor.id === board.id) setEditor(blankEditor());
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

  return <section className="board-management" aria-labelledby="board-management-title">
    <h2 id="board-management-title">폴더 만들기·수정</h2>
    <p>폴더를 만들어 게시글을 정리할 수 있어요. 최대 3단계까지 구성할 수 있습니다.</p>
    <form onSubmit={event => void save(event)}><fieldset className="post-editor-fields" disabled={busy||loading||Boolean(error)||uncertain}>
      <label>폴더 이름<input value={editor.name} maxLength={100} aria-invalid={Boolean(formError)} onChange={event => { setEditor(value => ({ ...value, name: event.target.value })); setFormError(""); }} /></label>
      <label>상위 폴더<select value={editor.parentId ?? ""} onChange={event => setEditor(value => ({ ...value, parentId: event.target.value || null }))}>
        <option value="">최상위 폴더</option>
        {flatBoards.filter(board => !excludedIds.has(board.id) && board.depth < 2).map(board => <option key={board.id} value={board.id}>{"　".repeat(board.depth)}{board.name}</option>)}
      </select></label>
      <label>표시 순서<input type="number" min="0" max="2147483647" step="1" value={editor.displayOrder} onChange={event => setEditor(value => ({ ...value, displayOrder: event.target.value }))} /></label>
      {formError && <p role="alert">{formError}</p>}
      <div className="post-editor-actions"><button type="submit" disabled={busy}>{busy ? "저장 중…" : editor.id ? "변경 저장" : "폴더 만들기"}</button>{editor.id && <button type="button" className="secondary" disabled={busy} onClick={() => { setEditor(blankEditor()); setFormError(""); }}>취소</button>}</div>
    </fieldset></form>

    <h2>내 폴더</h2>
    {loading && <div className="list-state" role="status">폴더를 불러오고 있어요.</div>}
    {!loading && error && <div className="list-state"><p role="alert">{error}</p><button className="button" type="button" disabled={busy} onClick={() => void load()}>목록 새로고침</button></div>}
    {!loading && !error && boards.length === 0 && <div className="list-state">아직 만든 폴더가 없어요.</div>}
    {!loading && !error && boards.length > 0 && <ul aria-label="내 폴더 목록">{flatBoards.map(board => <li className="board-row" key={board.id} style={{ marginInlineStart: `${board.depth * 20}px` }}>
      <span>{board.name} <small>순서 {board.displayOrder}</small></span>
      <button type="button" className="button" disabled={busy} onClick={() => edit(board)}>편집</button>
      {board.children.length > 0 ? <span>하위 폴더가 있어 삭제할 수 없습니다.</span> : <button type="button" className="button" disabled={busy} onClick={() => setPendingDelete(board.id)}>삭제</button>}
      {pendingDelete === board.id && <div className="list-state" role="group" aria-label={`${board.name} 삭제 확인`}><p>폴더를 삭제하면 연결된 게시글은 미분류로 이동하며 본문은 보존됩니다. 이 작업을 진행할까요?</p><button type="button" disabled={busy} onClick={() => void remove(board)}>{busy ? "삭제 중…" : "삭제 확인"}</button><button type="button" className="secondary" disabled={busy} onClick={() => setPendingDelete(null)}>취소</button></div>}
    </li>)}</ul>}
    {!loading && !error && <button type="button" className="button" disabled={busy} onClick={() => void load()}>목록 새로고침</button>}
  </section>;
}
