import { memberJson, MemberApiError, responseData } from "../../lib/member-api.ts";
import {isIsoInstant} from "../../lib/date-time.ts";
export type Member = { id: string; nickname: string; handle: string | null; blogName: string | null; profileImageUrl: string | null; profileCompleted: boolean; status: "ACTIVE" };
export type SessionState = { phase: "loading" | "ready" | "guest" | "error"; member: Member | null; message: string };
export const initialSession: SessionState = { phase: "loading", member: null, message: "" };
export function parseMember(value: unknown): Member {
  const d = responseData(value);
  if (typeof d.id !== "string" || !/^[1-9]\d*$/.test(d.id) || typeof d.nickname !== "string" || d.status !== "ACTIVE" || typeof d.profileCompleted !== "boolean" || !(d.handle === null || typeof d.handle === "string") || !(d.blogName === null || typeof d.blogName === "string") || !(d.profileImageUrl === undefined || d.profileImageUrl === null || typeof d.profileImageUrl === "string")) throw new MemberApiError(0, "INVALID_RESPONSE", "회원 정보를 확인하지 못했습니다.");
  return {id:d.id,nickname:d.nickname,handle:d.handle,blogName:d.blogName,profileImageUrl:typeof d.profileImageUrl === "string" ? d.profileImageUrl : null,profileCompleted:d.profileCompleted,status:"ACTIVE"};
}
type Exclusive = <T>(action:()=>Promise<T>)=>Promise<T>;
export function createUserSession(request: typeof fetch = fetch, exclusive: Exclusive = browserLock, base?: string, announce: ()=>void = ()=>{}) {
  let state = initialSession, access = "", expiresAt = 0, generation = 0;
  let restoration: Promise<void> | null = null, completion: Promise<void> | null = null;
  const listeners = new Set<()=>void>();
  const publish = (next:SessionState) => {state=next; listeners.forEach(fn=>fn());};
  const clear = () => {generation++; access=""; expiresAt=0;};
  const raw = (path:string,options:Parameters<typeof memberJson>[1]={})=>memberJson(path,options,request,base);
  function grant(value:unknown) {
    const d=responseData(value);
    if(typeof d.accessToken!=="string" || !d.accessToken || d.tokenType!=="Bearer" || typeof d.accessTokenExpiresIn!=="number" || !Number.isFinite(d.accessTokenExpiresIn) || d.accessTokenExpiresIn<=0) throw new MemberApiError(0,"INVALID_RESPONSE","인증 응답을 확인하지 못했습니다.");
    return {token:d.accessToken,expires:Date.now()+d.accessTokenExpiresIn*1000};
  }
  async function refresh() {
    if(restoration) return restoration;
    if(state.phase==="error") throw new MemberApiError(0,"SESSION_UNCERTAIN",state.message);
    const epoch=generation, previousMember=state.member;
    restoration=exclusive(async()=>{
      if(epoch!==generation)return;
      publish({...initialSession,member:previousMember});
      try {
        const g=grant(await raw("/auth/token/refresh",{method:"POST",cookies:true}));
        if(epoch!==generation)return;
        const member=parseMember(await raw("/members/me",{token:g.token}));
        if(epoch!==generation)return;
        access=g.token;expiresAt=g.expires;publish({phase:"ready",member,message:""});
      } catch(e) {
        if(epoch!==generation)return;
        access="";expiresAt=0;
        const denied=e instanceof MemberApiError && [401,403,409].includes(e.status);
        publish({phase:denied?"guest":"error",member:previousMember,message:denied?"로그인이 필요합니다.":"로그인 복구 결과를 확인하지 못했습니다. 자동 재시도 없이 다시 로그인해 주세요."});
      }
    }).catch(()=>{if(epoch===generation)publish({phase:"error",member:previousMember,message:"이 브라우저에서 안전하게 세션을 복구할 수 없습니다. 최신 브라우저에서 다시 로그인해 주세요."});}).finally(()=>{restoration=null;});
    return restoration;
  }
  async function token() {
    if(access && Date.now()<expiresAt-30000)return access;
    if(state.phase==="guest")throw new MemberApiError(401,"AUTHENTICATION_REQUIRED","로그인이 필요합니다.");
    await refresh();
    if(!access)throw new MemberApiError(401,"AUTHENTICATION_REQUIRED",state.message||"로그인이 필요합니다.");
    return access;
  }
  return {
    subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
    snapshot:()=>state,
    async ensure(){if(state.phase==="loading" || (state.phase==="ready" && Date.now()>=expiresAt-30000))await refresh();},
    async request(path:string,options:Parameters<typeof memberJson>[1]={}) {
      const epoch=generation, bearer=await token();
      if(epoch!==generation)throw new MemberApiError(401,"SESSION_CHANGED","로그인 상태가 변경되었습니다.");
      try {const value=await raw(path,{...options,token:bearer,cookies:false}); if(epoch!==generation)throw new MemberApiError(401,"SESSION_CHANGED","로그인 상태가 변경되었습니다.");return value;}
      catch(e){if(e instanceof MemberApiError && e.status===401 && epoch===generation){clear();publish({phase:"guest",member:state.member,message:"로그인이 만료되었습니다. 입력 내용을 확인한 뒤 다시 로그인해 주세요."});}throw e;}
    },
    invalidate(){clear();publish({phase:"guest",member:null,message:"다른 탭에서 로그인 상태가 변경되었습니다. 다시 로그인해 주세요."});},
    async authorization(){
      listenSessionChanges();
      const d=responseData(await raw("/auth/naver/authorization",{method:"POST",cookies:true}));
      if(typeof d.authorizationUrl!=="string")throw new MemberApiError(0,"INVALID_RESPONSE","로그인 주소를 확인하지 못했습니다.");
      const url=new URL(d.authorizationUrl);
      if(url.protocol!=="https:" || url.hostname!=="nid.naver.com" || url.pathname!=="/oauth2.0/authorize" || url.username || url.password)throw new MemberApiError(0,"INVALID_RESPONSE","로그인 주소를 확인하지 못했습니다.");
      return url.href;
    },
    complete(authorizationCode:string,stateValue:string) {
      listenSessionChanges();
      if(completion)return completion;
      clear();const epoch=generation;
      completion=exclusive(async()=>{
        const g=grant(await raw("/auth/naver/login",{method:"POST",cookies:true,body:{authorizationCode,state:stateValue}}));
        if(epoch!==generation)return;
        const member=parseMember(await raw("/members/me",{token:g.token}));
        if(epoch!==generation)return;
        access=g.token;expiresAt=g.expires;publish({phase:"ready",member,message:""});announce();
      }).catch(e=>{if(epoch===generation)publish({phase:"error",member:null,message:e instanceof Error?e.message:"로그인을 완료하지 못했습니다."});throw e;});
      return completion;
    },
    async withdraw(){
      const epoch=generation,bearer=await token();
      if(epoch!==generation)throw new MemberApiError(401,"SESSION_CHANGED","로그인 상태가 변경되었습니다.");
      try {
        const data=responseData(await exclusive(()=>raw("/members/me",{method:"DELETE",token:bearer,cookies:true})));
        if(!isIsoInstant(data.withdrawalScheduledAt))throw new MemberApiError(0,"INVALID_RESPONSE","탈퇴 예약 결과를 확인하지 못했습니다.");
        if(epoch!==generation)throw new MemberApiError(401,"SESSION_CHANGED","로그인 상태가 변경되었습니다.");
        clear();publish({phase:"guest",member:null,message:"탈퇴 예약이 완료되었습니다."});announce();
        return data.withdrawalScheduledAt;
      }catch(error){
        if(epoch===generation && error instanceof MemberApiError && (error.status===0||error.status===401||error.code==="ACCOUNT_WITHDRAWAL_PENDING")){
          clear();publish({phase:"error",member:null,message:"탈퇴 예약 결과를 확인하지 못했습니다. 재요청하지 말고 네이버로 로그인하여 계정 상태를 확인해 주세요."});announce();
        }
        throw error;
      }
    },
    cancelWithdrawal(authorizationCode:string,stateValue:string){
      listenSessionChanges();
      if(completion)return completion;
      clear();const epoch=generation;publish({...initialSession});
      completion=exclusive(async()=>{
        const data=responseData(await raw("/auth/naver/withdrawal/cancel",{method:"POST",cookies:true,body:{authorizationCode,state:stateValue}}));
        if(data.status!=="ACTIVE")throw new MemberApiError(0,"INVALID_RESPONSE","탈퇴 취소 결과를 확인하지 못했습니다.");
        if(epoch!==generation)return;
        clear();publish({phase:"guest",member:null,message:"탈퇴 예약을 취소했습니다. 다시 로그인해 주세요."});announce();
      }).catch(error=>{if(epoch===generation)publish({phase:"error",member:null,message:error instanceof Error?error.message:"탈퇴 예약을 취소하지 못했습니다."});throw error;});
      return completion;
    },
    async reloadMember(){const epoch=generation;const member=parseMember(await this.request("/members/me"));if(epoch===generation)publish({phase:"ready",member,message:""});},
    async logout(){clear();publish({phase:"loading",member:null,message:""});announce();const epoch=generation;
      try{await exclusive(()=>raw("/auth/logout",{method:"POST",cookies:true}));if(epoch===generation)publish({phase:"guest",member:null,message:"로그아웃했습니다."});}
      catch{if(epoch===generation)publish({phase:"error",member:null,message:"로그아웃 완료를 확인하지 못했습니다. 로그아웃을 다시 시도해 주세요."});}
    },
  };
}
async function browserLock<T>(action:()=>Promise<T>):Promise<T> {
  if(typeof navigator==="undefined" || !navigator.locks)throw new Error("session lock unavailable");
  return navigator.locks.request("pebble-user-session",action);
}
let channel:BroadcastChannel|null=null;
export const userSession=createUserSession(fetch,browserLock,undefined,()=>{channel?.postMessage("session-changed");});
export function listenSessionChanges(){
  if(typeof window!=="undefined" && typeof BroadcastChannel!=="undefined" && !channel){channel=new BroadcastChannel("pebble-user-session");channel.onmessage=e=>{if(e.data==="session-changed")userSession.invalidate();};}
}
