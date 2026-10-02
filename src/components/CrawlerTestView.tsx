import React, { useState, useEffect } from 'react';
import { Bug, Search, Check, Copy, ExternalLink, AlertCircle, RefreshCw, Code, Image as ImageIcon } from 'lucide-react';
import { CrawlerTestResult } from '../types.js';

interface CrawlerTestViewProps {
  initialShortId?: string;
}

export const CrawlerTestView: React.FC<CrawlerTestViewProps> = ({ initialShortId }) => {
  const [inputUrl, setInputUrl] = useState(initialShortId ? `${window.location.origin}/i/${initialShortId}` : '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CrawlerTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<Array<{ name: string; description: string; passed: boolean; details: string }> | null>(null);

  const runTest = async (target: string) => {
    if (!target.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/crawler-test?url=${encodeURIComponent(target.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to simulate crawler request.');
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error running crawler simulation');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialShortId) {
      runTest(`${window.location.origin}/i/${initialShortId}`);
    }
  }, [initialShortId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runTest(inputUrl);
  };

  const handleCopyHtml = () => {
    if (!result?.rawHtml) return;
    navigator.clipboard.writeText(result.rawHtml);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-sky-400" />
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">
            Social Crawler & OG Debugger
          </h1>
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          Simulate Facebook, Twitter/X, Discord, and Telegram crawler requests to verify server-rendered Open Graph metadata and image dimensions.
        </p>
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Paste Image Link (e.g. https://your-domain.com/i/Ab7Xk92 or shortId)"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              required
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-3 px-4 text-xs text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-800 px-5 py-3 text-xs font-semibold text-white transition-colors shrink-0"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            <span>Fetch Crawler OG Data</span>
          </button>
        </div>
      </form>

      {/* Section 35 Automated Behavior Verification Tests */}
      <div className="mb-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>Automated Redirect & Crawler Behavior Test Suite</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Live automated tests verifying zero redirect delay, crawler OG rendering, disabled link blocking, and analytics resilience.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setTestRunning(true);
              try {
                const res = await fetch('/api/run-tests', { method: 'POST' });
                const data = await res.json();
                setTestResults(data.results || []);
              } catch (err: any) {
                console.error(err);
              } finally {
                setTestRunning(false);
              }
            }}
            disabled={testRunning}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 px-4 py-2 text-xs font-semibold text-white transition-colors shrink-0 shadow-sm"
          >
            {testRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            <span>{testRunning ? 'Running Tests...' : 'Run All 5 Behavior Tests'}</span>
          </button>
        </div>

        {testResults && (
          <div className="space-y-2 mt-4 pt-4 border-t border-neutral-800">
            {testResults.map((t, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                  t.passed
                    ? 'border-emerald-500/20 bg-emerald-950/20 text-neutral-200'
                    : 'border-red-500/20 bg-red-950/20 text-red-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 font-bold">
                    <span className={t.passed ? 'text-emerald-400' : 'text-red-400'}>
                      {t.passed ? '✓' : '✗'}
                    </span>
                    <span>{t.name}</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">{t.description}</div>
                </div>
                <div className="text-[11px] font-mono text-neutral-400 shrink-0 bg-neutral-900/80 px-2.5 py-1 rounded-lg border border-neutral-800">
                  {t.details}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-950/40 p-4 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="space-y-6">
          {/* Status Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3.5">
              <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">HTTP Status</span>
              <div className="mt-1 font-mono text-base font-bold text-emerald-400">
                {result.status} OK (Server-Rendered)
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3.5">
              <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">OG Dimensions</span>
              <div className="mt-1 font-mono text-base font-bold text-sky-400">
                {result.imageDimensions.width} × {result.imageDimensions.height} px
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3.5">
              <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Framing Mode</span>
              <div className="mt-1 font-mono text-base font-bold text-neutral-200">
                {result.framingMode === 'crop_16_9' ? 'Crop 16:9' : 'Full Image'}
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3.5">
              <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Total Clicks</span>
              <div className="mt-1 font-mono text-base font-bold text-neutral-200">
                {result.clickCount}
              </div>
            </div>
          </div>

          {/* Social Card Mockup */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              <span>Social Media Platform Preview (Twitter / Discord / Telegram)</span>
            </h3>

            <div className="max-w-lg mx-auto overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-xl">
              <div className="relative aspect-16/9 w-full bg-neutral-900">
                <img
                  src={result.ogImage}
                  alt={result.ogDescription}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-3.5 bg-neutral-950 border-t border-neutral-800">
                <div className="text-[11px] font-mono text-neutral-400 font-semibold uppercase">
                  {result.ogTitle}
                </div>
                <p className="mt-1 text-xs font-semibold text-neutral-100">
                  {result.ogDescription}
                </p>
                <div className="mt-2 text-[11px] text-neutral-400 truncate font-mono">
                  Canonical: {result.canonicalUrl}
                </div>
              </div>
            </div>
          </div>

          {/* Parsed Metadata Table */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
              Parsed Crawler Tags
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800/80 pb-2 gap-1">
                <span className="text-neutral-400">og:title / twitter:title:</span>
                <span className="text-sky-300 font-semibold">{result.ogTitle}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800/80 pb-2 gap-1">
                <span className="text-neutral-400">og:description:</span>
                <span className="text-neutral-200">{result.ogDescription}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800/80 pb-2 gap-1">
                <span className="text-neutral-400">og:image:</span>
                <a
                  href={result.ogImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline truncate max-w-md flex items-center gap-1"
                >
                  <span>{result.ogImage}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800/80 pb-2 gap-1">
                <span className="text-neutral-400">Redirect Destination:</span>
                <a
                  href={result.destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-300 hover:underline truncate max-w-md flex items-center gap-1"
                >
                  <span>{result.destinationUrl}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            </div>
          </div>

          {/* Raw HTML Metadata Code Box */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Code className="h-3.5 w-3.5" />
                <span>Raw Server-Rendered HTML Response (&lt;head&gt;)</span>
              </h3>
              <button
                onClick={handleCopyHtml}
                className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium"
              >
                {copiedHtml ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedHtml ? 'Copied HTML' : 'Copy HTML'}</span>
              </button>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-neutral-950 p-4 font-mono text-[11px] leading-relaxed text-sky-200 border border-neutral-800">
              {result.rawHtml}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
