# English Bible versions

The Bible engine now uses the English version catalog from **bobuk/holybooks** rather than treating KJV as the only Bible.

The repository currently advertises these English versions in `EN/index.json`:
- ERV — Easy-to-Read Version
- AMP — Amplified Bible
- ASV — American Standard Version
- CPDV — Catholic Public Domain Version
- ESV — English Standard Version
- KJV — King James Version
- NASB — New American Standard Bible
- WEB — World English Bible

The Workbench loads a selected version/book JSON file from the repository and caches it in the browser after first access. This keeps the application translation-neutral and avoids bundling third-party texts into the Workbench distribution.

Source: https://github.com/bobuk/holybooks/tree/master/EN

Important: availability in the source repository does not by itself establish redistribution rights for every translation. The Workbench therefore treats these as external source-provider data rather than claiming ownership or licensing for the text.


## KJV local download recovery

The Settings → Bible → Download KJV operation uses the HolyBooks KJV book files as its primary source. Each response is validated for usable chapters and verses before it is stored. If a KJV book cannot be obtained or parsed from the primary source, the downloader retries that book from the public KJV book source at `aruljohn/Bible-kjv`. A download does not trust stale in-memory promises from a previous failed page load.
