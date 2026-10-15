import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'RepairMe One · Company workspace',
  description: 'One workspace for the people, projects, and operations behind RepairMe.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
