import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: loginError } = await login(email, password);
    if (loginError) {
      setError(loginError.message);
    } else {
      // Successful login – redirect to the page the user originally wanted
      navigate(from, { replace: true });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-night-sky relative">
      {/* dark overlay */}
      <div className="absolute inset-0 bg-black/50" />
      {/* subtle purple ambient glow */}
      <div className="absolute inset-0 bg-purple-500/5 rounded-3xl blur-3xl" />
      <div className="relative max-w-lg w-full bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-10 flex flex-col items-center">
        <div className="flex flex-col items-center mb-6 z-10">
          <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true" className="text-purple-500">
            <circle cx="16" cy="16" r="15" fill="#0A0F1A" stroke="#6B46C1" strokeWidth="1.5" />
            <path d="M8 20 A10 10 0 0 1 24 20" fill="none" stroke="#232E45" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M8 20 A10 10 0 0 1 18 10.6" fill="none" stroke="#6B46C1" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="16" y1="20" x2="20" y2="13" stroke="#E5E9F0" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="16" cy="20" r="1.6" fill="#E5E9F0" />
          </svg>
          <h1 className="mt-4 text-3xl font-bold text-purple-400">Welcome back</h1>
          <p className="mt-1 text-sm text-white/40">Sign in to your FuelGuard dashboard</p>
        </div>
        {error && (
          <div className="mb-4 w-full rounded bg-red-600 px-3 py-2 text-sm text-white">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 w-full">
          <div>
            <label className="block text-sm font-medium text-white/40" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/40" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 py-3 font-semibold text-white hover:from-purple-500 hover:to-violet-400 disabled:opacity-50 shadow-lg shadow-purple-900/20 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
);
}
