import { useAuth } from '../../../contexts/AuthContext';
import { Check, X } from 'lucide-react';
import { useState } from 'react';

// Mock profiles data based on what was used in Conversations
const MOCK_PROFILES = [
  { id: '1', name: 'Ana Gómez', inUse: false },
  { id: '2', name: 'Carlos Ruiz', inUse: true }, // Simulando que alguien ya está usándolo
  { id: '3', name: 'Maria Torres', inUse: false },
  { id: '4', name: 'David Silva', inUse: false },
  { id: '5', name: 'Laura Vega', inUse: false },
];

export const ProfileSelection = () => {
  const { selectProfile } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelect = (profile: any) => {
    if (profile.inUse) {
      setErrorMsg('Este perfil ya está en uso por otro dispositivo. Selecciona otro.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    setSelected(profile.id);
    
    // Simulate API call to mark profile as in use
    setTimeout(() => {
      selectProfile(profile);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-6 antialiased">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent-500/10 via-dark-bg to-dark-bg pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-2">
          ¿Quién está utilizando el sistema?
        </h1>
        <p className="text-gray-400 font-medium tracking-wide mb-12 text-center">
          Selecciona tu perfil de equipo para continuar
        </p>

        {errorMsg && (
          <div className="mb-6 flex items-center gap-3 px-5 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium animate-in fade-in duration-200">
            <X className="w-4 h-4 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-6">
          {MOCK_PROFILES.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleSelect(profile)}
              disabled={profile.inUse}
              className={`group flex flex-col items-center gap-4 transition-all duration-300 outline-none
                ${profile.inUse ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 cursor-pointer'}
              `}
            >
              <div className={`relative w-32 h-32 md:w-40 md:h-40 rounded-3xl flex items-center justify-center text-4xl font-black shadow-2xl transition-all duration-300
                ${selected === profile.id ? 'bg-accent-500 text-black shadow-accent-500/20 scale-105' : 'bg-[#1c212b] text-white border-2 border-transparent group-hover:border-accent-500/50'}
              `}>
                {profile.name.charAt(0)}
                
                {profile.inUse && (
                  <div className="absolute inset-0 rounded-3xl bg-black/50 backdrop-blur-[2px] flex items-center justify-center flex-col">
                    <span className="text-[10px] bg-red-500/20 text-red-500 px-3 py-1 rounded-full font-bold tracking-widest uppercase border border-red-500/20">
                      En Línea
                    </span>
                  </div>
                )}

                {selected === profile.id && (
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-white dark:bg-accent-500 text-black dark:text-white rounded-full flex items-center justify-center shadow-lg border-2 border-dark-bg">
                    <Check className="w-5 h-5" />
                  </div>
                )}
              </div>
              <span className={`text-lg font-bold tracking-tight transition-colors duration-300 
                ${selected === profile.id ? 'text-accent-500' : 'text-gray-300 group-hover:text-white'}
              `}>
                {profile.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
