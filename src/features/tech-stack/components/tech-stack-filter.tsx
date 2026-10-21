import {ChoicePicker} from "@/components/choice-picker";
export function TechStackFilter({techStacks,selected,disabled}:{techStacks:{id:string;name:string}[];selected?:string;disabled?:boolean}) {
  return <ChoicePicker label="기술 스택" name="techStackId" controlId="post-tag" allLabel="전체 기술 스택" options={techStacks} selected={selected} disabled={disabled}/>;
}
