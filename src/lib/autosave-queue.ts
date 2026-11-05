export type AutosaveState = { phase: 'idle' | 'pending' | 'saving' | 'saved' | 'error'; savedAt?: number; error?: string };
/** Serialize durable commits; a successful explicit save invalidates all older queued writes. */
export function createAutosaveQueue<T>({write,clear,onState,delay=1000,maxWait=5000}:{write:(value:T)=>Promise<void>;clear:()=>Promise<void>;onState:(state:AutosaveState)=>void;delay?:number;maxWait?:number}) {
 let latest:T|undefined,revision=0,invalidBefore=0,queued=-1,chain=Promise.resolve(),timer:ReturnType<typeof setTimeout>|undefined,maximum:ReturnType<typeof setTimeout>|undefined;
 const cancelTimers=()=>{clearTimeout(timer);clearTimeout(maximum);timer=maximum=undefined;};
 const enqueue=()=>{
  cancelTimers();
  if(latest===undefined||queued===revision)return chain;
  const value=latest,version=revision;queued=version;
  chain=chain.catch(()=>{}).then(async()=>{
   if(version<invalidBefore)return;
   onState({phase:'saving'});
   try{await write(value);if(version===revision)onState({phase:'saved',savedAt:Date.now()});}
   catch(error){if(version===revision){queued=-1;onState({phase:'error',error:error instanceof Error?error.message:'자동저장에 실패했어요.'});}throw error;}
  });
  return chain;
 };
 return {
  schedule(value:T){latest=value;revision++;clearTimeout(timer);onState({phase:'pending'});timer=setTimeout(()=>void enqueue().catch(()=>{}),delay);maximum??=setTimeout(()=>void enqueue().catch(()=>{}),maxWait);},
  flush:enqueue,
  async clear(){cancelTimers();latest=undefined;invalidBefore=++revision;queued=-1;chain=chain.catch(()=>{}).then(clear);await chain;onState({phase:'idle'});},
  stop(){cancelTimers();},
 };
}
