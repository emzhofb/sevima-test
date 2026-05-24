# Reusable Prompts — Spec Workflow

Catatan prompt yang dipakai untuk membuat spec **{{nama-fitur}}**, dirapikan agar bisa dipakai ulang untuk fitur lain. Ganti bagian `{{...}}` dengan konteks proyek Anda.

---

## 1. Membuat Spec Awal (Initial Request)

Prompt untuk memulai spec baru. Kiro akan menanyakan tipe spec (Feature / Bugfix / Quick Plan) dan workflow (Requirements-First / Design-First).

**Prompt asli yang dipakai:**

> halo, tolong buatkan plan.md yang isinya adalah project {{deskripsi singkat fitur, mis. chat untuk customer dan customer service}}, yang mana {{flow utama, mis. chat ini nantinya dibutuhkan nama, email, dan no hp, juga message untuk mulai percakapan}}, kemudian {{aktor lain dan kebutuhannya, mis. customer service bisa menerima chat nya dan bisa melihat siapa saja customer yang mau complain atau menanyakan sesuatu}}, untuk stack teknologinya {{constraint stack, mis. boleh apapun}} tapi tolong dibikin supaya {{behavior penting, mis. realtime}} ya

**Template reusable:**

```
halo, tolong buatkan spec untuk {{nama-fitur}}.

Deskripsi fitur:
- {{apa yang dilakukan user}}
- {{data yang dibutuhkan}}
- {{behavior penting, mis. realtime / offline-first / multi-tenant}}

Stack:
- {{bebas | wajib pakai X | sebutkan jika ada constraint}}

Constraint tambahan (opsional):
- {{performance, security, scale, dst}}
```

**Tips:**
- Sebut "realtime" / "offline-first" / "high-traffic" jika relevan — itu mempengaruhi keputusan arsitektur di design.
- Kalau ingin pseudocode di design, pilih opsi **Technical Design [High-Level Design, Low-Level Design]** saat ditanya.
- Kalau ingin requirements yang lebih dulu (lebih bisnis-oriented), pilih opsi **Requirements**.

---

## 2. Generate Tasks dari Requirements + Design

Setelah requirements.md dan design.md ada, generate task list.

**Prompt asli:**

> Create the tasks for {{nama-fitur}}

**Template reusable:**

```
Create the tasks for {{nama-fitur}}
```

atau dalam Bahasa Indonesia:

```
Buatkan task list untuk {{nama-fitur}}
```

---

## 3. Quality Check — Cek Tingkat Kesulitan untuk Junior

Setelah spec selesai, tanyakan apakah masih bisa dikerjakan oleh level skill tertentu.

**Prompt asli:**

> coba tolong check kembali, apakah dengan design requirement dan tasks ini bisa di kerjakan dengan {{level skill, mis. junior programmer atau ai paling murah}} sekalipun apa tidak ? karena takutnya masih low level atau senior programmer yang paham

**Template reusable:**

```
Tolong cek apakah requirements + design + tasks untuk {{nama-fitur}} ini
masih bisa dikerjakan oleh {{level skill, mis. junior programmer / AI model
murah / fresh graduate}}? Sebutkan bagian mana yang terlalu advanced dan
beri rekomendasi.
```

**Variasi:**
- "...bisa dikerjakan oleh **mid-level** programmer?"
- "...bisa dikerjakan oleh **AI dengan context window kecil** (mis. 8k token)?"
- "...bisa dikerjakan oleh **kontraktor offshore** yang baru kenal stack ini?"

---

## 4. Refine Tasks — Junior-Friendly Tanpa Downgrade Fitur

Kalau hasil cek bilang spec terlalu sulit, tapi Anda tidak mau memotong fitur.

**Prompt asli:**

> saya tidak mau downgrade, tapi saya pengen ini tetep bisa di kerjakan oleh {{level skill, mis. junior programmer/junior ai}}

**Template reusable:**

```
Saya tidak mau downgrade fitur, tapi tasks-nya harus tetap bisa dikerjakan
oleh {{level skill}}. Tolong tulis ulang tasks.md dengan:
- File path eksplisit untuk setiap task
- Snippet kode siap copy-paste (bukan pseudocode)
- Glossary inline untuk istilah teknis (mis. CAS, pub/sub, sliding window)
- Perintah shell konkret dengan versi pin
- Step-by-step micro-steps (Langkah a/b/c/d)
- "Why this matters" untuk task tricky
- "How to verify:" di akhir setiap task
```

**Hasil yang diharapkan:** tasks.md akan jadi 2-3x lebih panjang tapi setiap task self-contained.

---

## 5. Mark Semua Task Jadi Required

Default tasks.md menandai sebagian test sebagai opsional (`- [ ]*`). Kalau Anda ingin semua wajib:

**Prompt asli:**

> tolong mark semua task jadi required donk, soalnya yang {{jenis test, mis. unit test}} kayanya ada yang masih belum required kan

**Template reusable:**

```
Tolong tandai semua task di tasks.md sebagai wajib (required), termasuk
unit test, property test, dan integration test. Hapus semua marker `*`
opsional.
```

---

## 6. Prompt Tambahan yang Sering Berguna (Bonus)

### Update spec setelah ada perubahan requirement

```
Saya butuh tambahan: {{deskripsi requirement baru}}.
Tolong update requirements.md, lalu sesuaikan design.md dan tasks.md
agar konsisten.
```

### Generate spec dari attachment / dokumen existing

```
Berdasarkan {{dokumen yang di-attach: BRD / API spec / mockup}},
tolong buatkan spec untuk {{nama-fitur}}.
```

### Tambah correctness property baru

```
Tambahkan correctness property baru ke design.md:
- Property: {{deskripsi}}
- Validates: Requirement {{X.Y}}
Lalu tambahkan property test yang sesuai di tasks.md.
```

### Cek konsistensi antar dokumen

```
Tolong verify bahwa requirements.md, design.md, dan tasks.md untuk
{{nama-fitur}} masih konsisten satu sama lain. Sebutkan kalau ada
requirement yang tidak ter-cover di design atau tasks.
```
