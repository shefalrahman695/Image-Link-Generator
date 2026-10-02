import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Power,
  Search,
  QrCode,
  AlertCircle,
  RefreshCw,
  Plus,
  BarChart2,
  X
} from 'lucide-react';
import { ImageLinkItem, ClickEventItem, OverallStats } from '../types.js';

interface DashboardViewProps {
  onCreateNew: () => void;
  onOpenCrawlerTest?: (shortId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onCreateNew,
  onOpenCrawlerTest
}) => {
  const [links, setLinks] = useState<ImageLinkItem[]>([]);
  const [stats, setStats] = useState<OverallStats>({
    totalLinks: 0,
    totalClicks: 0,
    activeLinks: 0,
    disabledLinks: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [activeQrLink, setActiveQrLink] = useState<ImageLinkItem | null>(null);

  // Detailed Analytics Modal
  const [statsModalLink, setStatsModalLink] = useState<ImageLinkItem | null>(null);
  const [clickEvents, setClickEvents] = useState<ClickEventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/image-links');
      if (!res.ok) throw new Error('Failed to load Image Links');
      const data = await res.json();
      setLinks(data.links || []);
      setStats(data.stats || {
        totalLinks: 0,
        totalClicks: 0,
        activeLinks: 0,
        disabledLinks: 0
      });
    } catch (err: any) {
      setError(err.message || 'Error fetching links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleCopy = (link: ImageLinkItem) => {
    const url = link.publicUrl || `${window.location.origin}/i/${link.shortId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleStatus = async (link: ImageLinkItem) => {
    const nextStatus = link.status === 'active' ? 'disabled' : 'active';
    try {
      const res = await fetch(`/api/image-links/${link.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');

      setLinks(prev =>
        prev.map(l => (l.id === link.id ? { ...l, status: nextStatus } : l))
      );
      fetchLinks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (link: ImageLinkItem) => {
    if (!window.confirm(`Permanently delete Image Link "${link.shortId}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/image-links/${link.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete link');

      setLinks(prev => prev.filter(l => l.id !== link.id));
      fetchLinks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenStats = async (link: ImageLinkItem) => {
    setStatsModalLink(link);
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/image-links/${link.id}/events`);
      const data = await res.json();
      setClickEvents(data.events || []);
    } catch (e) {
      console.error(e);
      setClickEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const filteredLinks = links.filter(l => {
    const q = search.toLowerCase();
    return (
      l.shortId.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      l.destinationUrl.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-800 pb-5 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">
            Image Links Dashboard
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Real-time click telemetry and status governance for all generated image links.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchLinks}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={onCreateNew}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Image Link</span>
          </button>
        </div>
      </div>

      {/* METRIC STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <span className="text-xs text-neutral-400">Total Image Links</span>
          <div className="mt-1.5 font-mono text-2xl font-bold text-white tabular-nums">
            {stats.totalLinks}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <span className="text-xs text-neutral-400">Total Clicks Recorded</span>
          <div className="mt-1.5 font-mono text-2xl font-bold text-sky-400 tabular-nums">
            {stats.totalClicks}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <span className="text-xs text-neutral-400">Active Links</span>
          <div className="mt-1.5 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
            {stats.activeLinks}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <span className="text-xs text-neutral-400">Disabled Links</span>
          <div className="mt-1.5 font-mono text-2xl font-bold text-neutral-400 tabular-nums">
            {stats.disabledLinks}
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-sm mb-5">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
        <input
          type="text"
          placeholder="Filter by short ID, description or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 py-2 pl-9 pr-3 text-xs text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-950/40 p-4 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/50" />
          ))}
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-12 text-center">
          <h3 className="text-sm font-semibold text-white">No Image Links Found</h3>
          <p className="mt-1 text-xs text-neutral-400 max-w-sm mx-auto">
            {search ? 'No links match your filter.' : 'You have not created any Image Links yet.'}
          </p>
          <button
            onClick={onCreateNew}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Your First Image Link</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLinks.map((link) => {
            const publicUrl = link.publicUrl || `${window.location.origin}/i/${link.shortId}`;
            const isActive = link.status === 'active';

            return (
              <div
                key={link.id}
                className="group flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900/80 p-4 transition-colors"
              >
                {/* Left: Thumbnail & Link Info */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                    <img
                      src={link.processedImageUrl}
                      alt={link.description}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-400">
                        /i/{link.shortId}
                      </span>
                      {!isActive && (
                        <span className="text-[11px] font-semibold text-red-400">
                          Disabled
                        </span>
                      )}
                      <span className="text-[11px] text-neutral-500 font-mono">
                        ({link.framingMode === 'crop_16_9' ? '16:9 Crop' : 'Full Image'})
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-medium text-white truncate max-w-lg">
                      {link.description}
                    </p>

                    <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400 font-mono flex-wrap">
                      <span className="tabular-nums text-neutral-200">
                        {link.clickCount} {link.clickCount === 1 ? 'click' : 'clicks'}
                      </span>
                      <span aria-hidden="true">&middot;</span>
                      <span className="text-neutral-500 truncate max-w-xs">
                        &rarr; {link.destinationUrl}
                      </span>
                      <span aria-hidden="true">&middot;</span>
                      <span className="text-neutral-500">
                        {new Date(link.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                  {/* Copy */}
                  <button
                    onClick={() => handleCopy(link)}
                    className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    title="Copy short link"
                  >
                    {copiedId === link.id ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {/* Open in new tab (human redirect) */}
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    title="Open Image Link in new tab"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>Open</span>
                  </a>

                  {/* View Stats */}
                  <button
                    onClick={() => handleOpenStats(link)}
                    className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
                    title="View Click Events"
                  >
                    <BarChart2 className="h-3 w-3" />
                    <span>Stats</span>
                  </button>

                  {/* QR Code */}
                  <button
                    onClick={() => setActiveQrLink(link)}
                    className="rounded-lg border border-neutral-800 bg-neutral-900 p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    title="QR Code"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                  </button>

                  {/* Toggle Disable / Enable */}
                  <button
                    onClick={() => handleToggleStatus(link)}
                    className={`rounded-lg border p-1.5 transition-colors ${
                      isActive
                        ? 'border-neutral-800 bg-neutral-900 text-emerald-400 hover:bg-neutral-800'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-white'
                    }`}
                    title={isActive ? 'Disable Link' : 'Enable Link'}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(link)}
                    className="rounded-lg border border-neutral-800 bg-neutral-900 p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                    title="Delete permanently"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Code Modal */}
      {activeQrLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center shadow-2xl">
            <h3 className="text-sm font-bold text-white font-mono">/i/{activeQrLink.shortId}</h3>
            <p className="mt-1 text-xs text-neutral-400 line-clamp-1">{activeQrLink.description}</p>

            <div className="my-5 flex justify-center">
              <div className="bg-white p-3 rounded-xl shadow-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    activeQrLink.publicUrl || `${window.location.origin}/i/${activeQrLink.shortId}`
                  )}`}
                  alt="QR Code"
                  className="h-40 w-40"
                />
              </div>
            </div>

            <div className="font-mono text-xs text-sky-400 break-all mb-4">
              {activeQrLink.publicUrl || `${window.location.origin}/i/${activeQrLink.shortId}`}
            </div>

            <button
              onClick={() => setActiveQrLink(null)}
              className="w-full rounded-xl bg-neutral-800 hover:bg-neutral-700 py-2.5 text-xs font-semibold text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Analytics Modal (Section 20) */}
      {statsModalLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Click Analytics</h3>
                <span className="font-mono text-xs text-sky-400">/i/{statsModalLink.shortId}</span>
              </div>
              <button
                onClick={() => setStatsModalLink(null)}
                className="rounded-lg p-1 text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono">
              <div className="rounded-lg bg-neutral-950 p-3 border border-neutral-800">
                <span className="text-neutral-400">Total Clicks:</span>
                <div className="text-lg font-bold text-white mt-0.5">{statsModalLink.clickCount}</div>
              </div>
              <div className="rounded-lg bg-neutral-950 p-3 border border-neutral-800">
                <span className="text-neutral-400">Created:</span>
                <div className="text-xs text-neutral-200 mt-1">
                  {new Date(statsModalLink.createdAt).toLocaleString()}
                </div>
              </div>
            </div>

            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Recent Visitor Click Logs
            </h4>

            {loadingEvents ? (
              <div className="py-8 text-center text-xs text-neutral-500">Loading click events...</div>
            ) : clickEvents.length === 0 ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-6 text-center text-xs text-neutral-500">
                No human click events recorded yet. Share your link to start tracking!
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 divide-y divide-neutral-900">
                {clickEvents.map((evt) => (
                  <div key={evt.id} className="p-2.5 text-[11px] font-mono">
                    <div className="flex items-center justify-between text-neutral-300">
                      <span>{new Date(evt.timestamp).toLocaleString()}</span>
                      <span className="text-neutral-500">{evt.referer ? `via ${evt.referer}` : 'direct'}</span>
                    </div>
                    {evt.userAgent && (
                      <div className="mt-1 text-neutral-500 truncate" title={evt.userAgent}>
                        {evt.userAgent}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setStatsModalLink(null)}
                className="rounded-xl bg-neutral-800 hover:bg-neutral-700 px-4 py-2 text-xs font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
