export function withdrawalConfirmation(blogName:string|null):string {
  const name=blogName?.trim();
  return name?`${name}를 삭제하는데 동의합니다.`:"내 계정을 삭제하는데 동의합니다.";
}
