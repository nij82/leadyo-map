export function sameNaverSite(
  first: { name: string; address: string },
  second: { name: string; address: string },
) {
  const compact = (value: string) =>
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^가-힣a-z0-9]/g, "");
  if (compact(first.name) !== compact(second.name)) return false;
  if (compact(first.address) === compact(second.address)) return true;
  const localities = (value: string): string[] =>
    (value.match(/[가-힣]+(?:시|군|구|동|읍|면)(?=\s|$|[()])/g) || []).filter(
      (x) => !x.endsWith("지구"),
    );
  const a = localities(first.address),
    b = localities(second.address);
  if (
    !a.length ||
    !b.length ||
    a.some((x) => !b.includes(x)) ||
    b.some((x) => !a.includes(x))
  )
    return false;
  const parcel = (value: string): string[] =>
    value.match(/(?<!\d)\d{1,4}-\d{1,4}(?!\d)/g) || [];
  const blocks = (value: string): string[] =>
    value
      .toUpperCase()
      .match(/(?:[A-Z]?\d+)\s*(?:블록|BL\b)/g)
      ?.map((x) => x.replace(/\s|블록|BL/g, "")) || [];
  const ab = blocks(first.address),
    bb = blocks(second.address);
  if (
    ab.length &&
    bb.length &&
    (ab.some((x) => !bb.includes(x)) || bb.some((x) => !ab.includes(x)))
  )
    return false;
  if (parcel(first.address).some((x) => parcel(second.address).includes(x)))
    return true;
  return (
    first.address.includes("풍무역세권") &&
    second.address.includes("풍무역세권") &&
    ab.length === 1 &&
    bb.length === 1 &&
    ab[0] === bb[0]
  );
}
