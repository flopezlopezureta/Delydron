interface LogoProps {
  // Sidebar header wants icon+text; a collapsed rail or a small favicon-like
  // use only wants the mark.
  variant?: 'full' | 'mark';
  className?: string;
}

// The source file (public/logo.png) has an opaque white square background,
// so it sits inside a small white badge rather than directly on the
// sidebar's dark background — placed straight on slate-900 it would show
// as a jarring white box instead of blending in.
export function Logo({ variant = 'full', className = '' }: LogoProps) {
  const mark = (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
      <img src="/logo.png" alt="Delydrone" className="h-7 w-7 object-contain" />
    </div>
  );

  if (variant === 'mark') {
    return <div className={className}>{mark}</div>;
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {mark}
      <span className="text-lg font-semibold tracking-tight text-white">Delydrone</span>
    </div>
  );
}
