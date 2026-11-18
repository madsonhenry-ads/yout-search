document.addEventListener('DOMContentLoaded', () => {
    const savedContainer = document.getElementById('savedContainer');
    const statTotalChannels = document.getElementById('statTotalChannels');
    const statHighPotential = document.getElementById('statHighPotential');
    const sortOrderSelect = document.getElementById('sortOrder');
    const langFilterSelect = document.getElementById('langFilter');

    // Flags by language code
    const LANG_FLAGS = {
        pt: '🇧🇷', en: '🇺🇸', de: '🇩🇪', it: '🇮🇹', es: '🇪🇸'
    };

    let savedChannels = [];

    // Make loadDashboard available globally
    window.loadDashboard = loadDashboard;

    if (sortOrderSelect) sortOrderSelect.addEventListener('change', renderSavedChannels);
    if (langFilterSelect) langFilterSelect.addEventListener('change', renderSavedChannels);

    async function loadDashboard() {
        try {
            const response = await fetch(window.API_BASE + '/channels');
            if (!response.ok) {
                throw new Error('Failed to load channels');
            }
            savedChannels = await response.json();
            renderSavedChannels();

        } catch (error) {
            console.error('Error loading dashboard:', error);
            savedContainer.innerHTML = '<div class="empty-state"><p style="color:red">Failed to load data. Is Docker running?</p></div>';
        }
    }

    function renderSavedChannels() {
        if (!savedChannels) savedChannels = [];

        // Stats over the full list
        statTotalChannels.textContent = savedChannels.length;
        let highPotentialCount = 0;
        savedChannels.forEach(ch => {
            if (calculateScore(ch) >= 90) highPotentialCount++;
        });
        statHighPotential.textContent = highPotentialCount;

        // Apply language filter
        const langFilter = langFilterSelect ? langFilterSelect.value : '';
        let channels = savedChannels;
        if (langFilter) {
            if (langFilter === 'unknown') {
                channels = channels.filter(ch => !ch.lang || !LANG_FLAGS[ch.lang]);
            } else {
                channels = channels.filter(ch => ch.lang === langFilter);
            }
        }

        // Sort
        const sortOrder = sortOrderSelect ? sortOrderSelect.value : 'scoreDesc';
        channels = [...channels];
        if (sortOrder === 'scoreAsc') {
            channels.sort((a, b) => calculateScore(a) - calculateScore(b));
        } else {
            channels.sort((a, b) => calculateScore(b) - calculateScore(a));
        }

        savedContainer.innerHTML = '';

        if (channels.length === 0) {
            savedContainer.innerHTML = '<div class="empty-state"><p>No channels match the current filters.</p></div>';
            return;
        }

            channels.forEach(channel => {
                const score = calculateScore(channel);
                const flag = (channel.lang && LANG_FLAGS[channel.lang]) ? LANG_FLAGS[channel.lang] : '❓';
                const langName = channel.lang ? (LANG_FLAGS[channel.lang] ? channel.lang.toUpperCase() : channel.lang) : '';

                const card = document.createElement('div');
                card.className = 'channel-card';

                // Format Number helper
                const subCount = formatNumber(channel.subs);
                const viewCount = formatNumber(channel.viewCount || 0);

                // Revenue Calculation (Est. $2 RPM)
                // (Total Views / Age Months) / 1000 * 2
                const now = new Date();
                const createdDate = new Date(channel.created);
                const ageMonths = Math.max(1, (now - createdDate) / (1000 * 60 * 60 * 24 * 30));
                const estRevenue = ((parseInt(channel.viewCount || 0) / ageMonths) / 1000) * 2;
                const formattedRevenue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(estRevenue);


                // Score Class
                let scoreColor = '#ff4d4d'; // Red
                if (score >= 90) scoreColor = '#00cc66'; // Green
                else if (score >= 75) scoreColor = '#ffcc00'; // Yellow
                else if (score >= 60) scoreColor = '#ff9933'; // Orange

                card.innerHTML = `
                    <div class="score-badge" style="background-color: ${scoreColor}">${score}</div>
                    <img src="${channel.thumb}" alt="${channel.title}" class="channel-thumbnail" referrerpolicy="no-referrer">
                    <h3 class="channel-title">${channel.title} <span title="Idioma do conteúdo${langName ? ': ' + langName : ' não identificado'}" style="font-size: 1.1em; margin-left: 4px;">${flag}</span></h3>
                    
                    <div class="channel-stats">
                        <span>${subCount !== 'Hidden' ? subCount + ' Subs' : 'Subs Hidden'}</span>
                        <span>•</span>
                        <span>${channel.videoCount} Vids</span>
                    </div>

                    <div style="background: #2a2a2a; border-radius: 8px; padding: 10px; margin: 10px 0; width: 100%;">
                        <div style="font-size: 0.8rem; color: #aaa; margin-bottom: 5px;">Performance Est.</div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                            <span title="Total Views">👁️ ${viewCount}</span>
                            <span title="Est. Monthly Revenue" style="color: #4caf50;">💰 ${formattedRevenue}/mo</span>
                        </div>
                    </div>

                    <div style="font-size: 0.85rem; color: #888; margin-bottom: 0.5rem;">
                        Created: ${new Date(channel.created).toLocaleDateString()}
                    </div>
                    <div class="card-actions" style="display: flex; gap: 10px; width: 100%; margin-top: auto;">
                        <a href="https://www.youtube.com/channel/${channel.id}" target="_blank" class="visit-btn" style="flex: 1; text-align: center;">Visit</a>
                        <button class="delete-btn" onclick="deleteChannel('${channel.id}')" style="flex: 1; background-color: #333; border: 1px solid var(--border-color); color: #fff; border-radius: 5px; cursor: pointer;">Remove</button>
                    </div>
                `;

                savedContainer.appendChild(card);
            });
    }

    // Same scoring formula as discover.js
    function calculateScore(channel) {
        const now = new Date();
        const ageTime = Math.abs(now - new Date(channel.created));
        const ageDays = Math.max(1, Math.ceil(ageTime / (1000 * 60 * 60 * 24)));

        // Age: newer = better
        let ageScore = 20;
        if (ageDays <= 30) ageScore = 100;
        else if (ageDays <= 90) ageScore = 80;
        else if (ageDays <= 180) ageScore = 50;

        // Growth: subs per day
        const subs = parseInt(channel.subs) || 0;
        const subsPerDay = subs / ageDays;
        let growthScore = 20;
        if (subsPerDay > 50) growthScore = 100;
        else if (subsPerDay > 20) growthScore = 80;
        else if (subsPerDay > 5) growthScore = 50;

        // Consistency: uploads per week
        const videos = parseInt(channel.videoCount) || 0;
        const uploadsPerWeek = (videos / ageDays) * 7;
        let consistencyScore = 20;
        if (uploadsPerWeek >= 3) consistencyScore = 100;
        else if (uploadsPerWeek >= 1) consistencyScore = 80;
        else if (uploadsPerWeek >= 0.5) consistencyScore = 50;

        // Views per video (log scale)
        const views = parseInt(channel.viewCount) || 0;
        const avgViews = videos > 0 ? views / videos : 0;
        let viewsScore = 20;
        if (avgViews >= 50000) viewsScore = 100;
        else if (avgViews >= 10000) viewsScore = 80;
        else if (avgViews >= 2000) viewsScore = 50;

        const total = (ageScore * 0.20) + (growthScore * 0.30) + (consistencyScore * 0.25) + (viewsScore * 0.25);
        return Math.round(total);
    }

    function formatNumber(numStr) {
        if (numStr === 'Hidden') return numStr;
        const num = parseInt(numStr, 10);
        if (isNaN(num)) return '0';
        return new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(num);
    }

    window.deleteChannel = async function (id) {
        if (!confirm('Remove this channel?')) return;

        try {
            const response = await fetch(`${window.API_BASE}/channels/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                loadDashboard();
            } else {
                alert('Failed to delete channel');
            }
        } catch (error) {
            console.error('Error deleting:', error);
            alert('Error connecting to backend');
        }
    }
});
