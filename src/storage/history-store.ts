import fs from "node:fs";
import path from "node:path";
import { MAX_FAVORITE_ITEMS, MAX_HISTORY_ITEMS, type VideoItem } from "../core/types.js";
import { normalizeKeyword } from "../core/text.js";
import { itemFromPayload, itemToHistoryPayload, videoKeyFromItem, videoKeyFromPayload } from "../api/parsers.js";
import { defaultHistoryPath } from "../platform/paths.js";

interface HistoryData {
  recent_keywords: string[];
  recent_videos: Array<Record<string, unknown>>;
  favorite_videos: Array<Record<string, unknown>>;
}

export class HistoryStore {
  public readonly path: string;
  private readonly maxItems: number;
  private readonly maxFavorites: number;
  private data: HistoryData;

  constructor(options: { path?: string; maxItems?: number; maxFavorites?: number } = {}) {
    this.path = options.path ?? defaultHistoryPath();
    this.maxItems = options.maxItems ?? MAX_HISTORY_ITEMS;
    this.maxFavorites = options.maxFavorites ?? MAX_FAVORITE_ITEMS;
    this.data = {
      recent_keywords: [],
      recent_videos: [],
      favorite_videos: [],
    };
    this.load();
  }

  load(): void {
    let changed = false;
    try {
      const payload = JSON.parse(fs.readFileSync(this.path, "utf8")) as Partial<HistoryData>;
      if (Array.isArray(payload.recent_keywords)) {
        const normalized: string[] = [];
        for (const item of payload.recent_keywords) {
          const value = normalizeKeyword(String(item));
          if (!value) {
            changed = true;
            continue;
          }
          if (value !== String(item).trim()) {
            changed = true;
          }
          if (!normalized.includes(value)) {
            normalized.push(value);
          }
        }
        this.data.recent_keywords = normalized.slice(0, this.maxItems);
      }
      if (Array.isArray(payload.recent_videos)) {
        this.data.recent_videos = payload.recent_videos.filter((item): item is Record<string, unknown> => !!item && typeof item === "object").slice(0, this.maxItems);
      }
      if (Array.isArray(payload.favorite_videos)) {
        const normalizedFavorites: Array<Record<string, unknown>> = [];
        const seen = new Set<string>();
        for (const item of payload.favorite_videos) {
          if (!item || typeof item !== "object") {
            changed = true;
            continue;
          }
          const key = videoKeyFromPayload(item as Record<string, unknown>);
          if (!key || seen.has(key)) {
            changed = true;
            continue;
          }
          seen.add(key);
          normalizedFavorites.push(item as Record<string, unknown>);
        }
        this.data.favorite_videos = normalizedFavorites.slice(0, this.maxFavorites);
      }
      if (changed) {
        this.save();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        // ignore invalid state files for robustness
      }
    }
  }

  save(): void {
    const dir = path.dirname(this.path);
    if (dir) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.path, `${JSON.stringify(this.data, null, 2)}\n`, "utf8");
  }

  addKeyword(keyword: string): void {
    const cleaned = normalizeKeyword(keyword);
    if (!cleaned) {
      return;
    }
    this.data.recent_keywords = [cleaned, ...this.data.recent_keywords.filter((item) => item !== cleaned)].slice(0, this.maxItems);
    this.save();
  }

  addVideo(item: VideoItem): void {
    const payload = itemToHistoryPayload(item);
    const key = videoKeyFromPayload(payload);
    this.data.recent_videos = [payload, ...this.data.recent_videos.filter((video) => videoKeyFromPayload(video) !== key)].slice(0, this.maxItems);
    this.save();
  }

  addFavorite(item: VideoItem): boolean {
    const payload = itemToHistoryPayload(item);
    const key = videoKeyFromPayload(payload);
    if (!key) {
      return false;
    }
    const favorites = this.data.favorite_videos.filter((video) => videoKeyFromPayload(video) !== key);
    const alreadyExists = favorites.length !== this.data.favorite_videos.length;
    this.data.favorite_videos = [payload, ...favorites].slice(0, this.maxFavorites);
    this.save();
    return !alreadyExists;
  }

  removeFavorite(target: VideoItem | string): boolean {
    const key = typeof target === "string" ? target : videoKeyFromItem(target);
    if (!key) {
      return false;
    }
    const favorites = this.data.favorite_videos.filter((video) => videoKeyFromPayload(video) !== key);
    const changed = favorites.length !== this.data.favorite_videos.length;
    if (changed) {
      this.data.favorite_videos = favorites;
      this.save();
    }
    return changed;
  }

  toggleFavorite(item: VideoItem): boolean {
    if (this.isFavorite(item)) {
      this.removeFavorite(item);
      return false;
    }
    this.addFavorite(item);
    return true;
  }

  isFavorite(item: VideoItem | null | undefined): boolean {
    const key = videoKeyFromItem(item);
    if (!key) {
      return false;
    }
    return this.data.favorite_videos.some((video) => videoKeyFromPayload(video) === key);
  }

  getRecentKeywords(limit = 10): string[] {
    return this.data.recent_keywords.slice(0, limit);
  }

  getRecentVideos(limit = 20): VideoItem[] {
    return this.data.recent_videos.slice(0, limit).map((item) => itemFromPayload(item));
  }

  getFavoriteVideos(limit?: number): VideoItem[] {
    const items = limit == null ? this.data.favorite_videos : this.data.favorite_videos.slice(0, limit);
    return items.map((item) => itemFromPayload(item));
  }
}
