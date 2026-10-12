# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project

チェスクエスト(`simple_chess`): ブラウザで動くファンタジーチェス RPG の PWA。ビルド不要の素の HTML / CSS / JavaScript で、リポジトリ直下をそのまま GitHub Pages に公開する。機能とファイル構成は `README.md` を参照。ユーザー向けの文言は日本語。

## Running / Testing

```bash
python3 -m http.server 8000   # → http://localhost:8000/ (Service Worker のため file:// では動かない)
npm test                      # node --test "tests/**/*.test.js"(Node 標準のテストランナー。インストール不要)
```

CI は、PR で `.github/workflows/test.yml`(lint とテスト)、デフォルトブランチ `main` への push で `.github/workflows/pages.yml`(テストして、通ったときだけ公開)が動く。

## 更新時の必須作業(Service Worker)

- **`version.js` の `APP_VERSION` と `sw.js` の `CACHE`(`simple-chess-v<番号>`)を必ず同じ番号に上げる。** 食い違うと `tests/version.test.js` が失敗する。番号はタイトル画面と「せってい」に表示される。
- **ファイルを追加/削除したら `sw.js` の `ASSETS` を更新する。** 実在しないファイルが載っていてもテストが失敗する。
- キャッシュ優先 + 画面の「更新」ボタン方式(`pwa.js`)。新版は待機させ、ボタンが押されたら `SKIP_WAITING` で切り替える。プレイ中に勝手に切り替えない。この方式が共通の標準。
- **起動に失敗したときの復旧は `boot.js`**(他のスクリプトとは別の普通のスクリプトで、`index.html` の最初の `<script>`)。起動できなかったとき、キャッシュを消して読み込み直す(1回目は自動、2分以内の2回目は `#boot-error` の「なおす」ボタン)。保存データは消さない。`app.js` の最後で `window.__appStarted = true` にする(`tests/boot.test.js` が確認する)。**消すのは、このアプリの Service Worker(`scope` が自分の置き場所)とキャッシュ(`simple-chess-` で始まる名前)だけ**。`sw.js` の `activate` の古いキャッシュの片づけも、`simple-chess-` で始まるものだけ(同じサイトのほかのアプリのキャッシュを消さない)。
- **記録のバックアップは `backup.js`**(「せってい」の「記録のバックアップ」)。`simple-chess-` で始まる保存データ(設定・対局・ストーリーの進行。デバッグモードの印は除く)を、`app` 名と `schemaVersion` を入れた JSON ファイルに書き出し / 読み込む。別のアプリのファイル、新しすぎる版、壊れた中身は理由を示して断る。**読み込むときは、ストーリーの進行は進んでいるほう(クリアした話・星・プロローグ)を残し、今の対局中の盤は上書きしない**(古いバックアップで進行が戻らない)。読み込み後は画面を読み込み直す。保存の形を変えるときは `SCHEMA_VERSION` を上げ、`backup.js` で古い形を変換する(保存キー名は変えない)。`tests/backup.test.js` がテストする。

## 現状と標準のずれ(直すときは別 PR で)

標準をほぼ満たしている。残る違いは次のとおり(デフォルトブランチは `main` に変更済み)。

- README に、画像・音・文章の出どころの記載が一部(BGM は自作曲)しかない。
- 画面の上端: `apple-mobile-web-app-status-bar-style` は `black`(不透明)、上端の余白は `--safe-top`(安全領域 + `--top-gap` の 24px)を使っていて、標準を満たしている(上のぼかしの対応済み)。

対応済み: ピンチ拡大の許可、PR 時のテスト(`test.yml`)、ESLint、専用の maskable アイコン、インストール方法の説明(タイトルメニューの「インストール」と設定)、バージョン表示(タイトル画面の右下と「せってい」)、更新ボタン方式、Dependabot(`.github/dependabot.yml`。npmは毎週、Actions は毎月)、起動失敗時の復旧(`boot.js`)、保存データの版番号とバックアップ(`backup.js`)。

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
- **最初の画面(タイトル/ホーム)に、インストール方法の説明への入口を置く。** iPhone は自動のインストール案内が出ないため、手順(iPhone / iPad は Safari の共有 → ホーム画面に追加、Android は Chrome のメニュー → アプリをインストール、パソコンはアドレスバーのインストールのマーク)を見せる。今使っている端末の説明を最初から開き、`beforeinstallprompt` が使えるときは「今すぐインストール」も出す。インストール済み(`display-mode: standalone`)のときは入口を出さない。実装の手本はテンプレート `mmishina-art/pwa-template` の `src/install.ts`。
- **タイトル画面(最初の画面)にバージョンを表示する**(例: `v1.2`)。更新が反映されたかを、利用者がひと目で確認できるようにするため。バージョンの元は1か所に置き、公開のたびに上げる。キャッシュ優先の Service Worker を手で書いている場合は、キャッシュ名の番号と同じにして、食い違いをテストで検出する。
- **PR は1つの目的にする。** 他の PR の上に積まない(積むときは、本文に「どの PR の上か」を書き、下の PR から順にマージする)。デフォルトブランチは `main`。
- **保存データには版番号(`schemaVersion` など)を持たせ、保存の形を変えるときは移行処理を書く。記録を残すアプリは、ファイルへの書き出し / 読み込みを用意する**(`localStorage` は、ブラウザの都合で消えることがある。特に iPhone)。手本はテンプレートの `src/backup.ts` と `src/storage.ts`、または `simple_quiz` の `js/backup.js`。
- **起動に失敗したときの復旧を用意する。** キャッシュ優先の Service Worker は、ファイルが食い違うと起動しなくなることがある。メインとは別の普通のスクリプトで、起動できなかったとき、キャッシュを消して読み込み直す(1回目は自動、2分以内の2回目は「なおす」ボタン)。保存データは消さない。手本は `simple_quiz` の `js/boot.js` とテンプレートの `public/boot.js`。
- **同じサイトに載るアプリ: 名前をアプリごとに別にする。** GitHub Pages では、すべてのアプリが同じサイト(`mmishina-art.github.io`)に載り、`localStorage`・`sessionStorage`・Service Worker・キャッシュはサイトの単位で共有される。保存データのキー、バックアップの `app` 名、キャッシュ名、`sessionStorage` のキーは、アプリごとに別の名前(接頭辞)にする。起動失敗の復旧(`boot.js`)と、Service Worker の古いキャッシュの片づけは、**自分のアプリの Service Worker とキャッシュだけ**を対象にする(`k !== CACHE` のように「自分以外すべて」を消さない)。
- **iPhone の画面の上端(ぼかしの帯)を避ける。** ホーム画面アプリで、ステータスバーの下に内容が入り込むと、iOS がそこをぼかして、上端の文字が読みにくくなる(`simple_chess`・`simple_blackjack`・`simple_shogi` で起きた)。`index.html` の `apple-mobile-web-app-status-bar-style` は**不透明**にし(暗い固定: `black` / 明るい固定: `default`。**`black-translucent` にしない**)、上端の余白は `env(safe-area-inset-top)` だけにせず、`--safe-top`(安全領域 + `--top-gap` の 24px)を使う。画面の高さから上の余白を引いて計算しているところは、同じ式で連動させる(忘れると、ぴったり収まっていた画面がはみ出してスクロールする)。ブラウザでは再現できないので、実機の iPhone で確認する。手本は、テンプレート `mmishina-art/pwa-template` の `src/style.css` と `scripts/check-dist.mjs`。
- **外部のリソース(Web フォント、CDN のスクリプトなど)に頼らない。** オフラインで動かなくなるため。使うなら、Service Worker のキャッシュ対象にする。
- **画像・音・問題文・文章は、自作するか、ライセンスを README に明記する。**
- 画面を変えたら、スマホの幅・小さい画面(iPhone SE の大きさ)・ダークモード(対応しているアプリ)で実際に表示して確認する(スクリーンショットを見る)。PR の本文に、確認したこと(実機か、していないか)を書く。
- **利用者が入力した文字は `textContent` で表示し、`innerHTML` に入れない。**
- **依存パッケージと Actions の更新は Dependabot に任せる**(`.github/dependabot.yml`)。更新の PR は、CI が緑なのを確認してからマージする。
- 変更を終える前にテストを通し、`python3 -m http.server` などで実際に起動して動作を確認する。
