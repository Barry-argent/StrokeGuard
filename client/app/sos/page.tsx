import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Sidebar } from '@/components/dashboard/Sidebar';

export default async function SOSPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const userName = session.user.name || 'User';
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activePage="sos" userName={userName} userInitials={userName.slice(0,2).toUpperCase()} />
      <div className="flex-1 flex flex-col overflow-y-auto" style={{ backgroundColor: '#FEF2F2' }}>
        <div className="max-w-2xl mx-auto px-6 py-10 w-full">
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'DM Sans, sans-serif', color: '#991B1B' }}>Emergency SOS</h1>
          <p className="text-sm mb-8" style={{ fontFamily: 'DM Sans, sans-serif', color: '#B91C1C' }}>
            Emergency mode activated. Help is on the way.
          </p>

          <div className="bg-white rounded-2xl p-8 border-4 border-red-500 text-center animate-pulse" style={{ boxShadow: '0 10px 40px rgba(239, 68, 68, 0.3)' }}>
             <p className="text-2xl font-bold text-red-600 mb-4" style={{ fontFamily: 'DM Sans, sans-serif' }}>PROTOCOL INITIATED</p>
             <p className="text-[15px] text-gray-700 leading-relaxed" style={{ fontFamily: 'DM Sans, sans-serif' }}>
               Your emergency contacts have been notified with your current health summary and GPS location. 
               <br/><br/>
               <span className="font-semibold text-red-800">Please remain calm. Help is on the way.</span>
             </p>
          </div>
          
          <div className="mt-8 text-center">
             <button 
               onClick={() => window.location.href = 'tel:911'}
               className="bg-red-700 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-red-800 transition-colors shadow-lg"
             >
               Call 911 Directly
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
