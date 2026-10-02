import React from 'react';
import { Link2, Plus, Sliders, Bug, Bot, Shield, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  currentTab: 'creator' | 'dashboard' | 'crawler' | 'telegram' | 'admin';
  onSelectTab: (tab: 'creator' | 'dashboard' | 'crawler' | 'telegram' | 'admin') => void;
  onOpenSetup: () => void;
  botConfigured: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenSetup,
  botConfigured
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Zone 1: Single text wordmark */}
        <button
          onClick={() => onSelectTab('creator')}
          className="group flex items-center gap-2.5 text-left focus:outline-none"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 group-hover:border-sky-500/40 transition-colors">
            <Link2 className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white group-hover:text-sky-300 transition-colors">
            Image Links
          </span>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
          <button
            onClick={() => onSelectTab('creator')}
            className={`transition-colors hover:text-white ${
              currentTab === 'creator' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            Create Link
          </button>
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`transition-colors hover:text-white ${
              currentTab === 'dashboard' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onSelectTab('crawler')}
            className={`flex items-center gap-1 transition-colors hover:text-white ${
              currentTab === 'crawler' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            <Bug className="h-3 w-3" />
            <span>Crawler Debugger</span>
          </button>
          <button
            onClick={() => onSelectTab('telegram')}
            className={`flex items-center gap-1 transition-colors hover:text-white ${
              currentTab === 'telegram' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            <Bot className="h-3 w-3" />
            <span>Telegram Bot</span>
          </button>
          <button
            onClick={() => onSelectTab('admin')}
            className={`flex items-center gap-1 transition-colors hover:text-white ${
              currentTab === 'admin' ? 'text-sky-400 font-semibold' : ''
            }`}
          >
            <Shield className="h-3 w-3" />
            <span>Admin</span>
          </button>
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenSetup}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-900 hover:bg-neutral-800 rounded-lg border border-neutral-800 transition-colors whitespace-nowrap"
            title="Telegram Bot Token & Webhook Configuration"
          >
            <span
              className={`h-2 w-2 rounded-full ${botConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Bot Webhook</span>
            <Sliders className="h-3 w-3 sm:hidden" />
          </button>

          <button
            onClick={() => onSelectTab('creator')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shadow-sm shadow-sky-950"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Link</span>
          </button>
        </div>
      </div>

      {/* Mobile Bar */}
      <div className="flex md:hidden border-t border-neutral-800/80 bg-neutral-900/80 px-4 py-1.5 gap-4 overflow-x-auto text-xs font-medium text-neutral-400">
        <button
          onClick={() => onSelectTab('creator')}
          className={`whitespace-nowrap py-1 ${currentTab === 'creator' ? 'text-sky-400 font-semibold' : ''}`}
        >
          Create
        </button>
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`whitespace-nowrap py-1 ${currentTab === 'dashboard' ? 'text-sky-400 font-semibold' : ''}`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onSelectTab('crawler')}
          className={`whitespace-nowrap py-1 ${currentTab === 'crawler' ? 'text-sky-400 font-semibold' : ''}`}
        >
          Crawler Debugger
        </button>
        <button
          onClick={() => onSelectTab('telegram')}
          className={`whitespace-nowrap py-1 ${currentTab === 'telegram' ? 'text-sky-400 font-semibold' : ''}`}
        >
          Telegram Bot
        </button>
        <button
          onClick={() => onSelectTab('admin')}
          className={`whitespace-nowrap py-1 ${currentTab === 'admin' ? 'text-sky-400 font-semibold' : ''}`}
        >
          Admin
        </button>
      </div>
    </header>
  );
};
