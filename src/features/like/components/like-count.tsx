export function LikeCount({count}:{count?:number}){
  if(count===undefined)return null;
  return <span className="list-like-count" aria-label={`좋아요 ${count.toLocaleString("ko-KR")}개`}><span aria-hidden="true">♡ </span>{count.toLocaleString("ko-KR")}</span>;
}
