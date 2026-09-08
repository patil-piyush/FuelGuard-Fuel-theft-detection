import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotAuthorized() {
  const navigate = useNavigate();
  return (
    <div className="flex h-screen items-center justify-center bg-ink text-text">
      <div className="max-w-md rounded bg-panel p-8 text-center shadow">
        <h1 className="mb-4 text-2xl font-bold text-purple-500">Access Denied</h1>
        <p className="mb-6">You do not have permission to view this page.</p>
        <button
          onClick={() => navigate('/')}
          className="rounded bg-purple-600 px-4 py-2 font-medium text-black hover:bg-purple-500"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
