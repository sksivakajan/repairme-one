import Image from 'next/image';
export function BrandLogo() {
  return (
    <Image
      src="/brand/repairme-logo-transparent.png"
      alt="RepairMe — Fixed. Fast. Trusted."
      width={438}
      height={219}
      className="brand-logo"
      preload
    />
  );
}
