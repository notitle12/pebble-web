"use client";

import { Extension, Node as TiptapNode, generateHTML, generateJSON } from "@tiptap/core";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { buildOpenStreetMapEmbed, escapeRichText, isSafeOpenStreetMapEmbed, persistedRichHtml, richContentHtml, richEditorHtml, type RichBodyFormat } from "../rich-content";
import { InlineCode, InlineTableSpec, InlineArchitecture, TocNode, AutomaticToc, ControllableTable, HeadingParagraphReset, EditableToggle } from "./inline-block-extensions";
import { defaultInlineTableSpec, defaultInlineArchitectureSpec } from "./inline-block-views";
import { blocksToDocument, documentToBlocks, blocksSignature, textSizes, defaultTextSizes, textColors, highlightColors } from "../writer-document";
import type { EditorBlock } from "../post-editor-model";
import { PostBody } from "./post-body";
import styles from "./rich-body-editor.module.css";

type UploadResult = { src: string; previewUrl: string };
export type RichBodyEditorProps = {
  blocks: EditorBlock[];
  onChangeBlocks: (blocks: EditorBlock[]) => void;
  uploadImage?: (file: File) => Promise<UploadResult>;
  imagePreviews?: Record<string, string>;
  disabled?: boolean;
};

const symbols = ["©", "®", "™", "→", "←", "↔", "✓", "✕", "★", "•", "…", "—", "≠", "≤", "≥", "∞", "λ", "π", "Δ", "※"];
const iconPaths: Record<string, string[]> = {
  image: ["M4 4h16v16H4z", "m4 16 5-5 4 4 3-3 4 4", "M9 9h.01"], bold: ["M7 4h6a4 4 0 0 1 0 8H7z", "M7 12h7a4 4 0 0 1 0 8H7z"],
  italic: ["M14 4h6", "M4 20h6", "m15 4-6 16"], underline: ["M6 4v6a6 6 0 0 0 12 0V4", "M4 21h16"], strike: ["M4 12h16", "M7 6a5 5 0 0 1 9-2", "M17 18a5 5 0 0 1-9 2"],
  color: ["M12 3 5 13a7 7 0 0 0 14 0z"], highlight: ["M4 20h16", "m7 14 7-7 4 4-7 7H7z", "m13 8 2-2 4 4-2 2"],
  alignLeft: ["M4 6h16", "M4 10h10", "M4 14h16", "M4 18h10"], quote: ["M4 11h7v7H4z", "M13 11h7v7h-7z", "M6 11c0-3 1-5 4-6", "M15 11c0-3 1-5 4-6"],
  alignCenter: ["M4 6h16", "M7 10h10", "M4 14h16", "M7 18h10"], alignRight: ["M4 6h16", "M10 10h10", "M4 14h16", "M10 18h10"], alignJustify: ["M4 6h16", "M4 10h16", "M4 14h16", "M4 18h16"],
  ordered: ["M9 6h11", "M9 12h11", "M9 18h11", "M3 4h1v4", "M3 11c3-2 3 1 0 3h3", "M3 17h3l-2 2h2l-1 2H3"],
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
      types: ["heading", "paragraph"],
      attributes: {
        fontSize: { default: null, parseHTML: (element: HTMLElement) => element.style.fontSize || null, renderHTML: (attributes: Record<string, unknown>) => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {} },
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
  StarterKit.configure({ codeBlock: false, heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: {target:null} } }),
  RichImage.configure({ inline: false, allowBase64: false }),
  TableKit.configure({ table: false }),
  ControllableTable, HeadingParagraphReset, InlineCode, InlineTableSpec, InlineArchitecture, AutomaticToc,
  FontSize,
  FontFamily,
  Color,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  EditableToggle,
  TocNode,
  MapEmbed,
  HeadingIds,
];

const isSafeHref = (value: string) => /^(https?:|mailto:)/i.test(value.trim());

export function RichBodyEditor({ blocks, onChangeBlocks, uploadImage, imagePreviews = {}, disabled = false }: RichBodyEditorProps) {
  const first = blocks[0];
  const initialFormat: RichBodyFormat = blocks.length === 1 && first?.type === "MARKDOWN" ? "MARKDOWN" : "HTML";
  const content = blocks.length === 1 && ["TEXT", "HTML", "MARKDOWN"].includes(first?.type) ? first.content : "";
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
  const [palette, setPalette] = useState<"text" | "highlight" | null>(null);
  const [paletteLeft, setPaletteLeft] = useState(48);
  const [tablePicker, setTablePicker] = useState(false);
  const [tableSize, setTableSize] = useState({ rows: 3, cols: 3 });
  const root = useRef<HTMLElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const lastExternal = useRef(blocksSignature(blocks));
  const toDocument = (items: EditorBlock[]) => blocksToDocument(items, block => generateJSON(richEditorHtml(block.content, block.type as RichBodyFormat, imagePreviews).replace(/<(\/?)(h[456])\b/gi, "<$1h3"), extensionSet));
  const renderDocument = (doc: Parameters<typeof generateHTML>[0]) => persistedRichHtml(generateHTML(doc, extensionSet));
  const initialContent = useMemo(() => typeof window === "undefined" ? undefined : toDocument(blocks), []);
  const emitDocument = (current: NonNullable<ReturnType<typeof useEditor>>) => {
    const next = documentToBlocks(current.getJSON(), renderDocument, imagePreviews);
    lastEmitted.current = blocksSignature(next);
    onChangeBlocks(next);
  };

  const editor = useEditor({
    extensions: extensionSet,
    content: initialContent,
    immediatelyRender: false,
    editable: !disabled,
    editorProps:{attributes:{role:"textbox","aria-label":"본문","aria-multiline":"true"}},
    onUpdate: ({ editor: current }) => {
      setDraftContent(current.getHTML());
      setFormat("HTML");
      emitDocument(current);
    },
  });

  useEffect(() => { if (!editor) return; editor.setEditable(!disabled,false); }, [editor, disabled]);
  useEffect(() => {
    if (!insertMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setInsertMenuOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [insertMenuOpen]);
  const selection = useEditorState({ editor, selector: ({ editor: current }) => {
    if (!current) return null;
    const heading = current.isActive("heading");
    const kind: "p"|"1"|"2"|"3" = heading ? String(current.getAttributes("heading").level) as "1"|"2"|"3" : "p";
    return { align: current.getAttributes(heading ? "heading" : "paragraph").textAlign || "left", bullet: current.isActive("bulletList"), ordered: current.isActive("orderedList"), kind, size: current.getAttributes(heading ? "heading" : "paragraph").fontSize || current.getAttributes("textStyle").fontSize || defaultTextSizes[kind], font: current.getAttributes("textStyle").fontFamily || "", color: current.getAttributes("textStyle").color || "#202124", bold: current.isActive("bold"), italic: current.isActive("italic"), underline: current.isActive("underline"), strike: current.isActive("strike") };
  } });
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest("[data-writer-popup]")) return;
      setInsertMenuOpen(false); setPalette(null); setTablePicker(false); setForm(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setInsertMenuOpen(false); setPalette(null); setTablePicker(false); setForm(null); } };
    document.addEventListener("pointerdown", close, true); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close, true); document.removeEventListener("keydown", escape); };
  }, []);
  useEffect(() => {
    const signature = blocksSignature(blocks);
    if (signature === lastExternal.current) return;
    lastExternal.current = signature;
    if (signature === lastEmitted.current) { lastEmitted.current = null; return; }
    if (editor) {
      editor.commands.setContent(toDocument(blocks), { emitUpdate: false });
      setDraftContent(editor.getHTML());
      setFormat(blocks.length === 1 && blocks[0].type === "MARKDOWN" ? "MARKDOWN" : "HTML");
    }
  }, [blocks, editor, imagePreviews]);

  const publishSource = useCallback((value: string, nextFormat: "HTML" | "MARKDOWN") => {
    setDraftContent(value); setFormat(nextFormat);
    if (!editor) return;
    editor.commands.setContent(generateJSON(richEditorHtml(value, nextFormat, imagePreviews).replace(/<(\/?)(h[456])\b/gi, "<$1h3"), extensionSet), { emitUpdate: false });
    emitDocument(editor);
  }, [editor, imagePreviews, onChangeBlocks]);

  const applyMode = (next: "NORMAL" | "HTML" | "MARKDOWN") => {
    if (next === displayMode) return;
    if (next === "MARKDOWN") {
      const html = format === "TEXT" ? escapeRichText(draftContent) : displayMode === "HTML" ? draftContent : editor?.getHTML() ?? draftContent;
      publishSource(`<!-- Pebble HTML content -->\n${html}\n\n`, "MARKDOWN");
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
      const html = editor?.getHTML() ?? draftContent;
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
    let exists = false; editor.state.doc.descendants(node => { if (node.type.name === "tableOfContents") exists = true; });
    if (!exists) editor.chain().focus().insertContentAt(0, { type: "tableOfContents" }).run();
    setInsertMenuOpen(false);
  };
  const insertBlock = (type: "CODE" | "TABLE" | "ARCHITECTURE") => {
    if (!editor || disabled) return;
    const key = crypto.randomUUID();
    const node = type === "CODE" ? { type: "pebbleCode", attrs: { key, language: "TYPESCRIPT" } } : { type: type === "TABLE" ? "tableSpec" : "architectureSpec", attrs: { key, spec: type === "TABLE" ? defaultInlineTableSpec() : defaultInlineArchitectureSpec(), valid: true } };
    const selection = editor.state.selection.$from;
    const chain = editor.chain().focus();
    if (selection.depth > 1 || selection.parent.type.name === "pebbleCode") chain.insertContentAt(selection.after(1), [node, { type: "paragraph" }]).run();
    else chain.insertContent([node, { type: "paragraph" }]).run();
    setInsertMenuOpen(false);
  };
  const changeTextKind = (kind: "p" | "1" | "2" | "3") => {
    const chain = editor?.chain().focus().setMark("textStyle", { fontSize: null });
    if (kind === "p") chain?.setParagraph().updateAttributes("paragraph", { fontSize: defaultTextSizes.p }).run();
    else chain?.setHeading({ level: Number(kind) as 1|2|3 }).updateAttributes("heading", { fontSize: defaultTextSizes[kind] }).run();
  };
  const pickColor = (color: string) => { if (palette === "text") editor?.chain().focus().setColor(color).run(); else editor?.chain().focus().setHighlight({ color }).run(); setPalette(null); };
  const chooseTable = (rows: number, cols: number) => { run(() => editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()); setTablePicker(false); };

  const addToggle = (event: React.FormEvent) => {
    event.preventDefault();
    const summary = toggleSummary.trim() || "자세히 보기";
    if (!editor) return;
    const toggle = { type: "details", attrs: { summary, open: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "여기에 내용을 입력하세요." }] }] };
    const selection = editor.state.selection.$from;
    if (selection.parent.type.name === "pebbleCode") editor.chain().focus().insertContentAt(selection.after(), toggle).run();
    else editor.chain().focus().insertContent(toggle).run();
    setForm(null); setToggleSummary("자세히 보기");
  };

  const insertSpecial = (symbol: string) => editor?.chain().focus().insertContent(symbol).run();
  const contentForView = format === "TEXT" ? richContentHtml(draftContent, "TEXT") : draftContent;

  return <section ref={root} inert={disabled} className={styles.root} aria-label="본문 편집기">
    <dialog ref={formatDialog} className={styles.formatDialog} aria-labelledby={formatDialogId} onCancel={()=>setPendingMode(null)}>
      <h2 id={formatDialogId}>작성 형식을 변경할까요?</h2>
      <p>{pendingMode==="MARKDOWN"?"현재 서식은 마크다운 안에 HTML로 보존됩니다.":"지원하는 문단·표·이미지 형식으로 변환합니다. 지원하지 않는 HTML 구조나 위험한 요소는 제거될 수 있습니다."}</p>
      <footer><button type="button" onClick={()=>setPendingMode(null)}>취소</button><button type="button" onClick={()=>{if(pendingMode)applyMode(pendingMode);setPendingMode(null);}}>형식 변경</button></footer>
    </dialog>
    <div data-writer-popup className={styles.sticky} role="toolbar" aria-label="본문 서식 도구" aria-disabled={disabled}>
      <div className={styles.toolrow}>
        {displayMode === "NORMAL" && <>
          <ToolButton icon="image" label="이미지 삽입" disabled={disabled || !uploadImage} onClick={() => openForm("image")}/>
          <span className={styles.textControls}>
            <select aria-label="제목 수준" className={styles.select} value={selection?.kind ?? "p"} disabled={disabled} onChange={event => changeTextKind(event.target.value as "p"|"1"|"2"|"3")}><option value="p">본문</option>{[1,2,3].map(level => <option key={level} value={level}>제목 {level}</option>)}</select>
            <select aria-label="글자 크기" className={styles.select} value={selection?.size ?? "16px"} disabled={disabled} onChange={event => run(() => editor?.chain().focus().updateAttributes(selection?.kind === "p" ? "paragraph" : "heading", { fontSize: event.target.value }).setMark("textStyle", { fontSize: null }).run())}>{(textSizes[selection?.kind ?? "p"]).map(size => <option key={size}>{size}</option>)}{selection?.size && !textSizes[selection.kind].includes(selection.size) && <option value={selection.size}>{selection.size}</option>}</select>
          </span>
          <select aria-label="글꼴" className={styles.select} value={selection?.font ?? ""} disabled={disabled} onChange={event => run(() => event.target.value ? editor?.chain().focus().setFontFamily(event.target.value).run() : editor?.chain().focus().unsetFontFamily().run())}><option value="">기본서체</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option><option value="monospace">고정폭</option><option value="sans-serif">산세리프</option></select>
          <ToolButton icon="bold" label="굵게" disabled={disabled} pressed={selection?.bold} onClick={() => run(() => editor?.chain().focus().toggleBold().run())}/>
          <ToolButton icon="italic" label="기울임" disabled={disabled} pressed={selection?.italic} onClick={() => run(() => editor?.chain().focus().toggleItalic().run())}/>
          <ToolButton icon="underline" label="밑줄" disabled={disabled} pressed={selection?.underline} onClick={() => run(() => editor?.chain().focus().toggleUnderline().run())}/>
          <ToolButton icon="strike" label="취소선" disabled={disabled} pressed={selection?.strike} onClick={() => run(() => editor?.chain().focus().toggleStrike().run())}/>
          <button type="button" className={styles.colorTool} aria-label="글자색" aria-expanded={palette === "text"} aria-haspopup="dialog" disabled={disabled} onClick={event => { setPaletteLeft(Math.min(event.currentTarget.getBoundingClientRect().left, window.innerWidth - 230)); setPalette(palette === "text" ? null : "text"); setTablePicker(false); setInsertMenuOpen(false); }}>A</button>
          <button type="button" className={styles.colorTool} aria-label="글씨 배경색" aria-expanded={palette === "highlight"} aria-haspopup="dialog" disabled={disabled} onClick={event => { setPaletteLeft(Math.min(event.currentTarget.getBoundingClientRect().left, window.innerWidth - 230)); setPalette(palette === "highlight" ? null : "highlight"); setTablePicker(false); setInsertMenuOpen(false); }}>▰</button>
          <ToolButton icon={{left:"alignLeft",center:"alignCenter",right:"alignRight",justify:"alignJustify"}[selection?.align as "left"|"center"|"right"|"justify"] ?? "alignLeft"} label={`문단 정렬: ${{left:"왼쪽",center:"가운데",right:"오른쪽",justify:"양쪽"}[selection?.align as "left"|"center"|"right"|"justify"] ?? "왼쪽"} (클릭해서 변경)`} disabled={disabled} onClick={() => run(() => { const choices = ["left","center","right","justify"]; editor?.chain().focus().setTextAlign(choices[(choices.indexOf(selection?.align ?? "left") + 1) % choices.length]).run(); })}/>
          <ToolButton icon="quote" label="인용" disabled={disabled} onClick={() => run(() => editor?.chain().focus().toggleBlockquote().run())}/>
          <span onMouseEnter={() => { setTablePicker(true); setPalette(null); setInsertMenuOpen(false); }}><ToolButton icon="table" label="표 삽입" disabled={disabled} onClick={() => { setTablePicker(true); setPalette(null); setInsertMenuOpen(false); }}/></span>
          <ToolButton icon="link" label="링크 삽입" disabled={disabled} onClick={() => openForm("link")}/>
          <ToolButton icon="list" label="글머리 목록" pressed={selection?.bullet} disabled={disabled} onClick={() => run(() => editor?.chain().focus().toggleBulletList().run())}/>
          <ToolButton icon="ordered" label="번호 목록" pressed={selection?.ordered} disabled={disabled} onClick={() => run(() => editor?.chain().focus().toggleOrderedList().run())}/>
          <ToolButton icon="rule" label="구분선 삽입" disabled={disabled} onClick={() => run(() => editor?.chain().focus().setHorizontalRule().run())}/>
          <div className={styles.insertWrap}>
            <button className={`${styles.toolButton} ${styles.insertButton}`} type="button" aria-label="추가 삽입 도구" aria-haspopup="menu" aria-expanded={insertMenuOpen} disabled={disabled} onClick={() => { setInsertMenuOpen(open => !open); setPalette(null); setTablePicker(false); setForm(null); }}><Icon name="plus"/><Icon name="dots"/><span>삽입</span></button>
          </div>
        </>}
        <select aria-label="본문 형식" className={`${styles.select} ${styles.modeSelect}`} value={displayMode} disabled={disabled} onChange={event => changeMode(event.target.value as "NORMAL" | "HTML" | "MARKDOWN")}><option value="NORMAL">일반</option><option value="HTML">HTML</option><option value="MARKDOWN">마크다운</option></select>
      </div>
    </div>
    {insertMenuOpen && <div data-writer-popup className={styles.insertMenu} role="menu" aria-label="추가 삽입 도구">
      <button type="button" role="menuitem" onClick={() => insertAction(insertToc)}>목차</button>
      <button type="button" role="menuitem" onClick={() => openForm("map")}>지도</button>
      <button type="button" role="menuitem" onClick={() => openForm("html")}>HTML</button>
      <button type="button" role="menuitem" onClick={() => insertAction(() => insertBlock("CODE"))}>코드</button>
      <button type="button" role="menuitem" onClick={() => insertAction(() => insertBlock("ARCHITECTURE"))}>아키텍처</button>
      <button type="button" role="menuitem" onClick={() => insertAction(() => insertBlock("TABLE"))}>테이블 명세</button>
      <button type="button" role="menuitem" onClick={() => openForm("toggle")}>접기/펼치기</button>
      <label className={styles.symbolMenu}>특수문자<select aria-label="특수문자" defaultValue="" onChange={event => { if (event.target.value) { insertSpecial(event.target.value); setInsertMenuOpen(false); } event.target.value = ""; }}><option value="">선택</option>{symbols.map(symbol => <option key={symbol}>{symbol}</option>)}</select></label>
      <ToolButton icon="undo" label="되돌리기" role="menuitem" disabled={disabled || !editor?.can().undo()} onClick={() => insertAction(() => run(() => editor?.chain().focus().undo().run()))}/>
      <ToolButton icon="redo" label="다시 실행" role="menuitem" disabled={disabled || !editor?.can().redo()} onClick={() => insertAction(() => run(() => editor?.chain().focus().redo().run()))}/>
    </div>}

    {palette && <div data-writer-popup className={styles.palette} style={{ left: Math.max(12, paletteLeft) }} role="dialog" aria-label={palette === "text" ? "글자색 선택" : "글씨 배경색 선택"}><strong>{palette === "text" ? "글자색" : "글씨 배경색"}</strong><div>{(palette === "text" ? textColors : highlightColors).map(color => <button key={color} type="button" title={color} aria-label={`${color} 색상`} style={{ backgroundColor: color }} onClick={() => pickColor(color)}/>)}</div><button type="button" onClick={() => { if (palette === "text") editor?.chain().focus().unsetColor().run(); else editor?.chain().focus().unsetHighlight().run(); setPalette(null); }}>기본색으로 초기화</button></div>}
    {tablePicker && <div data-writer-popup className={styles.tablePicker} role="dialog" aria-label="표 크기 선택"><strong>{tableSize.rows}행 × {tableSize.cols}열</strong><div role="grid" aria-label="표 행·열 선택">{Array.from({ length: 8 }, (_, row) => Array.from({ length: 10 }, (_, col) => <button type="button" key={`${row}-${col}`} role="gridcell" data-table-cell={`${row + 1}-${col + 1}`} tabIndex={tableSize.rows === row + 1 && tableSize.cols === col + 1 ? 0 : -1} aria-label={`${row + 1}행 ${col + 1}열 표`} aria-selected={row < tableSize.rows && col < tableSize.cols} onMouseEnter={() => setTableSize({ rows: row + 1, cols: col + 1 })} onClick={() => chooseTable(row + 1, col + 1)} onKeyDown={event => { const direction = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key]; if (!direction) return; event.preventDefault(); const rows = Math.max(1, Math.min(8, row + 1 + direction[0])), cols = Math.max(1, Math.min(10, col + 1 + direction[1])); setTableSize({ rows, cols }); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-table-cell="${rows}-${cols}"]`)?.focus()); }}/>))}</div></div>}
    {displayMode === "NORMAL" ? <div className={styles.editor}><EditorContent editor={editor}/></div>
      : displayMode === "HTML" ? <div className={styles.sourceGrid}><label>HTML 원문<textarea aria-label="HTML 원문" value={contentForView} disabled={disabled} onChange={event => publishSource(event.target.value, "HTML")}/></label><section aria-label="안전한 HTML 미리보기"><h3>미리보기</h3><div className={styles.preview}><PostBody blocks={blocks.filter(block => block.valid !== false)}/></div></section></div>
      : <div className={styles.sourceGrid}><label>마크다운 원문<small className={styles.markdownHelp}>제목은 ### 뒤에 공백을 넣어 작성하세요. Enter는 줄바꿈, 빈 줄은 문단 나눔입니다.</small><textarea aria-label="마크다운 원문" value={contentForView} disabled={disabled} onChange={event => publishSource(event.target.value, "MARKDOWN")}/></label><section aria-label="마크다운 미리보기"><h3>미리보기</h3><div className={styles.preview}><PostBody blocks={blocks.filter(block => block.valid !== false)}/></div></section></div>}

    {form && <form data-writer-popup className={styles.form} onSubmit={form === "link" ? insertLink : form === "map" ? insertMap : form === "toggle" ? addToggle : insertHtmlBlock}>
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
