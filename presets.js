// Aspect and rendering budget are independent: an artistic look should never force Ultra quality.
export const LOOKS = Object.freeze({
  observatory: {
    description: 'Astrofotografía cálida y contenida.',
    colors: ['#fff1ce', '#f0a45e', '#ae4e32', '#5b2928', '#1b121c'],
    bloom: 0.52, lensing: 0.075, exposure: 1.05, aberration: 0.0012, density: 1.05, stars: 0.7
  },
  event: {
    description: 'Contraste ámbar y plasma más intenso.',
    colors: ['#fff7e0', '#ffb04d', '#dd5a27', '#70251d', '#241015'],
    bloom: 0.78, lensing: 0.105, exposure: 1.13, aberration: 0.0018, density: 1.2, stars: 0.54
  },
  deep: {
    description: 'Sombras frías, con el núcleo aún incandescente.',
    colors: ['#fff8e8', '#edb78b', '#ac6876', '#494c85', '#101c36'],
    bloom: 0.57, lensing: 0.09, exposure: 1.0, aberration: 0.002, density: 1.08, stars: 0.82
  },
  noir: {
    description: 'Minimalista, oscuro y de bajo resplandor.',
    colors: ['#e5d8c0', '#ad8268', '#664b42', '#322a2a', '#0d0c10'],
    bloom: 0.3, lensing: 0.08, exposure: 0.83, aberration: 0.0005, density: 0.9, stars: 0.4
  }
});

export const QUALITY = Object.freeze({
  low:    { stars: 25000,  dpr: 1.0, bloom: false, label: 'Baja · ahorro de batería' },
  medium: { stars: 55000,  dpr: 1.25, bloom: true, label: 'Media · equilibrada' },
  high:   { stars: 100000, dpr: 1.5, bloom: true, label: 'Alta · más detalle' },
  ultra:  { stars: 150000, dpr: 2.0, bloom: true, label: 'Ultra · exige más GPU' }
});

export function autoQuality() {
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (memory <= 2 || cores <= 2) return 'low';
  return mobile ? 'medium' : 'high';
}
