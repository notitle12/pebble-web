import StarterKit from "@tiptap/starter-kit";

/** 인라인 코드에도 굵게·기울임 등 작성자가 지정한 서식을 보존한다. */
export const RichTextStarterKit = StarterKit.extend({
  addExtensions() {
    return (this.parent?.() ?? []).map(extension =>
      extension.name === "code" ? extension.extend({ excludes: "" }) : extension
    );
  },
});
