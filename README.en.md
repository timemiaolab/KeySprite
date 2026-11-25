# KeySprite

[English](README.en.md) · [中文](README.md)

KeySprite is a small desktop utility for a few repetitive file-manager tasks: computing file checksums, copying file paths, and opening a terminal in the right folder.

## Features

- **SHA256 and MD5:** Computes SHA256 and MD5 for selected files (folders are not supported) and copies the results to the clipboard. Multiple selected files are included in one clipboard payload.
- **Copy absolute paths:** Copies the absolute path of the selected file(s) or folder(s). Multiple selections are separated by newlines. If nothing is selected, the current folder is copied.
- **Open a terminal at the folder:** Opens a terminal and changes to the selected folder, or to the folder that contains the selected file.

## Default shortcuts (customizable)

You can change these shortcuts in the preferences window.

- macOS: **Command + 8** SHA256 and MD5; **Command + 9** copy path; **Command + 0** open a terminal
- Windows / Linux: **Alt + 8** SHA256 and MD5; **Alt + 9** copy path; **Alt + 0** open a terminal

## When shortcuts run

The hotkeys are registered globally, but the actions only run when a file manager or the desktop is in the foreground:

- macOS: Finder or the desktop
- Windows: File Explorer or the desktop
- Linux: a file manager or the desktop (supported in the source tree)

They do not run when other applications are focused.

## Screenshots

### App window

[![App window](https://i.postimg.cc/j2p83kyb/1.png)](https://postimg.cc/RJTQNdPs)

### Copy file path

[![Copy file path](https://i.postimg.cc/fymFsNwp/2.png)](https://postimg.cc/BPZN5RPB)

### SHA256 and MD5

[![SHA256 and MD5](https://i.postimg.cc/4NG2cj4f/3.png)](https://postimg.cc/5jPmd7FT)

### Open a terminal

[![Open a terminal](https://i.postimg.cc/d3jBntQw/4.png)](https://postimg.cc/gLr82p6T)

## Install

Packaged builds are published on the [GitHub Releases](https://github.com/timemiaolab/KeySprite/releases) page:

- macOS Apple Silicon (ARM): `KeySprite_*_aarch64.dmg` and `KeySprite_*_aarch64.app.tar.gz`
- macOS Intel (x86_64): `KeySprite_*_x64.dmg` and `KeySprite_*_x64.app.tar.gz`
- Windows x64: `KeySprite_*_x64-setup.exe` and `KeySprite_*_x64.msi`

The repository includes Linux platform code, but the current release workflow does not publish a Linux installer.

## Permissions and signatures

These builds are not code-signed or notarized. macOS Gatekeeper and Windows SmartScreen may warn on first launch.

On macOS, Accessibility permission is required to register global shortcuts. If the preferences window reports that this permission is missing, you can open System Settings from there.

## Development

KeySprite is a Tauri 2 app (Rust 2021) with a Vite + React frontend.

- Rust 1.90 or newer, as pinned in `rust-toolchain.toml`
- The release workflow uses Node.js 22; `package.json` does not declare an `engines` field

```sh
npm install
npm run lint          # tsc --noEmit
npm test              # frontend unit tests defined in package.json
npm run build         # frontend production build only
npm run tauri:dev     # run the desktop app in development
npm run tauri:build   # package the desktop app
```

This README does not claim a particular test result, and it does not describe the packaged builds as signed or notarized.
