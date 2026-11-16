/* =====================================================
   KONFIGURASI SUPABASE & DATA PASLON — Pixel Edition
   ===================================================== */
const SUPABASE_URL = "https://pzlkzccpssdhtgfnxend.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Q5tr8IZ6m03mLtM3ciClbA_5HrhWCPB";

// Kode rahasia untuk membuka Dashboard Admin melalui layar Code Gate
const ADMIN_ACCESS_CODE = "ADMIN2026";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const paslonDetails = {
    1: {
        number: "KANDIDAT 01",
        title: "Raffa & Dicky",
        tagline: "Raffa Agung Nugroho (XI PPLG B) & Dicky Pratama (X PPLG B)",
        color: "#38BAFF",
        emoji: "💻",
        desc: "Pasangan Raffa & Dicky hadir dengan misi modernisasi sistem kerja internal organisasi. Berfokus pada efisiensi alur komunikasi berbasis teknologi, transparansi pengelolaan, dan keterbukaan informasi bagi seluruh anggota.",
        visi: "Mewujudkan ITSC sebagai organisasi yang menerapkan kedisiplinan, kesetiaan dan bertanggungjawab serta menciptakan generasi yang berkualitas dan membawa perubahan nyata bagi lingkungan sekolah dan masyarakat.",
        misi: [
            "Transparansi anggaran & laporan keuangan realtime",
            "Platform Skill Hub & Workshop digital anggota",
            "Digitalisasi alur persetujuan & manajemen proker",
            "Sistem absensi & tracking kinerja berbasis aplikasi",
            "Newsletter bulanan & portal informasi terpadu"
        ]
    },
    2: {
        number: "KANDIDAT 02",
        title: "Fadil & Fatchul",
        tagline: "Muhammad Fadil (XI PPLG A) & Muhammad Fatchul Mubarok (X PPLG B)",
        color: "#FF8C1A",
        emoji: "🎨",
        desc: "Pasangan Fadil & Fatchul berfokus membangun lingkungan organisasi yang ramah, inklusif, dan menghargai keberagaman. Mendorong apresiasi seni, budaya, serta memperkuat jejaring kolaboratif antar-divisi.",
        visi: "Mewujudkan ITSC sebagai organisasi yang menerapkan kedisiplinan, kesetiaan dan bertanggungjawab serta menciptakan generasi yang berkualitas dan membawa perubahan nyata bagi lingkungan sekolah dan masyarakat.",
        misi: [
            "Mengoptimalkan saluran komunikasi dan aspirasi siswa.",
            "Forum Diskusi Terbuka Mingguan lintas divisi",
            " Menerapkan nilai-nilai pancasila sebagai fondasi utama dalam pembangunan moral dan etika dalam bersosialisasi.",
            "Mendorong budaya kreativitas di bidang teknologi digital"
        ]
    },
    3: {
        number: "KANDIDAT 03",
        title: "Choirul & Dika",
        tagline: "Muhammad Choirul Arifin (XI PPLG B) & Ramayudika Septyan Supermana (X PPLG B)",
        color: "#9B59EF",
        emoji: "⚡",
        desc: "Pasangan Choirul & Dika hadir dengan visi akselerasi kinerja melalui optimalisasi struktur operasional. Menyederhanakan birokrasi, mengeksekusi program prioritas tepat sasaran, dan mendorong pengukuran kinerja berbasis data.",
        visi: "Menjadikan ITSC sebagai wadah pengembangan minat dan bakat bagi keluarga SIJA yang religius, kreatif,  bertanggungjawab, serta berdaya saing tinggi.",
        misi: [
            "Menyelenggarakan kegiatan positif untuk mengembangkan kreativitas, minat, bakat, dan potensi seluruh keluarga SIJA.",
            "Menanamkan nilai-nilai religius, kedisiplinan, dan tanggung jawab dalam setiap kegiatan.",
            "Membangun rasa kekeluargaan, lingkungan positif, dan kerja sama antaranggota ITSC.",
            "Memaksimalkan kegiatan untuk meningkatkan kemampuan serta wawasan anggota agar mampu bersaing dan berprestasi di dalam maupun luar sekolah."
        ]
    }
};