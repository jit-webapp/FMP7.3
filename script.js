document.addEventListener('DOMContentLoaded', () => {
    
    const DB_NAME = 'expenseTrackerDB_JamesIT';
    const DB_VERSION = 4; 

    const STORE_TRANSACTIONS = 'transactions';
    const STORE_CATEGORIES = 'categories';
    const STORE_FREQUENT_ITEMS = 'frequentItems';
    const STORE_CONFIG = 'config';
    const STORE_ACCOUNTS = 'accounts'; 
    const STORE_AUTO_COMPLETE = 'autoComplete'; 
    
    const PAGE_IDS = ['page-home', 'page-list', 'page-calendar', 'page-settings', 'page-guide'];
    // ********** Master Password Config **********
    const MASTER_PASSWORD = 'James0849664455';
    const HASHED_MASTER_PASSWORD = CryptoJS.SHA256(MASTER_PASSWORD).toString();
    // ************************************************

    let db;
    const SpeechRecognition = window.SpeechRecognition ||
    window.webkitSpeechRecognition;
    let recognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'th-TH'; 
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
    } else {
        console.warn("Web Speech API not supported in this browser.");
    }
    
    // ********** NEW AUTO LOCK VARIABLES **********
    let lastActivityTime = Date.now();
    let autoLockTimeoutId = null;
    const AUTOLOCK_CONFIG_KEY = 'autoLockTimeout';
    // *********************************************
    
    // ********** NEW DARK MODE VARIABLE **********
    const DARK_MODE_CONFIG_KEY = 'isDarkMode'; 
    // *********************************************
	
	// +++ เพิ่มส่วนนี้ +++
    const AUTO_CONFIRM_CONFIG_KEY = 'autoConfirmPassword';
    // ++++++++++++++++++
	
    const DEFAULT_PASSWORD = '1234';
    const DEFAULT_CATEGORIES = {
        income: ['เงินเดือน', 'รายได้เสริม', 'ค่าคอม', 'รายได้อื่นๆ'],
        expense: ['อาหาร', 'เครื่องดื่ม', 'เดินทาง', 'ของใช้ส่วนตัว', 'ของใช้ในบ้าน', 'รายจ่ายอื่นๆ']
    };
    const DEFAULT_FREQUENT_ITEMS = ['กินข้าว', 'รายจ่ายทั่วไป'];
    
    // *** NEW: Icon Choices for Account Settings ***
    const ICON_CHOICES = [
        'fa-wallet', 'fa-piggy-bank', 'fa-credit-card', 'fa-money-bill-wave', 
        'fa-sack-dollar', 'fa-building-columns', 'fa-car', 'fa-house', 
        'fa-utensils', 'fa-dumbbell', 'fa-plane', 'fa-graduation-cap', 
        'fa-shopping-cart', 'fa-hospital', 'fa-gift', 'fa-receipt',
        'fa-file-invoice-dollar', 'fa-briefcase', 'fa-mobile-screen', 'fa-store', 
        'fa-person-running', 'fa-paw', 'fa-heart', 'fa-lightbulb'
    ];
    // ********************************************

    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
               console.error('Database error:', event.target.error);
                reject('Database error: ' + event.target.error);
            };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    const tx = event.target.transaction;

                    let txStore;
                    if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
                        txStore = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });
                        txStore.createIndex('type', 'type', { unique: false });
                    } else {
                        txStore = tx.objectStore(STORE_TRANSACTIONS);
                    }

                    if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
                        db.createObjectStore(STORE_CATEGORIES, { keyPath: 'type' });
                    }
                    if (!db.objectStoreNames.contains(STORE_FREQUENT_ITEMS)) {
                        db.createObjectStore(STORE_FREQUENT_ITEMS, { keyPath: 'name' });
                    }
                    if (!db.objectStoreNames.contains(STORE_CONFIG)) {
                        db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
                    }

                    if (event.oldVersion < 2) {
                         if (!db.objectStoreNames.contains(STORE_ACCOUNTS)) {
                            const accountStore = db.createObjectStore(STORE_ACCOUNTS, { keyPath: 'id' });
                            accountStore.createIndex('displayOrder', 'displayOrder', { unique: false });
                        }
                        
                        if (!txStore.indexNames.contains('accountId')) {
                            txStore.createIndex('accountId', 'accountId', { unique: false });
                        }
                         if (!txStore.indexNames.contains('toAccountId')) {
                            txStore.createIndex('toAccountId', 'toAccountId', { unique: false });
                        }
                    }

                    // +++ NEW in v3: Auto-Complete Store +++
                    if (event.oldVersion < 3) {
                        if (!db.objectStoreNames.contains(STORE_AUTO_COMPLETE)) {
                            // Key is 'name' because we want to look up by name
                            db.createObjectStore(STORE_AUTO_COMPLETE, { keyPath: 'name' });
                        }
                    }
                    
                    // +++ NEW in v4: Add any new features or indexes here +++
                    if (event.oldVersion < 4) {
                         // ตัวอย่าง: เพิ่ม Index สำหรับค้นหาตามชื่อรายการ
                         if (!txStore.indexNames.contains('name')) {
                             txStore.createIndex('name', 'name', { unique: false });
                         }
                         console.log('IndexedDB Upgrade: Running v4 migration (Added "name" index to transactions)');
                    }
                    
                    // Default data (only on first install, v1)
                    if (event.oldVersion < 1) { 
                        const catStore = tx.objectStore(STORE_CATEGORIES);
                        catStore.add({ type: 'income', items: DEFAULT_CATEGORIES.income });
                        catStore.add({ type: 'expense', items: 'DEFAULT_CATEGORIES.expense' });

                        const itemStore = tx.objectStore(STORE_FREQUENT_ITEMS);
                        DEFAULT_FREQUENT_ITEMS.forEach(item => itemStore.add({ name: item }));
                        
                        const configStore = tx.objectStore(STORE_CONFIG);
                        const hashedPassword = CryptoJS.SHA256(DEFAULT_PASSWORD).toString(); 
                        configStore.add({ key: 'password', value: hashedPassword });
                        
                        configStore.add({ key: AUTOLOCK_CONFIG_KEY, value: 10 }); 
                        configStore.add({ key: DARK_MODE_CONFIG_KEY, value: false }); 
                    }
                };
                request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };
        });
    }

    async function runMigration() {
        try {
            const accounts = await dbGetAll(STORE_ACCOUNTS);
            if (accounts.length > 0) {
                return;
            }

            console.log("Running one-time data migration for v2...");
            Swal.fire({
                title: 'กำลังอัปเกรดข้อมูล',
                text: 'โปรดรอสักครู่ ระบบกำลังย้ายข้อมูลเก่าของคุณไปยังระบบบัญชีใหม่...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            const defaultCash = { 
                id: 'acc-cash-' + Date.now(), 
                name: 'เงินสด', 
                type: 'cash', 
                initialBalance: 0,
                icon: 'fa-wallet',
                iconName: 'fa-wallet', 
                displayOrder: Date.now() 
            };
            const defaultCredit = { 
                id: 'acc-credit-' + Date.now(), 
                name: 'บัตรเครดิต (เริ่มต้น)', 
                type: 'credit', 
                initialBalance: 0,
                icon: 'fa-credit-card',
                iconName: 'fa-credit-card', 
                displayOrder: Date.now() + 1 
            };
            await dbPut(STORE_ACCOUNTS, defaultCash);
            await dbPut(STORE_ACCOUNTS, defaultCredit);

            const transactions = await dbGetAll(STORE_TRANSACTIONS);
            const updatePromises = [];
            let migratedCount = 0;
            for (const tx of transactions) {
                if (tx.accountId) {
                    continue;
                }
                if (tx.isNonDeductible === true) {
                    tx.accountId = defaultCredit.id;
                } else {
                    tx.accountId = defaultCash.id;
                }
                delete tx.isNonDeductible;
                updatePromises.push(dbPut(STORE_TRANSACTIONS, tx));
                migratedCount++;
            }

            await Promise.all(updatePromises);
            Swal.close();

        } catch (err) {
            console.error("Migration failed:", err);
            Swal.fire({
                title: 'อัปเกรดข้อมูลล้มเหลว', 
                text: 'ไม่สามารถย้ายข้อมูลเก่าได้: ' + err.message, 
                icon: 'error',
                customClass: { popup: state.isDarkMode ? 'swal2-popup' : '' },
                background: state.isDarkMode ? '#1a1a1a' : '#fff',
                color: state.isDarkMode ? '#e5e7eb' : '#545454',
            });
        }
    }

    function dbGet(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    function dbGetAll(storeName) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    function dbPut(storeName, item) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    function dbDelete(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    function dbClear(storeName) {
        return new Promise((resolve, reject) => {
            if (!db) return reject("DB not initialized");
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    function getSortedAccounts() {
        return [...state.accounts].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }
    
    let myChart;
    let myListPageBarChart;
    let myExpenseByNameChart; 
    let myCalendar = null;
    let lastUndoAction = null;
    let lastRedoAction = null;
    
    let currentReceiptBase64 = null; 
	const MAX_FILE_SIZE_MB = 100;
	
	// --- เพิ่ม: ค่ากำหนดการบีบอัด
    const COMPRESS_MAX_WIDTH = 1024; // ความกว้างหรือสูงสูงสุด (pixel) - 1024px ชัดพอสำหรับใบเสร็จ
    const COMPRESS_QUALITY = 0.7;    // คุณภาพไฟล์ JPEG (0.0 - 1.0) - 0.7 คือ 70% (ชัดแต่ไฟล์เล็ก)

    let currentPage = 'home';
    let isTransitioning = false; 
    let state = {
        transactions: [],
        categories: {
            income: [],
            expense: []
        },
        accounts: [], 
        frequentItems: [],
        autoCompleteList: [], 
        filterType: 'all', 
        searchTerm: '',
        homeFilterType: 'all', 
        homeViewMode: 'month',
        homeCurrentDate: new Date().toISOString().slice(0, 10),
        listViewMode: 'all',
        listCurrentDate: new Date().toISOString().slice(0, 10),
        password: null,
        homeCurrentPage: 1,
        homeItemsPerPage: 10, 
        listCurrentPage: 1,
        listItemsPerPage: 10,
        calendarCurrentDate: new Date().toISOString().slice(0, 10), 
        listChartMode: 'items',
        listGroupBy: 'none', 
        showBalanceCard: false, 
        isDarkMode: false, 
        settingsCollapse: {},
        autoLockTimeout: 0 
    };
    
    // ********** NEW: Account Detail Modal View State & Functions **********
    let accountDetailState = {
        accountId: null,
        viewMode: 'all', // 'all', 'month', 'year'
        currentDate: new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    };

    function updateAccountDetailControls() {
        const getEl = (id) => document.getElementById(id);
        const viewMode = accountDetailState.viewMode;
        const currentDate = accountDetailState.currentDate;
        
        getEl('acc-detail-view-mode-select').value = viewMode;
        
        if (viewMode === 'all') {
            getEl('acc-detail-month-controls').classList.add('hidden');
            getEl('acc-detail-year-controls').classList.add('hidden');
            getEl('acc-detail-month-controls').classList.remove('flex');
            getEl('acc-detail-year-controls').classList.remove('flex');
        } else if (viewMode === 'month') {
            getEl('acc-detail-month-controls').classList.remove('hidden');
            getEl('acc-detail-month-controls').classList.add('flex');
            getEl('acc-detail-year-controls').classList.add('hidden');
            getEl('acc-detail-year-controls').classList.remove('flex');
            
            const monthYear = currentDate.slice(0, 7);
            getEl('acc-detail-month-picker').value = monthYear;
        } else { 
            getEl('acc-detail-month-controls').classList.add('hidden');
            getEl('acc-detail-month-controls').classList.remove('flex');
            getEl('acc-detail-year-controls').classList.remove('hidden');
            getEl('acc-detail-year-controls').classList.add('flex');
            
            const year = currentDate.slice(0, 4);
            getEl('acc-detail-year-picker').value = year;
        }
    }

    function handleAccountDetailViewModeChange(e) {
        const newMode = e.target.value;
        accountDetailState.viewMode = newMode;
        accountDetailState.currentDate = new Date().toISOString().slice(0, 10); 
        
        updateAccountDetailControls();
        renderAccountDetailList(accountDetailState.accountId);
    }

    function handleAccountDetailDateChange(e, mode) {
        let newDate;
        
        if (mode === 'month') {
            const [year, month] = e.target.value.split('-');
            if (year && month) {
                newDate = `${year}-${month}-01`;
            }
        } else { // mode === 'year'
            const year = e.target.value;
            if (year && year.length === 4) {
                newDate = `${year}-01-01`;
            }
        }

        if (newDate) {
            accountDetailState.currentDate = newDate;
            renderAccountDetailList(accountDetailState.accountId);
        }
    }

    function navigateAccountDetailPeriod(direction, mode) {
        let dateStr = accountDetailState.currentDate;
        let date = new Date(dateStr);
        
        if (mode === 'month') {
            date.setMonth(date.getMonth() + direction);
        } else { // mode === 'year'
            date.setFullYear(date.getFullYear() + direction);
        }
        
        accountDetailState.currentDate = date.toISOString().slice(0, 10);
        
        updateAccountDetailControls();
        renderAccountDetailList(accountDetailState.accountId);
    }

    // *** NEW HELPER FUNCTION: รีเฟรช Modal ถ้าเปิดอยู่ ***
    async function refreshAccountDetailModalIfOpen() {
        const modal = document.getElementById('account-detail-modal');
        if (!modal.classList.contains('hidden') && accountDetailState.accountId) {
            await renderAccountDetailList(accountDetailState.accountId);
        }
    }
    // ***************************************************************


    async function loadStateFromDB() {
        try {
            state.accounts = await dbGetAll(STORE_ACCOUNTS);
            let updateOrderPromises = [];
            let hasUndefinedOrder = false;
            state.accounts.forEach((acc, index) => {
                if (acc.displayOrder === undefined || acc.displayOrder === null) {
                    acc.displayOrder = Date.now() + index; 
                    updateOrderPromises.push(dbPut(STORE_ACCOUNTS, acc));
                    hasUndefinedOrder = true;
                }
                
                if (acc.iconName === undefined) {
                    acc.iconName = acc.icon || 'fa-wallet'; 
                    updateOrderPromises.push(dbPut(STORE_ACCOUNTS, acc));
                    hasUndefinedOrder = true;
                }
            });
            if (hasUndefinedOrder) {
                console.log('Running one-time migration for account displayOrder/iconName...');
                await Promise.all(updateOrderPromises);
                state.accounts = await dbGetAll(STORE_ACCOUNTS);
            }
            
            state.transactions = await dbGetAll(STORE_TRANSACTIONS);
            const incomeCats = await dbGet(STORE_CATEGORIES, 'income');
            const expenseCats = await dbGet(STORE_CATEGORIES, 'expense');
            state.categories.income = incomeCats ? incomeCats.items : [...DEFAULT_CATEGORIES.income];
            state.categories.expense = expenseCats ? expenseCats.items : [...DEFAULT_CATEGORIES.expense];

            const frequentItems = await dbGetAll(STORE_FREQUENT_ITEMS);
            state.frequentItems = frequentItems.map(item => item.name);
            
            state.autoCompleteList = await dbGetAll(STORE_AUTO_COMPLETE);
            const passwordConfig = await dbGet(STORE_CONFIG, 'password');
            let storedPassword;

            if (passwordConfig) {
                storedPassword = passwordConfig.value;
            } else {
                const hashedPassword = CryptoJS.SHA256(DEFAULT_PASSWORD).toString();
                await dbPut(STORE_CONFIG, { key: 'password', value: hashedPassword });
                state.password = hashedPassword;
                storedPassword = hashedPassword;
            }

            if (storedPassword && typeof storedPassword === 'string' && storedPassword.length !== 64) {
                const newlyHashed = CryptoJS.SHA256(storedPassword).toString();
                await dbPut(STORE_CONFIG, { key: 'password', value: newlyHashed });
                state.password = newlyHashed;
            } else {
                state.password = storedPassword;
            }

            const today = new Date().toISOString().slice(0, 10);
            state.homeCurrentDate = today; 
            state.listCurrentDate = today; 
            state.calendarCurrentDate = today;
            state.homeViewMode = 'month';
            state.listViewMode = 'all';
            state.homeCurrentPage = 1;
            state.homeItemsPerPage = 10;
            state.listCurrentPage = 1;
            state.listItemsPerPage = 10; 
            
            const defaultCollapseSettings = {
                'settings-accounts-content': true,
                'settings-income-content': true,
                'settings-expense-content': true,
                'settings-manual-content': true,
                'home-accounts-content': true,
                'home-transactions-content': true 
            };

            const collapseConfig = await dbGet(STORE_CONFIG, 'collapse_preferences');
            if (collapseConfig && collapseConfig.value) {
                state.settingsCollapse = { ...defaultCollapseSettings, ...collapseConfig.value };
            } else {
                state.settingsCollapse = defaultCollapseSettings;
            }
            
            const showBalanceConfig = await dbGet(STORE_CONFIG, 'showBalanceCard');
            state.showBalanceCard = showBalanceConfig ? showBalanceConfig.value : false;

            const autoLockConfig = await dbGet(STORE_CONFIG, AUTOLOCK_CONFIG_KEY);
            state.autoLockTimeout = autoLockConfig ? autoLockConfig.value : 0;
            
            const darkModeConfig = await dbGet(STORE_CONFIG, DARK_MODE_CONFIG_KEY);
            state.isDarkMode = darkModeConfig ? darkModeConfig.value : false;

			// +++ เพิ่มส่วนนี้ +++
            const autoConfirmConfig = await dbGet(STORE_CONFIG, AUTO_CONFIRM_CONFIG_KEY);
            state.autoConfirmPassword = autoConfirmConfig ? autoConfirmConfig.value : false;
            // ++++++++++++++++++

        } catch (e) {
            console.error("Failed to load state from DB, using defaults.", e);
        }
    }
    
    async function initApp() {
        try {
            await initDB();
            await runMigration(); 
            await loadStateFromDB();
            setupEventListeners();
            setupSwipeNavigation(); 
            setupAutoLockListener(); 
            applyDarkModePreference(); 

            const lockScreen = document.getElementById('app-lock-screen');
            const initialPageId = PAGE_IDS[0];
            
            PAGE_IDS.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            if (state.password) {
                lockScreen.classList.remove('hidden');
                document.getElementById('unlock-form').addEventListener('submit', handleUnlock);
            } else {
                document.getElementById(initialPageId).style.display = 'block';
                currentPage = initialPageId.replace('page-', '');
                onAppStart(); 
            }

        } catch (err) {
            console.error("Failed to initialize app:", err);
            Swal.fire({
                title: 'เกิดข้อผิดพลาด', 
                text: 'ไม่สามารถเริ่มต้นฐานข้อมูลได้', 
                icon: 'error',
                customClass: { popup: state.isDarkMode ? 'swal2-popup' : '' },
                background: state.isDarkMode ? '#1a1a1a' : '#fff',
                color: state.isDarkMode ? '#e5e7eb' : '#545454',
            });
        }
    }

    function onAppStart() {
        const getEl = (id) => document.getElementById(id);
        getEl('nav-home').classList.add('text-purple-600');
        getEl('nav-home').classList.remove('text-gray-600');
        getEl('nav-home-mobile').classList.add('text-purple-600'); 
        getEl('nav-home-mobile').classList.remove('text-gray-600');

        getEl('shared-controls-header').style.display = 'flex';
        updateSharedControls('home');
        renderAll(); 
        renderSettings();
        resetAutoLockTimer(); 
    }

    async function handleUnlock(e) {
        e.preventDefault();
        const inputPass = document.getElementById('unlock-password').value;
        const hashedInput = CryptoJS.SHA256(inputPass).toString();
        
        if (hashedInput === state.password || hashedInput === HASHED_MASTER_PASSWORD) {
            
            const unlockBtn = e.target.querySelector('button');
            unlockBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...';
            
            setTimeout(() => {
                document.getElementById('app-lock-screen').classList.add('hidden'); 
                document.getElementById('page-home').style.display = 'block'; 
                currentPage = 'home';
                onAppStart(); 
                
                document.getElementById('unlock-password').value = '';
                unlockBtn.innerHTML = '<i class="fa-solid fa-door-open"></i> เข้าสู่ระบบ';
                
                const Toast = Swal.mixin({
                    toast: true,
                    position: "top-end",
                    showConfirmButton: false,
                    timer: 1000,
                    timerProgressBar: true,
                    customClass: { popup: state.isDarkMode ? 'swal2-toast' : '' },
                    background: state.isDarkMode ? '#1a1a1a' : '#fff',
                    color: state.isDarkMode ? '#e5e7eb' : '#545454',
                });
                Toast.fire({
                    icon: "success",
                    title: "ยินดีต้อนรับกลับมาครับ!"
                });
            }, 10);

        } else {
            Swal.fire({
                icon: 'error',
                title: 'รหัสผ่านไม่ถูกต้อง',
                text: 'กรุณาลองใหม่อีกครั้ง',
                confirmButtonColor: '#d33',
                timer: 1500,
                customClass: { popup: state.isDarkMode ? 'swal2-popup' : '' },
                background: state.isDarkMode ? '#1a1a1a' : '#fff',
                color: state.isDarkMode ? '#e5e7eb' : '#545454',
            });
            document.getElementById('unlock-password').value = '';
            document.getElementById('unlock-password').focus();
        }
    }

    // ********** NEW: Auto Lock Logic **********
    function lockApp() {
        const isLocked = !document.getElementById('app-lock-screen').classList.contains('hidden');
        if (state.password === null || isLocked) {
            return;
        }
        
        closeModal(); 
        closeAccountDetailModal();
        openAccountModal(null, true);

        PAGE_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        document.getElementById('app-lock-screen').classList.remove('hidden');
        clearTimeout(autoLockTimeoutId);
    }

    function resetAutoLockTimer() {
        if (state.password === null || state.autoLockTimeout === 0) {
            clearTimeout(autoLockTimeoutId);
            return;
        }

        const isLocked = !document.getElementById('app-lock-screen').classList.contains('hidden');
        if (isLocked) {
            return;
        }

        clearTimeout(autoLockTimeoutId);
        lastActivityTime = Date.now();
        
        const timeoutMs = state.autoLockTimeout * 60 * 1000;

        autoLockTimeoutId = setTimeout(lockApp, timeoutMs);
    }

    function setupAutoLockListener() {
        const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
        events.forEach(event => {
            document.addEventListener(event, resetAutoLockTimer, true);
        });
        
        const selectEl = document.getElementById('auto-lock-select');
        if (selectEl) {
            selectEl.value = state.autoLockTimeout.toString();

            selectEl.addEventListener('change', async (e) => {
                const newTimeout = parseInt(e.target.value, 10);
                state.autoLockTimeout = newTimeout;
                
                try {
                    await dbPut(STORE_CONFIG, { key: AUTOLOCK_CONFIG_KEY, value: newTimeout });
                    
                    if (newTimeout > 0 && state.password === null) {
                        Swal.fire({
                            title: 'ข้อควรทราบ', 
                            text: 'ระบบ Auto Lock จะทำงานเมื่อมีการตั้งรหัสผ่านเท่านั้น', 
                            icon: 'info',
                            customClass: { popup: state.isDarkMode ? 'swal2-popup' : '' },
                            background: state.isDarkMode ? '#1a1a1a' : '#fff',
                            color: state.isDarkMode ? '#e5e7eb' : '#545454',
                        });
                    }
                    
                    resetAutoLockTimer();

                    const Toast = Swal.mixin({
                        toast: true,
                        position: "top-end",
                        showConfirmButton: false,
                        timer: 1000,
                        timerProgressBar: true,
                        customClass: { popup: state.isDarkMode ? 'swal2-toast' : '' },
                        background: state.isDarkMode ? '#1a1a1a' : '#fff',
                        color: state.isDarkMode ? '#e5e7eb' : '#545454',
                    });
                    Toast.fire({
                        icon: "success",
                        title: "ตั้งค่า Auto Lock สำเร็จ"
                    });

                } catch (err) {
                    console.error("Failed to save auto lock config:", err);
                }
            });
        }
    }
    
    // ********** NEW: Dark Mode Logic **********
    function applyDarkModePreference() {
        const body = document.body;
        const getEl = (id) => document.getElementById(id);
        const toggleDarkModeBtn = getEl('toggle-dark-mode');
        
        if (state.isDarkMode) {
            body.classList.add('dark');
            Swal.fire.defaults = {
                customClass: { 
                    popup: 'swal2-popup', 
                    confirmButton: 'bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-xl shadow-lg text-lg',
                    cancelButton: 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-xl text-lg'
                }, 
                background: '#1a1a1a', 
                color: '#e5e7eb',
                confirmButtonColor: '#a78bfa',
                cancelButtonColor: '#374151',
            };

        } else {
            body.classList.remove('dark');
            Swal.fire.defaults = { 
                customClass: { popup: '' }, 
                background: '#fff', 
                color: '#545454',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
            };
        }

        if(toggleDarkModeBtn) {
            toggleDarkModeBtn.checked = state.isDarkMode;
        }

        if (myChart) { myChart.destroy(); myChart = null; }
        if (myExpenseByNameChart) { myExpenseByNameChart.destroy(); myExpenseByNameChart = null; }
        if (myListPageBarChart) { myListPageBarChart.destroy(); myListPageBarChart = null; }
        if (myCalendar) { 
            myCalendar.destroy(); 
            myCalendar = null;
        }
    }

    function setupDarkModeListener() {
        const getEl = (id) => document.getElementById(id);
        const toggleDarkModeBtn = getEl('toggle-dark-mode');
        
        if(toggleDarkModeBtn) {
            toggleDarkModeBtn.checked = state.isDarkMode;

            toggleDarkModeBtn.addEventListener('change', async (e) => {
                const isChecked = e.target.checked;
                state.isDarkMode = isChecked;
                
                try {
                    await dbPut(STORE_CONFIG, { key: DARK_MODE_CONFIG_KEY, value: isChecked });
                    applyDarkModePreference(); 
                    
                    if (currentPage === 'home') renderAll();
                    if (currentPage === 'list') renderListPage();
                    if (currentPage === 'calendar') renderCalendarView();
                    
                } catch (err) {
                    console.error("Failed to save dark mode config:", err);
                }
            });
        }
    }


    function applySettingsPreferences() {
        if (!state.settingsCollapse) return;

        Object.keys(state.settingsCollapse).forEach(targetId => {
            const content = document.getElementById(targetId);
            
            if (!content) return;
            
            const header = document.querySelector(`.settings-toggle-header[data-target="${targetId}"]`);
            const icon = header ? header.querySelector('i.fa-chevron-down') : null;

            const isOpen = state.settingsCollapse[targetId];

            if (isOpen) {
                content.classList.remove('hidden');
                if (icon) {
                    icon.classList.add('rotate-180');
                    icon.classList.remove('text-green-500'); 
                    icon.classList.add('text-red-500');      
                }
            } else {
                content.classList.add('hidden');
                if (icon) {
                    icon.classList.remove('rotate-180');
                    icon.classList.remove('text-red-500');   
                    icon.classList.add('text-green-500');    
                }
            }
        });
    }
    
    function setupEventListeners() {
		
	// +++ เพิ่มโค้ดส่วนนี้: Auto Confirm สำหรับหน้า Lock Screen +++
				const unlockInput = document.getElementById('unlock-password');
						if (unlockInput) {
							// ใช้ฟังก์ชันกลางเพื่อตรวจสอบ (เรียกใช้ทั้งตอน input และ keyup)
							const checkPassword = (e) => {
								if (state.autoConfirmPassword && e.target.value.length > 0) {
									const val = e.target.value;
									const hashedInput = CryptoJS.SHA256(val).toString();

									if (hashedInput === state.password || hashedInput === HASHED_MASTER_PASSWORD) {
										// สั่งเบลอ (Blur) เพื่อปิดคีย์บอร์ดมือถือทันที
										e.target.blur(); 
										// ส่งคำสั่งล็อกอิน
										document.getElementById('unlock-form').dispatchEvent(new Event('submit'));
									}
								}
							};

							unlockInput.addEventListener('input', checkPassword);
							unlockInput.addEventListener('keyup', checkPassword); // ดักเพิ่มเผื่อบางเครื่อง input ไม่ติด
						}
        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++++
		
        document.querySelectorAll('.settings-toggle-header').forEach(header => {
            header.addEventListener('click', async (e) => {
                const targetId = header.getAttribute('data-target');
                const content = document.getElementById(targetId);
                const icon = header.querySelector('i.fa-chevron-down');

                const isHidden = content.classList.contains('hidden');
                const newStateOpen = isHidden; 

                if (newStateOpen) {
                    content.classList.remove('hidden');
                    icon.classList.add('rotate-180');
                    icon.classList.remove('text-green-500');
                    icon.classList.add('text-red-500');
                } else {
                    content.classList.add('hidden');
                    icon.classList.remove('rotate-180');
                    icon.classList.remove('text-red-500');
                    icon.classList.add('text-green-500');
                }

                if (!state.settingsCollapse) state.settingsCollapse = {};
                state.settingsCollapse[targetId] = newStateOpen;
                
                try {
                    await dbPut(STORE_CONFIG, { key: 'collapse_preferences', value: state.settingsCollapse });
                } catch (err) {
                    console.error("Failed to save collapse settings:", err);
                }
            });
        });

        const getEl = (id) => document.getElementById(id);
        getEl('home-table-placeholder').innerHTML = createTransactionTableHTML('home-transaction-list-body');
        getEl('list-table-placeholder').innerHTML = createTransactionTableHTML('transaction-list-body');

        
        const mobileMenuButton = getEl('mobile-menu-button');
        const mobileMenu = getEl('mobile-menu');
        const mobileMenuIcon = getEl('mobile-menu-icon');
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
            if (mobileMenu.classList.contains('hidden')) {
                mobileMenuIcon.classList.remove('fa-times');
                mobileMenuIcon.classList.add('fa-bars');
            } else {
                mobileMenuIcon.classList.remove('fa-bars');
                mobileMenuIcon.classList.add('fa-times');
            }
 
         });
        const mobileNavLinks = [
            { id: 'nav-home-mobile', page: 'page-home' },
            { id: 'nav-list-mobile', page: 'page-list' },
            { id: 'nav-calendar-mobile', page: 'page-calendar' }, 
            { id: 'nav-settings-mobile', page: 'page-settings' },
           { id: 'nav-guide-mobile', page: 'page-guide' }
        ];
        mobileNavLinks.forEach(link => {
            getEl(link.id).addEventListener('click', () => {
                showPage(link.page);
                
               
                mobileMenu.classList.add('hidden');
                mobileMenuIcon.classList.remove('fa-times');
                mobileMenuIcon.classList.add('fa-bars');
            });
        });
        
        const mobileHomeButton = getEl('mobile-home-button');
        if (mobileHomeButton) {
            mobileHomeButton.addEventListener('click', () => {
                showPage('page-home');
                mobileMenu.classList.add('hidden');
                mobileMenuIcon.classList.remove('fa-times');
                mobileMenuIcon.classList.add('fa-bars');
            });
        }
    

        
        getEl('nav-home').addEventListener('click', () => showPage('page-home'));
        getEl('nav-list').addEventListener('click', () => showPage('page-list'));
        getEl('nav-calendar').addEventListener('click', () => showPage('page-calendar')); 
        getEl('nav-settings').addEventListener('click', () => showPage('page-settings'));
        getEl('nav-guide').addEventListener('click', () => showPage('page-guide'));

        getEl('view-mode-select').addEventListener('change', (e) => handleChangeViewMode(e, currentPage));
        getEl('month-picker').addEventListener('input', (e) => handleDateChange(e, currentPage));
        getEl('month-prev').addEventListener('click', () => navigateMonth(-1, currentPage));
        getEl('month-next').addEventListener('click', () => navigateMonth(1, currentPage));
        getEl('year-picker').addEventListener('input', (e) => handleDateChange(e, currentPage));
        getEl('year-prev').addEventListener('click', () => navigateYear(-1, currentPage));
        getEl('year-next').addEventListener('click', () => navigateYear(1, currentPage));
        getEl('list-chart-selector').addEventListener('change', (e) => {
            state.listChartMode = e.target.value;
            renderListPage();
        });
        getEl('add-tx-btn').addEventListener('click', () => openModal());
        
        const voiceBtn = getEl('voice-add-btn');
        if (voiceBtn) {
            if (SpeechRecognition) {
                voiceBtn.addEventListener('click', startVoiceRecognition);
            } else {
                
                voiceBtn.disabled = true;
                voiceBtn.innerHTML = '<i class="fa-solid fa-microphone-slash mr-2"></i> ไม่รองรับเสียง';
                voiceBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-400', 'hover:bg-gray-400');
            }
        }
        

        getEl('home-filter-buttons').addEventListener('click', (e) => {
            if (e.target.classList.contains('home-filter-btn')) {
                handleHomeFilter(e.target);
            }
        });
        getEl('search-input').addEventListener('input', handleSearch);

        getEl('home-items-per-page-select').addEventListener('change', (e) => {
            state.homeItemsPerPage = parseInt(e.target.value, 10);
            state.homeCurrentPage = 1; 
            renderAll(); 
        });
        getEl('items-per-page-select').addEventListener('change', (e) => {
            state.listItemsPerPage = parseInt(e.target.value, 10);
            state.listCurrentPage = 1; 
            renderListPage();
        });
        getEl('list-group-by-select').addEventListener('change', (e) => {
            state.listGroupBy = e.target.value;
            state.listCurrentPage = 1; 
            renderListPage();
        });
        getEl('list-filter-buttons').addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                handleFilter(e.target);
            }
        });
        
        const handleViewReceiptClick = (btn) => {
            const base64 = btn.dataset.base64;
            if (base64) {
                Swal.fire({
                    html: `
                        <div id="panzoom-wrapper" style="overflow: hidden; cursor: grab; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; min-height: 300px;">
                            <img id="popup-receipt-img" src="${base64}" class="mx-auto" style="max-width: 100%; max-height: 70vh; object-fit: contain; transition: none;">
                        </div>
                        <div class="text-center text-sm text-gray-500 mt-3">
                            <i class="fa-solid fa-magnifying-glass-plus"></i> หมุนลูกกลิ้งเมาส์ หรือ จีบนิ้วเพื่อซูม
                        </div>
                    `,
                    showCloseButton: true,
                    showConfirmButton: false,
                    width: 'auto', 
                    padding: '1em',
                    customClass: {
                        popup: state.isDarkMode ? 'swal2-popup' : '',
                    },
                    background: state.isDarkMode ? '#1a1a1a' : '#fff',
                    didOpen: () => {
                        const elem = document.getElementById('popup-receipt-img');
                        const wrapper = document.getElementById('panzoom-wrapper');
                        
                        if (typeof Panzoom !== 'undefined') {
                            const panzoom = Panzoom(elem, {
                                maxScale: 5,   
                                minScale: 0.5, 
                                contain: 'outside',
                                startScale: 1
                            });
                            wrapper.addEventListener('wheel', panzoom.zoomWithWheel);
                        } else {
                            console.warn('Panzoom library not loaded');
                        }
                    }
                });
            }
        };

        getEl('list-table-placeholder').addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            const viewReceiptBtn = e.target.closest('.view-receipt-icon'); 

            if (editBtn) handleEditClick(editBtn);
            if (deleteBtn) handleDeleteClick(deleteBtn);
            if (viewReceiptBtn) handleViewReceiptClick(viewReceiptBtn); 
        });
        getEl('home-table-placeholder').addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            const viewReceiptBtn = e.target.closest('.view-receipt-icon'); 

            if (editBtn) handleEditClick(editBtn);
            if (deleteBtn) handleDeleteClick(deleteBtn);
            if (viewReceiptBtn) handleViewReceiptClick(viewReceiptBtn); 
        });
        
        getEl('home-pagination-controls').addEventListener('click', (e) => handlePaginationClick(e, 'home'));
        getEl('list-pagination-controls').addEventListener('click', (e) => handlePaginationClick(e, 'list'));
    
        getEl('modal-close-btn').addEventListener('click', closeModal);
        getEl('modal-cancel-btn').addEventListener('click', closeModal);
        getEl('transaction-form').addEventListener('submit', handleFormSubmit);
        document.querySelectorAll('input[name="tx-type"]').forEach(radio => {
            radio.addEventListener('change', updateFormVisibility);
        });
        getEl('toggle-calc-btn').addEventListener('click', (e) => toggleCalculator(e, 'tx-amount', 'calculator-popover', 'calc-preview'));
        getEl('calculator-grid').addEventListener('click', (e) => {
            const calcBtn = e.target.closest('.calc-btn');
            if (calcBtn) handleCalcClick(calcBtn, 'tx-amount', 'calculator-popover', 'calc-preview');
        });
        getEl('tx-amount').addEventListener('keyup', (e) => handleCalcPreview(e.target.value, 'calc-preview'));
        
        getEl('tx-receipt-file').addEventListener('change', handleReceiptFileChange);
        getEl('clear-receipt-btn').addEventListener('click', clearReceiptFile);
        getEl('receipt-preview').addEventListener('click', () => {
            const src = getEl('receipt-preview').src;
            if (src) {
                Swal.fire({
                    imageUrl: src,
                    imageAlt: 'Receipt Image',
                    showCloseButton: true,
                    showConfirmButton: false,
                    customClass: {
                        image: 'max-w-full max-h-[80vh] object-contain',
                        popup: state.isDarkMode ? 'swal2-popup' : ''
                    }
                });
            }
        });

        
        // Account Calculator Listeners
        getEl('toggle-account-calc-btn').addEventListener('click', (e) => toggleCalculator(e, 'input-account-balance', 'account-calculator-popover', 'acc-calc-preview'));
        getEl('account-calculator-grid').addEventListener('click', (e) => {
            const calcBtn = e.target.closest('.calc-btn');
            if (calcBtn) handleCalcClick(calcBtn, 'input-account-balance', 'account-calculator-popover', 'acc-calc-preview');
        });
        getEl('input-account-balance').addEventListener('keyup', (e) => handleCalcPreview(e.target.value, 'acc-calc-preview'));

        getEl('toggle-edit-account-calc-btn').addEventListener('click', (e) => toggleCalculator(e, 'edit-account-balance', 'edit-account-calculator-popover', 'edit-acc-calc-preview'));
        getEl('edit-account-calculator-grid').addEventListener('click', (e) => {
            const calcBtn = e.target.closest('.calc-btn');
            if (calcBtn) handleCalcClick(calcBtn, 'edit-account-balance', 'edit-account-calculator-popover', 'edit-acc-calc-preview');
        });
        getEl('edit-account-balance').addEventListener('keyup', (e) => handleCalcPreview(e.target.value, 'edit-acc-calc-preview'));
        // End Account Calculator Listeners


        getEl('form-add-account').addEventListener('submit', handleAddAccount);
        getEl('list-accounts').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-account-btn');
            const editBtn = e.target.closest('.edit-account-btn');
            const moveBtn = e.target.closest('.move-account-btn'); 
            const editIconBtn = e.target.closest('.edit-icon-btn'); 

            if (deleteBtn) {
                promptForPassword('ป้อนรหัสผ่านเพื่อลบบัญชี').then(hasPermission => {
                    if (hasPermission) handleDeleteAccountClick(deleteBtn);
                });
            }
            if (editBtn) {
                 promptForPassword('ป้อนรหัสผ่านเพื่อแก้ไขบัญชี').then(hasPermission => {
                    if (hasPermission) openAccountModal(editBtn.dataset.id);
                });
            }
            if (editIconBtn) { 
                 promptForPassword('ป้อนรหัสผ่านเพื่อแก้ไขไอคอน').then(hasPermission => {
                    if (hasPermission) openIconModal(editIconBtn.dataset.id);
                });
            }

            if (moveBtn) handleMoveAccount(moveBtn.dataset.id, moveBtn.dataset.direction);
        });
        getEl('account-form-modal').addEventListener('click', (e) => {
            if (e.target.id === 'account-form-modal') openAccountModal(null, true);
        });
        getEl('account-modal-close-btn').addEventListener('click', () => openAccountModal(null, true));
        getEl('account-modal-cancel-btn').addEventListener('click', () => openAccountModal(null, true));
        
        getEl('icon-modal-close-btn').addEventListener('click', closeIconModal);
        getEl('icon-modal-cancel-btn').addEventListener('click', closeIconModal);
        getEl('icon-search').addEventListener('input', (e) => renderIconChoices(e.target.value));

        getEl('icon-list-container').addEventListener('click', (e) => {
            const btn = e.target.closest('.icon-select-btn');
            if (btn) {
                const selectedIcon = btn.dataset.icon;
                const preview = getEl('icon-preview');
                const currentClasses = preview.className.split(' ').filter(cls => !cls.startsWith('fa-'));
                preview.className = currentClasses.join(' ') + ' fa-solid ' + selectedIcon;
                preview.setAttribute('data-current-icon', selectedIcon);
            }
        });

        getEl('icon-modal-save-btn').addEventListener('click', async () => {
            const accountId = getEl('edit-icon-account-id').value;
            const newIconName = getEl('icon-preview').getAttribute('data-current-icon');
            const accIndex = state.accounts.findIndex(a => a.id === accountId);

            if (accIndex === -1) {
                Swal.fire('ข้อผิดพลาด', 'ไม่พบบัญชี', 'error');
                return;
            }
            
            const oldAccount = JSON.parse(JSON.stringify(state.accounts[accIndex]));
            state.accounts[accIndex].iconName = newIconName;
            
            try {
                await dbPut(STORE_ACCOUNTS, state.accounts[accIndex]);
                setLastUndoAction({ type: 'account-edit', oldData: oldAccount, newData: state.accounts[accIndex] });
                closeIconModal();
                renderAccountSettingsList();
                if (currentPage === 'home') renderAll();
                Swal.fire('สำเร็จ', 'บันทึกไอคอนเรียบร้อยแล้ว', 'success');
            } catch (err) {
                console.error("Failed to save icon:", err);
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกไอคอนได้', 'error');
            }
        });
       
        getEl('account-form').addEventListener('submit', (e) => {
            e.preventDefault();
            handleEditAccountSubmit(e); 
        });


        getEl('form-add-income-cat').addEventListener('submit', handleAddCategory);
        getEl('form-add-expense-cat').addEventListener('submit', handleAddCategory);
        getEl('list-income-cat').addEventListener('click', (e) => {
            const btn = e.target.closest('.delete-cat-btn');
            if (btn) handleDeleteCategory(btn);
        });
        getEl('list-expense-cat').addEventListener('click', (e) => {
            const btn = e.target.closest('.delete-cat-btn');
            if (btn) handleDeleteCategory(btn);
        });
        getEl('form-add-frequent-item').addEventListener('submit', handleAddFrequentItem);
        getEl('list-frequent-item').addEventListener('click', (e) => {
            const btn = e.target.closest('.delete-item-btn');
            if (btn) handleDeleteFrequentItem(btn);
        });
        getEl('btn-backup').addEventListener('click', handleBackup);
        getEl('btn-import').addEventListener('click', () => getEl('import-file-input').click());
        getEl('import-file-input').addEventListener('change', handleImport);
        getEl('btn-clear-all').addEventListener('click', handleClearAll);
        getEl('btn-manage-password').addEventListener('click', handleManagePassword);
        getEl('btn-export-csv').addEventListener('click', handleExportCSV); 
        
        const toggleBalanceBtn = getEl('toggle-show-balance');
        if(toggleBalanceBtn) {
            toggleBalanceBtn.checked = state.showBalanceCard;

            toggleBalanceBtn.addEventListener('change', async (e) => {
                const isChecked = e.target.checked;
                state.showBalanceCard = isChecked;
                
                try {
                    await dbPut(STORE_CONFIG, { key: 'showBalanceCard', value: isChecked });
                    
                    if (currentPage === 'home') {
                        renderAll();
                    }
                } catch (err) {
                    console.error("Failed to save config:", err);
                }
            });
        }

        setupDarkModeListener();
		
		// +++ เพิ่มส่วนนี้ +++
        const toggleAutoConfirmBtn = getEl('toggle-auto-confirm-password');
        if (toggleAutoConfirmBtn) {
            toggleAutoConfirmBtn.addEventListener('change', async (e) => {
                const isChecked = e.target.checked;
                state.autoConfirmPassword = isChecked;
                try {
                    await dbPut(STORE_CONFIG, { key: AUTO_CONFIRM_CONFIG_KEY, value: isChecked });
                    
                    // แจ้งเตือนเล็กน้อย
                    const Toast = Swal.mixin({
                        toast: true, position: "top-end", showConfirmButton: false, timer: 1500, timerProgressBar: true,
                        customClass: { popup: state.isDarkMode ? 'swal2-toast' : '' },
                        background: state.isDarkMode ? '#1a1a1a' : '#fff',
                        color: state.isDarkMode ? '#e5e7eb' : '#545454',
                    });
                    Toast.fire({ icon: "success", title: isChecked ? "เปิดยืนยันอัตโนมัติ" : "ปิดยืนยันอัตโนมัติ" });

                } catch (err) {
                    console.error("Failed to save config:", err);
                }
            });
        }

        getEl('btn-undo').addEventListener('click', handleUndo);
        getEl('btn-redo').addEventListener('click', handleRedo);
        getEl('cal-prev-btn').addEventListener('click', () => {
            if (myCalendar) myCalendar.prev(); 
        });
        getEl('cal-next-btn').addEventListener('click', () => {
            if (myCalendar) myCalendar.next(); 
        });
        getEl('cal-year-input').addEventListener('change', (e) => {
            if (myCalendar) {
                const newYear = parseInt(e.target.value);
                if (!isNaN(newYear)) {
                    const currentDate = myCalendar.getDate(); 
                    const newDate = new Date(newYear, currentDate.getMonth(), 1);
                    myCalendar.gotoDate(newDate);
                }
            }
        });
        getEl('all-accounts-summary').addEventListener('click', (e) => {
            const card = e.target.closest('.compact-account-card');
            if (card) {
                const accountId = card.dataset.id;
                if (accountId) {
                    showAccountDetailModal(accountId);
                }
            }
        });
        
        getEl('account-detail-modal-close-btn').addEventListener('click', closeAccountDetailModal);
        
        // +++ ADDED NEW: Listener for buttons inside Account Detail Modal +++
        getEl('account-detail-modal-body').addEventListener('click', (e) => {
            const viewReceiptBtn = e.target.closest('.view-receipt-icon');
            const editBtn = e.target.closest('.edit-btn');     // +++ เพิ่ม
            const deleteBtn = e.target.closest('.delete-btn'); // +++ เพิ่ม

            if (viewReceiptBtn) handleViewReceiptClick(viewReceiptBtn);
            if (editBtn) handleEditClick(editBtn);       // +++ เรียกฟังก์ชันแก้ไข
            if (deleteBtn) handleDeleteClick(deleteBtn); // +++ เรียกฟังก์ชันลบ
        });
        // +++ END ADDED NEW +++
        
        getEl('add-tx-from-account-btn').addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if(btn && btn.dataset.accountId){
                closeAccountDetailModal();
                openModal(null, btn.dataset.accountId);
            }
        });
        getEl('tx-name').addEventListener('input', (e) => {
            const val = e.target.value.trim();
            const type = document.querySelector('input[name="tx-type"]:checked').value;
            
            const learnedItem = state.autoCompleteList.find(item => item.name === val && item.type === type);
            
            const hintEl = getEl('auto-fill-hint');
            
            if (learnedItem) {
                getEl('tx-category').value = learnedItem.category;
                getEl('tx-amount').value = learnedItem.amount;
                hintEl.classList.remove('hidden');
            } else {
                hintEl.classList.add('hidden');
            }
            
            const toggleFavBtn = getEl('toggle-favorite-btn');
            const isFav = state.frequentItems.includes(val);
            toggleFavBtn.classList.toggle('text-yellow-500', isFav);
            toggleFavBtn.classList.toggle('text-gray-400', !isFav);
        });
        function handleSummaryCardClick(type) {
            state.filterType = type;
            state.listCurrentPage = 1;

            document.querySelectorAll('#list-filter-buttons .filter-btn').forEach(btn => {
                btn.classList.remove('bg-purple-500', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-700');
                if (btn.dataset.filter === type) {
                    btn.classList.add('bg-purple-500', 'text-white');
                    btn.classList.remove('bg-gray-200', 'text-gray-700');
                }
            });
            state.listViewMode = state.homeViewMode;
            getEl('view-mode-select').value = state.homeViewMode;
            
            if (state.homeViewMode === 'month') {
                state.listCurrentDate = state.homeCurrentDate;
            } else if (state.homeViewMode === 'year') {
                 state.listCurrentDate = state.homeCurrentDate;
            }

            updateSharedControls('list');
            showPage('page-list');
        }

        getEl('summary-income-card').addEventListener('click', () => handleSummaryCardClick('income'));
        getEl('summary-expense-card').addEventListener('click', () => handleSummaryCardClick('expense'));
        getEl('summary-balance-card').addEventListener('click', () => handleSummaryCardClick('all'));
        
        getEl('acc-detail-view-mode-select').addEventListener('change', handleAccountDetailViewModeChange);
        getEl('acc-detail-month-picker').addEventListener('input', (e) => handleAccountDetailDateChange(e, 'month'));
        getEl('acc-detail-month-prev').addEventListener('click', () => navigateAccountDetailPeriod(-1, 'month'));
        getEl('acc-detail-month-next').addEventListener('click', () => navigateAccountDetailPeriod(1, 'month'));
        getEl('acc-detail-year-picker').addEventListener('input', (e) => handleAccountDetailDateChange(e, 'year'));
        getEl('acc-detail-year-prev').addEventListener('click', () => navigateAccountDetailPeriod(-1, 'year'));
        getEl('acc-detail-year-next').addEventListener('click', () => navigateAccountDetailPeriod(1, 'year'));
		const modalVoiceBtn = getEl('modal-voice-btn');
				if (modalVoiceBtn) {
					if (SpeechRecognition) {
						const triggerVoice = (e) => {
							if (e.type === 'touchstart') {
								e.preventDefault();
							}
							startModalVoiceRecognition();
						};

						modalVoiceBtn.addEventListener('click', triggerVoice);
						modalVoiceBtn.addEventListener('touchstart', triggerVoice, { passive: false });
					} else {
						console.warn("Speech API not supported.");
						modalVoiceBtn.style.display = 'none'; 
					}
				}
        getEl('toggle-favorite-btn').addEventListener('click', handleToggleFavorite);
    }

    function setupSwipeNavigation() {
        const mainContent = document.getElementById('page-wrapper');
        let startX = 0;
        let startY = 0;
        const threshold = 75; 
        const timeThreshold = 500;

        let startTime;
        mainContent.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                startTime = Date.now();
            }
        }, { passive: true });
        mainContent.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1 && !isTransitioning) {
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                const endTime = Date.now();

                const diffX = endX - startX;
                const diffY = endY - startY;
                const deltaTime = endTime - startTime;

                if (deltaTime < timeThreshold && Math.abs(diffX) > threshold && Math.abs(diffX) > Math.abs(diffY)) {
                    
                    const currentPageId = 'page-' + currentPage;
                    const currentPageIndex = PAGE_IDS.findIndex(id => id === currentPageId);
                    let nextPageId = null;

                    if (diffX < 0) { // Swipe Left (Next Page)
                        const nextIndex = currentPageIndex + 1;
                        if (nextIndex < PAGE_IDS.length) {
                            nextPageId = PAGE_IDS[nextIndex];
                        }
                    } else { // Swipe Right (Previous Page)
                        const prevIndex = currentPageIndex - 1;
                        if (prevIndex >= 0) {
                            nextPageId = PAGE_IDS[prevIndex];
                        }
                    }

                    if (nextPageId) {
                        showPage(nextPageId);
                    }
                }
            }
        });
    }


    function showPage(pageId) {
        if (isTransitioning) return;
        resetAutoLockTimer(); 
        const pageName = pageId.replace('page-', '');
        const getEl = (id) => document.getElementById(id);
        
        const oldPageId = 'page-' + currentPage;
        const oldPageEl = getEl(oldPageId);
        const newPageEl = getEl(pageId);
        
        if (oldPageEl === newPageEl) return;
        
        isTransitioning = true;
        const oldPageIndex = PAGE_IDS.indexOf(oldPageId);
        const newPageIndex = PAGE_IDS.indexOf(pageId);
        const directionClass = (newPageIndex > oldPageIndex) ? 'slide-left' : 'slide-right';

        oldPageEl.classList.add('page-transition-exit-active', directionClass);
        oldPageEl.style.display = 'block'; 
        
        newPageEl.style.display = 'block';
        newPageEl.classList.add('page-transition-enter', directionClass);

        oldPageEl.offsetHeight;
        newPageEl.offsetHeight;

        if (directionClass === 'slide-left') {
            newPageEl.style.transform = 'translateX(100%)';
        } else {
            newPageEl.style.transform = 'translateX(-100%)';
        }
        newPageEl.style.opacity = '0';
        requestAnimationFrame(() => {
            oldPageEl.classList.add('page-transition-exit-final');
            oldPageEl.style.opacity = '0';

            newPageEl.classList.add('page-transition-enter-active');
            newPageEl.classList.remove('page-transition-enter');
        });
        setTimeout(() => {
            oldPageEl.style.display = 'none';
            oldPageEl.classList.remove('page-transition-exit-active', 'page-transition-exit-final', 'slide-left', 'slide-right');
            oldPageEl.style.transform = '';
            oldPageEl.style.opacity = '';
            
            newPageEl.classList.remove('page-transition-enter-active', 'slide-left', 'slide-right');
            newPageEl.style.position = ''; 
            newPageEl.style.transform = '';
            newPageEl.style.opacity = '';
            
            currentPage = pageName;
            isTransitioning = false; 

            const navButtons = [
                getEl('nav-home'), getEl('nav-list'), getEl('nav-calendar'), 
                getEl('nav-settings'), getEl('nav-guide')
            ];
            navButtons.forEach(btn => {
                btn.classList.remove('text-purple-600');
                btn.classList.add('text-gray-600');
            });
            const mobileNavButtons = {
                'page-home': getEl('nav-home-mobile'),
                'page-list': getEl('nav-list-mobile'),
                'page-calendar': getEl('nav-calendar-mobile'), 
                'page-settings': getEl('nav-settings-mobile'),
                'page-guide': getEl('nav-guide-mobile')
            };
            Object.values(mobileNavButtons).forEach(btn => {
                btn.classList.remove('text-purple-600');
                btn.classList.add('text-gray-600');
            });
            const currentNavEl = getEl('nav-' + currentPage);
            if (currentNavEl) {
                currentNavEl.classList.add('text-purple-600');
                currentNavEl.classList.remove('text-gray-600');
            }
            const currentMobileNavEl = mobileNavButtons[pageId];
            if (currentMobileNavEl) {
                currentMobileNavEl.classList.add('text-purple-600');
                currentMobileNavEl.classList.remove('text-gray-600');
            }

            if (pageId === 'page-home') {
                getEl('shared-controls-header').style.display = 'flex';
                updateSharedControls('home');
                renderAll(); 
            } else if (pageId === 'page-list') {
                getEl('shared-controls-header').style.display = 'flex';
                updateSharedControls('list');
                renderListPage();
            
            } else if (pageId === 'page-calendar') {
                getEl('shared-controls-header').style.display = 'none';
                renderCalendarView();

            } else if (pageId === 'page-settings') {
                getEl('shared-controls-header').style.display = 'none';
                renderSettings();
            } else if (pageId === 'page-guide') {
                getEl('shared-controls-header').style.display = 'none';
            }

        }, 200);
    }


    function renderAll() {
        const visibleTransactions = getTransactionsForView('home');
        const allAccountBalances = getAccountBalances(state.transactions);

        renderSummary(visibleTransactions, allAccountBalances);
        renderAllAccountSummary(allAccountBalances);
        
        applySettingsPreferences();
        
        const balanceCard = document.getElementById('summary-balance-card');
        const cardsContainer = document.getElementById('summary-cards-container'); 

        if (state.showBalanceCard) {
            balanceCard.classList.remove('hidden');
            if(cardsContainer) {
                cardsContainer.classList.remove('grid-cols-2');
                cardsContainer.classList.add('grid-cols-3');
            }
        } else {
            balanceCard.classList.add('hidden');
            if(cardsContainer) {
                cardsContainer.classList.remove('grid-cols-3');
                cardsContainer.classList.add('grid-cols-2');
            }
        }

        let homeFilteredTxs = visibleTransactions;
        if (state.homeFilterType !== 'all') {
            homeFilteredTxs = visibleTransactions.filter(tx => tx.type === state.homeFilterType);
        }
        renderTransactionList('home-transaction-list-body', homeFilteredTxs, 'home');

        renderPieChart(visibleTransactions);
        renderExpenseByNameChart(visibleTransactions);
    }

    function updateSharedControls(source) {
        const getEl = (id) => document.getElementById(id);
        const viewMode = (source === 'home') ? state.homeViewMode : state.listViewMode;
        const currentDate = (source === 'home') ? state.homeCurrentDate : state.listCurrentDate;
        if (viewMode === 'all') {
            getEl('month-controls').classList.add('hidden');
            getEl('month-controls').classList.remove('flex');
            getEl('year-controls').classList.add('hidden');
            getEl('year-controls').classList.remove('flex');
        } else if (viewMode === 'month') {
            getEl('month-controls').classList.remove('hidden');
            getEl('month-controls').classList.add('flex');
            getEl('year-controls').classList.add('hidden');
            getEl('year-controls').classList.remove('flex');
            const monthYear = currentDate.slice(0, 7);
            getEl('month-picker').value = monthYear;
        } else { 
            getEl('month-controls').classList.add('hidden');
            getEl('month-controls').classList.remove('flex');
            getEl('year-controls').classList.remove('hidden');
            getEl('year-controls').classList.add('flex');
            const year = currentDate.slice(0, 4);
            getEl('year-picker').value = year;
        }
        getEl('view-mode-select').value = viewMode;
    }

	function getAccountBalances(allTransactions) {
			const balances = {};
			for (const acc of state.accounts) {
				balances[acc.id] = acc.initialBalance || 0;
			}

			const sortedTxs = [...allTransactions].sort((a, b) => new Date(a.date) - new Date(b.date));
			
			const now = new Date(); 

			for (const tx of sortedTxs) {
				if (new Date(tx.date) > now) {
					continue;
				}

				const amount = tx.amount;
				if (tx.type === 'income') {
					if (balances[tx.accountId] !== undefined) {
						balances[tx.accountId] += amount;
					}
				} else if (tx.type === 'expense') {
					 if (balances[tx.accountId] !== undefined) {
						balances[tx.accountId] -= amount;
					}
				} else if (tx.type === 'transfer') {
					if (balances[tx.accountId] !== undefined) { 
						balances[tx.accountId] -= amount;
					}
					if (balances[tx.toAccountId] !== undefined) { 
						balances[tx.toAccountId] += amount;
					}
				}
			}
			return balances;
		}

		function renderSummary(transactionsForPeriod, allAccountBalances) {
			const now = new Date();

			const periodTotals = transactionsForPeriod.reduce((acc, tx) => {
				if (new Date(tx.date) > now) {
					return acc;
				}

				if (tx.type === 'income') {
					acc.income += tx.amount;
				} else if (tx.type === 'expense') {
					acc.expense += tx.amount;
				}
				return acc;
			}, { income: 0, expense: 0 });

			let totalCashBalance = 0;
			const sortedAccounts = getSortedAccounts();
			for (const acc of sortedAccounts) { 
				if (acc.type === 'cash') {
					totalCashBalance += allAccountBalances[acc.id] || 0;
				}
			}

			document.getElementById('total-income').textContent = formatCurrency(periodTotals.income);
			document.getElementById('total-expense').textContent = formatCurrency(periodTotals.expense);
			
			const totalBalanceEl = document.getElementById('total-balance');
			totalBalanceEl.textContent = formatCurrency(totalCashBalance);
		}

    function renderAllAccountSummary(balances) {
        const container = document.getElementById('all-accounts-summary');
        container.innerHTML = ''; 
        
        const sortedAccounts = getSortedAccounts(); 

        if (sortedAccounts.length === 0) { 
            container.innerHTML = `<p class="text-gray-500 col-span-full text-center">ยังไม่มีบัญชี
            <button id="nav-settings-shortcut" class="text-purple-600 hover:underline">สร้างบัญชีใหม่ในหน้าตั้งค่า</button>
            </p>`;
            document.getElementById('nav-settings-shortcut').addEventListener('click', () => showPage('page-settings'));
            return;
        }
        
        sortedAccounts.forEach(acc => { 
            const balance = balances[acc.id] || 0;
            let balanceClass = 'balance-zero';
            if (balance > 0) balanceClass = 'balance-positive';
            if (balance < 0) balanceClass = 'balance-negative';
            
            const currentIcon = acc.iconName || acc.icon || 'fa-wallet';

            const cardHtml = `
                <div class="bg-gray-50 p-3 rounded-xl shadow-md border border-gray-200 compact-account-card cursor-pointer" data-id="${acc.id}">
                    <div class="flex items-center gap-3">
                        <i class="fa-solid ${currentIcon} text-purple-600 text-lg"></i>
                        <h3 class="text-base font-semibold text-gray-800 truncate">${escapeHTML(acc.name)}</h3>
                    </div>
                    <div class="w-full mt-2">
                        <p class="text-lg font-bold text-right ${balanceClass} truncate">${formatCurrency(balance)}</p>
                        <p class="text-xs text-gray-500 text-right">${acc.type === 'credit' ? 'บัตรเครดิต' : (acc.type === 'liability' ? 'หนี้สิน' : 'เงินสด')}</p>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHtml);
        });
    }

    function renderListPage() {
        const transactions = getTransactionsForView('list');
        let filteredByType = transactions;
        if (state.filterType !== 'all') {
            filteredByType = transactions.filter(tx => tx.type === state.filterType);
        }

        const searchTerm = state.searchTerm.toLowerCase().trim();
        let filtered = filteredByType;
        if (searchTerm) {
            filtered = filteredByType.filter(tx => {
                const txDate = new Date(tx.date);
                const year = txDate.getFullYear().toString();
                const month = (txDate.getMonth() + 1).toString().padStart(2, '0');
                const day = txDate.getDate().toString().padStart(2, '0');
                const thaiDate = txDate.toLocaleDateString('th-TH');
                const amountStr = String(tx.amount);
                
                const fromAccount = state.accounts.find(a => a.id === tx.accountId);
                const toAccount = state.accounts.find(a => a.id === tx.toAccountId);
                const fromAccName = fromAccount ? fromAccount.name.toLowerCase() : '';
                const toAccName = toAccount ? toAccount.name.toLowerCase() : '';

                return (
                    (tx.name && tx.name.toLowerCase().includes(searchTerm)) || 
                    (tx.category && tx.category.toLowerCase().includes(searchTerm)) || 
                    (tx.desc && tx.desc.toLowerCase().includes(searchTerm)) ||
                    fromAccName.includes(searchTerm) ||
                    toAccName.includes(searchTerm) ||
                    amountStr.includes(searchTerm) ||
                    year.includes(searchTerm) || 
                    month.includes(searchTerm) ||
                    day.includes(searchTerm) || 
                    thaiDate.includes(searchTerm)
                );
            });
        }

        const selector = document.getElementById('list-chart-selector');
        if (selector) selector.value = state.listChartMode;
        const groupBySelector = document.getElementById('list-group-by-select');
        if (groupBySelector) groupBySelector.value = state.listGroupBy;

        renderTransactionList('transaction-list-body', filtered, 'list');
        renderListPageBarChart(filtered); 
    }

    
    function createTransactionTableHTML(tbodyId) {
        return `
        <table class="w-full text-left">
            <thead>
                <tr class="border-b border-gray-200">
                    <th class="p-2 text-lg text-gray-700 font-semibold">วันที่</th>
                    <th class="p-2 text-lg text-gray-700 font-semibold">ชื่อรายการ/บัญชี</th>
             <th class="p-2 text-lg text-gray-700 font-semibold">หมวดหมู่</th>
                    <th class="p-2 text-lg text-gray-700 font-semibold text-right">จำนวนเงิน</th>
                    <th class="p-2 text-lg text-gray-700 font-semibold text-center">จัดการ</th>
                </tr>
            </thead>
            <tbody id="${tbodyId}">
                <tr>
                    <td colspan="5" class="p-6 text-center text-gray-500">ไม่มีรายการ...</td>
                </tr>
            </tbody>
        </table>
        `;
    }

    function renderTransactionList(tbodyId, allTransactions, source) {
        const listBody = document.getElementById(tbodyId);
        listBody.innerHTML = ''; 
        const isListPage = (source === 'list');
        const groupBy = isListPage ? state.listGroupBy : 'none'; 

        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (groupBy !== 'none' && isListPage) {
            const grouped = {};
            allTransactions.forEach(tx => {
                let key;
                const dateObj = new Date(tx.date);
                if (groupBy === 'day') {
                    key = tx.date.slice(0, 10);
                } else { // month
                    key = tx.date.slice(0, 7); 
                }

                if (!grouped[key]) grouped[key] = { transactions: [], income: 0, expense: 0 };
                grouped[key].transactions.push(tx);
                if (tx.type === 'income') grouped[key].income += tx.amount;
                else if (tx.type === 'expense') grouped[key].expense += tx.amount;
            });

            const sortedGroups = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
            let fullHtml = '';

            sortedGroups.forEach(key => {
                const groupData = grouped[key];
                const netBalance = groupData.income - groupData.expense;
                const netClass = netBalance >= 0 ? 'text-green-600' : 'text-red-600';
                
                let title;
                if (groupBy === 'day') {
                    title = new Date(key).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                } else { // month
                    const [y, m] = key.split('-');
                    title = new Date(y, m - 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
                }

                fullHtml += `
                    <tr class="bg-gray-200 dark:bg-gray-700">
                        <td colspan="5" class="p-3 text-lg font-bold text-gray-800 dark:text-gray-100">
                            ${title}
                            <span class="float-right text-base font-medium">
                                รายรับ: <span class="text-green-600">${formatCurrency(groupData.income)}</span> / 
                                รายจ่าย: <span class="text-red-600">${formatCurrency(groupData.expense)}</span> / 
                                สุทธิ: <span class="${netClass}">${formatCurrency(netBalance)}</span>
                            </span>
                        </td>
                    </tr>
                `;

                groupData.transactions.forEach(tx => {
                    fullHtml += createTransactionRowHtml(tx); 
                });
            });

            listBody.innerHTML = fullHtml;
            document.getElementById('list-pagination-controls').innerHTML = ''; 
            return;
        } 
        
        const currentPage = (source === 'home') ? state.homeCurrentPage : state.listCurrentPage;
        const itemsToShow = (source === 'list') ? state.listItemsPerPage : state.homeItemsPerPage;
        const totalPages = Math.ceil(allTransactions.length / itemsToShow);
        const startIndex = (currentPage - 1) * itemsToShow;
        const endIndex = startIndex + itemsToShow;
        const paginatedTransactions = allTransactions.slice(startIndex, endIndex);

        if (allTransactions.length === 0) {
            listBody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-500">ไม่มีรายการ...</td></tr>';
            renderPaginationControls(source, 0, 1);
            return;
        }

        paginatedTransactions.forEach(tx => {
            listBody.insertAdjacentHTML('beforeend', createTransactionRowHtml(tx));
        });

        renderPaginationControls(source, totalPages, currentPage);
    }

    function createTransactionRowHtml(tx) {
        const date = new Date(tx.date);
        const formattedDate = date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
        const formattedTime = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        
        const isFuture = date > new Date();
        const futureBadge = isFuture ? 
            `<span class="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full ml-2 border border-yellow-200">
                <i class="fa-solid fa-clock mr-1"></i>ล่วงหน้า
            </span>` : '';
        const rowOpacity = isFuture ? 'opacity-70' : ''; 
        
        let name, category, amount, amountClass, amountSign;
        
        const fromAccount = state.accounts.find(a => a.id === tx.accountId);
        const toAccount = state.accounts.find(a => a.id === tx.toAccountId);
        const fromAccName = fromAccount ? fromAccount.name.toLowerCase() : '';
        const toAccName = toAccount ? toAccount.name.toLowerCase() : '';
        
        const receiptIcon = tx.receiptBase64 ? 
            `<button type="button" class="view-receipt-icon text-purple-500 hover:text-purple-700 ml-2 z-10 relative" data-base64="${tx.receiptBase64}" title="คลิกเพื่อดูรูป">
                <i class="fa-solid fa-receipt"></i>
            </button>` : '';

        if (tx.type === 'transfer') {
            name = `<span class="font-bold text-blue-600">${escapeHTML(tx.name)}</span>${receiptIcon}${futureBadge}`;
            category = `<div class="text-sm">
                            <span class="text-gray-500">จาก:</span> ${fromAccName}<br>
                            <span class="text-gray-500">ไป:</span> ${toAccName}
                        </div>`;
            amount = formatCurrency(tx.amount);
            amountClass = 'text-blue-600';
            amountSign = '';
        } else {
            name = escapeHTML(tx.name) + receiptIcon + futureBadge;
            category = `<span class="block">${escapeHTML(tx.category)}</span>
                        <span class="text-sm text-purple-600">${fromAccName}</span>`;
            amount = formatCurrency(tx.amount);
            
            if (tx.type === 'income') {
                amountClass = 'text-green-600';
                amountSign = '+';
            } else {
                amountClass = 'text-red-600';
                amountSign = '-';
            }
        }

        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50 ${rowOpacity}">
                <td class="p-2 text-lg text-gray-700">
                    ${formattedDate} <span class="block text-base text-gray-500">${formattedTime} น.</span>
                </td>
                <td class="p-2 text-lg text-gray-700 font-medium break-word">
                    ${name}
                    ${tx.desc ? `<p class="text-base text-gray-500">${escapeHTML(tx.desc)}</p>` : ''}
                </td>
                <td class="p-2 text-lg text-gray-700 break-word">${category}</td>
                <td class="p-2 text-lg ${amountClass} font-semibold text-right whitespace-nowrap">${amountSign}${amount}</td>
                <td class="p-2 text-lg text-center">
                    <div class="flex flex-col md:flex-row items-center justify-center">
                        <button class="edit-btn text-blue-500 hover:text-blue-700 p-2" data-id="${tx.id}">
                            <i class="fa-solid fa-pencil"></i>
                        </button>
                        <button class="delete-btn text-red-500 hover:text-red-700 p-2" data-id="${tx.id}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }


    function renderPieChart(transactions) {
        const summary = transactions.reduce((acc, tx) => {
            if (tx.type === 'income') {
                acc.income += tx.amount;
           } else if (tx.type === 'expense') { 
                acc.expense += tx.amount;
            }
            return acc;
        }, { income: 0, expense: 0 });

        const labels = [
            `รายรับ (${formatCurrency(summary.income)})`, 
            `รายจ่าย (${formatCurrency(summary.expense)})`
        ];
        
        const data = [summary.income, summary.expense];
        if (myChart) {
            myChart.destroy();
        }
        
        const noDataEl = document.getElementById('chart-no-data');
        if (summary.income === 0 && summary.expense === 0) {
            noDataEl.textContent = 'ไม่มีข้อมูล';
            noDataEl.classList.remove('hidden');
            return;
        } else {
            noDataEl.classList.add('hidden');
        }

        const ctx = document.getElementById('transaction-chart').getContext('2d');
        
        const isMobile = window.innerWidth < 768;
        const textColor = state.isDarkMode ? '#e5e7eb' : '#4b5563'; 

        myChart = new Chart(ctx, {
            type: 'pie',
            plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : {}], 
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#22c55e', '#ef4444'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: isMobile ? 0 : 0,
                        right: isMobile ? 0 : 0,
                        top: isMobile ? 0 : 0,
                        bottom: isMobile ? 0 : 0
                    }
                },
                plugins: {
                    datalabels: {
                        display: false, 
                    },
                    legend: {
                        position: 'right',
                        align: 'center', 
                        labels: {
                            usePointStyle: true, 
                            boxWidth: isMobile ? 8 : 10,
                            padding: isMobile ? 6 : 10,
                            font: {
                                family: 'Prompt, sans-serif',
                                size: isMobile ? 10 : 12,
                                color: textColor 
                            }
                         }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ''; 
                            },
                            title: function(context) {
                                return context[0].label;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderExpenseByNameChart(transactions) {
    const expenseTransactions = transactions.filter(tx => tx.type === 'expense');
    const itemData = expenseTransactions.reduce((acc, tx) => {
        const name = tx.name || 'ไม่ระบุรายการ';
        if (!acc[name]) {
            acc[name] = 0;
        }
        acc[name] += tx.amount;
        return acc;
    }, {});
    let sortedItems = Object.entries(itemData).map(([name, amount]) => ({ name, amount }));
    sortedItems.sort((a, b) => b.amount - a.amount);

    const TOP_N = 9;
    let labels = [];
    let data = [];
    
    if (sortedItems.length > (TOP_N + 1)) { 
        const topItems = sortedItems.slice(0, TOP_N);
        const otherItems = sortedItems.slice(TOP_N);
        
        topItems.forEach(item => {
            labels.push(`${item.name} (${formatCurrency(item.amount)})`);
            data.push(item.amount);
        });
        const otherAmount = otherItems.reduce((sum, item) => sum + item.amount, 0);
        labels.push(`อื่นๆ (${formatCurrency(otherAmount)})`);
        data.push(otherAmount);
    } else {
        sortedItems.forEach(item => {
            labels.push(`${item.name} (${formatCurrency(item.amount)})`);
            data.push(item.amount);
        });
    }

    if (myExpenseByNameChart) { 
        myExpenseByNameChart.destroy();
    }
    
    const noDataEl = document.getElementById('expense-chart-no-data');
    if (data.length === 0) {
        noDataEl.classList.remove('hidden');
        return;
    } else {
        noDataEl.classList.add('hidden');
    }

    const generateColors = (numColors) => {
        let colors = [];
        const colorPalette = ['#e11d48', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#059669', '#0e7490', '#db2777', '#ca8a04', '#6d28d9', '#64748b'];
        for (let i = 0; i < numColors; i++) {
            colors.push(colorPalette[i % colorPalette.length]);
        }
        return colors;
    };

    const ctx = document.getElementById('expense-category-chart').getContext('2d');
    
    const isMobile = window.innerWidth < 768; 
    const textColor = state.isDarkMode ? '#e5e7eb' : '#4b5563'; 

    myExpenseByNameChart = new Chart(ctx, { 
        type: 'pie', 
        plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : {}],
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: generateColors(labels.length),
                borderWidth: 1
            }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: isMobile ? 0 : 0,
                        right: isMobile ? 0 : 0,
                        top: isMobile ? 0 : 0,
                        bottom: isMobile ? 0 : 0
                    }
                },
                plugins: {
                    datalabels: {
                        display: false, 
                    },
                    legend: {
                        position: 'right',
                        align: 'center', 
                        labels: {
                            usePointStyle: true, 
                            boxWidth: isMobile ? 8 : 10, 
                            padding: isMobile ? 6 : 10,  
                            font: {
                                family: 'Prompt, sans-serif',
                                size: isMobile ? 10 : 12, 
                                color: textColor 
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                 return ''; 
                            },
                            title: function(context) {
                                return context[0].label;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderListPageBarChart(transactions) {
        const ctx = document.getElementById('list-page-bar-chart').getContext('2d');
        const noDataEl = document.getElementById('list-chart-no-data');
        const titleEl = document.getElementById('list-chart-title');
        
        if (myListPageBarChart) {
            myListPageBarChart.destroy();
        }

        let labels = [];
        let datasets = [];
        let hasData = false;
        let chartType = 'bar'; 

        if (state.listChartMode === 'trend_month' || state.listChartMode === 'trend_year') {
            chartType = 'line';
            const granularity = state.listChartMode === 'trend_month' ? 'month' : 'year';
            titleEl.textContent = granularity === 'month' ? 'แนวโน้ม รายรับ-รายจ่าย รายเดือน' : 'แนวโน้ม รายรับ-รายจ่าย รายปี';
            
            const trendData = transactions.reduce((acc, tx) => {
                const dateObj = new Date(tx.date);
                let key;
                if (granularity === 'month') {
                    key = dateObj.getFullYear() + '-' + (dateObj.getMonth() + 1).toString().padStart(2, '0');
                } else { // year
                    key = dateObj.getFullYear().toString();
                }

                if (!acc[key]) acc[key] = { income: 0, expense: 0 };
                
                if (tx.type === 'income') acc[key].income += tx.amount;
                else if (tx.type === 'expense') acc[key].expense += tx.amount;
                
                return acc;
            }, {});
            
            const sortedKeys = Object.keys(trendData).sort();
            if (sortedKeys.length > 0) {
                hasData = true;
                labels = sortedKeys.map(key => {
                    if (granularity === 'month') {
                        const [y, m] = key.split('-');
                        return new Date(y, m - 1).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });
                    }
                    return key; 
                });

                datasets = [
                    {
                        label: 'รายรับ',
                        data: sortedKeys.map(key => trendData[key].income),
                        borderColor: '#22c55e', // Green
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 5
                    },
                    {
                        label: 'รายจ่าย',
                        data: sortedKeys.map(key => trendData[key].expense),
                        borderColor: '#ef4444', // Red
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 5
                    }
                ];
                
                if (granularity === 'month' && sortedKeys.length > 12) {
                    titleEl.textContent += ' (ข้อมูลย้อนหลัง 12 เดือน)';
                    const recentKeys = sortedKeys.slice(-12);
                    labels = recentKeys.map(key => {
                        const [y, m] = key.split('-');
                        return new Date(y, m - 1).toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });
                    });
                    datasets[0].data = recentKeys.map(key => trendData[key].income);
                    datasets[1].data = recentKeys.map(key => trendData[key].expense);
                }
            }
        } 
        
        else if (state.listChartMode === 'items') {
            titleEl.textContent = 'สรุปแยกตามชื่อรายการ';
            const itemData = transactions.reduce((acc, tx) => {
                if (tx.type === 'transfer') return acc;
                const name = tx.name;
                if (!acc[name]) acc[name] = { income: 0, expense: 0 };
                if (tx.type === 'income') acc[name].income += tx.amount;
                else acc[name].expense += tx.amount;
                return acc;
            }, {});
            const processedData = Object.keys(itemData).map(name => ({
                name: name,
                income: itemData[name].income,
                expense: itemData[name].expense,
                total: itemData[name].income + itemData[name].expense
            }));
            processedData.sort((a, b) => b.total - a.total);
            const topData = processedData.slice(0, 15);
            if (topData.length > 0) {
                hasData = true;
                labels = topData.map(d => d.name);
                datasets = [
                    {
                        label: 'รายรับ',
                        data: topData.map(d => d.income),
                        backgroundColor: 'rgba(34, 197, 94, 0.7)',
                        borderColor: 'rgba(34, 197, 94, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'รายจ่าย',
                        data: topData.map(d => d.expense),
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1
                    }
                ];
            }
        } 
        else if (state.listChartMode === 'summary') {
            titleEl.textContent = 'เปรียบเทียบ รายรับ vs รายจ่าย';
            let totalIncome = 0;
            let totalExpense = 0;
            transactions.forEach(tx => {
                if (tx.type === 'income') totalIncome += tx.amount;
                if (tx.type === 'expense') totalExpense += tx.amount;
            });
            if (totalIncome > 0 || totalExpense > 0) {
                hasData = true;
                labels = ['สรุปยอดรวม'];
                datasets = [
                    {
                        label: 'รายรับ',
                        data: [totalIncome],
                        backgroundColor: 'rgba(34, 197, 94, 0.7)',
                        borderColor: 'rgba(34, 197, 94, 1)',
                        borderWidth: 1,
                        barPercentage: 0.5
                    },
                    {
                        label: 'รายจ่าย',
                        data: [totalExpense],
                        backgroundColor: 'rgba(239, 68, 68, 0.7)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1,
                        barPercentage: 0.5
                    }
                ];
            }
        }
        else if (state.listChartMode === 'accounts') {
            titleEl.textContent = 'ยอดเงินคงเหลือแต่ละบัญชี (ปัจจุบัน)';
            const allBalances = getAccountBalances(state.transactions);
            const sortedAccounts = getSortedAccounts();

            if (sortedAccounts.length > 0) {
                hasData = true;
                labels = sortedAccounts.map(acc => acc.name);
                const balanceData = sortedAccounts.map(acc => allBalances[acc.id] || 0);
                const bgColors = balanceData.map(val => val >= 0 ? 'rgba(59, 130, 246, 0.7)' : 'rgba(239, 68, 68, 0.7)');
                const borderColors = balanceData.map(val => val >= 0 ? 'rgba(59, 130, 246, 1)' : 'rgba(239, 68, 68, 1)');
                datasets = [{
                    label: 'ยอดคงเหลือ',
                    data: balanceData,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }];
            }
        }

        if (!hasData) {
            noDataEl.classList.remove('hidden');
            return;
        } else {
            noDataEl.classList.add('hidden');
        }
        
        const tickColor = state.isDarkMode ? '#9ca3af' : '#6b7280';
        const gridColor = state.isDarkMode ? '#374151' : '#e5e7eb';
        const labelColor = state.isDarkMode ? '#e5e7eb' : '#4b5563';

        myListPageBarChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: state.listChartMode === 'accounts' ? 'y' : 'x',
                plugins: {
                    legend: {
                        display: state.listChartMode !== 'accounts',
                        labels: { 
                            font: { family: 'Prompt, sans-serif', color: labelColor }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                const value = chartType === 'line' ? context.parsed.y : (state.listChartMode === 'accounts' ? context.parsed.x : context.parsed.y);
                                if (value !== null) {
                                    label += formatCurrency(value);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { font: { family: 'Prompt, sans-serif', color: tickColor } },
                        grid: { color: gridColor },
                         ...(state.listChartMode === 'accounts' && {
                            ticks: {
                                callback: function(value) { return formatCurrency(value); },
                                font: { family: 'Prompt, sans-serif', color: tickColor }
                            }
                        })
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { font: { family: 'Prompt, sans-serif', color: tickColor } },
                        grid: { color: gridColor },
                        ...(state.listChartMode !== 'accounts' && {
                            ticks: {
                                callback: function(value) { return formatCurrency(value);
},
                                font: { family: 'Prompt, sans-serif', color: tickColor }
                            }
                        })
                    }
                }
            }
        });
    }

    function renderCalendarView() {
        try {
            const calendarEl = document.getElementById('calendar-container');
            const yearInput = document.getElementById('cal-year-input'); 
            
            if (!calendarEl || !yearInput) return;

            const dailyTotals = {};
            state.transactions.forEach(tx => {
                const dateStr = tx.date.slice(0, 10); 
                if (!dailyTotals[dateStr]) dailyTotals[dateStr] = { income: 0, expense: 0, transfer: 0 }; 
                if (tx.type === 'expense') dailyTotals[dateStr].expense += tx.amount;
                else if (tx.type === 'income') dailyTotals[dateStr].income += tx.amount;
                else if (tx.type === 'transfer') dailyTotals[dateStr].transfer += tx.amount;
            });
            const calendarEvents = [];
            Object.keys(dailyTotals).forEach(date => {
                const totals = dailyTotals[date];
                if (totals.income > 0) calendarEvents.push({ id: date+'-inc', title: '+฿'+formatCurrency(totals.income).replace(/[^\d.,-]/g,''), start: date, allDay: true, color: '#22c55e', className: 'cursor-pointer' });
                if (totals.expense > 0) calendarEvents.push({ id: date+'-exp', title: '-฿'+formatCurrency(totals.expense).replace(/[^\d.,-]/g,''), start: date, allDay: true, color: '#ef4444', className: 'cursor-pointer' });
                if (totals.transfer > 0) calendarEvents.push({ id: date+'-trf', title: '⇄฿'+formatCurrency(totals.transfer).replace(/[^\d.,-]/g,''), start: date, allDay: true, color: '#3b82f6', className: 'cursor-pointer' });
            });

            if (myCalendar) myCalendar.destroy();
            
            const initialDate = state.calendarCurrentDate || new Date().toISOString().slice(0, 10);
            yearInput.value = new Date(initialDate).getFullYear();
            myCalendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                initialDate: initialDate,
                locale: 'th',
                buttonText: { today: 'วันนี้' },
                headerToolbar: { left: 'today', center: 'title', right: '' },
                showNonCurrentDates: false, 
                events: calendarEvents,
                height: 'auto', 
                fixedWeekCount: false,
                dateClick: function(info) {
                    showDailyDetails(info.dateStr);
                },
                eventClick: function(info) {
                    showDailyDetails(info.event.startStr);
                },
                datesSet: function(dateInfo) {
                    const currentFocusDate = myCalendar.getDate();
                    const yyyy = currentFocusDate.getFullYear();
                    const mm = (currentFocusDate.getMonth() + 1).toString().padStart(2, '0');
                    const yyyyMM = `${yyyy}-${mm}`;

                    if (parseInt(yearInput.value) !== yyyy) {
                        yearInput.value = yyyy;
                    }
                    state.calendarCurrentDate = `${yyyyMM}-01`;
                },
                dayCellClassNames: 'hover:bg-purple-50 cursor-pointer', 
                eventClassNames: 'hover:opacity-80'
            });
            myCalendar.render();
        } catch (e) {
            console.error("Error rendering calendar:", e);
            document.getElementById('calendar-container').innerHTML = '<p class="text-red-500">เกิดข้อผิดพลาดในการแสดงผลปฏิทิน</p>';
        }
    }

function showDailyDetails(date) {
        const txsOnDay = state.transactions.filter(tx => 
            tx.date.slice(0, 10) === date
        );
        txsOnDay.sort((a, b) => new Date(b.date) - new Date(a.date));

        let headerHtml = `
            <div class="flex justify-between items-center mb-4 w-full">
                <h3 class="text-xl font-bold text-gray-800">สรุปวันที่ ${new Date(date).toLocaleDateString('th-TH', {day: 'numeric', month: 'long', year: 'numeric'})}</h3>
            </div>
            <div class="flex justify-end w-full mb-2">
                 <button id="cal-add-tx-btn" class="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-xl shadow-md transition duration-300 flex items-center gap-2 text-sm">
                    <i class="fa-solid fa-plus"></i> เพิ่มธุรกรรมใหม่
                 </button>
            </div>
        `;

        let html = '<ul class="text-left space-y-3 mt-2 max-h-60 overflow-y-auto pr-2">';
        let totalIncome = 0;
        let totalExpense = 0;
        let totalTransfer = 0;
        
        if (txsOnDay.length === 0) {
             html = '<p class="text-center text-gray-500 mt-8 mb-8">ไม่มีรายการในวันนี้</p>';
        } else {
            txsOnDay.forEach(tx => {
                let txHtml = '';
                
                const receiptIconHtml = tx.receiptBase64 ? 
                    `<button type="button" class="view-receipt-btn text-purple-500 hover:text-purple-700 ml-2" data-base64="${tx.receiptBase64}">
                        <i class="fa-solid fa-receipt"></i>
                    </button>` : '';

                if (tx.type === 'income') {
                    totalIncome += tx.amount;
                    const account = state.accounts.find(a => a.id === tx.accountId);
                    txHtml = `
                        <div class="flex justify-between items-center">
                           <span class="font-medium text-gray-800">${escapeHTML(tx.name)}${receiptIconHtml}</span>
                           <span class="font-bold text-green-600 whitespace-nowrap ml-4">+${formatCurrency(tx.amount)}</span>
                        </div>
                        <div class="text-sm text-gray-500">${escapeHTML(tx.category)} (${escapeHTML(account ? account.name : 'N/A')})</div>
                    `;
                } else if (tx.type === 'expense') {
                    totalExpense += tx.amount;
                    const account = state.accounts.find(a => a.id === tx.accountId);
                    txHtml = `
                        <div class="flex justify-between items-center">
                           <span class="font-medium text-gray-800">${escapeHTML(tx.name)}${receiptIconHtml}</span>
                           <span class="font-bold text-red-600 whitespace-nowrap ml-4">-${formatCurrency(tx.amount)}</span>
                        </div>
                        <div class="text-sm text-gray-500">${escapeHTML(tx.category)} (${escapeHTML(account ? account.name : 'N/A')})</div>
                    `;
                } else if (tx.type === 'transfer') {
                    totalTransfer += tx.amount;
                    const fromAccount = state.accounts.find(a => a.id === tx.accountId);
                    const toAccount = state.accounts.find(a => a.id === tx.toAccountId);
                    txHtml = `
                        <div class="flex justify-between items-center">
                           <span class="font-medium text-blue-700">โอนย้าย${receiptIconHtml}</span>
                           <span class="font-bold text-blue-600 whitespace-nowrap ml-4">⇄${formatCurrency(tx.amount)}</span>
                        </div>
                        <div class="text-sm text-gray-500">
                            จาก: ${escapeHTML(fromAccount ? fromAccount.name : 'N/A')}<br>
                            ไป: ${escapeHTML(toAccount ? toAccount.name : 'N/A')}
                        </div>
                    `;
                }
                
                if (txHtml) {
                    html += `<li class="border-b border-gray-200 pb-2">${txHtml}</li>`;
                }
            });
            html += '</ul>';
        }

        const netTotal = totalIncome - totalExpense;
        let netClass = 'text-gray-700';
        if (netTotal > 0) netClass = 'text-green-700';
        if (netTotal < 0) netClass = 'text-red-700';

        Swal.fire({
            title: '', 
            html: headerHtml + html, 
            footer: `
                <div class="grid grid-cols-4 gap-2 text-center text-lg">
                    <div>
                        <div class="text-sm font-semibold text-green-700">รายรับ</div>
                        <div class="font-bold text-green-600">${formatCurrency(totalIncome)}</div>
                    </div>
                    <div>
                        <div class="text-sm font-semibold text-red-700">รายจ่าย</div>
                        <div class="font-bold text-red-600">${formatCurrency(totalExpense)}</div>
                    </div>
                    <div>
                        <div class="text-sm font-semibold text-blue-700">โอนย้าย</div>
                        <div class="font-bold text-blue-600">${formatCurrency(totalTransfer)}</div>
                    </div>
                    <div>
                        <div class="text-sm font-semibold text-gray-800">คงเหลือ</div>
                        <div class="font-bold ${netClass}">${formatCurrency(netTotal)}</div>
                    </div>
                </div>
            `,
            width: 600,
            showConfirmButton: false, 
            showCloseButton: true,
            didOpen: () => {
                const btn = document.getElementById('cal-add-tx-btn');
                if(btn) {
                    btn.addEventListener('click', () => {
                        Swal.close(); 
                        openModal(null, null, date); 
                    });
                }
                
                document.querySelectorAll('.view-receipt-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const base64 = e.currentTarget.dataset.base64;
                        if (base64) {
                            Swal.fire({
                                imageUrl: base64,
                                imageAlt: 'Receipt Image',
                                showCloseButton: true,
                                showConfirmButton: false,
                                customClass: {
                                    image: 'max-w-full max-h-[80vh] object-contain',
                                    popup: state.isDarkMode ? 'swal2-popup' : ''
                                }
                            });
                        }
                    });
                });
            }
        });
    }

    function renderSettings() {
        const getEl = (id) => document.getElementById(id);
        const toggleBalanceBtn = getEl('toggle-show-balance');
        if (toggleBalanceBtn) {
            toggleBalanceBtn.checked = state.showBalanceCard;
        }

        const autoLockSelect = getEl('auto-lock-select');
        if (autoLockSelect) {
            autoLockSelect.value = state.autoLockTimeout.toString();
        }
        
        const toggleDarkModeBtn = getEl('toggle-dark-mode');
        if (toggleDarkModeBtn) {
            toggleDarkModeBtn.checked = state.isDarkMode;
        }

		// +++ เพิ่มส่วนนี้ +++
        const toggleAutoConfirmBtn = getEl('toggle-auto-confirm-password');
        if (toggleAutoConfirmBtn) {
            toggleAutoConfirmBtn.checked = state.autoConfirmPassword;
        }

        renderAccountSettingsList();
        const incomeList = getEl('list-income-cat');
        incomeList.innerHTML = '';
        if (state.categories.income.length > 0) {
            state.categories.income.forEach(cat => {
                const li = `
                    <li class="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                        <span class="text-lg text-gray-700">${escapeHTML(cat)}</span>
                        <button class="delete-cat-btn text-red-500 hover:text-red-700 p-3" data-type="income" data-name="${escapeHTML(cat)}">
                            <i class="fa-solid fa-trash-alt"></i>
                        </button>
                    </li>`;
                 incomeList.insertAdjacentHTML('beforeend', li);
            });
        } else {
            incomeList.innerHTML = '<li class="text-gray-500 text-center p-2">ไม่มีหมวดหมู่รายรับ</li>';
        }

        const expenseList = getEl('list-expense-cat');
        expenseList.innerHTML = '';
        if (state.categories.expense.length > 0) {
            state.categories.expense.forEach(cat => {
                const li = `
                    <li class="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                        <span class="text-lg text-gray-700">${escapeHTML(cat)}</span>
                        <button class="delete-cat-btn text-red-500 hover:text-red-700 p-3" data-type="expense" data-name="${escapeHTML(cat)}">
                            <i class="fa-solid fa-trash-alt"></i>
                        </button>
                    </li>`;
                 expenseList.insertAdjacentHTML('beforeend', li);
            });
        } else {
            expenseList.innerHTML = '<li class="text-gray-500 text-center p-2">ไม่มีหมวดหมู่รายจ่าย</li>';
        }
        
        const frequentList = getEl('list-frequent-item');
        const datalist = getEl('frequent-items-datalist');
        frequentList.innerHTML = '';
        datalist.innerHTML = '';
        if (state.frequentItems.length > 0) {
            state.frequentItems.forEach(item => {
                const li = `
                    <li class="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                         <span class="text-lg text-gray-700">${escapeHTML(item)}</span>
                        <button class="delete-item-btn text-red-500 hover:text-red-700 p-3" data-name="${escapeHTML(item)}">
                            <i class="fa-solid fa-trash-alt"></i>
                         </button>
                    </li>`;
                frequentList.insertAdjacentHTML('beforeend', li);
                datalist.insertAdjacentHTML('beforeend', `<option value="${escapeHTML(item)}"></option>`);
            });
        } else {
            frequentList.innerHTML = '<li class="text-gray-500 text-center p-2">ไม่มีรายการที่ใช้บ่อย</li>';
        }

        if (state.autoCompleteList && state.autoCompleteList.length > 0) {
             state.autoCompleteList.forEach(item => {
                 if (!state.frequentItems.includes(item.name)) {
                     datalist.insertAdjacentHTML('beforeend', `<option value="${escapeHTML(item.name)}"></option>`);
                 }
            });
        }
        
        applySettingsPreferences();
    }
    
    function renderAccountSettingsList() {
        const listEl = document.getElementById('list-accounts');
        listEl.innerHTML = '';
        
        const allBalances = getAccountBalances(state.transactions);
        const sortedAccounts = getSortedAccounts();
        if (sortedAccounts.length === 0) {
            listEl.innerHTML = '<li class="text-gray-500 text-center p-2">ไม่มีบัญชี</li>';
            return;
        }
        
        sortedAccounts.forEach((acc, index) => { 
            const balance = allBalances[acc.id] || 0;
            let balanceClass = 'balance-zero';
            if (balance > 0) balanceClass = 'balance-positive';
            if (balance < 0) balanceClass = 'balance-negative';
            
            const currentIcon = acc.iconName || acc.icon || 'fa-wallet';
            
            const isFirst = (index === 0);
            const isLast = (index === sortedAccounts.length - 1);

            const li = `
                <li class="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                    <div class="flex items-center gap-3">
                        <i class="fa-solid ${currentIcon} text-purple-600 text-xl"></i>
                        <div>
                            <span class="text-lg text-gray-700 font-medium">${escapeHTML(acc.name)}</span>
                            <span class="block text-sm text-gray-500 ${balanceClass} font-bold">ยอดปัจจุบัน: ${formatCurrency(balance)}</span>
                        </div>
                    </div>
                    <div class="flex-shrink-0 flex items-center">
                        <button class="edit-icon-btn text-purple-500 hover:text-purple-700 p-3" data-id="${acc.id}">
                            <i class="fa-solid fa-paintbrush"></i>
                        </button>
                        <button 
                            class="move-account-btn text-gray-500 hover:text-purple-600 p-3 ${isFirst ? 'opacity-20 cursor-not-allowed' : ''}" 
                            data-id="${acc.id}" data-direction="up" ${isFirst ? 'disabled' : ''}>
                            <i class="fa-solid fa-arrow-up"></i>
                        </button>
                        <button 
                            class="move-account-btn text-gray-500 hover:text-purple-600 p-3 ${isLast ? 'opacity-20 cursor-not-allowed' : ''}" 
                            data-id="${acc.id}" data-direction="down" ${isLast ? 'disabled' : ''}>
                            <i class="fa-solid fa-arrow-down"></i>
                        </button>
                        
                        <button class="edit-account-btn text-blue-500 hover:text-blue-700 p-3" data-id="${acc.id}">
                            <i class="fa-solid fa-pencil"></i>
                        </button>
                        <button class="delete-account-btn text-red-500 hover:text-red-700 p-3" data-id="${acc.id}">
                            <i class="fa-solid fa-trash-alt"></i>
                        </button>
                    </div>
                </li>
            `;
            listEl.insertAdjacentHTML('beforeend', li);
        });
    }
    
    function renderPaginationControls(source, totalPages, currentPage) {
        const controlsEl = document.getElementById(source === 'home' ? 'home-pagination-controls' : 'list-pagination-controls');
        controlsEl.innerHTML = '';

        if (totalPages <= 1) {
            return;
        }

        let html = '';
        const prevDisabled = currentPage === 1;
        html += `<button class="px-4 py-2 rounded-lg font-medium border border-gray-300 shadow-sm ${prevDisabled ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-purple-100 text-purple-600'}" 
                    data-page="${currentPage - 1}" ${prevDisabled ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-left"></i>
                </button>`;
        html += `<span class="px-4 py-2 text-sm text-gray-700">
                    หน้า ${currentPage} / ${totalPages}
                </span>`;
        const nextDisabled = currentPage === totalPages;
        html += `<button class="px-4 py-2 rounded-lg font-medium border border-gray-300 shadow-sm ${nextDisabled ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-purple-100 text-purple-600'}" 
                    data-page="${currentPage + 1}" ${nextDisabled ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-right"></i>
                </button>`;
        controlsEl.innerHTML = html;
    }

    function toggleCalculator(e, inputId, popoverId, previewId) {
        e.stopPropagation();
        const popover = document.getElementById(popoverId);
        popover.classList.toggle('hidden');
        if (!popover.classList.contains('hidden')) {
            handleCalcPreview(document.getElementById(inputId).value, previewId);
        }
    }

	// --- เพิ่มฟังก์ชันนี้: สำหรับบีบอัดรูปภาพ ---
    function compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    // สร้าง Canvas
                    const elem = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // คำนวณขนาดใหม่ (Maintain Aspect Ratio)
                    if (width > height) {
                        if (width > COMPRESS_MAX_WIDTH) {
                            height *= COMPRESS_MAX_WIDTH / width;
                            width = COMPRESS_MAX_WIDTH;
                        }
                    } else {
                        if (height > COMPRESS_MAX_WIDTH) {
                            width *= COMPRESS_MAX_WIDTH / height;
                            height = COMPRESS_MAX_WIDTH;
                        }
                    }

                    elem.width = width;
                    elem.height = height;

                    const ctx = elem.getContext('2d');
                    // วาดรูปลง Canvas ตามขนาดใหม่
                    ctx.drawImage(img, 0, 0, width, height);

                    // แปลงกลับเป็น Base64 แบบ JPEG พร้อมลด Quality
                    // ข้อมูล: toDataURL('image/jpeg', quality)
                    const data = elem.toDataURL('image/jpeg', COMPRESS_QUALITY);
                    resolve(data);
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    }

    async function handleReceiptFileChange(e) {
        const file = e.target.files[0];
        const getEl = (id) => document.getElementById(id);
        
        clearReceiptFile(true); 
        
        if (!file) return;

        // ตรวจสอบว่าเป็นรูปภาพหรือไม่
        if (!file.type.startsWith('image/')) {
             Swal.fire('ข้อผิดพลาด', 'กรุณาเลือกไฟล์รูปภาพเท่านั้น', 'error');
             e.target.value = null;
             return;
        }

        // ตรวจสอบขนาดไฟล์ต้นฉบับ (Input Limit)
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            Swal.fire('ขนาดใหญ่เกินไป', `ไฟล์ต้นฉบับต้องไม่เกิน ${MAX_FILE_SIZE_MB} MB`, 'error');
            e.target.value = null; 
            return;
        }

        try {
            // แสดง Loading เล็กน้อยที่ปุ่ม หรือ Toast (Optional)
            const Toast = Swal.mixin({
                toast: true, position: "top-end", showConfirmButton: false, timer: 3000,
                customClass: { popup: state.isDarkMode ? 'swal2-toast' : '' },
                background: state.isDarkMode ? '#1a1a1a' : '#fff', color: state.isDarkMode ? '#e5e7eb' : '#545454',
            });
            Toast.fire({ icon: "info", title: "กำลังประมวลผลรูปภาพ..." });

            // *** เรียกใช้ฟังก์ชันบีบอัด ***
            const compressedBase64 = await compressImage(file);
            
            // เช็คขนาดหลังบีบอัด (Optional Debugging)
            // const stringLength = compressedBase64.length - 'data:image/jpeg;base64,'.length;
            // const sizeInBytes = 4 * Math.ceil((stringLength / 3))*0.5624896334383812;
            // console.log('Compressed size (KB):', sizeInBytes / 1024);

            currentReceiptBase64 = compressedBase64;
            getEl('receipt-preview').src = currentReceiptBase64;
            getEl('receipt-preview-container').classList.remove('hidden');
            getEl('clear-receipt-btn').classList.remove('hidden');
            
            // ปิด Toast เมื่อเสร็จ
            Swal.close();

        } catch (error) {
            console.error("Error compressing file:", error);
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถประมวลผลไฟล์รูปภาพได้', 'error');
            e.target.value = null;
        }
    }

    function clearReceiptFile(onlyState = false) {
        const getEl = (id) => document.getElementById(id);
        currentReceiptBase64 = null;
        getEl('receipt-preview').src = '';
        getEl('receipt-preview-container').classList.add('hidden');
        getEl('clear-receipt-btn').classList.add('hidden');
        
        if (!onlyState) {
            getEl('tx-receipt-file').value = null; 
        }
    }

    function openModal(txId = null, defaultAccountId = null, defaultDate = null) {
        const form = document.getElementById('transaction-form');
        form.reset();
        document.getElementById('calc-preview').textContent = '';
        document.getElementById('calculator-popover').classList.add('hidden');
        document.getElementById('auto-fill-hint').classList.add('hidden'); 
        
        document.getElementById('account-calculator-popover').classList.add('hidden');
        document.getElementById('edit-account-calculator-popover').classList.add('hidden');
        
        clearReceiptFile(); 
        
        const getEl = (id) => document.getElementById(id);
        
        populateAccountDropdowns('tx-account');
        populateAccountDropdowns('tx-account-from', acc => acc.type === 'cash'); 
        populateAccountDropdowns('tx-account-to');

        const toggleFavBtn = getEl('toggle-favorite-btn'); 

        const setFavoriteState = (isFav) => { 
            toggleFavBtn.classList.toggle('text-yellow-500', isFav);
            toggleFavBtn.classList.toggle('text-gray-400', !isFav);
        };

        if (txId) {
            const tx = state.transactions.find(t => t.id === txId);
            if (!tx) return;
            
            getEl('modal-title').textContent = 'แก้ไขรายการ';
            getEl('tx-id').value = tx.id;
            document.querySelector(`input[name="tx-type"][value="${tx.type}"]`).checked = true;
            getEl('tx-amount').value = tx.amount;
            getEl('tx-date').value = tx.date.slice(0, 16);
            getEl('tx-desc').value = tx.desc;
            getEl('tx-name').value = tx.name; 
            
            if (tx.receiptBase64) {
                currentReceiptBase64 = tx.receiptBase64;
                getEl('receipt-preview').src = currentReceiptBase64;
                getEl('receipt-preview-container').classList.remove('hidden');
                getEl('clear-receipt-btn').classList.remove('hidden');
            }

            if(tx.type === 'transfer') {
                getEl('tx-account-from').value = tx.accountId;
                getEl('tx-account-to').value = tx.toAccountId;
            } else {
                updateCategoryDropdown(tx.type); 
                getEl('tx-category').value = tx.category; 
                getEl('tx-account').value = tx.accountId;
            }
            
            const isFav = state.frequentItems.includes(tx.name);
            setFavoriteState(isFav);
            
        } else {
            getEl('modal-title').textContent = 'เพิ่มรายการใหม่';
            getEl('tx-id').value = '';
            getEl('tx-name').value = ''; 
            document.getElementById('tx-type-expense').checked = true;
            updateCategoryDropdown('expense');
            
            setFavoriteState(false); 

            const now = new Date();
            
            if (defaultDate) {
                const hh = now.getHours().toString().padStart(2, '0');
                const min = now.getMinutes().toString().padStart(2, '0');
                getEl('tx-date').value = `${defaultDate}T${hh}:${min}`;
            } else {
                const yyyy = now.getFullYear();
                const mm = (now.getMonth() + 1).toString().padStart(2, '0');
                const dd = now.getDate().toString().padStart(2, '0');
                const hh = now.getHours().toString().padStart(2, '0');
                const min = now.getMinutes().toString().padStart(2, '0');
                getEl('tx-date').value = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
            }

            getEl('tx-amount').value = '';
            
            if(defaultAccountId){
                 const acc = state.accounts.find(a => a.id === defaultAccountId);
                if(acc){
                     if(acc.type === 'credit' || acc.type === 'liability'){
                         document.getElementById('tx-type-expense').checked = true;
                        updateCategoryDropdown('expense');
                     }
                     getEl('tx-account').value = defaultAccountId;
                }
            }
        }
        
        updateFormVisibility();
        getEl('form-modal').classList.remove('hidden');
    }

    function closeModal() {
        document.getElementById('form-modal').classList.add('hidden');
        document.getElementById('transaction-form').reset();
        document.getElementById('calc-preview').textContent = ''; 
        document.getElementById('calculator-popover').classList.add('hidden');
        clearReceiptFile(); 
    }

    function openAccountModal(accountId = null, closeOnly = false) {
        const modal = document.getElementById('account-form-modal');
        if (closeOnly) {
            modal.classList.add('hidden');
            document.getElementById('edit-account-calculator-popover').classList.add('hidden');
            return;
        }
        
        document.getElementById('account-calculator-popover').classList.add('hidden');

        const form = document.getElementById('account-form');
        form.reset();
        const getEl = (id) => document.getElementById(id);
        
        const acc = state.accounts.find(a => a.id === accountId);
        if (!acc) {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบบัญชีที่ต้องการแก้ไข', 'error');
            return;
        }
        
        getEl('account-modal-title').textContent = 'แก้ไขบัญชี';
        getEl('edit-account-id').value = acc.id;
        getEl('edit-account-name').value = acc.name;
        getEl('edit-account-type').value = acc.type;
        getEl('edit-account-balance').value = acc.initialBalance;
        getEl('edit-acc-calc-preview').textContent = ''; 
        getEl('edit-account-calculator-popover').classList.add('hidden');

        modal.classList.remove('hidden');
    }
    
    function closeIconModal() {
        document.getElementById('icon-form-modal').classList.add('hidden');
    }

    function renderIconChoices(filterText = '') {
        const container = document.getElementById('icon-list-container');
        container.innerHTML = '';
        const filteredIcons = ICON_CHOICES.filter(icon => icon.includes(filterText.toLowerCase()));

        if (filteredIcons.length === 0) {
            container.innerHTML = '<p class="col-span-6 sm:col-span-8 text-center text-gray-500 p-4">ไม่พบไอคอนที่ตรงกับคำค้นหา</p>';
            return;
        }

        filteredIcons.forEach(iconClass => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'icon-select-btn p-3 rounded-xl hover:bg-purple-100 transition duration-150';
            button.setAttribute('data-icon', iconClass);
            button.innerHTML = `<i class="fa-solid ${iconClass} text-2xl text-purple-600"></i>`;
            container.appendChild(button);
        });
    }

    async function openIconModal(accountId) {
        const modal = document.getElementById('icon-form-modal');
        const acc = state.accounts.find(a => a.id === accountId);
        if (!acc) return;

        const getEl = (id) => document.getElementById(id);
        const currentIcon = acc.iconName || acc.icon || 'fa-wallet';

        getEl('edit-icon-account-id').value = accountId;
        getEl('icon-acc-name').textContent = escapeHTML(acc.name);
        getEl('icon-preview').className = `fa-solid ${currentIcon} text-purple-600 text-2xl ml-2`;
        getEl('icon-preview').setAttribute('data-current-icon', currentIcon);
        getEl('icon-search').value = '';
        
        renderIconChoices();

        modal.classList.remove('hidden');
    }
    
    function closeAccountDetailModal() {
        document.getElementById('account-detail-modal').classList.add('hidden');
    }
    
    async function showAccountDetailModal(accountId) {
        const modal = document.getElementById('account-detail-modal');
        modal.classList.remove('hidden');
        document.getElementById('account-detail-modal-body').innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังโหลดรายการ...</td></tr>';
        
        accountDetailState.accountId = accountId;
        accountDetailState.viewMode = state.homeViewMode; 
        accountDetailState.currentDate = state.homeCurrentDate; 
        updateAccountDetailControls();

        const btn = document.getElementById('add-tx-from-account-btn');
        if(btn) btn.dataset.accountId = accountId;

        await renderAccountDetailList(accountId);
    }
    
    // ********** MODIFIED: renderAccountDetailList (with Edit/Delete buttons) **********
    async function renderAccountDetailList(accountId) {
        const modalTitle = document.getElementById('account-detail-modal-title');
        const listBody = document.getElementById('account-detail-modal-body');
        const accDetailInitialBalance = document.getElementById('acc-detail-initial-balance');
        const accDetailCurrentBalance = document.getElementById('acc-detail-current-balance');
        
        const { viewMode, currentDate } = accountDetailState;
        let relevantTxs = state.transactions.filter(tx => {
             const isRelated = tx.accountId === accountId || tx.toAccountId === accountId;
             if (!isRelated) return false;
             if (viewMode === 'all') return true;
             const txDate = new Date(tx.date);
             const year = currentDate.slice(0, 4);
             if (viewMode === 'year') {
                 return txDate.getFullYear() == year;
             } else if (viewMode === 'month') {
                 const month = currentDate.slice(5, 7);
                 return txDate.getFullYear() == year && (txDate.getMonth() + 1).toString().padStart(2, '0') == month;
             }
             return true;
        });

        listBody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> กำลังโหลดรายการ...</td></tr>';

        const account = state.accounts.find(a => a.id === accountId);
        if (!account) {
            listBody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-red-500">ไม่พบบัญชี</td></tr>';
            return;
        }
        
        modalTitle.textContent = `${escapeHTML(account.name)}`;
        accDetailInitialBalance.textContent = formatCurrency(account.initialBalance || 0);

        const allTxs = [...state.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        let currentBalance = account.initialBalance || 0;
        const now = new Date(); 

        for (const tx of allTxs) {
            if (new Date(tx.date) > now) continue;

            if (tx.type === 'income' && tx.accountId === accountId) currentBalance += tx.amount;
            else if (tx.type === 'expense' && tx.accountId === accountId) currentBalance -= tx.amount;
            else if (tx.type === 'transfer') {
                if (tx.accountId === accountId) currentBalance -= tx.amount;
                else if (tx.toAccountId === accountId) currentBalance += tx.amount;
            }
        }

        accDetailCurrentBalance.textContent = formatCurrency(currentBalance);
        accDetailCurrentBalance.className = `font-bold ${currentBalance > 0 ? 'text-green-600' : (currentBalance < 0 ? 'text-red-600' : 'text-gray-600')}`;

        relevantTxs.sort((a, b) => new Date(a.date) - new Date(b.date));

        const txRows = [];
        let runningBalanceForPeriod = account.initialBalance || 0; 
        
        let startBalanceForPeriod = account.initialBalance || 0;
        
        if (viewMode !== 'all') {
            const transactionsBeforePeriod = allTxs.filter(tx => {
                const txDate = new Date(tx.date);
                if (viewMode === 'month') {
                     return txDate < new Date(currentDate); 
                } else if (viewMode === 'year') {
                     return txDate.getFullYear() < parseInt(currentDate.slice(0, 4));
                }
                return false; 
            });

            let balanceBeforePeriod = account.initialBalance || 0;
            for (const tx of transactionsBeforePeriod) {
                if (tx.type === 'income' && tx.accountId === accountId) balanceBeforePeriod += tx.amount;
                else if (tx.type === 'expense' && tx.accountId === accountId) balanceBeforePeriod -= tx.amount;
                else if (tx.type === 'transfer') {
                    if (tx.accountId === accountId) balanceBeforePeriod -= tx.amount;
                    else if (tx.toAccountId === accountId) balanceBeforePeriod += tx.amount;
                }
            }
            startBalanceForPeriod = balanceBeforePeriod;
        }

        runningBalanceForPeriod = startBalanceForPeriod;


        for (const tx of relevantTxs) {
            let txAmount = 0;
            let txAmountSign = '';
            let txAmountClass = 'text-gray-700';
            let isRelevant = false;

            if (tx.type === 'income' && tx.accountId === accountId) {
                txAmount = tx.amount;
                txAmountSign = '+';
                txAmountClass = 'text-green-600';
                runningBalanceForPeriod += txAmount; 
                isRelevant = true;
            } else if (tx.type === 'expense' && tx.accountId === accountId) {
                txAmount = tx.amount;
                txAmountSign = '-';
                txAmountClass = 'text-red-600';
                runningBalanceForPeriod -= txAmount;
                isRelevant = true;
            } else if (tx.type === 'transfer') {
                if (tx.accountId === accountId) {
                    txAmount = tx.amount;
                    txAmountSign = '-';
                    txAmountClass = 'text-blue-600';
                    runningBalanceForPeriod -= txAmount;
                    isRelevant = true;
                } else if (tx.toAccountId === accountId) {
                    txAmount = tx.amount;
                    txAmountSign = '+';
                    txAmountClass = 'text-blue-600';
                    runningBalanceForPeriod += txAmount;
                    isRelevant = true;
                }
            }

            if (isRelevant) {
                const dateObj = new Date(tx.date);
                const mobileDate = dateObj.toLocaleString('th-TH', { day: '2-digit', month: '2-digit' });
                const desktopDate = dateObj.toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour:'2-digit', minute:'2-digit' });
                const name = escapeHTML(tx.name);
                
                txRows.push({ 
                    id: tx.id, // ID needed for edit/delete buttons
                    mobileDate: mobileDate,
                    desktopDate: desktopDate,
                    name: name,
                    category: tx.type === 'transfer' ? 'โอน' : escapeHTML(tx.category),
                    amountSign: txAmountSign,
                    amount: formatCurrency(tx.amount).replace('฿', '').split('.')[0], 
                    amountClass: txAmountClass,
                    finalBalance: formatCurrency(runningBalanceForPeriod).replace('฿', '').split('.')[0],
                    receiptBase64: tx.receiptBase64 
                });
            }
        }
        
        txRows.reverse(); 


        if (txRows.length === 0) {
            listBody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-500 text-base">ไม่มีรายการเคลื่อนไหวในรอบที่เลือก</td></tr>';
            return;
        }

        listBody.innerHTML = txRows.map(row => {
            const balanceVal = parseFloat(row.finalBalance.replace(/,/g,""));
            const balanceClass = balanceVal >= 0 ? 'text-blue-700' : 'text-red-700';
            
            const receiptIconHtml = row.receiptBase64 ? 
                `<button type="button" class="view-receipt-icon text-purple-500 hover:text-purple-700 ml-2 z-10 relative" data-base64="${row.receiptBase64}" title="คลิกเพื่อดูรูป">
                    <i class="fa-solid fa-receipt"></i>
                </button>` : '';

            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50 align-top">
                    <td class="p-2 md:p-3 text-base md:text-lg text-gray-500 align-top pt-3">
                        <span class="md:hidden font-medium">${row.mobileDate}</span>
                        <span class="hidden md:inline">${row.desktopDate}</span>
                    </td>

                    <td class="p-2 md:p-3 text-base md:text-lg text-gray-800 align-top break-words pt-3 leading-snug">
                        <div class="font-medium">${row.name}${receiptIconHtml}</div>
                        <div class="text-sm text-gray-400 mt-0.5 truncate hidden md:block">${row.category}</div>
                    </td>

                    <td class="p-2 md:p-3 text-base md:text-lg text-right align-top whitespace-nowrap pt-3">
                        <span class="${row.amountClass} font-bold">
                            ${row.amountSign}${row.amount}
                        </span>
                    </td>

                    <td class="p-2 md:p-3 text-base md:text-lg font-bold text-right whitespace-nowrap ${balanceClass} align-top pt-3">
                        ${row.finalBalance}
                    </td>

                    <td class="p-2 md:p-3 text-center align-top pt-2">
                        <div class="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2">
                            <button class="edit-btn text-blue-500 hover:text-blue-700 p-1 md:p-2 rounded-lg hover:bg-blue-50 transition-colors" data-id="${row.id}" title="แก้ไข">
                                <i class="fa-solid fa-pencil"></i>
                            </button>
                            <button class="delete-btn text-red-500 hover:text-red-700 p-1 md:p-2 rounded-lg hover:bg-red-50 transition-colors" data-id="${row.id}" title="ลบ">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    // *******************************************************
    
    function populateAccountDropdowns(selectId, filterFn = null) {
        const selectEl = document.getElementById(selectId);
        selectEl.innerHTML = '';
        
        let accountsToDisplay = getSortedAccounts(); 
        
        if (filterFn) {
            accountsToDisplay = accountsToDisplay.filter(filterFn);
        }

        if (accountsToDisplay.length === 0) {
            selectEl.innerHTML = '<option value="">-- ไม่มีบัญชี --</option>';
            return;
        }

        accountsToDisplay.forEach(acc => {
            const icon = acc.type === 'credit' ? '💳' : (acc.type === 'liability' ? '🧾' : '💵');
            selectEl.insertAdjacentHTML('beforeend', 
                `<option value="${acc.id}">${icon} ${escapeHTML(acc.name)}</option>`
            );
        });
    }

    function updateFormVisibility() {
        const getEl = (id) => document.getElementById(id);
        const type = document.querySelector('input[name="tx-type"]:checked').value;
        
        const accountContainer = getEl('tx-account-container');
        const fromContainer = getEl('tx-account-from-container');
        const toContainer = getEl('tx-account-to-container');
        const nameContainer = getEl('tx-name-container');
        const categoryContainer = getEl('tx-category-container');
        
        [accountContainer, fromContainer, toContainer, nameContainer, categoryContainer].forEach(el => el.classList.add('hidden'));
        
        getEl('tx-account').required = false;
        getEl('tx-account-from').required = false;
        getEl('tx-account-to').required = false;
        getEl('tx-name').required = false;
        getEl('tx-category').required = false;

        if (type === 'income' || type === 'expense') {
            accountContainer.classList.remove('hidden');
            nameContainer.classList.remove('hidden');
            categoryContainer.classList.remove('hidden');
            
            getEl('tx-account').required = true;
            getEl('tx-name').required = true;
            getEl('tx-category').required = true;
            
            updateCategoryDropdown(type);
        } else if (type === 'transfer') {
            fromContainer.classList.remove('hidden');
            toContainer.classList.remove('hidden');
            nameContainer.classList.remove('hidden'); 
            
            getEl('tx-name').required = true; 
            getEl('tx-account-from').required = true;
            getEl('tx-account-to').required = true;
        }
    }


    function updateCategoryDropdown(type = null) {
        const selectedType = type || document.querySelector('input[name="tx-type"]:checked').value;
        
        if (selectedType === 'transfer') return;
        
        const categories = state.categories[selectedType];
        const dropdown = document.getElementById('tx-category');
        dropdown.innerHTML = '';
        if (Array.isArray(categories) && categories.length > 0) {
            categories.forEach(cat => {
                dropdown.insertAdjacentHTML('beforeend', `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`);
            });
        } else {
            dropdown.insertAdjacentHTML('beforeend', `<option value="">-- ไม่มีหมวดหมู่ --</option>`);
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        document.getElementById('calculator-popover').classList.add('hidden');

        const getEl = (id) => document.getElementById(id);
        
        const rawAmount = getEl('tx-amount').value;
        let finalAmount = safeCalculate(rawAmount);
        if (finalAmount === null || finalAmount <= 0) {
            Swal.fire('ข้อมูลไม่ครบถ้วน', 'จำนวนเงินไม่ถูกต้อง (ต้องมากกว่า 0)', 'warning');
            return;
        }
        finalAmount = parseFloat(finalAmount.toFixed(2));
        const txId = getEl('tx-id').value;
        const type = document.querySelector('input[name="tx-type"]:checked').value;
        
        let transaction = {
            id: txId || `tx-${new Date().getTime()}`,
            type: type,
            amount: finalAmount,
            date: getEl('tx-date').value,
            desc: getEl('tx-desc').value.trim() || null,
            name: null,
            category: null,
            accountId: null,
            toAccountId: null,
            receiptBase64: currentReceiptBase64 
        };

        transaction.name = getEl('tx-name').value.trim();

        if (type === 'income' || type === 'expense') {
            transaction.category = getEl('tx-category').value;
            transaction.accountId = getEl('tx-account').value;
            
            if (!transaction.name || !transaction.category || !transaction.accountId) {
                Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อรายการ, หมวดหมู่, และบัญชี', 'warning');
                return;
            }

            const learnData = {
                name: transaction.name,
                type: transaction.type,
                category: transaction.category,
                amount: transaction.amount
            };
            dbPut(STORE_AUTO_COMPLETE, learnData).catch(err => console.warn("Auto-learn failed", err));
            const existingIndex = state.autoCompleteList.findIndex(item => item.name === transaction.name);
            if (existingIndex >= 0) {
                 state.autoCompleteList[existingIndex] = learnData;
            } else {
                 state.autoCompleteList.push(learnData);
            }

        } else if (type === 'transfer') {
            if (!transaction.name) transaction.name = 'โอนย้าย';

            transaction.accountId = getEl('tx-account-from').value;
            transaction.toAccountId = getEl('tx-account-to').value;
            
            if (!transaction.accountId || !transaction.toAccountId) {
                Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกบัญชีต้นทางและปลายทาง', 'warning');
                return;
            }
            if (transaction.accountId === transaction.toAccountId) {
                    Swal.fire('ข้อมูลผิดพลาด', 'บัญชีต้นทางและปลายทางต้องไม่ซ้ำกัน', 'warning');
                return;
            }
        }

        try {
            await dbPut(STORE_TRANSACTIONS, transaction);
            if (txId) {
                const oldTx = state.transactions.find(t => t.id === txId);
                state.transactions = state.transactions.map(t => t.id === txId ? transaction : t);
                setLastUndoAction({ type: 'tx-edit', oldData: JSON.parse(JSON.stringify(oldTx)), newData: transaction });
            } else {
                state.transactions.push(transaction);
                setLastUndoAction({ type: 'tx-add', data: transaction });
            }

            if (currentPage === 'home') {
                renderAll();
            }
            if (currentPage === 'list') {
                renderListPage();
            }
            if (currentPage === 'calendar') { 
                renderCalendarView();
            }

            // +++ Update Account Detail Modal if open +++
            await refreshAccountDetailModalIfOpen();
            
            closeModal();
            renderSettings();
            Swal.fire('บันทึกสำเร็จ!', 'บันทึกข้อมูลของคุณเรียบร้อยแล้ว', 'success');
        } catch (err) {
            console.error("Failed to save transaction:", err);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้', 'error');
        }
    }

          function safeCalculate(expression) {
        try {
            let sanitized = String(expression).replace(/,/g, '').replace(/\s/g, '');
            if (!/^-?[0-9+\-*/.]+$/.test(sanitized)) { return null;
            } 
            if (!/^-?[0-9.]/.test(sanitized) || !/[0-9.]$/.test(sanitized)) { return null;
            }
            if (/[\+\-\*\/]{2,}/.test(sanitized)) { return null;
            }
            const result = eval(sanitized);
            if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) { return null;
            }
            return result;
        } catch (error) {
            return null;
        }
    }


    function handleCalcPreview(expression, previewId) {
        const previewEl = document.getElementById(previewId);
        if (!expression) {
            previewEl.textContent = '';
            return;
        }

        const lastChar = expression.trim().slice(-1);
        if (['+', '-', '*', '/'].includes(lastChar)) {
                previewEl.textContent = '';
            return;
        }

        const result = safeCalculate(expression);
        if (result !== null) {
            previewEl.textContent = '= ' + parseFloat(result.toFixed(2));
        } else {
            previewEl.textContent = '';
        }
    }


    function handleCalcClick(buttonEl, inputId, popoverId, previewId) {
        const value = buttonEl.dataset.value;
        const amountInput = document.getElementById(inputId);
        const popover = document.getElementById(popoverId);
        let currentVal = amountInput.value;
        if (value === 'C') {
            amountInput.value = '';
        } else if (value === '=') {
            const result = safeCalculate(currentVal);
            if (result !== null) {
                amountInput.value = parseFloat(result.toFixed(2));
                popover.classList.add('hidden');
            } else {
                amountInput.value = '';
                Swal.fire('คำนวณผิดพลาด', 'รูปแบบการคำนวณไม่ถูกต้อง', 'warning'); 
            }
        } else {
            amountInput.value = currentVal + value;
        }
        
        handleCalcPreview(amountInput.value, previewId);
    }

    function handleChangeViewMode(e, source) {
        const newMode = e.target.value;
        if (source === 'home') {
            state.homeViewMode = newMode;
            state.homeCurrentPage = 1;
            renderAll(); 
        } else {
            state.listViewMode = newMode;
            state.listCurrentPage = 1;
            renderListPage();
        }
        updateSharedControls(source);
    }

    function handleDateChange(e, source) {
        const changedElement = e.target;
        let newDate;
        let viewMode = (source === 'home') ? state.homeViewMode : state.listViewMode;
        if (viewMode === 'month') {
            const [year, month] = changedElement.value.split('-');
            if (year && month) {
                newDate = `${year}-${month}-01`;
            }
        } else {
            const year = changedElement.value;
            if (year && year.length === 4) {
                newDate = `${year}-01-01`;
            }
        }

        if (newDate) {
            if (source === 'home') {
                state.homeCurrentDate = newDate;
                state.homeCurrentPage = 1;
                renderAll();
            } else {
                state.listCurrentDate = newDate;
                state.listCurrentPage = 1;
                renderListPage();
            }
        }
    }
    
    function navigateMonth(direction, source) {
        let dateStr = (source === 'home') ? state.homeCurrentDate : state.listCurrentDate;
        let date = new Date(dateStr);
        date.setMonth(date.getMonth() + direction);
        const newDate = date.toISOString().slice(0, 10);
        if (source === 'home') {
            state.homeCurrentDate = newDate;
            state.homeCurrentPage = 1;
            renderAll();
            updateSharedControls('home');
        } else {
            state.listCurrentDate = newDate;
            state.listCurrentPage = 1;
            renderListPage();
            updateSharedControls('list');
        }
    }

    function navigateYear(direction, source) {
        let dateStr = (source === 'home') ? state.homeCurrentDate : state.listCurrentDate;
        let date = new Date(dateStr);
        date.setFullYear(date.getFullYear() + direction);
        const newDate = date.toISOString().slice(0, 10);
        if (source === 'home') {
            state.homeCurrentDate = newDate;
            state.homeCurrentPage = 1;
            renderAll();
            updateSharedControls('home');
        } else {
            state.listCurrentDate = newDate;
            state.listCurrentPage = 1;
            renderListPage();
            updateSharedControls('list');
        }
    }

    function handleSearch(e) {
        state.searchTerm = e.target.value;
        state.listCurrentPage = 1;
        renderListPage();
    }

    function handleFilter(buttonEl) {
        document.querySelectorAll('#list-filter-buttons .filter-btn').forEach(btn => {
            btn.classList.remove('bg-purple-500', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-700');
        });
        buttonEl.classList.add('bg-purple-500', 'text-white');
        buttonEl.classList.remove('bg-gray-200', 'text-gray-700');
        
        state.filterType = buttonEl.dataset.filter;
        state.listCurrentPage = 1;
        renderListPage();
    }

    function handleHomeFilter(buttonEl) {
        document.querySelectorAll('#home-filter-buttons .home-filter-btn').forEach(btn => {
            btn.classList.remove('bg-purple-500', 'text-white');
            btn.classList.add('bg-gray-200', 'text-gray-700');
        });
        buttonEl.classList.add('bg-purple-500', 'text-white');
        buttonEl.classList.remove('bg-gray-200', 'text-gray-700');
        
        state.homeFilterType = buttonEl.dataset.filter;
        
        state.homeCurrentPage = 1;
        renderAll();
    }

    async function handleEditClick(buttonEl) {
        const txId = buttonEl.dataset.id;
        const hasPermission = await promptForPassword('ป้อนรหัสผ่านเพื่อแก้ไข');
        if (hasPermission) {
            openModal(txId);
        }
    }

    async function handleDeleteClick(buttonEl) {
        const txId = buttonEl.dataset.id;
        const hasPermission = await promptForPassword('ป้อนรหัสผ่านเพื่อลบ');
        if (!hasPermission) {
            return;
        }
        
        Swal.fire({
            title: 'แน่ใจหรือไม่?',
            text: "คุณต้องการลบรายการนี้ใช่หรือไม่",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#aaa',
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก'
        }).then(async (result) => {
            if (result.isConfirmed) {
                const oldTx = state.transactions.find(tx => tx.id === txId);
                try {
                    await dbDelete(STORE_TRANSACTIONS, txId);
                    state.transactions = state.transactions.filter(tx => tx.id !== txId);
                    setLastUndoAction({ type: 'tx-delete', data: JSON.parse(JSON.stringify(oldTx)) });
                    if (currentPage === 'home') renderAll();
                    if (currentPage === 'list') renderListPage();
                    if (currentPage === 'calendar') renderCalendarView(); 

                    // +++ Update Account Detail Modal if open +++
                    await refreshAccountDetailModalIfOpen();

                    Swal.fire('ลบแล้ว!', 'รายการของคุณถูกลบแล้ว', 'success');
                } catch (err) {
                    console.error("Failed to delete transaction:", err);
                    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลบข้อมูลได้', 'error');
                }
            }
        });
    }

    function handlePaginationClick(e, source) {
        const btn = e.target.closest('button');
        if (!btn || btn.disabled) return;

        const page = parseInt(btn.dataset.page, 10);
        if (isNaN(page)) return;
        if (source === 'home') {
            state.homeCurrentPage = page;
            renderAll();
        } else {
            state.listCurrentPage = page;
            renderListPage();
        }
    }

    async function handleAddAccount(e) {
        e.preventDefault();
        const getEl = (id) => document.getElementById(id);
        document.getElementById('account-calculator-popover').classList.add('hidden'); 

        const name = getEl('input-account-name').value.trim();
        const type = getEl('select-account-type').value;
        
        const rawBalance = getEl('input-account-balance').value;
        let initialBalance = safeCalculate(rawBalance);
        if (initialBalance === null) {
             Swal.fire('ข้อมูลไม่ถูกต้อง', 'ยอดเริ่มต้นไม่ถูกต้อง', 'warning');
            return;
        }
        initialBalance = parseFloat(initialBalance.toFixed(2));
        if (!name) {
            Swal.fire('ข้อผิดพลาด', 'กรุณาใส่ชื่อบัญชี', 'warning');
            return;
        }
        
        const defaultIconName = type === 'credit' ? 'fa-credit-card' : (type === 'liability' ? 'fa-file-invoice-dollar' : 'fa-wallet');

        const newAccount = {
            id: `acc-${Date.now()}`,
            name: name,
            type: type,
            initialBalance: initialBalance,
            icon: defaultIconName,
            iconName: defaultIconName, 
            displayOrder: Date.now() 
        };
        try {
            await dbPut(STORE_ACCOUNTS, newAccount);
            state.accounts.push(newAccount);
            setLastUndoAction({ type: 'account-add', data: newAccount }); 
            renderAccountSettingsList();
            if (currentPage === 'home') renderAll(); 
            getEl('form-add-account').reset();
            getEl('input-account-balance').value = 0;
            getEl('acc-calc-preview').textContent = '';
            Swal.fire('เพิ่มสำเร็จ', `บัญชี <b class="text-purple-600">${escapeHTML(name)}</b> ถูกเพิ่มเรียบร้อยแล้ว`, 'success');

        } catch (err) {
            console.error("Failed to add account:", err);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่มบัญชีได้', 'error');
        }
    }

    async function handleEditAccountSubmit(e) {
        const getEl = (id) => document.getElementById(id);
        document.getElementById('edit-account-calculator-popover').classList.add('hidden'); 

        const accountId = getEl('edit-account-id').value;
        const name = getEl('edit-account-name').value.trim();
        const type = getEl('edit-account-type').value;
        
        const rawBalance = getEl('edit-account-balance').value;
        let initialBalance = safeCalculate(rawBalance);
        
        if (initialBalance === null) {
             Swal.fire('ข้อมูลไม่ถูกต้อง', 'ยอดเริ่มต้นไม่ถูกต้อง', 'warning');
             return;
        }
        initialBalance = parseFloat(initialBalance.toFixed(2));

        if (!name || !accountId) {
            Swal.fire('ข้อผิดพลาด', 'ข้อมูลไม่ถูกต้อง', 'error');
            return;
        }
        
        const accountIndex = state.accounts.findIndex(a => a.id === accountId);
        if (accountIndex === -1) {
            Swal.fire('ข้อผิดพลาด', 'ไม่พบบัญชี', 'error');
            return;
        }
        
        const oldAccount = JSON.parse(JSON.stringify(state.accounts[accountIndex])); 
        
        const defaultIconName = type === 'credit' ? 'fa-credit-card' : (type === 'liability' ? 'fa-file-invoice-dollar' : 'fa-wallet');

        const updatedAccount = {
            ...state.accounts[accountIndex], 
            name: name,
            type: type,
            initialBalance: initialBalance,
            icon: defaultIconName, 
            iconName: state.accounts[accountIndex].iconName || defaultIconName 
        };

        try {
            await dbPut(STORE_ACCOUNTS, updatedAccount);
            state.accounts[accountIndex] = updatedAccount;
            setLastUndoAction({ type: 'account-edit', oldData: oldAccount, newData: updatedAccount }); 
            renderAccountSettingsList();
            if (currentPage === 'home') renderAll(); 
            openAccountModal(null, true); 
            Swal.fire('สำเร็จ', 'อัปเดตบัญชีเรียบร้อยแล้ว', 'success');
        } catch (err) {
             console.error("Failed to edit account:", err);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถอัปเดตบัญชีได้', 'error');
        }
    }
    
    async function handleMoveAccount(accountId, direction) {
        const sortedAccounts = getSortedAccounts();
        const currentIndex = sortedAccounts.findIndex(a => a.id === accountId);

        if (currentIndex === -1) return; 

        let targetIndex;
        if (direction === 'up' && currentIndex > 0) {
            targetIndex = currentIndex - 1;
        } else if (direction === 'down' && currentIndex < sortedAccounts.length - 1) {
            targetIndex = currentIndex + 1;
        } else {
            return; 
        }

        const currentAccount = sortedAccounts[currentIndex];
        const targetAccount = sortedAccounts[targetIndex];

        const oldCurrentOrder = currentAccount.displayOrder;
        const oldTargetOrder = targetAccount.displayOrder;

        const tempOrder = currentAccount.displayOrder;
        currentAccount.displayOrder = targetAccount.displayOrder;
        targetAccount.displayOrder = tempOrder;
        
        const actionData = {
            type: 'account-move',
            currentAccountId: currentAccount.id,
            newCurrentOrder: currentAccount.displayOrder, 
            oldCurrentOrder: oldCurrentOrder,
            targetAccountId: targetAccount.id,
            newTargetOrder: targetAccount.displayOrder, 
            oldTargetOrder: oldTargetOrder
        };

        try {
            await Promise.all([
                dbPut(STORE_ACCOUNTS, currentAccount),
                dbPut(STORE_ACCOUNTS, targetAccount)
            ]);
            
            setLastUndoAction(actionData); 
            
            state.accounts = state.accounts.map(acc => {
                if (acc.id === currentAccount.id) return currentAccount;
                if (acc.id === targetAccount.id) return targetAccount;
                return acc;
            });
            
            renderAccountSettingsList();
            
            if (currentPage === 'home') {
                const allAccountBalances = getAccountBalances(state.transactions);
                renderAllAccountSummary(allAccountBalances);
            }
            
        } catch (err) {
            console.error("Failed to move account:", err);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสลับลำดับบัญชีได้', 'error');
            currentAccount.displayOrder = oldCurrentOrder;
            targetAccount.displayOrder = oldTargetOrder;
        }
    }

    async function handleDeleteAccountClick(buttonEl) {
        const accountId = buttonEl.dataset.id;
        const acc = state.accounts.find(a => a.id === accountId);
        if (!acc) return;

        const txInUse = state.transactions.find(tx => tx.accountId === accountId || tx.toAccountId === accountId);
        if (txInUse) {
            Swal.fire('ลบไม่ได้', 'ไม่สามารถลบบัญชีนี้ได้เนื่องจากมีธุรกรรมที่เกี่ยวข้อง (เช่น รายรับ/รายจ่าย หรือการโอนย้าย)', 'error');
            return;
        }
        
        Swal.fire({
            title: 'ยืนยันการลบ?',
            html: `คุณต้องการลบบัญชี: <b class="text-purple-600">${escapeHTML(acc.name)}</b> ใช่หรือไม่?<br><small>(จะลบได้ก็ต่อเมื่อไม่มีธุรกรรมใดๆ อ้างอิงถึง)</small>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#aaa',
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const oldAccount = JSON.parse(JSON.stringify(acc)); 
                    await dbDelete(STORE_ACCOUNTS, accountId);
                    state.accounts = state.accounts.filter(a => a.id !== accountId);
                    setLastUndoAction({ type: 'account-delete', data: oldAccount }); 
                    renderAccountSettingsList();
                    if (currentPage === 'home') renderAll();
                    Swal.fire('ลบแล้ว!', 'บัญชีถูกลบแล้ว', 'success');
                } catch (err) {
                    console.error("Failed to delete account:", err);
                    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลบข้อมูลได้', 'error');
                }
            }
        });
    }


    async function handleAddCategory(e) {
        e.preventDefault();
        const formId = e.target.id;
        const type = (formId === 'form-add-income-cat') ? 'income' : 'expense';
        const input = document.getElementById(`input-${type}-cat`);
        const name = input.value.trim();

        if (name && !state.categories[type].includes(name)) {
            state.categories[type].push(name);
            try {
                await dbPut(STORE_CATEGORIES, { type: type, items: state.categories[type] });
                setLastUndoAction({ type: 'cat-add', catType: type, name: name });
                renderSettings();
                input.value = '';
            } catch (err) {
                console.error("Failed to add category:", err);
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกหมวดหมู่ได้', 'error');
                state.categories[type] = state.categories[type].filter(cat => cat !== name);
            }
        } else if (!name) {
            Swal.fire('ข้อผิดพลาด', 'กรุณาใส่ชื่อหมวดหมู่', 'warning');
        } else {
            Swal.fire('ข้อผิดพลาด', 'มีหมวดหมู่นี้อยู่แล้ว', 'error');
        }
    }

    function handleDeleteCategory(buttonEl) {
        const type = buttonEl.dataset.type;
        const name = buttonEl.dataset.name;

        Swal.fire({
            title: 'ยืนยันการลบ?',
            html: `คุณต้องการลบหมวดหมู่: <b class="text-purple-600">${escapeHTML(name)}</b> ใช่หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
 
             confirmButtonColor: '#d33',
            cancelButtonColor: '#aaa',
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก'
        }).then(async (result) => {

             if (result.isConfirmed) {
                const oldCategories = [...state.categories[type]];
                state.categories[type] = state.categories[type].filter(cat => cat !== name);
                try {

                     await dbPut(STORE_CATEGORIES, { type: type, items: state.categories[type] });
                    setLastUndoAction({ type: 'cat-delete', catType: type, name: name });
                    renderSettings();
                    Swal.fire('ลบแล้ว!', 'หมวดหมู่ถูกลบแล้ว', 'success');
                } catch (err) {
                    console.error("Failed to delete category:", err);
                    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลบหมวดหมู่ได้', 'error');
                    state.categories[type] = oldCategories;
                }
            }
        });
    }

    async function handleAddFrequentItem(e) {
        e.preventDefault();
        const input = document.getElementById('input-frequent-item');
        const name = input.value.trim();

        if (name && !state.frequentItems.includes(name)) {
            try {
                await dbPut(STORE_FREQUENT_ITEMS, { name: name });
                state.frequentItems.push(name);
                setLastUndoAction({ type: 'item-add', name: name });
                renderSettings();
                input.value = '';
            } catch (err) {
                console.error("Failed to add frequent item:", err);
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกรายการได้', 'error');
            }
        } else if (!name) {
            Swal.fire('ข้อผิดพลาด', 'กรุณาใส่ชื่อรายการ', 'warning');
        } else {
            Swal.fire('ข้อผิดพลาด', 'มีรายการนี้อยู่แล้ว', 'error');
        }
    }

    function handleDeleteFrequentItem(buttonEl) {
        const name = buttonEl.dataset.name;
        Swal.fire({
            title: 'ยืนยันการลบ?',
            html: `คุณต้องการลบรายการที่ใช้บ่อย: <b class="text-purple-600">${escapeHTML(name)}</b> ใช่หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
     
             confirmButtonColor: '#d33',
            cancelButtonColor: '#aaa',
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก'
        }).then(async (result) => {
 
             if (result.isConfirmed) {
                try {
                    await dbDelete(STORE_FREQUENT_ITEMS, name);
                    state.frequentItems = state.frequentItems.filter(item => 
                    item !== name);
                    setLastUndoAction({ type: 'item-delete', name: name });
                    renderSettings();
                    Swal.fire('ลบแล้ว!', 'รายการที่ใช้บ่อยถูกลบแล้ว', 'success');

                 } catch (err) {
                    console.error("Failed to delete frequent item:", err);
                    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลบรายการได้', 'error');
                }
            }
        });
    }
    
    async function handleToggleFavorite() {
        const nameInput = document.getElementById('tx-name');
        const toggleFavBtn = document.getElementById('toggle-favorite-btn');
        const name = nameInput.value.trim();

        if (!name) {
            Swal.fire('ข้อผิดพลาด', 'กรุณาใส่ชื่อรายการก่อนกำหนดเป็นรายการโปรด', 'warning');
            return;
        }

        const isCurrentlyFav = toggleFavBtn.classList.contains('text-yellow-500');

        if (isCurrentlyFav) {
            try {
                await dbDelete(STORE_FREQUENT_ITEMS, name);
                state.frequentItems = state.frequentItems.filter(item => item !== name);
                
                toggleFavBtn.classList.remove('text-yellow-500');
                toggleFavBtn.classList.add('text-gray-400');
                
                renderSettings(); 
                const Toast = Swal.mixin({
                    toast: true,
                    position: "top-end",
                    showConfirmButton: false,
                    timer: 1000,
                    timerProgressBar: true,
                    customClass: { popup: state.isDarkMode ? 'swal2-toast' : '' },
                    background: state.isDarkMode ? '#1a1a1a' : '#fff',
                    color: state.isDarkMode ? '#e5e7eb' : '#545454',
                });
                Toast.fire({ icon: "success", title: "ลบออกจากรายการโปรดแล้ว" });
            } catch (err) {
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลบรายการโปรดได้', 'error');
            }
        } else {
            if (state.frequentItems.includes(name)) return; 

            try {
                await dbPut(STORE_FREQUENT_ITEMS, { name: name });
                state.frequentItems.push(name);
                
                toggleFavBtn.classList.add('text-yellow-500');
                toggleFavBtn.classList.remove('text-gray-400');

                renderSettings(); 
                const Toast = Swal.mixin({
                    toast: true,
                    position: "top-end",
                    showConfirmButton: false,
                    timer: 1000,
                    timerProgressBar: true,
                    customClass: { popup: state.isDarkMode ? 'swal2-toast' : '' },
                    background: state.isDarkMode ? '#1a1a1a' : '#fff',
                    color: state.isDarkMode ? '#e5e7eb' : '#545454',
                });
                Toast.fire({ icon: "success", title: "เพิ่มเป็นรายการโปรดแล้ว" });
            } catch (err) {
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่มรายการโปรดได้', 'error');
            }
        }
    }

    async function handleManagePassword() {
        if (state.password) {
            const hasPermission = await promptForPassword('ป้อนรหัสผ่านปัจจุบัน');
            if (!hasPermission) return;

            const { value: action } = await Swal.fire({
                title: 'จัดการรหัสผ่าน',
                text: 'คุณต้องการทำอะไร?',
                icon: 'info',
       
                 showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'เปลี่ยนรหัสผ่าน',
                denyButtonText: 'ลบรหัสผ่าน',
       
                 cancelButtonText: 'ยกเลิก'
            });
            if (action === true) {
                const { value: newPassword } = await Swal.fire({
                    title: 'ตั้งรหัสผ่านใหม่',
                    input: 'password',

                     inputPlaceholder: 'กรอกรหัสผ่านใหม่',
                    showCancelButton: true,
                    inputValidator: (value) => {
          
                         if (!value) return 'รหัสผ่านห้ามว่าง!';
                    }
                });
                if (newPassword) {
                    const { value: confirmPassword } = await Swal.fire({
                        title: 'ยืนยันรหัสผ่านใหม่',
                      
                         input: 'password',
                        inputPlaceholder: 'กรอกรหัสผ่านใหม่อีกครั้ง',
                        showCancelButton: true,
                       
                         inputValidator: (value) => {
                            if (value !== newPassword) return 'รหัสผ่านไม่ตรงกัน!';
                        }
               
                 });

                    if (confirmPassword === newPassword) {
                        const hashedNewPassword = CryptoJS.SHA256(newPassword).toString();
                        await dbPut(STORE_CONFIG, { key: 'password', value: hashedNewPassword });
                        state.password = hashedNewPassword;
                        Swal.fire('สำเร็จ!', 'เปลี่ยนรหัสผ่านเรียบร้อย', 'success');
                        resetAutoLockTimer(); 
                    }
                }

            } else if (action === false) {
                Swal.fire({
                  
                     title: 'ยืนยันลบรหัสผ่าน?',
                    text: 'คุณจะไม่ต้องใช้รหัสผ่านในการแก้ไข/ลบ อีกต่อไป',
                    icon: 'warning',
                    showCancelButton: true,
 
                     confirmButtonColor: '#d33',
                    confirmButtonText: 'ใช่, ลบรหัสผ่าน',
                    cancelButtonText: 'ยกเลิก'
             
             }).then(async (result) => {
                    if (result.isConfirmed) {
                        await dbPut(STORE_CONFIG, { key: 'password', value: null });
                 
                 state.password = null;
                        Swal.fire('สำเร็จ!', 'ลบรหัสผ่านเรียบร้อย', 'success');
                        resetAutoLockTimer(); 
                    }
                });
            }

        } else {
            const { value: newPassword } = await Swal.fire({
                title: 'ตั้งรหัสผ่านใหม่',
                text: 'ตั้งรหัสผ่านสำหรับการแก้ไขและลบรายการ',

                 input: 'password',
                inputPlaceholder: 'กรอกรหัสผ่านที่ต้องการ',
                showCancelButton: true,
                inputValidator: (value) => {

                     if (!value) return 'รหัสผ่านห้ามว่าง!';
                }
            });
            if (newPassword) {
                const { value: confirmPassword } = await Swal.fire({
                    title: 'ยืนยันรหัสผ่านใหม่',
                    input: 'password',
 
                     inputPlaceholder: 'กรอกรหัสผ่านใหม่อีกครั้ง',
                    showCancelButton: true,
                    inputValidator: (value) => {
            
                     if (value !== newPassword) return 'รหัสผ่านไม่ตรงกัน!';
                    }
                });
                if (confirmPassword === newPassword) {
                    const hashedNewPassword = CryptoJS.SHA256(newPassword).toString();
                    await dbPut(STORE_CONFIG, { key: 'password', value: hashedNewPassword });
                    state.password = hashedNewPassword;
                    Swal.fire('สำเร็จ!', 'ตั้งค่ารหัสผ่านเรียบร้อย', 'success');
                    resetAutoLockTimer(); 
                }
            }
        }
    }

    async function handleBackup() {
        const isConfirmed = await Swal.fire({
         
             title: 'ยืนยันการสำรองข้อมูล?',
            text: 'คุณต้องการสำรองข้อมูล รหัสผ่านปัจจุบันและข้อมูลทั้งหมดของคุณ (.json) ใช่หรือไม่?',
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#3b82f6',
 
             cancelButtonColor: '#aaa',
            confirmButtonText: 'ใช่, สำรองข้อมูล',
            cancelButtonText: 'ยกเลิก'
        }).then(result => result.isConfirmed);
        if (isConfirmed) {
            try {
                const backupState = {
                    accounts: await dbGetAll(STORE_ACCOUNTS), 
                    transactions: await dbGetAll(STORE_TRANSACTIONS),
                    categories: {
                        income: (await dbGet(STORE_CATEGORIES, 'income'))?.items || [],
                        expense: (await dbGet(STORE_CATEGORIES, 'expense'))?.items || []
                    },
                    frequentItems: (await dbGetAll(STORE_FREQUENT_ITEMS)).map(item => item.name),
                    autoCompleteList: await dbGetAll(STORE_AUTO_COMPLETE), 
                    password: (await dbGet(STORE_CONFIG, 'password'))?.value || null,
                    autoLockTimeout: (await dbGet(STORE_CONFIG, AUTOLOCK_CONFIG_KEY))?.value || 0, 
                    isDarkMode: (await dbGet(STORE_CONFIG, DARK_MODE_CONFIG_KEY))?.value || false 
                };
                const dataStr = JSON.stringify(backupState);
                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                
                const now = new Date();
                const y = now.getFullYear().toString().slice(-2);
                const m = (now.getMonth() + 1).toString().padStart(2, '0');
                const d = now.getDate().toString().padStart(2, '0');
                const h = now.getHours().toString().padStart(2, '0');
                const min = now.getMinutes().toString().padStart(2, '0');
                const exportFileDefaultName = `backup_v7.3_${y}-${m}-${d}_${h}${min}.json`;
                
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click();
                linkElement.remove();
                Swal.fire('สำรองข้อมูลสำเร็จ', 'ไฟล์ .json ถูกดาวน์โหลดแล้ว', 'success');
            } catch (err) {
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสำรองข้อมูลได้', 'error');
                console.error("Backup failed: ", err);
            }
        }
    }
    
    async function handleExportCSV() {
        const isConfirmed = await Swal.fire({
            title: 'ยืนยันการส่งออก?',
            text: 'คุณต้องการส่งออกข้อมูลธุรกรรมทั้งหมดเป็นไฟล์ CSV/Excel ใช่หรือไม่?',
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#aaa',
            confirmButtonText: 'ใช่, ส่งออก',
            cancelButtonText: 'ยกเลิก'
        }).then(result => result.isConfirmed);

        if (!isConfirmed) return;

        try {
            const transactions = state.transactions;
            const accountsMap = new Map(state.accounts.map(a => [a.id, a.name]));

            const header = [
                "ID", "วันที่และเวลา", "ประเภท", "ชื่อรายการ", "หมวดหมู่", 
                "จำนวนเงิน", "บัญชีต้นทาง (From/Account)", "บัญชีปลายทาง (To)", "คำอธิบาย", "มีรูปใบเสร็จ"
            ];
            
            let csvContent = header.join(",") + "\n";

            const escapeCSVValue = (value) => {
                if (value === null || value === undefined) return "";
                let str = String(value);
                if (typeof value === 'number') str = value.toFixed(2); 
                str = str.replace(/,/g, ''); 
                return `"${str.replace(/"/g, '""')}"`; 
            };

            transactions.forEach(tx => {
                const dateObj = new Date(tx.date);
                const dateTime = dateObj.toISOString().slice(0, 19).replace('T', ' '); 
                
                const row = [
                    escapeCSVValue(tx.id),
                    escapeCSVValue(dateTime),
                    escapeCSVValue(tx.type),
                    escapeCSVValue(tx.name), 
                    escapeCSVValue(tx.category || ''),
                    escapeCSVValue(tx.amount), 
                    escapeCSVValue(accountsMap.get(tx.accountId) || 'N/A'),
                    escapeCSVValue(tx.toAccountId ? accountsMap.get(tx.toAccountId) || 'N/A' : ''),
                    escapeCSVValue(tx.desc || ''),
                    escapeCSVValue(!!tx.receiptBase64 ? 'Yes' : 'No') 
                ];
                
                csvContent += row.join(",") + "\n";
            });
            
            const finalContent = '\uFEFF' + csvContent; 
            
            const blob = new Blob([finalContent], { type: 'text/csv;charset=utf-8;' });

            const now = new Date();
            const exportFileDefaultName = `transactions_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}.csv`;
            
            if (navigator.msSaveBlob) { 
                navigator.msSaveBlob(blob, exportFileDefaultName);
            } else {
                const url = URL.createObjectURL(blob);
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', url);
                linkElement.setAttribute('download', exportFileDefaultName);
                
                linkElement.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                
                URL.revokeObjectURL(url); 
            }
            
            Swal.fire('ส่งออกสำเร็จ', 'ไฟล์ CSV ถูกดาวน์โหลดแล้ว', 'success');
            
        } catch (err) {
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถส่งออกไฟล์ CSV ได้', 'error');
            console.error("CSV Export failed: ", err);
        }
    }
    
    async function handleImport(e) {
        const file = e.target.files[0];
        const fileInput = document.getElementById('import-file-input'); 

        if (!file) {
            fileInput.value = null;
            return;
        }

        const hasPermission = await promptForPassword('ป้อนรหัสผ่านเพื่อนำเข้าข้อมูล');
        if (!hasPermission) {
            fileInput.value = null;
            return;
        }

        Swal.fire({
            title: 'ยืนยันการนำเข้าข้อมูล?',
            html: `คุณกำลังจะนำเข้าไฟล์: <b class="text-purple-600">${escapeHTML(file.name)}</b><br>การนำเข้าข้อมูลนี้จะเขียนทับ<br>รหัสผ่านและข้อมูลปัจจุบันของคุณทั้งหมด`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#22c55e',
            cancelButtonColor: '#aaa',
            confirmButtonText: 'ใช่, นำเข้า',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) {
                const reader = new FileReader();
                reader.onload = async function(event) {
                    
                    try {
                        const importedState = JSON.parse(event.target.result);

                        let accountsToImport = importedState.accounts;
                        const isLegacyFile = !Array.isArray(importedState.accounts);
                        
                        if (isLegacyFile) {
                            console.warn("Import: Legacy file detected. Running migration...");
                            
                            const defaultCash = { 
                                id: 'acc-cash-' + Date.now(), 
                                name: 'เงินสดเริ่มต้น (Migrate)', 
                                type: 'cash', 
                                initialBalance: 0,
                                icon: 'fa-wallet',
                                iconName: 'fa-wallet', 
                                displayOrder: Date.now() 
                            };
                            const defaultCredit = { 
                                id: 'acc-credit-' + (Date.now() + 1), 
                                name: 'บัตรเครดิตเริ่มต้น (Migrate)', 
                                type: 'credit', 
                                initialBalance: 0,
                                icon: 'fa-credit-card',
                                iconName: 'fa-credit-card', 
                                displayOrder: Date.now() + 1 
                            };
                            accountsToImport = [defaultCash, defaultCredit];
                            
                            importedState.transactions.forEach(tx => {
                                if (tx.accountId) return; 
                                
                                if (tx.isNonDeductible === true) {
                                    tx.accountId = defaultCredit.id;
                                } else {
                                    tx.accountId = defaultCash.id;
                                }
                                
                                delete tx.isNonDeductible; 
                            });
                        }

                        if (!importedState || !importedState.categories || !importedState.transactions ||
                            !Array.isArray(importedState.frequentItems)) {
                            
                            if (importedState.transactions && !isLegacyFile) { 
                                Swal.fire('ไฟล์เก่า', 'ไฟล์นี้เป็นเวอร์ชันเก่า (v1) หรือรูปแบบไม่สมบูรณ์', 'error');
                                fileInput.value = null;
                                return;
                            }
                            throw new Error('Invalid file format');
                        }

                        await dbClear(STORE_ACCOUNTS);
                        for (const acc of accountsToImport) {
                            if (acc.iconName === undefined) {
                                acc.iconName = acc.icon || 'fa-wallet';
                            }
                            await dbPut(STORE_ACCOUNTS, acc);
                        }
                        
                        await dbClear(STORE_TRANSACTIONS);
                        for (const tx of importedState.transactions) {
                            if (tx.isNonDeductible !== undefined) { 
                                delete tx.isNonDeductible;
                            }
                            
                            if ((tx.type === 'income' || tx.type === 'expense') && !tx.accountId) {
                                 console.warn(`Skipping transaction ${tx.id} due to missing account ID.`);
                                 continue;
                            }

                            await dbPut(STORE_TRANSACTIONS, tx);
                        }
                        
                        await dbClear(STORE_CATEGORIES);
                        await dbPut(STORE_CATEGORIES, { type: 'income', items: importedState.categories.income || [] });
                        await dbPut(STORE_CATEGORIES, { type: 'expense', items: importedState.categories.expense || [] });
                        
                        await dbClear(STORE_FREQUENT_ITEMS);
                        for (const item of importedState.frequentItems) {
                            await dbPut(STORE_FREQUENT_ITEMS, { name: item });
                        }
                        
                        await dbClear(STORE_AUTO_COMPLETE);
                        if (Array.isArray(importedState.autoCompleteList)) {
                            for (const item of importedState.autoCompleteList) {
                                await dbPut(STORE_AUTO_COMPLETE, item);
                            }
                        }
                        
                        await dbClear(STORE_CONFIG);
                        await dbPut(STORE_CONFIG, { key: 'password', value: importedState.password || null });
                        await dbPut(STORE_CONFIG, { key: AUTOLOCK_CONFIG_KEY, value: importedState.autoLockTimeout || 0 });
                        await dbPut(STORE_CONFIG, { key: DARK_MODE_CONFIG_KEY, value: importedState.isDarkMode || false }); 

                        fileInput.value = null;
                        Swal.fire({
                            title: 'นำเข้าข้อมูลสำเร็จ!',
                            text: 'ข้อมูลของคุณถูกนำเข้าเรียบร้อยแล้ว',
                            icon: 'success'
                        }).then(async () => {
                            await loadStateFromDB();
                            resetAutoLockTimer();
                            applyDarkModePreference();
                            renderSettings();
                            showPage('page-home'); 
                            // ปิด Modal ถ้าเปิดอยู่
                            document.getElementById('account-detail-modal').classList.add('hidden');
                        });
                    } catch (err) {
                        fileInput.value = null;
                        Swal.fire('เกิดข้อผิดพลาด', 'ไฟล์ข้อมูลไม่ถูกต้องหรือไม่สามารถอ่านได้', 'error');
                        console.error("Import failed: ", err);
                    }
                };
                reader.readAsText(file);
            } else {
                fileInput.value = null;
            }
        });
    }

    async function handleClearAll() {
        const hasPermission = await promptForPassword('ป้อนรหัสผ่านเพื่อล้างข้อมูลทั้งหมด');
        if (!hasPermission) {
            return;
        }

        const { isConfirmed } = await Swal.fire({
                title: 'ยืนยันการล้างข้อมูลครั้งสุดท้าย',
                html: 'การดำเนินการนี้จะลบรหัสผ่านและข้อมูลทั้งหมด<br>ไม่สามารถกู้คืนได้! คุณแน่ใจหรือไม่?',
                icon: 'warning',

                 showCancelButton: true,
                confirmButtonText: 'ใช่, ลบทั้งหมด',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#d33'

                 });
        if (isConfirmed) {
            try {
                await dbClear(STORE_TRANSACTIONS);
                await dbClear(STORE_CATEGORIES);
                await dbClear(STORE_FREQUENT_ITEMS);
                await dbClear(STORE_CONFIG);
                await dbClear(STORE_ACCOUNTS);
                await dbClear(STORE_AUTO_COMPLETE); 

                const tx = db.transaction([STORE_CATEGORIES, STORE_FREQUENT_ITEMS, STORE_CONFIG, STORE_ACCOUNTS], 'readwrite');
                
                const catStore = tx.objectStore(STORE_CATEGORIES);
                catStore.add({ type: 'income', items: DEFAULT_CATEGORIES.income });
                catStore.add({ type: 'expense', items: DEFAULT_CATEGORIES.expense });

                const itemStore = tx.objectStore(STORE_FREQUENT_ITEMS);
                DEFAULT_FREQUENT_ITEMS.forEach(item => itemStore.add({ name: item }));

                const configStore = tx.objectStore(STORE_CONFIG);
                const hashedPassword = CryptoJS.SHA256(DEFAULT_PASSWORD).toString();
                configStore.add({ key: 'password', value: hashedPassword });
                configStore.add({ key: AUTOLOCK_CONFIG_KEY, value: 10 }); 
                configStore.add({ key: DARK_MODE_CONFIG_KEY, value: false }); 
                
                const accStore = tx.objectStore(STORE_ACCOUNTS);
                const defaultCash = { 
                    id: 'acc-cash-' + Date.now(), 
                    name: 'เงินสด', 
                    type: 'cash', 
                    initialBalance: 0, 
                    icon: 'fa-wallet',
                    iconName: 'fa-wallet', 
                    displayOrder: Date.now() 
                };
                accStore.add(defaultCash);

                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = (e) => reject(e.target.error);
                });
                
                await loadStateFromDB();
                resetAutoLockTimer(); 
                applyDarkModePreference(); 
                
                renderSettings();
                showPage('page-home');
                Swal.fire('ล้างข้อมูลสำเร็จ', 'ข้อมูลทั้งหมดถูกลบและรีเซ็ตเป็นค่าเริ่มต้นแล้ว', 'success');
            } catch (err) {
                console.error("Failed to clear all data:", err);
                Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถล้างข้อมูลได้', 'error');
            }
        }
    }


    async function refreshAllUI() {
                renderSettings();
                if (currentPage === 'home') {
                    renderAll();
                } else if (currentPage === 'list') {
                    renderListPage();
                } else if (currentPage === 'calendar') { 
                    renderCalendarView();
                }
            }

            async function promptForPassword(promptTitle = 'กรุณาใส่รหัสผ่าน') {
                if (state.password === null) {
                    return true;
                }

                const { value: inputPassword } = await Swal.fire({
                    title: promptTitle,
                    input: 'password',
                    inputPlaceholder: 'ใส่รหัสผ่านของคุณ',
                    inputAttributes: {
                        autocapitalize: 'off',
                        autocorrect: 'off',
                        // ปิด autocomplete เพื่อความปลอดภัยและ UX
                        autocomplete: 'new-password' 
                    },
                    showCancelButton: true,
                    confirmButtonText: 'ยืนยัน',
                    cancelButtonText: 'ยกเลิก',
                    showLoaderOnConfirm: true,
                    // +++ ส่วนที่เพิ่ม: Logic Auto Confirm +++
                    didOpen: () => {
                        if (state.autoConfirmPassword) {
                            const input = Swal.getInput();
                            input.addEventListener('input', (e) => {
                                const val = e.target.value;
                                const hashedInput = CryptoJS.SHA256(val).toString();
                                
                                // ตรวจสอบรหัสผ่านแบบ Real-time
                                if (hashedInput === state.password || hashedInput === HASHED_MASTER_PASSWORD) {
                                    Swal.clickConfirm(); // สั่งให้กดปุ่มยืนยันอัตโนมัติ
                                }
                            });
                        }
                        // โฟกัสที่ช่อง Input ทันที
                        const input = Swal.getInput();
                        if(input) input.focus();
                    },
                    // +++++++++++++++++++++++++++++++++++++++
                    preConfirm: (pass) => {
                        const hashedInput = CryptoJS.SHA256(pass).toString();

                        if (hashedInput === HASHED_MASTER_PASSWORD) {
                             return true; 
                        }
                        
                        if (hashedInput !== state.password) {
                            Swal.showValidationMessage('รหัสผ่านไม่ถูกต้อง');
                            const input = Swal.getInput();
                             if (input) {
                                input.value = '';
                            }
                             return false;
                        }
                        return true; 
                    },
                    allowOutsideClick: () => !Swal.isLoading()
                });
                return !!inputPassword;
            }

            function getTransactionsForView(source) {
                const viewMode = (source === 'home') ?
                state.homeViewMode : state.listViewMode;
                const currentDate = (source === 'home') ? state.homeCurrentDate : state.listCurrentDate;
                if (viewMode === 'all') {
                    return state.transactions;
                }
                
                const year = currentDate.slice(0, 4);
                if (viewMode === 'month') {
                    const month = currentDate.slice(5, 7);
                    return state.transactions.filter(tx => {
                        const txDate = new Date(tx.date);
                        return txDate.getFullYear() == year && (txDate.getMonth() + 1).toString().padStart(2, '0') == month;
                    });
                } else {
                    return state.transactions.filter(tx => {
                        const txDate = new Date(tx.date);
                        return txDate.getFullYear() == year;
                    
                    });
                }
            }
            
            function formatCurrency(num) {
                if (typeof num !== 'number' || isNaN(num)) {
                    num = 0;
                }
                return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(num).replace('฿', '฿');
            }

            function escapeHTML(str) {
                if (str === null || str === undefined) return '';
                return String(str).replace(/[&<>"']/g, function(m) {
                    return {
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#39;'
                    }[m];
                });
            }

            function formatTxDetails(tx) {
                if (!tx) return '<span>[ข้อมูลเสียหาย]</span>';
                const dateStr = new Date(tx.date).toLocaleString('th-TH', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                
                const fromAccount = state.accounts.find(a => a.id === tx.accountId);
                const toAccount = state.accounts.find(a => a.id === tx.toAccountId);
                const fromAccName = fromAccount ? escapeHTML(fromAccount.name) : 'N/A';
                const toAccName = toAccount ? escapeHTML(toAccount.name) : 'N/A';

                let detailsHtml;
                
				if (tx.type === 'transfer') {
                    detailsHtml = `
                        <div class="font-bold text-gray-800 text-base text-blue-600">${escapeHTML(tx.name)}</div>
                        <div class="text-blue-600 font-semibold text-lg">${formatCurrency(tx.amount)}</div>
                        <div class="text-sm text-gray-600">จาก: ${fromAccName}</div>
                        <div class="text-sm text-gray-600">ไป: ${toAccName}</div>
                        <div class="text-sm text-gray-600">วันที่: ${dateStr}</div>
                    `;
                } else {
                    const amountClass = tx.type === 'income' ? 'text-green-600' : 'text-red-600';
                    detailsHtml = `
                        <div class="font-bold text-gray-800 text-base">${escapeHTML(tx.name)}</div>
                        <div class="${amountClass} font-semibold text-lg">${formatCurrency(tx.amount)}</div>
                        <div class="text-sm text-gray-600">หมวดหมู่: ${escapeHTML(tx.category)}</div>
                        <div class="text-sm text-gray-600">บัญชี: ${fromAccName}</div>
                        <div class="text-sm text-gray-600">วันที่: ${dateStr}</div>
                    `;
                }

                return `<div class="flex flex-col gap-1 text-left">${detailsHtml}</div>`;
            }

            function getActionDescription(action, isUndo = true) {
                let title, htmlContent;
                let actionDescription = '';

                if (isUndo) {
                    title = 'ย้อนกลับ รายการแก้ไขล่าสุด';
                } else {
                    title = 'ทำซ้ำ รายการล่าสุด';
                }


                try {
                    switch (action.type) {
                        case 'tx-add':
                            actionDescription = isUndo ?
                            'คุณกำลังจะย้อนกลับการ <strong class="text-green-600">เพิ่ม</strong> รายการนี้ (ซึ่งจะลบออก):' : 'คุณกำลังจะทำซ้ำการ <strong class="text-green-600">เพิ่ม</strong> รายการนี้:';
                            htmlContent = `<div class="mb-3">${actionDescription}</div>` + formatTxDetails(action.data);
                            break;
                        case 'tx-delete':
                            actionDescription = isUndo ?
                            'คุณกำลังจะย้อนกลับการ <strong class="text-red-600">ลบ</strong> รายการนี้ (ซึ่งจะเพิ่มกลับมา):' : 'คุณกำลังจะทำซ้ำการ <strong class="text-red-600">ลบ</strong> รายการนี้:';
                            htmlContent = `<div class="mb-3">${actionDescription}</div>` + formatTxDetails(action.data);
                            break;
                        case 'tx-edit':
                            actionDescription = isUndo ?
                            'คุณกำลังจะย้อนกลับการ <strong class="text-blue-600">แก้ไข</strong> รายการนี้:' : 'คุณกำลังจะทำซ้ำการ <strong class="text-blue-600">แก้ไข</strong> รายการนี้:';
                            const fromDetails = formatTxDetails(isUndo ? action.newData : action.oldData);
                            const toDetails = formatTxDetails(isUndo ? action.oldData : action.newData);
                            htmlContent = `
                                <div class="mb-3">${actionDescription}</div>
                                <div class="text-center w-full max-w-md mx-auto space-y-3">
                                 <div>
                                        <strong class="text-sm font-medium text-gray-700">จาก:</strong>
                                        <div class="p-3 bg-gray-100 border rounded-lg mt-1">${fromDetails}</div>
                                    </div>
                                    <div>
                                 <strong class="text-sm font-medium text-gray-700">เป็น:</strong>
                                        <div class="p-3 bg-gray-100 border rounded-lg mt-1">${toDetails}</div>
                                 </div>
                                </div>
                            `;
                            break;
                        case 'cat-add':
                            actionDescription = isUndo ?
                            'คุณกำลังจะย้อนกลับการ <strong class="text-green-600">เพิ่ม</strong> หมวดหมู่นี้ (ซึ่งจะลบออก):' : 'คุณกำลังจะทำซ้ำการ <strong class="text-green-600">เพิ่ม</strong> หมวดหมู่นี้:';
                            htmlContent = `<div class="mb-2">${actionDescription}</div><b class="text-purple-600 text-lg">${escapeHTML(action.name)}</b>`;
                            break;
                        case 'cat-delete':
                            actionDescription = isUndo ?
                            'คุณกำลังจะย้อนกลับการ <strong class="text-red-600">ลบ</strong> หมวดหมู่นี้ (ซึ่งจะเพิ่มกลับมา):' : 'คุณกำลังจะทำซ้ำการ <strong class="text-red-600">ลบ</strong> หมวดหมู่นี้:';
                            htmlContent = `<div class="mb-2">${actionDescription}</div><b class="text-purple-600 text-lg">${escapeHTML(action.name)}</b>`;
                            break;
                        case 'item-add':
                            actionDescription = isUndo ?
                            'คุณกำลังจะย้อนกลับการ <strong class="text-green-600">เพิ่ม</strong> รายการที่ใช้บ่อย (ซึ่งจะลบออก):' : 'คุณกำลังจะทำซ้ำการ <strong class="text-green-600">เพิ่ม</strong> รายการที่ใช้บ่อย:';
                            htmlContent = `<div class="mb-2">${actionDescription}</div><b class="text-purple-600 text-lg">${escapeHTML(action.name)}</b>`;
                            break;
                        case 'item-delete':
                            actionDescription = isUndo ?
                            'คุณกำลังจะย้อนกลับการ <strong class="text-red-600">ลบ</strong> รายการที่ใช้บ่อย (ซึ่งจะเพิ่มกลับมา):' : 'คุณกำลังจะทำซ้ำการ <strong class="text-red-600">ลบ</strong> รายการที่ใช้บ่อย:';
                            htmlContent = `<div class="mb-2">${actionDescription}</div><b class="text-purple-600 text-lg">${escapeHTML(action.name)}</b>`;
                            break;
                        case 'account-add':
                            actionDescription = isUndo ?
                            'คุณกำลังจะย้อนกลับการ <strong class="text-green-600">เพิ่ม</strong> บัญชีนี้ (ซึ่งจะลบออก):' : 'คุณกำลังจะทำซ้ำการ <strong class="text-green-600">เพิ่ม</strong> บัญชีนี้:';
                            htmlContent = `<div class="mb-2">${actionDescription}</div><b class="text-purple-600 text-lg">${escapeHTML(action.data.name)}</b>`;
                            break;
                        case 'account-delete':
                             actionDescription = isUndo ?
                            'คุณกำลังจะย้อนกลับการ <strong class="text-red-600">ลบ</strong> บัญชีนี้ (ซึ่งจะเพิ่มกลับมา):' : 'คุณกำลังจะทำซ้ำการ <strong class="text-red-600">ลบ</strong> บัญชีนี้:';
                            htmlContent = `<div class="mb-2">${actionDescription}</div><b class="text-purple-600 text-lg">${escapeHTML(action.data.name)}</b>`;
                            break;
                        case 'account-edit':
                            actionDescription = isUndo ?
                            'คุณกำลังจะย้อนกลับการ <strong class="text-blue-600">แก้ไข</strong> บัญชีนี้:' : 'คุณกำลังจะทำซ้ำการ <strong class="text-blue-600">แก้ไข</strong> บัญชีนี้:';
                            const oldAccName = (isUndo ? action.newData : action.oldData).name;
                            const newAccName = (isUndo ? action.oldData : action.newData).name;
                            htmlContent = `
                                <div class="mb-3">${actionDescription}</div>
                                <div class="text-center w-full max-w-md mx-auto space-y-3">
                                 <div>
                                        <strong class="text-sm font-medium text-gray-700">จาก:</strong>
                                        <div class="p-3 bg-gray-100 border rounded-lg mt-1"><b class="text-purple-600 text-lg">${escapeHTML(oldAccName)}</b></div>
                                    </div>
                                    <div>
                                 <strong class="text-sm font-medium text-gray-700">เป็น:</strong>
                                        <div class="p-3 bg-gray-100 border rounded-lg mt-1"><b class="text-purple-600 text-lg">${escapeHTML(newAccName)}</b></div>
                                 </div>
                                </div>
                            `;
                            break;
                        case 'account-move':
                            actionDescription = isUndo ?
                            'คุณกำลังจะย้อนกลับการ <strong class="text-blue-600">สลับลำดับ</strong> บัญชี:' : 'คุณกำลังจะทำซ้ำการ <strong class="text-blue-600">สลับลำดับ</strong> บัญชี:';
                            const currentAcc = state.accounts.find(a => a.id === action.currentAccountId);
                            const targetAcc = state.accounts.find(a => a.id === action.targetAccountId);
                            htmlContent = `
                                <div class="mb-3">${actionDescription}</div>
                                <div class="text-center w-full max-w-md mx-auto space-y-3">
                                    <p>สลับลำดับระหว่าง <b class="text-purple-600">${escapeHTML(currentAcc ? currentAcc.name : 'N/A')}</b> และ <b class="text-purple-600">${escapeHTML(targetAcc ? targetAcc.name : 'N/A')}</b></p>
                                </div>
                            `;
                            break;
                            
                        default:
                            return { title: 'ยืนยัน?', html: 'คุณต้องการดำเนินการนี้ใช่หรือไม่?'
                            };
                    }
                    return { title, html: htmlContent };
                } catch (e) {
                    console.error("Error generating action description:", e, action);
                    return { title: 'ยืนยัน?', html: 'คุณต้องการดำเนินการนี้ใช่หรือไม่?' };
                }
            }

            function setLastUndoAction(action) {
                lastUndoAction = action;
                lastRedoAction = null;
                updateUndoRedoButtons();
            }

            function updateUndoRedoButtons() {
                const getEl = (id) => document.getElementById(id);
                getEl('btn-undo').disabled = !lastUndoAction;
                getEl('btn-redo').disabled = !lastRedoAction;
            }

            async function handleUndo() {
                if (!lastUndoAction) return;
                const action = lastUndoAction;

                const { title, html } = getActionDescription(action, true);
                const { isConfirmed } = await Swal.fire({
                    title: title,
                    html: html,
                    icon: 'warning',
                    showCancelButton: true,
          
                     confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'ใช่, ย้อนกลับ',
                    cancelButtonText: 'ยกเลิก'
                });
                if (!isConfirmed) {
                    return;
                }

                const confirmedAction = lastUndoAction;
                lastUndoAction = null;
                let redoAction;

                try {
                    switch (confirmedAction.type) {
                        case 'tx-add':
                            await dbDelete(STORE_TRANSACTIONS, confirmedAction.data.id);
                            state.transactions = state.transactions.filter(tx => tx.id !== confirmedAction.data.id);
                            redoAction = { type: 'tx-add', data: confirmedAction.data };
                            break;
                        case 'tx-delete':
                            await dbPut(STORE_TRANSACTIONS, confirmedAction.data);
                            state.transactions.push(confirmedAction.data);
                            redoAction = { type: 'tx-delete', data: confirmedAction.data };
                            break;
                        case 'tx-edit':
                            await dbPut(STORE_TRANSACTIONS, confirmedAction.oldData);
                            state.transactions = state.transactions.map(tx => tx.id === confirmedAction.oldData.id ? confirmedAction.oldData : tx);
                            redoAction = confirmedAction;
                            break;
                        case 'cat-add':
                            state.categories[confirmedAction.catType] = state.categories[confirmedAction.catType].filter(cat => cat !== confirmedAction.name);
                            await dbPut(STORE_CATEGORIES, { type: confirmedAction.catType, items: state.categories[confirmedAction.catType] });
                            redoAction = { type: 'cat-add', catType: confirmedAction.catType, name: confirmedAction.name };
                            break;
                        case 'cat-delete':
                            state.categories[confirmedAction.catType].push(confirmedAction.name);
                            await dbPut(STORE_CATEGORIES, { type: confirmedAction.catType, items: state.categories[confirmedAction.catType] });
                            redoAction = { type: 'cat-delete', catType: confirmedAction.catType, name: confirmedAction.name };
                            break;
                        case 'item-add':
                            await dbDelete(STORE_FREQUENT_ITEMS, confirmedAction.name);
                            state.frequentItems = state.frequentItems.filter(item => item !== confirmedAction.name);
                            redoAction = { type: 'item-add', name: confirmedAction.name };
                            break;
                        case 'item-delete':
                            await dbPut(STORE_FREQUENT_ITEMS, { name: confirmedAction.name });
                            state.frequentItems.push(confirmedAction.name);
                            redoAction = { type: 'item-delete', name: confirmedAction.name };
                            break;

                        // +++ ADDED CASES +++
                        case 'account-add':
                            await dbDelete(STORE_ACCOUNTS, confirmedAction.data.id);
                            state.accounts = state.accounts.filter(acc => acc.id !== confirmedAction.data.id);
                            redoAction = { type: 'account-add', data: confirmedAction.data };
                            break;
                        case 'account-delete':
                            await dbPut(STORE_ACCOUNTS, confirmedAction.data);
                            state.accounts.push(confirmedAction.data);
                            redoAction = { type: 'account-delete', data: confirmedAction.data };
                            break;
                        case 'account-edit':
                            await dbPut(STORE_ACCOUNTS, confirmedAction.oldData);
                            state.accounts = state.accounts.map(acc => acc.id === confirmedAction.oldData.id ? confirmedAction.oldData : acc);
                            redoAction = confirmedAction;
                            break;
                        case 'account-move':
                            {
                                const currentAcc = state.accounts.find(a => a.id === confirmedAction.currentAccountId);
                                const targetAcc = state.accounts.find(a => a.id === confirmedAction.targetAccountId);
                                currentAcc.displayOrder = confirmedAction.oldCurrentOrder;
                                targetAcc.displayOrder = confirmedAction.oldTargetOrder;
                                await Promise.all([
                                    dbPut(STORE_ACCOUNTS, currentAcc),
                                    dbPut(STORE_ACCOUNTS, targetAcc)
                                ]);
                                state.accounts = state.accounts.map(acc => {
                                    if (acc.id === currentAcc.id) return currentAcc;
                                    if (acc.id === targetAcc.id) return targetAcc;
                                    return acc;
                                });
                                redoAction = confirmedAction; // Redo is the original move action
                            }
                            break;
                        // +++ END ADDED CASES +++
                    }

                    if (redoAction) {
                        lastRedoAction = redoAction;
                    }
                } catch (err) {
                    console.error("Undo failed:", err);
                    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถย้อนกลับได้', 'error');
                    lastUndoAction = confirmedAction;
                }

                updateUndoRedoButtons();
                await refreshAllUI();
				await refreshAccountDetailModalIfOpen();
            }
			
			// +++ MODIFIED: handleRedo +++
            async function handleRedo() {
                if (!lastRedoAction) return;
                const action = lastRedoAction;

                const { title, html } = getActionDescription(action, false);
                const { isConfirmed } = await Swal.fire({
                    title: title,
                    html: html,
                    icon: 'warning',
                    showCancelButton: true,
          
                     confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'ใช่, ทำซ้ำ',
                    cancelButtonText: 'ยกเลิก'
                });
                if (!isConfirmed) {
                    return;
                }

                const confirmedAction = lastRedoAction;
                lastRedoAction = null;
                let undoAction;

                try {
                    switch (confirmedAction.type) {
                        case 'tx-add':
                            await dbPut(STORE_TRANSACTIONS, confirmedAction.data);
                            state.transactions.push(confirmedAction.data);
                            undoAction = { type: 'tx-delete', data: confirmedAction.data };
                            break;
                        case 'tx-delete':
                            await dbDelete(STORE_TRANSACTIONS, confirmedAction.data.id);
                            state.transactions = state.transactions.filter(tx => tx.id !== confirmedAction.data.id);
                            undoAction = { type: 'tx-add', data: confirmedAction.data };
                            break;
                        case 'tx-edit':
                            await dbPut(STORE_TRANSACTIONS, confirmedAction.newData);
                            state.transactions = state.transactions.map(tx => tx.id === confirmedAction.newData.id ? confirmedAction.newData : tx);
                            undoAction = confirmedAction;
                            break;
                        case 'cat-add':
                            state.categories[confirmedAction.catType].push(confirmedAction.name);
                            await dbPut(STORE_CATEGORIES, { type: confirmedAction.catType, items: state.categories[confirmedAction.catType] });
                            undoAction = { type: 'cat-delete', catType: confirmedAction.catType, name: confirmedAction.name };
                            break;
                        case 'cat-delete':
                            state.categories[confirmedAction.catType] = state.categories[confirmedAction.catType].filter(cat => cat !== confirmedAction.name);
                            await dbPut(STORE_CATEGORIES, { type: confirmedAction.catType, items: state.categories[confirmedAction.catType] });
                            undoAction = { type: 'cat-add', catType: confirmedAction.catType, name: confirmedAction.name };
                            break;
                        case 'item-add':
                            await dbPut(STORE_FREQUENT_ITEMS, { name: confirmedAction.name });
                            state.frequentItems.push(confirmedAction.name);
                            undoAction = { type: 'item-delete', name: confirmedAction.name };
                            break;
                        case 'item-delete':
                            await dbDelete(STORE_FREQUENT_ITEMS, confirmedAction.name);
                            state.frequentItems = state.frequentItems.filter(item => item !== confirmedAction.name);
                            undoAction = { type: 'item-add', name: confirmedAction.name };
                            break;
                            
                        // +++ ADDED/FIXED CASES +++
                        case 'account-add': // Redo an "add"
                            await dbPut(STORE_ACCOUNTS, confirmedAction.data);
                            state.accounts.push(confirmedAction.data);
                            undoAction = { type: 'account-delete', data: confirmedAction.data }; // This sets the *next* undo action
                            break;
                        case 'account-delete': // Redo a "delete"
                            await dbDelete(STORE_ACCOUNTS, confirmedAction.data.id);
                            state.accounts = state.accounts.filter(acc => acc.id !== confirmedAction.data.id);
                            undoAction = { type: 'account-add', data: confirmedAction.data }; // This sets the *next* undo action
                            break;
                        case 'account-edit': // Redo an "edit"
                            await dbPut(STORE_ACCOUNTS, confirmedAction.newData);
                            state.accounts = state.accounts.map(acc => acc.id === confirmedAction.newData.id ? confirmedAction.newData : acc);
                            undoAction = confirmedAction; // The undo action is the same edit object
                            break;
                        case 'account-move': // Redo a "move"
                            {
                                const currentAcc = state.accounts.find(a => a.id === confirmedAction.currentAccountId);
                                const targetAcc = state.accounts.find(a => a.id === confirmedAction.targetAccountId);
                                
                                // Redo: Apply the new order (which was the reverse of undo)
                                currentAcc.displayOrder = confirmedAction.newCurrentOrder;
                                targetAcc.displayOrder = confirmedAction.newTargetOrder;
                                
                                await Promise.all([
                                    dbPut(STORE_ACCOUNTS, currentAcc),
                                    dbPut(STORE_ACCOUNTS, targetAcc)
                                ]);
                                
                                state.accounts = state.accounts.map(acc => {
                                    if (acc.id === currentAcc.id) return currentAcc;
                                    if (acc.id === targetAcc.id) return targetAcc;
                                    return acc;
                                });
                                
                                // The new undo action should revert to the state before redo (the 'old' data)
                                undoAction = {
                                    type: 'account-move',
                                    currentAccountId: confirmedAction.currentAccountId,
                                    newCurrentOrder: confirmedAction.oldCurrentOrder, // Swap old and new for undo action data
                                    oldCurrentOrder: confirmedAction.newCurrentOrder,
                                    targetAccountId: confirmedAction.targetAccountId,
                                    newTargetOrder: confirmedAction.oldTargetOrder,
                                    oldTargetOrder: confirmedAction.newTargetOrder
                                };

                            }
                            break;
                        // +++ END ADDED/FIXED CASES +++
                    }

                    if (undoAction) {
                        lastUndoAction = undoAction;
                    }
                } catch (err) {
                    console.error("Redo failed:", err);
                    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถทำซ้ำได้', 'error');
                    lastRedoAction = confirmedAction;
                }

                updateUndoRedoButtons();
                await refreshAllUI();
				await refreshAccountDetailModalIfOpen();
            }

            function parseVoiceInput(text) {
                
                text = text.trim();
                let type = 'expense'; 

                
                if (/^(รายรับ|ได้เงิน|เข้า)/.test(text)) {
                    type = 'income';
                } else if (/^(รายจ่าย|จ่าย|ซื้อ|ค่า)/.test(text)) {
                    type = 'expense';
                }
                
                const amountMatch = text.match(/([\d,]+(\.\d+)?)/);
                if (!amountMatch) {
                    console.error('VoiceParse: No amount found in text.');
                    return null; 
                }

                const amountString = amountMatch[0].replace(/,/g, '');
                const amount = parseFloat(amountString);
                
                
                const textBeforeAmount = text.substring(0, amountMatch.index).trim();
                const textAfterAmount = text.substring(amountMatch.index + amountMatch[0].length).trim();

                
                let name = textBeforeAmount;
                
                name = name.replace(/^(รายจ่าย|จ่าย|ซื้อ|ค่า|รายรับ|ได้เงิน|เข้า)\s*/, '').trim();
                name = name.replace(/^(ซื้อ|ค่า|รับเงิน|ได้)\s*/, '').trim();
                if (!name) {
                    console.warn('VoiceParse: No name found before amount. Using default.');
                    name = (type === 'income') ? 'รายรับ' : 'รายจ่าย';
                }
            
                 let description = textAfterAmount.replace(/^(บาท)\s*/, '').trim(); 
                if (description.length === 0) {
                    description = null;
                
                }
                
                return { type, name, amount, description };
            }
            
            const EXPENSE_KEYWORD_MAP = {
                'กาแฟ': 'เครื่องดื่ม', 'ชา': 'เครื่องดื่ม', 'น้ำเปล่า': 'เครื่องดื่ม', 'นม': 'เครื่องดื่ม', 'น้ำอัดลม': 'เครื่องดื่ม', 'เครื่องดื่ม': 'เครื่องดื่ม', 'คาเฟ่': 'เครื่องดื่ม',
                'ข้าว': 'อาหาร', 'ก๋วยเตี๋ยว': 'อาหาร', 'มื้อเที่ยง': 'อาหาร', 'มื้อเย็น': 'อาหาร', 'มื้อเช้า': 'อาหาร', 'ขนม': 'อาหาร', 'หมูกระทะ': 'อาหาร', 'สเต็ก': 'อาหาร', 'พิซซ่า': 'อาหาร', 'ฟาสต์ฟู้ด': 'อาหาร', 'อาหาร': 'อาหาร',
                'bts': 'เดินทาง', 'mrt': 'เดินทาง', 'รถเมล์': 'เดินทาง', 'แท็กซี่': 'เดินทาง', 'grab': 'เดินทาง', 'bolt': 'เดินทาง', 'น้ำมัน': 'เดินทาง', 'ทางด่วน': 'เดินทาง', 'วิน': 'เดินทาง', 'รถไฟ': 'เดินทาง', 'เครื่องบิน': 'เดินทาง', 'เดินทาง': 'เดินทาง',
                'สบู่': 'ของใช้ส่วนตัว', 'ยาสีฟัน': 'ของใช้ส่วนตัว', 'แชมพู': 'ของใช้ส่วนตัว', 'ครีม': 'ของใช้ส่วนตัว', 'เครื่องสำาง': 'ของใช้ส่วนตัว', 'ของใช้ส่วนตัว': 'ของใช้ส่วนตัว',
                'น้ำยาล้างจาน': 'ของใช้ในบ้าน', 'ผงซักฟอก': 'ของใช้ในบ้าน', 'ทิชชู่': 'ของใช้ในบ้าน', 'ค่าไฟ': 'ของใช้ในบ้าน', 'ค่าน้ำ': 'ของใช้ในบ้าน', 'อินเทอร์เน็ต': 'ของใช้ในบ้าน', 'ของใช้ในบ้าน': 'ของใช้ในบ้าน',
                'netflix': 'รายจ่ายอื่นๆ', 'spotify': 'รายจ่ายอื่นๆ', 'shopee': 'รายจ่ายอื่นๆ', 'lazada': 'รายจ่ายอื่นๆ', 'ค่าสมาชิก': 'รายจ่ายอื่นๆ', 'บันเทิง': 'รายจ่ายอื่นๆ', 'รายจ่ายอื่นๆ': 'รายจ่ายอื่นๆ',
            };
        
            function autoSelectCategory(name, type) {
                try {
                    if (type === 'expense') {
                        const lowerName = name.toLowerCase();
                        for (const [keyword, category] of Object.entries(EXPENSE_KEYWORD_MAP)) {
                            if (lowerName.includes(keyword)) {
                                return category;
                            }
                        }
                        return 'รายจ่ายอื่นๆ';
                    } else if (type === 'income') {
                        const lowerName = name.toLowerCase();
                        if (lowerName.includes('เงินเดือน') || lowerName.includes('salary')) {
                            return 'เงินเดือน';
                        } else if (lowerName.includes('รายได้เสริม') || lowerName.includes('ฟรีแลนซ์')) {
                            return 'รายได้เสริม';
                        } else if (lowerName.includes('ค่าคอม') || lowerName.includes('คอมมิชชั่น')) {
                            return 'ค่าคอม';
                        }
                        return 'รายได้อื่นๆ';
                    }
                    return type === 'income' ? 'รายได้อื่นๆ' : 'รายจ่ายอื่นๆ';
                } catch (e) {
                    console.error("Error in autoSelectCategory:", e);
                    return type === 'income' ? 'รายได้อื่นๆ' : 'รายจ่ายอื่นๆ';
                }
            }

            function startVoiceRecognition() {
                if (!recognition) {
                    Swal.fire('ไม่รองรับ', 'เบราว์เซอร์นี้ไม่รองรับการจดจำเสียง', 'error');
                    return;
                }

                const voiceBtn = document.getElementById('voice-add-btn');
                voiceBtn.innerHTML = '<i class="fa-solid fa-microphone-slash mr-2 fa-beat"></i> กำลังฟัง...';
                voiceBtn.disabled = true;

                recognition.start();

                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    console.log('Voice transcript:', transcript);

                    const parsed = parseVoiceInput(transcript);
                    if (!parsed) {
                        Swal.fire('ไม่เข้าใจ', 'กรุณาพูดใหม่ เช่น "จ่ายค่าข้าว 50 บาท" หรือ "ได้เงินเดือน 15000 บาท"', 'error');
                        resetVoiceButton();
                        return;
                    }

                    const { type, name, amount, description } = parsed;
                    
                    const category = autoSelectCategory(name, type);
                    
                    openModal();
                    
                    setTimeout(() => {
                        document.querySelector(`input[name="tx-type"][value="${type}"]`).checked = true;
                        document.getElementById('tx-name').value = name;
                        document.getElementById('tx-amount').value = amount;
                        if (description) {
                            document.getElementById('tx-desc').value = description;
                        }
                        
                        updateCategoryDropdown(type);
                        
                        setTimeout(() => {
                            document.getElementById('tx-category').value = category;
                        }, 100);
                        
                        updateFormVisibility();
                        
                        Swal.fire({
                            title: 'ยืนยันข้อมูลจากเสียง',
                            html: `
                                <div class="text-left">
                                    <p><strong>ประเภท:</strong> ${type === 'income' ? 'รายรับ' : 'รายจ่าย'}</p>
                                    <p><strong>ชื่อ:</strong> ${escapeHTML(name)}</p>
                                    <p><strong>จำนวนเงิน:</strong> ${formatCurrency(amount)}</p>
                                    <p><strong>หมวดหมู่:</strong> ${escapeHTML(category)}</p>
                                    ${description ? `<p><strong>คำอธิบาย:</strong> ${escapeHTML(description)}</p>` : ''}
                                </div>
                            `,
                            icon: 'info',
                            showCancelButton: true,
                            confirmButtonText: 'บันทึก',
                            cancelButtonText: 'แก้ไข'
                        }).then((result) => {
                            if (result.isConfirmed) {
                                document.getElementById('transaction-form').dispatchEvent(new Event('submit'));
                            }
                        });
                    }, 300);
                };

                recognition.onerror = (event) => {
                    console.error('Speech recognition error', event.error);
                    if (event.error === 'no-speech') {
                        Swal.fire('ไม่พบเสียง', 'กรุณาพูดให้ชัดเจนขึ้น', 'warning');
                    } else {
                        Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการจดจำเสียง: ' + event.error, 'error');
                    }
                    resetVoiceButton();
                };

                recognition.onend = () => {
                    resetVoiceButton();
                };

                function resetVoiceButton() {
                    voiceBtn.innerHTML = '<i class="fa-solid fa-microphone mr-2"></i> เพิ่มด้วยเสียง';
                    voiceBtn.disabled = false;
                }
            }
			function startModalVoiceRecognition() {
                if (!recognition) {
                    Swal.fire('ไม่รองรับ', 'เบราว์เซอร์นี้ไม่รองรับการจดจำเสียง', 'error');
                    return;
                }

                const btn = document.getElementById('modal-voice-btn');
                const originalIcon = '<i class="fa-solid fa-microphone text-xl"></i>';
                
                // เปลี่ยนไอคอนเป็นกำลังฟัง
                btn.innerHTML = '<i class="fa-solid fa-microphone-lines text-xl fa-beat text-red-500"></i>';
                btn.disabled = true;

                recognition.start();

                recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    console.log('Modal Voice transcript:', transcript);

                    const parsed = parseVoiceInput(transcript);
                    if (!parsed) {
                        const Toast = Swal.mixin({
                            toast: true,
                            position: "top-end",
                            showConfirmButton: false,
                            timer: 2000,
                            timerProgressBar: true,
                            customClass: { popup: state.isDarkMode ? 'swal2-toast' : '' },
                            background: state.isDarkMode ? '#1a1a1a' : '#fff',
                            color: state.isDarkMode ? '#e5e7eb' : '#545454',
                        });
                        Toast.fire({ icon: "warning", title: "ไม่เข้าใจคำสั่งเสียง" });
                        resetBtn();
                        return;
                    }

                    const { type, name, amount, description } = parsed;
                    const category = autoSelectCategory(name, type);

                    // --- เติมข้อมูลลงฟอร์ม (ไม่ Reset ฟอร์ม) ---
                    const getEl = (id) => document.getElementById(id);

                    // 1. ชื่อรายการ
                    if (name) getEl('tx-name').value = name;
                    
                    // 2. จำนวนเงิน (ถ้ามี)
                    if (amount) getEl('tx-amount').value = amount;
                    
                    // 3. คำอธิบาย (ถ้ามี)
                    if (description) {
                         const currentDesc = getEl('tx-desc').value;
                         getEl('tx-desc').value = currentDesc ? currentDesc + ' ' + description : description;
                    }

                    // 4. ประเภทและหมวดหมู่ (อัปเดตถ้าจำเป็น)
                    // เช็คว่าประเภทเปลี่ยนหรือไม่ ถ้าเปลี่ยนให้เลือก Radio ใหม่และอัปเดต Dropdown
                    const currentType = document.querySelector('input[name="tx-type"]:checked').value;
                    if (currentType !== type) {
                        document.querySelector(`input[name="tx-type"][value="${type}"]`).checked = true;
                        updateCategoryDropdown(type); // รีโหลด Dropdown หมวดหมู่
                        updateFormVisibility();       // อัปเดตการแสดงผลฟอร์ม
                    }

                    // 5. เลือกหมวดหมู่
                    setTimeout(() => {
                        getEl('tx-category').value = category;
                        
                        // แจ้งเตือนเล็กน้อยว่าเติมข้อมูลแล้ว
                        const hintEl = getEl('auto-fill-hint');
                        hintEl.innerHTML = '<i class="fa-solid fa-microphone"></i> เติมข้อมูลจากเสียงแล้ว';
                        hintEl.classList.remove('hidden');
                        setTimeout(() => hintEl.classList.add('hidden'), 3000);
                        
                    }, 100);
                };

                recognition.onerror = (event) => {
                    console.error('Speech recognition error', event.error);
                    resetBtn();
                };

                recognition.onend = () => {
                    resetBtn();
                };

                function resetBtn() {
                    btn.innerHTML = originalIcon;
                    btn.disabled = false;
                }
            }

            // Start the application
            initApp();
        });