/**
 * Paintball UI - Professional Refactored Version
 * Organized, maintainable, and performant
 */

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================
const CONFIG = {
    MENU_ANIMATION_DELAY: 200,
    ERROR_DISPLAY_DURATION: 5000,
    INPUT_FOCUS_DELAY: 100,
    NUI_READY_RETRY_DELAY: 500,
};

const MENU_IDS = {
    GAMEMODE: 'gamemode',
    MAP: 'map',
    EDITOR_MAIN: 'editor-main',
    EDITOR: 'editor',
    TEAM: 'team',
    DIALOG: 'dialog',
    MAIN: 'main',
    BROWSER: 'browser',
    WEAPON: 'weapon',
    PIN: 'pin',
    CATEGORY_SELECT: 'category-select',
    WEAPON_SELECT: 'weapon-select',
    PLAYER_SEARCH: 'player-search',
    ERROR: 'error',
    CONFIRM: 'confirm',
    ADMIN_DASHBOARD: 'admin-dashboard',
    SPAWN_VIEWER: 'spawn-viewer',
    CREATE_MATCH: 'create-match',
};

// ============================================================================
// IMAGE CACHE - Cache loaded images to avoid re-fetching
// ============================================================================
const ImageCache = {
    cache: new Map(), // URL -> blob URL
    loading: new Map(), // URL -> Promise
    
    async getBlobUrl(imageUrl) {
        // Return cached blob URL if available
        if (this.cache.has(imageUrl)) {
            return this.cache.get(imageUrl);
        }
        
        // If already loading, return the existing promise
        if (this.loading.has(imageUrl)) {
            return this.loading.get(imageUrl);
        }
        
        // Start loading
        const loadPromise = this.loadImage(imageUrl);
        this.loading.set(imageUrl, loadPromise);
        
        try {
            const blobUrl = await loadPromise;
            this.cache.set(imageUrl, blobUrl);
            return blobUrl;
        } catch (err) {
            throw err;
        } finally {
            this.loading.delete(imageUrl);
        }
    },
    
    async loadImage(imageUrl, retryCount = 0) {
        const maxRetries = 5; // Increased from 3 to 5
        const baseDelay = 2000; // 2 seconds base delay (increased from 1s)
        const maxDelay = 30000; // Cap at 30 seconds max delay
        
        try {
            const response = await fetch(imageUrl, {
                mode: 'cors',
                referrerPolicy: 'no-referrer',
                cache: 'default' // Use cache to avoid repeated requests
            });
            
            if (response.status === 429 && retryCount < maxRetries) {
                // Rate limited - wait with exponential backoff (capped)
                const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
                const delaySeconds = (delay / 1000).toFixed(1);
                console.log(`Rate limited (429), retrying in ${delaySeconds}s (attempt ${retryCount + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.loadImage(imageUrl, retryCount + 1);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (err) {
            if ((err.message.includes('429') || err.message.includes('Rate limited')) && retryCount < maxRetries) {
                // Retry on 429 with exponential backoff (capped)
                const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
                const delaySeconds = (delay / 1000).toFixed(1);
                console.log(`Rate limited, retrying in ${delaySeconds}s (attempt ${retryCount + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.loadImage(imageUrl, retryCount + 1);
            }
            throw err;
        }
    },
    
    revoke(imageUrl) {
        if (this.cache.has(imageUrl)) {
            URL.revokeObjectURL(this.cache.get(imageUrl));
            this.cache.delete(imageUrl);
        }
    },
    
    clear() {
        this.cache.forEach(blobUrl => URL.revokeObjectURL(blobUrl));
        this.cache.clear();
        this.loading.clear();
    }
};

// ============================================================================
// DROPDOWN MANAGER - Global registry for managing all dropdowns
// ============================================================================
const DropdownManager = {
    openDropdowns: new Set(),
    
    register(dropdown) {
        this.openDropdowns.add(dropdown);
    },
    
    unregister(dropdown) {
        this.openDropdowns.delete(dropdown);
    },
    
    closeAll(except = null) {
        this.openDropdowns.forEach(dropdown => {
            if (dropdown !== except && dropdown.close) {
                dropdown.close();
            }
        });
    },
    
    init() {
        // Single global click handler for closing dropdowns
        document.addEventListener('click', (e) => {
            let clickedInsideDropdown = false;
            this.openDropdowns.forEach(dropdown => {
                if (dropdown.container && dropdown.container.contains(e.target)) {
                    clickedInsideDropdown = true;
                }
            });
            
            if (!clickedInsideDropdown) {
                this.closeAll();
            }
        });
    }
};

// Initialize dropdown manager
DropdownManager.init();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const Utils = {
    /**
     * Get resource name for NUI callbacks
     */
    getResourceName() {
        return typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'envy_paintball';
    },

    /**
     * Send NUI callback
     */
    sendNuiCallback(event, data = {}) {
        return fetch(`https://${this.getResourceName()}/${event}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }).catch(error => {
            console.error(`NUI callback error (${event}):`, error);
            return { ok: false };
        });
    },

    /**
     * Parse GTA color codes to HTML
     */
    parseColorCodes(text) {
    if (!text) return '';
    
    const colorMap = {
        '~r~': '<span style="color: #ff4444;">',
        '~g~': '<span style="color: #44ff44;">',
        '~b~': '<span style="color: #00ffff;">',
        '~y~': '<span style="color: #ffff44;">',
        '~p~': '<span style="color: #ff44ff;">',
        '~c~': '<span style="color: #cccccc;">',
        '~m~': '<span style="color: #888888;">',
        '~u~': '<span style="color: #FFFFFF;">',
        '~o~': '<span style="color: #ff8844;">',
        '~eb~': '<span style="color: #0987ff;">',
        '~s~': '</span>',
            '~w~': '</span>',
    };
    
    let htmlText = text;
    for (const [code, replacement] of Object.entries(colorMap)) {
        htmlText = htmlText.replace(new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    }
    
    return htmlText;
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
};

// ============================================================================
// MENU MANAGEMENT SYSTEM
// ============================================================================
const MenuManager = {
    currentMenu: null,
    menus: new Map(),
    templates: new Map(),
    focusReleaseScheduled: false, // Prevent multiple focus release calls
    isNavigating: false, // Track when we're navigating between menus (don't release focus)

    /**
     * Initialize menu system
     */
    init() {
        this.setupTemplates();
        this.createMenus();
        this.attachEventListeners();
    },

    /**
     * Setup HTML templates
     */
    setupTemplates() {
        // Templates are created via functions in HTML
    },

    /**
     * Create all menu instances
     */
    createMenus() {
        // Create menu instances using helper functions from HTML
        const menuConfigs = [
            { id: MENU_IDS.GAMEMODE, title: 'Select Game Mode', isDialog: false },
            { id: MENU_IDS.MAP, title: 'Select Map', isDialog: false },
            { id: MENU_IDS.EDITOR_MAIN, title: 'Map Editor', isDialog: false },
            { id: MENU_IDS.EDITOR, title: 'Map Editor', isDialog: false },
            { id: MENU_IDS.TEAM, title: 'Select Team', isDialog: false },
            { id: MENU_IDS.MAIN, title: 'Paintball', isDialog: false },
            { id: MENU_IDS.BROWSER, title: 'Active Matches', isDialog: false },
            { id: MENU_IDS.WEAPON, title: 'Select Weapon', isDialog: false },
            { id: MENU_IDS.ADMIN_DASHBOARD, title: 'Admin Dashboard', isDialog: false },
            { id: MENU_IDS.DIALOG, title: 'Enter Value', isDialog: true },
            { id: MENU_IDS.PIN, title: 'Enter PIN', isDialog: true },
            { id: MENU_IDS.CATEGORY_SELECT, title: 'Select Category', isDialog: false },
            { id: MENU_IDS.WEAPON_SELECT, title: 'Add Weapon', isDialog: true },
            { id: MENU_IDS.PLAYER_SEARCH, title: 'Search Players', isDialog: true },
            { id: MENU_IDS.ERROR, title: 'Error', isDialog: true },
            { id: MENU_IDS.CONFIRM, title: 'Confirm', isDialog: true },
            { id: MENU_IDS.SPAWN_VIEWER, title: 'Spawn Viewer', isDialog: false },
            { id: MENU_IDS.CREATE_MATCH, title: 'Create Match', isDialog: false },
        ];
        
        menuConfigs.forEach(config => {
            let menu;
            // Special handling for admin dashboard - must use custom structure
            if (config.id === MENU_IDS.ADMIN_DASHBOARD) {
                menu = document.createElement('div');
                menu.className = 'paintball-ui hidden';
                menu.id = `${config.id}-ui`;
                menu.setAttribute('data-menu-id', config.id);
                    menu.innerHTML = `
                        <div class="paintball-container">
                            <div class="paintball-box dashboard-box">
                                <div class="paintball-accent-top"></div>
                                <div class="paintball-content">
                                    <div class="paintball-header">
                                        <h2 class="paintball-title">${config.title}</h2>
                                        <button class="paintball-close" type="button" aria-label="Close">×</button>
                                    </div>
                                    <div class="dashboard-tabs">
                                        <button class="dashboard-tab active" data-tab="maps">Maps</button>
                                        <button class="dashboard-tab" data-tab="weapons">Weapons</button>
                                        <button class="dashboard-tab" data-tab="matches">Active Matches</button>
                                        <button class="dashboard-tab" data-tab="licenses">License Management</button>
                                    </div>
                                    <div class="dashboard-content-wrapper">
                                        <div class="dashboard-tab-content active" data-tab-content="maps"></div>
                                        <div class="dashboard-tab-content" data-tab-content="weapons"></div>
                                        <div class="dashboard-tab-content" data-tab-content="matches"></div>
                                        <div class="dashboard-tab-content" data-tab-content="licenses"></div>
                                    </div>
                                </div>
                                <div class="paintball-accent-bottom"></div>
                            </div>
                        </div>
                    `;
            } else if (typeof createMenuElement === 'function' && !config.isDialog) {
                menu = createMenuElement(config.id, config.title);
            } else if (typeof createDialogElement === 'function' && config.isDialog) {
                menu = createDialogElement(config.id, config.title);
            } else {
                // Fallback: create manually
                menu = document.createElement('div');
                menu.className = 'paintball-ui hidden';
                menu.id = `${config.id}-ui`;
                menu.setAttribute(config.isDialog ? 'data-dialog-id' : 'data-menu-id', config.id);
                
                menu.innerHTML = `
                    <div class="paintball-container">
                        <div class="paintball-box">
                            <div class="paintball-accent-top"></div>
                            <div class="paintball-content">
                                <div class="paintball-header">
                                    <h2 class="paintball-title">${config.title}</h2>
                                    <button class="paintball-close" type="button" aria-label="Close">×</button>
                                </div>
                                <div class="${config.isDialog ? 'paintball-dialog' : 'paintball-menu'}">
                                    ${config.isDialog ? '<div class="error-message" style="display: none;"></div>' : ''}
                                </div>
                            </div>
                            <div class="paintball-accent-bottom"></div>
                        </div>
                    </div>
                `;
            }
            
            if (menu) {
                const titleEl = menu.querySelector('.paintball-title');
                const closeBtn = menu.querySelector('.paintball-close');
                const contentEl = menu.querySelector(config.isDialog ? '.paintball-dialog' : '.paintball-menu');
                const box = menu.querySelector('.paintball-box');
                
                // Special width for weapon-select and player-search
                if (config.id === MENU_IDS.WEAPON_SELECT || config.id === MENU_IDS.PLAYER_SEARCH) {
                    if (box) {
                        box.style.minWidth = '500px';
                        box.style.maxWidth = '700px';
                    }
                } else if (config.id === MENU_IDS.ADMIN_DASHBOARD) {
                    // Dashboard size is handled by CSS class
                } else if (config.id === MENU_IDS.CONFIRM || config.id === MENU_IDS.ERROR) {
                    if (box) {
                        box.style.minWidth = '400px';
                        box.style.maxWidth = '500px';
                    }
                }
                
                // Special styling for confirm/error dialogs
                if (config.id === MENU_IDS.CONFIRM) {
                    const accentTop = menu.querySelector('.paintball-accent-top');
                    const accentBottom = menu.querySelector('.paintball-accent-bottom');
                    if (accentTop) accentTop.style.background = 'linear-gradient(90deg, rgba(255, 184, 0, 0.9) 0%, rgba(255, 184, 0, 0.9) 50%, rgba(255, 184, 0, 0.9) 100%)';
                    if (accentBottom) accentBottom.style.background = 'rgba(255, 184, 0, 0.3)';
                    if (titleEl) titleEl.style.color = '#ffb800';
                } else if (config.id === MENU_IDS.ERROR) {
                    const accentTop = menu.querySelector('.paintball-accent-top');
                    const accentBottom = menu.querySelector('.paintball-accent-bottom');
                    if (accentTop) accentTop.style.background = 'linear-gradient(90deg, rgba(255, 68, 68, 0.9) 0%, rgba(255, 68, 68, 0.9) 50%, rgba(255, 68, 68, 0.9) 100%)';
                    if (accentBottom) accentBottom.style.background = 'rgba(255, 68, 68, 0.3)';
                    if (titleEl) titleEl.style.color = '#ff4444';
                }
                
                // Attach close handler
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        // Special handling for dialogs opened from dashboard - don't release focus if dashboard is open
                        if (config.id === MENU_IDS.PLAYER_SEARCH || config.id === MENU_IDS.WEAPON_SELECT || config.id === MENU_IDS.CATEGORY_SELECT || config.id === MENU_IDS.DIALOG) {
                            const dashboardMenu = this.get(MENU_IDS.ADMIN_DASHBOARD);
                            if (dashboardMenu && dashboardMenu.classList.contains('active')) {
                                this.hide(config.id, { checkFocusRelease: false });
                                return;
                            }
                        }
                        this.close(config.id);
                    });
                }
                
                // Store references
                menu._titleEl = titleEl;
                menu._closeBtn = closeBtn;
                menu._contentEl = contentEl;
                
                this.menus.set(config.id, menu);
                document.body.appendChild(menu);
            }
        });
    },

    /**
     * Get menu title by ID
     */
    getMenuTitle(menuId) {
        const titles = {
            [MENU_IDS.GAMEMODE]: 'Select Game Mode',
            [MENU_IDS.MAP]: 'Select Map',
            [MENU_IDS.EDITOR_MAIN]: 'Map Editor',
            [MENU_IDS.EDITOR]: 'Map Editor',
            [MENU_IDS.TEAM]: 'Select Team',
            [MENU_IDS.DIALOG]: 'Enter Value',
            [MENU_IDS.MAIN]: 'Paintball',
            [MENU_IDS.BROWSER]: 'Active Matches',
            [MENU_IDS.WEAPON]: 'Select Weapon',
            [MENU_IDS.PIN]: 'Enter PIN',
            [MENU_IDS.CATEGORY_SELECT]: 'Select Category',
            [MENU_IDS.WEAPON_SELECT]: 'Add Weapon',
            [MENU_IDS.ERROR]: 'Error',
            [MENU_IDS.CONFIRM]: 'Confirm',
            [MENU_IDS.CREATE_MATCH]: 'Create Match',
        };
        return titles[menuId] || 'Menu';
    },

    /**
     * Show a menu
     * @param {string} menuId - The menu ID to show
     * @param {Object} options - Options for showing the menu
     * @param {string} options.title - Optional title override
     * @param {boolean} options.keepOpen - If true, don't close other menus (for dialogs that should stack)
     */
    show(menuId, options = {}) {
        const menu = this.menus.get(menuId);
        if (!menu) return;

        // Define which menus can stack (dialogs that should appear over other menus)
        // These are typically confirmation dialogs, error messages, or input dialogs
        const stackableMenus = [
            MENU_IDS.CONFIRM,
            MENU_IDS.ERROR,
            MENU_IDS.DIALOG,
            MENU_IDS.PIN,
            MENU_IDS.CATEGORY_SELECT,
            MENU_IDS.WEAPON_SELECT,
            MENU_IDS.PLAYER_SEARCH,
        ];

        // Close other menus unless this is a stackable menu or explicitly told to keep open
        const shouldCloseOthers = !options.keepOpen && !stackableMenus.includes(menuId);
        
        if (shouldCloseOthers) {
            // Close all other menus (including stackable ones) when opening a regular menu
            // Don't check focus release - we're opening a new menu, so focus should stay
            this.menus.forEach((otherMenu, otherMenuId) => {
                if (otherMenuId !== menuId && otherMenu.classList.contains('active')) {
                    // Check for special error flag on weapon-select
                    if (otherMenuId === MENU_IDS.WEAPON_SELECT && otherMenu.getAttribute('data-error-open') === 'true') {
                        // Don't close if error is being displayed
                        return;
                    }
                    this.hide(otherMenuId, { checkFocusRelease: false });
                }
            });
        } else if (stackableMenus.includes(menuId)) {
            // If opening a stackable menu, only close other stackable menus (not regular menus)
            // Don't check focus release - we're opening a new menu, so focus should stay
            this.menus.forEach((otherMenu, otherMenuId) => {
                if (otherMenuId !== menuId && 
                    otherMenu.classList.contains('active') && 
                    stackableMenus.includes(otherMenuId)) {
                    // Don't close weapon-select if it has an error flag
                    if (otherMenuId === MENU_IDS.WEAPON_SELECT && otherMenu.getAttribute('data-error-open') === 'true') {
                        return;
                    }
                    this.hide(otherMenuId, { checkFocusRelease: false });
                }
            });
        }

        // Update title if provided
        if (options.title && menu._titleEl) {
            menu._titleEl.textContent = options.title;
        }

        // Reset focus release flag when showing a menu (menu is being opened)
        this.focusReleaseScheduled = false;
        // Clear navigation flag when menu is shown (navigation complete)
        this.isNavigating = false;

        menu.classList.remove('hidden');
        menu.classList.add('active');
        this.currentMenu = menuId;

        // Auto-focus input if dialog
        if (menuId === MENU_IDS.DIALOG || menuId === MENU_IDS.PIN) {
            setTimeout(() => {
                const input = menu.querySelector('input');
                if (input) input.focus();
            }, CONFIG.INPUT_FOCUS_DELAY);
        }
    },

    /**
     * Hide a menu
     * @param {string} menuId - The menu ID to hide
     * @param {Object} options - Options for hiding
     * @param {boolean} options.checkFocusRelease - If true, check and release focus if all menus closed (default: true)
     */
    hide(menuId, options = {}) {
        const menu = this.menus.get(menuId);
        if (!menu) return;

        // Check for error flag (prevents closing during error display)
        if (menuId === MENU_IDS.WEAPON_SELECT && menu.getAttribute('data-error-open') === 'true') {
            return;
        }

        const shouldCheckFocus = options.checkFocusRelease !== false; // Default to true

        menu.classList.remove('active');
        
        if (this.currentMenu === menuId) {
            this.currentMenu = null;
        }
        
        // Check immediately if all menus are closed (before animation)
        const allClosed = shouldCheckFocus && this.areAllMenusClosed();
        
        setTimeout(() => {
            menu.classList.add('hidden');
            
            // Check again after animation completes, but only if focus wasn't already released
            if (shouldCheckFocus && !this.focusReleaseScheduled && this.areAllMenusClosed()) {
                this.releaseFocus();
            }
        }, CONFIG.MENU_ANIMATION_DELAY);
        
        // If all menus are now closed, release focus immediately
        if (allClosed && !this.focusReleaseScheduled) {
            this.releaseFocus();
        }
    },
    
    /**
     * Check if all menus are closed
     */
    areAllMenusClosed() {
        let hasOpenMenu = false;
        this.menus.forEach((menu, menuId) => {
            // Check both 'active' class and currentMenu state
            if (menu.classList.contains('active')) {
                hasOpenMenu = true;
            }
        });
        return !hasOpenMenu && this.currentMenu === null;
    },
    
    /**
     * Release NUI focus (cursor)
     */
    releaseFocus() {
        // Don't release focus if we're navigating between menus
        if (this.isNavigating) {
            return;
        }
        
        if (this.focusReleaseScheduled) {
            return; // Already scheduled
        }
        
        this.focusReleaseScheduled = true;
        Utils.sendNuiCallback('closeMenu', { menu: 'all' });
        
        // Reset flag after a short delay to allow for future releases
        setTimeout(() => {
            this.focusReleaseScheduled = false;
        }, 100);
    },

    /**
     * Close menu and notify client
     */
    close(menuId) {
        // Explicit close (via close button) - clear navigation flag and release focus
        this.isNavigating = false;
        this.hide(menuId);
        Utils.sendNuiCallback('closeMenu', { menu: menuId });
    },

    /**
     * Hide all menus
     * @param {boolean} force - If true, force close even menus with error flags
     */
    hideAll(force = false) {
        // Explicit close all - clear navigation flag
        this.isNavigating = false;
        
        this.menus.forEach((menu, menuId) => {
            // Check for error flag unless forcing
            if (force || menuId !== MENU_IDS.WEAPON_SELECT || menu.getAttribute('data-error-open') !== 'true') {
                // Remove active class immediately
                menu.classList.remove('active');
            }
        });
        this.currentMenu = null;
        
        // Release cursor immediately when hiding all menus
        this.releaseFocus();
        
        // Complete the hide animation after focus is released
        setTimeout(() => {
            this.menus.forEach((menu, menuId) => {
                if (force || menuId !== MENU_IDS.WEAPON_SELECT || menu.getAttribute('data-error-open') !== 'true') {
                    menu.classList.add('hidden');
                }
            });
        }, CONFIG.MENU_ANIMATION_DELAY);
    },

    /**
     * Get menu element
     */
    get(menuId) {
        return this.menus.get(menuId);
    },

    /**
     * Get menu content element
     */
    getContent(menuId) {
        const menu = this.menus.get(menuId);
        return menu?._contentEl || menu?.querySelector('.paintball-menu') || menu?.querySelector('.paintball-dialog');
    },

    /**
     * Attach global event listeners
     */
    attachEventListeners() {
        // Escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentMenu) {
                // Escape key - explicit close, clear navigation flag
                this.isNavigating = false;
                this.hideAll();
                Utils.sendNuiCallback('closeMenu', { menu: 'all' });
            }
        });
    },
};

// ============================================================================
// UI COMPONENTS
// ============================================================================
const Components = {
    /**
     * Create a menu item
     */
    createMenuItem(title, description, onClick, options = {}) {
        const item = document.createElement('div');
        item.className = 'menu-item';
        
        if (options.disabled) {
            item.style.cursor = 'not-allowed';
            item.style.opacity = '0.6';
            item.style.filter = 'grayscale(100%)';
        }
        
        if (options.style) {
            Object.assign(item.style, options.style);
        }
        
        const titleEl = document.createElement('div');
        titleEl.className = 'menu-item-title';
    titleEl.textContent = title;
        
        item.appendChild(titleEl);
        
        if (description) {
        const descEl = document.createElement('div');
        descEl.className = 'menu-item-description';
            descEl.textContent = description;
            item.appendChild(descEl);
        }
        
        if (onClick && !options.disabled) {
            item.addEventListener('click', onClick);
        }
        
        return item;
    },

    /**
     * Create a button
     */
    createButton(text, onClick, variant = 'primary', options = {}) {
        const btn = document.createElement('button');
        btn.className = variant === 'primary' ? 'btn-primary' : 'btn-secondary';
        btn.textContent = text;
        
        if (options.style) {
            Object.assign(btn.style, options.style);
        }
        
        if (onClick) {
            btn.addEventListener('click', onClick);
        }
        
        return btn;
    },

    /**
     * Create an input field
     */
    createInput(placeholder, options = {}) {
        const input = document.createElement('input');
        input.type = options.type || 'text';
        input.className = 'dialog-input';
    input.placeholder = placeholder;
        
        if (options.value) input.value = options.value;
        if (options.maxLength) input.maxLength = options.maxLength;
        if (options.autocomplete !== undefined) input.autocomplete = options.autocomplete ? 'on' : 'off';
        
        if (options.style) {
            Object.assign(input.style, options.style);
        }
        
        return input;
    },

    /**
     * Show error message
     */
    showError(element, message) {
        if (!element) return;
        
        element.textContent = message;
        element.style.display = 'block';
        
        setTimeout(() => {
            element.textContent = '';
            element.style.display = 'none';
        }, CONFIG.ERROR_DISPLAY_DURATION);
    },

    /**
     * Create a custom dropdown that looks like menu items
     */
    createCustomDropdown(options, placeholder, onSelect) {
        const dropdownContainer = document.createElement('div');
        dropdownContainer.className = 'custom-dropdown';
        dropdownContainer.style.position = 'relative';
        dropdownContainer.style.width = '100%';
        
        const dropdownButton = document.createElement('div');
        dropdownButton.className = 'custom-dropdown-button';
        dropdownButton.style.cssText = `
            background: var(--color-bg-tertiary);
            border: 1px solid var(--color-primary-dark);
            border-radius: var(--radius-lg);
            padding: var(--spacing-lg);
            color: var(--color-text-primary);
            font-size: var(--font-size-base);
            font-family: var(--font-family);
            cursor: pointer;
            transition: all var(--transition-normal);
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
        `;
        
        const buttonText = document.createElement('span');
        buttonText.textContent = placeholder;
        buttonText.style.color = 'var(--color-text-secondary)';
        dropdownButton.appendChild(buttonText);
        
        const arrowIcon = document.createElement('span');
        arrowIcon.innerHTML = '▼';
        arrowIcon.style.cssText = `
            color: var(--color-primary);
            font-size: 10px;
            transition: transform var(--transition-normal);
            margin-left: 8px;
        `;
        dropdownButton.appendChild(arrowIcon);
        
        const dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'custom-dropdown-menu';
        dropdownMenu.style.cssText = `
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            right: 0;
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-primary-dark);
            border-radius: var(--radius-lg);
            max-height: 250px;
            overflow-y: auto;
            overflow-x: hidden;
            z-index: 1000;
            display: none;
            box-shadow: var(--shadow-lg);
        `;
        
        let isOpen = false;
        let selectedValue = null;
        let selectedText = placeholder;
        
        const updateButton = () => {
            buttonText.textContent = selectedText;
            buttonText.style.color = selectedValue ? 'var(--color-text-primary)' : 'var(--color-text-secondary)';
        };
        
        const closeDropdown = () => {
            if (!isOpen) return;
            isOpen = false;
            dropdownMenu.style.display = 'none';
            arrowIcon.style.transform = 'rotate(0deg)';
            dropdownButton.style.borderColor = 'var(--color-primary-dark)';
            dropdownButton.style.boxShadow = 'none';
            DropdownManager.unregister(dropdownContainer);
            
            // Clean up any preview tooltips (blob URLs are cached, don't revoke here)
            const options = dropdownMenu.querySelectorAll('.custom-dropdown-option');
            options.forEach(optionEl => {
                if (optionEl._previewTooltip) {
                    optionEl._previewTooltip.style.display = 'none';
                }
                // Note: We don't revoke cached blob URLs here - they're reused
                // The cache will be cleared when the menu is fully closed if needed
            });
        };
        
        const openDropdown = () => {
            // Close all other dropdowns first
            DropdownManager.closeAll(dropdownContainer);
            
            isOpen = true;
            dropdownMenu.style.display = 'block';
            arrowIcon.style.transform = 'rotate(180deg)';
            dropdownButton.style.borderColor = 'var(--color-primary-light)';
            dropdownButton.style.boxShadow = 'var(--shadow-primary)';
            DropdownManager.register(dropdownContainer);
        };
        
        // Store close function on container for DropdownManager
        dropdownContainer.close = closeDropdown;
        dropdownContainer.container = dropdownContainer;
        
        dropdownButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isOpen) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });
        
        // Create options
        if (!options || options.length === 0) {
            const emptyOption = document.createElement('div');
            emptyOption.className = 'custom-dropdown-option';
            emptyOption.style.cssText = `
                padding: var(--spacing-lg);
                color: var(--color-text-tertiary);
                cursor: default;
            `;
            emptyOption.textContent = 'No options available';
            dropdownMenu.appendChild(emptyOption);
        } else {
            options.forEach(option => {
                const optionElement = document.createElement('div');
                optionElement.className = 'custom-dropdown-option';
                optionElement.style.cssText = `
                    padding: var(--spacing-lg);
                    color: var(--color-text-primary);
                    cursor: pointer;
                    transition: all var(--transition-normal);
                    border-left: 3px solid transparent;
                    border-bottom: 1px solid rgba(9, 135, 255, 0.1);
                    position: relative;
                `;
                
                const textSpan = document.createElement('span');
                if (option.text) {
                    textSpan.textContent = option.text;
                } else {
                    textSpan.textContent = option;
                }
                textSpan.style.cssText = `
                    display: inline-block;
                    transition: transform var(--transition-normal);
                `;
                optionElement.appendChild(textSpan);
                
                // Add preview image support if available
                let previewTooltip = null;
                if (option.data && option.data.previewImage) {
                    const previewUrl = option.data.previewImage;
                    console.log('Creating preview tooltip for:', option.data.name, 'with image:', previewUrl);
                    
                    // Create tooltip container - append to body to avoid overflow clipping
                    previewTooltip = document.createElement('div');
                    previewTooltip.className = 'dropdown-preview-tooltip';
                    previewTooltip.style.cssText = `
                        position: fixed;
                        width: 300px;
                        height: 200px;
                        background: var(--color-bg-secondary);
                        border: 2px solid var(--color-primary);
                        border-radius: var(--radius-lg);
                        z-index: 1000001;
                        display: none;
                        overflow: hidden;
                        box-shadow: var(--shadow-lg);
                        pointer-events: none;
                    `;
                    
                    // Add loading placeholder
                    const loadingText = document.createElement('div');
                    loadingText.textContent = 'Loading...';
                    loadingText.style.cssText = `
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        color: var(--color-text-secondary);
                        font-size: 12px;
                        z-index: 1;
                    `;
                    previewTooltip.appendChild(loadingText);
                    
                    const previewImg = document.createElement('img');
                    // For imgur URLs, sometimes we need to use the direct link format
                    // Convert imgur.com/ID to i.imgur.com/ID.png if needed
                    let imageUrl = previewUrl;
                    if (imageUrl.includes('imgur.com') && !imageUrl.includes('i.imgur.com')) {
                        // Convert https://imgur.com/E6mfcnr to https://i.imgur.com/E6mfcnr.png
                        imageUrl = imageUrl.replace('imgur.com/', 'i.imgur.com/');
                        if (!imageUrl.match(/\.(png|jpg|jpeg)$/i)) {
                            imageUrl += '.png';
                        }
                    }
                    
                    // Set referrer policy to avoid CORS issues with some hosts
                    previewImg.referrerPolicy = 'no-referrer';
                    // Try anonymous CORS first
                    previewImg.crossOrigin = 'anonymous';
                    
                    console.log('Attempting to load image from URL:', imageUrl);
                    previewImg.src = imageUrl;
                    previewImg.style.cssText = `
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        display: block;
                        background: var(--color-bg-tertiary);
                    `;
                    
                    previewImg.onload = () => {
                        console.log('Preview image loaded successfully:', imageUrl);
                        loadingText.style.display = 'none';
                    };
                    previewImg.onerror = (e) => {
                        console.error('Failed to load preview image with crossOrigin=anonymous:', imageUrl);
                        console.error('Original URL was:', previewUrl);
                        
                        // Try without crossOrigin (some hosts don't support CORS)
                        console.log('Retrying without crossOrigin attribute...');
                        previewImg.removeAttribute('crossOrigin');
                        previewImg.src = ''; // Clear first
                        previewImg.src = imageUrl;
                        
                        // If that also fails, try fetch as fallback with caching
                        previewImg.onerror = () => {
                            console.error('Direct load also failed, trying fetch + blob method with cache...');
                            loadingText.textContent = 'Loading...';
                            
                            // Use ImageCache which handles retries and caching
                            ImageCache.getBlobUrl(imageUrl)
                            .then(blobUrl => {
                                console.log('Successfully loaded image as blob via cache');
                                previewImg.src = blobUrl;
                                loadingText.style.display = 'none';
                                // Store image URL for cleanup (don't revoke immediately, cache handles it)
                                optionElement._cachedImageUrl = imageUrl;
                            })
                            .catch(err => {
                                console.error('Fetch also failed:', err.message);
                                let errorMsg = 'Image failed to load';
                                if (err.message.includes('429')) {
                                    errorMsg = 'Rate limited by image host\n(Please wait a moment)';
                                } else {
                                    errorMsg += '\n(' + err.message + ')';
                                }
                                loadingText.textContent = errorMsg;
                                loadingText.style.color = 'var(--color-error)';
                                loadingText.style.fontSize = '11px';
                                loadingText.style.textAlign = 'center';
                                loadingText.style.whiteSpace = 'pre-line';
                            });
                        };
                    };
                    
                    previewTooltip.appendChild(previewImg);
                    document.body.appendChild(previewTooltip);
                    
                    // Store reference for cleanup
                    optionElement._previewTooltip = previewTooltip;
                }
                
                optionElement.addEventListener('mouseenter', (e) => {
                    optionElement.style.background = 'var(--color-bg-tertiary-hover)';
                    optionElement.style.borderLeft = '3px solid var(--color-primary)';
                    textSpan.style.transform = 'translateX(3px)';
                    if (previewTooltip) {
                        // Position tooltip relative to option element
                        const rect = optionElement.getBoundingClientRect();
                        const tooltipWidth = 300;
                        const tooltipHeight = 200;
                        const spacing = 10;
                        
                        // Calculate position - try to the right first
                        let left = rect.right + spacing;
                        let top = rect.top;
                        
                        // Check if tooltip would go off right edge of screen
                        if (left + tooltipWidth > window.innerWidth) {
                            // Position to the left instead
                            left = rect.left - tooltipWidth - spacing;
                        }
                        
                        // Check if tooltip would go off bottom edge
                        if (top + tooltipHeight > window.innerHeight) {
                            top = window.innerHeight - tooltipHeight - 10;
                        }
                        
                        // Ensure it doesn't go off top edge
                        if (top < 10) {
                            top = 10;
                        }
                        
                        previewTooltip.style.left = left + 'px';
                        previewTooltip.style.top = top + 'px';
                        previewTooltip.style.display = 'block';
                    }
                });
                
                optionElement.addEventListener('mouseleave', () => {
                    optionElement.style.background = '';
                    optionElement.style.borderLeft = '3px solid transparent';
                    textSpan.style.transform = 'translateX(0)';
                    if (previewTooltip) {
                        previewTooltip.style.display = 'none';
                    }
                });
                
                optionElement.addEventListener('click', () => {
                    selectedValue = option.value || option;
                    selectedText = option.text || option;
                    updateButton();
                    closeDropdown();
                    if (onSelect) {
                        onSelect(selectedValue, option);
                    }
                });
                
                dropdownMenu.appendChild(optionElement);
            });
        }
        
        // Remove last border
        const lastOption = dropdownMenu.lastElementChild;
        if (lastOption) {
            lastOption.style.borderBottom = 'none';
        }
        
        dropdownButton.addEventListener('mouseenter', () => {
            if (!isOpen) {
                dropdownButton.style.background = 'var(--color-bg-tertiary-hover)';
                dropdownButton.style.borderColor = 'var(--color-primary-light)';
                dropdownButton.style.boxShadow = 'var(--shadow-primary)';
            }
        });
        
        dropdownButton.addEventListener('mouseleave', () => {
            if (!isOpen) {
                dropdownButton.style.background = 'var(--color-bg-tertiary)';
                dropdownButton.style.borderColor = 'var(--color-primary-dark)';
                dropdownButton.style.boxShadow = 'none';
            }
        });
        
        dropdownContainer.appendChild(dropdownButton);
        dropdownContainer.appendChild(dropdownMenu);
        
        // Expose methods
        dropdownContainer.getValue = () => selectedValue;
        dropdownContainer.getText = () => selectedText;
        dropdownContainer.setValue = (value) => {
            const option = options.find(opt => (opt.value || opt) === value);
            if (option) {
                selectedValue = option.value || option;
                selectedText = option.text || option;
                updateButton();
            }
        };
        
        return dropdownContainer;
    },

    /**
     * Create a context menu dropdown (for "..." buttons)
     */
    createContextMenu(options, buttonText = '...') {
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.display = 'inline-block';

        const button = Components.createButton(buttonText, () => {}, 'secondary', {
            style: {
                padding: '6px 12px',
                fontSize: '14px',
                minWidth: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }
        });
        
        const menu = document.createElement('div');
        menu.style.cssText = `
            position: absolute;
            top: calc(100% + 4px);
            right: 0;
            background: var(--color-bg-secondary);
            border: 1px solid var(--color-primary-dark);
            border-radius: var(--radius-lg);
            min-width: 150px;
            z-index: 1000;
            display: none;
            box-shadow: var(--shadow-lg);
            overflow: hidden;
        `;

        options.forEach((option, index) => {
            const menuItem = document.createElement('div');
            const isFirst = index === 0;
            const isLast = index === options.length - 1;
            menuItem.style.cssText = `
                padding: var(--spacing-md) var(--spacing-lg);
                color: var(--color-text-primary);
                cursor: pointer;
                transition: all var(--transition-normal);
                border-left: 3px solid transparent;
                border-bottom: ${index < options.length - 1 ? '1px solid rgba(9, 135, 255, 0.1)' : 'none'};
                ${isFirst ? 'border-top-left-radius: var(--radius-lg);' : ''}
                ${isLast ? 'border-bottom-left-radius: var(--radius-lg);' : ''}
                font-size: var(--font-size-base);
                font-family: var(--font-family);
            `;
            
            const textSpan = document.createElement('span');
            textSpan.textContent = option.label;
            textSpan.style.cssText = `
                display: inline-block;
                transition: transform var(--transition-normal);
            `;
            
            if (option.danger) {
                menuItem.style.color = '#ff4444';
                textSpan.style.color = '#ff4444';
            }
            
            menuItem.appendChild(textSpan);
            
            menuItem.addEventListener('mouseenter', () => {
                if (option.danger) {
                    menuItem.style.background = 'rgba(255, 68, 68, 0.15)';
                    menuItem.style.borderLeft = '3px solid #ff4444';
                } else {
                    menuItem.style.background = 'var(--color-bg-tertiary-hover)';
                    menuItem.style.borderLeft = '3px solid var(--color-primary)';
                }
                textSpan.style.transform = 'translateX(3px)';
            });
            
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = '';
                menuItem.style.borderLeft = '3px solid transparent';
                textSpan.style.transform = 'translateX(0)';
            });
            
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                if (option.onClick) {
                    option.onClick();
                }
                menu.style.display = 'none';
                DropdownManager.unregister({ container: menu });
            });
            
            menu.appendChild(menuItem);
        });

        const contextMenu = {
            container: container,
            button: button,
            menu: menu,
            isOpen: false,
            open() {
                DropdownManager.closeAll(this);
                menu.style.display = 'block';
                this.isOpen = true;
                DropdownManager.register(this);
            },
            close() {
                menu.style.display = 'none';
                this.isOpen = false;
                DropdownManager.unregister(this);
            },
            toggle() {
                if (this.isOpen) {
                    this.close();
                } else {
                    this.open();
                }
            }
        };

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            contextMenu.toggle();
        });

        container.appendChild(button);
        container.appendChild(menu);

        return contextMenu;
    },
};

// ============================================================================
// PRESS E UI MANAGER
// ============================================================================
// ============================================================================
// SCOREBOARD MANAGER
// ============================================================================
const ScoreboardManager = {
    scoreboardElement: null,
    titleElement: null,
    bodyElement: null,
    
    init() {
        this.scoreboardElement = document.getElementById('scoreboard-ui');
        this.titleElement = document.getElementById('scoreboard-title');
        this.bodyElement = document.getElementById('scoreboard-body');
    },
    
    show(scoreData) {
        if (!this.scoreboardElement || !scoreData) return;
        
        // Update title based on game mode
        if (this.titleElement) {
            const gameModeName = scoreData.gameModeName || 'Scoreboard';
            this.titleElement.textContent = gameModeName;
        }
        
        // Clear and rebuild scoreboard body
        if (this.bodyElement) {
            this.bodyElement.innerHTML = '';
            
            // Check if this is a team-based mode (has team scores)
            const hasTeamScores = scoreData.teamScores && Object.keys(scoreData.teamScores).length > 0;
            
            if (hasTeamScores) {
                // Team-based mode: Show players grouped by team with individual kills/deaths and team totals
                const players = scoreData.players || [];
                let teamScoresHTML = '';
                
                // Group players by team
                const playersByTeam = {};
                players.forEach(player => {
                    if (player.team) {
                        if (!playersByTeam[player.team]) {
                            playersByTeam[player.team] = [];
                        }
                        playersByTeam[player.team].push(player);
                    }
                });
                
                // Sort teams by team number
                const teamNumbers = Object.keys(playersByTeam).map(Number).sort((a, b) => a - b);
                
                teamNumbers.forEach(teamNum => {
                    const teamPlayers = playersByTeam[teamNum];
                    // Lua arrays are 1-indexed, but JSON arrays are 0-indexed in JavaScript
                    // So team 1 is at index 0, team 2 is at index 1, etc.
                    const teamScore = scoreData.teamScores[teamNum - 1] || 0;
                    
                    // Team header with total score
                    teamScoresHTML += `
                        <div class="scoreboard-team-header">Team ${teamNum} - Total: ${teamScore}</div>
                    `;
                    
                    // Sort players by kills (descending)
                    const sortedPlayers = [...teamPlayers].sort((a, b) => (b.kills || 0) - (a.kills || 0));
                    
                    // Show each player in the team with their kills/deaths
                    sortedPlayers.forEach(player => {
                        teamScoresHTML += `
                            <div class="scoreboard-item">
                                <span class="scoreboard-item-name">${this.escapeHtml(player.name || 'Unknown')}</span>
                                <span class="scoreboard-item-score">${player.kills || 0}K / ${player.deaths || 0}D</span>
                            </div>
                        `;
                    });
                });
                
                this.bodyElement.innerHTML = teamScoresHTML;
            } else {
                // FFA/1v1: Show individual player scores with kills/deaths
                const players = scoreData.players || [];
                // Sort by score (descending)
                const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
                
                sortedPlayers.forEach((player, index) => {
                    const item = document.createElement('div');
                    item.className = 'scoreboard-item';
                    if (index === 0 && sortedPlayers.length > 1) {
                        item.style.borderColor = 'var(--color-accent)';
                        item.style.background = 'linear-gradient(90deg, rgba(0, 255, 255, 0.15) 0%, var(--color-bg-tertiary) 100%)';
                    }
                    item.innerHTML = `
                        <span class="scoreboard-item-name">${this.escapeHtml(player.name || 'Unknown')}</span>
                        <span class="scoreboard-item-score">${player.kills || 0}K / ${player.deaths || 0}D</span>
                    `;
                    this.bodyElement.appendChild(item);
                });
            }
            
            // Add scrollbar class
            this.bodyElement.classList.add('scoreboard-scrollbar');
        }
        
        // Show scoreboard
        this.scoreboardElement.classList.remove('hidden');
        this.scoreboardElement.classList.add('active');
    },
    
    hide() {
        if (!this.scoreboardElement) return;
        this.scoreboardElement.classList.remove('active');
        this.scoreboardElement.classList.add('hidden');
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ============================================================================
// POST-MATCH SCOREBOARD MANAGER
// ============================================================================
const PostMatchScoreboardManager = {
    uiElement: null,
    titleElement: null,
    bodyElement: null,
    closeBtn: null,
    isVisible: false,

    init() {
        this.uiElement = document.getElementById('postmatch-scoreboard-ui');
        this.titleElement = document.getElementById('postmatch-title');
        this.bodyElement = document.getElementById('postmatch-body');
        this.closeBtn = document.getElementById('postmatch-close-btn');
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                this.hide();
            });
        }
        
        // Listen for G key press when scoreboard is visible
        document.addEventListener('keydown', (e) => {
            // G key (keyCode 71) or 'g' key
            if ((e.keyCode === 71 || e.key === 'g' || e.key === 'G') && this.uiElement && !this.uiElement.classList.contains('hidden')) {
                e.preventDefault();
                this.hide();
            }
        });
    },

    show(postMatchData) {
        if (!this.uiElement || !postMatchData) return;
        
        this.isVisible = true;
        this.uiElement.classList.remove('hidden');
        
        // Set title
        if (this.titleElement) {
            this.titleElement.textContent = `${postMatchData.gameModeName || 'Match'} Results`;
        }
        
        // Build content
        let html = '';
        
        // Group players by team if team-based mode
        if (postMatchData.winningTeam !== null && postMatchData.winningTeam !== undefined) {
            // Team-based mode
            const winningTeamPlayers = postMatchData.players.filter(p => p.team === postMatchData.winningTeam);
            const losingTeamPlayers = postMatchData.players.filter(p => p.team === postMatchData.losingTeam);
            
            // Winning team
            html += this.renderTeamSection(winningTeamPlayers, 'Winning Team', true, postMatchData.mvpWinning);
            
            // Losing team
            html += this.renderTeamSection(losingTeamPlayers, 'Losing Team', false, postMatchData.mvpLosing);
        } else {
            // FFA/1v1 mode - single MVP
            html += this.renderTeamSection(postMatchData.players, 'Players', null, postMatchData.mvpWinning);
        }
        
        if (this.bodyElement) {
            this.bodyElement.innerHTML = html;
        }
    },

    renderTeamSection(players, teamLabel, isWinning, mvpId) {
        if (!players || players.length === 0) return '';
        
        // Sort by MVP score (descending)
        const sortedPlayers = [...players].sort((a, b) => (b.mvpScore || 0) - (a.mvpScore || 0));
        
        let html = `<div class="postmatch-team-section">`;
        html += `<div class="postmatch-team-header ${isWinning === true ? 'winning' : isWinning === false ? 'losing' : ''}">${teamLabel}</div>`;
        html += `<table class="postmatch-stats-table">`;
        html += `<thead><tr>`;
        html += `<th>Player</th>`;
        html += `<th>K</th>`;
        html += `<th>D</th>`;
        html += `<th>K/D</th>`;
        html += `<th>Score</th>`;
        html += `</tr></thead>`;
        html += `<tbody>`;
        
        sortedPlayers.forEach(player => {
            const isMVP = player.id === mvpId;
            html += `<tr class="${isMVP ? 'mvp' : ''}">`;
            html += `<td class="postmatch-player-name">${this.escapeHtml(player.name || 'Unknown')}${isMVP ? '<span class="postmatch-mvp-badge">MVP</span>' : ''}</td>`;
            html += `<td class="postmatch-stat">${player.kills || 0}</td>`;
            html += `<td class="postmatch-stat">${player.deaths || 0}</td>`;
            html += `<td class="postmatch-stat ${isMVP ? 'highlight' : ''}">${player.kdRatio || 0.0}</td>`;
            html += `<td class="postmatch-stat">${player.score || 0}</td>`;
            html += `</tr>`;
        });
        
        html += `</tbody></table>`;
        html += `</div>`;
        
        return html;
    },

    hide() {
        if (!this.uiElement) return;
        
        this.isVisible = false;
        this.uiElement.classList.add('hidden');
        
        // Notify client to disable NUI focus
        if (typeof GetParentResourceName === 'function') {
            fetch(`https://${GetParentResourceName()}/hidePostMatchScoreboard`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            }).catch(() => {});
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

const PressEUIManager = {
    element: null,
    textElement: null,
    visible: false,

    init() {
        this.element = document.getElementById('press-e-ui');
        this.textElement = document.getElementById('press-e-text');
    },

    show(x, y, text, opacity = 1) {
        if (!this.element || !this.textElement) return;
        
        if (text) {
            this.textElement.innerHTML = Utils.parseColorCodes(text);
        }
        
        if (x !== undefined && y !== undefined) {
            this.element.style.left = `${x}px`;
            this.element.style.top = `${y}px`;
        }
        
        this.element.style.opacity = opacity;
        
        if (!this.visible) {
            this.element.classList.remove('hidden');
            this.visible = true;
        }
    },

    hide() {
        if (this.element && this.visible) {
            this.element.classList.add('hidden');
            this.visible = false;
        }
    },
};

// ============================================================================
// MENU DISPLAY HANDLERS
// ============================================================================
const MenuHandlers = {
    /**
     * Display game modes
     */
    displayGameModes(gameModes) {
        const content = MenuManager.getContent(MENU_IDS.GAMEMODE);
        if (!content) return;
        
        content.innerHTML = '';
        
        gameModes.forEach(mode => {
            const playerCountText = mode.minPlayers === mode.maxPlayers 
                ? null 
                : `Players: ${mode.minPlayers}-${mode.maxPlayers}`;
            const item = Components.createMenuItem(
                mode.name,
                playerCountText,
                () => {
                    // Navigating to map selection - set navigation flag
                    MenuManager.isNavigating = true;
                    MenuManager.hide(MENU_IDS.GAMEMODE, { checkFocusRelease: false });
                    Utils.sendNuiCallback('selectGameMode', { gameModeId: mode.id });
                }
            );
            content.appendChild(item);
        });
        
        MenuManager.show(MENU_IDS.GAMEMODE);
    },

    /**
     * Display maps
     */
    displayMaps(maps, options = {}) {
        const content = MenuManager.getContent(MENU_IDS.MAP);
        if (!content) return;
        
        content.innerHTML = '';
        
        if (!maps || maps.length === 0) {
            const item = Components.createMenuItem(
                'No maps available',
                options.forEditing ? 'Please create maps using the map editor' : 'Please create maps using the map editor',
                null,
                { disabled: true, style: { cursor: 'default', opacity: '0.6' } }
            );
            content.appendChild(item);
            } else {
            maps.forEach(map => {
                const item = Components.createMenuItem(
                    map.name,
                    null,
                    () => {
                        if (options.forDeleting) {
                            DialogManager.showConfirm(
                                `Are you sure you want to delete map "${map.name}"?\n\nThis action cannot be undone.`,
                                () => {
                                    MenuManager.hide(MENU_IDS.CONFIRM);
                                    Utils.sendNuiCallback('deleteMap', { mapId: map.id });
                                }
                            );
                        } else if (options.forEditing) {
                            // Loading map for edit - closes UI, release focus
                            MenuManager.isNavigating = false;
                            MenuManager.hide(MENU_IDS.MAP);
                            Utils.sendNuiCallback('loadMapForEdit', { mapId: map.id });
                } else {
                            // Selecting map for match - navigating to match settings
                            MenuManager.isNavigating = true;
                            MenuManager.hide(MENU_IDS.MAP, { checkFocusRelease: false });
                            Utils.sendNuiCallback('selectMap', { mapId: map.id });
                        }
                    }
                );
                content.appendChild(item);
            });
        }
        
        MenuManager.show(MENU_IDS.MAP);
    },

    /**
     * Display main menu
     */
    displayMainMenu(hasMatch, inMatch, canStartMatch) {
        const content = MenuManager.getContent(MENU_IDS.MAIN);
        if (!content) return;
        
        content.innerHTML = '';
    
    const items = [
        {
            title: 'Create Match',
            description: 'Start a new paintball match',
            onClick: () => {
                if (hasMatch) {
                    DialogManager.showConfirm(
                        'You already have a match created. Do you want to close it and create a new one?',
                        () => {
                            MenuManager.hide(MENU_IDS.CONFIRM);
                            Utils.sendNuiCallback('closeMatch').then(() => {
                                // Only hide main menu, don't release focus - we're navigating to create match form
                                MenuManager.isNavigating = true;
                                MenuManager.hide(MENU_IDS.MAIN, { checkFocusRelease: false });
                                // Navigate to create match form - this is intentional navigation
                                Utils.sendNuiCallback('mainAction', { action: 'create' });
                            });
                        }
                    );
                } else {
                    // Only hide main menu, don't release focus - we're navigating to create match form
                    MenuManager.isNavigating = true;
                    MenuManager.hide(MENU_IDS.MAIN, { checkFocusRelease: false });
                    // Navigate to create match form - this is intentional navigation
                    Utils.sendNuiCallback('mainAction', { action: 'create' });
                }
            },
        },
        {
            title: 'Browse Matches',
            description: 'View and join active matches',
            onClick: () => {
                // Only hide main menu, don't release focus - we're navigating to match browser
                MenuManager.isNavigating = true;
                MenuManager.hide(MENU_IDS.MAIN, { checkFocusRelease: false });
                Utils.sendNuiCallback('mainAction', { action: 'browse' });
            },
            },
        {
            title: 'Select Weapon',
            description: 'Choose your weapon for matches',
            onClick: () => {
                // Navigating to weapon selection - set navigation flag
                MenuManager.isNavigating = true;
                MenuManager.hide(MENU_IDS.MAIN, { checkFocusRelease: false });
                Utils.sendNuiCallback('selectWeapon');
            },
        },
        ];
        
    if (canStartMatch) {
        items.push({
            title: 'Start Match',
            description: 'Start the match now',
            onClick: () => {
                    MenuManager.hideAll();
                    Utils.sendNuiCallback('startMatch');
                    // UI will stay closed - match is starting
                },
            });
        }
        
    if (hasMatch) {
        items.push({
            title: 'Close Match',
            description: 'Close your current match',
            onClick: () => {
                    MenuManager.hideAll();
                    Utils.sendNuiCallback('closeMatch');
                    // Don't refresh/reopen - user explicitly closed the match
                },
        });
    }
    
    items.forEach(item => {
            content.appendChild(Components.createMenuItem(item.title, item.description, item.onClick));
        });
        
        MenuManager.show(MENU_IDS.MAIN);
    },

    /**
     * Display create match form
     */
    displayCreateMatchForm(gameModes, maps) {
        const content = MenuManager.getContent(MENU_IDS.CREATE_MATCH);
        if (!content) return;
        
        content.innerHTML = '';
        
        // Form state
        let selectedGameMode = null;
        let selectedMap = null;
        let isPrivate = false;
        let pinValue = '';
        
        // Create form container
        const formContainer = document.createElement('div');
        formContainer.style.display = 'flex';
        formContainer.style.flexDirection = 'column';
        formContainer.style.gap = '15px';
        formContainer.style.padding = '10px 0';
        
        // Error message element
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.style.display = 'none';
        errorMsg.style.color = '#ff4444';
        errorMsg.style.padding = '10px';
        errorMsg.style.marginBottom = '10px';
        errorMsg.style.borderRadius = '4px';
        errorMsg.style.backgroundColor = 'rgba(255, 68, 68, 0.1)';
        formContainer.appendChild(errorMsg);
        
        const showError = (message) => {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
            setTimeout(() => {
                errorMsg.style.display = 'none';
            }, 5000);
        };
        
        // Game Mode Selection
        const gameModeLabel = document.createElement('div');
        gameModeLabel.className = 'menu-item-title';
        gameModeLabel.textContent = 'Select Game Mode';
        gameModeLabel.style.marginBottom = '8px';
        formContainer.appendChild(gameModeLabel);
        
        const gameModeOptions = !gameModes || gameModes.length === 0 
            ? [{ text: 'No game modes available', value: null }]
            : gameModes.map(mode => ({
                text: mode.minPlayers === mode.maxPlayers 
                    ? mode.name 
                    : `${mode.name} (${mode.minPlayers}-${mode.maxPlayers} players)`,
                value: mode.id,
                data: mode
            }));
        
        const gameModeDropdown = Components.createCustomDropdown(
            gameModeOptions,
            '-- Select Game Mode --',
            (value, option) => {
                if (option && option.data) {
                    selectedGameMode = option.data;
                } else {
                    selectedGameMode = null;
                }
            }
        );
        
        formContainer.appendChild(gameModeDropdown);
        
        // Map Selection
        const mapLabel = document.createElement('div');
        mapLabel.className = 'menu-item-title';
        mapLabel.textContent = 'Select Map';
        mapLabel.style.marginTop = '10px';
        mapLabel.style.marginBottom = '8px';
        formContainer.appendChild(mapLabel);
        
        const mapOptions = !maps || maps.length === 0
            ? [{ text: 'No maps available', value: null }]
            : maps.map(map => {
                // Debug: log map data to see if previewImage is included
                console.log('Map data:', map.name, 'PreviewImage:', map.previewImage);
                return {
                    text: map.name,
                    value: map.id,
                    data: map
                };
            });
        
        const mapDropdown = Components.createCustomDropdown(
            mapOptions,
            '-- Select Map --',
            (value, option) => {
                if (option && option.data) {
                    selectedMap = option.data;
                } else {
                    selectedMap = null;
                }
            }
        );
        
        formContainer.appendChild(mapDropdown);
        
        // Privacy Toggle
        const privacyLabel = document.createElement('div');
        privacyLabel.className = 'menu-item-title';
        privacyLabel.textContent = 'Match Privacy';
        privacyLabel.style.marginTop = '10px';
        privacyLabel.style.marginBottom = '8px';
        formContainer.appendChild(privacyLabel);
        
        const privacyContainer = document.createElement('div');
        privacyContainer.style.display = 'flex';
        privacyContainer.style.gap = '10px';
        
        const publicOption = Components.createMenuItem(
            '🌐 Public',
            'Anyone can join',
            () => {
                isPrivate = false;
                pinInputContainer.classList.remove('pin-input-visible');
                pinInputContainer.classList.add('pin-input-hidden');
                publicOption.style.backgroundColor = 'rgba(9, 135, 255, 0.2)';
                publicOption.style.border = '2px solid #0987ff';
                privateOption.style.backgroundColor = '';
                privateOption.style.border = '';
            }
        );
        publicOption.style.flex = '1';
        publicOption.style.textAlign = 'center';
        publicOption.style.padding = '12px';
        publicOption.style.cursor = 'pointer';
        publicOption.style.borderRadius = '4px';
        publicOption.style.backgroundColor = 'rgba(9, 135, 255, 0.2)';
        publicOption.style.border = '2px solid #0987ff';
        isPrivate = false; // Default to public
        
        const privateOption = Components.createMenuItem(
            '🔒 Private',
            'Requires PIN to join',
            () => {
                isPrivate = true;
                pinInputContainer.classList.remove('pin-input-hidden');
                pinInputContainer.classList.add('pin-input-visible');
                privateOption.style.backgroundColor = 'rgba(9, 135, 255, 0.2)';
                privateOption.style.border = '2px solid #0987ff';
                publicOption.style.backgroundColor = '';
                publicOption.style.border = '';
            }
        );
        privateOption.style.flex = '1';
        privateOption.style.textAlign = 'center';
        privateOption.style.padding = '12px';
        privateOption.style.cursor = 'pointer';
        privateOption.style.border = '2px solid rgba(255, 255, 255, 0.1)';
        privateOption.style.borderRadius = '4px';
        
        privacyContainer.appendChild(publicOption);
        privacyContainer.appendChild(privateOption);
        formContainer.appendChild(privacyContainer);
        
        // PIN Input (hidden by default)
        const pinInputContainer = document.createElement('div');
        pinInputContainer.className = 'pin-input-container pin-input-hidden';
        pinInputContainer.style.marginTop = '10px';
        
        const pinLabel = document.createElement('div');
        pinLabel.className = 'menu-item-title';
        pinLabel.textContent = 'PIN Code';
        pinLabel.style.marginBottom = '8px';
        pinInputContainer.appendChild(pinLabel);
        
        const pinInput = Components.createInput('Enter PIN (4-8 digits)', {
            type: 'text',
            maxLength: 8
        });
        pinInput.style.width = '100%';
        pinInput.style.padding = '10px';
        pinInput.style.marginBottom = '10px';
        pinInput.addEventListener('input', (e) => {
            // Only allow numbers
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            pinValue = e.target.value;
        });
        pinInputContainer.appendChild(pinInput);
        formContainer.appendChild(pinInputContainer);
        
        // Create Button
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginTop = '20px';
        
        const createBtn = Components.createButton('Create Match', () => {
            // Validation
            if (!selectedGameMode) {
                showError('Please select a game mode');
                return;
            }
            if (!selectedMap) {
                showError('Please select a map');
                return;
            }
            if (isPrivate && (!pinValue || pinValue.length < 4 || pinValue.length > 8)) {
                showError('Please enter a PIN (4-8 digits)');
                return;
            }
            
            // Submit
            MenuManager.hideAll();
            Utils.sendNuiCallback('createMatch', {
                gameModeId: selectedGameMode.id,
                mapId: selectedMap.id,
                isPrivate: isPrivate,
                pin: isPrivate ? pinValue : null
            });
        }, 'primary', {
            style: { flex: '1', padding: '12px' }
        });
        
        const cancelBtn = Components.createButton('Cancel', () => {
            MenuManager.hide(MENU_IDS.CREATE_MATCH);
            MenuManager.show(MENU_IDS.MAIN);
        }, 'secondary', {
            style: { flex: '1', padding: '12px' }
        });
        
        buttonContainer.appendChild(createBtn);
        buttonContainer.appendChild(cancelBtn);
        formContainer.appendChild(buttonContainer);
        
        content.appendChild(formContainer);
        MenuManager.show(MENU_IDS.CREATE_MATCH);
    },

    /**
     * Display match browser
     */
    displayMatchBrowser(matches, myMatchId) {
        const content = MenuManager.getContent(MENU_IDS.BROWSER);
        if (!content) return;
        
        content.innerHTML = '';
    
    if (!matches || matches.length === 0) {
            const empty = Components.createMenuItem('No active matches', '', null, { disabled: true });
        empty.style.textAlign = 'center';
        empty.style.padding = '20px';
            content.appendChild(empty);
    } else {
        matches.forEach(match => {
            const statusText = match.status === 'waiting' ? 'Waiting' : match.status === 'active' ? 'In Progress' : 'Ended';
            const statusColor = match.status === 'waiting' ? '#44ff44' : match.status === 'active' ? '#ff8844' : '#888888';
            const privacyText = match.isPrivate ? '🔒 Private' : '🌐 Public';
            const isMyMatch = myMatchId && match.id === myMatchId;
            
                const item = Components.createMenuItem(
                    `${match.gameMode} - ${match.map}`,
                    `${privacyText} | Players: ${match.players}/${match.maxPlayers}`,
                    isMyMatch || (match.status === 'active' && !match.allowJoinInProgress) ? null : () => {
                    if (match.isPrivate) {
                            DialogManager.showPIN(match.id);
                    } else {
                            MatchManager.joinMatch(match.id, null);
                        }
                    },
                    {
                        disabled: isMyMatch || (match.status === 'active' && !match.allowJoinInProgress),
                        style: isMyMatch ? { opacity: '0.5', filter: 'grayscale(100%)' } : {},
                    }
                );
                
                const titleEl = item.querySelector('.menu-item-title');
                if (titleEl) {
                    const statusSpan = document.createElement('span');
                    statusSpan.innerHTML = isMyMatch 
                        ? ` <span style="color: #888888; font-size: 11px;">[Your Match]</span>`
                        : ` <span style="color: ${statusColor}; font-size: 12px;">[${statusText}]</span>`;
                    titleEl.appendChild(statusSpan);
                }
                
                content.appendChild(item);
            });
        }
        
        MenuManager.show(MENU_IDS.BROWSER);
    },

    /**
     * Display weapon selection
     */
    displayWeaponSelection(categories, weapons, forMatch) {
        const content = MenuManager.getContent(MENU_IDS.WEAPON);
        if (!content) return;
        
        content.innerHTML = '';
    
    // Group weapons by category
    const weaponsByCategory = {};
    categories.forEach(cat => {
        if (cat.enabled) {
                weaponsByCategory[cat.id] = { category: cat, weapons: [] };
        }
    });
    
    weapons.forEach(weapon => {
        if (weapon.enabled && weaponsByCategory[weapon.category]) {
            weaponsByCategory[weapon.category].weapons.push(weapon);
        }
    });
    
    // Display by category
    Object.values(weaponsByCategory).forEach(catData => {
        if (catData.weapons.length === 0) return;
        
            const categoryHeader = Components.createMenuItem(
                catData.category.name,
                '',
                null,
                { style: { background: 'rgba(9, 135, 255, 0.2)', cursor: 'default', fontWeight: '600' } }
            );
            content.appendChild(categoryHeader);
        
        catData.weapons.forEach(weapon => {
            const item = Components.createMenuItem(
                weapon.name,
                forMatch ? `Select ${weapon.name} for this match` : `Set ${weapon.name} as your weapon preference`,
                () => {
                    // Selecting weapon closes UI - release focus
                    MenuManager.isNavigating = false;
                    MenuManager.hideAll();
                    Utils.sendNuiCallback('setPlayerWeapon', { weaponHash: weapon.hash });
                }
            );
            content.appendChild(item);
        });
    });
    
        // Clear navigation flag when weapon selection is shown (navigation complete)
        MenuManager.isNavigating = false;
        MenuManager.show(MENU_IDS.WEAPON);
    },

    /**
     * Display match settings (private/public)
     */
    displayMatchSettings(gameModeId, mapId) {
        const content = MenuManager.getContent(MENU_IDS.WEAPON);
        if (!content) return;
        
        content.innerHTML = '';
        
        MatchManager.selectedData = { gameModeId, mapId };
        
        const privateOption = Components.createMenuItem(
        'Create Private Match',
        'Require a PIN to join',
            () => DialogManager.showPINInput((pin) => MatchManager.createMatch(true, pin))
        );
        
        const publicOption = Components.createMenuItem(
            'Create Public Match',
            'Anyone can join',
            () => MatchManager.createMatch(false, null)
        );
        
        content.appendChild(privateOption);
        content.appendChild(publicOption);
        MenuManager.show(MENU_IDS.WEAPON);
    },

    /**
     * Display editor main menu
     */
    displayEditorMainMenu() {
        const content = MenuManager.getContent(MENU_IDS.EDITOR_MAIN);
        if (!content) return;
        
        content.innerHTML = '';
        
        const items = [
            { title: 'Create New Map', description: 'Start creating a new map from scratch', action: 'createNewMap' },
            { title: 'Edit Existing Map', description: 'Load and edit an existing map', action: 'editMap' },
            { title: 'Delete Map', description: 'Delete an existing map', action: 'deleteMap' },
        ];
        
        items.forEach(itemData => {
            const item = Components.createMenuItem(
                itemData.title,
                itemData.description,
        () => {
                    if (['createNewMap', 'editMap', 'deleteMap'].includes(itemData.action)) {
                        // "Edit Map" and "Delete Map" navigate to maps menu - set navigation flag
                        // "Create New Map" closes UI to start editor - don't set navigation flag
                        if (itemData.action === 'editMap' || itemData.action === 'deleteMap') {
                            MenuManager.isNavigating = true;
                            MenuManager.hide(MENU_IDS.EDITOR_MAIN, { checkFocusRelease: false });
                        } else {
                            // Create New Map - closes UI, release focus
                            MenuManager.isNavigating = false;
                            MenuManager.hide(MENU_IDS.EDITOR_MAIN);
                        }
                    }
                    Utils.sendNuiCallback('editorMainAction', { action: itemData.action });
                }
            );
            content.appendChild(item);
        });
        
        MenuManager.show(MENU_IDS.EDITOR_MAIN);
    },

    /**
     * Display editor menu
     */
    displayEditorMenu(menuData) {
        const content = MenuManager.getContent(MENU_IDS.EDITOR);
        if (!content) return;
        
        content.innerHTML = '';
        
        if (menuData.isEditing && menuData.mapName) {
            const infoItem = Components.createMenuItem(
                `Editing: ${menuData.mapName}`,
                `Radius: ${menuData.radius.toFixed(1)}m`,
                null,
                { style: { background: 'rgba(0, 255, 0, 0.2)', cursor: 'default', marginBottom: '12px' } }
            );
            content.appendChild(infoItem);
        }
        
        const items = [
            { title: 'Set Center Point', description: 'Aim and place the center point of the map', action: 'setCenter' },
            { title: 'Add Spawn Point', description: 'Aim and place a spawn point', action: 'addSpawn' },
            { title: 'View All Spawns', description: menuData.spawnCount ? `View and manage ${menuData.spawnCount} spawn point${menuData.spawnCount !== 1 ? 's' : ''}` : 'View all spawn points', action: 'viewSpawns' },
            { title: 'Clear Map', description: 'Clear all map data (center, spawns)', action: 'clearMap' },
            { title: 'Save Map', description: 'Save the current map', action: 'saveMap' },
            { title: 'Leave Editor', description: 'Exit the map editor', action: 'leaveEditor' },
        ];
        
        items.forEach(itemData => {
            const item = Components.createMenuItem(
                itemData.title,
                itemData.description,
                () => {
                    // Actions that navigate to other menus
                    if (itemData.action === 'addSpawn') {
                        // Navigating to team selection
                        MenuManager.isNavigating = true;
                        MenuManager.hide(MENU_IDS.EDITOR, { checkFocusRelease: false });
                    } else if (itemData.action === 'viewSpawns') {
                        // Navigating to spawn viewer
                        MenuManager.isNavigating = true;
                        MenuManager.hide(MENU_IDS.EDITOR, { checkFocusRelease: false });
                    } else if (itemData.action === 'clearMap') {
                        // Clear Map closes UI completely - release focus
                        MenuManager.isNavigating = false;
                        MenuManager.hideAll();
                    } else if (itemData.action === 'saveMap') {
                        // Client will handle focus management for saveMap
                        // Just hide the menu - don't set navigation flag here
                        // The client will send hideMenu and manage focus explicitly
                        MenuManager.hide(MENU_IDS.EDITOR, { checkFocusRelease: false });
                } else {
                        // Actions that close UI (setCenter, leaveEditor)
                        MenuManager.isNavigating = false;
                        MenuManager.hide(MENU_IDS.EDITOR);
                    }
                    Utils.sendNuiCallback('editorAction', { action: itemData.action });
                }
            );
            content.appendChild(item);
        });
        
        // Clear navigation flag when editor menu is shown (navigation complete)
        MenuManager.isNavigating = false;
        MenuManager.show(MENU_IDS.EDITOR);
    },

    /**
     * Display team menu
     */
    displayTeamMenu() {
        const content = MenuManager.getContent(MENU_IDS.TEAM);
        if (!content) return;
        
        content.innerHTML = '';
        
        const teams = [
            { title: 'No Team / FFA', value: null },
            { title: 'Team 1', value: 1 },
            { title: 'Team 2', value: 2 },
        ];
        
        teams.forEach(team => {
            const item = Components.createMenuItem(
                team.title,
                team.value ? `Assign spawn to ${team.title}` : 'Free for all spawn point',
                () => {
                    // Selecting team closes UI to start placing spawn - release focus
                    MenuManager.isNavigating = false;
                    MenuManager.hide(MENU_IDS.TEAM);
                    Utils.sendNuiCallback('selectTeam', { team: team.value });
                }
            );
            content.appendChild(item);
        });
        
        MenuManager.show(MENU_IDS.TEAM);
    },

    /**
     * Display spawn viewer menu
     */
    displaySpawnViewer(data) {
        const content = MenuManager.getContent(MENU_IDS.SPAWN_VIEWER);
        if (!content) return;
        
        content.innerHTML = '';
        
        // Display statistics
        const stats = data.stats || { total: 0, team1: 0, team2: 0, ffa: 0 };
        const statsDiv = document.createElement('div');
        statsDiv.style.cssText = 'background: rgba(0, 100, 200, 0.2); padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid rgba(0, 150, 255, 0.3);';
        statsDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="color: #fff; font-size: 16px;">Spawn Statistics</strong>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 14px;">
                <div style="color: #fff;">Total: <span style="color: #4CAF50; font-weight: bold;">${stats.total}</span></div>
                <div style="color: #fff;">Team 1: <span style="color: #FF4444; font-weight: bold;">${stats.team1}</span></div>
                <div style="color: #fff;">Team 2: <span style="color: #4CAF50; font-weight: bold;">${stats.team2}</span></div>
                <div style="color: #fff;">FFA: <span style="color: #44AAFF; font-weight: bold;">${stats.ffa}</span></div>
            </div>
        `;
        content.appendChild(statsDiv);
        
        // Display spawns list
        const spawns = data.spawns || [];
        if (spawns.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.style.cssText = 'text-align: center; padding: 20px; color: #999;';
            emptyDiv.textContent = 'No spawns available';
            content.appendChild(emptyDiv);
        } else {
            spawns.forEach(spawn => {
                const spawnItem = document.createElement('div');
                spawnItem.style.cssText = 'background: rgba(255, 255, 255, 0.05); padding: 12px; border-radius: 6px; margin-bottom: 8px; border: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center;';
                
                const spawnInfo = document.createElement('div');
                spawnInfo.style.cssText = 'flex: 1;';
                spawnInfo.innerHTML = `
                    <div style="color: #fff; font-weight: bold; margin-bottom: 4px;">Spawn #${spawn.index}</div>
                    <div style="color: #aaa; font-size: 12px;">
                        Type: <span style="color: ${spawn.team === 1 ? '#FF4444' : spawn.team === 2 ? '#4CAF50' : '#44AAFF'}">${spawn.type}</span>
                    </div>
                    <div style="color: #888; font-size: 11px; margin-top: 4px;">
                        X: ${spawn.x.toFixed(2)} | Y: ${spawn.y.toFixed(2)} | Z: ${spawn.z.toFixed(2)}
                    </div>
                `;
                
                const teleportBtn = document.createElement('button');
                teleportBtn.textContent = 'Teleport';
                teleportBtn.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; transition: all 0.3s; margin-left: 12px;';
                teleportBtn.onmouseover = function() { this.style.transform = 'scale(1.05)'; this.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)'; };
                teleportBtn.onmouseout = function() { this.style.transform = 'scale(1)'; this.style.boxShadow = 'none'; };
                teleportBtn.onclick = function() {
                    Utils.sendNuiCallback('teleportToSpawn', { spawnIndex: spawn.index });
                };
                
                spawnItem.appendChild(spawnInfo);
                spawnItem.appendChild(teleportBtn);
                content.appendChild(spawnItem);
            });
        }
        
        // Add back button
        const backBtn = document.createElement('button');
        backBtn.textContent = '← Back to Editor';
        backBtn.style.cssText = 'width: 100%; background: rgba(255, 255, 255, 0.1); color: white; border: 1px solid rgba(255, 255, 255, 0.2); padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 12px; transition: all 0.3s;';
        backBtn.onmouseover = function() { this.style.background = 'rgba(255, 255, 255, 0.2)'; };
        backBtn.onmouseout = function() { this.style.background = 'rgba(255, 255, 255, 0.1)'; };
        backBtn.onclick = function() {
            Utils.sendNuiCallback('closeSpawnViewer', {});
        };
        content.appendChild(backBtn);
        
        // Clear navigation flag when spawn viewer is shown (navigation complete)
        MenuManager.isNavigating = false;
        MenuManager.show(MENU_IDS.SPAWN_VIEWER);
    },

    /**
     * Display admin dashboard
     */
    displayAdminDashboard(data) {
        const menu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
        if (!menu) {
            console.error('Dashboard menu not found');
            return;
        }

        // Store current data for refresh (preserve isOwner status)
        menu._dashboardData = data || {};
        // Ensure isOwner is always preserved and explicitly set as boolean
        if (data) {
            // Convert truthy values (1, "true", true) to boolean true
            menu._dashboardData.isOwner = !!(data.isOwner === true || data.isOwner === 1 || data.isOwner === 'true' || data.isOwner);
        }

        // Setup tab switching (only if not already set up)
        const tabs = menu.querySelectorAll('.dashboard-tab');
        const tabContents = menu.querySelectorAll('.dashboard-tab-content');
        
        if (tabs.length === 0 || tabContents.length === 0) {
            console.error('Dashboard tabs or content not found', { 
                tabs: tabs.length, 
                contents: tabContents.length,
                menuHTML: menu.innerHTML.substring(0, 500)
            });
            // Try to recreate the dashboard structure
            const contentWrapper = menu.querySelector('.dashboard-content-wrapper');
            if (!contentWrapper) {
                console.error('Dashboard content wrapper not found, menu structure may be incorrect');
            }
            return;
        }
        
        if (!menu._tabsInitialized) {
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    // Prevent clicking on licenses tab if not owner
                    const targetTab = tab.getAttribute('data-tab');
                    if (targetTab === 'licenses') {
                        // Always check stored dashboard data for owner status (most up-to-date)
                        // Handle both boolean true and truthy values (1, "true", etc.)
                        const storedIsOwner = menu._dashboardData && 
                            (menu._dashboardData.isOwner === true || menu._dashboardData.isOwner === 1 || menu._dashboardData.isOwner === 'true' || !!menu._dashboardData.isOwner);
                        if (!storedIsOwner) {
                            return; // Don't allow non-owners to click licenses tab
                        }
                    }
                    
                    menu._currentTab = targetTab;
                    
                    // Update active tab
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    
                    // Update active content
                    tabContents.forEach(content => {
                        content.classList.remove('active');
                        if (content.getAttribute('data-tab-content') === targetTab) {
                            content.classList.add('active');
                        }
                    });
                    
                    // Refresh content for the selected tab
                    if (menu._dashboardData) {
                        this.refreshDashboardTab(targetTab, menu._dashboardData);
                    }
                });
            });
            menu._tabsInitialized = true;
        }

        // Grey out License Management tab for non-owners
        // Check owner status from current data or stored dashboard data
        // Handle both boolean true and truthy values (1, "true", etc.)
        const dataIsOwner = data && (data.isOwner === true || data.isOwner === 1 || data.isOwner === 'true' || !!data.isOwner);
        const storedIsOwner = menu._dashboardData && (menu._dashboardData.isOwner === true || menu._dashboardData.isOwner === 1 || menu._dashboardData.isOwner === 'true' || !!menu._dashboardData.isOwner);
        const isOwner = dataIsOwner || storedIsOwner;
        const licensesTab = Array.from(tabs).find(tab => tab.getAttribute('data-tab') === 'licenses');
        
        if (licensesTab) {
            if (isOwner) {
                licensesTab.style.opacity = '1';
                licensesTab.style.pointerEvents = 'auto';
                licensesTab.style.cursor = 'pointer';
                licensesTab.style.filter = 'none';
                licensesTab.disabled = false;
                licensesTab.classList.remove('disabled');
            } else {
                licensesTab.style.opacity = '0.5';
                licensesTab.style.pointerEvents = 'none';
                licensesTab.style.cursor = 'not-allowed';
                licensesTab.style.filter = 'grayscale(100%)';
                licensesTab.disabled = true;
                licensesTab.classList.add('disabled');
            }
        }
        
        // Set default tab or preserve current tab (but not licenses if not owner)
        let defaultTab = (data && data.defaultTab) || menu._currentTab || 'maps';
        if (defaultTab === 'licenses' && !isOwner) {
            defaultTab = 'maps'; // Fallback to maps if trying to open licenses tab as non-owner
        }
        menu._currentTab = defaultTab;
        
        // Activate the correct tab
        tabs.forEach(tab => {
            const tabName = tab.getAttribute('data-tab');
            if (tabName === defaultTab && tab.style.display !== 'none') {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // Activate the correct content
        tabContents.forEach(content => {
            if (content.getAttribute('data-tab-content') === defaultTab) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // Refresh content for the active tab
        this.refreshDashboardTab(defaultTab, menu._dashboardData);

        MenuManager.show(MENU_IDS.ADMIN_DASHBOARD);
    },

    /**
     * Refresh dashboard tab content
     */
    refreshDashboardTab(tabName, data) {
        const menu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
        if (!menu) {
            console.error('Dashboard menu not found for refresh');
            return;
        }

        const content = menu.querySelector(`[data-tab-content="${tabName}"]`);
        if (!content) {
            console.error(`Dashboard tab content not found for: ${tabName}`);
            return;
        }

        content.innerHTML = '';

        if (!data) {
            console.warn('No data provided for dashboard refresh');
            return;
        }
        
        // Update licenses tab styling based on owner status when refreshing
        if (tabName === 'licenses' || data.isOwner !== undefined) {
            // Handle both boolean true and truthy values (1, "true", etc.)
            const isOwner = data && (data.isOwner === true || data.isOwner === 1 || data.isOwner === 'true' || !!data.isOwner);
            const licensesTab = menu.querySelector('.dashboard-tab[data-tab="licenses"]');
            if (licensesTab) {
                if (isOwner) {
                    licensesTab.style.opacity = '1';
                    licensesTab.style.pointerEvents = 'auto';
                    licensesTab.style.cursor = 'pointer';
                    licensesTab.style.filter = 'none';
                    licensesTab.disabled = false;
                    licensesTab.classList.remove('disabled');
                } else {
                    licensesTab.style.opacity = '0.5';
                    licensesTab.style.pointerEvents = 'none';
                    licensesTab.style.cursor = 'not-allowed';
                    licensesTab.style.filter = 'grayscale(100%)';
                    licensesTab.disabled = true;
                    licensesTab.classList.add('disabled');
                }
            }
        }

        if (tabName === 'maps') {
            this.displayDashboardMaps(content, data.maps || []);
        } else         if (tabName === 'weapons') {
            // Update weapon list for weapon existence checking
            WeaponConfigManager.currentWeaponsList = data.weapons || [];
            this.displayDashboardWeapons(content, data.weapons || [], data.categories || []);
        } else if (tabName === 'matches') {
            this.displayDashboardMatches(content, data.matches || []);
        } else if (tabName === 'licenses') {
            this.displayDashboardLicenses(content, data.licenses || [], data.isOwner || false);
        }
    },

    /**
     * Display maps section in dashboard
     */
    displayDashboardMaps(content, maps) {
        // Add Create Map button
        const createBtn = Components.createButton('+ Create New Map', () => {
            MenuManager.hide(MENU_IDS.ADMIN_DASHBOARD);
            Utils.sendNuiCallback('editorMainAction', { action: 'createNewMap' });
        }, 'primary', { style: { width: '100%', marginBottom: '16px' } });
        content.appendChild(createBtn);

        if (!maps || maps.length === 0) {
            const item = Components.createMenuItem(
                'No maps available',
                'Create your first map using the map editor',
                null,
                { disabled: true, style: { cursor: 'default', opacity: '0.6' } }
            );
            content.appendChild(item);
        } else {
            maps.forEach(map => {
                const item = document.createElement('div');
                item.className = 'menu-item';
                item.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

                const left = document.createElement('div');
                left.innerHTML = `
                    <div style="font-weight: 600;">${map.name}</div>
                    <div style="font-size: 11px; color: #888;">Spawns: ${map.spawns.length} | Radius: ${map.radius.toFixed(1)}m</div>
                `;

                const right = document.createElement('div');
                right.style.cssText = 'display: flex; gap: 8px; align-items: center;';

                // Preview image URL button
                const previewBtn = Components.createButton('📷 Preview', () => {
                    // Use saved previewImage if it exists, otherwise use filler text
                    const currentValue = map.previewImage || 'https://example.com/map-preview.png';
                    DialogManager.showDialog(
                        'Enter Preview Image URL',
                        'https://example.com/map-preview.png', // Placeholder text
                        (url) => {
                            if (url) {
                                // Validate URL ends with .png or .jpg
                                const urlLower = url.toLowerCase().trim();
                                if (!urlLower.endsWith('.png') && !urlLower.endsWith('.jpg') && !urlLower.endsWith('.jpeg')) {
                                    DialogManager.showError('URL must end with .png, .jpg, or .jpeg');
                                    return;
                                }
                                
                                // Basic URL validation
                                try {
                                    new URL(url);
                                } catch (e) {
                                    DialogManager.showError('Invalid URL format');
                                    return;
                                }
                                
                                Utils.sendNuiCallback('setMapPreviewImage', { 
                                    mapId: map.id, 
                                    previewImage: url.trim()
                                }).then(() => {
                                    // Refresh dashboard
                                    const menu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
                                    const currentTab = menu?._currentTab || 'maps';
                                    Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
                                });
                            }
                        },
                        { value: currentValue } // Pass the current value to auto-fill the input
                    );
                }, 'secondary', { 
                    style: { 
                        padding: '6px 12px', 
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    } 
                });

                // Context menu with Rename, Edit Map, Delete
                const contextMenu = Components.createContextMenu([
                    {
                        label: 'Rename',
                        onClick: () => {
                            DialogManager.showDialog(
                                'Rename Map',
                                'Enter new map name',
                                (newName) => {
                                    if (newName && newName.trim()) {
                                        const menu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
                                        const currentTab = menu?._currentTab || 'maps';
                                        Utils.sendNuiCallback('renameMap', { 
                                            mapId: map.id, 
                                            newName: newName.trim(),
                                            fromDashboard: true
                                        }).then(() => {
                                            // Refresh dashboard preserving current tab
                                            Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
                                        });
                                    }
                                },
                                { value: map.name }
                            );
                        }
                    },
                    {
                        label: 'Edit Map',
                        onClick: () => {
                            MenuManager.hide(MENU_IDS.ADMIN_DASHBOARD);
                            Utils.sendNuiCallback('loadMapForEdit', { mapId: map.id });
                        }
                    },
                    {
                        label: 'Delete',
                        danger: true,
                        onClick: () => {
                            DialogManager.showConfirm(
                                `Are you sure you want to delete map "${map.name}"?\n\nThis action cannot be undone.`,
                                () => {
                                    // Hide confirm dialog without releasing focus (dashboard is still open)
                                    MenuManager.hide(MENU_IDS.CONFIRM, { checkFocusRelease: false });
                                    const menu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
                                    const currentTab = menu?._currentTab || 'maps';
                                    // Mark as from dashboard to prevent focus release
                                    Utils.sendNuiCallback('deleteMap', { mapId: map.id, fromDashboard: true }).then(() => {
                                        // Refresh dashboard preserving current tab
                                        Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
                                    });
                                }
                            );
                        }
                    }
                ]);

                right.appendChild(previewBtn);
                right.appendChild(contextMenu.container);

                item.appendChild(left);
                item.appendChild(right);
                content.appendChild(item);
            });
        }
    },

    /**
     * Display weapons section in dashboard
     */
    displayDashboardWeapons(content, weapons, categories) {
        // Add Weapon button
        const addWepBtn = Components.createButton('+ Add Weapon', () => {
            WeaponConfigManager.showAddWeaponDialog(categories);
        }, 'primary', { style: { width: '100%', marginBottom: '16px' } });
        content.appendChild(addWepBtn);

        if (weapons.length === 0) {
            const item = Components.createMenuItem(
                'No weapons yet',
                'Add weapons using the button above',
                null,
                { disabled: true, style: { opacity: '0.6', cursor: 'default' } }
            );
            content.appendChild(item);
        } else {
            weapons.forEach(weapon => {
                const item = document.createElement('div');
                item.className = 'menu-item';
                item.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

                const left = document.createElement('div');
                left.innerHTML = `
                    <div style="font-weight: 600;">${weapon.name}</div>
                    <div style="font-size: 11px; color: #888;">${weapon.category} | Hash: ${weapon.hash}</div>
                `;

                const right = document.createElement('div');
                right.style.cssText = 'display: flex; gap: 8px; align-items: center;';

                const toggle = Components.createButton(
                    weapon.enabled ? 'Enabled' : 'Disabled',
                    (e) => {
                        e.stopPropagation();
                        const newState = !weapon.enabled;
                        weapon.enabled = newState;
                        toggle.textContent = newState ? 'Enabled' : 'Disabled';
                        toggle.className = newState ? 'btn-primary' : 'btn-secondary';
                        Utils.sendNuiCallback('updateWeaponConfig', {
                            type: 'weapon',
                            hash: weapon.hash,
                            enabled: newState,
                        }).then(() => {
                            // Refresh dashboard after update to get latest data
                            const menu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
                            if (menu && menu.classList.contains('active')) {
                                const currentTab = menu._currentTab || 'weapons';
                                setTimeout(() => {
                                    Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
                                }, 300);
                            }
                        });
                    },
                    weapon.enabled ? 'primary' : 'secondary',
                    { style: { padding: '6px 12px', fontSize: '12px' } }
                );

                const removeBtn = Components.createButton(
                    'Remove',
                    (e) => {
                        e.stopPropagation();
                        DialogManager.showConfirm(
                            `Are you sure you want to remove weapon "${weapon.name}"?`,
                            () => {
                                MenuManager.hide(MENU_IDS.CONFIRM);
                                const menu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
                                const currentTab = menu?._currentTab || 'weapons';
                                Utils.sendNuiCallback('removeWeapon', { hash: weapon.hash }).then(() => {
                                    setTimeout(() => {
                                        Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
                                    }, 300);
                                });
                            }
                        );
                    },
                    'secondary',
                    {
                        style: {
                            padding: '6px 12px',
                            fontSize: '12px',
                            background: 'rgba(255, 68, 68, 0.2)',
                            borderColor: '#ff4444',
                            color: '#ff4444',
                        },
                    }
                );

                right.appendChild(toggle);
                right.appendChild(removeBtn);

                item.appendChild(left);
                item.appendChild(right);
                content.appendChild(item);
            });
        }
    },

    /**
     * Display matches section in dashboard
     */
    displayDashboardMatches(content, matches) {
        if (!matches || matches.length === 0) {
            const item = Components.createMenuItem(
                'No active matches',
                'There are currently no active paintball matches',
                null,
                { disabled: true, style: { cursor: 'default', opacity: '0.6' } }
            );
            content.appendChild(item);
        } else {
            matches.forEach(match => {
                const statusColor = match.status === 'active' ? '#00ff00' : '#ffff00';
                const statusText = match.status === 'active' ? 'Active' : 'Waiting';
                
                // Create match header
                const matchHeader = document.createElement('div');
                matchHeader.className = 'menu-item';
                matchHeader.style.cssText = 'margin-bottom: 8px;';
                
                const headerContent = document.createElement('div');
                headerContent.style.cssText = 'width: 100%;';
                
                const titleRow = document.createElement('div');
                titleRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';
                
                const title = document.createElement('div');
                title.style.cssText = 'font-weight: 600; font-size: 16px;';
                title.textContent = `${match.gameMode} - ${match.map}`;
                
                const statusBadge = document.createElement('span');
                statusBadge.textContent = statusText;
                statusBadge.style.cssText = `color: ${statusColor}; font-size: 12px; font-weight: 600;`;
                
                titleRow.appendChild(title);
                titleRow.appendChild(statusBadge);
                
                const infoRow = document.createElement('div');
                infoRow.style.cssText = 'font-size: 12px; color: #888; margin-bottom: 8px;';
                infoRow.textContent = `Players: ${match.players}/${match.maxPlayers} | Bucket: ${match.bucket}`;
                
                headerContent.appendChild(titleRow);
                headerContent.appendChild(infoRow);
                
                // Player list
                if (match.playerDetails && match.playerDetails.length > 0) {
                    const playersHeader = document.createElement('div');
                    playersHeader.style.cssText = 'font-size: 11px; color: #aaa; margin-top: 8px; margin-bottom: 4px; font-weight: 600;';
                    playersHeader.textContent = 'Players:';
                    headerContent.appendChild(playersHeader);
                    
                    match.playerDetails.forEach(player => {
                        const playerItem = document.createElement('div');
                        playerItem.style.cssText = 'font-size: 11px; color: #ccc; padding: 4px 0; padding-left: 12px;';
                        playerItem.textContent = `${player.name} (ID: ${player.id}) - ${player.identifier}`;
                        headerContent.appendChild(playerItem);
                    });
                }
                
                matchHeader.appendChild(headerContent);
                content.appendChild(matchHeader);
                
                // Close match button
                const closeBtn = Components.createButton('Close Match', () => {
                    DialogManager.showConfirm(
                        `Are you sure you want to close this match?\n\nGame Mode: ${match.gameMode}\nMap: ${match.map}\nPlayers: ${match.players}/${match.maxPlayers}`,
                        () => {
                            MenuManager.hide(MENU_IDS.CONFIRM, { checkFocusRelease: false });
                            MenuManager.isNavigating = true;
                            const menu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
                            const currentTab = menu?._currentTab || 'matches';
                            // Mark as from dashboard
                            Utils.sendNuiCallback('adminCloseMatch', { matchId: match.id, fromDashboard: true }).then(() => {
                                // Dashboard will be refreshed by the callback, but refresh again to ensure latest data
                                setTimeout(() => {
                                    Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
                                }, 300);
                            });
                        }
                    );
                }, 'secondary', {
                    style: {
                        width: '100%',
                        marginBottom: '16px',
                        background: 'rgba(255, 68, 68, 0.2)',
                        borderColor: '#ff4444',
                        color: '#ff4444',
                    },
                });
                content.appendChild(closeBtn);
            });
        }
    },

    /**
     * Display licenses section in dashboard
     */
    displayDashboardLicenses(content, licenses, isOwner) {
        // Store licenses for use in search dialog
        this._currentLicenses = licenses || [];
        // Info header
        const infoHeader = document.createElement('div');
        infoHeader.style.cssText = 'padding: 12px; margin-bottom: 16px; background: rgba(9, 135, 255, 0.1); border-radius: 8px; border: 1px solid rgba(9, 135, 255, 0.3);';
        infoHeader.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">License Management</div>
            <div style="font-size: 12px; color: #aaa;">
                ${isOwner 
                    ? 'You are the owner. You can add and remove licenses that will have admin access to the dashboard.' 
                    : 'You can view allowed licenses, but only the owner can manage them.'}
            </div>
        `;
        content.appendChild(infoHeader);

        // Add License button (only for owner) - opens search dialog
        if (isOwner) {
            const addLicenseBtn = Components.createButton('+ Add License', () => {
                this.showPlayerSearchDialog();
            }, 'primary', { style: { width: '100%', marginBottom: '16px' } });
            content.appendChild(addLicenseBtn);
        }

        if (!licenses || licenses.length === 0) {
            const item = Components.createMenuItem(
                'No licenses added',
                isOwner ? 'Add licenses using the button above' : 'No licenses have been added yet',
                null,
                { disabled: true, style: { cursor: 'default', opacity: '0.6' } }
            );
            content.appendChild(item);
        } else {
            licenses.forEach(licenseData => {
                const license = licenseData.license || licenseData;
                const cfxName = licenseData.cfxName;
                const displayName = cfxName || license;
                
                const item = document.createElement('div');
                item.className = 'menu-item';
                item.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
                
                if (!isOwner) {
                    item.style.opacity = '0.6';
                    item.style.filter = 'grayscale(50%)';
                }

                const left = document.createElement('div');
                left.innerHTML = `
                    <div style="font-weight: 600;">${displayName}</div>
                    <div style="font-size: 11px; color: #888;">${cfxName ? license : 'Has admin access to dashboard'}</div>
                `;

                const right = document.createElement('div');
                right.style.cssText = 'display: flex; gap: 8px; align-items: center;';

                if (isOwner) {
                    const removeBtn = Components.createButton('Remove', () => {
                        DialogManager.showConfirm(
                            `Are you sure you want to remove this license?\n\n${cfxName ? `CFX: ${cfxName}\n` : ''}License: ${license}\n\nThis will revoke their admin access.`,
                            () => {
                                MenuManager.hide(MENU_IDS.CONFIRM, { checkFocusRelease: false });
                                const menu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
                                const currentTab = menu?._currentTab || 'licenses';
                                Utils.sendNuiCallback('removeLicense', { license: license }).then(() => {
                                    setTimeout(() => {
                                        Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
                                    }, 300);
                                });
                            }
                        );
                    }, 'secondary', {
                        style: {
                            padding: '6px 12px',
                            fontSize: '12px',
                            background: 'rgba(255, 68, 68, 0.2)',
                            borderColor: '#ff4444',
                            color: '#ff4444',
                        },
                    });
                    right.appendChild(removeBtn);
                } else {
                    const lockedLabel = document.createElement('div');
                    lockedLabel.textContent = 'Owner Only';
                    lockedLabel.style.cssText = 'font-size: 11px; color: #888; font-style: italic;';
                    right.appendChild(lockedLabel);
                }

                item.appendChild(left);
                item.appendChild(right);
                content.appendChild(item);
            });
        }
    },

    /**
     * Show player search dialog for adding licenses
     */
    showPlayerSearchDialog() {
        const menu = MenuManager.get(MENU_IDS.PLAYER_SEARCH);
        if (!menu) {
            console.error("Player search menu not found");
            return;
        }

        const content = MenuManager.getContent(MENU_IDS.PLAYER_SEARCH);
        const titleEl = menu.querySelector('.paintball-title');
        const errorEl = menu.querySelector('.error-message') || content?.querySelector('.error-message');

        if (titleEl) titleEl.textContent = 'Search Players';
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }

        if (!content) {
            console.error("Player search content not found");
            return;
        }

        // Clear content except error
        content.innerHTML = '';
        if (errorEl && errorEl.parentElement === content) {
            content.appendChild(errorEl);
        }

        // Create search input container
        const searchContainer = document.createElement('div');
        searchContainer.style.cssText = 'width: 100%; margin-bottom: var(--spacing-lg);';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search by license identifier (min 2 characters)...';
        searchInput.className = 'dialog-input';
        searchInput.style.cssText = 'width: 100%; margin-bottom: var(--spacing-sm);';
        searchContainer.appendChild(searchInput);

        // Info text
        const infoText = document.createElement('div');
        infoText.style.cssText = 'font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: 0;';
        infoText.textContent = 'Search by license identifier (e.g., license:abc123 or abc123)';
        searchContainer.appendChild(infoText);

        // Results container
        const resultsList = document.createElement('div');
        resultsList.className = 'menu-list';
        resultsList.style.cssText = 'max-height: 400px; overflow-y: auto; overflow-x: hidden; width: 100%;';

        let searchTimeout = null;
        let currentResults = [];

        const performSearch = (searchTerm) => {
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }

            if (!searchTerm || searchTerm.trim().length < 2) {
                resultsList.innerHTML = '';
                currentResults = [];
                return;
            }

            searchTimeout = setTimeout(() => {
                if (errorEl) {
                    errorEl.textContent = '';
                    errorEl.style.display = 'none';
                }

                // Show loading state
                resultsList.innerHTML = '<div style="text-align: center; padding: var(--spacing-xl); color: var(--color-text-tertiary);">Searching...</div>';

                Utils.sendNuiCallback('searchPlayers', { searchTerm: searchTerm.trim() })
                    .then(res => res.json())
                    .then((response) => {
                        if (response.error) {
                            if (errorEl) {
                                errorEl.textContent = response.error;
                                errorEl.style.display = 'block';
                            }
                            resultsList.innerHTML = '';
                            currentResults = [];
                            return;
                        }

                        currentResults = response.players || [];
                        resultsList.innerHTML = '';

                        if (currentResults.length === 0) {
                            const empty = Components.createMenuItem('No players found', 'Try a different search term', null, {
                                disabled: true,
                                style: { textAlign: 'center', padding: '20px' },
                            });
                            resultsList.appendChild(empty);
                        } else {
                            const currentLicenses = this._currentLicenses || [];
                            currentResults.forEach((player) => {
                                // Check if license is already added (handle both old string format and new object format)
                                const isAlreadyAdded = currentLicenses.some(lic => {
                                    const licValue = typeof lic === 'string' ? lic : lic.license;
                                    return licValue === player.license;
                                });
                                const statusColor = isAlreadyAdded
                                    ? 'var(--color-text-tertiary)'
                                    : player.online
                                    ? 'var(--color-success)'
                                    : 'var(--color-error)';
                                const statusText = isAlreadyAdded
                                    ? 'Already Added'
                                    : player.online
                                    ? 'Online'
                                    : 'Offline';

                                // Display CFX name if available, otherwise show license
                                const displayName = player.cfxName || player.license

                                const item = Components.createMenuItem(
                                    displayName,
                                    `<span style="color: ${statusColor};">${statusText}</span>`,
                                    isAlreadyAdded
                                        ? null
                                        : () => {
                                              // Add license
                                              Utils.sendNuiCallback('addLicense', { license: player.license })
                                                  .then(() => {
                                                      // Close search dialog without releasing focus (dashboard stays open)
                                                      MenuManager.hide(MENU_IDS.PLAYER_SEARCH, { checkFocusRelease: false });
                                                      // Refresh dashboard to show new license
                                                      const dashboardMenu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
                                                      if (dashboardMenu && dashboardMenu.classList.contains('active')) {
                                                          const currentTab = dashboardMenu._currentTab || 'licenses';
                                                          setTimeout(() => {
                                                              Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
                                                          }, 300);
                                                      }
                                                  });
                                          },
                                    {
                                        disabled: isAlreadyAdded,
                                        style: isAlreadyAdded
                                            ? { opacity: '0.5', cursor: 'not-allowed', filter: 'grayscale(100%)', pointerEvents: 'none' }
                                            : {},
                                    }
                                );

                                // Add additional info - License and status
                                const itemEl = item;
                                const descEl = itemEl.querySelector('.menu-item-description');
                                if (descEl) {
                                    let descHtml = '';
                                    if (player.cfxName) {
                                        descHtml += `<div style="margin-bottom: 4px; word-break: break-all; font-size: var(--font-size-xs); color: var(--color-text-secondary);">${player.license}</div>`;
                                    }
                                    descHtml += `<div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); line-height: 1.4;"><span style="color: ${statusColor};">${player.online ? '●' : '○'}</span> ${statusText}</div>`;
                                    descEl.innerHTML = descHtml;
                                }

                                resultsList.appendChild(item);
                            });
                        }
                    })
                    .catch((error) => {
                        console.error('Search error:', error);
                        if (errorEl) {
                            errorEl.textContent = 'Failed to search. Please try again.';
                            errorEl.style.display = 'block';
                        }
                        resultsList.innerHTML = '';
                        currentResults = [];
                    });
            }, 300); // Debounce search
        };

        searchInput.addEventListener('input', (e) => {
            performSearch(e.target.value);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                MenuManager.hide(MENU_IDS.PLAYER_SEARCH, { checkFocusRelease: false });
            }
        });

        // Cancel button
        const cancelBtn = Components.createButton('Cancel', () => {
            MenuManager.hide(MENU_IDS.PLAYER_SEARCH, { checkFocusRelease: false });
        }, 'secondary', { style: { width: '100%', marginTop: '12px' } });

        content.appendChild(searchContainer);
        content.appendChild(resultsList);
        content.appendChild(cancelBtn);

        // Set navigation flag to prevent focus release
        MenuManager.isNavigating = true;
        MenuManager.show(MENU_IDS.PLAYER_SEARCH);
        
        // Focus input after a short delay
        setTimeout(() => {
            searchInput.focus();
        }, 100);
    },
};

// ============================================================================
// DIALOG MANAGER
// ============================================================================
const DialogManager = {
    /**
     * Show dialog
     */
    showDialog(title, placeholder, callback, options = {}) {
        const menu = MenuManager.get(MENU_IDS.DIALOG);
        if (!menu) return;
        
        const titleEl = menu.querySelector('.paintball-title');
        const input = menu.querySelector('input') || Components.createInput(placeholder, options);
        const errorEl = menu.querySelector('.error-message');
        const dialogContent = menu.querySelector('.paintball-dialog');
        
        if (titleEl) titleEl.textContent = title;
        if (input) {
            input.placeholder = placeholder;
            input.value = options.value || '';
            if (!menu.contains(input)) {
                dialogContent.insertBefore(input, errorEl?.nextSibling || null);
            }
        }
        
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
        
        const submitBtn = menu.querySelector('#dialog-submit') || Components.createButton('Submit', null, 'primary', { id: 'dialog-submit' });
        const cancelBtn = menu.querySelector('#dialog-cancel') || Components.createButton('Cancel', null, 'secondary', { id: 'dialog-cancel' });
        const buttonContainer = menu.querySelector('.dialog-buttons') || document.createElement('div');
        
        if (!menu.contains(buttonContainer)) {
            buttonContainer.className = 'dialog-buttons';
            dialogContent.appendChild(buttonContainer);
        }
        
        buttonContainer.innerHTML = '';
        
        const submitHandler = () => {
            const value = input.value.trim();
            if (value) {
                callback(value);
            }
            // Client will handle focus management after dialog submit
            // Clear navigation flag so UI doesn't interfere
            MenuManager.isNavigating = false;
            MenuManager.hide(MENU_IDS.DIALOG, { checkFocusRelease: false });
        };
        
        const cancelHandler = () => {
            // Canceling dialog - clear navigation flag
            // Check if dashboard is still open, if so don't release focus
            MenuManager.isNavigating = false;
            const dashboardMenu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
            if (dashboardMenu && dashboardMenu.classList.contains('active')) {
                MenuManager.hide(MENU_IDS.DIALOG, { checkFocusRelease: false });
            } else {
                MenuManager.hide(MENU_IDS.DIALOG);
            }
        };
        
        const enterHandler = (e) => {
            if (e.key === 'Enter') submitHandler();
        };
        
        submitBtn.addEventListener('click', submitHandler);
        cancelBtn.addEventListener('click', cancelHandler);
        input.addEventListener('keypress', enterHandler);
        
        buttonContainer.appendChild(submitBtn);
        buttonContainer.appendChild(cancelBtn);
        
        MenuManager.show(MENU_IDS.DIALOG);
    },

    /**
     * Show PIN dialog
     */
    showPIN(matchId) {
        const menu = MenuManager.get(MENU_IDS.PIN);
        if (!menu) return;
        
        const input = menu.querySelector('#pin-input') || Components.createInput('Enter match PIN', { maxLength: 6, id: 'pin-input' });
        const errorEl = menu.querySelector('#pin-error') || menu.querySelector('.error-message');
        const dialogContent = menu.querySelector('.paintball-dialog');
        
        input.value = '';
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
    
        if (!menu.contains(input)) {
            dialogContent.insertBefore(input, errorEl?.nextSibling || null);
        }
        
        const submitBtn = menu.querySelector('#pin-submit') || Components.createButton('Join', null, 'primary', { id: 'pin-submit' });
        const cancelBtn = menu.querySelector('#pin-cancel') || Components.createButton('Cancel', null, 'secondary', { id: 'pin-cancel' });
        const buttonContainer = menu.querySelector('.dialog-buttons') || document.createElement('div');
        
        if (!menu.contains(buttonContainer)) {
            buttonContainer.className = 'dialog-buttons';
            dialogContent.appendChild(buttonContainer);
        }
        
        buttonContainer.innerHTML = '';
    
    const submitHandler = () => {
        const pin = input.value.trim();
        if (pin) {
                MatchManager.joinMatch(matchId, pin);
        }
    };
    
    const cancelHandler = () => {
            MenuManager.hide(MENU_IDS.PIN);
    };
    
    const enterHandler = (e) => {
            if (e.key === 'Enter') submitHandler();
    };
    
    submitBtn.addEventListener('click', submitHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    input.addEventListener('keypress', enterHandler);
        
        buttonContainer.appendChild(submitBtn);
        buttonContainer.appendChild(cancelBtn);
        
        MenuManager.show(MENU_IDS.PIN);
        setTimeout(() => input.focus(), CONFIG.INPUT_FOCUS_DELAY);
    },

    /**
     * Show PIN input for match creation
     */
    showPINInput(callback) {
        this.showDialog('Enter PIN', 'Enter 4-6 digit PIN', (pin) => {
            const errorEl = MenuManager.get(MENU_IDS.DIALOG)?.querySelector('.error-message');
            if (pin.length >= 4 && pin.length <= 6 && /^\d+$/.test(pin)) {
                if (errorEl) {
                    errorEl.textContent = '';
                    errorEl.style.display = 'none';
                }
                callback(pin);
        } else {
                Components.showError(errorEl, 'PIN must be 4-6 digits');
                setTimeout(() => this.showPINInput(callback), 100);
            }
        });
    },

    /**
     * Show confirmation dialog
     */
    showConfirm(message, onYes, onNo) {
        const menu = MenuManager.get(MENU_IDS.CONFIRM);
        if (!menu) return;
        
        const messageEl = menu.querySelector('#confirm-message') || document.createElement('div');
        messageEl.id = 'confirm-message';
        messageEl.textContent = message;
        messageEl.style.cssText = 'color: #FFFFFF; font-size: 14px; line-height: 1.6; margin-bottom: 16px; text-align: center;';
        
        const dialogContent = menu.querySelector('.paintball-dialog');
        if (!dialogContent.contains(messageEl)) {
            dialogContent.insertBefore(messageEl, dialogContent.firstChild);
        }
        
        const buttonContainer = menu.querySelector('.dialog-buttons') || document.createElement('div');
        if (!menu.contains(buttonContainer)) {
            buttonContainer.className = 'dialog-buttons';
            dialogContent.appendChild(buttonContainer);
        }
        
        buttonContainer.innerHTML = '';
        
        const yesBtn = Components.createButton('Yes', () => {
            MenuManager.hide(MENU_IDS.CONFIRM);
            if (onYes) onYes();
        }, 'primary', { style: { flex: '1', marginRight: '8px' } });
        
        const noBtn = Components.createButton('No', () => {
            MenuManager.hide(MENU_IDS.CONFIRM);
            if (onNo) onNo();
        }, 'secondary', { style: { flex: '1' } });
        
        buttonContainer.appendChild(yesBtn);
        buttonContainer.appendChild(noBtn);
        
        MenuManager.show(MENU_IDS.CONFIRM);
    },

    /**
     * Show error dialog
     */
    showError(message) {
        // Try to show inline error first
        const currentMenu = MenuManager.currentMenu;
        let errorEl = null;
        
        if (currentMenu === MENU_IDS.DIALOG) {
            errorEl = MenuManager.get(MENU_IDS.DIALOG)?.querySelector('.error-message');
        } else if (currentMenu === MENU_IDS.PIN) {
            errorEl = MenuManager.get(MENU_IDS.PIN)?.querySelector('.error-message');
        } else if (currentMenu === MENU_IDS.WEAPON_SELECT) {
            errorEl = MenuManager.get(MENU_IDS.WEAPON_SELECT)?.querySelector('.error-message');
        }
        
        if (errorEl) {
            Components.showError(errorEl, message);
        return;
    }
        
        // Fallback to popup
        const menu = MenuManager.get(MENU_IDS.ERROR);
        if (!menu) return;
        
        const messageEl = menu.querySelector('#error-message') || document.createElement('div');
        messageEl.id = 'error-message';
        messageEl.textContent = message;
        messageEl.style.cssText = 'color: #FFFFFF; font-size: 14px; line-height: 1.6; margin-bottom: 16px; text-align: center;';
        
        const dialogContent = menu.querySelector('.paintball-dialog');
        if (!dialogContent.contains(messageEl)) {
            dialogContent.insertBefore(messageEl, dialogContent.firstChild);
        }
        
        const buttonContainer = menu.querySelector('.dialog-buttons') || document.createElement('div');
        if (!menu.contains(buttonContainer)) {
            buttonContainer.className = 'dialog-buttons';
            dialogContent.appendChild(buttonContainer);
        }
        
        buttonContainer.innerHTML = '';
        
        const okBtn = Components.createButton('OK', () => MenuManager.hide(MENU_IDS.ERROR), 'primary', { style: { width: '100%' } });
        buttonContainer.appendChild(okBtn);
        
        MenuManager.show(MENU_IDS.ERROR);
    },
};

// ============================================================================
// MATCH MANAGER
// ============================================================================
const MatchManager = {
    selectedData: null,

    /**
     * Create a match
     */
    createMatch(isPrivate, pin) {
        if (!this.selectedData || !this.selectedData.gameModeId || !this.selectedData.mapId) {
            DialogManager.showError('Missing game mode or map selection. Please try again.');
            return;
        }
        
        // Close all menus - match creation will be handled server-side
        MenuManager.hideAll();
        
        Utils.sendNuiCallback('createMatch', {
            gameModeId: this.selectedData.gameModeId,
            mapId: this.selectedData.mapId,
            isPrivate: isPrivate,
            pin: pin,
        }).catch(() => {
            DialogManager.showError('Failed to create match. Please try again.');
        });
    },

    /**
     * Join a match
     */
    joinMatch(matchId, pin) {
        // Check if player has a match - this will be checked on client side
        // For now, just attempt to join - client will handle validation
        Utils.sendNuiCallback('joinMatch', { matchId, pin: pin || null });
        MenuManager.hide(MENU_IDS.BROWSER);
        MenuManager.hide(MENU_IDS.PIN);
    },
};

// ============================================================================
// WEAPON CONFIG MANAGER (for dashboard integration only)
// ============================================================================
const WeaponConfigManager = {
    currentWeaponsList: [], // Used for checking if weapon exists when adding

    /**
     * Show add weapon dialog
     */
    showAddWeaponDialog(categories) {
        // Check if dashboard is open
        const dashboardMenu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
        const isFromDashboard = dashboardMenu && dashboardMenu.classList.contains('active');
        
        // Navigating to weapon selection dialog - set navigation flag
        MenuManager.isNavigating = true;
        
        fetch(`https://${Utils.getResourceName()}/getOXItems`, {
        method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })
            .then(response => response.json())
    .then(data => {
        const weaponItems = (data.items || []).filter(item => {
            const itemName = item.name || '';
            return itemName.toLowerCase().startsWith('weapon_');
        });
                this.showWeaponSelectionDialog(categories, weaponItems, isFromDashboard);
    })
    .catch(() => {
                this.showWeaponSelectionDialog(categories, [], isFromDashboard);
            });
    },

    /**
     * Show weapon selection dialog
     */
    showWeaponSelectionDialog(categories, oxItems, isFromDashboard = false) {
        const menu = MenuManager.get(MENU_IDS.WEAPON_SELECT);
        if (!menu) return;
        
        // Store dashboard context
        menu._isFromDashboard = isFromDashboard;
        
        const content = menu.querySelector('.paintball-dialog') || menu.querySelector('.paintball-menu');
        const titleEl = menu.querySelector('.paintball-title');
        const errorEl = menu.querySelector('.error-message') || content.querySelector('.error-message');
        
        if (titleEl) titleEl.textContent = 'Add Weapon';
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
    
        if (!content) return;
        
        // Clear content except error
    const children = Array.from(content.children);
    children.forEach(child => {
            if (child !== errorEl && !child.classList.contains('error-message')) {
            child.remove();
        }
    });
    
    if (oxItems.length > 0) {
            this.showOXWeaponSelection(content, categories, oxItems, errorEl, isFromDashboard);
    } else {
            this.showManualWeaponEntry(content, categories, errorEl, isFromDashboard);
        }
        
        // Clear navigation flag when weapon selection dialog is shown (navigation complete)
        MenuManager.isNavigating = false;
        MenuManager.show(MENU_IDS.WEAPON_SELECT);
    },

    /**
     * Show manual weapon entry
     */
    showManualWeaponEntry(content, categories, errorEl, isFromDashboard = false) {
        const hashInput = Components.createInput('Enter weapon hash (e.g., WEAPON_PISTOL or PISTOL)', {
            style: { marginBottom: '12px' },
        });
        const nameInput = Components.createInput('Enter weapon name (e.g., Pistol)', {
            style: { marginBottom: '16px' },
        });
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'dialog-buttons';
    
        const submitBtn = Components.createButton('Continue', () => {
        const hash = hashInput.value.trim();
        const name = nameInput.value.trim();
        
        if (!hash) {
                Components.showError(errorEl, 'Weapon hash is required');
            return;
        }
        if (!name) {
                Components.showError(errorEl, 'Weapon name is required');
            return;
        }
        
            if (this.checkWeaponExists(hash, name)) {
                Components.showError(errorEl, 'Weapon already exists');
            return;
        }
        
            this.pendingWeaponData = { hash, name };
            // Navigating to category selection - set navigation flag
            MenuManager.isNavigating = true;
            MenuManager.hide(MENU_IDS.WEAPON_SELECT, { checkFocusRelease: false });
            this.showCategorySelection(categories, isFromDashboard);
        }, 'primary');
        
        const cancelBtn = Components.createButton('Cancel', () => {
            // Canceling - navigate back to dashboard or weapon config
            MenuManager.isNavigating = true;
            MenuManager.hide(MENU_IDS.WEAPON_SELECT, { checkFocusRelease: false });
            if (isFromDashboard) {
                // Return to dashboard
                const dashboardMenu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
                const currentTab = dashboardMenu?._currentTab || 'weapons';
                Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
            } else {
                // Reopen weapon config menu
                Utils.sendNuiCallback('refreshWeaponConfig');
            }
        }, 'secondary');
    
    buttonContainer.appendChild(submitBtn);
    buttonContainer.appendChild(cancelBtn);
    
    content.appendChild(hashInput);
    content.appendChild(nameInput);
    content.appendChild(buttonContainer);
    
        setTimeout(() => hashInput.focus(), CONFIG.INPUT_FOCUS_DELAY);
    },

    /**
     * Show OX weapon selection
     */
    showOXWeaponSelection(content, categories, oxItems, errorEl, isFromDashboard = false) {
        const searchInput = Components.createInput('Search items...', {
            style: { marginBottom: '12px' },
        });
    
    const itemsList = document.createElement('div');
    itemsList.className = 'paintball-menu';
        itemsList.style.cssText = 'max-height: 300px; overflow-y: auto; margin-bottom: 16px;';
    
    let filteredItems = oxItems;
    
        const renderItems = () => {
        itemsList.innerHTML = '';
        filteredItems.forEach(item => {
            const itemName = item.label || item.name;
                const alreadyExists = this.checkWeaponExists(item.name, itemName);
            
                const itemEl = Components.createMenuItem(
                item.label || item.name,
                alreadyExists ? `Item: ${item.name} (Already Added)` : `Item: ${item.name}`,
                    alreadyExists ? null : () => {
                        this.pendingWeaponData = { hash: item.name, name: itemName };
                        // Navigating to category selection - set navigation flag
                        MenuManager.isNavigating = true;
                        MenuManager.hide(MENU_IDS.WEAPON_SELECT, { checkFocusRelease: false });
                        this.showCategorySelection(categories, isFromDashboard);
                    },
                    {
                        disabled: alreadyExists,
                        style: alreadyExists
                            ? { opacity: '0.5', cursor: 'not-allowed', filter: 'grayscale(100%)', pointerEvents: 'none' }
                            : {},
                    }
                );
            itemsList.appendChild(itemEl);
        });
        
        if (filteredItems.length === 0) {
                const empty = Components.createMenuItem('No items found', '', null, {
                    disabled: true,
                    style: { textAlign: 'center', padding: '20px' },
                });
            itemsList.appendChild(empty);
        }
        };
    
    searchInput.addEventListener('input', (e) => {
        const search = e.target.value.toLowerCase();
            filteredItems = oxItems.filter(
                item =>
            (item.name && item.name.toLowerCase().includes(search)) ||
            (item.label && item.label.toLowerCase().includes(search))
        );
        renderItems();
    });
    
        const cancelBtn = Components.createButton('Cancel', () => {
            // Canceling - navigate back to dashboard or weapon config
            MenuManager.isNavigating = true;
            MenuManager.hide(MENU_IDS.WEAPON_SELECT, { checkFocusRelease: false });
            if (isFromDashboard) {
                // Return to dashboard
                const dashboardMenu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
                const currentTab = dashboardMenu?._currentTab || 'weapons';
                Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
            } else {
                // Reopen weapon config menu
                Utils.sendNuiCallback('refreshWeaponConfig');
            }
        }, 'secondary', { style: { width: '100%' } });
    
    content.appendChild(searchInput);
    content.appendChild(itemsList);
    content.appendChild(cancelBtn);
    
    renderItems();
        setTimeout(() => searchInput.focus(), CONFIG.INPUT_FOCUS_DELAY);
    },

    /**
     * Check if weapon exists
     */
    checkWeaponExists(weaponHash, weaponName) {
        if (!this.currentWeaponsList || this.currentWeaponsList.length === 0) {
            return false;
        }
        
        return this.currentWeaponsList.some(weapon => {
            if (String(weapon.hash) === String(weaponHash)) return true;
            const weaponHashNum = typeof weapon.hash === 'string' ? parseInt(weapon.hash) : weapon.hash;
            const inputHashNum = typeof weaponHash === 'string' ? parseInt(weaponHash) : weaponHash;
            if (!isNaN(weaponHashNum) && !isNaN(inputHashNum) && weaponHashNum === inputHashNum) return true;
            if (weaponName && weapon.name) {
                if (String(weapon.name).toLowerCase().trim() === String(weaponName).toLowerCase().trim()) return true;
            }
            if (weapon.name && String(weapon.name).toLowerCase() === String(weaponHash).toLowerCase()) return true;
            return false;
        });
    },

    /**
     * Show category selection
     */
    showCategorySelection(categories, isFromDashboard = false) {
        const content = MenuManager.getContent(MENU_IDS.CATEGORY_SELECT);
        if (!content) return;
        
        content.innerHTML = '';
    
    if (!categories || categories.length === 0) {
            const empty = Components.createMenuItem('No categories available. Create one first.', '', null, {
                disabled: true,
                style: { textAlign: 'center', padding: '20px' },
            });
            content.appendChild(empty);
    } else {
        categories.forEach(cat => {
            const item = Components.createMenuItem(cat.name, `ID: ${cat.id}`, () => {
                // Selecting category - will add weapon and close, but keep navigation flag for now
                // The handleCategorySelection will handle closing properly
                MenuManager.hide(MENU_IDS.CATEGORY_SELECT, { checkFocusRelease: false });
                this.handleCategorySelection(cat);
            });
            content.appendChild(item);
        });
        }
        
        const cancelItem = Components.createMenuItem('Cancel', 'Cancel adding weapon', () => {
            // Canceling - navigate back to weapon selection or dashboard
            MenuManager.isNavigating = true;
            MenuManager.hide(MENU_IDS.CATEGORY_SELECT, { checkFocusRelease: false });
            this.pendingWeaponData = null;
            if (isFromDashboard) {
                // Return to dashboard
                const dashboardMenu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
                const currentTab = dashboardMenu?._currentTab || 'weapons';
                Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
            } else {
                // Reopen weapon selection dialog
                this.showWeaponSelectionDialog(categories, [], false);
            }
        });
    cancelItem.style.borderColor = 'rgba(255, 68, 68, 0.3)';
        content.appendChild(cancelItem);
        
        // Clear navigation flag when category selection is shown (navigation complete)
        MenuManager.isNavigating = false;
        MenuManager.show(MENU_IDS.CATEGORY_SELECT);
    },

    /**
     * Handle category selection
     */
    handleCategorySelection(selectedCategory) {
        if (!selectedCategory || !this.pendingWeaponData) {
            this.pendingWeaponData = null;
            return;
        }
        
        // Check if we're in dashboard context
        const dashboardMenu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
        const isFromDashboard = dashboardMenu && dashboardMenu.classList.contains('active');
        
        Utils.sendNuiCallback('addWeapon', {
            hash: this.pendingWeaponData.hash,
            name: this.pendingWeaponData.name,
            category: selectedCategory.id,
        }).then(response => {
            if (response && response.ok !== false) {
                this.pendingWeaponData = null;
                // Weapon added successfully - refresh dashboard or weapon config menu
                MenuManager.isNavigating = true;
                MenuManager.hide(MENU_IDS.WEAPON_SELECT, { checkFocusRelease: false });
                MenuManager.hide(MENU_IDS.CATEGORY_SELECT, { checkFocusRelease: false });
                
                if (isFromDashboard) {
                    // Refresh dashboard
                    const currentTab = dashboardMenu?._currentTab || 'weapons';
                    Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
                } else {
                    // Refresh weapon config to show new weapon
                    const dashboardMenu = MenuManager.get(MENU_IDS.ADMIN_DASHBOARD);
                    const currentTab = dashboardMenu?._currentTab || 'weapons';
                    Utils.sendNuiCallback('refreshDashboard', { preserveTab: currentTab });
                }
            } else {
                const errorEl = MenuManager.get(MENU_IDS.WEAPON_SELECT)?.querySelector('.error-message');
                Components.showError(errorEl, 'Failed to add weapon. Please try again.');
                MenuManager.isNavigating = true;
                MenuManager.show(MENU_IDS.WEAPON_SELECT);
            }
        }).catch(() => {
            const errorEl = MenuManager.get(MENU_IDS.WEAPON_SELECT)?.querySelector('.error-message');
            Components.showError(errorEl, 'Network error. Please try again.');
            MenuManager.isNavigating = true;
            MenuManager.show(MENU_IDS.WEAPON_SELECT);
        });
    },

    pendingWeaponData: null,
};

// ============================================================================
// MESSAGE HANDLER
// ============================================================================
window.addEventListener('message', function(event) {
    const data = event.data;
    if (!data || !data.action) return;
    
    switch (data.action) {
        case 'showGameModes':
            MenuHandlers.displayGameModes(data.gameModes);
            break;
        case 'showMaps':
            MenuHandlers.displayMaps(data.maps, {
                forEditing: data.forEditing || false,
                forDeleting: data.forDeleting || false,
            });
            break;
        case 'showCreateMatchForm':
            MenuHandlers.displayCreateMatchForm(data.gameModes, data.maps);
            break;
        case 'showEditorMainMenu':
            MenuHandlers.displayEditorMainMenu();
            break;
        case 'showEditorMenu':
            // Clear navigation flag before showing editor menu (client manages focus explicitly)
            MenuManager.isNavigating = false;
            MenuHandlers.displayEditorMenu(data.menuData);
            break;
        case 'showTeamMenu':
            MenuHandlers.displayTeamMenu();
            break;
        case 'showSpawnViewer':
            // Clear navigation flag before showing spawn viewer (client manages focus explicitly)
            MenuManager.isNavigating = false;
            MenuHandlers.displaySpawnViewer(data);
            break;
        case 'showDialog':
            // If showing dialog for map name (during save), keep navigation flag
            // Otherwise, clear it (dialog is standalone)
            if (data.dialogType !== 'mapName') {
                MenuManager.isNavigating = false;
            }
            DialogManager.showDialog(data.title, data.placeholder, (value) => {
                Utils.sendNuiCallback('dialogSubmit', { value, type: data.dialogType });
            });
            break;
        case 'hideMenu':
            if (data.menu) {
                // Client sends menu IDs like 'main', 'gamemode', etc. (without '-ui')
                // Our menu IDs are stored the same way, so use directly
                // When client requests hide, it's usually for navigation - set flag and don't release focus
                // The client will handle focus management when showing the next menu
                // BUT: if the client is managing focus explicitly (like clearMap/saveMap for editor menu, or dialog),
                // we should clear the navigation flag so the client's focus management works properly
                const isEditorMenu = data.menu === MENU_IDS.EDITOR;
                const isDialog = data.menu === MENU_IDS.DIALOG;
                const isSpawnViewer = data.menu === MENU_IDS.SPAWN_VIEWER;
                if (isEditorMenu || isDialog || isSpawnViewer) {
                    // Client manages focus explicitly for editor menu (clearMap/saveMap), dialog (map name), and spawnViewer (teleport)
                    // Clear navigation flag immediately and force immediate hide (no animation delay)
                    // This ensures menu is fully hidden before client sets focus to false
                    MenuManager.isNavigating = false;
                    const menu = MenuManager.get(data.menu);
                    if (menu) {
                        // Force immediate hide - remove active class and add hidden class immediately
                        menu.classList.remove('active');
                        menu.classList.add('hidden');
                        if (MenuManager.currentMenu === data.menu) {
                            MenuManager.currentMenu = null;
                        }
                    }
                } else {
                    // For other menus, set navigation flag (client will show next menu)
                    MenuManager.isNavigating = true;
                    MenuManager.hide(data.menu, { checkFocusRelease: false });
                }
            } else {
                // If no menu specified, hide all (this is a true close, release focus)
                MenuManager.isNavigating = false;
                MenuManager.hideAll();
                // Force hide spawnViewer specifically if it exists
                const spawnViewerMenu = MenuManager.get(MENU_IDS.SPAWN_VIEWER);
                if (spawnViewerMenu) {
                    spawnViewerMenu.classList.remove('active');
                    spawnViewerMenu.classList.add('hidden');
                    if (MenuManager.currentMenu === MENU_IDS.SPAWN_VIEWER) {
                        MenuManager.currentMenu = null;
                    }
                }
            }
            break;
        case 'showPressE':
            PressEUIManager.show(data.x, data.y, data.text, data.opacity);
            break;
        case 'hidePressE':
            PressEUIManager.hide();
            break;
        case 'showMainMenu':
            MenuHandlers.displayMainMenu(data.hasMatch || false, data.inMatch || false, data.canStartMatch || false);
            break;
        case 'showMatchSettings':
            MenuHandlers.displayMatchSettings(data.gameModeId, data.mapId);
            break;
        case 'showMatchBrowser':
            MenuHandlers.displayMatchBrowser(data.matches, data.myMatchId);
            break;
        case 'showWeaponSelection':
            MenuHandlers.displayWeaponSelection(data.categories, data.weapons, data.forMatch);
            break;
        case 'showError':
            DialogManager.showError(data.message || 'An error occurred');
            break;
        case 'showAdminDashboard':
            MenuHandlers.displayAdminDashboard(data);
            break;
        case 'updateScoreboard':
            ScoreboardManager.show(data.data || data);
            break;
        case 'showScoreboard':
            ScoreboardManager.show(data.data || data);
            break;
        case 'hideScoreboard':
            ScoreboardManager.hide();
            break;
        case 'showPostMatchScoreboard':
            PostMatchScoreboardManager.show(data.data || data);
            break;
        case 'hidePostMatchScoreboard':
            PostMatchScoreboardManager.hide();
            break;
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================
function init() {
    MenuManager.init();
    PressEUIManager.init();
    ScoreboardManager.init();
    PostMatchScoreboardManager.init();

// Notify NUI ready
function notifyNUIReady() {
    try {
            Utils.sendNuiCallback('nuiReady', { ready: true });
        } catch (err) {
            // Ignore
        }
}

if (typeof GetParentResourceName === 'function') {
    notifyNUIReady();
} else {
    setTimeout(() => {
        if (typeof GetParentResourceName === 'function') {
            notifyNUIReady();
        }
        }, CONFIG.NUI_READY_RETRY_DELAY);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
