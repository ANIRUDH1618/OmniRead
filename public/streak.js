const StreakManager = {
    userId: null,
    state: {
        goalMinutes: 30,
        secondsRead: 0, // Session seconds
        totalSecondsToday: 0, // DB + Session
        timerId: null,
        dailyHistory: {}
    },

    init(userId) {
        if (!userId) return;
        this.userId = userId;
        
        // 1. Load Initial State from Window (Populated by DB in dashboard.js/reader.js)
        if (window.appState && window.appState.user && window.appState.user.streak) {
            const s = window.appState.user.streak;
            this.state.goalMinutes = s.dailyGoalMinutes || 30;
            
            // Convert Map/Object to local history
            this.state.dailyHistory = s.history || {};
            
            const today = new Date().toDateString();
            this.state.totalSecondsToday = this.state.dailyHistory[today] || 0;
        }

        this.updateUI(); 
        this.renderWeeklyChart();
    },

    // Reading Logic: Counts session time locally, Syncs periodically
    startReading() {
        if (this.state.timerId) return;
        
        // Sync every 10 seconds
        this.state.timerId = setInterval(() => {
            if (document.hidden) return; 

            this.state.secondsRead++; // Local session counter
            this.state.totalSecondsToday++; // Aggregate for UI

            this.updateUI(); 
            
            // Sync to DB every 10s
            if (this.state.secondsRead % 10 === 0) {
                this.syncWithServer(10); // Send the chunk
            }
        }, 1000);
    },

    stopReading() {
        if(this.state.timerId) {
            clearInterval(this.state.timerId);
            this.state.timerId = null;
            // Final Sync of remaining seconds
            const remainder = this.state.secondsRead % 10;
            if (remainder > 0) this.syncWithServer(remainder);
        }
    },

    async syncWithServer(secondsToAdd) {
        try {
            const res = await fetch('/api/me/streak', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secondsAdd: secondsToAdd })
            });
            // Update local history from server response to ensure sync
            const data = await res.json();
            if(data.success && data.streak) {
                this.state.dailyHistory = data.streak.history;
            }
        } catch (e) {
            console.error("Streak Sync Failed", e);
        }
    },

    async setGoal(minutes) {
        this.state.goalMinutes = parseInt(minutes);
        this.updateUI();
        this.renderWeeklyChart(); 
        this.closeGoalModal();
        
        // Save Goal to DB
        await fetch('/api/me/streak', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goalMinutes: this.state.goalMinutes })
        });
    },

    updateUI() {
        const minutesRead = Math.floor(this.state.totalSecondsToday / 60);
        const percent = Math.min(100, (this.state.totalSecondsToday / (this.state.goalMinutes * 60)) * 100);

        const timerDisplay = document.getElementById('daily-read-text');
        if (timerDisplay) {
            timerDisplay.innerHTML = `<span class="text-4xl font-bold text-vermilion">${minutesRead}</span> <span class="text-sm text-gray-500 dark:text-gray-400 mb-1">/ ${this.state.goalMinutes} mins</span>`;
        }

        const fireFill = document.getElementById('fire-fill');
        const fireGlow = document.getElementById('fire-glow-container');
        if (fireFill) {
            fireFill.style.height = `${percent}%`;
        }

        if (fireGlow) {
            if (percent >= 100) {
                fireGlow.classList.add('animate-pulse', 'drop-shadow-[0_0_15px_rgba(234,88,12,0.8)]');
            } else {
                fireGlow.classList.remove('animate-pulse', 'drop-shadow-[0_0_15px_rgba(234,88,12,0.8)]');
            }
        }

        const readerTimer = document.getElementById('timer-display');
        if (readerTimer) {
            const min = Math.floor(this.state.secondsRead / 60); // Show session time in reader
            const sec = this.state.secondsRead % 60;
            readerTimer.innerText = `${min}:${sec < 10 ? '0'+sec : sec}`;
        }
    },

    renderWeeklyChart() {
        const barContainer = document.getElementById('weekly-bars');
        const labelContainer = document.getElementById('weekly-labels');
        if (!barContainer || !labelContainer) return;

        let barsHTML = '';
        let labelsHTML = '';
        
        const daysLabel = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const today = new Date();
        
        const currentDayIndex = (today.getDay() + 6) % 7; 
        const monday = new Date(today);
        monday.setDate(today.getDate() - currentDayIndex);
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const dateStr = d.toDateString();
            
            // Use live data if today, else history
            let seconds = this.state.dailyHistory[dateStr] || 0;
            if (dateStr === today.toDateString()) {
                seconds = this.state.totalSecondsToday;
            }

            const minutes = Math.floor(seconds / 60);
            
            let heightPercent = Math.min(100, (minutes / this.state.goalMinutes) * 100);
            if (heightPercent < 6) heightPercent = 6;

            const isToday = (d.toDateString() === today.toDateString());
            const isFuture = (d > today);
            
            let opacity = '0.3'; 
            if (isToday) opacity = '1'; 
            if (isFuture) opacity = '0.1';

            barsHTML += `<div class="w-full bg-vermilion rounded-t-sm transition-all duration-500" style="height: ${heightPercent}%; opacity: ${opacity}" title="${minutes}m"></div>`;
            labelsHTML += `<span>${daysLabel[d.getDay()]}</span>`;
        }

        barContainer.innerHTML = barsHTML;
        labelContainer.innerHTML = labelsHTML;
    },

    openGoalModal() {
        const modal = document.getElementById('goal-modal');
        if (modal) modal.classList.remove('hidden');
    },

    closeGoalModal() {
        const modal = document.getElementById('goal-modal');
        if (modal) modal.classList.add('hidden');
    }
};