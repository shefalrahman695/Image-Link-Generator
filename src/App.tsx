import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { CreatorView } from './components/CreatorView.js';
import { DashboardView } from './components/DashboardView.js';
import { CrawlerTestView } from './components/CrawlerTestView.js';
import { TelegramSimulatorView } from './components/TelegramSimulatorView.js';
import { AdminView } from './components/AdminView.js';
import { SetupModal } from './components/SetupModal.js';
import { ImageLinkItem } from './types.js';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'creator' | 'dashboard' | 'crawler' | 'telegram' | 'admin'>('creator');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [botConfigured, setBotConfigured] = useState(false);
  const [activeCrawlerShortId, setActiveCrawlerShortId] = useState<string | undefined>(undefined);

  // Check bot token status on load
  useEffect(() => {
    fetch('/api/telegram/info')
      .then((r) => r.json())
      .then((data) => {
        setBotConfigured(Boolean(data.configured));
      })
      .catch(() => {});
  }, []);

  const handleOpenCrawlerWithShortId = (shortId: string) => {
    setActiveCrawlerShortId(shortId);
    setCurrentTab('crawler');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Bar Contract (3 Zones) */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab !== 'crawler') setActiveCrawlerShortId(undefined);
          setCurrentTab(tab);
        }}
        onOpenSetup={() => setIsSetupOpen(true)}
        botConfigured={botConfigured}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {currentTab === 'creator' && (
          <CreatorView
            onLinkCreated={(_link: ImageLinkItem) => {
              // Link generated
            }}
            onOpenCrawlerTest={handleOpenCrawlerWithShortId}
          />
        )}

        {currentTab === 'dashboard' && (
          <DashboardView
            onCreateNew={() => setCurrentTab('creator')}
            onOpenCrawlerTest={handleOpenCrawlerWithShortId}
          />
        )}

        {currentTab === 'crawler' && (
          <CrawlerTestView initialShortId={activeCrawlerShortId} />
        )}

        {currentTab === 'telegram' && (
          <TelegramSimulatorView />
        )}

        {currentTab === 'admin' && (
          <AdminView />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950/70 py-6 text-xs text-neutral-500">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-400">Image Links</span>
            <span aria-hidden="true">&middot;</span>
            <span>Social Preview Image Link Generator</span>
          </div>

          <div className="flex items-center gap-4 text-neutral-400">
            <button
              onClick={() => setCurrentTab('crawler')}
              className="hover:text-white transition-colors"
            >
              Crawler Debugger
            </button>
            <span aria-hidden="true">&middot;</span>
            <button
              onClick={() => setIsSetupOpen(true)}
              className="hover:text-white transition-colors"
            >
              Telegram Webhook
            </button>
            <span aria-hidden="true">&middot;</span>
            <button
              onClick={() => setCurrentTab('admin')}
              className="hover:text-white transition-colors"
            >
              Admin
            </button>
          </div>
        </div>
      </footer>

      {/* Bot & Webhook Setup Modal */}
      <SetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        onBotConfigured={(configured) => setBotConfigured(configured)}
      />
    </div>
  );
}
