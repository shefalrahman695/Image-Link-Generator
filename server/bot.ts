import crypto from 'node:crypto';
import fs from 'node:fs';
import { dbService } from './db.js';
import { storageService, FramingMode } from './storage.js';
import { getPublicAppUrl } from './urlHelper.js';

export function validateDestinationUrl(rawUrl: string): { valid: boolean; error?: string; url?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Destination URL cannot be empty.' };
  }
  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();

  // Reject dangerous protocols
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('about:') ||
    lower.startsWith('chrome:')
  ) {
    return { valid: false, error: 'Security alert: Only http:// and https:// URLs are permitted.' };
  }

  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return { valid: false, error: 'Destination URL must begin with http:// or https://' };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only http and https protocols are supported.' };
    }
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // SSRF protection: reject localhost, loopback, private IP ranges, cloud metadata
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '0:0:0:0:0:0:0:1' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.lan') ||
      hostname.endsWith('.corp') ||
      hostname.endsWith('.home') ||
      hostname.endsWith('.test') ||
      hostname.endsWith('.invalid') ||
      hostname.startsWith('fc') ||
      hostname.startsWith('fe80')
    ) {
      return { valid: false, error: 'Private, internal, and localhost network addresses are blocked for security.' };
    }
    return { valid: true, url: parsed.toString() };
  } catch {
    return { valid: false, error: 'Malformed URL. Please provide a valid address (e.g. https://example.com).' };
  }
}

export function generateShortId(length = 8): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  let attempts = 0;
  while (attempts < 10) {
    let result = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    // Check if unique in DB
    const existing = dbService.getLinkByShortId(result);
    if (!existing) {
      return result;
    }
    attempts++;
  }
  return 'i' + Date.now().toString(36);
}

export class TelegramBotService {
  public getBotToken(): string | null {
    return process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.trim() : null;
  }

  public getAppUrl(req?: any): string {
    return getPublicAppUrl(req);
  }

  public hasToken(): boolean {
    const token = this.getBotToken();
    return Boolean(token && token.length > 10);
  }

  public getTokenMasked(): string {
    const token = this.getBotToken();
    if (!token) return 'Not configured';
    if (token.length < 10) return '***';
    return `${token.slice(0, 4)}...${token.slice(-4)}`;
  }

  private async callApi(method: string, payload: Record<string, any>): Promise<any> {
    const token = this.getBotToken();
    if (!token) {
      return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured in server environment' };
    }
    const url = `https://api.telegram.org/bot${token}/${method}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (err: any) {
      console.error(`Telegram API error on ${method}:`, err);
      return { ok: false, description: err.message };
    }
  }

  async sendMessage(chatId: string | number, text: string, options?: { parse_mode?: string; reply_markup?: any }): Promise<any> {
    if (!this.hasToken()) {
      return { ok: true, simulated: true, chatId, text, options };
    }
    return this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || 'HTML',
      reply_markup: options?.reply_markup
    });
  }

  async downloadTelegramFile(fileId: string): Promise<Buffer> {
    const token = this.getBotToken();
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required to download files from Telegram.');
    }
    const fileRes = await this.callApi('getFile', { file_id: fileId });
    if (!fileRes.ok || !fileRes.result?.file_path) {
      throw new Error(`Telegram failed to retrieve file info: ${fileRes.description || 'Unknown error'}`);
    }

    const filePath = fileRes.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error(`Failed to download file: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async setWebhook(webhookUrl?: string): Promise<any> {
    const targetUrl = webhookUrl || `${this.getAppUrl()}/api/telegram/webhook`;
    return this.callApi('setWebhook', {
      url: targetUrl,
      drop_pending_updates: false
    });
  }

  async getBotInfo(): Promise<any> {
    if (!this.hasToken()) {
      return {
        configured: false,
        tokenMasked: 'Not set',
        appUrl: this.getAppUrl()
      };
    }
    const [me, webhook] = await Promise.all([
      this.callApi('getMe', {}),
      this.callApi('getWebhookInfo', {})
    ]);
    return {
      configured: true,
      tokenMasked: this.getTokenMasked(),
      appUrl: this.getAppUrl(),
      bot: me.result || null,
      webhook: webhook.result || null
    };
  }

  /**
   * Process a Telegram update
   */
  async handleUpdate(update: any): Promise<{ replied: boolean; responseText?: string; replyMarkup?: any; newLink?: any }> {
    const message = update.message || update.edited_message;
    const callbackQuery = update.callback_query;

    if (callbackQuery) {
      const chatId = callbackQuery.message?.chat?.id || callbackQuery.from?.id;
      const userId = String(callbackQuery.from?.id || chatId);
      const data = callbackQuery.data;

      if (data === 'cmd_new') {
        return this.startNewLinkFlow(chatId, callbackQuery.from);
      } else if (data === 'cmd_links') {
        return this.sendUserLinks(chatId, userId);
      } else if (data === 'cmd_stats') {
        return this.sendUserStats(chatId, userId);
      } else if (data === 'cmd_help') {
        return this.sendHelp(chatId);
      } else if (data === 'frame_crop_16_9' || data === 'frame_full') {
        const framingMode: FramingMode = data === 'frame_crop_16_9' ? 'crop_16_9' : 'full';
        return this.finishLinkCreationWithFraming(chatId, userId, framingMode);
      }
      return { replied: true };
    }

    if (!message) {
      return { replied: false };
    }

    const chatId = message.chat.id;
    const userId = String(message.from?.id || chatId);
    const text = (message.text || '').trim();

    // Commands
    if (text.startsWith('/start')) {
      return this.sendWelcome(chatId, message.from?.first_name || 'there');
    }
    if (text.startsWith('/help')) {
      return this.sendHelp(chatId);
    }
    if (text.startsWith('/cancel')) {
      dbService.clearSession(userId);
      const reply = '<b>Action cancelled.</b> Send /new whenever you want to create a new Image Link.';
      await this.sendMessage(chatId, reply);
      return { replied: true, responseText: reply };
    }
    if (text.startsWith('/new')) {
      return this.startNewLinkFlow(chatId, message.from);
    }
    if (text.startsWith('/links')) {
      return this.sendUserLinks(chatId, userId);
    }
    if (text.startsWith('/stats')) {
      return this.sendUserStats(chatId, userId);
    }

    // Check ongoing multi-step session
    const session = dbService.getSession(userId);

    // If no active session but user sends a photo directly
    if (!session || session.step === 'IDLE') {
      if (message.photo || (message.document && message.document.mime_type?.startsWith('image/'))) {
        return this.handleImageReceived(chatId, message, userId);
      }
      const reply = `Send <b>/new</b> to create a new Image Link, or <b>/help</b> for instructions.`;
      await this.sendMessage(chatId, reply);
      return { replied: true, responseText: reply };
    }

    // Step: AWAITING_IMAGE
    if (session.step === 'AWAITING_IMAGE') {
      if (message.photo || (message.document && message.document.mime_type?.startsWith('image/'))) {
        return this.handleImageReceived(chatId, message, userId);
      } else {
        const reply = `Please send an image (JPG or PNG up to 10MB), or send /cancel to abort.`;
        await this.sendMessage(chatId, reply);
        return { replied: true, responseText: reply };
      }
    }

    // Step: AWAITING_URL
    if (session.step === 'AWAITING_URL') {
      const validation = validateDestinationUrl(text);
      if (!validation.valid || !validation.url) {
        const reply = `❌ <b>Invalid destination URL:</b> ${validation.error || 'Please provide a valid http or https URL.'}\n\nPlease try again (e.g. <code>https://example.com</code>):`;
        await this.sendMessage(chatId, reply);
        return { replied: true, responseText: reply };
      }

      session.temp_data.destination_url = validation.url;
      dbService.setSession(userId, 'AWAITING_DESCRIPTION', session.temp_data);

      const reply = `✅ <b>Destination URL set:</b>\n<code>${validation.url}</code>\n\nNow send the <b>Link Description</b> (this will appear in social media preview cards):`;
      await this.sendMessage(chatId, reply);
      return { replied: true, responseText: reply };
    }

    // Step: AWAITING_DESCRIPTION
    if (session.step === 'AWAITING_DESCRIPTION') {
      const description = text.trim();
      if (!description) {
        const reply = `Please enter a description for the social preview card (e.g. "Check out this product").`;
        await this.sendMessage(chatId, reply);
        return { replied: true, responseText: reply };
      }

      session.temp_data.description = description;
      dbService.setSession(userId, 'AWAITING_FRAMING', session.temp_data);

      const reply = `Choose image framing style:`;
      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '📐 Crop 16:9 (1200×630)', callback_data: 'frame_crop_16_9' },
            { text: '🖼️ Full Image', callback_data: 'frame_full' }
          ]
        ]
      };

      await this.sendMessage(chatId, reply, { reply_markup: replyMarkup });
      return { replied: true, responseText: reply, replyMarkup };
    }

    // Step: AWAITING_FRAMING (handled via callback_query, or text fallback)
    if (session.step === 'AWAITING_FRAMING') {
      const lower = text.toLowerCase();
      const mode: FramingMode = lower.includes('full') ? 'full' : 'crop_16_9';
      return this.finishLinkCreationWithFraming(chatId, userId, mode);
    }

    return { replied: false };
  }

  private async sendWelcome(chatId: string | number, name: string) {
    const miniAppUrl = `${this.getAppUrl()}?user_id=${chatId}`;
    const text = `👋 <b>Hello, ${name}! Welcome to ImageLink Generator.</b>\n\n` +
      `I convert static images into clickable social media preview links that redirect to your destination website.\n\n` +
      `<b>Available Commands:</b>\n` +
      `• /new - Create a new Image Link\n` +
      `• /links - View your generated links\n` +
      `• /stats - Check your overall click performance\n` +
      `• /help - Detailed workflow instructions\n` +
      `• /cancel - Cancel current link creation`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '➕ Create Image Link', callback_data: 'cmd_new' },
          { text: '📱 Open Mini App', web_app: { url: miniAppUrl } }
        ],
        [
          { text: '📂 My Links', callback_data: 'cmd_links' },
          { text: '📊 Stats', callback_data: 'cmd_stats' }
        ]
      ]
    };

    await this.sendMessage(chatId, text, { reply_markup: replyMarkup });
    return { replied: true, responseText: text, replyMarkup };
  }

  private async sendHelp(chatId: string | number) {
    const text = `📖 <b>ImageLink Generator Workflow:</b>\n\n` +
      `1. Send <b>/new</b> to begin.\n` +
      `2. Send your image (JPG or PNG up to 10MB).\n` +
      `3. Send your destination URL (must start with https:// or http://).\n` +
      `4. Send the Link Description for Open Graph social media cards.\n` +
      `5. Choose framing: <b>Crop 16:9</b> (1200×630) or <b>Full Image</b>.\n` +
      `6. Receive your public Image Link (e.g. <code>${this.getAppUrl()}/i/Ab7Xk92</code>).\n\n` +
      `When shared on Twitter, Facebook, Telegram or Discord, crawlers receive server-rendered Open Graph tags and display the full card. When a human clicks, they are redirected to your destination!`;

    const replyMarkup = {
      inline_keyboard: [
        [{ text: '➕ Create Link Now', callback_data: 'cmd_new' }]
      ]
    };

    await this.sendMessage(chatId, text, { reply_markup: replyMarkup });
    return { replied: true, responseText: text, replyMarkup };
  }

  private async startNewLinkFlow(chatId: string | number, fromUser: any) {
    const userId = String(fromUser?.id || chatId);
    dbService.setSession(userId, 'AWAITING_IMAGE', {});

    const text = `Please send me the image (JPG or PNG up to 10MB).`;
    await this.sendMessage(chatId, text);
    return { replied: true, responseText: text };
  }

  private async handleImageReceived(chatId: string | number, message: any, userId: string) {
    let fileId: string | null = null;
    let fileName = 'telegram_image.jpg';

    if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
      const largest = message.photo[message.photo.length - 1];
      fileId = largest.file_id;
    } else if (message.document && message.document.mime_type?.startsWith('image/')) {
      fileId = message.document.file_id;
      if (message.document.file_name) fileName = message.document.file_name;
    }

    const simulatedImageKey = message._simulated_image_key;
    let tempImageKey: string;

    try {
      if (simulatedImageKey) {
        tempImageKey = simulatedImageKey;
      } else if (fileId && this.hasToken()) {
        const buffer = await this.downloadTelegramFile(fileId);
        tempImageKey = storageService.saveRawBuffer(buffer, '.jpg');
      } else {
        // Fallback for tests
        const fallbackBuffer = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64'
        );
        tempImageKey = storageService.saveRawBuffer(fallbackBuffer, '.png');
      }
    } catch (err: any) {
      const errorMsg = `❌ <b>Failed to process image:</b> ${err.message}\n\nPlease try sending the image again or send /cancel.`;
      await this.sendMessage(chatId, errorMsg);
      return { replied: true, responseText: errorMsg };
    }

    dbService.setSession(userId, 'AWAITING_URL', {
      temp_image_key: tempImageKey,
      original_file_name: fileName
    });

    const text = `Image received.\n\nPlease send the destination URL (e.g. <code>https://example.com</code>):`;
    await this.sendMessage(chatId, text);
    return { replied: true, responseText: text };
  }

  private async finishLinkCreationWithFraming(
    chatId: string | number,
    userId: string,
    framingMode: FramingMode
  ) {
    const session = dbService.getSession(userId);
    if (!session || !session.temp_data.temp_image_key || !session.temp_data.destination_url) {
      dbService.clearSession(userId);
      const msg = 'Session expired. Please send /new to create a link.';
      await this.sendMessage(chatId, msg);
      return { replied: true, responseText: msg };
    }

    const { temp_image_key, original_file_name, destination_url, description } = session.temp_data;
    const rawFilePath = storageService.getFilePath(temp_image_key);

    if (!fs.existsSync(rawFilePath)) {
      dbService.clearSession(userId);
      const msg = 'Image file missing. Please start again with /new.';
      await this.sendMessage(chatId, msg);
      return { replied: true, responseText: msg };
    }

    const rawBuffer = fs.readFileSync(rawFilePath);

    // Process image with Sharp
    const processed = await storageService.processImage(rawBuffer, framingMode);
    const shortId = generateShortId(8);
    const appUrl = this.getAppUrl();
    const imageUrl = `${appUrl}/api/images/${processed.rawKey}`;
    const processedImageUrl = `${appUrl}/api/images/${processed.processedKey}`;

    const link = dbService.createImageLink({
      shortId,
      originalFileName: original_file_name || 'telegram_upload.jpg',
      imageUrl,
      processedImageUrl,
      destinationUrl: destination_url,
      description: description || 'Visit website',
      framingMode,
      telegramUserId: userId
    });

    dbService.clearSession(userId);

    const publicUrl = `${appUrl}/i/${link.shortId}`;
    const text = `Image Link created successfully.\n\n` +
      `Image Link:\n${publicUrl}\n\n` +
      `Destination: ${link.destinationUrl}\n` +
      `Description: ${link.description}\n` +
      `Framing: ${link.framingMode === 'crop_16_9' ? 'Crop 16:9' : 'Full Image'}`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '🔗 Open Link', url: publicUrl },
          { text: '📱 Open Mini App', web_app: { url: `${appUrl}?user_id=${userId}` } }
        ],
        [
          { text: '📂 My Links', callback_data: 'cmd_links' },
          { text: '➕ Create Another', callback_data: 'cmd_new' }
        ]
      ]
    };

    await this.sendMessage(chatId, text, { reply_markup: replyMarkup });
    return { replied: true, responseText: text, replyMarkup, newLink: link };
  }

  private async sendUserLinks(chatId: string | number, userId: string) {
    const links = dbService.getUserLinks(userId, 5);
    if (links.length === 0) {
      const text = `You haven't created any Image Links yet.\n\nSend /new to create your first link!`;
      const replyMarkup = {
        inline_keyboard: [[{ text: '➕ Create Image Link', callback_data: 'cmd_new' }]]
      };
      await this.sendMessage(chatId, text, { reply_markup: replyMarkup });
      return { replied: true, responseText: text, replyMarkup };
    }

    const appUrl = this.getAppUrl();
    let text = `📂 <b>Your Recent Image Links:</b>\n\n`;
    for (let i = 0; i < links.length; i++) {
      const l = links[i];
      text += `${i + 1}. <b>${appUrl}/i/${l.shortId}</b>\n`;
      text += `   🎯 &rarr; ${l.destinationUrl}\n`;
      text += `   📊 Clicks: <b>${l.clickCount}</b> · Status: ${l.status}\n\n`;
    }

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '➕ New Link', callback_data: 'cmd_new' },
          { text: '📱 Manage in Mini App', web_app: { url: `${appUrl}?user_id=${userId}` } }
        ]
      ]
    };

    await this.sendMessage(chatId, text, { reply_markup: replyMarkup });
    return { replied: true, responseText: text, replyMarkup };
  }

  private async sendUserStats(chatId: string | number, userId: string) {
    const stats = dbService.getUserStats(userId);
    const text = `📊 <b>Your Image Link Stats:</b>\n\n` +
      `• Total Image Links: <b>${stats.totalLinks}</b>\n` +
      `• Active Links: <b>${stats.activeLinks}</b>\n` +
      `• Disabled Links: <b>${stats.disabledLinks}</b>\n` +
      `• Total Clicks Recorded: <b>${stats.totalClicks}</b>`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '📂 View My Links', callback_data: 'cmd_links' },
          { text: '➕ Create Link', callback_data: 'cmd_new' }
        ]
      ]
    };

    await this.sendMessage(chatId, text, { reply_markup: replyMarkup });
    return { replied: true, responseText: text, replyMarkup };
  }
}

export const botService = new TelegramBotService();
