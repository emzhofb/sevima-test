# Kumpulan Prompt Proyek Hirakata

Dokumen ini menyimpan prompt-prompt penting yang digunakan dalam pengerjaan proyek Hirakata.

---

## 1. Prompt Evaluasi Kesiapan Proyek (Senior Developer)

Gunakan prompt ini saat ingin meminta AI bertindak sebagai Senior Developer untuk mengevaluasi apakah dokumen spesifikasi yang dibuat oleh CTO sudah cukup jelas dan aman untuk diimplementasikan oleh Junior/Mid developer (seperti Gemini Flash & Codex GPT):

```text
kamu adalah senior developer, coba tolong pelajari requirements.md, design.md, dan tasks.md yang diberikan oleh CTO claude opus 4.7, apakah sudah bisa dan aman jika junior dan mid developer seperti flash dan codex gpt 5.4 mengimplementasikan ini
```

---

## 2. Reusable Prompt Template untuk Pengerjaan Issue (Git & Security Workflow)

Salin teks di bawah ini (ganti bagian `{{ISSUE_NUMBER}}` dan `{{FEATURE_NAME}}`) lalu berikan langsung ke AI coding assistant lainnya untuk mulai pengerjaan issue berikutnya dengan aman:

```text
Tolong kerjakan issue https://github.com/emzhofb/sevima-test/issues/{{ISSUE_NUMBER}} dan centang jika sudah selesai di file tasks.md jika semua subtask sudah terpenuhi.

PENTING - HARAP IKUTI ATURAN & WORKFLOW BERIKUT SECARA KETAT:
1. Repositori ini bersifat privat. DILARANG menggunakan browser tool/penelusuran web untuk mengakses tautan GitHub di atas. Semua detail dan spesifikasi teknis pengerjaan harus dibaca dari dokumen spesifikasi lokal di dalam folder `.kiro/specs/` (terutama `requirements.md`, `design.md`, dan `tasks.md`).
2. Sebelum mulai menulis kode atau membuat perubahan apa pun pada file proyek, lakukan langkah-langkah Git berikut di terminal secara berurutan:
   a. Pindah ke branch utama: git checkout main
   b. Tarik perubahan terbaru: git pull origin main
   c. Sinkronkan daftar branch lokal dengan remote: git fetch --prune
   d. Buat dan masuk ke branch fitur baru: git checkout -b feat/{{FEATURE_NAME}}
3. Tulis implementasi kode yang bersih sesuai dengan spesifikasi formal dan algoritma yang dijelaskan di `design.md`.
4. Tulis pengujian unit dan property-based testing (menggunakan fast-check dan vitest) untuk memverifikasi correctness properties. Pastikan seluruh test suite di proyek lulus 100% dengan menjalankan command `npx vitest run`.
5. Push code nya dan buat pull request ke branch utama.
```

---

## 3. Reusable Prompt Template untuk Code Review PR via CLI (Senior Developer)

Gunakan prompt ini saat ingin meminta AI bertindak sebagai Senior Developer untuk mereview sebuah Pull Request langsung lewat GitHub CLI, menjalankan test suite secara lokal, dan mem-posting komentar review ke GitHub:

```text
Tolong review PR https://github.com/emzhofb/sevima-test/pull/{{PR_NUMBER}} via CLI sebagai senior developer.

Langkah-langkah yang harus dilakukan secara berurutan:
1. Fetch detail dan deskripsi PR dengan: gh pr view {{PR_NUMBER}} --repo emzhofb/kiro.bashocode.hirakata
2. Fetch full diff PR dengan: gh api repos/emzhofb/kiro.bashocode.hirakata/pulls/{{PR_NUMBER}}/files
3. Checkout ke branch PR dan jalankan seluruh test suite:
   git fetch origin <branch-name>
   git checkout <branch-name>
   cd frontend && npx vitest run --reporter=verbose
4. Analisis diff secara menyeluruh: arsitektur, correctness, edge case, test coverage, dan security.
5. Tulis komentar review dalam Bahasa Indonesia yang mencakup:
   - Hasil test (jumlah passed/failed)
   - Verdict keseluruhan (Approved / Request Changes)
   - Temuan dikelompokkan per severity: 🔴 HIGH, 🟡 MEDIUM, 🟢 LOW
   - Setiap temuan berisi: deskripsi masalah, contoh kode reproduksi (jika ada), dan saran perbaikan konkret
   - Summary tabel di akhir
6. Post komentar review ke GitHub dengan: gh pr comment {{PR_NUMBER}} --repo emzhofb/kiro.bashocode.hirakata --body-file <review_file>
7. Jika ternyata code nya sesuai dengan design.md, tidak ada temuan, dan semua test lulus, maka lanjutkan:
   a. Merge PR dan hapus remote branch: gh pr merge {{PR_NUMBER}} --repo emzhofb/kiro.bashocode.hirakata --merge --delete-branch
   b. Kembali ke main, pull, dan hapus local branch: git checkout main && git pull origin main && git branch -d <branch-name>
   c. Close github issue yang sudah selesai.

PENTING:
- Repositori ini bersifat privat. Jangan buka browser untuk mengakses link GitHub — gunakan gh CLI dan baca file lokal.
- Jalankan test SEBELUM menulis review agar hasil test aktual tercantum di komentar.
- Jangan approve PR yang memiliki temuan 🔴 HIGH yang belum diaddress.
```

---

---

## 4. Reusable Prompt Template untuk Memperbaiki Temuan Review PR via CLI (Junior Developer)

Gunakan prompt ini ketika Junior Developer menerima feedback review (Request Changes) dari Senior Developer untuk memperbaiki PR langsung lewat CLI secara aman:

```text
Tolong perbaiki temuan review pada PR https://github.com/emzhofb/sevima-test/pull/{{PR_NUMBER}} via CLI sebagai Junior Developer.

Langkah-langkah yang harus dilakukan secara berurutan:
1. Baca komentar review dari senior menggunakan GitHub CLI: gh pr view {{PR_NUMBER}} --comments
2. Pahami seluruh temuan review, terutama temuan berkategori 🔴 HIGH.
3. Lakukan perbaikan pada berkas-berkas proyek terkait sesuai rekomendasi senior.
4. Tulis atau perbarui pengujian unit (unit tests) yang sesuai untuk menguji skenario perbaikan (misal: proteksi double-counting, optimistic update, dll.).
5. Jalankan seluruh test suite proyek untuk memastikan tidak ada regresi dan semua tes lulus 100%: cd frontend && npx vitest run
6. Commit perubahan Anda dengan pesan yang jelas (misal: fix(store): ...) dan push ke branch PR Anda.
7. Berikan komentar balasan di PR tersebut untuk memberi tahu senior bahwa Anda telah menyelesaikan perbaikan dengan detail perbaikan dan hasil test yang lulus: gh pr comment {{PR_NUMBER}} --body "..."
8. Laporkan kepada user rangkuman berkas yang diubah, test yang ditambahkan, dan bukti bahwa tes telah lulus.

PENTING:
- Repositori ini bersifat privat. DILARANG membuka browser — gunakan gh CLI dan git secara lokal.
- Pastikan semua temuan 🔴 HIGH telah diselesaikan secara tuntas sebelum mengabari senior.
```

## 5. Reusable Prompt Template untuk Verifikasi Fix Junior & Merge PR via CLI

Gunakan prompt ini setelah junior developer mengupload fix-nya ke branch PR. Prompt ini memerintahkan AI untuk mengecek commit fix terbaru, menjalankan test, dan jika semua OK langsung merge, hapus branch, dan sync ke main:

```text
Tolong cek apakah fix dari junior sudah diupload di PR https://github.com/emzhofb/sevima-test/pull/{{PR_NUMBER}}.

Lakukan langkah-langkah berikut secara berurutan:
1. Cek commit terbaru di PR: gh api repos/emzhofb/kiro.bashocode.hirakata/pulls/{{PR_NUMBER}}/commits --jq '.[] | {sha: .sha[0:8], message: .commit.message, date: .commit.author.date}'
2. Fetch dan checkout ke branch PR, lalu pull perubahan terbaru:
   git fetch origin <branch-name> && git checkout <branch-name> && git pull origin <branch-name>
3. Lihat diff commit fix dengan: git show <sha-fix> --stat && git show <sha-fix>
4. Verifikasi semua issue dari review sebelumnya sudah diaddress.
5. Jalankan seluruh test suite: cd frontend && npx vitest run --reporter=verbose
6. Jika semua test pass dan semua 🔴 HIGH sudah difix:
   a. Merge PR dan hapus remote branch: gh pr merge {{PR_NUMBER}} --repo emzhofb/kiro.bashocode.hirakata --merge --delete-branch
   b. Kembali ke main, pull, dan hapus local branch: git checkout main && git pull origin main && git branch -d <branch-name>
   c. Close github issue yang sudah selesai.
7. Laporkan hasilnya: jumlah test passed, daftar fix yang sudah diverifikasi, dan konfirmasi bahwa main sudah up-to-date.

PENTING:
- Jangan merge jika masih ada test yang gagal.
- Jangan merge jika ada temuan 🔴 HIGH dari review sebelumnya yang belum diaddress.
- Gunakan gh CLI dan git — jangan buka browser.
```