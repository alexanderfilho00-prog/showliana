// The signature: a small hand-drawn cat. Strokes are deliberately a little
// uneven so it reads as a pen sketch rather than an icon.
export function Cat({
  size = 64,
  className,
  sleepy = false,
  title,
}: {
  size?: number;
  className?: string;
  sleepy?: boolean;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* head */}
      <path d="M18.4 26.6c-.9-5.4-.3-10.6 1.9-15.3l5.1 6.1c3.3-1.2 6.8-1.3 10.1-.2l5.3-6.3c2 4.8 2.6 10.3 1.4 15.6-1.3 5.4-5.7 8.6-11.6 8.6-6.3 0-11.2-3.2-12.2-8.5z" />
      {/* body */}
      <path d="M21.6 32.9c-5 5.6-6.6 14-3.6 21.4 1.3 3.2 4.6 4.3 12.3 4.3 7.9 0 11.4-1.1 12.6-4.6 2.6-7.4.9-15.6-3.8-21.1" />
      {/* tail */}
      <path d="M42.9 54.2c6.4.6 10.6-2.3 10.1-7.6-.3-3.1-3.6-4.4-5.4-2.2" />
      {/* front paws */}
      <path d="M26.4 58.3c-.2-1.9 0-3.4.6-4.6M34.1 58.4c.3-1.8.1-3.3-.5-4.6" />
      {/* eyes */}
      {sleepy ? (
        <path d="M23.9 25.3c1.2 1 2.7 1 3.9 0M32.6 25.3c1.2 1 2.7 1 3.9 0" />
      ) : (
        <path d="M24 25.6c1.1-1.5 2.9-1.6 4 0M32.5 25.6c1.1-1.5 2.9-1.6 4 0" />
      )}
      {/* nose and mouth */}
      <path d="M29.3 28.6l1 1.1 1-1.1M30.3 29.7c-.4 1.2-1.4 1.6-2.4 1.1M30.3 29.7c.4 1.2 1.4 1.6 2.4 1.1" strokeWidth={1.3} />
      {/* whiskers */}
      <path d="M17.6 27.9l-5.4-1.1M17.9 30.2l-5.2 1.4M42.7 27.9l5.4-1.2M42.4 30.3l5.2 1.3" strokeWidth={1.1} />
      {/* blush */}
      <circle cx="22.6" cy="29.2" r="1.6" fill="var(--sl-lilac)" stroke="none" />
      <circle cx="37.9" cy="29.2" r="1.6" fill="var(--sl-lilac)" stroke="none" />
    </svg>
  );
}
