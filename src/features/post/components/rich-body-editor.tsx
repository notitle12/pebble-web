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
import { EditorContent, ReactNodeViewRenderer, useEditor, useEditorState } from "@tiptap/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { escapeRichText, isSafeOpenStreetMapEmbed, persistedRichHtml, richContentHtml, richEditorHtml, type RichBodyFormat } from "../rich-content";
import { InlineCode, InlineTableSpec, InlineArchitecture, TocNode, AutomaticToc, ControllableTable, HeadingParagraphReset, EditableToggle } from "./inline-block-extensions";
import { defaultInlineTableSpec, defaultInlineArchitectureSpec } from "./inline-block-views";
import { blocksToDocument, documentToBlocks, blocksSignature, textSizes, defaultTextSizes, textColors, highlightColors } from "../writer-document";
import type { EditorBlock } from "../post-editor-model";
import { BodyBlockHandle } from "./body-block-handle";
import { PostBody } from "./post-body";
import styles from "./rich-body-editor.module.css";
import { BlockAlignment } from "../block-alignment";
import { ImageNodeView, RepresentativeImageProvider } from "./image-node-view";
import { NaverLocationMap } from "./naver-location-map";
import { buildNaverMapEmbed, parseNaverMapEmbed, type MapLocation } from "../naver-map";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { prepareImageAttachments } from "../image-attachments";

type UploadResult = { src: string; previewUrl: string };
export type RichBodyEditorProps = {
  blocks: EditorBlock[];
  onChangeBlocks: (blocks: EditorBlock[]) => void;
  uploadImage?: (file: File) => Promise<UploadResult>;
  imagePreviews?: Record<string, string>;
  representativeImageSrc?: string | null;
  onSelectRepresentativeImage?: (src: string) => void;
  disabled?: boolean;
};


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

function ToolButton({ icon, label, onClick, disabled, pressed, role }: { icon: string; label: string; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean; pressed?: boolean; role?: "menuitem" }) {
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
      align: {
        default: "left",
        parseHTML: (element: HTMLElement) => ["left", "center", "right"].includes(element.getAttribute("data-align") || "") ? element.getAttribute("data-align") : "left",
        renderHTML: (attributes: Record<string, unknown>) => ({ "data-align": ["left", "center", "right"].includes(String(attributes.align)) ? attributes.align : "left" }),
      },
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const src = element.getAttribute("src") || "";
          const stableSrc = element.getAttribute("data-media-src") || "";
          return isSafeHref(src) || (src.startsWith("blob:") && isSafeHref(stableSrc)) ? src : null;
        },
      },
      mediaSrc: {
        default: null,
        parseHTML: (element: HTMLElement) => isSafeHref(element.getAttribute("data-media-src") || "") ? element.getAttribute("data-media-src") : null,
        renderHTML: (attributes: Record<string, unknown>) => attributes.mediaSrc ? { "data-media-src": attributes.mediaSrc } : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView, { stopEvent: ({ event }) => event.target instanceof Element && !!event.target.closest("[data-representative-image-control]") });
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

const isSafeMapEmbed = (src: string) => !!parseNaverMapEmbed(src) || isSafeOpenStreetMapEmbed(src);

const EmptyParagraphHint = Extension.create({
  name: "emptyParagraphHint",
  addProseMirrorPlugins() { return [new Plugin({ props: { decorations(state) {
    const decorations: Decoration[] = [];
    state.doc.descendants((node, pos) => { if (node.type.name === "paragraph" && node.content.size === 0) decorations.push(Decoration.node(pos, pos + node.nodeSize, { "data-placeholder": "내용을 입력하세요.", class: styles.emptyParagraph })); });
    return DecorationSet.create(state.doc, decorations);
  } } })]; },
});

const MapEmbed = TiptapNode.create({
  name: "openStreetMapEmbed",
  group: "block",
  atom: true,
  addAttributes() {
    return { src: { default: null, parseHTML: (element: HTMLElement) => isSafeMapEmbed(element.getAttribute("src") || "") ? element.getAttribute("src") : null } };
  },
  parseHTML() { return [{ tag: "iframe[src]", getAttrs: element => isSafeMapEmbed((element as HTMLElement).getAttribute("src") || "") ? {} : false }]; },
  renderHTML({ node }) {
    const src = typeof node.attrs.src === "string" && isSafeMapEmbed(node.attrs.src) ? node.attrs.src : "";
    return ["iframe", { src, title: parseNaverMapEmbed(src) ? "네이버 지도" : "지도: OpenStreetMap", width: "600", height: "450", loading: "lazy", sandbox: "allow-scripts allow-same-origin", referrerpolicy: parseNaverMapEmbed(src) ? "strict-origin-when-cross-origin" : "no-referrer" }];
  },
});

const extensionSet = [
  StarterKit.configure({ codeBlock: false, heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: {target:null} } }),
  RichImage.configure({ inline: false, allowBase64: false }),
  TableKit.configure({ table: false }),
  ControllableTable, HeadingParagraphReset, InlineCode, InlineTableSpec, InlineArchitecture, AutomaticToc,
  FontSize,
  BlockAlignment,
  FontFamily,
  Color,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  EditableToggle,
  TocNode,
  MapEmbed,
  HeadingIds, EmptyParagraphHint,
];

const isSafeHref = (value: string) => /^(https?:|mailto:)/i.test(value.trim());

export function RichBodyEditor({ blocks, onChangeBlocks, uploadImage, imagePreviews = {}, representativeImageSrc = null, onSelectRepresentativeImage = () => {}, disabled = false }: RichBodyEditorProps) {
  const first = blocks[0];
  const initialFormat: RichBodyFormat = blocks.length === 1 && first?.type === "MARKDOWN" ? "MARKDOWN" : "HTML";
  const content = blocks.length === 1 && ["TEXT", "HTML", "MARKDOWN"].includes(first?.type) ? first.content : "";
  const [format, setFormat] = useState<RichBodyFormat>(initialFormat);
  const [displayMode, setDisplayMode] = useState<"NORMAL" | "HTML" | "MARKDOWN">(initialFormat === "MARKDOWN" ? "MARKDOWN" : "NORMAL");
  const [pendingMode,setPendingMode]=useState<"NORMAL"|"HTML"|"MARKDOWN"|null>(null);
  const formatDialogId=useId();
  const formatDialog=useRef<HTMLDialogElement>(null);
  const [draftContent, setDraftContent] = useState(content);
  const [form, setForm] = useState<"link" | "map" | "toggle" | "html" | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [mapLocation, setMapLocation] = useState<MapLocation | null>(null);
  const [toggleSummary, setToggleSummary] = useState("");
  const [htmlDraft, setHtmlDraft] = useState("");
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [palette, setPalette] = useState<"text" | "highlight" | null>(null);
  const [paletteLeft, setPaletteLeft] = useState(48);
  const [tablePicker, setTablePicker] = useState(false);
  const [popupAnchor, setPopupAnchor] = useState({left:12,top:72});
  const anchorPopup = (element: HTMLElement, width: number) => { const rect=element.getBoundingClientRect(); setPopupAnchor({left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:rect.bottom}); };
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
    const media = current.isActive("image") ? "image" : current.isActive("table") ? "table" : current.isActive("pebbleCode") ? "pebbleCode" : current.isActive("tableSpec") ? "tableSpec" : current.isActive("architectureSpec") ? "architectureSpec" : null;
    return { align: media ? current.getAttributes(media).align || "left" : current.getAttributes(heading ? "heading" : "paragraph").textAlign || "left", media, bullet: current.isActive("bulletList"), ordered: current.isActive("orderedList"), kind, size: current.getAttributes(heading ? "heading" : "paragraph").fontSize || current.getAttributes("textStyle").fontSize || defaultTextSizes[kind], font: current.getAttributes("textStyle").fontFamily || "", color: current.getAttributes("textStyle").color || "#202124", bold: current.isActive("bold"), italic: current.isActive("italic"), underline: current.isActive("underline"), strike: current.isActive("strike") };
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
  const openForm = (kind: typeof form, trigger?: HTMLElement) => { if (trigger) anchorPopup(trigger, 420); setFormError(""); setForm(kind); setInsertMenuOpen(false); setPalette(null); setTablePicker(false); };
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

  const chooseImages = async (files: File[]) => {
    if (!files.length || !uploadImage || !editor || busy || disabled) return;
    setBusy(true); setFormError("");
    try {
      const { images, errors } = await prepareImageAttachments(files, uploadImage);
      if (images.length) editor.chain().focus().insertContent(images.map(image => ({
        type: "image", attrs: { src: image.previewUrl, mediaSrc: image.src, alt: image.name },
      }))).run();
      if (errors.length) setFormError(errors.join("\n"));
      else setForm(null);
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const insertMap = (event: React.FormEvent) => {
    event.preventDefault();
    const src = mapLocation && buildNaverMapEmbed(mapLocation);
    if (!src) { setFormError("지도에서 위치를 선택해 주세요."); return; }
    editor?.chain().focus().insertContent({ type: "openStreetMapEmbed", attrs: { src } }).run();
    setForm(null); setMapLocation(null);
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
    const node = type === "CODE" ? { type: "pebbleCode", attrs: { key, language: "TYPESCRIPT" } } : { type: type === "TABLE" ? "tableSpec" : "architectureSpec", attrs: { key, spec: type === "TABLE" ? defaultInlineTableSpec() : defaultInlineArchitectureSpec(), valid: false } };
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
    const summary = toggleSummary.trim();
    if (!summary) { setFormError("접는 글의 제목을 입력해 주세요."); return; }
    if (!editor) return;
    const toggle = { type: "details", attrs: { summary, open: true }, content: [{ type: "paragraph" }] };
    const selection = editor.state.selection.$from;
    if (selection.parent.type.name === "pebbleCode") editor.chain().focus().insertContentAt(selection.after(), toggle).run();
    else editor.chain().focus().insertContent(toggle).run();
    setForm(null); setToggleSummary("");
  };

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
          <ToolButton icon="image" label="이미지 삽입" disabled={disabled || busy || !uploadImage} onClick={() => { setForm(null); setFormError(""); setInsertMenuOpen(false); setPalette(null); setTablePicker(false); fileRef.current?.click(); }}/>
          <span className={styles.textControls}>
            <select aria-label="제목 수준" className={styles.select} value={selection?.kind ?? "p"} disabled={disabled} onChange={event => changeTextKind(event.target.value as "p"|"1"|"2"|"3")}><option value="p">본문</option>{[1,2,3].map(level => <option key={level} value={level}>제목 {level}</option>)}</select>
            <select aria-label="글자 크기" className={styles.select} value={selection?.size ?? "16px"} disabled={disabled} onChange={event => run(() => editor?.chain().focus().updateAttributes(selection?.kind === "p" ? "paragraph" : "heading", { fontSize: event.target.value }).setMark("textStyle", { fontSize: null }).run())}>{(textSizes[selection?.kind ?? "p"]).map(size => <option key={size}>{size}</option>)}{selection?.size && !textSizes[selection.kind].includes(selection.size) && <option value={selection.size}>{selection.size}</option>}</select>
          </span>
          <select aria-label="글꼴" className={styles.select} value={selection?.font ?? ""} disabled={disabled} onChange={event => run(() => event.target.value ? editor?.chain().focus().setFontFamily(event.target.value).run() : editor?.chain().focus().unsetFontFamily().run())}><option value="">기본서체</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option><option value="monospace">고정폭</option><option value="sans-serif">산세리프</option></select>
          <ToolButton icon="bold" label="굵게" disabled={disabled} pressed={selection?.bold} onClick={() => run(() => editor?.chain().focus().toggleBold().run())}/>
          <ToolButton icon="italic" label="기울임" disabled={disabled} pressed={selection?.italic} onClick={() => run(() => editor?.chain().focus().toggleItalic().run())}/>
          <ToolButton icon="underline" label="밑줄" disabled={disabled} pressed={selection?.underline} onClick={() => run(() => editor?.chain().focus().toggleUnderline().run())}/>
          <ToolButton icon="strike" label="취소선" disabled={disabled} pressed={selection?.strike} onClick={() => run(() => editor?.chain().focus().toggleStrike().run())}/>
          <button type="button" className={`${styles.toolButton} ${styles.colorTool}`} aria-label="글자색" aria-expanded={palette === "text"} aria-haspopup="dialog" disabled={disabled} onClick={event => { setPaletteLeft(Math.min(event.currentTarget.getBoundingClientRect().left, window.innerWidth - 230)); setPalette(palette === "text" ? null : "text"); setTablePicker(false); setInsertMenuOpen(false); }}>A</button>
          <button type="button" className={`${styles.toolButton} ${styles.colorTool}`} aria-label="글씨 배경색" aria-expanded={palette === "highlight"} aria-haspopup="dialog" disabled={disabled} onClick={event => { setPaletteLeft(Math.min(event.currentTarget.getBoundingClientRect().left, window.innerWidth - 230)); setPalette(palette === "highlight" ? null : "highlight"); setTablePicker(false); setInsertMenuOpen(false); }}>▰</button>
          <ToolButton icon={{left:"alignLeft",center:"alignCenter",right:"alignRight",justify:"alignJustify"}[selection?.align as "left"|"center"|"right"|"justify"] ?? "alignLeft"} label={`${selection?.media ? "블록" : "문단"} 정렬: ${{left:"왼쪽",center:"가운데",right:"오른쪽",justify:"양쪽"}[selection?.align as "left"|"center"|"right"|"justify"] ?? "왼쪽"} (클릭해서 변경)`} disabled={disabled} onClick={() => run(() => { const choices = selection?.media ? ["left","center","right"] : ["left","center","right","justify"]; const align = choices[(choices.indexOf(selection?.align ?? "left") + 1) % choices.length]; if (selection?.media) editor?.chain().focus().updateAttributes(selection.media, { align }).run(); else editor?.chain().focus().setTextAlign(align).run(); })}/>
          <ToolButton icon="quote" label="인용" disabled={disabled} onClick={() => run(() => editor?.chain().focus().toggleBlockquote().run())}/>
          <span onMouseEnter={event => { if (!disabled) { anchorPopup(event.currentTarget,244); setTablePicker(true); setPalette(null); setInsertMenuOpen(false); } }} onClick={event => anchorPopup(event.currentTarget,244)}><ToolButton icon="table" label="표 삽입" disabled={disabled} onClick={() => { setTablePicker(true); setPalette(null); setInsertMenuOpen(false); }}/></span>
          <ToolButton icon="link" label="링크 삽입" disabled={disabled} onClick={event => openForm("link", event.currentTarget)}/>
          <ToolButton icon={selection?.ordered ? "ordered" : "list"} label={`목록 스타일: ${selection?.ordered ? "번호" : selection?.bullet ? "동그라미" : "없음"} (클릭해서 변경)`} pressed={selection?.bullet || selection?.ordered} disabled={disabled} onClick={() => run(() => { if(selection?.ordered) editor?.chain().focus().toggleOrderedList().run(); else if(selection?.bullet) editor?.chain().focus().toggleOrderedList().run(); else editor?.chain().focus().toggleBulletList().run(); })}/>
          <ToolButton icon="rule" label="구분선 삽입" disabled={disabled} onClick={() => run(() => editor?.chain().focus().setHorizontalRule().run())}/>
          <div className={styles.insertWrap}>
            <button className={`${styles.toolButton} ${styles.insertButton}`} type="button" aria-label="추가 삽입 도구" aria-haspopup="menu" aria-expanded={insertMenuOpen} disabled={disabled} onClick={event => { anchorPopup(event.currentTarget,320); setInsertMenuOpen(open => !open); setPalette(null); setTablePicker(false); setForm(null); }}><Icon name="plus"/><Icon name="dots"/><span>삽입</span></button>
          </div>
        </>}
        <select aria-label="본문 형식" className={`${styles.select} ${styles.modeSelect}`} value={displayMode} disabled={disabled} onChange={event => changeMode(event.target.value as "NORMAL" | "HTML" | "MARKDOWN")}><option value="NORMAL">일반</option><option value="HTML">HTML</option><option value="MARKDOWN">마크다운</option></select>
      </div>
    </div>
    {insertMenuOpen && <div data-writer-popup className={styles.insertMenu} style={popupAnchor} role="menu" aria-label="추가 삽입 도구">
      <button type="button" role="menuitem" onClick={() => insertAction(insertToc)}>목차</button>
      <button type="button" role="menuitem" onClick={() => openForm("map")}>지도</button>
      <button type="button" role="menuitem" onClick={() => openForm("html")}>HTML</button>
      <button type="button" role="menuitem" onClick={() => insertAction(() => insertBlock("CODE"))}>코드</button>
      <button type="button" role="menuitem" onClick={() => insertAction(() => insertBlock("ARCHITECTURE"))}>아키텍처</button>
      <button type="button" role="menuitem" onClick={() => insertAction(() => insertBlock("TABLE"))}>테이블 명세</button>
      <button type="button" role="menuitem" onClick={() => openForm("toggle")}>접는 글</button>
    </div>}

    {palette && <div data-writer-popup className={styles.palette} style={{ left: Math.max(12, paletteLeft) }} role="dialog" aria-label={palette === "text" ? "글자색 선택" : "글씨 배경색 선택"}><strong>{palette === "text" ? "글자색" : "글씨 배경색"}</strong><div>{(palette === "text" ? textColors : highlightColors).map(color => <button key={color} type="button" title={color} aria-label={`${color} 색상`} style={{ backgroundColor: color }} onClick={() => pickColor(color)}/>)}</div><button type="button" onClick={() => { if (palette === "text") editor?.chain().focus().unsetColor().run(); else editor?.chain().focus().unsetHighlight().run(); setPalette(null); }}>기본색으로 초기화</button></div>}
    {tablePicker && <div data-writer-popup className={styles.tablePicker} style={popupAnchor} onMouseLeave={() => setTablePicker(false)} role="dialog" aria-label="표 크기 선택"><strong>{tableSize.rows}행 × {tableSize.cols}열</strong><div role="grid" aria-label="표 행·열 선택">{Array.from({ length: 8 }, (_, row) => Array.from({ length: 10 }, (_, col) => <button type="button" key={`${row}-${col}`} role="gridcell" data-table-cell={`${row + 1}-${col + 1}`} tabIndex={tableSize.rows === row + 1 && tableSize.cols === col + 1 ? 0 : -1} aria-label={`${row + 1}행 ${col + 1}열 표`} aria-selected={row < tableSize.rows && col < tableSize.cols} onMouseEnter={() => setTableSize({ rows: row + 1, cols: col + 1 })} onClick={() => chooseTable(row + 1, col + 1)} onKeyDown={event => { const direction = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key]; if (!direction) return; event.preventDefault(); const rows = Math.max(1, Math.min(8, row + 1 + direction[0])), cols = Math.max(1, Math.min(10, col + 1 + direction[1])); setTableSize({ rows, cols }); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-table-cell="${rows}-${cols}"]`)?.focus()); }}/>))}</div></div>}
    {displayMode === "NORMAL" ? <div className={styles.editor}><RepresentativeImageProvider selectedSrc={representativeImageSrc} disabled={disabled} onSelect={onSelectRepresentativeImage}><EditorContent editor={editor}/></RepresentativeImageProvider><BodyBlockHandle editor={editor} disabled={disabled}/></div>
      : displayMode === "HTML" ? <div className={styles.sourceGrid}><label>HTML 원문<textarea aria-label="HTML 원문" value={contentForView} disabled={disabled} onChange={event => publishSource(event.target.value, "HTML")}/></label><section aria-label="안전한 HTML 미리보기"><h3>미리보기</h3><div className={styles.preview}><PostBody blocks={blocks.filter(block => block.valid !== false)}/></div></section></div>
      : <div className={styles.sourceGrid}><label>마크다운 원문<small className={styles.markdownHelp}>제목은 ### 뒤에 공백을 넣어 작성하세요. Enter는 줄바꿈, 빈 줄은 문단 나눔입니다.</small><textarea aria-label="마크다운 원문" value={contentForView} disabled={disabled} onChange={event => publishSource(event.target.value, "MARKDOWN")}/></label><section aria-label="마크다운 미리보기"><h3>미리보기</h3><div className={styles.preview}><PostBody blocks={blocks.filter(block => block.valid !== false)}/></div></section></div>}

    <input ref={fileRef} type="file" hidden aria-label="첨부할 이미지 선택" multiple accept="image/png,image/jpeg,image/webp" disabled={disabled || busy || !uploadImage} onChange={event => void chooseImages(Array.from(event.currentTarget.files ?? []))}/>
    {!form && busy && <p role="status">이미지 추가 중…</p>}
    {!form && formError && <p role="alert">{formError}</p>}
    {form && <form data-writer-popup className={styles.form} style={{left:Math.max(12,Math.min(popupAnchor.left,typeof window!=="undefined"?window.innerWidth-432:12)),top:popupAnchor.top}} onSubmit={form === "link" ? insertLink : form === "map" ? insertMap : form === "toggle" ? addToggle : insertHtmlBlock}>
      <h3>{form === "link" ? "링크 추가" : form === "map" ? "네이버 지도" : form === "html" ? "안전한 HTML 블록 추가" : "접는 글 추가"}</h3>
      {form === "link" && <><label>주소<input type="url" value={linkHref} onChange={event => setLinkHref(event.target.value)} placeholder="https://example.com" required/></label><label>표시 문구 (선택)<input value={linkLabel} onChange={event => setLinkLabel(event.target.value)} /></label><button type="submit">링크 적용</button></>}
      {form === "map" && <><NaverLocationMap location={mapLocation} onSelect={setMapLocation}/><button type="submit" disabled={!mapLocation}>지도 삽입</button></>}
      {form === "html" && <><label>HTML 원문<textarea aria-label="HTML 블록 원문" placeholder="<p>내용을 입력하세요.</p>" value={htmlDraft} onChange={event => setHtmlDraft(event.target.value)} rows={8}/></label><div className={styles.preview} aria-label="HTML 미리보기" dangerouslySetInnerHTML={{ __html: richContentHtml(htmlDraft, "HTML") }}/><button type="submit">삽입</button></>}
      {form === "toggle" && <><label>접는 글 제목<input placeholder="제목을 입력하세요" value={toggleSummary} onChange={event => setToggleSummary(event.target.value)} required/></label><button type="submit">추가</button></>}
      {formError && <p role="alert">{formError}</p>}<button type="button" onClick={() => setForm(null)}>닫기</button>
    </form>}
  </section>;
}
