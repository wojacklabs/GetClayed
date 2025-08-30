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
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-300">
          {user?.email?.address || user?.wallet?.address?.slice(0, 6) + '...' + user?.wallet?.address?.slice(-4) || 'User'}
        </span>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden sm:inline">로그아웃</span>
        </button>
      </div>
    );
  }
  
  return (
    <button
      onClick={login}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
    >
      <LogIn className="w-5 h-5" />
      <span className="hidden sm:inline">로그인</span>
    </button>
  );
}
