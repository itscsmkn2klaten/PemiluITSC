// =====================================================
//  APP.JS — Pixel Edition + SHA-256 Token Hash + Supabase
// =====================================================

let hasVoted = false;
let votedPaslonId = null;
let pendingVoteId = null;
let activeVoter = null;   // { tokenHash }
let isAdminSession = false;
let cachedAdminPin = null;
let isSubmitting = false;
let tokenStats = { total: 0, used: 0, remaining: 0 };

// ── Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('pageLoader');
    if (loader) {
        setTimeout(() => {
            loader.style.opacity = '0';
            loader.style.visibility = 'hidden';
            setTimeout(() => loader.remove(), 500);
        }, 600);
    }

    initAdminChart();
    await fetchRealtimeData();
    subscribeSupabaseRealtime();

    // Auto-sync setiap 3 detik agar dashboard admin selalu live
    setInterval(async () => {
        await fetchRealtimeData();
    }, 3000);

    updateAdminClock();
    setInterval(updateAdminClock, 1000);

    document.getElementById('visiModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeVisiModal();
    });
    document.getElementById('voteConfirmModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeVoteConfirm();
    });
    document.getElementById('fsExitConfirmModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) cancelExitFullscreen();
    });
    document.getElementById('footerInfoModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeInfoModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const fsConfirmModal = document.getElementById('fsExitConfirmModal');
            if (fsConfirmModal && fsConfirmModal.classList.contains('open')) {
                cancelExitFullscreen();
                return;
            }
            closeVisiModal();
            closeVoteConfirm();
            closeInfoModal();
            if (typeof closeFullscreenChart === 'function') closeFullscreenChart();
        }
    });
});

// ═══════════════════════════════════════════════════════
//  CRYPTO SHA-256 HASHING & TOKEN GENERATOR
// ═══════════════════════════════════════════════════════
async function sha256Hex(plainText) {
    const normalized = (plainText || '').trim().toUpperCase();
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function createSecureRandomToken() {
    // Menghindari karakter ambigu (0, O, 1, I) agar pemilih tidak salah ketik
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randomBytes = new Uint8Array(8);
    crypto.getRandomValues(randomBytes);

    let part1 = '';
    let part2 = '';
    for (let i = 0; i < 4; i++) part1 += chars[randomBytes[i] % chars.length];
    for (let i = 4; i < 8; i++) part2 += chars[randomBytes[i] % chars.length];

    return `ITSC-${part1}-${part2}`;
}

async function loadAdminTokenStats() {
    if (!isAdminSession || !cachedAdminPin) return;
    try {
        const { data, error } = await supabaseClient.rpc('get_token_stats', {
            p_admin_pass: cachedAdminPin
        });

        if (!error && data) {
            tokenStats = {
                total: data.total ?? 0,
                used: data.used ?? 0,
                remaining: data.remaining ?? 0
            };
            totalDptCount = tokenStats.total;

            const elTotal = document.getElementById('tkTotalCount');
            const elUsed = document.getElementById('tkUsedCount');
            const elRem = document.getElementById('tkRemCount');
            if (elTotal) elTotal.textContent = tokenStats.total;
            if (elUsed) elUsed.textContent = tokenStats.used;
            if (elRem) elRem.textContent = tokenStats.remaining;
        }
    } catch (err) {
        console.error('Gagal memuat statistik token:', err);
    }
}

async function generateHashedTokens() {
    if (!isAdminSession || !cachedAdminPin) return;

    const qtyInput = document.getElementById('tokenQtyInput');
    const statusEl = document.getElementById('tokenGenStatus');
    const btnGen = document.getElementById('btnGenerateTokens');
    const qty = parseInt(qtyInput?.value, 10);

    if (isNaN(qty) || qty < 1 || qty > 1000) {
        if (statusEl) {
            statusEl.textContent = 'Masukkan jumlah token antara 1 sampai 1.000.';
            statusEl.style.color = '#FF5F57';
        }
        return;
    }

    if (btnGen) btnGen.disabled = true;
    if (statusEl) {
        statusEl.textContent = `Membuat & melakukan hashing SHA-256 untuk ${qty} token...`;
        statusEl.style.color = '#38BAFF';
    }

    try {
        const tokenSet = new Set();
        while (tokenSet.size < qty) {
            tokenSet.add(createSecureRandomToken());
        }

        const plainTokens = Array.from(tokenSet);
        const hashedTokens = await Promise.all(plainTokens.map(t => sha256Hex(t)));

        const { data: insertedCount, error } = await supabaseClient.rpc('admin_insert_token_hashes', {
            p_admin_pass: cachedAdminPin,
            p_hashes: hashedTokens
        });

        if (error) throw error;

        // Unduh CSV berisi token asli (sekali jalan saat generate)
        downloadGeneratedTokensCSV(plainTokens);

        if (statusEl) {
            statusEl.textContent = `Berhasil membuat ${insertedCount} token hash! File CSV token asli otomatis diunduh.`;
            statusEl.style.color = '#4FC955';
        }
        showToast(`${insertedCount} TOKEN HASH BERHASIL DIBUAT!`);
        await fetchRealtimeData();
    } catch (err) {
        console.error(err);
        if (statusEl) {
            statusEl.textContent = `Gagal generate token: ${err.message}`;
            statusEl.style.color = '#FF5F57';
        }
        showToast('GAGAL GENERATE TOKEN!');
    } finally {
        if (btnGen) btnGen.disabled = false;
    }
}

function downloadGeneratedTokensCSV(tokens) {
    const rows = [
        ['DAFTAR TOKEN PEMILU ITSC 2026 (RAHASIA PANITIA)'],
        ['Waktu Generate', new Date().toLocaleString('id-ID')],
        ['Total Token', tokens.length],
        [],
        ['No', 'Token_Pemilih', 'Status']
    ];

    tokens.forEach((tk, idx) => {
        rows.push([idx + 1, tk, 'Belum Digunakan']);
    });

    const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.href = url;
    link.download = `TOKEN_PEMILU_ITSC_${tokens.length}_${timestamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

async function clearAllTokens() {
    if (!isAdminSession || !cachedAdminPin) return;

    const ok = confirm(
        'HAPUS SEMUA TOKEN?\n\n' +
        'Seluruh hash token di database akan dihapus permanen. Token lama tidak akan bisa dipakai lagi.'
    );
    if (!ok) return;

    const { error } = await supabaseClient.rpc('admin_clear_tokens', {
        p_admin_pass: cachedAdminPin
    });

    if (error) {
        showToast('GAGAL MENGHAPUS TOKEN!');
        return;
    }

    const statusEl = document.getElementById('tokenGenStatus');
    if (statusEl) {
        statusEl.textContent = 'Semua token hash berhasil dihapus dari database.';
        statusEl.style.color = '#FFE033';
    }
    await fetchRealtimeData();
    showToast('SEMUA TOKEN BERHASIL DIHAPUS!');
}

// ═══════════════════════════════════════════════════════
//  SUPABASE DATA SYNC & REALTIME
// ═══════════════════════════════════════════════════════
async function fetchRealtimeData() {
    try {
        const { data: votesData, error: vErr } = await supabaseClient
            .from('votes')
            .select('paslon_id');

        if (!vErr && votesData) {
            const counts = [0, 0, 0];
            votesData.forEach(row => {
                if (row.paslon_id >= 1 && row.paslon_id <= 3) {
                    counts[row.paslon_id - 1]++;
                }
            });
            voteCounts = counts;
        }

        if (isAdminSession && cachedAdminPin) {
            await loadAdminTokenStats();
        } else {
            const { data: dptTotal, error: dErr } = await supabaseClient.rpc('get_total_dpt');
            if (!dErr && typeof dptTotal === 'number') {
                totalDptCount = dptTotal;
            }
        }

        updateStats();
    } catch (err) {
        console.error('Gagal memuat data realtime:', err);
    }
}

function subscribeSupabaseRealtime() {
    supabaseClient
        .channel('pemilu-live-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, async () => {
            await fetchRealtimeData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'voter_tokens' }, async () => {
            await fetchRealtimeData();
        })
        .subscribe();
}

// ═══════════════════════════════════════════════════════
//  STEP 1: CODE GATE (TOKEN PEMILIH & AKSES RAHASIA ADMIN)
// ═══════════════════════════════════════════════════════
function onCodeInput(input) {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
    setGateError(null);
    document.querySelector('#codeGate .gate-input-wrap')?.classList.remove('shake');
}

function setGateError(msg) {
    const el = document.getElementById('gateError');
    const tx = document.getElementById('gateErrorMsg');
    if (msg) { tx.textContent = msg; el.hidden = false; }
    else { el.hidden = true; }
}

function setGateSuccess(msg) {
    const el = document.getElementById('gateSuccess');
    const tx = document.getElementById('gateSuccessMsg');
    if (msg) { tx.textContent = msg; el.hidden = false; }
    else { el.hidden = true; }
}

function triggerInputShake(selector = '#codeGate .gate-input-wrap') {
    const wrap = document.querySelector(selector);
    if (!wrap) return;
    wrap.classList.remove('shake');
    void wrap.offsetWidth;
    wrap.classList.add('shake');
}

async function submitCode() {
    const input = document.getElementById('regCodeInput');
    const btn = document.getElementById('gateSubmitBtn');
    const label = document.getElementById('gateSubmitLabel');
    const rawCode = (input.value || '').trim().toUpperCase();

    if (!rawCode) {
        triggerInputShake();
        setGateError('Token pemilih tidak boleh kosong.');
        input.focus();
        return;
    }

    input.disabled = true;
    btn.disabled = true;
    btn.classList.add('loading');
    label.textContent = 'MEMVERIFIKASI...';
    setGateError(null);

    // 1. Cek apakah yang dimasukkan adalah KODE ADMIN
    if (rawCode === ADMIN_ACCESS_CODE) {
        const { error: tokenCheckErr } = await supabaseClient.rpc('get_token_stats', {
            p_admin_pass: rawCode
        });

        if (!tokenCheckErr) {
            isAdminSession = true;
            cachedAdminPin = rawCode;
            await fetchRealtimeData();

            setGateSuccess('✓ Akses Panitia diterima! Membuka Dashboard Admin...');
            setTimeout(() => {
                document.getElementById('codeGate').classList.add('hidden');
                setAdminUIState(true);
                switchView('admin');
                showToast('MODE PANITIA AKTIF — TOKEN HASH SIAP');
            }, 600);
            return;
        }
    }

    // 2. Hash token pemilih di browser (SHA-256) lalu cek ke Supabase
    try {
        const tokenHash = await sha256Hex(rawCode);
        const { data: status, error } = await supabaseClient.rpc('check_token_hash', {
            p_hash: tokenHash
        });

        if (error || status !== 'VALID') {
            input.disabled = false;
            btn.disabled = false;
            btn.classList.remove('loading');
            label.textContent = '▶ MASUK KE BILIK SUARA';
            triggerInputShake();

            if (status === 'USED') {
                setGateError('Token ini sudah pernah digunakan untuk memilih!');
            } else {
                setGateError('Token tidak valid atau tidak terdaftar.');
            }
            input.focus();
            return;
        }

        // Token valid! Simpan hash di memori sementara untuk proses vote
        activeVoter = { tokenHash };
        isAdminSession = false;
        setAdminUIState(false);

        setGateSuccess('✓ Token terverifikasi! Membuka bilik suara...');

        setTimeout(() => {
            document.getElementById('codeGate').classList.add('hidden');
            switchView('voting');
            showToast('SELAMAT DATANG DI BILIK SUARA!');
        }, 550);
    } catch (err) {
        input.disabled = false;
        btn.disabled = false;
        btn.classList.remove('loading');
        label.textContent = '▶ MASUK KE BILIK SUARA';
        setGateError('Gagal terhubung ke server verifikasi.');
    }
}

// ── Kontrol Visibilitas UI Admin ──────────────────────
function setAdminUIState(visible) {
    const tabAdmin = document.getElementById('tabAdmin');
    const tabLogout = document.getElementById('tabLogout');
    const footerAdminNav = document.getElementById('footerAdminNav');

    if (tabAdmin) tabAdmin.hidden = !visible;
    if (tabLogout) tabLogout.hidden = !visible;
    if (footerAdminNav) footerAdminNav.hidden = !visible;
}

function requestAdminLogout() {
    if (!isAdminSession) return;

    const confirmModal = document.getElementById('adminLogoutConfirmModal');
    if (confirmModal) confirmModal.classList.add('open');
}

function cancelAdminLogout() {
    const confirmModal = document.getElementById('adminLogoutConfirmModal');
    if (confirmModal) confirmModal.classList.remove('open');
}

function confirmAdminLogout() {
    if (!isAdminSession) {
        cancelAdminLogout();
        return;
    }

    cancelAdminLogout();
    resetToGate();
}

// ── Reset Penuh ke Layar Code Gate (Untuk Pemilih Berikutnya) ──
function resetToGate() {
    hasVoted = false;
    votedPaslonId = null;
    pendingVoteId = null;
    activeVoter = null;
    isAdminSession = false;
    cachedAdminPin = null;
    isSubmitting = false;

    setAdminUIState(false);
    switchView('voting');
    restoreVoteButtons();

    const input = document.getElementById('regCodeInput');
    const btn = document.getElementById('gateSubmitBtn');
    const label = document.getElementById('gateSubmitLabel');

    if (input) {
        input.value = '';
        input.disabled = false;
    }
    if (btn) {
        btn.disabled = false;
        btn.classList.remove('loading');
    }
    if (label) label.textContent = '▶ MASUK KE BILIK SUARA';

    setGateError(null);
    setGateSuccess(null);

    const gate = document.getElementById('codeGate');
    if (gate) {
        gate.classList.remove('hidden');
        setTimeout(() => input?.focus(), 100);
    }

    window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── Tab Switcher (Dengan Proteksi Ketat) ──────────────
function switchView(view) {
    const vVoting = document.getElementById('viewVoting');
    const vAdmin = document.getElementById('viewAdmin');
    const tabVoting = document.getElementById('tabVoting');
    const tabAdmin = document.getElementById('tabAdmin');

    if (view === 'admin') {
        if (!isAdminSession) {
            showToast('AKSES DITOLAK! KHUSUS PANITIA.');
            return;
        }
        vVoting.classList.remove('view--active');
        vAdmin.classList.add('view--active');
        tabAdmin?.classList.add('active');
        tabVoting?.classList.remove('active');
        setTimeout(() => {
            if (chartInstance) { chartInstance.resize(); chartInstance.update(); }
            updateStats();
        }, 50);
    } else {
        vAdmin.classList.remove('view--active');
        vVoting.classList.add('view--active');
        tabVoting?.classList.add('active');
        tabAdmin?.classList.remove('active');
    }
}

// ── MODAL VISI MISI ───────────────────────────────────
function openVisiModal(id) {
    const data = paslonDetails[id];
    if (!data) return;

    document.getElementById('modalNumber').textContent = data.number;
    document.getElementById('modalTitle').textContent = data.title;
    document.getElementById('modalTagline').textContent = `"${data.tagline}"`;
    document.getElementById('modalVisi').textContent = data.visi;

    const misiUl = document.getElementById('modalMisi');
    misiUl.innerHTML = data.misi.map((m, i) =>
        `<li>
            <span style="font-family:'Press Start 2P',cursive;font-size:8px;color:#FFE033;min-width:20px;padding-top:2px">${String(i + 1).padStart(2, '0')}</span>
            <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;color:rgba(255,255,255,0.9);line-height:1.5">${m}</span>
        </li>`
    ).join('');

    const accentEl = document.getElementById('modalAccentBar');
    if (accentEl) accentEl.style.background = `repeating-linear-gradient(90deg, ${data.color} 0px 8px, #FFE033 8px 16px)`;

    const voteBtn = document.getElementById('modalVoteBtn');
    if (voteBtn) {
        voteBtn.setAttribute('data-paslon', id);
        if (!isAdminSession && hasVoted) {
            voteBtn.textContent = 'SUDAH MEMILIH';
            voteBtn.disabled = true;
            voteBtn.style.opacity = '0.5';
            voteBtn.style.cursor = 'not-allowed';
        } else {
            voteBtn.textContent = `VOTE ${data.number}`;
            voteBtn.disabled = false;
            voteBtn.style.opacity = '1';
            voteBtn.style.cursor = 'pointer';
        }
    }

    document.getElementById('visiModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeVisiModal() {
    document.getElementById('visiModal').classList.remove('open');
    document.body.style.overflow = '';
}

// ── VOTE CONFIRM MODAL ────────────────────────────────
function handleVote(paslonId) {
    if (!activeVoter && !isAdminSession) {
        resetToGate();
        return;
    }
    if (!isAdminSession && hasVoted) {
        showToast(`ANDA SUDAH MEMILIH PASLON 0${votedPaslonId}!`);
        return;
    }
    openVoteConfirm(paslonId);
}

function openVoteConfirm(paslonId) {
    const data = paslonDetails[paslonId];
    if (!data) return;
    pendingVoteId = paslonId;

    document.getElementById('confirmPaslonName').textContent = data.title;
    document.getElementById('confirmPaslonNum').textContent = data.number;
    document.getElementById('confirmTagline').textContent = `"${data.tagline}"`;

    const bar = document.getElementById('confirmAccentBar');
    if (bar) bar.style.background = `repeating-linear-gradient(90deg, ${data.color} 0px 8px, #FFE033 8px 16px)`;

    document.getElementById('voteConfirmModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeVoteConfirm() {
    document.getElementById('voteConfirmModal').classList.remove('open');
    document.body.style.overflow = '';
    pendingVoteId = null;
}

async function confirmVote() {
    if (!pendingVoteId || (!activeVoter && !isAdminSession) || isSubmitting) return;

    isSubmitting = true;
    const paslonId = pendingVoteId;
    const confirmBtn = document.querySelector('#voteConfirmBox .btn-vote');

    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'MENYIMPAN...';
    }

    let voteSuccess = false;

    if (isAdminSession) {
        // Mode bebas pilih khusus Panitia/Admin melalui RPC SECURITY DEFINER
        const { data, error } = await supabaseClient.rpc('admin_cast_vote', {
            p_admin_pass: cachedAdminPin,
            p_paslon_id: paslonId
        });
        if (error) console.error('Admin vote error:', error);
        voteSuccess = !error && data === true;
    } else {
        // Pemilih sah: kunci token hash & catat suara secara atomik
        const { data, error } = await supabaseClient.rpc('cast_vote_with_token', {
            p_hash: activeVoter.tokenHash,
            p_paslon_id: paslonId
        });
        voteSuccess = !error && data === true;
    }

    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '✓ PILIH!';
    }
    isSubmitting = false;

    if (!voteSuccess) {
        closeVoteConfirm();
        showToast('Token sudah terpakai atau gagal menyimpan suara.');
        if (!isAdminSession) {
            setTimeout(() => resetToGate(), 1500);
        }
        return;
    }

    if (!isAdminSession) {
        hasVoted = true;
        votedPaslonId = paslonId;
        activeVoter = null; // Hapus token hash dari memori setelah suara masuk
        updateVoteButtons();
    }

    await fetchRealtimeData();
    closeVoteConfirm();
    closeVisiModal();
    showThankyou(paslonId);
}

function updateVoteButtons() {
    document.querySelectorAll('.card-actions .btn-vote').forEach((btn, idx) => {
        const pid = idx + 1;
        if (hasVoted && votedPaslonId === pid) {
            btn.textContent = 'DIPILIH';
            btn.style.background = '#4FC955';
            btn.style.cursor = 'default';
            btn.disabled = true;
        } else if (hasVoted) {
            btn.textContent = 'TERKUNCI';
            btn.style.opacity = '0.45';
            btn.style.cursor = 'not-allowed';
            btn.disabled = true;
        }
    });
}

function restoreVoteButtons() {
    document.querySelectorAll('.card-actions .btn-vote').forEach((btn, idx) => {
        const pid = idx + 1;
        btn.textContent = `VOTE PASLON 0${pid}`;
        btn.style.background = '';
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.disabled = false;
        btn.onclick = () => handleVote(pid);
    });
}

function voteFromModal() {
    const voteBtn = document.getElementById('modalVoteBtn');
    const paslonId = parseInt(voteBtn.getAttribute('data-paslon'));
    closeVisiModal();
    setTimeout(() => openVoteConfirm(paslonId), 300);
}

// ═══════════════════════════════════════════════════════
//  ADMIN: EKSPOR REKAP CSV & RESET SUARA
// ═══════════════════════════════════════════════════════
async function exportRecapCSV() {
    if (!isAdminSession) return;

    await fetchRealtimeData();

    const totalVotes = voteCounts.reduce((a, b) => a + b, 0);
    const csvRows = [
        ['REKAPITULASI HASIL PEMILU ITSC 2026'],
        ['Waktu Ekspor', new Date().toLocaleString('id-ID')],
        ['Total Token Terdaftar', tokenStats.total],
        ['Token Terpakai', tokenStats.used],
        ['Token Tersisa', tokenStats.remaining],
        ['Total Suara Masuk', totalVotes],
        [],
        ['Nomor Urut', 'Nama Paslon', 'Perolehan Suara', 'Persentase'],
        ['01', paslonDetails[1].title, voteCounts[0], totalVotes > 0 ? ((voteCounts[0] / totalVotes) * 100).toFixed(1) + '%' : '0%'],
        ['02', paslonDetails[2].title, voteCounts[1], totalVotes > 0 ? ((voteCounts[1] / totalVotes) * 100).toFixed(1) + '%' : '0%'],
        ['03', paslonDetails[3].title, voteCounts[2], totalVotes > 0 ? ((voteCounts[2] / totalVotes) * 100).toFixed(1) + '%' : '0%']
    ];

    const csvContent = '\uFEFF' + csvRows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rekap_Pemilu_ITSC_2026_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('FILE REKAP CSV BERHASIL DIUNDUH!');
}

async function resetElectionDatabase() {
    if (!isAdminSession || !cachedAdminPin) return;

    const konfirmasi1 = confirm(
        'PERINGATAN RESET DATA SUARA!\n\n' +
        'Semua perolehan suara akan direset menjadi 0 dan status token akan dikembalikan.\n\n' +
        'Lanjutkan?'
    );
    if (!konfirmasi1) return;

    const ketikReset = prompt('Ketik RESET untuk mengonfirmasi penghapusan seluruh suara:');
    if (!ketikReset || ketikReset.trim().toUpperCase() !== 'RESET') {
        showToast('RESET DIBATALKAN.');
        return;
    }

    showToast('MERESET DATA SUARA...');

    const { data, error } = await supabaseClient.rpc('admin_reset_votes', {
        p_admin_pass: cachedAdminPin
    });

    if (error || data !== true) {
        console.error('Reset error:', error);
        showToast('GAGAL RESET: ' + (error?.message || 'Fungsi RPC tidak merespons'));
        return;
    }

    voteCounts = [0, 0, 0];
    hasVoted = false;
    votedPaslonId = null;

    restoreVoteButtons();
    updateStats();
    await fetchRealtimeData();

    showToast('DATA SUARA BERHASIL DIRESET KE 0!');
}

// ── TOAST ─────────────────────────────────────────────
function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3800);
}

// ══════════════════════════════════════════════════════
//  ADMIN CLOCK
// ══════════════════════════════════════════════════════
function updateAdminClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();

    const clockEl = document.getElementById('adminClock');
    const dateEl = document.getElementById('adminDate');
    if (clockEl) clockEl.textContent = `${hh}:${mm}:${ss}`;
    if (dateEl) dateEl.textContent = `${dd} / ${mo} / ${yyyy}`;
}

// ══════════════════════════════════════════════════════
//  COPY CONTACT
// ══════════════════════════════════════════════════════
function copyContact(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
        const hint = btn.querySelector('.fcb-copy-hint');
        const orig = hint ? hint.textContent : '';
        if (hint) hint.textContent = '✓ OK';
        btn.classList.add('copied');
        setTimeout(() => {
            if (hint) hint.textContent = orig;
            btn.classList.remove('copied');
        }, 2000);
        showToast('TERSALIN: ' + text);
    }).catch(() => {
        showToast('Gagal menyalin. Salin manual: ' + text);
    });
}

// ══════════════════════════════════════════════════════
//  THANK YOU SCREEN (AUTO-RESET KE CODE GATE)
// ══════════════════════════════════════════════════════
let tyCountdownInterval = null;

function showThankyou(paslonId) {
    const data = paslonDetails[paslonId];
    const overlay = document.getElementById('thankyouScreen');
    if (!overlay) return;

    const badge = document.getElementById('tyPaslonBadge');
    const num = document.getElementById('tyPaslonNum');
    const name = document.getElementById('tyPaslonName');
    const slogan = document.getElementById('tyPaslonSlogan');

    if (num) num.textContent = data.number;
    if (num) num.style.color = data.color;
    if (badge) badge.style.borderColor = data.color;
    if (name) name.textContent = data.title;
    if (slogan) slogan.textContent = data.tagline || '';

    spawnTyConfetti(data.color);

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    let secs = 5;
    const cdEl = document.getElementById('tyCountdown');
    if (cdEl) cdEl.textContent = String(secs).padStart(2, '0');

    clearInterval(tyCountdownInterval);
    tyCountdownInterval = setInterval(() => {
        secs--;
        if (cdEl) cdEl.textContent = String(secs).padStart(2, '0');
        if (secs <= 0) {
            clearInterval(tyCountdownInterval);
            closeThankyou();
        }
    }, 1000);
}

function closeThankyou() {
    clearInterval(tyCountdownInterval);
    const overlay = document.getElementById('thankyouScreen');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';

    const conf = document.getElementById('tyConfetti');
    if (conf) conf.innerHTML = '';

    if (isAdminSession) {
        showToast('SUARA PANITIA TERCATAT! SIAP MEMILIH LAGI.');
        return;
    }

    resetToGate();
}

function spawnTyConfetti(mainColor) {
    const conf = document.getElementById('tyConfetti');
    if (!conf) return;
    conf.innerHTML = '';

    const colors = [mainColor, '#FFE033', '#4FC955', '#FF8C1A', '#38BAFF', '#9B59EF', '#FF5F57'];
    for (let i = 0; i < 32; i++) {
        const px = document.createElement('div');
        px.className = 'ty-pixel';
        px.style.left = Math.random() * 100 + '%';
        px.style.bottom = '-20px';
        px.style.background = colors[Math.floor(Math.random() * colors.length)];
        px.style.animationDuration = (1.5 + Math.random() * 3) + 's';
        px.style.animationDelay = (Math.random() * 2) + 's';
        px.style.width = (4 + Math.random() * 8) + 'px';
        px.style.height = (4 + Math.random() * 8) + 'px';
        conf.appendChild(px);
    }
}

// ══════════════════════════════════════════════════════
//  VALIDASI KELUAR DARI FULLSCREEN DIAGRAM
// ══════════════════════════════════════════════════════
const _originalCloseFullscreenChart = window.closeFullscreenChart;

window.closeFullscreenChart = function (force = false) {
    const fsOverlay = document.getElementById('fullscreenChartOverlay');
    if (!fsOverlay) return;

    const isFsOpen =
        fsOverlay.classList.contains('open') ||
        fsOverlay.classList.contains('active') ||
        window.getComputedStyle(fsOverlay).display !== 'none';

    if (!isFsOpen) return;

    if (!force) {
        const confirmModal = document.getElementById('fsExitConfirmModal');
        if (confirmModal) {
            confirmModal.classList.add('open');
        }
        return;
    }

    cancelExitFullscreen();
    if (typeof _originalCloseFullscreenChart === 'function') {
        _originalCloseFullscreenChart();
    }
};

function confirmExitFullscreen() {
    window.closeFullscreenChart(true);
}

function cancelExitFullscreen() {
    const confirmModal = document.getElementById('fsExitConfirmModal');
    if (confirmModal) {
        confirmModal.classList.remove('open');
    }
}

// ══════════════════════════════════════════════════════
//  MODAL INFORMASI FOOTER & SMOOTH SCROLL
// ══════════════════════════════════════════════════════
const footerInfoData = {
    tatib: {
        badge: 'ATURAN PEMILIHAN',
        title: 'TATA TERTIB PEMILU',
        color: '#FF8C1A',
        items: [
            'Setiap anggota aktif ITSC SMK Negeri 2 Klaten berhak atas 1 (satu) token unik.',
            'Token bersifat rahasia dan tidak boleh dipindahtangankan atau digunakan oleh orang lain.',
            'Pemilih wajib mempelajari visi dan misi setiap kandidat sebelum menekan tombol konfirmasi.',
            'Suara yang telah dikonfirmasi tidak dapat diubah atau dibatalkan dengan alasan apa pun.',
            'Segala bentuk kecurangan atau penyalahgunaan token akan didiskualifikasi oleh panitia.'
        ]
    },
    faq: {
        badge: 'BANTUAN & PANDUAN',
        title: 'PANDUAN & FAQ',
        color: '#38BAFF',
        items: [
            'Bagaimana cara memilih? Masukkan token dari panitia di halaman awal, pilih paslon, lalu klik Konfirmasi.',
            'Token tidak bisa masuk? Pastikan tidak ada spasi tambahan dan periksa huruf/angka yang mirip (misal angka 0 dan huruf O).',
            'Muncul pesan "Token sudah digunakan"? Hubungi panitia di meja verifikasi jika kamu merasa belum pernah memberikan suara.',
            'Apakah pilihan saya bisa dilihat panitia? Tidak, database hanya mencatat status token terpakai tanpa menghubungkannya ke pilihan paslon.'
        ]
    },
    privasi: {
        badge: 'KEAMANAN DATA',
        title: 'KEBIJAKAN PRIVASI',
        color: '#4FC955',
        items: [
            'Token pemilih dienkripsi menggunakan algoritma SHA-256 sebelum dikirim dan dicocokkan dengan server.',
            'Sistem menerapkan asas LUBER JURDIL: tidak ada data nama/NIS yang disimpan bersama catatan suara.',
            'Riwayat suara disimpan secara anonim dan hanya digunakan untuk rekapitulasi resmi Pemilu ITSC 2026.'
        ]
    },
    berita: {
        badge: 'DOKUMEN RESMI',
        title: 'BERITA ACARA PEMILU',
        color: '#9B59EF',
        items: [
            'Pemungutan suara dilaksanakan secara daring melalui sistem E-Voting Pemilu ITSC 2026.',
            'Penghitungan suara berlangsung secara otomatis dan realtime yang dapat dipantau panitia serta saksi.',
            'Hasil resmi pemenang pemilihan akan ditetapkan dan diumumkan setelah sesi pemungutan suara ditutup.'
        ]
    }
};

function openInfoModal(type) {
    const info = footerInfoData[type];
    if (!info) return;

    document.getElementById('infoModalBadge').textContent = info.badge;
    document.getElementById('infoModalTitle').textContent = info.title;
    document.getElementById('infoModalAccent').style.background =
        `repeating-linear-gradient(90deg, ${info.color} 0px 8px, #FFE033 8px 16px)`;

    const listEl = document.getElementById('infoModalList');
    listEl.innerHTML = info.items.map((text, idx) =>
        `<li>
            <span style="font-family:'Press Start 2P',cursive;font-size:8px;color:#FFE033;min-width:22px;padding-top:3px">${String(idx + 1).padStart(2, '0')}</span>
            <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;color:rgba(255,255,255,0.92);line-height:1.6">${text}</span>
        </li>`
    ).join('');

    document.getElementById('footerInfoModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeInfoModal() {
    const modal = document.getElementById('footerInfoModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
}

function scrollToTopSmooth() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}