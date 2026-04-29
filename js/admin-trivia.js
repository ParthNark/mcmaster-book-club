(function () {
    var form = document.getElementById('admin-trivia-form');
    var messageEl = document.getElementById('admin-message');
    var submitBtn = document.getElementById('admin-submit');
    var dateInput = document.getElementById('kahoot-date');

    if (dateInput && !dateInput.value) {
        var today = new Date();
        dateInput.value = today.toISOString().slice(0, 10);
    }

    function setMessage(text, type) {
        if (!messageEl) return;
        messageEl.textContent = text || '';
        messageEl.className = 'admin-message' + (type ? ' ' + type : '');
    }

    function normalizeHeader(str) {
        return String(str || '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function parseCsv(text) {
        var rows = [];
        var row = [];
        var current = '';
        var inQuotes = false;

        for (var i = 0; i < text.length; i++) {
            var char = text[i];
            var next = text[i + 1];

            if (char === '"') {
                if (inQuotes && next === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(current);
                current = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && next === '\n') i++;
                row.push(current);
                rows.push(row);
                row = [];
                current = '';
            } else {
                current += char;
            }
        }

        if (current.length > 0 || row.length > 0) {
            row.push(current);
            rows.push(row);
        }

        return rows.filter(function (r) {
            return r.some(function (cell) { return String(cell || '').trim() !== ''; });
        });
    }

    function findHeaderIndex(headers, keys) {
        for (var i = 0; i < headers.length; i++) {
            for (var k = 0; k < keys.length; k++) {
                if (headers[i].indexOf(keys[k]) !== -1) return i;
            }
        }
        return -1;
    }

    function buildResults(rows) {
        if (!rows || rows.length === 0) return [];

        var headerRow = rows[0];
        var normalized = headerRow.map(normalizeHeader);

        var nameKeys = ['player', 'name', 'nickname', 'username', 'participant'];
        var scoreKeys = ['score', 'points', 'finalscore', 'totalscore'];
        var rankKeys = ['rank', 'place', 'position'];

        var nameIdx = findHeaderIndex(normalized, nameKeys);
        var scoreIdx = findHeaderIndex(normalized, scoreKeys);
        var rankIdx = findHeaderIndex(normalized, rankKeys);

        var hasHeader = (nameIdx !== -1 || scoreIdx !== -1 || rankIdx !== -1);

        if (!hasHeader) {
            nameIdx = 0;
            scoreIdx = 1;
            rankIdx = 2;
        }

        var startRow = hasHeader ? 1 : 0;
        var results = [];

        for (var i = startRow; i < rows.length; i++) {
            var row = rows[i];
            var name = row[nameIdx] ? String(row[nameIdx]).trim() : '';
            var scoreVal = row[scoreIdx];
            var score = scoreVal !== undefined ? Number(String(scoreVal).replace(/[^0-9.\-]/g, '')) : NaN;
            var rank = null;

            if (rankIdx !== -1 && row[rankIdx] !== undefined && row[rankIdx] !== '') {
                var parsedRank = parseInt(String(row[rankIdx]).replace(/[^0-9]/g, ''), 10);
                rank = isNaN(parsedRank) ? null : parsedRank;
            }

            if (!name || isNaN(score)) continue;

            results.push({
                player_name: name,
                score: score,
                rank: rank
            });
        }

        if (results.length === 0) return [];

        var anyRank = results.some(function (r) { return r.rank !== null; });
        if (!anyRank) {
            results.sort(function (a, b) { return b.score - a.score; });
            for (var r = 0; r < results.length; r++) {
                results[r].rank = r + 1;
            }
        } else {
            var usedRanks = {};
            results.forEach(function (r) {
                if (r.rank !== null) usedRanks[r.rank] = true;
            });
            var sortedByScore = results.slice().sort(function (a, b) { return b.score - a.score; });
            var nextRank = 1;
            for (var s = 0; s < sortedByScore.length; s++) {
                var item = sortedByScore[s];
                if (item.rank !== null) continue;
                while (usedRanks[nextRank]) nextRank++;
                item.rank = nextRank;
                usedRanks[nextRank] = true;
                nextRank++;
            }
        }

        return results;
    }

    function postResults(payload) {
        return fetch(API_BASE + '?action=upload-kahoot', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        }).then(function (res) {
            if (res.ok) return res.json();
            return res.text().then(function (txt) {
                try { return JSON.parse(txt); }
                catch (e) { return { ok: false, error: 'Upload failed.' }; }
            });
        }).catch(function () {
            return fetch(API_BASE + '?action=upload-kahoot', {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload)
            }).then(function () {
                return { ok: true, message: 'Upload sent. Check the sheet for results.' };
            });
        });
    }

    if (!form) return;

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        setMessage('', '');

        if (typeof API_BASE === 'undefined' || !API_BASE) {
            setMessage('API_BASE is not configured.', 'error');
            return;
        }

        var password = document.getElementById('admin-password').value.trim();
        var title = document.getElementById('kahoot-title').value.trim();
        var theme = document.getElementById('kahoot-theme').value.trim();
        var date = document.getElementById('kahoot-date').value.trim();
        var notes = document.getElementById('kahoot-notes').value.trim();
        var fileInput = document.getElementById('kahoot-file');

        if (!password || !title || !date || !fileInput || !fileInput.files.length) {
            setMessage('Please complete all required fields and attach a CSV.', 'error');
            return;
        }

        var file = fileInput.files[0];
        var reader = new FileReader();

        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading…';

        reader.onload = function (e) {
            try {
                var rows = parseCsv(e.target.result || '');
                var results = buildResults(rows);

                if (results.length === 0) {
                    setMessage('No valid rows found in the CSV.', 'error');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Upload Results';
                    return;
                }

                var payload = {
                    action: 'upload-kahoot',
                    password: password,
                    title: title,
                    theme: theme,
                    date: date,
                    notes: notes,
                    results: results
                };

                postResults(payload)
                    .then(function (resp) {
                        if (resp && resp.ok) {
                            setMessage('Upload complete! Leaderboards updated.', 'success');
                            form.reset();
                            if (dateInput) {
                                dateInput.value = new Date().toISOString().slice(0, 10);
                            }
                        } else {
                            setMessage((resp && resp.error) ? resp.error : 'Upload failed.', 'error');
                        }
                    })
                    .catch(function () {
                        setMessage('Upload failed. Please try again.', 'error');
                    })
                    .finally(function () {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Upload Results';
                    });
            } catch (err) {
                setMessage('CSV parsing failed. Please check the file format.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Upload Results';
            }
        };

        reader.onerror = function () {
            setMessage('Unable to read the CSV file.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload Results';
        };

        reader.readAsText(file);
    });
})();
