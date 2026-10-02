import React, { useState, useEffect } from 'react';
import { X, Check, Copy, ExternalLink, RefreshCw, Key, Globe, Shield } from 'lucide-react';
import { BotInfo } from '../types.js';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBotConfigured?: (configured: boolean) => void;
}

export const SetupModal: React.FC<SetupModalProps> = ({
  isOpen,
  onClose,
  onBotConfigured
}) => {
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const fetchBotInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telegram/info');
      const data = await res.json();
      setBotInfo(data);
      if (onBotConfigured) {
        onBotConfigured(data.configured);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBotInfo();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const appUrl = botInfo?.appUrl || window.location.origin;
  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleRegisterWebhook = async () => {
    setIsRegistering(true);
    setWebhookStatus(null);
    try {
      const res = await fetch('/api/telegram/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      });
      const data = await res.json();
      if (data.ok) {
        setWebhookStatus('✅ Webhook successfully registered with Telegram API!');
      } else {
        setWebhookStatus(`❌ Telegram error: ${data.description || 'Failed to set webhook'}`);
      }
      fetchBotInfo();
    } catch (err: any) {
      setWebhookStatus(`❌ Network error: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-sky-400" />
            <h3 className="text-base font-bold text-white font-display">
              Telegram Bot & Webhook Configuration
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Bot Status */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 mb-5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">TELEGRAM_BOT_TOKEN Status:</span>
            {botInfo?.configured ? (
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Check className="h-3.5 w-3.5" /> Configured ({botInfo.tokenMasked})
              </span>
            ) : (
              <span className="text-amber-400 font-medium">
                Not set in environment variables
              </span>
            )}
          </div>

          {botInfo?.bot && (
            <div className="mt-3 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Connected Bot:</span>
              <a
                href={`https://t.me/${botInfo.bot.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sky-400 hover:underline flex items-center gap-1"
              >
                @{botInfo.bot.username}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        {/* Webhook Endpoint section */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-neutral-200 mb-1.5">
            Public Webhook URL
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 py-2 px-3 font-mono text-xs text-sky-400 truncate">
              {webhookUrl}
            </div>
            <button
              onClick={handleCopyWebhook}
              className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors shrink-0"
            >
              {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Webhook Registration Button */}
          {botInfo?.configured && (
            <div className="mt-2.5 flex items-center justify-between">
              <button
                onClick={handleRegisterWebhook}
                disabled={isRegistering}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 py-1.5 px-3 text-xs font-semibold text-white transition-colors"
              >
                {isRegistering && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>Auto-Register Webhook with Telegram</span>
              </button>
              {botInfo.webhook?.url && (
                <span className="text-[11px] text-neutral-400">
                  Current webhook: active
                </span>
              )}
            </div>
          )}

          {webhookStatus && (
            <div className="mt-2 text-xs p-2 rounded bg-neutral-950 text-neutral-300">
              {webhookStatus}
            </div>
          )}
        </div>

        {/* Setup Instructions */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-xs text-neutral-300 space-y-2 mb-5">
          <h4 className="font-semibold text-white">How to connect your live bot:</h4>
          <ol className="list-decimal pl-4 space-y-1.5 text-neutral-400">
            <li>
              Open Telegram and talk to <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">@BotFather</a> to create a bot with <code className="text-neutral-200">/newbot</code>.
            </li>
            <li>
              Copy the HTTP API Token provided by BotFather.
            </li>
            <li>
              Set <code className="text-neutral-200">TELEGRAM_BOT_TOKEN="your_token"</code> in your environment variables.
            </li>
            <li>
              Click <b>"Auto-Register Webhook with Telegram"</b> above or open the bot in the built-in <b>Bot Simulator</b> to test right away without any token!
            </li>
          </ol>
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-neutral-800 hover:bg-neutral-700 px-4 py-2 text-xs font-semibold text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
