import { useState } from 'react';
import { triggerSOS } from '@/lib/actions/emergency';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface FloatingSOSButtonProps {
  firstContactPhone?: string;
}

export function FloatingSOSButton({ firstContactPhone }: FloatingSOSButtonProps) {
  const router = useRouter();
  const [isActivating, setIsActivating] = useState(false);

  const handleSOS = async () => {
    if (isActivating) return;
    
    const confirmSOS = window.confirm("Are you sure you want to trigger an Emergency SOS? This will notify your emergency contacts immediately.");
    if (!confirmSOS) return;

    setIsActivating(true);

    try {
      // 1. Attempt to get location (optional, but better for alerts)
      let latitude: number | null = null;
      let longitude: number | null = null;

      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch (e) {
          console.warn("Location access denied or timed out for SOS.");
        }
      }

      // 2. Call backend trigger
      const result = await triggerSOS(latitude, longitude);

      if (result.success) {
        toast.success("Emergency SOS triggered successfully.");
        router.push('/sos');
      } else {
        toast.error(result.error || "Failed to trigger SOS.");
        setIsActivating(false);
      }

    } catch (err) {
      toast.error("An unexpected error occurred while triggering SOS.");
      setIsActivating(false);
    }
  };

  return (
    <button
      className="fixed bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 z-50 disabled:opacity-80"
      style={{ backgroundColor: '#EF4444', boxShadow: '0 6px 20px rgba(239, 68, 68, 0.40)' }}
      onClick={handleSOS}
      disabled={isActivating}
      title={isActivating ? 'Activating...' : 'Trigger Emergency SOS'}
    >
      {isActivating ? (
        <Loader2 size={24} className="text-white animate-spin" />
      ) : (
        <span className="text-[13px] font-bold text-white" style={{ fontFamily: 'Space Mono, monospace' }}>SOS</span>
      )}
    </button>
  );
}
