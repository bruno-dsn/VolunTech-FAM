export function ButterflyMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Borboleta VolunTech" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 31C27 13 12 8 8 17c-3 9 9 17 24 14Z" fill="#e6247a" />
      <path d="M32 31C37 13 52 8 56 17c3 9-9 17-24 14Z" fill="#e6247a" />
      <path d="M31 35C20 34 11 41 16 51c4 8 14 3 15-14Z" fill="#9f1763" />
      <path d="M33 35c11-1 20 6 15 16-4 8-14 3-15-14Z" fill="#9f1763" />
      <circle cx="19" cy="20" r="2.6" fill="#f6b4d0" />
      <circle cx="45" cy="20" r="2.6" fill="#f6b4d0" />
      <rect x="29.6" y="22" width="4.8" height="28" rx="2.4" fill="#3d0f2c" />
      <path d="M31 23c-1-6-4-9-8-10M33 23c1-6 4-9 8-10" fill="none" stroke="#3d0f2c" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
