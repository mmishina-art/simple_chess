import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/"] },
  js.configs.recommended,
  {
    // ブラウザで動く本体。<script> で読み込むので module ではなく script。
    // chess.js / ai.js はメインスレッド・Web Worker・Node（テスト）のすべてで読み込まれる
    files: ["*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.worker,
        ...globals.commonjs,
        // <script> の読み込み順で共有する、他のファイルが定義する名前
        Chess: "readonly",
        Pieces: "readonly",
        Feedback: "readonly",
        Story: "readonly",
        Scene: "readonly",
        Pwa: "readonly",
        Tutorial: "readonly",
      },
    },
  },
  {
    // Service Worker は別の環境で動く
    files: ["sw.js"],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    // Node.js で動くテストと設定
    files: ["tests/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
  },
  {
    files: ["eslint.config.mjs"],
    languageOptions: { sourceType: "module", globals: globals.node },
  },
  {
    rules: {
      // 使っていない変数はミスのことが多いので止める（catch の引数は除く）
      "no-unused-vars": ["error", { caughtErrors: "none" }],
      eqeqeq: "error",
      // 日本語の見出しに使う全角スペースは、文字列・テンプレートの中なら許可する
      "no-irregular-whitespace": ["error", { skipStrings: true, skipTemplates: true }],
      "prefer-const": "error",
    },
  },
];
