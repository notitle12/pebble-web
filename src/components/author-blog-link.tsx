import { IntentLink } from "./intent-link";
import { safeMediaUrl } from "@/features/media/model";
import styles from "./author-blog-link.module.css";

type Author = { nickname: string; handle?: string | null; profileImageUrl?: string | null };

export function AuthorBlogLink({ author }: { author: Author }) {
  const photo = safeMediaUrl(author.profileImageUrl ?? null);
  const content = <>
    {photo ? <img className={styles.avatar} src={photo} width={24} height={24} alt="" decoding="async"/>
      : <span className={styles.avatar} aria-hidden="true">{Array.from(author.nickname)[0]}</span>}
    <span>{author.nickname}</span>
  </>;
  return author.handle && /^[a-z][a-z0-9_-]{1,28}[a-z0-9_]$/.test(author.handle)
    ? <IntentLink className={styles.author} href={`/blogs/${encodeURIComponent(author.handle)}`} aria-label={`${author.nickname}의 블로그 홈`}>{content}</IntentLink>
    : <span className={styles.author}>{content}</span>;
}
