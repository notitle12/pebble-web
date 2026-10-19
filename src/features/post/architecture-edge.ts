import type { ArchitectureEdge, ArchitectureSide } from './api/post-list.ts';
import type { ArchBox, ArchPoint } from './architecture-layout.ts';

export const architectureAnchor = (box: ArchBox, side: ArchitectureSide): ArchPoint =>
  side === 'TOP'
    ? { x: box.x + box.width / 2, y: box.y }
    : side === 'BOTTOM'
    ? { x: box.x + box.width / 2, y: box.y + box.height }
    : side === 'LEFT'
    ? { x: box.x, y: box.y + (box.anchorY ?? box.height / 2) }
    : { x: box.x + box.width, y: box.y + (box.anchorY ?? box.height / 2) };

const normal = (side: ArchitectureSide): ArchPoint =>
  side === 'TOP'
    ? { x: 0, y: -1 }
    : side === 'BOTTOM'
    ? { x: 0, y: 1 }
    : side === 'LEFT'
    ? { x: -1, y: 0 }
    : { x: 1, y: 0 };

function formatOrthogonalPath(points: ArchPoint[], radius = 8): string {
  const clean: ArchPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (clean.length > 0) {
      const prev = clean[clean.length - 1];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) < 1) continue;
    }
    clean.push(p);
  }
  for (let i = 1; i < clean.length - 1; ) {
    const a = clean[i - 1], b = clean[i], c = clean[i + 1];
    if ((Math.abs(a.x - b.x) < 0.1 && Math.abs(b.x - c.x) < 0.1) || (Math.abs(a.y - b.y) < 0.1 && Math.abs(b.y - c.y) < 0.1)) {
      clean.splice(i, 1);
    } else {
      i++;
    }
  }
  if (clean.length < 2) return '';
  if (clean.length === 2) {
    return `M${clean[0].x} ${clean[0].y} L${clean[1].x} ${clean[1].y}`;
  }

  let d = `M${clean[0].x} ${clean[0].y}`;
  for (let i = 1; i < clean.length - 1; i++) {
    const prev = clean[i - 1];
    const curr = clean[i];
    const next = clean[i + 1];

    const len1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const len2 = Math.hypot(next.x - curr.x, next.y - curr.y);
    const r = Math.min(radius, len1 / 2, len2 / 2);

    const dir1X = (curr.x - prev.x) / len1;
    const dir1Y = (curr.y - prev.y) / len1;
    const dir2X = (next.x - curr.x) / len2;
    const dir2Y = (next.y - curr.y) / len2;

    const startX = Math.round((curr.x - dir1X * r) * 10) / 10;
    const startY = Math.round((curr.y - dir1Y * r) * 10) / 10;
    const endX = Math.round((curr.x + dir2X * r) * 10) / 10;
    const endY = Math.round((curr.y + dir2Y * r) * 10) / 10;

    d += ` L${startX} ${startY} Q${curr.x} ${curr.y} ${endX} ${endY}`;
  }
  const last = clean[clean.length - 1];
  d += ` L${last.x} ${last.y}`;
  return d;
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

function computeOrthogonalPoints(
  start: ArchPoint,
  sourceSide: ArchitectureSide,
  end: ArchPoint,
  targetSide: ArchitectureSide,
  lane = 0,
  waypoint?: ArchPoint | null
): { points: ArchPoint[]; bend: ArchPoint } {
  if (Math.hypot(end.x - start.x, end.y - start.y) < 2) {
    return { points: [start, end], bend: start };
  }

  const stub = 24;
  const laneOffset = lane * 14;

  const isSourceH = sourceSide === 'LEFT' || sourceSide === 'RIGHT';
  const isTargetH = targetSide === 'LEFT' || targetSide === 'RIGHT';

  if (waypoint) {
    const W = { x: Math.round(waypoint.x), y: Math.round(waypoint.y) };
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    if (isSourceH && isTargetH) {
      const facing = (sourceSide === 'RIGHT' && targetSide === 'LEFT' && start.x < end.x) ||
                     (sourceSide === 'LEFT' && targetSide === 'RIGHT' && start.x > end.x);

      if (facing) {
        const sStubX = sourceSide === 'RIGHT' ? start.x + stub : start.x - stub;
        const tStubX = targetSide === 'LEFT' ? end.x - stub : end.x + stub;
        const minStubX = Math.min(sStubX, tStubX);
        const maxStubX = Math.max(sStubX, tStubX);

        // 1. 위쪽으로 벗어날 때 -> ㄷ자 우회 경로 (상단)
        if (W.y < minY - 12) {
          const detourY = Math.min(minY - stub, W.y);
          const bendX = clamp(W.x, minStubX, maxStubX);
          const bend = { x: bendX, y: detourY };
          return {
            points: [start, { x: sStubX, y: start.y }, { x: sStubX, y: detourY }, { x: tStubX, y: detourY }, { x: tStubX, y: end.y }, end],
            bend,
          };
        }

        // 2. 아래쪽으로 벗어날 때 -> ㄷ자 우회 경로 (하단)
        if (W.y > maxY + 12) {
          const detourY = Math.max(maxY + stub, W.y);
          const bendX = clamp(W.x, minStubX, maxStubX);
          const bend = { x: bendX, y: detourY };
          return {
            points: [start, { x: sStubX, y: start.y }, { x: sStubX, y: detourY }, { x: tStubX, y: detourY }, { x: tStubX, y: end.y }, end],
            bend,
          };
        }

        // 3. 시작-도착 사이의 수직 코리더 (S자 / 계단식)
        const minCorridorX = minX + stub;
        const maxCorridorX = maxX - stub;
        const corridorX = minCorridorX <= maxCorridorX
          ? clamp(W.x, minCorridorX, maxCorridorX)
          : Math.round((start.x + end.x) / 2);
        const bendY = minY === maxY ? start.y : clamp(W.y, minY, maxY);
        const bend = { x: corridorX, y: bendY };

        if (minY === maxY) {
          return { points: [start, end], bend };
        }
        return {
          points: [start, { x: corridorX, y: start.y }, { x: corridorX, y: end.y }, end],
          bend,
        };
      }

      if (sourceSide === 'RIGHT' && targetSide === 'RIGHT') {
        const turnX = Math.max(maxX + stub, W.x);
        const bend = { x: turnX, y: clamp(W.y, minY, maxY) };
        return {
          points: [start, { x: turnX, y: start.y }, { x: turnX, y: end.y }, end],
          bend,
        };
      }

      if (sourceSide === 'LEFT' && targetSide === 'LEFT') {
        const turnX = Math.min(minX - stub, W.x);
        const bend = { x: turnX, y: clamp(W.y, minY, maxY) };
        return {
          points: [start, { x: turnX, y: start.y }, { x: turnX, y: end.y }, end],
          bend,
        };
      }

      // 서로 반대 방향(외곽)으로 나가는 경우
      const sStubX = sourceSide === 'RIGHT' ? start.x + stub : start.x - stub;
      const tStubX = targetSide === 'LEFT' ? end.x - stub : end.x + stub;
      const passY = W.y < minY ? Math.min(minY - stub, W.y) : Math.max(maxY + stub, W.y);
      const bend = { x: Math.round((sStubX + tStubX) / 2), y: passY };
      return {
        points: [start, { x: sStubX, y: start.y }, { x: sStubX, y: passY }, { x: tStubX, y: passY }, { x: tStubX, y: end.y }, end],
        bend,
      };
    }

    if (!isSourceH && !isTargetH) {
      const facing = (sourceSide === 'BOTTOM' && targetSide === 'TOP' && start.y < end.y) ||
                     (sourceSide === 'TOP' && targetSide === 'BOTTOM' && start.y > end.y);

      if (facing) {
        const sStubY = sourceSide === 'BOTTOM' ? start.y + stub : start.y - stub;
        const tStubY = targetSide === 'TOP' ? end.y - stub : end.y + stub;
        const minStubY = Math.min(sStubY, tStubY);
        const maxStubY = Math.max(sStubY, tStubY);

        // 1. 왼쪽으로 벗어날 때 -> ㄷ자 우회 경로 (좌측)
        if (W.x < minX - 12) {
          const detourX = Math.min(minX - stub, W.x);
          const bendY = clamp(W.y, minStubY, maxStubY);
          const bend = { x: detourX, y: bendY };
          return {
            points: [start, { x: start.x, y: sStubY }, { x: detourX, y: sStubY }, { x: detourX, y: tStubY }, { x: end.x, y: tStubY }, end],
            bend,
          };
        }

        // 2. 오른쪽으로 벗어날 때 -> ㄷ자 우회 경로 (우측)
        if (W.x > maxX + 12) {
          const detourX = Math.max(maxX + stub, W.x);
          const bendY = clamp(W.y, minStubY, maxStubY);
          const bend = { x: detourX, y: bendY };
          return {
            points: [start, { x: start.x, y: sStubY }, { x: detourX, y: sStubY }, { x: detourX, y: tStubY }, { x: end.x, y: tStubY }, end],
            bend,
          };
        }

        // 3. 시작-도착 사이의 수평 코리더 (S자 / 계단식)
        const minCorridorY = minY + stub;
        const maxCorridorY = maxY - stub;
        const corridorY = minCorridorY <= maxCorridorY
          ? clamp(W.y, minCorridorY, maxCorridorY)
          : Math.round((start.y + end.y) / 2);
        const bendX = minX === maxX ? start.x : clamp(W.x, minX, maxX);
        const bend = { x: bendX, y: corridorY };

        if (minX === maxX) {
          return { points: [start, end], bend };
        }
        return {
          points: [start, { x: start.x, y: corridorY }, { x: end.x, y: corridorY }, end],
          bend,
        };
      }

      if (sourceSide === 'BOTTOM' && targetSide === 'BOTTOM') {
        const turnY = Math.max(maxY + stub, W.y);
        const bend = { x: clamp(W.x, minX, maxX), y: turnY };
        return {
          points: [start, { x: start.x, y: turnY }, { x: end.x, y: turnY }, end],
          bend,
        };
      }

      if (sourceSide === 'TOP' && targetSide === 'TOP') {
        const turnY = Math.min(minY - stub, W.y);
        const bend = { x: clamp(W.x, minX, maxX), y: turnY };
        return {
          points: [start, { x: start.x, y: turnY }, { x: end.x, y: turnY }, end],
          bend,
        };
      }

      // 서로 반대 방향(외곽)으로 나가는 경우
      const sStubY = sourceSide === 'BOTTOM' ? start.y + stub : start.y - stub;
      const tStubY = targetSide === 'TOP' ? end.y - stub : end.y + stub;
      const passX = W.x < minX ? Math.min(minX - stub, W.x) : Math.max(maxX + stub, W.x);
      const bend = { x: passX, y: Math.round((sStubY + tStubY) / 2) };
      return {
        points: [start, { x: start.x, y: sStubY }, { x: passX, y: sStubY }, { x: passX, y: tStubY }, { x: end.x, y: tStubY }, end],
        bend,
      };
    }

    if (isSourceH && !isTargetH) {
      const bend = { x: W.x, y: W.y };
      return {
        points: [start, { x: W.x, y: start.y }, { x: W.x, y: W.y }, { x: end.x, y: W.y }, end],
        bend,
      };
    }

    // !isSourceH && isTargetH
    const bend = { x: W.x, y: W.y };
    return {
      points: [start, { x: start.x, y: W.y }, { x: W.x, y: W.y }, { x: W.x, y: end.y }, end],
      bend,
    };
  }

  if (isSourceH && isTargetH) {
    if (sourceSide === 'RIGHT' && targetSide === 'LEFT') {
      if (start.x < end.x - 24) {
        const midX = Math.round((start.x + end.x) / 2) + laneOffset;
        return {
          points: [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end],
          bend: { x: midX, y: Math.round((start.y + end.y) / 2) },
        };
      }
      const sStubX = start.x + stub;
      const tStubX = end.x - stub;
      const passY = start.y < end.y ? Math.min(start.y, end.y) - 40 - laneOffset : Math.max(start.y, end.y) + 40 + laneOffset;
      return {
        points: [start, { x: sStubX, y: start.y }, { x: sStubX, y: passY }, { x: tStubX, y: passY }, { x: tStubX, y: end.y }, end],
        bend: { x: Math.round((sStubX + tStubX) / 2), y: passY },
      };
    }
    if (sourceSide === 'LEFT' && targetSide === 'RIGHT') {
      if (start.x > end.x + 24) {
        const midX = Math.round((start.x + end.x) / 2) + laneOffset;
        return {
          points: [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end],
          bend: { x: midX, y: Math.round((start.y + end.y) / 2) },
        };
      }
      const sStubX = start.x - stub;
      const tStubX = end.x + stub;
      const passY = start.y < end.y ? Math.min(start.y, end.y) - 40 - laneOffset : Math.max(start.y, end.y) + 40 + laneOffset;
      return {
        points: [start, { x: sStubX, y: start.y }, { x: sStubX, y: passY }, { x: tStubX, y: passY }, { x: tStubX, y: end.y }, end],
        bend: { x: Math.round((sStubX + tStubX) / 2), y: passY },
      };
    }
    if (sourceSide === 'RIGHT' && targetSide === 'RIGHT') {
      const turnX = Math.max(start.x, end.x) + stub + 16 + laneOffset;
      return {
        points: [start, { x: turnX, y: start.y }, { x: turnX, y: end.y }, end],
        bend: { x: turnX, y: Math.round((start.y + end.y) / 2) },
      };
    }
    const turnX = Math.min(start.x, end.x) - stub - 16 - laneOffset;
    return {
      points: [start, { x: turnX, y: start.y }, { x: turnX, y: end.y }, end],
      bend: { x: turnX, y: Math.round((start.y + end.y) / 2) },
    };
  }

  if (!isSourceH && !isTargetH) {
    if (sourceSide === 'BOTTOM' && targetSide === 'TOP') {
      if (start.y < end.y - 24) {
        const midY = Math.round((start.y + end.y) / 2) + laneOffset;
        return {
          points: [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end],
          bend: { x: Math.round((start.x + end.x) / 2), y: midY },
        };
      }
      const sStubY = start.y + stub;
      const tStubY = end.y - stub;
      const passX = start.x < end.x ? Math.min(start.x, end.x) - 40 - laneOffset : Math.max(start.x, end.x) + 40 + laneOffset;
      return {
        points: [start, { x: start.x, y: sStubY }, { x: passX, y: sStubY }, { x: passX, y: tStubY }, { x: end.x, y: tStubY }, end],
        bend: { x: passX, y: Math.round((sStubY + tStubY) / 2) },
      };
    }
    if (sourceSide === 'TOP' && targetSide === 'BOTTOM') {
      if (start.y > end.y + 24) {
        const midY = Math.round((start.y + end.y) / 2) + laneOffset;
        return {
          points: [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end],
          bend: { x: Math.round((start.x + end.x) / 2), y: midY },
        };
      }
      const sStubY = start.y - stub;
      const tStubY = end.y + stub;
      const passX = start.x < end.x ? Math.min(start.x, end.x) - 40 - laneOffset : Math.max(start.x, end.x) + 40 + laneOffset;
      return {
        points: [start, { x: start.x, y: sStubY }, { x: passX, y: sStubY }, { x: passX, y: tStubY }, { x: end.x, y: tStubY }, end],
        bend: { x: passX, y: Math.round((sStubY + tStubY) / 2) },
      };
    }
    if (sourceSide === 'BOTTOM' && targetSide === 'BOTTOM') {
      const turnY = Math.max(start.y, end.y) + stub + 16 + laneOffset;
      return {
        points: [start, { x: start.x, y: turnY }, { x: end.x, y: turnY }, end],
        bend: { x: Math.round((start.x + end.x) / 2), y: turnY },
      };
    }
    const turnY = Math.min(start.y, end.y) - stub - 16 - laneOffset;
    return {
      points: [start, { x: start.x, y: turnY }, { x: end.x, y: turnY }, end],
      bend: { x: Math.round((start.x + end.x) / 2), y: turnY },
    };
  }

  // One horizontal, one vertical
  if (sourceSide === 'RIGHT') {
    if (targetSide === 'TOP') {
      if (end.x >= start.x + 16 && end.y >= start.y - 16) {
        return {
          points: [start, { x: end.x, y: start.y }, end],
          bend: { x: end.x, y: start.y },
        };
      }
      const sX = start.x + stub + laneOffset;
      const tY = end.y - stub - laneOffset;
      return {
        points: [start, { x: sX, y: start.y }, { x: sX, y: tY }, { x: end.x, y: tY }, end],
        bend: { x: sX, y: tY },
      };
    }
    // targetSide === 'BOTTOM'
    if (end.x >= start.x + 16 && end.y <= start.y + 16) {
      return {
        points: [start, { x: end.x, y: start.y }, end],
        bend: { x: end.x, y: start.y },
      };
    }
    const sX = start.x + stub + laneOffset;
    const tY = end.y + stub + laneOffset;
    return {
      points: [start, { x: sX, y: start.y }, { x: sX, y: tY }, { x: end.x, y: tY }, end],
      bend: { x: sX, y: tY },
    };
  }

  if (sourceSide === 'LEFT') {
    if (targetSide === 'TOP') {
      if (end.x <= start.x - 16 && end.y >= start.y - 16) {
        return {
          points: [start, { x: end.x, y: start.y }, end],
          bend: { x: end.x, y: start.y },
        };
      }
      const sX = start.x - stub - laneOffset;
      const tY = end.y - stub - laneOffset;
      return {
        points: [start, { x: sX, y: start.y }, { x: sX, y: tY }, { x: end.x, y: tY }, end],
        bend: { x: sX, y: tY },
      };
    }
    // targetSide === 'BOTTOM'
    if (end.x <= start.x - 16 && end.y <= start.y + 16) {
      return {
        points: [start, { x: end.x, y: start.y }, end],
        bend: { x: end.x, y: start.y },
      };
    }
    const sX = start.x - stub - laneOffset;
    const tY = end.y + stub + laneOffset;
    return {
      points: [start, { x: sX, y: start.y }, { x: sX, y: tY }, { x: end.x, y: tY }, end],
      bend: { x: sX, y: tY },
    };
  }

  if (sourceSide === 'BOTTOM') {
    if (targetSide === 'LEFT') {
      if (end.y >= start.y + 16 && end.x >= start.x - 16) {
        return {
          points: [start, { x: start.x, y: end.y }, end],
          bend: { x: start.x, y: end.y },
        };
      }
      const sY = start.y + stub + laneOffset;
      const tX = end.x - stub - laneOffset;
      return {
        points: [start, { x: start.x, y: sY }, { x: tX, y: sY }, { x: tX, y: end.y }, end],
        bend: { x: tX, y: sY },
      };
    }
    // targetSide === 'RIGHT'
    if (end.y >= start.y + 16 && end.x <= start.x + 16) {
      return {
        points: [start, { x: start.x, y: end.y }, end],
        bend: { x: start.x, y: end.y },
      };
    }
    const sY = start.y + stub + laneOffset;
    const tX = end.x + stub + laneOffset;
    return {
      points: [start, { x: start.x, y: sY }, { x: tX, y: sY }, { x: tX, y: end.y }, end],
      bend: { x: tX, y: sY },
    };
  }

  // sourceSide === 'TOP'
  if (targetSide === 'LEFT') {
    if (end.y <= start.y - 16 && end.x >= start.x - 16) {
      return {
        points: [start, { x: start.x, y: end.y }, end],
        bend: { x: start.x, y: end.y },
      };
    }
    const sY = start.y - stub - laneOffset;
    const tX = end.x - stub - laneOffset;
    return {
      points: [start, { x: start.x, y: sY }, { x: tX, y: sY }, { x: tX, y: end.y }, end],
      bend: { x: tX, y: sY },
    };
  }
  // targetSide === 'RIGHT'
  if (end.y <= start.y - 16 && end.x <= start.x + 16) {
    return {
      points: [start, { x: start.x, y: end.y }, end],
      bend: { x: start.x, y: end.y },
    };
  }
  const sY = start.y - stub - laneOffset;
  const tX = end.x + stub + laneOffset;
  return {
    points: [start, { x: start.x, y: sY }, { x: tX, y: sY }, { x: tX, y: end.y }, end],
    bend: { x: tX, y: sY },
  };
}

export function architectureEdgeRoute(
  edge: ArchitectureEdge,
  from: ArchBox,
  to: ArchBox,
  options?: {
    sourceOffset?: { x?: number; y?: number };
    targetOffset?: { x?: number; y?: number };
    lane?: number;
  }
) {
  const dx = to.x + to.width / 2 - from.x - from.width / 2;
  const dy = to.y + to.height / 2 - from.y - from.height / 2;
  const sourceSide = edge.sourceSide ?? (Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'RIGHT' : 'LEFT') : dy >= 0 ? 'BOTTOM' : 'TOP');
  const targetSide = edge.targetSide ?? (Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'LEFT' : 'RIGHT') : dy >= 0 ? 'TOP' : 'BOTTOM');

  const start = architectureAnchor(from, sourceSide);
  const end = architectureAnchor(to, targetSide);

  if (options?.sourceOffset) {
    start.x += options.sourceOffset.x ?? 0;
    start.y += options.sourceOffset.y ?? 0;
  }
  if (options?.targetOffset) {
    end.x += options.targetOffset.x ?? 0;
    end.y += options.targetOffset.y ?? 0;
  }

  const { points, bend } = computeOrthogonalPoints(
    start,
    sourceSide,
    end,
    targetSide,
    options?.lane ?? 0,
    edge.waypoint
  );
  const path = formatOrthogonalPath(points);
  return { path, start, end, bend, label: { x: bend.x, y: bend.y - 8 } };
}
