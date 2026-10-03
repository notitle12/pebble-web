import {ChoicePicker} from "@/components/choice-picker";
export function TagPicker({tags,selected,disabled}:{tags:{id:string;name:string}[];selected?:string;disabled?:boolean}) {
  return <ChoicePicker label="기술 태그" name="tagId" controlId="post-tag" allLabel="전체 태그" options={tags} selected={selected} disabled={disabled}/>;
}
