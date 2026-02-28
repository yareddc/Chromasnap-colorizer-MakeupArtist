import React, { useState } from 'react';
import { API_ENDPOINTS } from '../services/apiConfig';

type AdminLoginPageProps = {
  onBack: () => void;
};

const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onBack }) => {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [admins, setAdmins] = useState<string[]>([]);
  const [subscribers, setSubscribers] = useState<string[]>([]);

  const handleAdminLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.ADMIN_USERNAMES, {
        headers: {
          'x-admin-api-key': apiKey.trim(),
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Invalid admin API key');
      }

      setAdmins((data.admins || []) as string[]);
      setSubscribers((data.subscribers || []) as string[]);
    } catch (err: any) {
      setError(err.message || 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-white">Developer Admin Login</h2>
            <button
              onClick={onBack}
              className="px-3 py-2 text-xs rounded-xl border border-slate-700 text-slate-300 hover:border-indigo-400 hover:text-white"
            >
              Back
            </button>
          </div>

          <p className="text-xs text-slate-400">This page is developer-only and uses the admin API key for access.</p>

          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Enter admin API key"
              className="flex-1 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleAdminLogin}
              disabled={loading || !apiKey.trim()}
              className="px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Login'}
            </button>
          </div>

          {error && (
            <div className="text-xs text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {(admins.length > 0 || subscribers.length > 0) && (
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs font-semibold text-slate-300 mb-2">Admins ({admins.length})</div>
                <div className="text-xs text-slate-400 break-words">{admins.join(', ') || 'None'}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-xs font-semibold text-slate-300 mb-2">Subscribers ({subscribers.length})</div>
                <div className="text-xs text-slate-400 break-words">{subscribers.join(', ') || 'None'}</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminLoginPage;
