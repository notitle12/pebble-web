export type NaverMode="login"|"withdrawal-cancel";
export const withdrawalIntentKey="pebble-withdrawal-intent";
export function callbackMode(stored:string|null,state:string):NaverMode {
  if(stored===null)return "login";
  let value:unknown;try{value=JSON.parse(stored);}catch{throw new Error("탈퇴 취소 요청을 확인하지 못했습니다. 다시 시작해 주세요.");}
  if(typeof value!=="object"||value===null||!("mode" in value)||value.mode!=="withdrawal-cancel"||!("state" in value)||value.state!==state)throw new Error("탈퇴 취소 요청과 로그인 응답이 일치하지 않습니다. 다시 시작해 주세요.");
  return "withdrawal-cancel";
}
