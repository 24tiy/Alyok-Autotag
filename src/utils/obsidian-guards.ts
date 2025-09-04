import { App, TAbstractFile, TFile, TFolder, normalizePath } from "obsidian";

export const isTFile = (x: TAbstractFile | null | undefined): x is TFile =>
  x instanceof TFile;

export const isTFolder = (x: TAbstractFile | null | undefined): x is TFolder =>
  x instanceof TFolder;

export function mustGetFile(app: App, path: string): TFile {
  const af = app.vault.getAbstractFileByPath(normalizePath(path));
  if (!(af instanceof TFile)) throw new Error(`Not a file: ${path}`);
  return af;
}
export function mustGetFolder(app: App, path: string): TFolder {
  const af = app.vault.getAbstractFileByPath(normalizePath(path));
  if (!(af instanceof TFolder)) throw new Error(`Not a folder: ${path}`);
  return af;
}
