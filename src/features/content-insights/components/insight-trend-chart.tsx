"use client";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { trendGeometry, trendIndexAtX, type TrendRow } from "../trend-chart";
import styles from "./content-insights.module.css";

type Series = { label: string; kind: "post" | "project" };
const number = (value: number) => value.toLocaleString("ko-KR");
export function InsightTrendChart({ rows, series, label, compactDates = false }: { rows: TrendRow[]; series: Series[]; label: string; compactDates?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const { maximum, points } = trendGeometry(rows);
  const row = active === null ? null : rows[active];
  const point = active === null ? null : points[active];
  useEffect(() => {
    const dismiss = (event: globalThis.PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setActive(null); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const select = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width) setActive(trendIndexAtX(rows.length, (event.clientX - rect.left) / rect.width));
  };
  const axisLabel = (value: string) => compactDates ? value.slice(5).replace("-", ".") : value;
  if (!rows.length) return <p className={styles.empty}>조회 통계가 없어요.</p>;
  return <div ref={root} className={styles.chart}>
    <span className={styles.maximum}>{number(maximum)}</span>
    <div className={styles.chartPlot} tabIndex={0} role="group" aria-label={label} aria-describedby={row ? tooltipId : undefined}
      onPointerMove={event => { if (event.pointerType !== "touch") select(event); }} onPointerDown={select}
      onPointerLeave={event => { if (event.pointerType === "mouse") setActive(null); }}
      onKeyDown={event=>{
        if(!["ArrowLeft","ArrowRight","Home","End","Escape"].includes(event.key))return;
        event.preventDefault();
        if(event.key==="Escape"){setActive(null);return;}
        setActive(index=>event.key==="Home"?0:event.key==="End"?rows.length-1:Math.max(0,Math.min(rows.length-1,(index??rows.length-1)+(event.key==="ArrowLeft"?-1:1))));
      }}
      onFocus={() => setActive(index => index ?? rows.length - 1)} onBlur={() => setActive(null)}>
      <svg viewBox="0 0 720 160" preserveAspectRatio="none" aria-hidden="true">
        <path d="M16 24H704 M16 82H704 M16 140H704" className={styles.grid}/>
        {series.map((item, seriesIndex) => <g key={item.kind}>
          <polyline points={points.map(point => `${point.x},${point.ys[seriesIndex]}`).join(" ")} className={item.kind === "post" ? styles.postLine : styles.projectLine}/>
          {points.map((point, index) => <circle key={rows[index].label} cx={point.x} cy={point.ys[seriesIndex]} r={index === active ? 4.5 : 2.5} className={item.kind === "post" ? styles.postPoint : styles.projectPoint}/>) }
        </g>)}
        {point && <line x1={point.x} x2={point.x} y1="16" y2="148" className={styles.chartGuide}/>}
      </svg>
      {row && point && <div id={tooltipId} role="tooltip" className={styles.chartTooltip} style={{ left: `clamp(82px, ${point.x / 720 * 100}%, calc(100% - 82px))` }}>
        <strong>{row.label}</strong>
        {series.map((item, index) => <span key={item.kind}><i className={item.kind === "post" ? styles.postDot : styles.projectDot}/>{item.label}<b>{number(row.values[index])}회</b></span>)}
      </div>}
    </div>
    <div className={styles.axis} data-single={rows.length===1||undefined}><span>{axisLabel(rows[0].label)}</span>{rows.length>1&&<span>{axisLabel(rows[rows.length - 1].label)}</span>}</div>
  </div>;
}
