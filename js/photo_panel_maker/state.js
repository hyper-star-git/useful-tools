"use strict";

//複数画像と、画像共通・画像別の設定をまとめて管理する。
window.PhotoPanelMakerState = {
  images: [],
  activeImageId: null,
  nextImageId: 1,
  commonSettings: {
    namespace: "",
    itemCatalogId: "photo_panels",
    itemCatalogName: "フォトパネル"
  }
};
