export type TableInputCompositionState = { composing: boolean };
export type TableInputCompositionEvent =
  | { type: "compositionstart" }
  | { type: "change"; value: string }
  | { type: "compositionend"; value: string }
  | { type: "blur"; value: string };

export function transitionTableInputComposition(state: TableInputCompositionState, event: TableInputCompositionEvent): { state: TableInputCompositionState; commit?: string } {
  if (event.type === "compositionstart") return { state: { composing: true } };
  if (event.type === "change") return state.composing ? { state } : { state, commit: event.value };
  if (event.type === "compositionend") return { state: { composing: false }, commit: event.value };
  return state.composing ? { state: { composing: false }, commit: event.value } : { state };
}
