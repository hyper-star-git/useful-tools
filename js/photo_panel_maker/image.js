"use strict";

//ブラウザへ画像を読み込み、現在の状態へ保存する。
function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("画像ファイルを選択してください。"));
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。"));
    };

    image.src = url;
  });
}

//分割した画像をPNGのBlobへ変換する。
function createTileBlob(image, tile) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = tile.sourceWidth;
    canvas.height = tile.sourceHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      reject(new Error("Canvasを初期化できませんでした。"));
      return;
    }

    context.drawImage(
      image,
      tile.sourceX,
      tile.sourceY,
      tile.sourceWidth,
      tile.sourceHeight,
      0,
      0,
      tile.sourceWidth,
      tile.sourceHeight
    );

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNGへ変換できませんでした。"));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

//ファイルの一時表示に使うURLを作成する。
function createObjectUrl(file) {
  return URL.createObjectURL(file);
}

//画像処理関数を画像分割ツールへ公開する。
window.PhotoPanelMakerImage = {
  loadImageFile,
  createTileBlob,
  createObjectUrl
};
