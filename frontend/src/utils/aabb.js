/**
 * Axis-Aligned Bounding Box helpers for Konva world coordinates.
 *
 * Konva Groups rotate CW around their local (0,0) — the top-left corner of the
 * Rect by default (no offsetX/offsetY). These formulas map the rotated corners
 * back to an AABB in world space for the four cardinal angles we use.
 *
 * Only 0 / 90 / 180 / 270° are supported — warehouse locations don't need
 * arbitrary angles.
 */

export function getAABB(x, y, w, h, rot) {
  const r = ((rot ?? 0) % 360 + 360) % 360
  if (r === 0)   return { x1: x,     y1: y,     x2: x + w, y2: y + h }
  if (r === 90)  return { x1: x,     y1: y - w, x2: x + h, y2: y }
  if (r === 180) return { x1: x - w, y1: y - h, x2: x,     y2: y }
  /* r === 270 */ return { x1: x - h, y1: y,     x2: x,     y2: y + w }
}

export function aabbOverlap(a, b) {
  const aa = getAABB(a.x, a.y, a.w, a.h, a.rot)
  const bb = getAABB(b.x, b.y, b.w, b.h, b.rot)
  return aa.x1 < bb.x2 && aa.x2 > bb.x1 && aa.y1 < bb.y2 && aa.y2 > bb.y1
}

export function isContainedIn(inner, zone) {
  const aa = getAABB(inner.x, inner.y, inner.w, inner.h, inner.rot)
  return (
    aa.x1 >= zone.x && aa.y1 >= zone.y &&
    aa.x2 <= zone.x + zone.width && aa.y2 <= zone.y + zone.height
  )
}
