# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project

チェスクエスト(`simple_chess`): ブラウザで動くファンタジーチェス RPG の PWA。ビルド不要の素の HTML / CSS / JavaScript で、リポジトリ直下をそのまま GitHub Pages に公開する。機能とファイル構成は `README.md` を参照。ユーザー向けの文言は日本語。

## Running / Testing

```bash
python3 -m http.server 8000   # → http://localhost:8000/ (Service Worker のため file:// では動かない)
npm test                      # node --test "tests/**/*.test.js"(Node 標準のテストランナー。インストール不要)
```

CI(`.github/workflows/pages.yml`)は `master` への push で `npm test` を実行し、通ったときだけ公開する。デフォルトブランチは `master`。

## 更新時の必須作業(Service Worker)

- **`version.js` の `APP_VERSION` と `sw.js` の `CACHE`(`simple-chess-v<番号>`)を必ず同じ番号に上げる。** 食い違うと `tests/version.test.js` が失敗する。番号はタイトル画面と「せってい」に表示される。
- **ファイルを追加/削除したら `sw.js` の `ASSETS` を更新する。** 実在しないファイルが載っていてもテストが失敗する。
- キャッシュ優先 + 画面の「更新」ボタン方式(`pwa.js`)。新版は待機させ、ボタンが押されたら `SKIP_WAITING` で切り替える。プレイ中に勝手に切り替えない。この方式が共通の標準。

## 現状と標準のずれ(直すときは別 PR で)

- viewport に `maximum-scale=1, user-scalable=no` が入っている → 標準はピンチ拡大を許可。外す場合は盤の操作でのダブルタップ誤拡大を `touch-action: manipulation` で防げているか確認する。
- `maskable` アイコンは専用の `icon-maskable-512.png` を持っている(OK)。
- PR 時にテストが走らない → `push: [master]` だけなので、PR でも `npm test` を走らせる `test.yml` を追加したい。
- Lint(ESLint)がない。

## 共通ルール(PWA アプリ共通)

新しい PWA アプリは、テンプレート `mmishina-art/pwa-template`(Vite + TypeScript)から作る。このリポジトリは作成時期の都合でテンプレートより前の構成だが、次のルールは共通で守る。

- オーナーは Claude Code での開発を学習中。変更は小さく、理由を添えて説明する。
- ユーザー向けの文言・説明は日本語。コードの識別子とコミットメッセージは英語(命令形、1コミット1目的)。
- 作業は feature ブランチ → PR → CI が通ったらマージ。デフォルトブランチへ直接 push しない。
- 配信は GitHub Pages のサブパス。参照パスは相対(`./`)にし、`/` から始めない。
- ユーザーデータは `localStorage` を `try/catch` で囲んで読み書きし、使えなくても動くこと。**保存キー名は変更しない**(利用者の記録が消える)。変えるなら移行処理を書く。
- 色は CSS の `:root` 変数に集約し、直書きしない。`[hidden] { display: none !important; }` を残す。
- ズーム: ピンチ拡大は許可し、ダブルタップ拡大だけ `touch-action: manipulation` で防ぐ。viewport に `user-scalable=no` / `maximum-scale` を新たに入れない。
- タップ領域は 44px 以上。`prefers-reduced-motion: reduce` でアニメーションを無効化する。結果表示は `aria-live` でも読み上げ、色だけで状態を伝えない。
- 効果音は Web Audio で合成し、オン/オフ設定を用意する。
- iPhone の安全領域(`env(safe-area-inset-*)`)を考慮する。
- 変更を終える前にテストを通し、`python3 -m http.server` などで実際に起動して動作を確認する。
