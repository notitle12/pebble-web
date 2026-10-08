import { Extension } from "@tiptap/core";

const alignments = ["left", "center", "right"] as const;

export const BlockAlignment = Extension.create({
  name: "pebbleBlockAlignment",
  addGlobalAttributes() {
    return [{
      types: ["table"],
      attributes: {
        align: {
          default: "left",
          parseHTML: (element: HTMLElement) => alignments.includes(element.getAttribute("data-align") as (typeof alignments)[number]) ? element.getAttribute("data-align") : "left",
          renderHTML: (attributes: Record<string, unknown>) => ({ "data-align": alignments.includes(String(attributes.align) as (typeof alignments)[number]) ? attributes.align : "left" }),
        },
      },
    }];
  },
});

export function tableAlignment(value: unknown): "left" | "center" | "right" {
  return alignments.includes(value as (typeof alignments)[number]) ? value as (typeof alignments)[number] : "left";
}
