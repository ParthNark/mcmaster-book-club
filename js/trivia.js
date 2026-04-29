(function () {
    var loadingEl = document.getElementById('trivia-loading');
    var errorEl = document.getElementById('trivia-error');
    var contentEl = document.getElementById('trivia-content');

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str || ''));
        return div.innerHTML;
    }

    function medalForRank(rank) {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return '';
    }

    function renderLeaderboard(rows, tbodyId, emptyId) {
        var tbody = document.getElementById(tbodyId);
        var emptyEl = document.getElementById(emptyId);
        if (!tbody) return;

        if (!rows || rows.length === 0) {
            tbody.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';

        var html = '';
        for (var i = 0; i < rows.length; i++) {
            var rank = i + 1;
            var medal = medalForRank(rank);
            var player = escapeHtml(rows[i].player_name || '');
            var total = Number(rows[i].total_score || 0).toLocaleString();
            var games = Number(rows[i].games_played || 0).toLocaleString();
            var wins = Number(rows[i].wins || 0).toLocaleString();

            html += '<tr>'
                + '<td data-label="Rank"><span class="trivia-badge">' + medal + ' ' + rank + '</span></td>'
                + '<td data-label="Player">' + player + '</td>'
                + '<td data-label="Total Score">' + total + '</td>'
                + '<td data-label="Games">' + games + '</td>'
                + '<td data-label="Wins">' + wins + '</td>'
                + '</tr>';
        }

        tbody.innerHTML = html;
    }

    function renderLatest(latest) {
        var metaEl = document.getElementById('latest-kahoot-meta');
        var tbody = document.getElementById('latest-kahoot-body');
        var emptyEl = document.getElementById('latest-kahoot-empty');

        if (!latest || !latest.kahoot) {
            if (tbody) tbody.innerHTML = '';
            if (metaEl) metaEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';

        var metaHtml = '';
        var metaItems = [
            { label: 'Title', value: latest.kahoot.title || 'Untitled' },
            { label: 'Date', value: latest.kahoot.date || 'TBA' },
            { label: 'Theme', value: latest.kahoot.theme || '—' },
            { label: 'Winner', value: latest.kahoot.winner || '—' },
            { label: 'Notes', value: latest.kahoot.notes || '—' }
        ];

        for (var i = 0; i < metaItems.length; i++) {
            metaHtml += '<div class="trivia-meta-item">' + escapeHtml(metaItems[i].value) +
                '<span>' + escapeHtml(metaItems[i].label) + '</span></div>';
        }

        metaEl.innerHTML = metaHtml;

        var scores = latest.scores || [];
        if (scores.length === 0) {
            tbody.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        var scoreHtml = '';
        for (var s = 0; s < scores.length; s++) {
            var scoreRank = Number(scores[s].rank || (s + 1));
            var medal = medalForRank(scoreRank);
            scoreHtml += '<tr>'
                + '<td data-label="Rank"><span class="trivia-badge">' + medal + ' ' + scoreRank + '</span></td>'
                + '<td data-label="Player">' + escapeHtml(scores[s].player_name || '') + '</td>'
                + '<td data-label="Score">' + Number(scores[s].score || 0).toLocaleString() + '</td>'
                + '</tr>';
        }
        tbody.innerHTML = scoreHtml;
    }

    function renderArchive(list) {
        var listEl = document.getElementById('archive-list');
        var emptyEl = document.getElementById('archive-empty');
        if (!listEl) return;

        if (!list || list.length === 0) {
            listEl.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        if (emptyEl) emptyEl.style.display = 'none';

        var html = '';
        for (var i = 0; i < list.length; i++) {
            html += '<article class="trivia-archive-card">'
                + '<h3>' + escapeHtml(list[i].title || 'Untitled') + '</h3>'
                + '<p><strong>Date:</strong> ' + escapeHtml(list[i].date || 'TBA') + '</p>'
                + '<p><strong>Theme:</strong> ' + escapeHtml(list[i].theme || '—') + '</p>'
                + '<p><strong>Winner:</strong> ' + escapeHtml(list[i].winner || '—') + '</p>'
                + (list[i].notes ? '<p><strong>Notes:</strong> ' + escapeHtml(list[i].notes) + '</p>' : '')
                + '</article>';
        }

        listEl.innerHTML = html;
    }

    function showError() {
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'block';
    }

    function showContent() {
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
    }

    if (typeof API_BASE === 'undefined' || !API_BASE) {
        showError();
        return;
    }

    fetch(API_BASE + '?action=leaderboards')
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (!data || data.error) throw new Error('API error');

            showContent();
            renderLeaderboard(data.allTime || [], 'all-time-body', 'all-time-empty');
            renderLeaderboard(data.lastFourMonths || [], 'last-four-body', 'last-four-empty');
            renderLatest(data.latestKahoot || null);
            renderArchive(data.kahootArchive || []);
        })
        .catch(function () {
            showError();
        });
})();
