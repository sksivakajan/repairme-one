export type PerformanceInput = {
  agreedWeight: number;
  acceptedWeight: number;
  onTimeWeight: number;
  quality: { weight: number; rating: number }[];
  teamwork: number | null;
};
export function calculatePerformance(input: PerformanceInput) {
  const { agreedWeight, acceptedWeight, onTimeWeight, quality, teamwork } = input;
  if (
    [agreedWeight, acceptedWeight, onTimeWeight].some((n) => !Number.isFinite(n) || n < 0) ||
    onTimeWeight > acceptedWeight ||
    quality.some(
      (q) =>
        !Number.isFinite(q.weight) ||
        q.weight <= 0 ||
        q.rating < 0 ||
        q.rating > 5 ||
        !Number.isFinite(q.rating),
    ) ||
    (teamwork !== null && (!Number.isFinite(teamwork) || teamwork < 0 || teamwork > 5))
  )
    throw new Error('Invalid performance evidence');
  const qualityWeight = quality.reduce((a, q) => a + q.weight, 0);
  const delivery = agreedWeight > 0 ? Math.min(acceptedWeight / agreedWeight, 1) * 40 : null;
  const qualityScore =
    qualityWeight > 0 && Math.abs(qualityWeight - acceptedWeight) < 1e-8
      ? (quality.reduce((a, q) => a + q.weight * q.rating, 0) / qualityWeight / 5) * 30
      : null;
  const reliability = acceptedWeight > 0 ? (onTimeWeight / acceptedWeight) * 20 : null;
  const teamworkScore = teamwork === null ? null : (teamwork / 5) * 10;
  const values = [delivery, qualityScore, reliability, teamworkScore];
  return {
    formulaVersion: '1.0',
    delivery,
    quality: qualityScore,
    reliability,
    teamwork: teamworkScore,
    total: values.every((v) => v !== null)
      ? values.reduce<number>((a, v) => a + (v ?? 0), 0)
      : null,
    status: values.some((v) => v === null) ? 'Insufficient Evidence' : 'Complete',
  };
}
