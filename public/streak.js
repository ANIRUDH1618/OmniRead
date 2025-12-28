const StreakManager = {
    userId: null,
    state: {
        goalMinutes: 30,
        secondsRead: 0,
        totalSecondsToday: 0,
        timerId: null,
        dailyHistory: {}
    },

    init(userId) {
        if (!userId) return;
        this.userId = userId;
        
        if (window.appState && window.appState.user && window.appState.user.streak) {
            const s = window.appState.user.streak;
            this.state.goalMinutes = s.dailyGoalMinutes || 30;
            this.state.dailyHistory = s.history || {};
            
            const today = new Date().toDateString();
            this.state.totalSecondsToday = this.state.dailyHistory[today] || 0;
        }

        this.updateUI(); 
        this.renderWeeklyChart();
    },

    startReading() {
        if (this.state.timerId) return;
        this.state.timerId = setInterval(() => {
            if (document.hidden) return; 
            this.state.secondsRead++; 
            this.state.totalSecondsToday++; 
            this.updateUI(); 
            if (this.state.secondsRead % 10 === 0) {
                this.syncWithServer(10); 
            }
        }, 1000);
    },

    stopReading() {
        if(this.state.timerId) {
            clearInterval(this.state.timerId);
            this.state.timerId = null;
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
            const data = await res.json();
            if(data.success && data.streak) {
                this.state.dailyHistory = data.streak.history;
            }
        } catch (e) { console.error("Streak Sync Failed", e); }
    },

    async setGoal(minutes) {
        this.state.goalMinutes = parseInt(minutes);
        this.updateUI();
        this.renderWeeklyChart(); 
        this.closeGoalModal();
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
            timerDisplay.innerHTML = `<span class="text-3xl lg:text-4xl font-bold text-vermilion">${minutesRead}</span> <span class="text-sm text-gray-500 dark:text-gray-400 mb-1">/ ${this.state.goalMinutes} mins</span>`;
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
            const min = Math.floor(this.state.secondsRead / 60);
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
            
            let seconds = this.state.dailyHistory[dateStr] || 0;
            if (dateStr === today.toDateString()) seconds = this.state.totalSecondsToday;

            const minutes = Math.floor(seconds / 60);
            let heightPercent = Math.min(100, (minutes / this.state.goalMinutes) * 100);
            if (heightPercent < 6) heightPercent = 6;

            const isToday = (d.toDateString() === today.toDateString());
            const isFuture = (d > today);
            
            let baseOpacity = isToday ? '1' : (isFuture ? '0.1' : '0.3');
            
            barsHTML += `
                <div class="relative group flex-1 flex items-end justify-center h-full cursor-pointer">
                    <div class="w-[40%] bg-vermilion rounded-t-sm transition-all duration-300 ${!isFuture ? 'group-hover:opacity-100 group-hover:scale-110' : ''}" 
                         style="height: ${heightPercent}%; opacity: ${baseOpacity}">
                    </div>
                    
                    <div class="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black dark:bg-white text-white dark:text-black text-[10px] font-bold py-1 px-2 rounded pointer-events-none whitespace-nowrap z-20 shadow-lg">
                        ${minutes} min
                        <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black dark:border-t-white"></div>
                    </div>
                </div>
            `;
            labelsHTML += `<span class="flex-1 text-center">${daysLabel[d.getDay()]}</span>`;
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