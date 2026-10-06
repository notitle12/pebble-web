"use client";

import { Extension, Node as TiptapNode } from "@tiptap/core";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { buildOpenStreetMapEmbed, buildTableOfContents, escapeRichText, isSafeOpenStreetMapEmbed, persistedRichHtml, richContentHtml, richEditorHtml, type RichBodyFormat } from "../rich-content";
import styles from "./rich-body-editor.module.css";

type UploadResult = { src: string; previewUrl: string };
export type RichBodyEditorProps = {
  content: string;
  format: RichBodyFormat;
  onChange: (content: string, format: "HTML" | "MARKDOWN") => void;
  onArchitecture: () => void;
  onCode: () => void;
  onTableSpec: () => void;
  uploadImage?: (file: File) => Promise<UploadResult>;
  imagePreviews?: Record<string, string>;
  disabled?: boolean;
};

const fontSizes = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];
const symbols = ["©", "®", "™", "→", "←", "↔", "✓", "✕", "★", "•", "…", "—", "≠", "≤", "≥", "∞", "λ", "π", "Δ", "※"];
const iconPaths: Record<string, string[]> = {
  image: ["M4 4h16v16H4z", "m4 16 5-5 4 4 3-3 4 4", "M9 9h.01"], bold: ["M7 4h6a4 4 0 0 1 0 8H7z", "M7 12h7a4 4 0 0 1 0 8H7z"],
  italic: ["M14 4h6", "M4 20h6", "m15 4-6 16"], underline: ["M6 4v6a6 6 0 0 0 12 0V4", "M4 21h16"], strike: ["M4 12h16", "M7 6a5 5 0 0 1 9-2", "M17 18a5 5 0 0 1-9 2"],
  color: ["M12 3 5 13a7 7 0 0 0 14 0z"], highlight: ["M4 20h16", "m7 14 7-7 4 4-7 7H7z", "m13 8 2-2 4 4-2 2"],
  align: ["M4 6h16", "M4 10h10", "M4 14h16", "M4 18h10"], quote: ["M4 11h7v7H4z", "M13 11h7v7h-7z", "M6 11c0-3 1-5 4-6", "M15 11c0-3 1-5 4-6"],
  table: ["M4 5h16v14H4z", "M4 10h16", "M10 5v14", "M15 5v14"], link: ["M10 13a5 5 0 0 0 7 .5l2-2a5 5 0 0 0-7-7l-1 1", "M14 11a5 5 0 0 0-7-.5l-2 2a5 5 0 0 0 7 7l1-1"],
  list: ["M9 6h11", "M9 12h11", "M9 18h11", "M4 6h.01", "M4 12h.01", "M4 18h.01"], rule: ["M4 12h16"],
  undo: ["M9 14 4 9l5-5", "M4 9h10a6 6 0 0 1 0 12h-2"], redo: ["m15 14 5-5-5-5", "M20 9H10a6 6 0 0 0 0 12h2"], dots: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  plus: ["M12 5v14", "M5 12h14"],
};

function Icon({ name }: { name: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">{(iconPaths[name] ?? []).map((d, index) => <path key={index} d={d}/>)}</g></svg>;
}

function ToolButton({ icon, label, onClick, disabled, pressed, role }: { icon: string; label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; role?: "menuitem" }) {
  return <button className={styles.toolButton} type="button" role={role} title={label} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}><Icon name={icon}/></button>;
}

const DetailsNode = TiptapNode.create({
  name: "details",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { summary: { default: "자세히 보기", parseHTML: (element: HTMLElement) => element.querySelector("summary")?.textContent || "자세히 보기" } };
  },
  parseHTML() { return [{ tag: "details", contentElement: (element: HTMLElement) => element.querySelector("[data-details-content]") || element }]; },
  renderHTML({ node, HTMLAttributes }) { return ["details", HTMLAttributes, ["summary", {}, node.attrs.summary], ["div", { "data-details-content": "" }, 0]]; },
});

const TocNode = TiptapNode.create({
  name: "tableOfContents", group: "block", content: "block+", defining: true,
  parseHTML() { return [{ tag: 'nav.post-toc' }]; },
  renderHTML() { return ["nav", { class: "post-toc", "aria-label": "목차" }, 0]; },
});

const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
        renderHTML: (attributes: Record<string, unknown>) => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
      },
    };
  },
});

const RichImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => isSafeHref(element.getAttribute("src") || "") ? element.getAttribute("src") : null,
      },
      mediaSrc: {
        default: null,
        parseHTML: (element: HTMLElement) => isSafeHref(element.getAttribute("data-media-src") || "") ? element.getAttribute("data-media-src") : null,
        renderHTML: (attributes: Record<string, unknown>) => attributes.mediaSrc ? { "data-media-src": attributes.mediaSrc } : {},
      },
    };
  },
});

const HeadingIds = Extension.create({
  name: "pebbleHeadingIds",
  addGlobalAttributes() {
    return [{
      types: ["heading"],
      attributes: {
        id: {
          default: null,
          parseHTML: (element: HTMLElement) => element.id || null,
          renderHTML: (attributes: Record<string, unknown>) => attributes.id ? { id: attributes.id } : {},
        },
      },
    }];
  },
});

const MapEmbed = TiptapNode.create({
  name: "openStreetMapEmbed",
  group: "block",
  atom: true,
  addAttributes() {
    return { src: { default: null, parseHTML: (element: HTMLElement) => isSafeOpenStreetMapEmbed(element.getAttribute("src") || "") ? element.getAttribute("src") : null } };
  },
  parseHTML() { return [{ tag: "iframe[src]", getAttrs: element => isSafeOpenStreetMapEmbed((element as HTMLElement).getAttribute("src") || "") ? {} : false }]; },
  renderHTML({ node }) {
    const src = typeof node.attrs.src === "string" && isSafeOpenStreetMapEmbed(node.attrs.src) ? node.attrs.src : "";
    return ["iframe", { src, title: "지도: OpenStreetMap", width: "600", height: "450", loading: "lazy", sandbox: "allow-scripts allow-same-origin", referrerpolicy: "no-referrer" }];
  },
});

const extensionSet = [
  StarterKit.configure({ link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: {target:null} } }),
  RichImage.configure({ inline: false, allowBase64: false }),
  TableKit.configure({ table: { resizable: true } }),
  FontSize,
  FontFamily,
  Color,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  DetailsNode,
  TocNode,
  MapEmbed,
  HeadingIds,
];

const isSafeHref = (value: string) => /^(https?:|mailto:)/i.test(value.trim());
const slug = (value: string) => value.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 48) || "section";

export function RichBodyEditor({ content, format: initialFormat, onChange, onArchitecture, onCode, onTableSpec, uploadImage, imagePreviews = {}, disabled = false }: RichBodyEditorProps) {
  const [format, setFormat] = useState<RichBodyFormat>(initialFormat);
  const [displayMode, setDisplayMode] = useState<"NORMAL" | "HTML" | "MARKDOWN">(initialFormat === "MARKDOWN" ? "MARKDOWN" : "NORMAL");
  const [pendingMode,setPendingMode]=useState<"NORMAL"|"HTML"|"MARKDOWN"|null>(null);
  const formatDialogId=useId();
  const formatDialog=useRef<HTMLDialogElement>(null);
  const [draftContent, setDraftContent] = useState(content);
  const [form, setForm] = useState<"link" | "image" | "map" | "toggle" | "html" | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [mapLat, setMapLat] = useState("");
  const [mapLon, setMapLon] = useState("");
  const [toggleSummary, setToggleSummary] = useState("자세히 보기");
  const [htmlDraft, setHtmlDraft] = useState("<p>HTML 내용을 입력하세요.</p>");
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const lastExternal = useRef({ content, format: initialFormat });
  const initialContent = useMemo(() => richEditorHtml(content, initialFormat, imagePreviews), []);

  const editor = useEditor({
    extensions: extensionSet,
    content: initialContent,
    immediatelyRender: false,
    editable: !disabled,
    editorProps:{attributes:{role:"textbox","aria-label":"본문","aria-multiline":"true"}},
    onUpdate: ({ editor: current }) => {
      const html = persistedRichHtml(current.getHTML());
      lastEmitted.current = html;
      setDraftContent(html);
      setFormat("HTML");
      onChange(html, "HTML");
    },
  });

  useEffect(() => { if (!editor) return; editor.setEditable(!disabled,false); }, [editor, disabled]);
  useEffect(() => {
    if (!insertMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setInsertMenuOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [insertMenuOpen]);
  useEffect(() => {
    if (lastExternal.current.content === content && lastExternal.current.format === initialFormat) return;
    lastExternal.current = { content, format: initialFormat };
    if (content === lastEmitted.current) { lastEmitted.current = null; return; }
    setDraftContent(content);
    setFormat(initialFormat);
    setDisplayMode(initialFormat === "MARKDOWN" ? "MARKDOWN" : "NORMAL");
    if (editor) editor.commands.setContent(richEditorHtml(content, initialFormat, imagePreviews), { emitUpdate: false });
  }, [content, initialFormat, editor, imagePreviews]);

  const publishSource = useCallback((value: string, nextFormat: "HTML" | "MARKDOWN") => {
    const outgoing = nextFormat === "HTML" ? persistedRichHtml(value) : value;
    lastEmitted.current = outgoing;
    setDraftContent(value); setFormat(nextFormat); onChange(outgoing, nextFormat);
    if (nextFormat === "HTML" && displayMode === "HTML") editor?.commands.setContent(richEditorHtml(value, "HTML", imagePreviews), { emitUpdate: false });
  }, [onChange, editor, displayMode, imagePreviews]);

  const applyMode = (next: "NORMAL" | "HTML" | "MARKDOWN") => {
    if (next === displayMode) return;
    if (next === "MARKDOWN") {
      const html = format === "TEXT" ? escapeRichText(draftContent) : displayMode === "HTML" ? draftContent : editor?.getHTML() ?? draftContent;
      publishSource(`<!-- Pebble HTML content -->\n${persistedRichHtml(html)}`, "MARKDOWN");
      setDisplayMode("MARKDOWN");
      return;
    }
    if (format === "MARKDOWN") {
      const converted = richContentHtml(draftContent, "MARKDOWN");
      publishSource(converted, "HTML");
      editor?.commands.setContent(richEditorHtml(converted, "HTML", imagePreviews), { emitUpdate: false });
      setDisplayMode(next);
      return;
    }
    if (next === "NORMAL" && displayMode === "HTML") {
      editor?.commands.setContent(richEditorHtml(draftContent, "HTML", imagePreviews), { emitUpdate: false });
    } else if (next === "HTML" && displayMode === "NORMAL") {
      const html = format === "TEXT" ? richContentHtml(draftContent, "TEXT") : persistedRichHtml(editor?.getHTML() ?? draftContent);
      setDraftContent(html);
      if (format === "TEXT") publishSource(html, "HTML");
    }
    setDisplayMode(next);
  };

  useEffect(()=>{const dialog=formatDialog.current;if(!dialog)return;if(pendingMode&&!dialog.open)dialog.showModal();else if(!pendingMode&&dialog.open)dialog.close();},[pendingMode]);
  const changeMode=(next:"NORMAL"|"HTML"|"MARKDOWN")=>{
    if(next===displayMode)return;
    if(next==="MARKDOWN"||format==="MARKDOWN"||(next==="NORMAL"&&displayMode==="HTML")){setPendingMode(next);return;}
    applyMode(next);
  };

  const run = (operation: () => unknown) => { if (disabled || !editor) return; operation(); };
  const openForm = (kind: typeof form) => { setFormError(""); setForm(kind); setInsertMenuOpen(false); };
  const insertAction = (action: () => void) => { action(); setInsertMenuOpen(false); };
  const insertLink = (event: React.FormEvent) => {
    event.preventDefault();
    const href = linkHref.trim();
    if (!isSafeHref(href)) { setFormError("https://, http:// 또는 mailto: 주소를 입력해 주세요."); return; }
    if (!editor) return;
    if (linkLabel.trim()) editor.chain().focus().insertContent(`<a href="${href.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">${escapeRichText(linkLabel).replace(/<p>|<\/p>/g, "")}</a>`).run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setForm(null); setLinkHref(""); setLinkLabel("");
  };

  const chooseImage = async (file?: File) => {
    if (!file || !uploadImage || !editor) return;
    setBusy(true); setFormError("");
    try {
      const uploaded = await uploadImage(file);
      if (!isSafeHref(uploaded.src) || !isSafeHref(uploaded.previewUrl)) throw new Error("이미지 응답 주소가 올바르지 않습니다.");
      editor.chain().focus().setImage({ src: uploaded.previewUrl, alt: file.name }).updateAttributes("image", { mediaSrc: uploaded.src }).run();
      setForm(null);
    } catch (error) { setFormError(error instanceof Error ? error.message : "이미지를 업로드하지 못했습니다."); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const insertMap = (event: React.FormEvent) => {
    event.preventDefault();
    const lat = Number(mapLat), lon = Number(mapLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) { setFormError("위도는 -90~90, 경도는 -180~180 범위의 숫자여야 합니다."); return; }
    const src = buildOpenStreetMapEmbed(lat, lon);
    if (!src || !isSafeOpenStreetMapEmbed(src)) { setFormError("지도 좌표를 확인해 주세요."); return; }
    editor?.chain().focus().insertContent(`<iframe src="${src}" title="지도: OpenStreetMap" width="600" height="450" loading="lazy" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer"></iframe>`).run();
    setForm(null); setMapLat(""); setMapLon("");
  };

  const insertHtmlBlock = (event: React.FormEvent) => {
    event.preventDefault();
    const safeHtml = richContentHtml(htmlDraft, "HTML");
    if (!safeHtml.trim()) { setFormError("안전하게 표시할 수 있는 HTML을 입력해 주세요."); return; }
    editor?.chain().focus().insertContent(safeHtml).run();
    setForm(null);
  };

  const insertToc = () => {
    if (!editor) return;
    const headings: Array<{ id: string; text: string; level: number }> = [];
    const tr = editor.state.tr;
    let existingToc:{from:number;to:number}|undefined;
    editor.state.doc.descendants((node, pos) => {
      if(node.type.name==="tableOfContents"){existingToc??={from:pos,to:pos+node.nodeSize};return false;}
      if (node.type.name !== "heading") return;
      const text = node.textContent.trim();
      const id = `pebble-section-${slug(text)}-${headings.length + 1}`;
      headings.push({ id, text, level: Number(node.attrs.level) || 2 });
      if (node.attrs.id !== id) tr.setNodeMarkup(pos, undefined, { ...node.attrs, id });
    });
    if (tr.docChanged) editor.view.dispatch(tr);
    const toc = buildTableOfContents(headings);
    if (toc) editor.chain().focus().insertContentAt(existingToc??0,toc).run();
    else setFormError("목차를 만들려면 먼저 제목 1~6을 추가해 주세요.");
  };

  const addToggle = (event: React.FormEvent) => {
    event.preventDefault();
    const summary = toggleSummary.trim() || "자세히 보기";
    editor?.chain().focus().insertContent(`<details><summary>${summary.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</summary><div data-details-content><p>여기에 내용을 입력하세요.</p></div></details>`).run();
    setForm(null); setToggleSummary("자세히 보기");
  };

  const insertSpecial = (symbol: string) => editor?.chain().focus().insertContent(symbol).run();
  const contentForView = format === "TEXT" ? richContentHtml(draftContent, "TEXT") : draftContent;

  return <section className={styles.root} aria-label="본문 편집기">
    <dialog ref={formatDialog} className={styles.formatDialog} aria-labelledby={formatDialogId} onCancel={()=>setPendingMode(null)}>
      <h2 id={formatDialogId}>작성 형식을 변경할까요?</h2>
      <p>{pendingMode==="MARKDOWN"?"현재 서식은 마크다운 안에 HTML로 보존됩니다.":"지원하는 문단·표·이미지 형식으로 변환합니다. 지원하지 않는 HTML 구조나 위험한 요소는 제거될 수 있습니다."}</p>
      <footer><button type="button" onClick={()=>setPendingMode(null)}>취소</button><button type="button" onClick={()=>{if(pendingMode)applyMode(pendingMode);setPendingMode(null);}}>형식 변경</button></footer>
    </dialog>
    <div className={styles.sticky} role="toolbar" aria-label="본문 서식 도구" aria-disabled={disabled}>
      <div className={styles.toolrow}>
        {displayMode === "NORMAL" && <>
          <ToolButton icon="image" label="이미지 삽입" disabled={disabled || !uploadImage} onClick={() => openForm("image")}/>
          <select aria-label="글꼴" className={styles.select} defaultValue="" disabled={disabled} onChange={event => { if (event.target.value) run(() => editor?.chain().focus().setFontFamily(event.target.value).run()); event.target.value = ""; }}><option value="">글꼴</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option><option value="monospace">고정폭</option><option value="sans-serif">산세리프</option></select>
          <select aria-label="글자 크기" className={styles.select} defaultValue="" disabled={disabled} onChange={event => { if (event.target.value) run(() => editor?.chain().focus().setMark("textStyle", { fontSize: event.target.value }).run()); event.target.value = ""; }}><option value="">크기</option>{fontSizes.map(size => <option key={size}>{size}</option>)}</select>
          <ToolButton icon="bold" label="굵게" disabled={disabled} pressed={editor?.isActive("bold")} onClick={() => run(() => editor?.chain().focus().toggleBold().run())}/>
          <ToolButton icon="italic" label="기울임" disabled={disabled} pressed={editor?.isActive("italic")} onClick={() => run(() => editor?.chain().focus().toggleItalic().run())}/>
          <ToolButton icon="underline" label="밑줄" disabled={disabled} pressed={editor?.isActive("underline")} onClick={() => run(() => editor?.chain().focus().toggleUnderline().run())}/>
          <ToolButton icon="strike" label="취소선" disabled={disabled} pressed={editor?.isActive("strike")} onClick={() => run(() => editor?.chain().focus().toggleStrike().run())}/>
          <label className={styles.colorTool} title="글자색"><span aria-hidden="true">A</span><input aria-label="글자색" type="color" defaultValue="#202124" disabled={disabled} onChange={event => run(() => editor?.chain().focus().setColor(event.target.value).run())}/></label>
          <label className={styles.colorTool} title="강조색"><span aria-hidden="true">▰</span><input aria-label="강조색" type="color" defaultValue="#fff29a" disabled={disabled} onChange={event => run(() => editor?.chain().focus().toggleHighlight({ color: event.target.value }).run())}/></label>
          <select aria-label="정렬" className={styles.select} defaultValue="left" disabled={disabled} onChange={event => run(() => editor?.chain().focus().setTextAlign(event.target.value).run())}><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option><option value="justify">양쪽</option></select>
          <select aria-label="제목 수준" className={styles.select} defaultValue="p" disabled={disabled} onChange={event => event.target.value === "p" ? run(() => editor?.chain().focus().setParagraph().run()) : run(() => editor?.chain().focus().toggleHeading({ level: Number(event.target.value) as 1|2|3|4|5|6 }).run())}><option value="p">본문</option>{[1,2,3,4,5,6].map(level => <option key={level} value={level}>제목 {level}</option>)}</select>
          <ToolButton icon="quote" label="인용" disabled={disabled} onClick={() => run(() => editor?.chain().focus().toggleBlockquote().run())}/>
          <ToolButton icon="table" label="표 삽입" disabled={disabled} onClick={() => run(() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}/>
          <ToolButton icon="link" label="링크 삽입" disabled={disabled} onClick={() => openForm("link")}/>
          <ToolButton icon="list" label="목록 삽입" disabled={disabled} onClick={() => run(() => editor?.chain().focus().toggleBulletList().run())}/>
          <ToolButton icon="rule" label="구분선 삽입" disabled={disabled} onClick={() => run(() => editor?.chain().focus().setHorizontalRule().run())}/>
          <div className={styles.insertWrap}>
            <button className={`${styles.toolButton} ${styles.insertButton}`} type="button" aria-label="추가 삽입 도구" aria-haspopup="menu" aria-expanded={insertMenuOpen} disabled={disabled} onClick={() => setInsertMenuOpen(open => !open)}><Icon name="plus"/><Icon name="dots"/><span>삽입</span></button>
          </div>
        </>}
        <select aria-label="본문 형식" className={`${styles.select} ${styles.modeSelect}`} value={displayMode} disabled={disabled} onChange={event => changeMode(event.target.value as "NORMAL" | "HTML" | "MARKDOWN")}><option value="NORMAL">일반</option><option value="HTML">HTML</option><option value="MARKDOWN">마크다운</option></select>
      </div>
    </div>
    {insertMenuOpen && <div className={styles.insertMenu} role="menu" aria-label="추가 삽입 도구">
      <button type="button" role="menuitem" onClick={() => insertAction(insertToc)}>목차</button>
      <button type="button" role="menuitem" onClick={() => openForm("map")}>지도</button>
      <button type="button" role="menuitem" onClick={() => openForm("html")}>HTML</button>
      <button type="button" role="menuitem" onClick={() => insertAction(onCode)}>코드</button>
      <button type="button" role="menuitem" onClick={() => insertAction(onArchitecture)}>아키텍처</button>
      <button type="button" role="menuitem" onClick={() => insertAction(onTableSpec)}>테이블 명세</button>
      <button type="button" role="menuitem" onClick={() => openForm("toggle")}>접기/펼치기</button>
      <label className={styles.symbolMenu}>특수문자<select aria-label="특수문자" defaultValue="" onChange={event => { if (event.target.value) { insertSpecial(event.target.value); setInsertMenuOpen(false); } event.target.value = ""; }}><option value="">선택</option>{symbols.map(symbol => <option key={symbol}>{symbol}</option>)}</select></label>
      <ToolButton icon="undo" label="되돌리기" role="menuitem" disabled={disabled || !editor?.can().undo()} onClick={() => insertAction(() => run(() => editor?.chain().focus().undo().run()))}/>
      <ToolButton icon="redo" label="다시 실행" role="menuitem" disabled={disabled || !editor?.can().redo()} onClick={() => insertAction(() => run(() => editor?.chain().focus().redo().run()))}/>
    </div>}

    {displayMode === "NORMAL" ? <div className={styles.editor}><EditorContent editor={editor}/></div>
      : displayMode === "HTML" ? <div className={styles.sourceGrid}><label>HTML 원문<textarea aria-label="HTML 원문" value={contentForView} disabled={disabled} onChange={event => publishSource(event.target.value, "HTML")}/></label><section aria-label="안전한 HTML 미리보기"><h3>미리보기</h3><div className={styles.preview} dangerouslySetInnerHTML={{ __html: richEditorHtml(contentForView, "HTML", imagePreviews) }}/></section></div>
      : <div className={styles.sourceGrid}><label>마크다운 원문<textarea aria-label="마크다운 원문" value={contentForView} disabled={disabled} onChange={event => publishSource(event.target.value, "MARKDOWN")}/></label><section aria-label="마크다운 미리보기"><h3>미리보기</h3><div className={styles.preview} dangerouslySetInnerHTML={{ __html: richEditorHtml(contentForView, "MARKDOWN", imagePreviews) }}/></section></div>}

    {form && <form className={styles.form} onSubmit={form === "link" ? insertLink : form === "map" ? insertMap : form === "toggle" ? addToggle : insertHtmlBlock}>
      <h3>{form === "link" ? "링크 추가" : form === "map" ? "OpenStreetMap 위치" : form === "image" ? "이미지 추가" : form === "html" ? "안전한 HTML 블록 추가" : "접기/펼치기 추가"}</h3>
      {form === "link" && <><label>주소<input type="url" value={linkHref} onChange={event => setLinkHref(event.target.value)} placeholder="https://example.com" required/></label><label>표시 문구 (선택)<input value={linkLabel} onChange={event => setLinkLabel(event.target.value)} /></label><button type="submit">링크 적용</button></>}
      {form === "map" && <><label>위도<input type="number" min="-90" max="90" step="any" value={mapLat} onChange={event => setMapLat(event.target.value)} required/></label><label>경도<input type="number" min="-180" max="180" step="any" value={mapLon} onChange={event => setMapLon(event.target.value)} required/></label><button type="submit">지도 삽입</button></>}
      {form === "image" && <><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => void chooseImage(event.target.files?.[0])}/>{busy && <span role="status">업로드 중…</span>}</>}
      {form === "html" && <><label>HTML 원문<textarea aria-label="HTML 블록 원문" value={htmlDraft} onChange={event => setHtmlDraft(event.target.value)} rows={8}/></label><div className={styles.preview} aria-label="HTML 미리보기" dangerouslySetInnerHTML={{ __html: richContentHtml(htmlDraft, "HTML") }}/><button type="submit">삽입</button></>}
      {form === "toggle" && <><label>접기 제목<input value={toggleSummary} onChange={event => setToggleSummary(event.target.value)} required/></label><button type="submit">추가</button></>}
      {formError && <p role="alert">{formError}</p>}<button type="button" onClick={() => setForm(null)}>닫기</button>
    </form>}
  </section>;
}
