# Extra Fooding PT NEW ASIA INTERNATIONAL

Web app React + Vite + Supabase.

## Fitur utama
- Login Admin dan Leader.
- Leader otomatis terikat ke satu kelompok kerja dari `profiles.work_group_id`.
- Leader hanya melihat karyawan kelompoknya.
- Admin dapat membuat, membuka, mengunci, mengubah, dan menghapus periode.
- Periode wajib 7 hari agar hasil cetak mengikuti format form Excel mingguan.
- Admin dapat mengoreksi data submitted.
- Audit perubahan Extra Fooding.
- Export CSV.
- Cetak form Extra Fooding A4 portrait per kelompok, dengan format yang menyerupai `kertas EF - Saran.xlsx`: judul bilingual, perusahaan, departemen, grup kerja, periode, tanda tangan, NIK, nama, 7 tanggal, total, tanda tangan karyawan, footer nomor sistem, dan keterangan shift.

## Build
```bash
npm install
npm run build
npm run dev
```

## Environment
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Jangan pernah memasukkan Supabase service-role/secret key ke frontend.

## NIK-only leader access
Leader tidak lagi menggunakan email/password. Halaman `/` meminta NIK, lalu database mengembalikan nama dan satu kelompok kerja sesuai NIK. Jalankan `supabase_nik_only.sql` di Supabase SQL Editor sebelum deploy versi ini. Admin tetap dapat login melalui `/admin`. Jangan menaruh Service Role key di frontend.
