let voteCounts = [0, 0, 0];
let totalDptCount = 0;
let chartInstance = null;

// Inisialisasi Chart.js (Pie Chart — Pixel Theme)
function initAdminChart() {
    const canvas = document.getElementById('adminChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    chartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['01. Raffa & Dicky', '02. Fadil & Fatchul', '03. Choirul & Dika'],
            datasets: [{
                label: 'Jumlah Suara',
                data: voteCounts,
                backgroundColor: ['#38BAFF', '#FF8C1A', '#9B59EF'],
                borderColor: '#1A1A4E',
                borderWidth: 4,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeOutQuart' },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#FFFFFF',
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'rect',
                        font: {
                            family: "'Press Start 2P', cursive",
                            size: 7
                        }
                    }
                },
                tooltip: {
                    padding: 12,
                    cornerRadius: 0,
                    bodyFont: { family: "'Press Start 2P', cursive", size: 9 },
                    titleFont: { family: "'Press Start 2P', cursive", size: 8 },
                    backgroundColor: '#1A1A4E',
                    borderColor: '#FFE033',
                    borderWidth: 2,
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const val = context.parsed;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                            return ` ${val} SUARA (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
    updateStats();
}

// ── Pembaruan Semua Statistik Realtime ───────────────
function updateStats() {
    const total = voteCounts.reduce((a, b) => a + b, 0);
    const dpt = totalDptCount > 0 ? totalDptCount : 0;
    const pct = dpt > 0 ? ((total / dpt) * 100).toFixed(1) : '0.0';
    const left = Math.max(0, dpt - total);

    // Admin stat cards
    const elDpt = document.getElementById('statTotalDpt');
    const elSuara = document.getElementById('statTotalSuara');
    const elPct = document.getElementById('statPercent');
    if (elDpt) elDpt.textContent = dpt;
    if (elSuara) elSuara.textContent = total;
    if (elPct) elPct.textContent = pct + '%';

    // Admin header progress strip
    const aphFill = document.getElementById('aphBarFill');
    const aphPct = document.getElementById('aphBarPct');
    if (aphFill) aphFill.style.width = Math.min(100, parseFloat(pct)) + '%';
    if (aphPct) aphPct.textContent = pct + '% · ' + total + ' / ' + dpt + ' SUARA';

    // Participation bar (admin info col)
    const partFill = document.getElementById('partBarFill');
    const partPct = document.getElementById('partBarPct');
    if (partFill) partFill.style.width = Math.min(100, parseFloat(pct)) + '%';
    if (partPct) partPct.textContent = pct + '%';

    // Update score rows & rekap list
    updateScoreRows(total);
    updateRekapList(total);

    // Sinkronkan chart jika sudah diinisialisasi
    if (chartInstance) {
        chartInstance.data.datasets[0].data = [...voteCounts];
        chartInstance.update();
    }
}

// ── Score bar rows (admin panel) ─────────────────────
function updateScoreRows(totalVotes) {
    const container = document.getElementById('scoreRows');
    if (!container) return;
    const colors = ['#38BAFF', '#FF8C1A', '#9B59EF'];
    const names = ['Raffa & Dicky', 'Fadil & Fatchul', 'Choirul & Dika'];
    const max = Math.max(...voteCounts, 1);

    container.innerHTML = voteCounts.map((v, i) => {
        const pct = totalVotes > 0 ? ((v / totalVotes) * 100).toFixed(1) : '0.0';
        const barPct = ((v / max) * 100).toFixed(1);
        return `
        <div class="score-row" style="animation-delay:${i * 0.08}s">
          <div class="sr-meta">
            <span class="sr-num" style="color:${colors[i]}">0${i + 1}</span>
            <span class="sr-name">${names[i]}</span>
            <span class="sr-votes" style="color:${colors[i]}">${v}</span>
            <span class="sr-pct">${pct}%</span>
          </div>
          <div class="sr-bar-track">
            <div class="sr-bar-fill" style="width:${barPct}%;background:${colors[i]}">
              <div class="sr-bar-shine"></div>
            </div>
          </div>
        </div>`;
    }).join('');
}

// ── Rekap list (admin info col) ───────────────────────
function updateRekapList(totalVotes) {
    const container = document.getElementById('rekapList');
    if (!container) return;
    const colors = ['#38BAFF', '#FF8C1A', '#9B59EF'];
    const names = ['Raffa & Dicky', 'Fadil & Fatchul', 'Choirul & Dika'];
    const sorted = [...voteCounts.map((v, i) => ({ v, i }))].sort((a, b) => b.v - a.v);

    container.innerHTML = sorted.map(({ v, i }, rank) => {
        const pct = totalVotes > 0 ? ((v / totalVotes) * 100).toFixed(1) : '0.0';
        return `
        <div class="rekap-item ${rank === 0 ? 'rekap-item--lead' : ''}">
          <span class="rekap-rank">${rank === 0 ? '👑' : '#' + (rank + 1)}</span>
          <span class="rekap-num" style="color:${colors[i]}">0${i + 1}</span>
          <span class="rekap-name">${names[i]}</span>
          <span class="rekap-score">${v} <span class="rekap-pct">(${pct}%)</span></span>
        </div>`;
    }).join('');
}


// ═══════════════════════════════════════════════════════
//  FULLSCREEN PIE CHART (NO LABELS, REALTIME)
// ═══════════════════════════════════════════════════════
let fullscreenChartInstance = null;
let fullscreenSyncInterval = null;

function openFullscreenChart() {
    const overlay = document.getElementById('fullscreenChartOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    const canvas = document.getElementById('fullscreenPieCanvas');
    if (!canvas) return;

    // Destroy previous instance if any
    if (fullscreenChartInstance) {
        fullscreenChartInstance.destroy();
        fullscreenChartInstance = null;
    }

    const ctx = canvas.getContext('2d');

    fullscreenChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['01', '02', '03'],
            datasets: [{
                data: [...voteCounts],
                backgroundColor: ['#38BAFF', '#FF8C1A', '#9B59EF'],
                borderColor: '#0a0a2e',
                borderWidth: 6,
                hoverOffset: 18
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: { duration: 800, easing: 'easeOutQuart' },
            layout: {
                padding: 20
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
                title: { display: false }
            }
        }
    });

    // Sync data every 2 seconds
    clearInterval(fullscreenSyncInterval);
    fullscreenSyncInterval = setInterval(() => {
        if (fullscreenChartInstance) {
            fullscreenChartInstance.data.datasets[0].data = [...voteCounts];
            fullscreenChartInstance.update('none');
        }
    }, 2000);
}

function closeFullscreenChart() {
    const overlay = document.getElementById('fullscreenChartOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';

    clearInterval(fullscreenSyncInterval);
    if (fullscreenChartInstance) {
        fullscreenChartInstance.destroy();
        fullscreenChartInstance = null;
    }
}
