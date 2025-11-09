// Cesium ionのアクセストークン
Cesium.Ion.defaultAccessToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyOGRiZmY3Yy0wNzRjLTQ2MjktOGQ0Ni0xYmI5MzFmNDUxZDAiLCJpZCI6MzU0MDY0LCJpYXQiOjE3NjE0NTQ3MDh9.p9q4yTuNNbVz7U09nx04n-LQG0sxXh8TDw22H3FSIV0";

(async function () {

    // ===== 画面に応じたUI倍率 =====
    function computeUiScale() {
        const small = window.matchMedia("(max-width: 600px)").matches;
        const tiny = window.matchMedia("(max-width: 380px)").matches;
        // 端末DPRも加味（上げすぎると重くなるので上限2）
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        // ベース倍率
        let base = 1.0;
        if (small) base = 1.25;
        if (tiny) base = 1.4;
        return base * (dpr >= 1.5 ? 1.0 : 1.0); // DPRで無理に上げない（負荷対策）
    }
    let uiScale = computeUiScale();

    // CSS変数にも反映（ボタンなど）
    document.documentElement.style.setProperty("--ui-scale", String(uiScale));

    // ユーティリティ
    const px = (n) => `${Math.round(n * uiScale)}px`;

    // ===== Viewer =====
    const viewer = new Cesium.Viewer("cesiumContainer", {
        baseLayerPicker: false,
        timeline: false,
        animation: false,
        geocoder: false,
        homeButton: false,
    });

    // 既定ベースレイヤーを完全に除去
    while (viewer.imageryLayers.length > 0) {
        viewer.imageryLayers.remove(viewer.imageryLayers.get(0), false);
    }

    // 見た目
    viewer.scene.globe.enableLighting = true;
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date("2024-06-21T12:00:00Z"));
    viewer.clock.shouldAnimate = false;

    // ここは viewer 初期化の直後・addCallout より上に置く
    function applyCalloutStyle(entity, uiScale = 1.0, textFontPxBase = 18) {
        if (!entity) return;
        if (entity.point) {
            entity.point.pixelSize = Math.round(8 * uiScale);
            entity.point.outlineWidth = Math.round(2 * uiScale);
        }
        if (entity.label) {
            entity.label.font = `bold ${Math.round(textFontPxBase * uiScale)}px sans-serif`;
            entity.label.outlineWidth = Math.max(2, Math.round(3 * uiScale));
            entity.label.pixelOffset = new Cesium.Cartesian2(0, -Math.round(8 * uiScale));
            entity.label.scaleByDistance = new Cesium.NearFarScalar(300.0, 1.0 * uiScale, 8000.0, 0.7 * uiScale);
        }
    }


    // ===== 地形 =====
    const terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(2767062);
    viewer.terrainProvider = terrainProvider;

    // ===== 画像レイヤー定義 =====
    const layers = viewer.imageryLayers;

    // 衛星（Ion）
    const satelliteProvider = await Cesium.IonImageryProvider.fromAssetId(3830183);

    // 地理院 標準地図
    const gsiProvider = new Cesium.UrlTemplateImageryProvider({
        url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
        credit: new Cesium.Credit(
            '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>'
        ),
        minimumLevel: 2,
        maximumLevel: 18,
    });

    // 古地図4枚
    const providersOld = [
        new Cesium.UrlTemplateImageryProvider({
            url: "https://mapwarper.h-gis.jp/maps/tile/3547/{z}/{x}/{y}.png", // 『京都西北部』五万分一地形圖
            credit: new Cesium.Credit("『京都西北部』五万分一地形圖, 作成: 1948, https://www.gsi.go.jp/"),
            minimumLevel: 2,
            maximumLevel: 18,
        }),
        new Cesium.UrlTemplateImageryProvider({
            url: "https://mapwarper.h-gis.jp/maps/tile/3546/{z}/{x}/{y}.png", // 『京都西南部』五万分一地形圖
            credit: new Cesium.Credit("『京都西南部』五万分一地形圖, 作成: 1946, https://www.gsi.go.jp/"),
            minimumLevel: 2,
            maximumLevel: 18,
        }),
    ];

    // レイヤーを一度だけ追加して参照保持
    const layerSatellite = layers.addImageryProvider(satelliteProvider); // 衛星
    const layerGSI = layers.addImageryProvider(gsiProvider); // 地理院

    const layerOlds = providersOld.map((p) => layers.addImageryProvider(p)); // 古地図4枚

    // 見た目調整（任意）
    [layerSatellite, layerGSI, ...layerOlds].forEach((l) => {
        l.alpha = 1.0;
        l.brightness = 0.95;
    });

    // まず全OFF → 衛星のみON
    function allOff() {
        layerSatellite.show = false;
        layerGSI.show = false;
        layerOlds.forEach((l) => (l.show = false));
    }
    allOff();
    layerSatellite.show = true;

    // 排他的切替
    function showSatellite() {
        allOff();
        layerSatellite.show = true;
        layers.lowerToBottom(layerSatellite);
        setActive("btn-satellite");
    }
    function showGSI() {
        allOff();
        layerGSI.show = true;
        layers.lowerToBottom(layerGSI);
        setActive("btn-gsi");
    }
    function showOldMaps() {
        allOff();
        layerOlds.forEach((l) => (l.show = true));
        layers.raiseToTop(layerOlds[layerOlds.length - 1]);
        setActive("btn-old");
    }

    // アクティブ状態（任意・見た目用）
    function setActive(id) {
        const ids = ["btn-gsi", "btn-satellite", "btn-old"];
        ids.forEach((x) => {
            const el = document.getElementById(x);
            if (el) el.classList.toggle("active", x === id);
        });
    }

    // ボタンにイベント付与（存在する場合のみ）
    const btnSat = document.getElementById("btn-satellite");
    const btnGsi = document.getElementById("btn-gsi");
    const btnOld = document.getElementById("btn-old");
    if (btnSat) btnSat.onclick = showSatellite;
    if (btnGsi) btnGsi.onclick = showGSI;
    if (btnOld) btnOld.onclick = showOldMaps;
    setActive("btn-satellite");

    // ===== ルート（GeoJSON） =====
    const routeGeojson = {
        type: "FeatureCollection",
        name: "route",
        crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },

        features: [
            { type: "Feature", properties: { name: "A", style: "Line", placeholder: true }, geometry: null },

            // ここから B だけ実データ（省略せずそのまま）
            { "type": "Feature", "properties": { "name": "B", "style": "arrow" }, "geometry": { "type": "MultiLineString", "coordinates": [[[135.608043247787322, 35.015289597170934, 200], [135.615075268101975, 35.022703822214744, 200]]] } },
            {
                "type": "Feature", "properties": { "name": "B", "style": "arrow" }, "geometry": {
                    "type": "MultiLineString", "coordinates": [[[135.615833210411353, 35.022841754915234, 200], [135.620549295891806, 35.023979690815004,
                        200]]]
                }
            },
            { "type": "Feature", "properties": { "name": "B", "style": "arrow" }, "geometry": { "type": "MultiLineString", "coordinates": [[[135.621180914482949, 35.023703829020995, 200], [135.622444151665235, 35.021255514810207, 200], [135.622991554444212, 35.018669187777249, 200]]] } },
            { "type": "Feature", "properties": { "name": "B", "style": "arrow" }, "geometry": { "type": "MultiLineString", "coordinates": [[[135.623370525598915, 35.0184277930802, 200], [135.624760086499407, 35.018013971941613, 200], [135.625854892057362, 35.018358823035875, 200], [135.626275971118133, 35.020531351487207, 200], [135.626697050178848, 35.023669346231287, 200]]] } },
            { "type": "Feature", "properties": { "name": "B", "style": "arrow" }, "geometry": { "type": "MultiLineString", "coordinates": [[[135.627749747830791, 35.024738305948894, 200], [135.630739409162146, 35.024772788287706, 200], [135.630697301256077, 35.022703822214744, 200], [135.631371027753289, 35.021393449954076, 200]]] } },
            { "type": "Feature", "properties": { "name": "B", "style": "arrow" }, "geometry": { "type": "MultiLineString", "coordinates": [[[135.631118380316821, 35.02084170798242, 200], [135.630107790571003, 35.019358882984967, 200], [135.629770927322397, 35.017945001548256, 200]]] } },
            { "type": "Feature", "properties": { "name": "B", "style": "arrow" }, "geometry": { "type": "MultiLineString", "coordinates": [[[135.630328857077899, 35.017600148708823, 200], [135.632897439348511, 35.017496692573388, 200], [135.634160676530797, 35.018289852933378, 200], [135.635887100679867, 35.0188760969504, 200]]] } },
            { "type": "Feature", "properties": { "name": "B", "style": "arrow" }, "geometry": { "type": "MultiLineString", "coordinates": [[[135.63696085228483, 35.019203702070428, 200], [135.638813600152162, 35.019927877151964, 200], [135.639634704320628, 35.021134821368449, 200], [135.63976102803889, 35.02280727176192, 200]]] } },
            {
                "type": "Feature", "properties": { "name": "B", "style": "arrow" }, "geometry": {
                    "type": "MultiLineString", "coordinates": [[[135.640582132207385, 35.02368658762795, 200], [135.642076962873062, 35.023772794556756, 200], [135.647277289273404, 35.027272719100345, 200], [135.650245896651711, 35.029876014063504,
                        200]]]
                }
            },
            {
                "type": "Feature", "properties": { "name": "B", "style": "arrow" }, "geometry": {
                    "type": "MultiLineString", "coordinates": [[[135.650919623148923, 35.030565614732552, 200], [135.653003964499703, 35.029807053676599,
                        200]]]
                }
            },
            { "type": "Feature", "properties": { "name": "B", "style": "arrow" }, "geometry": { "type": "MultiLineString", "coordinates": [[[135.653361881701358, 35.02918640757629, 200], [135.653446097513466, 35.026255515098093, 200], [135.655046197944387, 35.024962440891279, 200], [135.656456812797899, 35.020514109425157, 200]]] } },
            {
                "type": "Feature", "properties": { "name": "B", "style": "arrow" }, "geometry": {
                    "type": "MultiLineString", "coordinates": [[[135.657193701154256, 35.019100247963799, 200], [135.658878017397285, 35.017582906028672, 200], [135.666225847007439, 35.016893195841448, 200], [135.668689159512923, 35.015720675172695, 200], [135.669678695305691, 35.014013592968261, 200], [135.673700000335884, 35.012616862842776, 200], [135.677447603976674, 35.01275481255874,
                        200]]]
                }
            },
        ],
    };

    const guideAEntities = [];
    const guideBEntities = [];
    const ds = await Cesium.GeoJsonDataSource.load(routeGeojson);
    viewer.dataSources.add(ds);

    // ラベル/ポイントのスケーリング設定をまとめる
    function applyCalloutStyle(entity, textFontPxBase = 18) {
        if (!entity.label && !entity.point) return;

        if (entity.point) {
            entity.point.pixelSize = Math.round(8 * uiScale);
            entity.point.outlineWidth = Math.round(2 * uiScale);
        }

        if (entity.label) {
            entity.label.font = `bold ${px(textFontPxBase)} sans-serif`;
            entity.label.outlineWidth = Math.max(2, Math.round(3 * uiScale));
            entity.label.pixelOffset = new Cesium.Cartesian2(0, -Math.round(8 * uiScale));
            // 近いと少し大きく、遠いと少し小さく
            entity.label.scaleByDistance = new Cesium.NearFarScalar(
                300.0, 1.0 * uiScale,  // 300mで基準
                8000.0, 0.7 * uiScale   // 8kmで少し縮む
            );
        }
    }

    // GeoJSONのスタイル適用
    for (const entity of ds.entities.values) {
        const p = entity.properties;
        const style = p?.style?.getValue?.();
        const name = entity.name ?? p?.name?.getValue?.();

        if (entity.polyline) {
            if (style === "arrow" || name === "B") {
                // 線B（矢印）
                const yellowTrans = Cesium.Color.YELLOW.withAlpha(0.5);
                entity.polyline.width = Math.round(25 * uiScale);
                entity.polyline.material = new Cesium.PolylineArrowMaterialProperty(yellowTrans);
                entity.polyline.clampToGround = false;
                entity.polyline.heightReference = Cesium.HeightReference.NONE;
                guideBEntities.push(entity);
            } else {
                // 線A（赤の点線）

                entity.polyline.material = new Cesium.PolylineDashMaterialProperty({
                    color: Cesium.Color.RED,
                    gapColor: Cesium.Color.TRANSPARENT,
                    dashLength: 17,
                });
                entity.polyline.width = Math.round(4 * uiScale);
                entity.polyline.clampToGround = true;
                if (name === "A") guideAEntities.push(entity);
            }
        }

    }

    // ===== コールアウト関数 =====
    async function addCallout(viewer, lon, lat, lift, text) {
        const carto = Cesium.Cartographic.fromDegrees(lon, lat);
        const [updated] = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [carto]);
        const groundH = (updated && updated.height) || 0;

        const groundPos = Cesium.Cartesian3.fromDegrees(lon, lat, groundH);
        const airPos = Cesium.Cartesian3.fromDegrees(lon, lat, groundH + lift);

        // 引出線
        viewer.entities.add({
            polyline: {
                positions: [groundPos, airPos],
                width: Math.max(2, Math.round(2 * uiScale)),
                material: Cesium.Color.BLUE.withAlpha(0.9),
                clampToGround: false,
            },
        });

        // 地面ポイント
        const pt = viewer.entities.add({
            position: groundPos,
            point: {
                pixelSize: Math.round(8 * uiScale),
                color: Cesium.Color.RED,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: Math.round(2 * uiScale),
            },
        });

        // 空中ラベル
        const lb = viewer.entities.add({
            position: airPos,
            label: {
                text: text,
                font: `bold ${px(18)} sans-serif`,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: Math.max(2, Math.round(3 * uiScale)),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -Math.round(8 * uiScale)),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scaleByDistance: new Cesium.NearFarScalar(300.0, 1.0 * uiScale, 8000.0, 0.7 * uiScale),
            },
        });

        // 念のためスタイル適用（将来の一括更新にも対応）
        applyCalloutStyle(pt);
        applyCalloutStyle(lb);
    }

    // ===== 11個のポイント =====
    const calloutPoints = [
        { lon: 135.6069745327962, lat: 35.014882189208805, lift: 250, text: "山本浜" },
        { lon: 135.60826045742786, lat: 35.01551988972753, lift: 250, text: "宮ノ下の瀬" },
        { lon: 135.61335696605983, lat: 35.02100294277043, lift: 250, text: "金岐の瀬" },
        { lon: 135.6165068915337, lat: 35.022577742902165, lift: 250, text: "小鮎の滝" },
        { lon: 135.62097813406035, lat: 35.02378539116505, lift: 250, text: "大高瀬" },
        { lon: 135.62287752732362, lat: 35.01896435276924, lift: 250, text: "殿の漁場" },
        { lon: 135.6235555, lat: 35.0184877, lift: 250, text: "獅子ヶ口の瀬" },
        { lon: 135.62665271890285, lat: 35.022973853498335, lift: 250, text: "女渕" },
        { lon: 135.62822178290295, lat: 35.02473217492811, lift: 250, text: "二股の瀬" },
        { lon: 135.63112396142947, lat: 35.02452929361622, lift: 250, text: "曲がり渕" },
        { lon: 135.6300621887978, lat: 35.017959531415066, lift: 250, text: "朝日の瀬" },
        { lon: 135.63970072479847, lat: 35.02264537167639, lift: 250, text: "ビキニの瀬" },
        { lon: 135.6397597121669, lat: 35.02358250750359, lift: 250, text: "保津峡駅上陸地点" },
        { lon: 135.673842613643, lat: 35.01315747425929, lift: 250, text: "嵐山" },
        { lon: 135.67777117238012, lat: 35.01292557703839, lift: 250, text: "渡月橋" },
    ];

    for (const p of calloutPoints) await addCallout(viewer, p.lon, p.lat, p.lift, p.text);

    viewer.flyTo(ds);

    // ===== 線Bトグル =====
    function setGuideAVisible(flag) {
        guideAEntities.forEach((ent) => (ent.show = flag));
    }
    function setGuideBVisible(flag) {
        guideBEntities.forEach((ent) => (ent.show = flag));
    }
    // 既定は両方ON（従来挙動を維持）
    setGuideAVisible(true);
    setGuideBVisible(true);

    (function initGuideToggles() {
        // ホルダー（右上）
        let holder = document.getElementById("btn-guide-holder");
        if (!holder) {
            holder = document.createElement("div");
            holder.id = "btn-guide-holder";
            holder.style.position = "absolute";
            holder.style.top = "calc(10px + env(safe-area-inset-top))";
            holder.style.right = "calc(10px + env(safe-area-inset-right))";
            holder.style.zIndex = "10";
            holder.style.background = "rgba(0,0,0,.45)";
            holder.style.backdropFilter = "blur(6px)";
            holder.style.borderRadius = "12px";
            holder.style.padding = "6px";
            holder.style.display = "flex";
            holder.style.gap = "6px";
            document.body.appendChild(holder);
        }

        // 共通ボタン生成ヘルパ
        const makeBtn = (id, label) => {
            let btn = document.getElementById(id);
            if (!btn) {
                btn = document.createElement("button");
                btn.id = id;
                btn.textContent = label;
                btn.style.border = "none";
                btn.style.padding = `calc(8px * ${uiScale}) calc(12px * ${uiScale})`;
                btn.style.borderRadius = "10px";
                btn.style.cursor = "pointer";
                btn.style.color = "#fff";
                btn.style.background = "#2d8cff";
                btn.style.minHeight = `calc(44px * ${uiScale})`;
                holder.appendChild(btn);
            }
            return btn;
        };

        // 線Aボタン 
        /*
        let visibleA = true;
        const btnA = makeBtn("btn-guideA", "Line A:ON");
        const refreshA = () => {
            btnA.classList.toggle("active", visibleA);
            btnA.textContent = visibleA ? "Route:ON" : "Route:OFF";
            btnA.style.background = visibleA ? "#2d8cff" : "rgba(255,255,255,.14)";
        };
        refreshA();
        btnA.onclick = () => {
            visibleA = !visibleA;
            setGuideAVisible(visibleA);
            refreshA();
        }; 
        */

        // 線Bボタン
        let visibleB = true;
        const btnB = makeBtn("btn-guideB", "→:ON");
        const refreshB = () => {
            btnB.classList.toggle("active", visibleB);
            btnB.textContent = visibleB ? "→:ON" : "→:OFF";
            btnB.style.background = visibleB ? "#2d8cff" : "rgba(255,255,255,.14)";
        };
        refreshB();
        btnB.onclick = () => {
            visibleB = !visibleB;
            setGuideBVisible(visibleB);
            refreshB();
        };
    })();


    // ===== 画面回転・リサイズ時も文字を再調整 =====
    function updateAllLabelPointStyles() {
        uiScale = computeUiScale();
        document.documentElement.style.setProperty("--ui-scale", String(uiScale));

        // 既存エンティティ反映
        viewer.entities.values.forEach((e) => applyCalloutStyle(e));
        ds.entities.values.forEach((e) => applyCalloutStyle(e));

        // 線の太さも少し追従（任意）
        guideBEntities.forEach((e) => {
            if (e.polyline) e.polyline.width = Math.round(25 * uiScale);
        });
        guideAEntities.forEach((e) => {
            if (e.polyline) e.polyline.width = Math.round(4 * uiScale);
        });

    }

    let resizeTimer = null;
    window.addEventListener("resize", () => {
        if (resizeTimer) cancelAnimationFrame(resizeTimer);
        resizeTimer = requestAnimationFrame(updateAllLabelPointStyles);
    });
})().catch(console.error);

