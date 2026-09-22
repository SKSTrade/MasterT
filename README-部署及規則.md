# V1.31.0 更新提示

本檔下方保留舊版部署筆記。最新雙軌規則請先閱讀 `README-雙軌更新.md`；最新安裝步驟見 `README-部署及安裝.md`。

# Master Trade System V1.30.14
## ZIP Round-trip Editing

V1.30.14解決：

> 匯出Backup ZIP → 修改trades.csv → 重新壓ZIP → 匯入更新

## 舊版點解失敗

舊版ZIP reader只接受App自己產生嘅Store／無壓縮ZIP。
Windows、macOS、7-Zip等重新壓縮通常會使用Deflate，部分亦會使用data descriptor，所以舊版會報：
- 只支援由Master Trade App匯出嘅備份ZIP
- ZIP data descriptor is not supported
- Invalid ZIP structure

另外舊版：
1. records.json優先於trades.csv，所以CSV修改會被忽略。
2. 同紀錄ID會當重複紀錄Skip，唔會更新。

## V1.30.14新行為

### ZIP格式
支援：
- Store／無壓縮
- Deflate
- data descriptor類ZIP
- ZIP入面多一層頂層folder
- macOS __MACOSX額外metadata會忽略

不支援：
- 加密／有密碼ZIP
- 非一般Store／Deflate壓縮格式

### CSV + JSON round-trip
當ZIP同時有：
- records.json
- trades.csv

App會：
1. 以records.json做完整backup base
2. 以紀錄ID比較trades.csv
3. 如果某一行CSV同records.json對應資料有改動：
   - 將CSV改動套用
   - 同ID本機紀錄會更新
4. CSV冇改嘅同ID紀錄仍然Skip
5. CSV已prune走嘅舊／隱藏欄位仍由records.json保留
6. 圖片保持跟紀錄ID

## 建議操作

1. App匯出「CSV＋照片 ZIP」
2. 解壓
3. 只修改trades.csv
4. 唔好改「紀錄ID」
5. 保存CSV（建議用CSV UTF-8／UTF-8 with BOM）
6. 將原本內容重新壓成一般.zip
7. App按「匯入／更新備份ZIP」

可以將整個folder壓成ZIP；App會自動處理多一層folder。

## 注意

如果只係普通舊Backup、CSV完全冇改：
- 同ID仍然Skip
- 唔會無條件覆蓋本機資料

只有App偵測到trades.csv相對records.json有實際改動，先會更新同ID紀錄。
