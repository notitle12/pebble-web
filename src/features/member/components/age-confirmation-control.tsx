"use client";

export function AgeConfirmationControl({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="agreement-check"><input type="checkbox" required checked={checked} onChange={event => onChange(event.target.checked)} /><span>만 14세 이상입니다.</span></label>;
}
