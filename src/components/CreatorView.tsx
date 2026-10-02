import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Link2,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  AlertCircle,
  RefreshCw,
  Globe,
  Share2,
  Sparkles,
  Crop,
  Maximize2
} from 'lucide-react';
import { ImageLinkItem } from '../types.js';

interface CreatorViewProps {
  onLinkCreated: (link: ImageLinkItem) => void;
  onOpenCrawlerTest?: (shortId: string) => void;
}

export const CreatorView: React.FC<CreatorViewProps> = ({
  onLinkCreated,
  onOpenCrawlerTest
}) => {
  // Form Inputs
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [destinationUrl, setDestinationUrl] = useState('');
  const [description, setDescription] = useState('');
  const [framingMode, setFramingMode] = useState<'crop_16_9' | 'full'>('crop_16_9');

  // UI States
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<ImageLinkItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract domain for live preview
  const extractedDomain = (() => {
    if (!destinationUrl.trim()) return 'example.com';
    try {
      const parsed = new URL(destinationUrl.trim());
      return parsed.hostname || 'example.com';
    } catch {
      return 'example.com';
    }
  })();

  const isUrlValid = (url: string) => {
    const trimmed = url.trim().toLowerCase();
    if (!trimmed) return null;
    if (
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('file:') ||
      trimmed.startsWith('vbscript:')
    ) {
      return false;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return false;
    }
    try {
      new URL(url.trim());
      return true;
    } catch {
      return false;
    }
  };

  const handleFileSelected = async (file: File) => {
    const ext = file.name.toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png'];
    const hasValidExt = validExts.some((e) => ext.endsWith(e));

    if (!hasValidExt || !file.type.startsWith('image/')) {
      setErrorMessage('Invalid image format. Supported formats: JPG, JPEG, and PNG.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage(`Image is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum upload size is 10 MB.`);
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    // Upload preview to backend in background
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/upload-preview', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload preview');
      }
      setRawKey(data.rawKey);
    } catch (err: any) {
      console.error(err);
      // Keep local preview if upload endpoint had network hiccup
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedFile && !rawKey) {
      setErrorMessage('Please upload an image (JPG or PNG up to 10MB).');
      return;
    }

    const trimmedUrl = destinationUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage('Please enter a redirect destination URL.');
      return;
    }

    if (!isUrlValid(trimmedUrl)) {
      setErrorMessage('Invalid destination URL. URL must begin with http:// or https:// (e.g. https://example.com).');
      return;
    }

    if (!description.trim()) {
      setErrorMessage('Please provide a Link Description for social media previews.');
      return;
    }

    setIsGenerating(true);

    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('image', selectedFile);
      } else if (rawKey) {
        formData.append('rawKey', rawKey);
      }
      formData.append('destinationUrl', trimmedUrl);
      formData.append('description', description.trim());
      formData.append('framingMode', framingMode);

      const res = await fetch('/api/image-links', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate Image Link');
      }

      setCreatedLink(data.link);
      onLinkCreated(data.link);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while generating the Image Link.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!createdLink) return;
    const url = createdLink.publicUrl || `${window.location.origin}/i/${createdLink.shortId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setRawKey(null);
    setDestinationUrl('');
    setDescription('');
    setFramingMode('crop_16_9');
    setCreatedLink(null);
    setErrorMessage(null);
    setShowQr(false);
  };

  const urlStatus = isUrlValid(destinationUrl);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Title & Introduction */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl font-display">
          Image Links
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Transform static images into clickable, shareable social media preview links.
        </p>
      </div>

      {/* SUCCESS STATE */}
      {createdLink ? (
        <div className="rounded-2xl border border-sky-500/30 bg-neutral-900/90 p-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-bold text-white">Your Image Link is Ready</span>
            </div>
            <button
              onClick={resetForm}
              className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Create Another</span>
            </button>
          </div>

          {/* Processed Social Card Preview */}
          <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 mb-5">
            <div className="relative aspect-16/9 w-full bg-neutral-900 overflow-hidden">
              <img
                src={createdLink.processedImageUrl}
                alt={createdLink.description}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-4 bg-neutral-950 border-t border-neutral-800/80">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 font-mono">
                {extractedDomain}
              </div>
              <p className="mt-1 text-sm font-semibold text-neutral-100 line-clamp-2">
                {createdLink.description}
              </p>
              <div className="mt-2 text-xs text-neutral-400 flex items-center gap-1.5 truncate">
                <span>Redirects to:</span>
                <span className="text-sky-400 font-mono truncate">{createdLink.destinationUrl}</span>
              </div>
            </div>
          </div>

          {/* Public Link Container */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 mb-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
              Public Image Link
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm font-bold text-sky-300 truncate select-all">
                {createdLink.publicUrl || `${window.location.origin}/i/${createdLink.shortId}`}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors shrink-0 shadow-sm"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            <a
              href={createdLink.publicUrl || `/i/${createdLink.shortId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-3 py-2.5 text-xs font-semibold text-neutral-200 transition-colors"
              title="Test human redirect in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Link</span>
            </a>

            <button
              onClick={() => setShowQr(!showQr)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-3 py-2.5 text-xs font-semibold text-neutral-200 transition-colors"
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>QR Code</span>
            </button>

            {onOpenCrawlerTest ? (
              <button
                onClick={() => onOpenCrawlerTest(createdLink.shortId)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-900/50 bg-sky-950/40 hover:bg-sky-900/60 px-3 py-2.5 text-xs font-semibold text-sky-300 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Test OG Tags</span>
              </button>
            ) : (
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-3 py-2.5 text-xs font-semibold text-neutral-200 transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </button>
            )}
          </div>

          {/* QR Code Overlay */}
          {showQr && (
            <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950 p-5">
              <div className="bg-white p-3 rounded-xl shadow-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    createdLink.publicUrl || `${window.location.origin}/i/${createdLink.shortId}`
                  )}`}
                  alt="QR Code"
                  className="h-40 w-40"
                />
              </div>
              <p className="mt-2.5 text-xs text-neutral-400">Scan with your phone camera to test redirect</p>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-neutral-800/80 text-[11px] text-neutral-500 text-center">
            Framing: {createdLink.framingMode === 'crop_16_9' ? 'Crop 16:9 (1200×630)' : 'Full Image'} &middot; Created on {new Date(createdLink.createdAt).toLocaleDateString()}
          </div>
        </div>
      ) : (
        /* PICLINKS-STYLE WORKFLOW FORM */
        <form onSubmit={handleGenerate} className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-xl backdrop-blur-md">
          {errorMessage && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD IMAGE */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-neutral-200">
                Upload Image
              </label>
              <span className="text-xs text-neutral-400">JPG, JPEG, PNG (Max 10 MB)</span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950">
                <div className="relative aspect-16/9 w-full bg-neutral-900 flex items-center justify-center overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Uploaded preview"
                    className={`h-full w-full ${framingMode === 'crop_16_9' ? 'object-cover' : 'object-contain'}`}
                  />
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs text-xs text-sky-300 font-medium">
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Uploading preview...
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-neutral-900/90 text-xs border-t border-neutral-800">
                  <span className="text-neutral-300 font-mono truncate max-w-xs">
                    {selectedFile?.name || 'Selected image'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setRawKey(null);
                    }}
                    className="text-red-400 hover:text-red-300 font-medium transition-colors"
                  >
                    Change Image
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-700 hover:border-sky-500/60 bg-neutral-950/60 hover:bg-neutral-950 p-8 text-center cursor-pointer transition-all"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800 text-sky-400 mb-3 border border-neutral-700">
                  <Upload className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-neutral-200">
                  Upload / Drag & Drop
                </span>
                <span className="mt-1 text-xs text-neutral-400">
                  Supported formats: JPG, JPEG, PNG up to 10MB
                </span>
              </div>
            )}
          </div>

          {/* STEP 2: REDIRECT DESTINATION */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="destination-url" className="text-sm font-bold text-neutral-200">
                Redirect Destination
              </label>
              {destinationUrl && (
                <span className="text-xs">
                  {urlStatus ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="h-3 w-3" /> Valid URL
                    </span>
                  ) : (
                    <span className="text-red-400">Must start with http:// or https://</span>
                  )}
                </span>
              )}
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-500">
                <Globe className="h-4 w-4" />
              </div>
              <input
                id="destination-url"
                type="url"
                placeholder="https://example.com"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                required
                className={`w-full rounded-xl border bg-neutral-950 py-3 pl-10 pr-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 ${
                  urlStatus === false
                    ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-800 focus:border-sky-500 focus:ring-sky-500'
                }`}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-400">
              When humans open your generated link, they will be redirected to this URL.
            </p>
          </div>

          {/* STEP 3: LINK DESCRIPTION */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="link-desc" className="text-sm font-bold text-neutral-200">
                Link Description (Social Preview)
              </label>
              <span className="text-xs text-neutral-400 font-mono">{description.length}/500</span>
            </div>
            <textarea
              id="link-desc"
              rows={3}
              maxLength={500}
              placeholder="Write your description for Facebook, Twitter/X, Discord, and Telegram previews..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-white placeholder-neutral-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none leading-relaxed"
            />
          </div>

          {/* STEP 4: FRAMING CONTROLS */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-neutral-200">
                Image Framing Style
              </label>
              <span className="text-xs text-neutral-400">Social 16:9 Standard</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFramingMode('crop_16_9')}
                className={`flex items-center justify-center gap-2 rounded-xl border py-3 px-4 text-xs font-semibold transition-all ${
                  framingMode === 'crop_16_9'
                    ? 'border-sky-500 bg-sky-950/40 text-sky-300 shadow-sm'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Crop className="h-4 w-4" />
                <span>Crop 16:9 (1200×630)</span>
              </button>

              <button
                type="button"
                onClick={() => setFramingMode('full')}
                className={`flex items-center justify-center gap-2 rounded-xl border py-3 px-4 text-xs font-semibold transition-all ${
                  framingMode === 'full'
                    ? 'border-sky-500 bg-sky-950/40 text-sky-300 shadow-sm'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <Maximize2 className="h-4 w-4" />
                <span>Full Image</span>
              </button>
            </div>
          </div>

          {/* STEP 5: REAL-TIME SOCIAL MEDIA CARD PREVIEW */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Social Media Card Preview
              </span>
              <span className="text-[11px] text-neutral-400">Twitter/Facebook 16:9 Card</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-lg">
              <div className="relative aspect-16/9 w-full bg-neutral-900 flex items-center justify-center overflow-hidden">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className={`h-full w-full ${framingMode === 'crop_16_9' ? 'object-cover' : 'object-contain'}`}
                  />
                ) : (
                  <div className="text-center p-6 text-neutral-600">
                    <Link2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <span className="text-xs">Upload an image to see live social card preview</span>
                  </div>
                )}
              </div>
              <div className="p-4 bg-neutral-950 border-t border-neutral-800">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 font-mono">
                  {extractedDomain}
                </div>
                <p className="mt-1 text-xs text-neutral-200 line-clamp-2">
                  {description.trim() || 'Your description will appear here on Facebook, Twitter, Telegram, and Discord.'}
                </p>
              </div>
            </div>
          </div>

          {/* STEP 6: PRIMARY ACTION BUTTON */}
          <button
            type="submit"
            disabled={isGenerating || isUploading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-800 disabled:text-neutral-500 py-3.5 px-6 text-sm font-bold text-white transition-all shadow-lg shadow-sky-950/50 active:scale-[0.99]"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Processing Image & Generating Link...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate Secure Image Link</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};
