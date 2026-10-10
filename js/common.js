"use strict";

//サイト全体で共有する汎用的な関数を公開する.
window.ToolCommon = {
  //数値入力を指定した範囲の整数へ変換する.
  clampInteger(value, min, max) {
    const number = Number.parseInt(value, 10);

    if (!Number.isFinite(number)) {
      return min;
    }

    return Math.min(max, Math.max(min, number));
  },

  //JSONをUTF-8のバイト列へ変換する.
  jsonBytes(value) {
    return this.textBytes(JSON.stringify(value, null, 2) + "\n");
  },

  //文字列をUTF-8のバイト列へ変換する.
  textBytes(value) {
    return new TextEncoder().encode(value);
  },

  //langファイルを壊す改行を1行へ置き換える.
  escapeLangText(value) {
    return value.replace(/\r?\n/g, " ");
  }
};
