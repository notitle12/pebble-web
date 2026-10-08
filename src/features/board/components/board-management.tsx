"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { MemberGate } from "../../auth/components/member-gate";
import { userSession } from "../../auth/user-session";
import { MemberApiError } from "../../../lib/member-api";
import { boardFailure, flattenBoards, parseBoards, type Board } from "../api/boards";
import {
  buildBoardTreeSaveBody,
  cloneBoardTree,
  createDraftBoard,
  deleteDraftBoard,
  moveDraftBoard,
  renameDraftBoard,
  sameBoardTree,
} from "../api/board-draft";
import type { BoardDrop } from "../api/board-order";

type NameEdit = { id: string; value: string };

export function BoardManagement() {
  return <MemberGate>{member => <BoardManagementForMember key={member.id} memberId={member.id} />}</MemberGate>;
}

function BoardManagementForMember({ memberId }: { memberId: string }) {
  const [original, setOriginal] = useState<Board[]>([]);
  const [draft, setDraft] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [edit, setEdit] = useState<NameEdit | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<BoardDrop | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const requestLock = useRef(false);
  const sequence = useRef(0);
  const pointer = useRef<{ id: string; x: number; y: number; active: boolean } | null>(null);
  const dragRef = useRef<string | null>(null);
  const dropRef = useRef<BoardDrop | null>(null);
  const allowNavigation = useRef(false);
  const dirtyRef = useRef(false);

  const current = useCallback(() => mounted.current
    && userSession.snapshot().phase === "ready"
    && userSession.snapshot().member?.id === memberId, [memberId]);
  const flat = useMemo(() => flattenBoards(draft), [draft]);
  const editBoardName = edit ? flat.find(board => board.id === edit.id)?.name : undefined;
  const dirty = !sameBoardTree(original, draft) || Boolean(edit && edit.value !== editBoardName);
  dirtyRef.current = dirty;
  const disabled = busy || loading || uncertain || Boolean(loadError);

  const load = useCallback(async (confirmDiscard = false) => {
    if (requestLock.current || !current()) return;
    if (confirmDiscard && dirtyRef.current && !window.confirm("저장하지 않은 변경 사항을 버리고 서버의 게시판 목록을 다시 불러올까요?")) return;
    const requestSequence = ++sequence.current;
    setLoading(true);
    setLoadError("");
    setError("");
    setMessage("");
    try {
      const value = await userSession.request("/members/me/boards", { method: "GET" });
      const parsed = parseBoards(value, true);
      if (current() && requestSequence === sequence.current) {
        setOriginal(parsed);
        setDraft(cloneBoardTree(parsed));
        setUncertain(false);
        setEdit(null);
        setPendingDelete(null);
      }
    } catch (cause) {
      if (current() && requestSequence === sequence.current) setLoadError(boardFailure(cause));
    } finally {
      if (current() && requestSequence === sequence.current) setLoading(false);
    }
  }, [current]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; sequence.current++; };
  }, [load]);

  useEffect(() => {
    if (edit) {
      nameInput.current?.focus();
      nameInput.current?.select();
    }
  }, [edit?.id]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigation.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const guardInternalLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;
      let url: URL;
      try { url = new URL(anchor.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin || url.href === window.location.href) return;
      if (!window.confirm("저장하지 않은 게시판 변경 사항이 있어요. 이 페이지를 나갈까요?")) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        allowNavigation.current = true;
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", guardInternalLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", guardInternalLink, true);
      allowNavigation.current = false;
    };
  }, [dirty]);

  function clearDrag() {
    dragRef.current = null;
    dropRef.current = null;
    pointer.current = null;
    setDragId(null);
    setDrop(null);
  }

  function chooseDrop(id: string, position: BoardDrop["position"]) {
    const next = { id, position };
    dropRef.current = next;
    setDrop(next);
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = pointer.current;
    if (!start || disabled || edit) return;
    if (!start.active) {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) return;
      start.active = true;
      dragRef.current = start.id;
      setDragId(start.id);
    }
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-board-id]");
    if (!row?.dataset.boardId) {
      dropRef.current = null;
      setDrop(null);
      return;
    }
    const rect = row.getBoundingClientRect();
    const ratio = rect.height ? (event.clientY - rect.top) / rect.height : 0.5;
    chooseDrop(row.dataset.boardId, ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside");
  }

  function applyMove() {
    const source = dragRef.current;
    const target = dropRef.current;
    clearDrag();
    if (!source || !target || disabled || !current()) return;
    try {
      setDraft(moveDraftBoard(draft, source, target));
      setMessage("");
      setError("");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "이동할 수 없습니다.");
    }
  }

  function addBoard() {
    if (disabled || edit || !current()) return;
    const id = `draft:${crypto.randomUUID()}`;
    const nextDraft = createDraftBoard(draft, id);
    setDraft(nextDraft);
    setCollapsed(previous => { const next = new Set(previous); next.delete(id); return next; });
    setEdit({ id, value: nextDraft[0].name });
    setPendingDelete(null);
    setMessage("");
    setError("");
  }

  function confirmName() {
    if (!edit || disabled || !current()) return;
    try {
      setDraft(renameDraftBoard(draft, edit.id, edit.value));
      setEdit(null);
      setError("");
      setMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "게시판 이름을 확인해 주세요.");
    }
  }

  function confirmDelete() {
    if (!pendingDelete || disabled || !current()) return;
    try {
      setDraft(deleteDraftBoard(draft, pendingDelete));
      if (edit?.id === pendingDelete) setEdit(null);
      setPendingDelete(null);
      setError("");
      setMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "게시판을 삭제할 수 없습니다.");
    }
  }

  async function save() {
    if (!dirty || edit || busy || requestLock.current || disabled || !current()) return;
    requestLock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = buildBoardTreeSaveBody(original, draft);
      const value = await userSession.request("/members/me/boards", { method: "PUT", body });
      const parsed = parseBoards(value, true);
      if (!current()) return;
      setOriginal(parsed);
      setDraft(cloneBoardTree(parsed));
      setUncertain(false);
      setMessage("게시판 변경 사항을 저장했어요.");
      setPendingDelete(null);
    } catch (cause) {
      if (!current()) return;
      if (cause instanceof MemberApiError && cause.status === 409 && cause.code === "BOARD_TREE_CHANGED") {
        setUncertain(true);
        setError("다른 변경으로 게시판 목록이 바뀌어 저장하지 못했습니다. 초안을 다시 저장하지 말고 서버 목록을 확인해 주세요.");
      } else if (cause instanceof MemberApiError && (cause.status === 0 || cause.code === "INVALID_RESPONSE")) {
        setUncertain(true);
        setError("저장 결과를 확인하지 못했습니다. 초안은 남겨 두었습니다. 서버 목록을 다시 불러오거나 초안을 버려 확인해 주세요.");
      } else {
        setError(boardFailure(cause));
      }
    } finally {
      requestLock.current = false;
      if (current()) setBusy(false);
    }
  }

  function cancelDraft() {
    if (!dirty || busy) return;
    if (uncertain) {
      void load(true);
      return;
    }
    setDraft(cloneBoardTree(original));
    setEdit(null);
    setPendingDelete(null);
    setError("");
    setMessage("");
    clearDrag();
  }

  function toggle(id: string) {
    setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  const visible = (items: Board[], depth = 0): Array<Board & { depth: number }> => items.flatMap(board => [
    { ...board, depth },
    ...(collapsed.has(board.id) ? [] : visible(board.children, depth + 1)),
  ]);

  return <section className="board-management" aria-labelledby="board-management-title">
    <header className="board-manager-heading">
      <div><a href="/settings/blog" className="board-manager-back">← 블로그 설정</a><h1 id="board-management-title">게시판 관리</h1><p>글의 자리를 정리하세요. 게시판은 최대 3단계로 구성할 수 있어요.</p></div>
      <button className="button board-add-button" disabled={disabled || Boolean(edit)} onClick={addBoard}>+ 게시판 추가</button>
    </header>
    <div className="board-manager-workspace">
      <section className="board-tree-panel" aria-label="게시판 목록">
        <div className="board-tree-heading"><h2>내 게시판 <span>{flat.length}</span></h2><button className="board-icon-button" type="button" disabled={busy || loading} onClick={() => void load(dirty)} aria-label="게시판 목록 새로고침"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 8a7 7 0 0 1 11.8-3L20 8M4 16l2.7 3A7 7 0 0 0 18.5 16"/></svg></button></div>
        <div className="board-default-row"><span className="board-default-drag-space" aria-hidden="true"/><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><div><strong>전체 게시글</strong><p>모든 글을 모아보는 기본 영역</p></div><span className="board-default-badge">기본</span></div>
        {loading && <div className="list-state" role="status">게시판을 불러오고 있어요.</div>}
        {!loading && loadError && <div className="list-state"><p role="alert">{loadError}</p><button className="button" disabled={busy} onClick={() => void load(uncertain || dirty)}>서버 목록 다시 확인</button></div>}
        {!loading && !loadError && draft.length === 0 && <div className="board-empty"><h3>첫 게시판을 만들어 보세요</h3><p>주제별로 글을 나누고 하위 게시판으로 정리할 수 있어요.</p><button className="button" onClick={addBoard} disabled={disabled || Boolean(edit)}>게시판 추가</button></div>}
        {!loading && !loadError && draft.length > 0 && <ul className="board-tree" aria-label="내 게시판 계층">{visible(draft).map(board => <li key={board.id} className={[edit?.id === board.id ? "is-selected" : "", dragId === board.id ? "is-dragging" : "", drop?.id === board.id ? `drop-${drop.position}` : ""].join(" ")} data-board-id={board.id}>
          <div className="board-tree-row" style={{ paddingInlineStart: `${16 + board.depth * 24}px` }}>
            <button className="board-drag-handle" disabled={disabled || Boolean(edit)} aria-label={`${board.name} 순서 이동`} onPointerDown={event => { if (disabled || edit || event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); pointer.current = { id: board.id, x: event.clientX, y: event.clientY, active: false }; }} onPointerMove={pointerMove} onPointerUp={event => { const active = pointer.current?.active; pointer.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (active) applyMove(); }} onPointerCancel={clearDrag} onKeyDown={event => {
              if (event.key === "Escape") { clearDrag(); return; }
              if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (dragRef.current) applyMove(); else { dragRef.current = board.id; setDragId(board.id); } return; }
              if (!dragRef.current) return;
              const rows = visible(draft);
              const at = rows.findIndex(row => row.id === (dropRef.current?.id ?? board.id));
              if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); const next = rows[Math.max(0, Math.min(rows.length - 1, at + (event.key === "ArrowUp" ? -1 : 1)))]; chooseDrop(next.id, event.key === "ArrowUp" ? "before" : "after"); }
              if (event.key === "ArrowRight" && dropRef.current && dropRef.current.id !== dragRef.current) { event.preventDefault(); chooseDrop(dropRef.current.id, "inside"); }
            }}><svg viewBox="0 0 16 20" fill="currentColor" aria-hidden="true">{[5, 10, 15].flatMap(y => [5, 11].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2"/>))}</svg></button>
            {board.children.length ? <button className="board-expand" aria-label={`${board.name} 하위 게시판 ${collapsed.has(board.id) ? "펼치기" : "접기"}`} aria-expanded={!collapsed.has(board.id)} onClick={() => toggle(board.id)}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" style={{ transform: collapsed.has(board.id) ? "rotate(-90deg)" : undefined }}><path d="m5 7 5 5 5-5"/></svg></button> : <span className="board-leaf-mark" aria-hidden="true">·</span>}
            {edit?.id === board.id ? <form className="board-inline-name" onSubmit={event => { event.preventDefault(); confirmName(); }}><input ref={nameInput} aria-label="게시판 이름" maxLength={100} disabled={disabled} value={edit.value} onChange={event => setEdit(previous => previous ? { ...previous, value: event.target.value } : previous)} onKeyDown={event => { if (event.key === "Escape") { setEdit(null); setError(""); } }}/><button type="submit" disabled={disabled}>확인</button><button type="button" disabled={busy} onClick={() => { setEdit(null); setError(""); }}>취소</button></form> : <span className="board-name-button"><span>{board.name}</span>{board.children.length > 0 && <small>하위 {board.children.length}</small>}</span>}
            <div className="board-row-actions"><button disabled={disabled || Boolean(edit)} onClick={() => { setEdit({ id: board.id, value: board.name }); setPendingDelete(null); setError(""); }}>수정</button><button className="board-delete-action" disabled={disabled || Boolean(edit) || board.children.length > 0} title={board.children.length ? "하위 게시판을 먼저 이동하거나 삭제해 주세요." : undefined} onClick={() => { setPendingDelete(board.id); setError(""); }}>삭제</button></div>
          </div>
          {pendingDelete === board.id && <div className="board-delete-confirm" role="group" aria-label={`${board.name} 삭제 확인`}><p><strong>{board.name}</strong> 게시판을 삭제할까요? 연결된 글은 전체 게시글에 남습니다.</p><div><button disabled={disabled} onClick={confirmDelete}>삭제 확인</button><button disabled={busy} onClick={() => setPendingDelete(null)}>취소</button></div></div>}
        </li>)}</ul>}
        <p className="board-drag-help">게시판 위·아래에 놓으면 순서를 바꾸고, 가운데에 놓으면 하위로 넣어요. 키보드: Space → ↑↓ 선택 → → 하위 → Enter 적용, Esc 취소.</p>
        {error && !loading && !loadError && <p role="alert" className="board-form-error">{error}</p>}
        {message && <p role="status" className="board-form-message">{message}</p>}
        <div className="board-draft-actions" aria-label="게시판 변경 사항 저장">
          <span>{dirty ? "저장하지 않은 변경 사항이 있어요." : "모든 변경 사항이 저장되어 있어요."}</span>
          <div><button type="button" className="button board-cancel-button" disabled={!dirty || busy} onClick={cancelDraft}>{uncertain ? "초안 버리고 서버 확인" : "취소"}</button><button type="button" className="button board-save-button" disabled={!dirty || Boolean(edit) || disabled} onClick={() => void save()}>{busy ? "저장 중…" : "변경 사항 저장"}</button></div>
        </div>
      </section>
    </div>
  </section>;
}
