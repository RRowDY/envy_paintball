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
    WEAPON_CONFIG: 'weapon-config',
    PIN: 'pin',
    CATEGORY_SELECT: 'category-select',
    WEAPON_SELECT: 'weapon-select',
    ERROR: 'error',
    CONFIRM: 'confirm',
    ADMIN_MATCHES: 'admin-matches',
};

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
            { id: MENU_IDS.WEAPON_CONFIG, title: 'Weapon Configuration', isDialog: false },
            { id: MENU_IDS.ADMIN_MATCHES, title: 'Active Matches (Admin)', isDialog: false },
            { id: MENU_IDS.DIALOG, title: 'Enter Value', isDialog: true },
            { id: MENU_IDS.PIN, title: 'Enter PIN', isDialog: true },
            { id: MENU_IDS.CATEGORY_SELECT, title: 'Select Category', isDialog: false },
            { id: MENU_IDS.WEAPON_SELECT, title: 'Add Weapon', isDialog: true },
            { id: MENU_IDS.ERROR, title: 'Error', isDialog: true },
            { id: MENU_IDS.CONFIRM, title: 'Confirm', isDialog: true },
        ];
        
        menuConfigs.forEach(config => {
            let menu;
            if (typeof createMenuElement === 'function' && !config.isDialog) {
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
                
                // Special width for weapon-config and weapon-select
                if (config.id === MENU_IDS.WEAPON_CONFIG) {
                    if (box) {
                        box.style.minWidth = '600px';
                        box.style.maxWidth = '800px';
                    }
                } else if (config.id === MENU_IDS.WEAPON_SELECT) {
                    if (box) {
                        box.style.minWidth = '500px';
                        box.style.maxWidth = '600px';
                    }
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
                    closeBtn.addEventListener('click', () => this.close(config.id));
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
            [MENU_IDS.WEAPON_CONFIG]: 'Weapon Configuration',
            [MENU_IDS.PIN]: 'Enter PIN',
            [MENU_IDS.CATEGORY_SELECT]: 'Select Category',
            [MENU_IDS.WEAPON_SELECT]: 'Add Weapon',
            [MENU_IDS.ERROR]: 'Error',
            [MENU_IDS.CONFIRM]: 'Confirm',
            [MENU_IDS.ADMIN_MATCHES]: 'Active Matches (Admin)',
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
};

// ============================================================================
// PRESS E UI MANAGER
// ============================================================================
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
            const item = Components.createMenuItem(
                mode.name,
                `Players: ${mode.minPlayers}-${mode.maxPlayers}`,
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
                    `Spawns: ${map.spawns.length} | Radius: ${map.radius.toFixed(1)}m`,
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
                                // Only hide main menu, don't release focus - we're navigating to game mode selection
                                MenuManager.isNavigating = true;
                                MenuManager.hide(MENU_IDS.MAIN, { checkFocusRelease: false });
                                // Navigate to game mode selection - this is intentional navigation
                                Utils.sendNuiCallback('mainAction', { action: 'create' });
                            });
                        }
                    );
                } else {
                    // Only hide main menu, don't release focus - we're navigating to game mode selection
                    MenuManager.isNavigating = true;
                    MenuManager.hide(MENU_IDS.MAIN, { checkFocusRelease: false });
                    // Navigate to game mode selection - this is intentional navigation
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
        
    if (inMatch) {
        items.push({
            title: 'Select Weapon',
            description: 'Choose your weapon for this match',
            onClick: () => {
                // Navigating to weapon selection - set navigation flag
                MenuManager.isNavigating = true;
                MenuManager.hide(MENU_IDS.MAIN, { checkFocusRelease: false });
                Utils.sendNuiCallback('selectWeapon');
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
                `Select ${weapon.name} for this match`,
                () => {
                    if (forMatch) {
                        // Selecting weapon closes UI - release focus
                        MenuManager.isNavigating = false;
                        MenuManager.hideAll();
                        Utils.sendNuiCallback('setPlayerWeapon', { weaponHash: weapon.hash });
                    }
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
     * Display admin matches
     */
    displayAdminMatches(matches) {
        const content = MenuManager.getContent(MENU_IDS.ADMIN_MATCHES);
        if (!content) return;
        
        content.innerHTML = '';
        
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
                
                const item = Components.createMenuItem(
                    `${match.gameMode} - ${match.map}`,
                    `Status: ${statusText} | Players: ${match.players}/${match.maxPlayers} | Bucket: ${match.bucket}`,
        () => {
                        DialogManager.showConfirm(
                            `Are you sure you want to close this match?\n\nGame Mode: ${match.gameMode}\nMap: ${match.map}\nPlayers: ${match.players}/${match.maxPlayers}`,
                            () => {
                                MenuManager.hide(MENU_IDS.CONFIRM);
                                // Admin close match refreshes the same menu - keep focus, don't release
                                MenuManager.isNavigating = true;
                                Utils.sendNuiCallback('adminCloseMatch', { matchId: match.id });
                                // Client will refresh the admin matches menu automatically
                            }
                        );
                    }
                );
                
                const titleEl = item.querySelector('.menu-item-title');
                if (titleEl) {
                    const statusSpan = document.createElement('span');
                    statusSpan.textContent = `[${statusText}]`;
                    statusSpan.style.color = statusColor;
                    statusSpan.style.marginLeft = '8px';
                    titleEl.appendChild(statusSpan);
                }
                
                content.appendChild(item);
            });
        }
        
        MenuManager.show(MENU_IDS.ADMIN_MATCHES);
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
            // Canceling dialog - clear navigation flag and release focus
            // Client won't reopen any menu when dialog is cancelled
            MenuManager.isNavigating = false;
            MenuManager.hide(MENU_IDS.DIALOG);
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
// WEAPON CONFIG MANAGER
// ============================================================================
const WeaponConfigManager = {
    currentWeaponsList: [],

    /**
     * Display weapon configuration
     */
    displayWeaponConfig(categories, weapons) {
        const content = MenuManager.getContent(MENU_IDS.WEAPON_CONFIG);
        if (!content) return;
        
        this.currentWeaponsList = weapons || [];
        content.innerHTML = '';
        
        // Add Weapon button
        const addWepBtn = Components.createButton('+ Add Weapon', () => {
            this.showAddWeaponDialog(categories);
        }, 'primary', { style: { width: '100%', marginBottom: '16px' } });
        content.appendChild(addWepBtn);
        
        // Categories section
        const catHeader = Components.createMenuItem('Categories', '', null, {
            style: { background: 'rgba(9, 135, 255, 0.3)', cursor: 'default', fontWeight: '600', marginTop: '16px' },
        });
        content.appendChild(catHeader);
    
    if (categories.length === 0) {
            const emptyMsg = Components.createMenuItem('No categories found', '', null, {
                disabled: true,
                style: { opacity: '0.6', cursor: 'default' },
            });
            content.appendChild(emptyMsg);
    } else {
        categories.forEach(cat => {
                const item = Components.createMenuItem(
                    cat.name,
                    `ID: ${cat.id} ${cat.enabled ? '(Enabled)' : '(Disabled)'}`,
                    null,
                    { style: { cursor: 'default', opacity: cat.enabled ? '1.0' : '0.6' } }
                );
                content.appendChild(item);
        });
    }
    
    // Weapons section
        const wepHeader = Components.createMenuItem('Weapons', '', null, {
            style: { background: 'rgba(9, 135, 255, 0.3)', cursor: 'default', fontWeight: '600', marginTop: '16px' },
        });
        content.appendChild(wepHeader);
    
    if (weapons.length === 0) {
            const emptyMsg = Components.createMenuItem('No weapons yet', '', null, {
                disabled: true,
                style: { opacity: '0.6', cursor: 'default' },
            });
            content.appendChild(emptyMsg);
    } else {
        weapons.forEach(weapon => {
            const item = document.createElement('div');
            item.className = 'menu-item';
                item.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
            
            const left = document.createElement('div');
            left.innerHTML = `<div style="font-weight: 600;">${weapon.name}</div><div style="font-size: 11px; color: #888;">${weapon.category} | Hash: ${weapon.hash}</div>`;
            
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
                                Utils.sendNuiCallback('removeWeapon', { hash: weapon.hash }).then(() => {
                            setTimeout(() => {
                                        Utils.sendNuiCallback('refreshWeaponConfig');
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
        
        MenuManager.show(MENU_IDS.WEAPON_CONFIG);
    },

    /**
     * Show add weapon dialog
     */
    showAddWeaponDialog(categories) {
        // Navigating to weapon selection dialog - set navigation flag
        MenuManager.isNavigating = true;
        MenuManager.hide(MENU_IDS.WEAPON_CONFIG, { checkFocusRelease: false });
        
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
                this.showWeaponSelectionDialog(categories, weaponItems);
    })
    .catch(() => {
                this.showWeaponSelectionDialog(categories, []);
            });
    },

    /**
     * Show weapon selection dialog
     */
    showWeaponSelectionDialog(categories, oxItems) {
        const menu = MenuManager.get(MENU_IDS.WEAPON_SELECT);
        if (!menu) return;
        
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
            this.showOXWeaponSelection(content, categories, oxItems, errorEl);
    } else {
            this.showManualWeaponEntry(content, categories, errorEl);
        }
        
        // Clear navigation flag when weapon selection dialog is shown (navigation complete)
        MenuManager.isNavigating = false;
        MenuManager.show(MENU_IDS.WEAPON_SELECT);
    },

    /**
     * Show manual weapon entry
     */
    showManualWeaponEntry(content, categories, errorEl) {
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
            this.showCategorySelection(categories);
        }, 'primary');
        
        const cancelBtn = Components.createButton('Cancel', () => {
            // Canceling - navigate back to weapon config
            MenuManager.isNavigating = true;
            MenuManager.hide(MENU_IDS.WEAPON_SELECT, { checkFocusRelease: false });
            // Reopen weapon config menu
            Utils.sendNuiCallback('refreshWeaponConfig');
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
    showOXWeaponSelection(content, categories, oxItems, errorEl) {
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
                        this.showCategorySelection(categories);
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
            // Canceling - navigate back to weapon config
            MenuManager.isNavigating = true;
            MenuManager.hide(MENU_IDS.WEAPON_SELECT, { checkFocusRelease: false });
            // Reopen weapon config menu
            Utils.sendNuiCallback('refreshWeaponConfig');
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
    showCategorySelection(categories) {
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
            // Canceling - navigate back to weapon selection
            MenuManager.isNavigating = true;
            MenuManager.hide(MENU_IDS.CATEGORY_SELECT, { checkFocusRelease: false });
            this.pendingWeaponData = null;
            // Reopen weapon selection dialog
            this.showWeaponSelectionDialog(categories, []);
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
        
        Utils.sendNuiCallback('addWeapon', {
            hash: this.pendingWeaponData.hash,
            name: this.pendingWeaponData.name,
            category: selectedCategory.id,
        }).then(response => {
            if (response && response.ok !== false) {
                this.pendingWeaponData = null;
                // Weapon added successfully - refresh weapon config menu
                MenuManager.isNavigating = true;
                MenuManager.hide(MENU_IDS.WEAPON_SELECT, { checkFocusRelease: false });
                MenuManager.hide(MENU_IDS.CATEGORY_SELECT, { checkFocusRelease: false });
                // Refresh weapon config to show new weapon
                Utils.sendNuiCallback('refreshWeaponConfig');
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
        case 'showAdminMatches':
            MenuHandlers.displayAdminMatches(data.matches);
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
                if (isEditorMenu || isDialog) {
                    // Client manages focus explicitly for editor menu (clearMap/saveMap) and dialog (map name)
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
        case 'showWeaponConfig':
            const weaponSelectUI = MenuManager.get(MENU_IDS.WEAPON_SELECT);
            if (weaponSelectUI && weaponSelectUI.getAttribute('data-error-open') === 'true') {
                break;
            }
            const categories = data.categories || data.Categories || [];
            const weapons = data.weapons || data.Weapons || [];
            // Clear navigation flag when weapon config is shown (navigation complete)
            MenuManager.isNavigating = false;
            WeaponConfigManager.displayWeaponConfig(categories, weapons);
            MenuManager.show(MENU_IDS.WEAPON_CONFIG);
            break;
        case 'showError':
            DialogManager.showError(data.message || 'An error occurred');
            break;
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================
function init() {
    MenuManager.init();
    PressEUIManager.init();

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
