import styles from "./loading-state.module.css";

export function LoadingIndicator({label="불러오는 중",section=false}:{label?:string;section?:boolean}){
  return <div className={`${styles.indicator}${section?` ${styles.section}`:""}`} role="status" aria-busy="true">
    <span className={styles.spinner} aria-hidden="true"/>
    <span className={styles.visuallyHidden}>{label}</span>
  </div>;
}
