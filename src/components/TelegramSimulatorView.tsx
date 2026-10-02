import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Image as ImageIcon,
  RotateCcw,
  ExternalLink,
  Bot,
  Check,
  RefreshCw,
  Crop,
  Maximize2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text?: string;
  photoUrl?: string;
  timestamp: string;
  replyMarkup?: {
    inline_keyboard?: Array<Array<{ text: string; url?: string; callback_data?: string; web_app?: { url: string } }>>;
  };
}

interface TelegramSimulatorViewProps {
  onOpenGeneratedLink?: (shortId: string) => void;
}

export const TelegramSimulatorView: React.FC<TelegramSimulatorViewProps> = ({
  onOpenGeneratedLink
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: `👋 <b>Hello! Welcome to ImageLink Generator.</b>\n\nI turn static images into clickable preview links with server-rendered Open Graph cards.\n\nSend <b>/new</b> to start creating an Image Link!`,
      timestamp: '10:00 AM',
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '➕ Create Image Link', callback_data: 'cmd_new' },
            { text: '📂 My Links', callback_data: 'cmd_links' }
          ],
          [
            { text: '📊 Stats', callback_data: 'cmd_stats' },
            { text: '📖 Help', callback_data: 'cmd_help' }
          ]
        ]
      }
    }
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [selectedPhotoKey, setSelectedPhotoKey] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const sendTelegramUpdate = async (updatePayload: any) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      const data = await res.json();

      if (data.session) {
        setSessionInfo(data.session);
      } else {
        setSessionInfo(null);
      }

      if (data.result?.responseText) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            sender: 'bot',
            text: data.result.responseText,
            replyMarkup: data.result.replyMarkup,
            timestamp: timeStr
          }
        ]);
      }
    } catch (err: any) {
      console.error('Simulator error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputVal.trim();
    if (!text && !selectedPhotoKey) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: text || undefined,
      photoUrl: photoPreview || undefined,
      timestamp: timeStr
    };
    setMessages((prev) => [...prev, newMsg]);

    const photoToSend = selectedPhotoKey;
    setInputVal('');
    setSelectedPhotoKey(null);
    setPhotoPreview(null);

    const updateObj: any = {
      update_id: Math.floor(Math.random() * 100000),
      message: {
        message_id: Math.floor(Math.random() * 1000),
        from: {
          id: 55443322,
          is_bot: false,
          first_name: 'Alex'
        },
        chat: {
          id: 55443322,
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: text
      }
    };

    if (photoToSend) {
      updateObj.message._simulated_image_key = photoToSend;
      updateObj.message.photo = [
        { file_id: 'sim_photo_1', width: 1200, height: 630 }
      ];
    }

    await sendTelegramUpdate(updateObj);
  };

  const handleCallbackClick = async (callbackData?: string, url?: string) => {
    if (url) {
      window.open(url, '_blank');
      return;
    }
    if (!callbackData) return;

    const updateObj = {
      update_id: Math.floor(Math.random() * 100000),
      callback_query: {
        id: String(Date.now()),
        from: {
          id: 55443322,
          first_name: 'Alex'
        },
        data: callbackData,
        message: {
          chat: { id: 55443322 }
        }
      }
    };

    await sendTelegramUpdate(updateObj);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/upload-preview', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setSelectedPhotoKey(data.rawKey);
      setPhotoPreview(URL.createObjectURL(file));
    } catch (err: any) {
      alert(err.message || 'Image upload error');
    }
  };

  const resetChat = () => {
    fetch('/api/telegram/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          chat: { id: 55443322 },
          from: { id: 55443322 },
          text: '/cancel'
        }
      })
    });

    setMessages([
      {
        id: '1',
        sender: 'bot',
        text: `👋 <b>Simulator restarted.</b>\n\nSend <b>/new</b> to create an Image Link!`,
        timestamp: '10:00 AM',
        replyMarkup: {
          inline_keyboard: [
            [{ text: '➕ Create Image Link', callback_data: 'cmd_new' }],
            [{ text: '📂 My Links', callback_data: 'cmd_links' }]
          ]
        }
      }
    ]);
    setSessionInfo(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Telegram Chat Frame */}
        <div className="lg:col-span-7 flex flex-col h-[700px] rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-white font-bold text-sm">
                <Bot className="h-5 w-5" />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-neutral-950" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  ImageLink Bot
                  <span className="text-[10px] text-sky-400 font-mono">bot</span>
                </h3>
                <span className="text-[11px] text-emerald-400">online &middot; live simulation</span>
              </div>
            </div>

            <button
              onClick={resetChat}
              className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-400 hover:text-white transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-950/60">
            {messages.map((msg) => {
              const isBot = msg.sender === 'bot';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      isBot
                        ? 'bg-neutral-900 border border-neutral-800 text-neutral-200'
                        : 'bg-sky-600 text-white'
                    }`}
                  >
                    {msg.photoUrl && (
                      <div className="mb-2 overflow-hidden rounded-lg border border-white/10 max-h-48">
                        <img
                          src={msg.photoUrl}
                          alt="Attachment"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}

                    {msg.text && (
                      <div
                        className="whitespace-pre-line break-words"
                        dangerouslySetInnerHTML={{ __html: msg.text }}
                      />
                    )}

                    <div
                      className={`mt-1 text-[10px] ${
                        isBot ? 'text-neutral-500' : 'text-sky-200'
                      } text-right`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>

                  {msg.replyMarkup?.inline_keyboard && (
                    <div className="mt-1.5 w-full max-w-[85%] space-y-1">
                      {msg.replyMarkup.inline_keyboard.map((row, rIdx) => (
                        <div key={rIdx} className="flex gap-1.5">
                          {row.map((btn, bIdx) => (
                            <button
                              key={bIdx}
                              onClick={() =>
                                handleCallbackClick(btn.callback_data, btn.url || btn.web_app?.url)
                              }
                              className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-sky-500/20 bg-sky-950/40 hover:bg-sky-900/60 py-2 px-3 text-[11px] font-medium text-sky-300 transition-colors"
                            >
                              <span>{btn.text}</span>
                              {btn.url && <ExternalLink className="h-3 w-3" />}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isProcessing && (
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <RefreshCw className="h-3 w-3 animate-spin text-sky-400" />
                <span>Processing...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Photo Preview if attached */}
          {photoPreview && (
            <div className="flex items-center justify-between border-t border-neutral-800 bg-neutral-900/90 px-4 py-2">
              <div className="flex items-center gap-2">
                <img
                  src={photoPreview}
                  alt="Ready to send"
                  className="h-10 w-10 rounded-md object-cover border border-neutral-700"
                />
                <span className="text-xs text-neutral-300">Photo attached &middot; press Send</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPhotoKey(null);
                  setPhotoPreview(null);
                }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          )}

          {/* Input Bar */}
          <div className="border-t border-neutral-800 bg-neutral-950 p-3">
            {/* Step helper guidance */}
            {sessionInfo?.step === 'AWAITING_IMAGE' && !photoPreview && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-sky-950/40 border border-sky-500/30 px-3 py-1.5 text-xs text-sky-200">
                <span>📸 Bot is waiting for image. Click the clip icon to pick a JPG/PNG.</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="font-semibold underline hover:text-white"
                >
                  Upload
                </button>
              </div>
            )}
            {sessionInfo?.step === 'AWAITING_URL' && (
              <div className="mb-2 rounded-lg bg-sky-950/40 border border-sky-500/20 px-3 py-1 text-xs text-sky-300">
                🌐 Please send destination URL (e.g. https://example.com)
              </div>
            )}
            {sessionInfo?.step === 'AWAITING_DESCRIPTION' && (
              <div className="mb-2 rounded-lg bg-sky-950/40 border border-sky-500/20 px-3 py-1 text-xs text-sky-300">
                📝 Please send Link Description for social card preview
              </div>
            )}
            {sessionInfo?.step === 'AWAITING_FRAMING' && (
              <div className="mb-2 rounded-lg bg-sky-950/40 border border-sky-500/20 px-3 py-1 text-xs text-sky-300">
                📐 Click one of the framing options above (Crop 16:9 or Full Image)
              </div>
            )}

            {/* Quick Commands */}
            <div className="flex items-center gap-1.5 mb-2 text-[11px] overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setInputVal('/new')}
                className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-neutral-300 hover:text-white"
              >
                /new
              </button>
              <button
                type="button"
                onClick={() => setInputVal('/links')}
                className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-neutral-300 hover:text-white"
              >
                /links
              </button>
              <button
                type="button"
                onClick={() => setInputVal('/stats')}
                className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-neutral-300 hover:text-white"
              >
                /stats
              </button>
              <button
                type="button"
                onClick={() => setInputVal('/cancel')}
                className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-neutral-300 hover:text-white"
              >
                /cancel
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white transition-colors shrink-0"
                title="Attach JPG/PNG Image"
              >
                <ImageIcon className="h-4 w-4" />
              </button>

              <input
                type="text"
                placeholder={selectedPhotoKey ? 'Optional message, or press Send...' : 'Type /new, destination URL, or message...'}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 py-2 px-3 text-xs text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />

              <button
                type="submit"
                disabled={isProcessing || (!inputVal.trim() && !selectedPhotoKey)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white transition-colors shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
              Telegram Workflow Guide (Section 15)
            </h4>
            <div className="space-y-3 text-xs text-neutral-300">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-mono text-[11px] text-sky-400">1</span>
                <div><b>/new</b> &rarr; Bot asks for image</div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-mono text-[11px] text-sky-400">2</span>
                <div><b>Send Image</b> &rarr; Bot stores photo and requests destination URL</div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-mono text-[11px] text-sky-400">3</span>
                <div><b>Send URL</b> &rarr; Bot validates URL and requests Link Description</div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-mono text-[11px] text-sky-400">4</span>
                <div><b>Send Description</b> &rarr; Bot prompts for Framing (Crop 16:9 vs Full)</div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 font-mono text-[11px] text-sky-400">5</span>
                <div><b>Image Link Generated</b> &rarr; Returns short URL with Open Graph preview!</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Telegram Webhook URL
            </h4>
            <p className="text-[11px] text-neutral-400 mb-2">
              Registered Telegram webhook endpoint for live bots:
            </p>
            <div className="rounded-lg bg-neutral-950 p-2.5 font-mono text-xs text-sky-400 break-all select-all">
              {window.location.origin}/api/telegram/webhook
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
