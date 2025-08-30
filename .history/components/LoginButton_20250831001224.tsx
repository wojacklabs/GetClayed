import { usePrivy } from '@privy-io/react-auth';
import { LogIn, LogOut, User } from 'lucide-react';

export default function LoginButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  
  if (!ready) {
    return (
      <button 
        className="px-4 py-2 bg-gray-600 text-white rounded-lg opacity-50 cursor-not-allowed"
        disabled
      >
        <User className="w-5 h-5" />
      </button>
    );
  }
  
  if (authenticated) {
    return (
      <button
        onClick={logout}
        className="p-3 rounded-lg bg-white hover:bg-red-50 text-red-500 transition-all"
        title="Logout"
      >
        <LogOut size={20} />
      </button>
    );
  }
  
  return (
    <button
      onClick={login}
      className="p-3 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-all"
      title="Login"
    >
      <LogIn size={20} />
    </button>
  );
}
