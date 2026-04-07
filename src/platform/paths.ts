import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEFAULT_HISTORY_FILENAME, DEFAULT_STATE_DIR } from "../core/types.js";

export interface PathResolutionOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  platform?: NodeJS.Platform;
  isWritable?: (targetPath: string) => boolean;
}

function pathApiFor(platformName: NodeJS.Platform | undefined): typeof path.posix | typeof path.win32 {
  return platformName === "win32" ? path.win32 : path.posix;
}

function runtimeHomeDir(options: PathResolutionOptions): string | undefined {
  const env = options.env ?? process.env;
  return options.homeDir ?? env.HOME ?? env.USERPROFILE ?? os.homedir();
}

function expandHome(value: string, homeDir: string | undefined): string {
  if (!homeDir) {
    return value;
  }
  return value.replace(/^~(?=$|[\\/])/, homeDir);
}

function resolveInputPath(value: string, options: PathResolutionOptions): string {
  const pathApi = pathApiFor(options.platform);
  const cwd = options.cwd ?? process.cwd();
  const expanded = expandHome(value, runtimeHomeDir(options));
  return pathApi.isAbsolute(expanded) ? pathApi.normalize(expanded) : pathApi.resolve(cwd, expanded);
}

function isWritableTarget(targetPath: string): boolean {
  let probe = path.resolve(targetPath);
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) {
      break;
    }
    probe = parent;
  }
  try {
    fs.accessSync(probe, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function looksLikeProjectRoot(cwd: string): boolean {
  return fs.existsSync(path.join(cwd, ".git")) || (fs.existsSync(path.join(cwd, "package.json")) && (fs.existsSync(path.join(cwd, "src")) || fs.existsSync(path.join(cwd, "bili_terminal"))));
}

export function legacyStateDir(options: PathResolutionOptions = {}): string {
  const pathApi = pathApiFor(options.platform);
  const cwd = options.cwd ?? process.cwd();
  return pathApi.join(cwd, ...DEFAULT_STATE_DIR.split(/[\\/]+/));
}

export function platformStateDir(options: PathResolutionOptions = {}): string | null {
  const env = options.env ?? process.env;
  const pathApi = pathApiFor(options.platform);
  const homeDir = runtimeHomeDir(options);
  const platformName = options.platform ?? process.platform;

  if (platformName === "win32") {
    const appData = env.APPDATA?.trim() || env.LOCALAPPDATA?.trim();
    if (appData) {
      return pathApi.join(resolveInputPath(appData, options), "BiliTerminal", "state");
    }
    if (homeDir) {
      return pathApi.join(homeDir, "AppData", "Roaming", "BiliTerminal", "state");
    }
    return null;
  }

  if (platformName === "darwin") {
    return homeDir ? pathApi.join(homeDir, "Library", "Application Support", "BiliTerminal", "state") : null;
  }

  const xdgStateHome = env.XDG_STATE_HOME?.trim() || env.XDG_DATA_HOME?.trim();
  if (xdgStateHome) {
    return pathApi.join(resolveInputPath(xdgStateHome, options), "biliterminal");
  }
  return homeDir ? pathApi.join(homeDir, ".local", "state", "biliterminal") : null;
}

export function defaultStateDir(options: PathResolutionOptions = {}): string {
  const env = options.env ?? process.env;
  const explicit = env.BILITERMINAL_STATE_DIR?.trim();
  if (explicit) {
    return resolveInputPath(explicit, options);
  }

  const homeDir = env.BILITERMINAL_HOME?.trim();
  if (homeDir) {
    const pathApi = pathApiFor(options.platform);
    return pathApi.join(resolveInputPath(homeDir, options), "state");
  }

  const legacyDir = legacyStateDir(options);
  const legacyHistory = pathApiFor(options.platform).join(legacyDir, DEFAULT_HISTORY_FILENAME);
  const cwd = options.cwd ?? process.cwd();
  if (fs.existsSync(legacyHistory) || looksLikeProjectRoot(cwd)) {
    return legacyDir;
  }

  const preferredDir = platformStateDir(options);
  const canWrite = options.isWritable ?? isWritableTarget;
  if (preferredDir && canWrite(preferredDir)) {
    return preferredDir;
  }

  return legacyDir;
}

export function defaultHistoryPath(options: PathResolutionOptions = {}): string {
  const pathApi = pathApiFor(options.platform);
  return pathApi.join(defaultStateDir(options), DEFAULT_HISTORY_FILENAME);
}
