import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Link2,
  MousePointerClick,
  Trash2,
  Power,
  ExternalLink,
  Search,
  Check,
  RefreshCw,
  Lock,
  Crop,
  Maximize2
} from 'lucide-react';
import { ImageLinkItem, OverallStats } from '../types.js';

export const AdminView: React.FC = () => {
  const [adminKey, setAdminKey] = useState(() => {
    return localStorage.getItem('imagelink_admin_secret') || '';
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [stats, setStats] = useState<OverallStats | null>(null);
  const [links, setLinks] = useState<ImageLinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const fetchAdminData = async (secret: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${secret}` }
      });
      if (!res.ok) {
        throw new Error('Invalid ADMIN_SECRET');
      }
      const data = await res.json();
      setStats(data.stats);
      setLinks(data.links);
      setIsAuthenticated(true);
      localStorage.setItem('imagelink_admin_secret', secret);
    } catch (err: any) {
      setIsAuthenticated(false);
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) {
      fetchAdminData(adminKey);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) return;
    fetchAdminData(adminKey.trim());
  };

  const handleToggleStatus = async (link: ImageLinkItem) => {
    const nextStatus = link.status === 'active' ? 'disabled' : 'active';
    try {
      setActionLoadingId(link.id);
      const res = await fetch(`/api/image-links/${link.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) throw new Error('Status update failed');

      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, status: nextStatus } : l))
      );
      fetchAdminData(adminKey);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (link: ImageLinkItem) => {
    if (!window.confirm(`Permanently delete Image Link "${link.shortId}" from database?`)) {
      return;
    }
    try {
      setActionLoadingId(link.id);
      const res = await fetch(`/api/image-links/${link.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminKey}` }
      });
      if (!res.ok) throw new Error('Failed to delete link');

      setLinks((prev) => prev.filter((l) => l.id !== link.id));
      fetchAdminData(adminKey);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('imagelink_admin_secret');
    setIsAuthenticated(false);
    setAdminKey('');
  };

  const filteredLinks = links.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.shortId.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      l.destinationUrl.toLowerCase().includes(q)
    );
  });

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[75vh] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/90 p-8 shadow-2xl backdrop-blur-md">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800 text-sky-400 mb-4 border border-neutral-700">
            <Lock className="h-5 w-5" />
          </div>

          <h2 className="text-center text-lg font-bold text-white font-display">
            Administrator Authentication
          </h2>
          <p className="mt-1 text-center text-xs text-neutral-400">
            Enter the ADMIN_SECRET to access administration, link governance, and telemetry.
          </p>

          {authError && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-950/40 p-2.5 text-xs text-red-300 text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="admin-secret" className="block text-xs font-semibold text-neutral-300 mb-1">
                ADMIN_SECRET
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                  <Key className="h-4 w-4" />
                </div>
                <input
                  id="admin-secret"
                  type="password"
                  placeholder="Enter ADMIN_SECRET..."
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  required
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2.5 pl-9 pr-3 text-xs text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sky-600 hover:bg-sky-500 py-2.5 text-xs font-semibold text-white transition-colors"
            >
              {loading ? 'Authenticating...' : 'Unlock Admin Console'}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setAdminKey('admin12345');
                  fetchAdminData('admin12345');
                }}
                className="text-[11px] text-neutral-400 hover:text-sky-300 underline"
              >
                Use default development secret (admin12345)
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-800 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-sky-400" />
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl font-display">
              Administration & Link Governance
            </h1>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Platform telemetry, server status, and abusive destination link deactivation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchAdminData(adminKey)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/20 border border-red-900/30 rounded-lg transition-colors"
          >
            Lock Console
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Total Links</span>
              <Link2 className="h-3.5 w-3.5" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
              {stats.totalLinks}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Total Clicks</span>
              <MousePointerClick className="h-3.5 w-3.5" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-sky-400 tabular-nums">
              {stats.totalClicks}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Active Links</span>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
              {stats.activeLinks}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Disabled Links</span>
              <Power className="h-3.5 w-3.5 text-red-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-neutral-400 tabular-nums">
              {stats.disabledLinks}
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-sm mb-4">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
        <input
          type="text"
          placeholder="Filter by short ID, description or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2 pl-9 pr-3 text-xs text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      {/* Table of Links */}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="border-b border-neutral-800 bg-neutral-950/80 text-[11px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="py-3 px-4">Image Card</th>
                <th className="py-3 px-4">Short Link</th>
                <th className="py-3 px-4">Redirect Destination</th>
                <th className="py-3 px-4 text-right">Clicks</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {filteredLinks.map((link) => {
                const isActive = link.status === 'active';

                return (
                  <tr key={link.id} className="hover:bg-neutral-900/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
                          <img
                            src={link.processedImageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 max-w-xs">
                          <div className="font-semibold text-white truncate">{link.description}</div>
                          <div className="text-[11px] text-neutral-500 font-mono">
                            {link.framingMode === 'crop_16_9' ? '16:9 Crop' : 'Full Image'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <a
                        href={`/i/${link.shortId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <span>/i/{link.shortId}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>

                    <td className="py-3 px-4">
                      <div className="max-w-xs truncate font-mono text-[11px] text-neutral-400" title={link.destinationUrl}>
                        {link.destinationUrl}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-medium text-white tabular-nums">
                      {link.clickCount}
                    </td>

                    <td className="py-3 px-4 text-center">
                      {isActive ? (
                        <span className="text-[11px] font-semibold text-emerald-400">Active</span>
                      ) : (
                        <span className="text-[11px] font-semibold text-red-400">Disabled</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          disabled={actionLoadingId === link.id}
                          onClick={() => handleToggleStatus(link)}
                          className={`rounded p-1.5 transition-colors ${
                            isActive
                              ? 'text-neutral-400 hover:text-white bg-neutral-800'
                              : 'text-emerald-400 hover:text-emerald-300 bg-neutral-800'
                          }`}
                          title={isActive ? 'Disable Link' : 'Enable Link'}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>

                        <button
                          disabled={actionLoadingId === link.id}
                          onClick={() => handleDelete(link)}
                          className="rounded p-1.5 bg-neutral-800 text-neutral-400 hover:text-red-400 transition-colors"
                          title="Delete from database"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
