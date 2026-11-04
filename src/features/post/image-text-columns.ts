import { Node, mergeAttributes } from "@tiptap/core";

export const columnRatios = ["1:1", "1:2", "2:1"] as const;
export const safeColumnRatio = (value: unknown) => columnRatios.includes(value as typeof columnRatios[number]) ? String(value) : "1:1";
export const newImageTextLayout = () => ({ type: "imageTextLayout", content: [0, 1].map(() => ({ type: "imageTextColumn", content: [{ type: "paragraph" }] })) });

export const ImageTextColumn = Node.create({
  name: "imageTextColumn", content: "block+", isolating: true,
  parseHTML: () => [{ tag: "div.post-column" }],
  renderHTML: () => ["div", { class: "post-column" }, 0],
});

export const ImageTextLayout = Node.create({
  name: "imageTextLayout", group: "block", content: "imageTextColumn{2}", isolating: true, draggable: true,
  addAttributes: () => ({ ratio: { default: "1:1", parseHTML: element => safeColumnRatio(element.getAttribute("data-ratio")), renderHTML: attrs => ({ "data-ratio": safeColumnRatio(attrs.ratio) }) } }),
  parseHTML: () => [{ tag: "div.post-columns" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes({ class: "post-columns" }, HTMLAttributes), 0],
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div"); dom.className = "post-columns-editor";
      const toolbar = document.createElement("div"); toolbar.className = "post-columns-toolbar"; toolbar.contentEditable = "false";
      const label = document.createElement("label"); label.textContent = "나란히 배치";
      const select = document.createElement("select"); select.setAttribute("aria-label", "좌우 배치 비율");
      for (const ratio of columnRatios) { const option = document.createElement("option"); option.value = ratio; option.textContent = ratio; select.append(option); }
      const contentDOM = document.createElement("div"); contentDOM.className = "post-columns";
      const sync = () => { select.value = safeColumnRatio(node.attrs.ratio); select.disabled = !editor.isEditable; contentDOM.dataset.ratio = select.value; };
      sync(); label.append(select); toolbar.append(label); dom.append(toolbar, contentDOM);
      select.addEventListener("change", () => {
        const pos = getPos();
        if (typeof pos === "number" && editor.isEditable && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ratio: safeColumnRatio(select.value) }));
      });
      return { dom, contentDOM, update(next) { if (next.type !== node.type) return false; node = next; sync(); return true; }, stopEvent: event => toolbar.contains(event.target as globalThis.Node), ignoreMutation: mutation => toolbar.contains(mutation.target) };
    };
  },
});
