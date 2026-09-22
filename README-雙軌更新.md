# Master Trade System V1.31.0 — V1.3 Production + V1.4 Candidate

本版本使用上載的 V1.30.14 程式作基礎。V1.3 是正式決策；V1.4 Candidate r1 是同一入場時點的 Shadow，尚未升格為 Production。

## 更新內容

- `Valid Candidate` 自動跟 V1.3 最終注碼：大於 0 = Yes，否則 No。
- `去到 TP2` 自動跟 MFE R：**嚴格大於 3.9** = Yes；3.9、低於3.9或留空 = No。新增、編輯、匯入和匯出都一致。
- Live Decision 和 Rulebook 分開顯示 V1.3 Production／V1.4 Candidate；Final Size、正式 Entry 和 Production 統計只用 V1.3。
- Candidate 獨立記錄 Size、Valid、Size Change Reason、Objective、Runner Eligibility、Shadow Outcome 和加權 R。
- 共用 E Source 補齊 Mon H/L、OPR、Active HTF Structure；亦接駁 FX／XAU 的 PDH/PDL。這部分同時供 V1.3 與 V1.4 使用，並非 Candidate 獨有升級。
- 保留 CSV、ZIP、圖片備份。CSV 追加研究欄位及完整入場快照 JSON；ZIP 保留 records.json、trades.csv 和 images。

## 每個 Setup 的流程

1. 在 Rulebook 填當時主／次判、方向、Raw P、Setup／E、Native Q、障礙及 Retest 資料。
2. V1.3 的 Final Size 和 Valid Candidate 自動顯示；另外查看 V1.4 Candidate。
3. 在 replay 入場一刻填 **Entry、SL、Replay 時刻**，按「凍結兩套入場決策」。兩套沿用同一 Entry／SL；凍結 Production／Candidate Size、Objective、候選條件與版本。
4. 選擇有冇成交，再**立即儲存紀錄**。尚未完成的 R／MFE／MAE 留空。
5. 繼續 replay，之後在紀錄庫打開該筆，補 Production Actual R 和獨立 Shadow Outcome。

凍結後如果入場條件有改，未存快照會顯示不一致並阻止儲存；需明確重設再凍結。已存紀錄只更新 outcome／事後研究標籤，不重新計算原本 Size 或 Objective。

如果已填 R、MFE 等結果才按凍結，會標記 `retrospective`。該筆仍可儲存及匯出，但不會冒充 Prospective 或計入入場前凍結的 A/B 統計。舊紀錄沒有 V1.4 快照的，不會事後自動補出 V1.4。

**未儲存的凍結快照只在目前頁面；凍結後要按原本儲存按鈕。**

## E Source

新共用來源須為 Sweep／Reclaim 模型，確認 first meaningful sweep、fresh level、有效 Sweep／Reclaim／Control Transfer，且 Retest 未失效。HTF Source 另須為 active structure。

- 只將 Raw P3 改為 Execution P2-E；Raw P3 和 Native Q 保留。
- 方向權限、P4、時間、風險及 RR 的限制仍然有效。
- 原有 Type A／XAU E 路線保留，沒有藉此把 Native Q2 改成 Q3。
- FX／XAU 的 Previous H/L Setup 選 PDH/PDL 可識別為共用來源；其他 Sweep Setup 亦可明確選 PDH/PDL。
- HSI-C OPR Continuation 不會單靠 OPR 名稱取得 Sweep E。
- 歷史紀錄不會因新增來源重新改寫 Final Size。

## V1.4 Candidate r1 的固定判法

原文含「0/0.25」「0.25–0.5」等範圍。本版作以下明確實作，方便穩定比較；它們是研究設定，不是已驗證的交易優勢。

| 情景 | Candidate 判法 |
| --- | --- |
| 雙健康同向 | 原生P1/P2 Q3 = 1；Q2 = 0.5；未經E的P3 Q3 = 0.5、Q2 = 0.25 |
| 雙健康 Raw P3→P2-E | Q3 cap 0.5；Q2可0.5，之後仍受 Negative／障礙限制 |
| 同向有弱勢／Single Transition | P1/P2/P2-E Q3 = 0.5、Q2 = 0.25；P3 Q3 = 0.25、Q2 = 0 |
| Aligned Transition | cap 0.25；Q2 = 0；P3 Q3要確認 meaningful boundary |
| Directional + Neutral | 跟 directional 一邊；P1/P2/P2-E Q3 = 0.5、Q2 = 0.25；P3 Q3要 meaningful boundary先0.25 |
| Strict Neutral／Range | True Boundary P1 Q3 = 0.5、Q2 = 0.25；P2/P2-E Q3 = 0.25、Q2 = 0；P3 Q3要清楚boundary先0.25 |
| Mixed Transition | 只順Main；P1/P2/P2-E Q3最高0.5；Q2須meaningful boundary及冇Negative先0.25，否則0；P3 Q3須boundary先0.25 |
| 一般方向衝突 | cap 0.25；P1/P2 Q3可0.25；Q2須meaningful boundary及冇Negative；P3 Q3須boundary；P3 Q2 = 0 |
| 雙健康但反向 | 0 |
| Counter Weak Main | 原生P1/P2 + Q3 + active HTF + clear control transfer + 原有Route A/B確認：0.25；其他0 |
| Counter Healthy Main | 只限active HTF原生P1 + Q3 + clear sweep/reclaim/control transfer：0.25；普通P2／P2-E不解鎖 |
| P4／真正range middle／控制失效／RR<1.5／Hard Veto | 0；後面條件不能救回 |

一般衝突的0.25 cap亦用於 Directional Transition × Confirmed 反方向。上述沒有明確定義的其他反向路線採0；保留原生P身份，不把E當新方向權限。

- High Negative：`R+S+Structured` 或 `F+S`，降一級：1→0.5→0.25→0。
- Medium Negative：`S+Structured` 或 `F+Close Through`，禁止升注，沒有再額外降一級。
- P3-MID + Structured 禁止升注及 Runner；P3-EXT 保守封頂0.5；雙健康Q3且空間清晰時採Reaction-first，其餘路線仍按自身Objective與限制。
- 位置／Range及重大HTF障礙沿用限制；Candidate 的0不會再被後續步驟升回。
- Opening Context 只作分組，不直接改Size。
- 舊版 `Aligned Transition Shadow Size = 0.5` 仍作歷史研究欄保留，畫面標明「非V1.4」；沒有拿來作本版 Candidate Size。

## Runner：入場資格與2R判定分開

Candidate 顯示 `Conditional` 不代表已開 Runner。到2R時須記錄：

- Shadow確實成交、持倉確實到2R。
- `Gate 已判定`。
- Break、Acceptance、Hold、Extend 四項是否成立。

Conditional且四項全有：80%@2R，20%按實際Runner退出R計。Runner在4R退出，未加權結果為2.4R；Runner在BE退出，為1.6R。

Conditional、Gate已判但四項未全有：100%@2R，結果2R。Gate未判／Runner仍未退出，結果留空，不會當0。**MFE大於3.9只改TP2旗標，不會推定SL先後、Gate成立或Runner成交。**

Q2、Counter Healthy、空間壓縮等預設No；非Runner或未到2R的實際管理結果由你填。Counter Weak預設No；只有到2R時明確記錄Main已真正轉成交易方向的Transition，且原空間及control條件合格，才可用同一Gate判Runner，入場Size保持原樣。

## R 的單位及 A/B

沿用舊App：**Production Actual R 已乘 V1.3 Size**。例如0.25注、價格走2R，Actual R填0.5。Shadow管理結果輸入為「未乘Size」的每單位R，App另外計加權值。

| 欄位 | 計算／用途 |
| --- | --- |
| V1.3 Actual R | 正式Entry的Actual R；Skip／Production 0注不入正式performance |
| V1.4 Size-only R | Production Actual R ÷ Production Size × Candidate Size；保留V1.3管理 |
| V1.4 Runner-only R | Shadow Management unit R × Production Size；沒有Runner資格時沿用Production管理 |
| V1.4 Full R／Shadow R | Shadow Management unit R × Candidate Size；Candidate veto = 0 |
| V1.4-only Base Management R | Production沒有做；獨立填同Entry/SL按V1.3管理的假設unit R，再乘Candidate Size |
| Changed trades only | Size／Objective改變，或實際啟動Runner；另列ΔR |

Production Entry = No、Candidate Valid = Yes的單，仍要凍結及記錄獨立Shadow MFE／MAE／Outcome。是否成交由 `Shadow Trade` 記錄，Candidate Valid不等於必然成交。這些單單獨列出，**不混入正式Production或共同Production trades的配對表**。

紀錄庫的A/B使用目前篩選，只取入場前凍結、四組結果齊備的Production trades。可把日期設為2026-01-01至2026-06-30。未完成不是0，不會納入配對平均；顯示未齊結果數。

報表包含Total R、R/Setup、Expectancy/trade、PF、按Replay Entry排序的trade-by-trade Max DD、最差5單佔總虧損百分比，以及已啟動Runner的4R capture rate。這不是持倉內浮動資產曲線DD。不同改動原因可以重疊，分組ΔR不可直接相加。

## 相容及備份

資料庫名稱與 localStorage key 不變。在原本相同網址更新時保留既有文字與圖片；更換域名／瀏覽器則需匯出ZIP再匯入。升級前先用舊版「匯出CSV＋照片 ZIP」備份。

CSV追加欄位，不刪原欄。新紀錄的入場快照 JSON 是入場Size／Objective的依據，屬唯讀資料；可修改 `V1.4 Outcome ...` 結果欄再匯入。舊紀錄的Final Size、Actual R不會被重跑Candidate取代。自動Valid／TP2則按已存Final Size／MFE重新衍生。

## 已完成的驗證

- 1,224個規則／帳本斷言通過，包含1,176個主次狀態、方向、P與Q的鏡像組合。
- V1.3的8個核心方向、Matrix、Range、Obstacle、Veto、Objective／最終決策函數與上載版逐一hash一致；共用E接駁在其前面獨立處理。
- DOM模擬整合測試：初始化、雙軌Live、三個指定例子、共用E、不一致快照阻擋、儲存、事後編輯、自動TP2、CSV往返、ZIP文字／圖片entry及修改CSV後保留快照。
- V1.4-only的假設虧損沒有改Production平均R。
- 本次瀏覽器限制不允許開本機file URL，未完成實際瀏覽器畫面／PWA安裝／IndexedDB運作驗證；DOM模擬測試不等同完整瀏覽器測試。

可重跑：

```sh
node tests/dual-track-engine.test.cjs
python tests/generate-dom.py
node tests/integration.test.cjs
```
