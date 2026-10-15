'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="setup-page" role="alert">
      <h1>We couldn’t open this workspace.</h1>
      <p>
        Check your connection and try again. If the problem continues, contact your system
        administrator.
      </p>
      <button className="button yellow full" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
