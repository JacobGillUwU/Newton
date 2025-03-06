const fs = require('fs');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');

class MagicNewtonAPIClient {
    constructor() {
        this.headers = {
            'Accept': '*/*',
            'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'Content-Type': 'application/json',
            'Referer': 'https://www.magicnewton.com/portal/rewards',
            'Sec-Ch-Ua': '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        };
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [✓] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [✗] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [!] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [ℹ] ${msg}`.blue);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i > 0; i--) {
            const timestamp = new Date().toLocaleTimeString();
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[${timestamp}] [*] Chờ ${i} giây để tiếp tục vòng lặp...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }


    async getUserData(token) {
        const url = 'https://www.magicnewton.com/portal/api/user';
        const headers = { ...this.headers, 'Cookie': `__Secure-next-auth.session-token=${token}` };

        try {
            const response = await axios.get(url, { headers });
            if (response.status === 200 && response.data.data) {
                return { success: true, data: response.data.data };
            } else {
                return { success: false, error: 'Invalid response format' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getQuests(token) {
        const url = 'https://www.magicnewton.com/portal/api/quests';
        const headers = { ...this.headers, 'Cookie': `__Secure-next-auth.session-token=${token}` };

        try {
            const response = await axios.get(url, { headers });
            if (response.status === 200 && response.data.data) {
                return { success: true, data: response.data.data };
            } else {
                return { success: false, error: 'Invalid response format' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getDailyDiceRollId(token) {
        try {
            const questsResult = await this.getQuests(token);
            if (!questsResult.success) {
                this.log('Failed to fetch quests', 'error');
                return null;
            }

            const diceRollQuest = questsResult.data.find(quest => quest.title === 'Daily Dice Roll');
            if (!diceRollQuest) {
                this.log('Daily Dice Roll quest not found', 'error');
                return null;
            }

            return diceRollQuest.id;
        } catch (error) {
            this.log(`Error getting Daily Dice Roll ID: ${error.message}`, 'error');
            return null;
        }
    }

    async getUserQuests(token) {
        const url = 'https://www.magicnewton.com/portal/api/userQuests';
        const headers = { ...this.headers, 'Cookie': `__Secure-next-auth.session-token=${token}` };

        try {
            const response = await axios.get(url, { headers });
            if (response.status === 200 && response.data.data) {
                return { success: true, data: response.data.data };
            } else {
                return { success: false, error: 'Invalid response format' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async checkDiceRollAvailability(token) {
        try {
            const diceRollId = await this.getDailyDiceRollId(token);
            if (!diceRollId) {
                return false;
            }

            const userQuestsResult = await this.getUserQuests(token);
            if (!userQuestsResult.success) {
                this.log('Failed to fetch user quests', 'error');
                return false;
            }

            const diceRollQuest = userQuestsResult.data.find(
                quest => quest.questId === diceRollId
            );

            if (!diceRollQuest) {
                return true;
            }

            const lastUpdateTime = DateTime.fromISO(diceRollQuest.updatedAt);
            const currentTime = DateTime.now();
            const hoursDiff = currentTime.diff(lastUpdateTime, 'hours').hours;

            if (hoursDiff < 24) {
                const remainingHours = Math.ceil(24 - hoursDiff);
                this.log(`Chưa đến thời gian Roll Dice, thời gian còn lại ${remainingHours} giờ`, 'warning');
                return false;
            }

            return true;
        } catch (error) {
            this.log(`Error checking dice roll availability: ${error.message}`, 'error');
            return false;
        }
    }

    async performDiceRoll(token, diceRollId) {
        const url = 'https://www.magicnewton.com/portal/api/userQuests';
        const headers = { ...this.headers, 'Cookie': `__Secure-next-auth.session-token=${token}` };
        const payload = {
            questId: diceRollId,
            metadata: {
                action: "ROLL"
            }
        };
    
        try {
            const userQuestsResponse = await axios.get(url, { headers });
            if (userQuestsResponse.status === 200 && userQuestsResponse.data.data) {
                const completedQuests = userQuestsResponse.data.data.filter(
                    quest => quest.questId === diceRollId && quest.status === 'COMPLETED'
                );
    
                if (completedQuests.length > 0) {
                    const mostRecentQuest = completedQuests.sort((a, b) => 
                        DateTime.fromISO(b.updatedAt).toMillis() - DateTime.fromISO(a.updatedAt).toMillis()
                    )[0];
    
                    const lastUpdateTime = DateTime.fromISO(mostRecentQuest.updatedAt).setZone('local');
                    const nextRollTime = lastUpdateTime.plus({ hours: 24 });
                    
                    this.log(`Quest đã hoàn thành trước đó, credits nhận được: ${mostRecentQuest.credits}`, 'warning');
                    if (mostRecentQuest._diceRolls) {
                        this.log(`Các lần roll trước đó: [${mostRecentQuest._diceRolls.join(', ')}]`, 'custom');
                    }
                    this.log(`Thời gian roll tiếp theo: ${nextRollTime.toFormat('dd/MM/yyyy HH:mm:ss')}`, 'custom');
                    return true;
                }
            }
    
            let isCompleted = false;
            let totalCredits = 0;
            let allRolls = [];
    
            while (!isCompleted) {
                const response = await axios.post(url, payload, { headers });
                
                if (response.status === 200 && response.data.data) {
                    const { status, credits, _diceRolls, updatedAt } = response.data.data;
                    
                    if (_diceRolls) {
                        allRolls = allRolls.concat(_diceRolls);
                        this.log(`Rolls: [${_diceRolls.join(', ')}]`, 'custom');
                    }
    
                    if (credits) {
                        totalCredits += credits;
                    }
    
                    if (status === 'COMPLETED') {
                        isCompleted = true;
                        const serverTime = DateTime.fromISO(updatedAt);
                        const localNextRollTime = serverTime.plus({ hours: 24 }).setZone('local');
                        
                        this.log(`Roll dice hoàn thành, tổng nhận được ${totalCredits} credits`, 'success');
                        this.log(`Tất cả các lần roll: [${allRolls.join(', ')}]`, 'custom');
                        this.log(`Thời gian roll tiếp theo: ${localNextRollTime.toFormat('dd/MM/yyyy HH:mm:ss')}`, 'custom');
                    } else if (status === 'PENDING') {
                        this.log('Tiếp tục roll...', 'info');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } else {
                    this.log('Failed to perform dice roll', 'error');
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            if (error.response?.status === 400 && error.response?.data?.message === 'Quest already completed') {
                try {
                    const userQuestsResponse = await axios.get(url, { headers });
                    if (userQuestsResponse.status === 200 && userQuestsResponse.data.data) {
                        const completedQuests = userQuestsResponse.data.data.filter(
                            quest => quest.questId === diceRollId && quest.status === 'COMPLETED'
                        );
    
                        if (completedQuests.length > 0) {
                            const mostRecentQuest = completedQuests.sort((a, b) => 
                                DateTime.fromISO(b.updatedAt).toMillis() - DateTime.fromISO(a.updatedAt).toMillis()
                            )[0];
    
                            const lastUpdateTime = DateTime.fromISO(mostRecentQuest.updatedAt).setZone('local');
                            const nextRollTime = lastUpdateTime.plus({ hours: 24 });
                            
                            this.log(`Quest đã hoàn thành trước đó, credits nhận được: ${mostRecentQuest.credits}`, 'warning');
                            if (mostRecentQuest._diceRolls) {
                                this.log(`Các lần roll trước đó: [${mostRecentQuest._diceRolls.join(', ')}]`, 'custom');
                            }
                            this.log(`Thời gian roll tiếp theo: ${nextRollTime.toFormat('dd/MM/yyyy HH:mm:ss')}`, 'custom');
                            return true;
                        }
                    }
                } catch (secondaryError) {
                    this.log(`Error checking completed quests: ${secondaryError.message}`, 'error');
                }
            }
            
            this.log(`Error performing dice roll: ${error.message}`, 'error');
            return false;
        }
    }

    async checkAndPerformDiceRoll(token, diceRollId) {
        try {
            const userQuestsResult = await this.getUserQuests(token);
            if (!userQuestsResult.success) {
                this.log('Failed to fetch user quests', 'error');
                return false;
            }

            const diceRollQuest = userQuestsResult.data.find(
                quest => quest.questId === diceRollId
            );

            let shouldRoll = false;

            if (!diceRollQuest) {
                shouldRoll = true;
            } else {
                const lastUpdateTime = DateTime.fromISO(diceRollQuest.updatedAt).setZone('local');
                const currentTime = DateTime.now().setZone('local');
                const hoursDiff = currentTime.diff(lastUpdateTime, 'hours').hours;

                if (hoursDiff >= 24) {
                    shouldRoll = true;
                } else {
                    const remainingHours = Math.ceil(24 - hoursDiff);
                    const nextRollTime = lastUpdateTime.plus({ hours: 24 });
                    this.log(`Chưa đến thời gian Roll Dice, thời gian còn lại ${remainingHours} giờ`, 'warning');
                    this.log(`Thời gian roll tiếp theo: ${nextRollTime.toFormat('dd/MM/yyyy HH:mm:ss')}`, 'custom');
                }
            }

            if (shouldRoll) {
                return await this.performDiceRoll(token, diceRollId);
            }

            return false;
        } catch (error) {
            this.log(`Error checking and performing dice roll: ${error.message}`, 'error');
            return false;
        }
    }

    async getNextRollTime(token, diceRollId) {
        try {
            const headers = { ...this.headers, 'Cookie': `__Secure-next-auth.session-token=${token}` };
            const response = await axios.get('https://www.magicnewton.com/portal/api/userQuests', { headers });
            
            if (response.status === 200 && response.data.data) {
                const completedQuests = response.data.data.filter(
                    quest => quest.questId === diceRollId && quest.status === 'COMPLETED'
                );
    
                if (completedQuests.length === 0) {
                    return DateTime.now();
                }
    
                const mostRecentQuest = completedQuests.sort((a, b) => 
                    DateTime.fromISO(b.updatedAt).toMillis() - DateTime.fromISO(a.updatedAt).toMillis()
                )[0];
    
                const lastUpdateTime = DateTime.fromISO(mostRecentQuest.updatedAt).setZone('local');
                return lastUpdateTime.plus({ hours: 24 });
            }
            
            return null;
        } catch (error) {
            this.log(`Error getting next roll time: ${error.message}`, 'error');
            return null;
        }
    }

    async checkAndPerformSocialQuests(token) {
        try {
            const questsResult = await this.getQuests(token);
            if (!questsResult.success) {
                this.log('Failed to fetch quests', 'error');
                return;
            }

            const userQuestsResult = await this.getUserQuests(token);
            if (!userQuestsResult.success) {
                this.log('Failed to fetch user quests', 'error');
                return;
            }

            const completedQuestIds = new Set(
                userQuestsResult.data.map(quest => quest.questId)
            );

            const socialQuests = questsResult.data.filter(quest => 
                quest.title.startsWith('Follow ') && 
                quest.title !== 'Follow Discord Server'
            );

            for (const quest of socialQuests) {
                if (!completedQuestIds.has(quest.id)) {
                    await this.performSocialQuest(token, quest.id, quest.title);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            this.log(`Error processing social quests: ${error.message}`, 'error');
        }
    }

    async performSocialQuest(token, questId, platform) {
        const url = 'https://www.magicnewton.com/portal/api/userQuests';
        const headers = { ...this.headers, 'Cookie': `__Secure-next-auth.session-token=${token}` };
        const payload = {
            questId: questId,
            metadata: {}
        };

        try {
            const response = await axios.post(url, payload, { headers });
            if (response.status === 200 && response.data.data) {
                const { credits } = response.data.data;
                this.log(`Làm nhiệm vụ ${platform} thành công, nhận ${credits} Credits`, 'success');
                return true;
            }
            return false;
        } catch (error) {
            if (error.response?.status === 400) {
                this.log(`Nhiệm vụ ${platform} đã hoàn thành trước đó`, 'warning');
                return true;
            }
            this.log(`Error performing ${platform} quest: ${error.message}`, 'error');
            return false;
        }
    }

    async processAccount(token) {
        try {
            const result = await this.getUserData(token);
            if (result.success) {
                const { email, refCode } = result.data;
                this.log(`Account ${email.yellow} | refcode: ${refCode.green}`, 'custom');
                
                await this.checkAndPerformSocialQuests(token);
                
                const diceRollId = await this.getDailyDiceRollId(token);
                if (diceRollId) {
                    await this.checkAndPerformDiceRoll(token, diceRollId);
                    return {
                        success: true,
                        nextRollTime: await this.getNextRollTime(token, diceRollId)
                    };
                }
                
                return { success: false };
            } else {
                this.log(`Failed to fetch data: ${result.error}`, 'error');
                return { success: false };
            }
        } catch (error) {
            this.log(`Error processing account: ${error.message}`, 'error');
            return { success: false };
        }
    }

    calculateWaitTime(nextRollTimes) {
        const validTimes = nextRollTimes.filter(time => time !== null);
        
        if (validTimes.length === 0) {
            return 24 * 60 * 60;
        }
    
        const now = DateTime.now();
        const futureRollTimes = validTimes.filter(time => time > now);
    
        if (futureRollTimes.length === 0) {
            return 24 * 60 * 60;
        }
    
        const earliestTime = DateTime.min(...futureRollTimes);
        
        let waitSeconds = Math.ceil(earliestTime.diff(now, 'seconds').seconds);
        
        waitSeconds += 5 * 60;
        
        if (waitSeconds < 300) {
            return 24 * 60 * 60;
        }
    
        return waitSeconds;
    }

    async main() {
        try {
            const tokens = fs.readFileSync('data.txt', 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);

            while (true) {
                const nextRollTimes = [];
                
                for (let i = 0; i < tokens.length; i++) {
                    const token = tokens[i].trim();
                    console.log(`========== Xử lý tài khoản ${i + 1} ==========`);
                    const result = await this.processAccount(token);
                    if (result.success && result.nextRollTime) {
                        nextRollTimes.push(result.nextRollTime);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                const waitSeconds = this.calculateWaitTime(nextRollTimes);
                const waitTimeFormatted = DateTime.now().plus({ seconds: waitSeconds })
                    .toFormat('dd/MM/yyyy HH:mm:ss');
                
                this.log(`Thời gian chờ tiếp theo: ${waitTimeFormatted}`, 'default');
                await this.countdown(waitSeconds);
            }
        } catch (error) {
            this.log(`Fatal error: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

const client = new MagicNewtonAPIClient();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});