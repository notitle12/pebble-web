import styles from "./content-placeholder.module.css";

export function ContentPlaceholder({kind="post",className=""}:{kind?:"post"|"project";className?:string}) {
  return <span className={`${styles.placeholder} ${className}`} aria-hidden="true">
    <svg className={styles.art} viewBox="0 0 640 360" fill="none" focusable="false">
      <circle cx="320" cy="180" r="104" fill="currentColor" opacity=".045"/>
      {kind==="project"?<>
        <path d="M241 116h61l20 23h77v96a13 13 0 0 1-13 13H254a13 13 0 0 1-13-13V116Z"/>
        <path d="M266 178h108m-108 24h72" opacity=".45"/>
      </>:<>
        <rect x="260" y="99" width="120" height="162" rx="12"/>
        <path d="M285 143h70m-70 28h70m-70 28h44" opacity=".45"/>
      </>}
    </svg>
  </span>;
}
