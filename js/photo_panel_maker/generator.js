"use strict";

//フォトパネルのブロックIDを作る。
function buildBlockIdentifier(namespace, blockBase, index) {
  return `${namespace}:${blockBase}_${String(index).padStart(2, "0")}`;
}

//ZIPファイル名を作る。
function buildArchiveName(namespace, blockBase) {
  const safeName = `${namespace}_${blockBase}`.replace(/[^a-z0-9._-]+/gi, "_");
  return `${safeName}_photo_panels.zip`;
}

//全ブロックで共有するフォトパネル用モデルを定義する。
function buildPhotoPanelGeometry() {
  return {
    format_version: "1.21.0",
    "minecraft:geometry": [
      {
        description: {
          identifier: "geometry.photo_panel",
          texture_width: 16,
          texture_height: 16,
          visible_bounds_width: 1,
          visible_bounds_height: 1,
          visible_bounds_offset: [0, 0.5, 0]
        },
        bones: [
          {
            name: "root",
            pivot: [0, 8, 0],
            cubes: [
              {
                //南側に16×16×1の薄いパネルを置く。
                origin: [-8, 0, 7],
                size: [16, 16, 1],
                uv: {
                  //北面を表示面にして、東西南北の設置面に追従させる。
                  north: {
                    uv: [0, 0],
                    uv_size: [16, 16],
                    material_instance: "photo_panel"
                  }
                }
              }
            ]
          }
        ],
        "item_display_transforms": {
          "gui": {
            "rotation": [30, 225, 0]
          }
        }
      }
    ]
  };
}

//既存アドオンへ追加するBP / RPファイルだけを組み立てる。
async function buildAddonFiles(settings) {
  const rootFolder = "PhotoPanels";
  const bpFolder = `${rootFolder}/BP`;
  const rpFolder = `${rootFolder}/RP`;
  const files = [];
  const textureData = {};
  const langLines = [];
  const state = window.ImageSplitterState;
  const common = window.ToolCommon;
  const imageApi = window.ImageSplitterImage;
  const namespace = settings.namespace;
  const blockBase = `photo_panel_${settings.blockId}`;
  const catalogIdentifier = `${namespace}:${settings.itemCatalogId}`;

  //各分割画像についてBPのブロック定義とRPのテクスチャを作る。
  for (const tile of state.tiles) {
    const indexText = String(tile.index).padStart(2, "0");
    const identifier = buildBlockIdentifier(namespace, blockBase, tile.index);
    const blockIdWithoutNamespace = `${blockBase}_${indexText}`;
    const textureAlias = blockIdWithoutNamespace;
    const texturePath = `textures/blocks/photo_panels/${textureAlias}.png`;
    const textureBlob = await imageApi.createTileBlob(state.image, tile);
    const blockFileName = `${blockIdWithoutNamespace}.json`;

    files.push({
      path: `${bpFolder}/blocks/photo_panels/${blockFileName}`,
      data: common.jsonBytes({
        format_version: "1.21.80",
        "minecraft:block": {
          description: {
            identifier,
            menu_category: {
              category: "construction"
            },
            traits: {
              //設置した面を記録して東西南北の向きを切り替える。
              "minecraft:placement_position": {
                enabled_states: ["minecraft:block_face"]
              }
            }
          },
          components: {
            //当たり判定と選択範囲も16×16×1にする。
            "minecraft:collision_box": {
              origin: [-8, 0, 7],
              size: [16, 16, 1]
            },
            "minecraft:selection_box": {
              origin: [-8, 0, 7],
              size: [16, 16, 1]
            },
            "minecraft:geometry": "geometry.photo_panel",
            "minecraft:material_instances": {
              "*": {
                texture: textureAlias,
                render_method: "opaque"
              },
              photo_panel: {
                texture: textureAlias,
                render_method: "opaque"
              }
            },
            "minecraft:placement_filter": {
              conditions: [
                {
                  //壁面の東西南北だけへ設置できるようにする。
                  allowed_faces: ["north", "south", "east", "west"]
                }
              ]
            },
            "minecraft:item_visual": {
              geometry: "geometry.photo_panel",
              material_instances: {
                "*": {
                  texture: textureAlias,
                  render_method: "opaque"
                },
                photo_panel: {
                  texture: textureAlias,
                  render_method: "opaque"
                }
              }
            }
          },
          permutations: [
            {
              //北面に設置したときは基準向きをそのまま使う。
              condition: "query.block_state('minecraft:block_face') == 'north'",
              components: {
                "minecraft:transformation": {
                  rotation: [0, 0, 0]
                }
              }
            },
            {
              //南面に設置したときは180度回転する。
              condition: "query.block_state('minecraft:block_face') == 'south'",
              components: {
                "minecraft:transformation": {
                  rotation: [0, 180, 0]
                }
              }
            },
            {
              //東面に設置したときは270度回転する。
              condition: "query.block_state('minecraft:block_face') == 'east'",
              components: {
                "minecraft:transformation": {
                  rotation: [0, 270, 0]
                }
              }
            },
            {
              //西面に設置したときは90度回転する。
              condition: "query.block_state('minecraft:block_face') == 'west'",
              components: {
                "minecraft:transformation": {
                  rotation: [0, 90, 0]
                }
              }
            }
          ]
        }
      })
    });

    files.push({
      path: `${rpFolder}/${texturePath}`,
      data: new Uint8Array(await textureBlob.arrayBuffer())
    });

    //terrain_texture.jsonでテクスチャ名とPNGを関連付ける。
    textureData[textureAlias] = {
      textures: texturePath.replace(/\.png$/i, "")
    };

    //ja_JP.langで各ブロックの表示名を定義する。
    langLines.push(`tile.${identifier}.name=${common.escapeLangText(`${settings.blockName} ${indexText}`)}`);
  }

  //すべてのフォトパネルで共有するモデルを1つだけ出力する。
  files.push({
    path: `${rpFolder}/models/blocks/photo_panel.geo.json`,
    data: common.jsonBytes(buildPhotoPanelGeometry())
  });

  //terrain_texture.jsonでテクスチャ名とPNGを関連付ける。
  files.push({
    path: `${rpFolder}/textures/terrain_texture.json`,
    data: common.jsonBytes({
      texture_name: "atlas.terrain",
      padding: 8,
      num_mip_levels: 4,
      texture_data: textureData
    })
  });

  //アイテムカタログ用のグループをBehavior Packへ出力する。
  files.push({
    path: `${bpFolder}/item_catalog/crafting_item_catalog.json`,
    data: common.jsonBytes({
      format_version: "1.21.60",
      "minecraft:crafting_items_catalog": {
        categories: [
          {
            category_name: "construction",
            groups: [
              {
                group_identifier: {
                  icon: buildBlockIdentifier(namespace, blockBase, state.tiles[0].index),
                  name: catalogIdentifier
                },
                items: state.tiles.map((tile) => buildBlockIdentifier(namespace, blockBase, tile.index))
              }
            ]
          }
        ]
      }
    })
  });

  //日本語のブロック表示名とアイテムカタログ名を定義する。
  langLines.push(`${catalogIdentifier}=${common.escapeLangText(settings.itemCatalogName)}`);
  files.push({
    path: `${rpFolder}/texts/ja_JP.lang`,
    data: common.textBytes(`${langLines.join("\n")}\n`)
  });

  return files;
}

//ファイル生成関数を画像分割ツールへ公開する。
window.ImageSplitterGenerator = {
  buildAddonFiles,
  buildArchiveName,
  buildBlockIdentifier
};
