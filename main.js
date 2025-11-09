// Cesium ionのアクセストークン
Cesium.Ion.defaultAccessToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyOGRiZmY3Yy0wNzRjLTQ2MjktOGQ0Ni0xYmI5MzFmNDUxZDAiLCJpZCI6MzU0MDY0LCJpYXQiOjE3NjE0NTQ3MDh9.p9q4yTuNNbVz7U09nx04n-LQG0sxXh8TDw22H3FSIV0";

(function () {
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

    // ===== 地形 =====
    (async () => {
        viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(2767062);

        // ===== 画像レイヤー =====
        const layers = viewer.imageryLayers;
        const satelliteProvider = await Cesium.IonImageryProvider.fromAssetId(3830183);
        const gsiProvider = new Cesium.UrlTemplateImageryProvider({
            url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
            credit: new Cesium.Credit('<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>'),
            minimumLevel: 2,
            maximumLevel: 18,
        });
        const providersOld = [
            new Cesium.UrlTemplateImageryProvider({
                url: "https://mapwarper.h-gis.jp/maps/tile/3544/{z}/{x}/{y}.png",
                credit: new Cesium.Credit("『広根』五万分一地形圖, https://www.gsi.go.jp/"),
                minimumLevel: 2,
                maximumLevel: 18,
            }),
        ];

        const layerSatellite = layers.addImageryProvider(satelliteProvider);
        const layerGSI = layers.addImageryProvider(gsiProvider);
        const layerOlds = providersOld.map((p) => layers.addImageryProvider(p));

        [layerSatellite, layerGSI, ...layerOlds].forEach((l) => {
            l.alpha = 1.0;
            l.brightness = 0.95;
        });

        function allOff() {
            layerSatellite.show = false;
            layerGSI.show = false;
            layerOlds.forEach((l) => (l.show = false));
        }
        allOff();
        layerSatellite.show = true;

        function setActive(id) {
            const ids = ["btn-gsi", "btn-satellite", "btn-old"];
            ids.forEach((x) => {
                const el = document.getElementById(x);
                if (el) el.classList.toggle("active", x === id);
            });
        }

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
                {
                    type: "Feature",
                    properties: { name: "A", style: "Line" },
                    geometry: {
                        type: "LineString",
                        coordinates: [
                            [135.268358769474617, 34.868902365440228], [135.268085068085128, 34.868280500005341], [135.268085068085128, 34.867935017176023], [135.268358769474617, 34.867831372044186], [135.269432521079523, 34.867986839692968], [135.270169409435852, 34.867624081388591], [135.27088524383916, 34.867658629867464], [135.27136948475902, 34.867883194626437], [135.272401128457886, 34.868228677673464], [135.272695883800424, 34.868556885223683], [135.273643311687124, 34.868677803464578], [135.275117088399753, 34.8690405571204], [135.275559221413545, 34.869178748568324], [135.27562238327269, 34.869835154774371], [135.275938192568248, 34.869748785836109], [135.276127678145571, 34.869645142990464], [135.276527703253294, 34.869956071135498], [135.277201429750534, 34.870025166119184], [135.27804358787202, 34.869506952326368], [135.278506774838803, 34.869489678477024], [135.278843638087466, 34.869196022482996], [135.279517364584649, 34.86914420072813], [135.280064767363655, 34.868919639412958], [135.280380576659212, 34.869057831064097], [135.280780601766935, 34.869766059631033], [135.281159572921638, 34.87014608220089], [135.281685921747538, 34.870249724415117], [135.282212270573524, 34.87069883916709], [135.282591241728198, 34.870802480684567], [135.282885997070736, 34.871130677961325], [135.282970212882901, 34.871614334718139], [135.28278072730555, 34.872322541264559], [135.283328130084499, 34.872719825192803], [135.283770263098262, 34.872944376129134], [135.28423345006513, 34.873030741710565], [135.284212396112082, 34.873220745670359], [135.283980802628662, 34.873255291797697], [135.284022910534759, 34.873618025258246], [135.284065018440828, 34.874084394498723], [135.284086072393848, 34.874602579440797], [135.284612421219805, 34.874930761548079], [135.285138770045734, 34.875535304105632], [135.285475633294368, 34.875569849260344], [135.285917766308131, 34.876053479902218], [135.28621252165064, 34.876813465162193], [135.286338845368931, 34.877055277180531], [135.286696762570557, 34.876968915827064], [135.287202057443466, 34.877573443395939], [135.28760208255116, 34.877953429877962], [135.287728406269366, 34.876675286546629], [135.287749460222443, 34.876295294156165], [135.288128431377118, 34.876174387118112], [135.289265344841141, 34.87626074930629], [135.289665369948892, 34.876485290570969], [135.289349560653307, 34.876934371260283], [135.289370614606383, 34.877625259837842], [135.289370614606383, 34.87810887838706], [135.289244290888092, 34.878730669483666], [135.288717942062192, 34.879162466088935], [135.288465294625723, 34.879145194268276], [135.288360024860509, 34.878367958582267], [135.28760208255116, 34.878005246080328], [135.28760208255116, 34.877227999615272], [135.287686298363354, 34.87634711140376], [135.288402132766635, 34.876139842217427], [135.288991643451624, 34.876243476875914], [135.289623262042824, 34.876468018187772], [135.290065395056615, 34.876364383812358], [135.29044436621129, 34.876433473410486],
                        ],
                    },
                }, {
                    type: "Feature",
                    properties: { name: "B", style: "arrow" },
                    geometry: {
                        type: "MultiLineString",
                        coordinates: [
                            [
                                [135.2680165085857, 34.868577144026894, 550],
                                [135.27915332374434, 34.869041754901545, 550],
                                [135.28708122606065, 34.87860441224568, 550],
                                [135.2903845186925, 34.87670745530531, 550],
                            ],
                        ],
                    },
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
            { lon: 135.26810285504533, lat: 34.86791223312818, lift: 150, text: "1" },
            { lon: 135.272092579146, lat: 34.86818861958434, lift: 150, text: "2" },
            { lon: 135.2755454274442, lat: 34.869371888597385, lift: 150, text: "3" },
            { lon: 135.2774929181002, lat: 34.86988146635745, lift: 150, text: "4" },
            { lon: 135.28293536496045, lat: 34.871531094734046, lift: 150, text: "5" },
            { lon: 135.28335425024352, lat: 34.87271478178891, lift: 150, text: "6" },
            { lon: 135.28402208984082, lat: 34.873732325977016, lift: 150, text: "7" },
            { lon: 135.2876475047976, lat: 34.876993600682056, lift: 150, text: "8" },
            { lon: 135.28936480661923, lat: 34.87743712404752, lift: 150, text: "9" },
            { lon: 135.287615702912, lat: 34.87738494495227, lift: 150, text: "10" },
            { lon: 135.29057327827147, lat: 34.876393535849175, lift: 150, text: "11" },
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

            // 線Bボタン
            let visibleB = true;
            const btnB = makeBtn("btn-guideB", "Summary Route:ON");
            const refreshB = () => {
                btnB.classList.toggle("active", visibleB);
                btnB.textContent = visibleB ? "Summary Route:ON" : "Summary Route:OFF";
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
})();
