# V1.31.0 更新安裝

1. 在舊版先匯出「CSV＋照片 ZIP」備份。
2. 解壓本安裝包，將 `MasterTradeSystemV1_31_0` 裡面嘅內容覆蓋到原網站相同位置。唔好只換app.js；必須一齊更新index.html、styles.css、dual-track-engine.js、service-worker.js、manifest及icons。
3. 關閉舊頁／PWA再打開及重新整理，確認右上角顯示V1.31.0。
4. 原網址、原瀏覽器的文字／圖片資料庫名稱不變。新網址／新裝置可匯入原ZIP。

`tests`、各README不用上傳也可運行；`dual-track-engine.js`必須與app.js同一層。

離線PWA需透過HTTPS（本機開發可localhost）提供，唔係直接雙擊ZIP或file URL安裝。本次只提供更新安裝包，沒有替你發佈或覆蓋線上網站。

詳細規則、R單位及凍結／結果補錄流程見 `README-雙軌更新.md`。V1.3繼續作Production；V1.4 Candidate是研究版本。
