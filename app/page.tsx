import dynamic from 'next/dynamic';

// Dynamically import the main app component with SSR disabled
// This prevents "window is not defined" errors from MiniKit
const MindalikeApp = dynamic(() => import('@/components/MindalikeApp'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-pearl-white-50">
      <div className="flex flex-col items-center gap-4">
        <div className="spinner" />
        <p className="text-gray-500 text-sm">Loading Mindalike...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <MindalikeApp />;
}
