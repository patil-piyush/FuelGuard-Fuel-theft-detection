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
    <div className="flex h-screen items-center justify-center bg-ink text-text">
      <div className="w-full max-w-md rounded-lg bg-panel p-8 shadow">
        <h1 className="mb-6 text-2xl font-bold text-amber">Sign In</h1>
        {error && (
          <div className="mb-4 rounded bg-red-600 px-3 py-2 text-sm text-white">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 bg-ink px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-amber"
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 bg-ink px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-amber"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-amber px-4 py-2 font-medium text-black hover:bg-amber/80 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
