let currentMenu = null;
let pressEUIVisible = false;

function parseColorCodes(text) {
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
        '~w~': '</span>'
    };
    
    let htmlText = text;
    for (const [code, replacement] of Object.entries(colorMap)) {
        htmlText = htmlText.replace(new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    }
    
    return htmlText;
}

function updatePressEPosition(ui, x, y) {
    ui.style.left = x + 'px';
    ui.style.top = y + 'px';
}

function showMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;
    
    menu.classList.remove('hidden');
    menu.classList.add('active');
    currentMenu = menuId;
    
    setTimeout(() => {
        const input = document.getElementById('dialog-input');
        if (input && menuId === 'dialog-ui') {
            input.focus();
        }
    }, 100);
}

function hideMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return;
    
    // Don't close weapon-select-ui if it has an error open
    if (menuId === 'weapon-select-ui' && menu.getAttribute('data-error-open') === 'true') {
        return;
    }
    
    menu.classList.remove('active');
    setTimeout(() => {
        menu.classList.add('hidden');
    }, 200);
    
    if (currentMenu === menuId) {
        currentMenu = null;
    }
}

function hideAllMenus() {
    hideMenu('gamemode-ui');
    hideMenu('map-ui');
    hideMenu('editor-main-ui');
    hideMenu('editor-ui');
    hideMenu('team-ui');
    hideMenu('dialog-ui');
    hideMenu('main-ui');
    hideMenu('browser-ui');
    hideMenu('weapon-ui');
    hideMenu('weapon-config-ui');
    hideMenu('pin-ui');
    hideMenu('category-select-ui');
    hideMenu('weapon-select-ui');
    hideMenu('error-ui');
    hideMenu('confirm-ui');
    hideMenu('admin-matches-ui');
    currentMenu = null;
}

function showError(message) {
    // Show inline error in the currently open dialog (best UX practice)
    let errorEl = null;
    let shouldShowWeaponSelect = false;
    
    // Check if this is a weapon-related error
    const isWeaponError = message && (
        message.toLowerCase().includes('weapon') || 
        message.toLowerCase().includes('category')
    );
    
    // Check which dialog is currently open
    if (document.getElementById('dialog-ui')?.classList.contains('active')) {
        errorEl = document.getElementById('dialog-error');
    } else if (document.getElementById('pin-ui')?.classList.contains('active')) {
        errorEl = document.getElementById('pin-error');
    } else if (document.getElementById('weapon-select-ui')?.classList.contains('active')) {
        errorEl = document.getElementById('weapon-select-error');
    } else if (document.getElementById('category-select-ui')?.classList.contains('active')) {
        // If category select is open, show error in weapon-select-ui (reopen it)
        errorEl = document.getElementById('weapon-select-error');
        shouldShowWeaponSelect = true;
    } else if (isWeaponError) {
        // If it's a weapon error and no dialog is open, show it in weapon-select-ui
        errorEl = document.getElementById('weapon-select-error');
        shouldShowWeaponSelect = true;
    }
    
    // If weapon-select-ui should be shown, open it first and ensure it stays open
    if (shouldShowWeaponSelect && errorEl) {
        const weaponSelectUI = document.getElementById('weapon-select-ui');
        if (weaponSelectUI) {
            showMenu('weapon-select-ui');
            // Prevent it from being closed by other events
            weaponSelectUI.setAttribute('data-error-open', 'true');
        }
    }
    
    if (errorEl) {
        // Show inline error in the current dialog
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        
        // Keep the error flag set while error is visible
        // This prevents the window from closing
        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
            // Only remove the flag if it's a weapon error and user can now close manually
            // For weapon errors, keep the flag a bit longer to ensure window stays open
            if (isWeaponError) {
                setTimeout(() => {
                    const weaponSelectUI = document.getElementById('weapon-select-ui');
                    if (weaponSelectUI) {
                        weaponSelectUI.removeAttribute('data-error-open');
                    }
                }, 1000); // Remove flag 1 second after error hides
            } else {
                const weaponSelectUI = document.getElementById('weapon-select-ui');
                if (weaponSelectUI) {
                    weaponSelectUI.removeAttribute('data-error-open');
                }
            }
        }, 5000);
    } else {
        // Fallback to popup if no dialog is open
        const errorUI = document.getElementById('error-ui');
        const errorMessage = document.getElementById('error-message');
        
        if (errorUI && errorMessage) {
            errorMessage.textContent = message;
            showMenu('error-ui');
            
            const okBtn = document.getElementById('error-ok');
            const closeBtn = document.getElementById('error-close');
            
            const closeHandler = () => {
                hideMenu('error-ui');
                okBtn.removeEventListener('click', closeHandler);
                closeBtn.removeEventListener('click', closeHandler);
            };
            
            okBtn.addEventListener('click', closeHandler);
            closeBtn.addEventListener('click', closeHandler);
        }
    }
}

function createMenuItem(title, description, onClick) {
    const item = document.createElement('div');
    item.className = 'menu-item';
    
    const titleEl = document.createElement('div');
    titleEl.className = 'menu-item-title';
    titleEl.textContent = title;
    
    const descEl = document.createElement('div');
    descEl.className = 'menu-item-description';
    descEl.textContent = description;
    
    item.appendChild(titleEl);
    if (description) {
        item.appendChild(descEl);
    }
    
    item.addEventListener('click', onClick);
    
    return item;
}

function displayGameModes(gameModes) {
    const menu = document.getElementById('gamemode-menu');
    menu.innerHTML = '';
    
    gameModes.forEach(mode => {
        const item = createMenuItem(
            mode.name,
            `Players: ${mode.minPlayers}-${mode.maxPlayers}`,
            () => {
                fetch(`https://${GetParentResourceName()}/selectGameMode`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gameModeId: mode.id })
                });
            }
        );
        menu.appendChild(item);
    });
    
    showMenu('gamemode-ui');
}

function displayMaps(maps, forEditing, forDeleting) {
    const menu = document.getElementById('map-menu');
    menu.innerHTML = '';
    
    if (!maps || maps.length === 0) {
        const item = document.createElement('div');
        item.className = 'menu-item';
        item.style.cursor = 'default';
        item.style.opacity = '0.6';
        const titleEl = document.createElement('div');
        titleEl.className = 'menu-item-title';
        titleEl.textContent = 'No maps available';
        const descEl = document.createElement('div');
        descEl.className = 'menu-item-description';
        descEl.textContent = forEditing ? 'Please create maps using the map editor' : 'Please create maps using the map editor';
        item.appendChild(titleEl);
        item.appendChild(descEl);
        menu.appendChild(item);
    } else {
        maps.forEach(map => {
            const item = createMenuItem(
                map.name,
                `Spawns: ${map.spawns.length} | Radius: ${map.radius.toFixed(1)}m`,
                () => {
                    if (forDeleting) {
                        // Show confirmation dialog for deletion
                        showConfirmDialog(
                            `Are you sure you want to delete map "${map.name}"?\n\nThis action cannot be undone.`,
                            () => {
                                // Yes - delete the map
                                hideMenu('confirm-ui');
                                fetch(`https://${GetParentResourceName()}/deleteMap`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ mapId: map.id })
                                });
                            },
                            () => {
                                // No - do nothing
                            }
                        );
                    } else if (forEditing) {
                        // Load map for editing
                        fetch(`https://${GetParentResourceName()}/loadMapForEdit`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mapId: map.id })
                        });
                    } else {
                        // Select map for match creation
                        fetch(`https://${GetParentResourceName()}/selectMap`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mapId: map.id })
                        });
                    }
                }
            );
            menu.appendChild(item);
        });
    }
    
    showMenu('map-ui');
}

function displayAdminMatches(matches) {
    const menu = document.getElementById('admin-matches-menu');
    menu.innerHTML = '';
    
    if (!matches || matches.length === 0) {
        const item = document.createElement('div');
        item.className = 'menu-item';
        item.style.cursor = 'default';
        item.style.opacity = '0.6';
        const titleEl = document.createElement('div');
        titleEl.className = 'menu-item-title';
        titleEl.textContent = 'No active matches';
        const descEl = document.createElement('div');
        descEl.className = 'menu-item-description';
        descEl.textContent = 'There are currently no active paintball matches';
        item.appendChild(titleEl);
        item.appendChild(descEl);
        menu.appendChild(item);
    } else {
        matches.forEach(match => {
            const statusColor = match.status === 'active' ? '#00ff00' : '#ffff00';
            const statusText = match.status === 'active' ? 'Active' : 'Waiting';
            
            const item = createMenuItem(
                `${match.gameMode} - ${match.map}`,
                `Status: ${statusText} | Players: ${match.players}/${match.maxPlayers} | Bucket: ${match.bucket}`,
                () => {
                    // Show confirmation dialog
                    showConfirmDialog(
                        `Are you sure you want to close this match?\n\nGame Mode: ${match.gameMode}\nMap: ${match.map}\nPlayers: ${match.players}/${match.maxPlayers}`,
                        () => {
                            // Yes - close the match
                            fetch(`https://${GetParentResourceName()}/adminCloseMatch`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ matchId: match.id })
                            });
                        },
                        () => {
                            // No - do nothing
                        }
                    );
                }
            );
            
            // Style based on status
            const statusSpan = document.createElement('span');
            statusSpan.textContent = `[${statusText}]`;
            statusSpan.style.color = statusColor;
            statusSpan.style.marginLeft = '8px';
            
            const titleEl = item.querySelector('.menu-item-title');
            if (titleEl) {
                titleEl.appendChild(statusSpan);
            }
            
            menu.appendChild(item);
        });
    }
    
    showMenu('admin-matches-ui');
}

function displayEditorMainMenu() {
    const menu = document.getElementById('editor-main-menu');
    menu.innerHTML = '';
    
    const items = [
        {
            title: 'Create New Map',
            description: 'Start creating a new map from scratch',
            action: 'createNewMap'
        },
        {
            title: 'Edit Existing Map',
            description: 'Load and edit an existing map',
            action: 'editMap'
        },
        {
            title: 'Delete Map',
            description: 'Delete an existing map',
            action: 'deleteMap'
        }
    ];
    
    items.forEach(itemData => {
        const item = createMenuItem(
            itemData.title,
            itemData.description,
            () => {
                // Hide menu immediately for actions that should close the main menu
                if (itemData.action === 'createNewMap' || itemData.action === 'editMap' || itemData.action === 'deleteMap') {
                    hideMenu('editor-main-ui');
                }
                fetch(`https://${GetParentResourceName()}/editorMainAction`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: itemData.action })
                });
            }
        );
        menu.appendChild(item);
    });
    
    showMenu('editor-main-ui');
}

function displayEditorMenu(menuData) {
    const menu = document.getElementById('editor-menu');
    menu.innerHTML = '';
    
    // Show current map info if editing
    if (menuData.isEditing && menuData.mapName) {
        const infoItem = document.createElement('div');
        infoItem.className = 'menu-item';
        infoItem.style.background = 'rgba(0, 255, 0, 0.2)';
        infoItem.style.cursor = 'default';
        infoItem.style.marginBottom = '12px';
        const titleEl = document.createElement('div');
        titleEl.className = 'menu-item-title';
        titleEl.textContent = `Editing: ${menuData.mapName}`;
        const descEl = document.createElement('div');
        descEl.className = 'menu-item-description';
        descEl.textContent = `Radius: ${menuData.radius.toFixed(1)}m`;
        infoItem.appendChild(titleEl);
        infoItem.appendChild(descEl);
        menu.appendChild(infoItem);
    }
    
    const items = [
        {
            title: 'Set Center Point',
            description: 'Aim and place the center point of the map',
            action: 'setCenter'
        },
        {
            title: 'Add Spawn Point',
            description: 'Aim and place a spawn point',
            action: 'addSpawn'
        },
        {
            title: 'Clear Map',
            description: 'Clear all map data (center, spawns)',
            action: 'clearMap'
        },
        {
            title: 'Save Map',
            description: 'Save the current map',
            action: 'saveMap'
        },
        {
            title: 'Leave Editor',
            description: 'Exit the map editor',
            action: 'leaveEditor'
        }
    ];
    
    items.forEach(itemData => {
        const item = createMenuItem(
            itemData.title,
            itemData.description,
            () => {
                fetch(`https://${GetParentResourceName()}/editorAction`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: itemData.action })
                });
            }
        );
        menu.appendChild(item);
    });
    
    showMenu('editor-ui');
}

function displayTeamMenu() {
    const menu = document.getElementById('team-menu');
    menu.innerHTML = '';
    
    const teams = [
        { title: 'No Team / FFA', value: null },
        { title: 'Team 1', value: 1 },
        { title: 'Team 2', value: 2 }
    ];
    
    teams.forEach(team => {
        const item = createMenuItem(
            team.title,
            team.value ? `Assign spawn to ${team.title}` : 'Free for all spawn point',
            () => {
                fetch(`https://${GetParentResourceName()}/selectTeam`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ team: team.value })
                });
            }
        );
        menu.appendChild(item);
    });
    
    showMenu('team-ui');
}

function showDialog(title, placeholder, callback) {
    const dialog = document.getElementById('dialog-ui');
    const titleEl = document.getElementById('dialog-title');
    const input = document.getElementById('dialog-input');
    const errorEl = document.getElementById('dialog-error');
    
    titleEl.textContent = title;
    input.placeholder = placeholder;
    input.value = '';
    
    // Clear any previous errors
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
    
    showMenu('dialog-ui');
    
    const submitBtn = document.getElementById('dialog-submit');
    const cancelBtn = document.getElementById('dialog-cancel');
    
    const submitHandler = () => {
        const value = input.value.trim();
        if (value) {
            callback(value);
        }
        hideMenu('dialog-ui');
        submitBtn.removeEventListener('click', submitHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        input.removeEventListener('keypress', enterHandler);
    };
    
    const cancelHandler = () => {
        hideMenu('dialog-ui');
        submitBtn.removeEventListener('click', submitHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        input.removeEventListener('keypress', enterHandler);
    };
    
    const enterHandler = (e) => {
        if (e.key === 'Enter') {
            submitHandler();
        }
    };
    
    submitBtn.addEventListener('click', submitHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    input.addEventListener('keypress', enterHandler);
}

// Event listeners
document.getElementById('gamemode-close').addEventListener('click', () => {
    hideMenu('gamemode-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'gamemode' })
    });
});

document.getElementById('map-close').addEventListener('click', () => {
    hideMenu('map-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'map' })
    });
});

document.getElementById('editor-main-close').addEventListener('click', () => {
    hideMenu('editor-main-ui');
    fetch(`https://${GetParentResourceName()}/editorMainAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'closeEditorMain' })
    });
});

document.getElementById('editor-close').addEventListener('click', () => {
    hideMenu('editor-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'editor' })
    });
});

document.getElementById('team-close').addEventListener('click', () => {
    hideMenu('team-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'team' })
    });
});

document.getElementById('dialog-close').addEventListener('click', () => {
    hideMenu('dialog-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'dialog' })
    });
});

document.getElementById('main-close').addEventListener('click', () => {
    hideMenu('main-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'main' })
    });
});

document.getElementById('browser-close').addEventListener('click', () => {
    hideMenu('browser-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'browser' })
    });
});

document.getElementById('weapon-close').addEventListener('click', () => {
    hideMenu('weapon-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'weapon' })
    });
});

document.getElementById('weapon-config-close').addEventListener('click', () => {
    hideMenu('weapon-config-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'weapon-config' })
    });
});

document.getElementById('pin-close').addEventListener('click', () => {
    hideMenu('pin-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'pin' })
    });
});

document.getElementById('category-select-close').addEventListener('click', () => {
    hideMenu('category-select-ui');
    if (pendingWeaponData) {
        pendingWeaponData = null;
    }
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'category-select' })
    });
});

document.getElementById('weapon-select-close').addEventListener('click', () => {
    hideMenu('weapon-select-ui');
    if (pendingWeaponData) {
        pendingWeaponData = null;
    }
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'weapon-select' })
    });
});

document.getElementById('error-close').addEventListener('click', () => {
    hideMenu('error-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'error' })
    });
});

document.getElementById('error-ok').addEventListener('click', () => {
    hideMenu('error-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'error' })
    });
});

document.getElementById('admin-matches-close').addEventListener('click', () => {
    hideMenu('admin-matches-ui');
    fetch(`https://${GetParentResourceName()}/closeMenu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu: 'admin-matches' })
    });
});

// Message handler
window.addEventListener('message', function(event) {
    const data = event.data;
    
    if (!data || !data.action) return;
    
    switch(data.action) {
        case 'showGameModes':
            displayGameModes(data.gameModes);
            break;
        case 'showMaps':
            displayMaps(data.maps, data.forEditing || false, data.forDeleting || false);
            break;
        case 'showAdminMatches':
            displayAdminMatches(data.matches);
            break;
        case 'showEditorMainMenu':
            displayEditorMainMenu();
            break;
        case 'showEditorMenu':
            displayEditorMenu(data.menuData);
            break;
        case 'showTeamMenu':
            displayTeamMenu();
            break;
        case 'showDialog':
            showDialog(data.title, data.placeholder, (value) => {
                fetch(`https://${GetParentResourceName()}/dialogSubmit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value: value, type: data.dialogType })
                });
            });
            break;
        case 'hideMenu':
            if (data.menu) {
                hideMenu(data.menu + '-ui');
            } else {
                hideAllMenus();
            }
            break;
        case 'showPressE':
            const pressEUI = document.getElementById('press-e-ui');
            const pressEText = document.getElementById('press-e-text');
            
            if (pressEUI && pressEText) {
                if (data.text) {
                    pressEText.innerHTML = parseColorCodes(data.text);
                }
                
                if (data.x !== undefined && data.y !== undefined) {
                    updatePressEPosition(pressEUI, data.x, data.y);
                }
                
                if (data.opacity !== undefined) {
                    pressEUI.style.opacity = data.opacity;
                } else {
                    pressEUI.style.opacity = '1';
                }
                
                if (!pressEUIVisible) {
                    pressEUI.classList.remove('hidden');
                    pressEUIVisible = true;
                }
            }
            break;
        case 'hidePressE':
            const pressEUIHide = document.getElementById('press-e-ui');
            if (pressEUIHide && pressEUIVisible) {
                pressEUIHide.classList.add('hidden');
                pressEUIVisible = false;
            }
            break;
        case 'showMainMenu':
            displayMainMenu(data.hasMatch || false, data.inMatch || false, data.canStartMatch || false);
            break;
        case 'showMatchSettings':
            showMatchSettings(data.gameModeId, data.mapId);
            break;
        case 'showMatchBrowser':
            displayMatchBrowser(data.matches, data.myMatchId);
            break;
        case 'showWeaponSelection':
            displayWeaponSelection(data.categories, data.weapons, data.gameModeId, data.mapId, data.forMatch);
            break;
        case 'showWeaponConfig':
            // Don't open config menu if weapon-select-ui has an error open
            const weaponSelectUI = document.getElementById('weapon-select-ui');
            if (weaponSelectUI && weaponSelectUI.getAttribute('data-error-open') === 'true') {
                // Error is being displayed, don't switch to config menu
                break;
            }
            
            console.log('Received showWeaponConfig message:', data);
            console.log('Full data object keys:', Object.keys(data));
            console.log('Categories:', data.categories, 'Type:', typeof data.categories, 'Is Array:', Array.isArray(data.categories));
            console.log('Weapons:', data.weapons, 'Type:', typeof data.weapons, 'Is Array:', Array.isArray(data.weapons));
            console.log('Categories length:', data.categories?.length, 'Weapons length:', data.weapons?.length);
            if (data.categories && data.categories.length > 0) {
                console.log('First category:', data.categories[0]);
            }
            // Try both possible property names
            const categories = data.categories || data.Categories || [];
            const weapons = data.weapons || data.Weapons || [];
            console.log('Using categories:', categories.length, 'weapons:', weapons.length);
            displayWeaponConfig(categories, weapons);
            break;
        case 'showError':
            showError(data.message || 'An error occurred');
            break;
    }
});

// Confirmation dialog
let confirmCallback = null;

function showConfirmDialog(message, onYes, onNo) {
    const confirmUI = document.getElementById('confirm-ui');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');
    const confirmClose = document.getElementById('confirm-close');
    
    confirmMessage.textContent = message;
    showMenu('confirm-ui');
    
    // Remove old listeners
    const newYes = confirmYes.cloneNode(true);
    const newNo = confirmNo.cloneNode(true);
    const newClose = confirmClose.cloneNode(true);
    confirmYes.parentNode.replaceChild(newYes, confirmYes);
    confirmNo.parentNode.replaceChild(newNo, confirmNo);
    confirmClose.parentNode.replaceChild(newClose, confirmClose);
    
    newYes.addEventListener('click', () => {
        hideMenu('confirm-ui');
        if (onYes) onYes();
    });
    
    newNo.addEventListener('click', () => {
        hideMenu('confirm-ui');
        if (onNo) onNo();
    });
    
    newClose.addEventListener('click', () => {
        hideMenu('confirm-ui');
        if (onNo) onNo();
    });
}

// Main Menu
function displayMainMenu(hasMatch, inMatch, canStartMatch) {
    const menu = document.getElementById('main-menu');
    menu.innerHTML = '';
    
    const items = [
        {
            title: 'Create Match',
            description: 'Start a new paintball match',
            onClick: () => {
                if (hasMatch) {
                    showConfirmDialog(
                        'You already have a match created. Do you want to close it and create a new one?',
                        () => {
                            // Yes - close current match and proceed
                            hideMenu('confirm-ui');
                            fetch(`https://${GetParentResourceName()}/closeMatch`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
                            }).then(() => {
                                hideMenu('main-ui');
                                fetch(`https://${GetParentResourceName()}/mainAction`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'create' })
                                });
                            });
                        },
                        () => {
                            // No - just close dialog, keep menu open
                        }
                    );
                } else {
                    hideMenu('main-ui');
                    fetch(`https://${GetParentResourceName()}/mainAction`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'create' })
                    });
                }
            }
        },
        {
            title: 'Browse Matches',
            description: 'View and join active matches',
            onClick: () => {
                hideMenu('main-ui');
                fetch(`https://${GetParentResourceName()}/mainAction`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'browse' })
                });
            }
        }
    ];
    
    // Add Start Match button if host can start (has minimum players)
    if (canStartMatch) {
        items.push({
            title: 'Start Match',
            description: 'Start the match now',
            onClick: () => {
                hideMenu('main-ui');
                fetch(`https://${GetParentResourceName()}/startMatch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        });
    }
    
    // Add Select Weapon button if player is in a match
    if (inMatch) {
        items.push({
            title: 'Select Weapon',
            description: 'Choose your weapon for this match',
            onClick: () => {
                hideMenu('main-ui');
                fetch(`https://${GetParentResourceName()}/selectWeapon`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        });
    }
    
    // Add Close Match button if they have a match
    if (hasMatch) {
        items.push({
            title: 'Close Match',
            description: 'Close your current match',
            onClick: () => {
                hideMenu('main-ui');
                fetch(`https://${GetParentResourceName()}/closeMatch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }).then(() => {
                    // Refresh menu to remove Close Match button
                    setTimeout(() => {
                        fetch(`https://${GetParentResourceName()}/mainAction`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'refresh' })
                        });
                    }, 500);
                });
            }
        });
    }
    
    items.forEach(item => {
        const itemEl = createMenuItem(item.title, item.description, item.onClick);
        menu.appendChild(itemEl);
    });
    
    showMenu('main-ui');
}

// Match Browser
function displayMatchBrowser(matches, myMatchId) {
    const menu = document.getElementById('browser-menu');
    menu.innerHTML = '';
    
    if (!matches || matches.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'menu-item';
        empty.style.textAlign = 'center';
        empty.style.padding = '20px';
        empty.textContent = 'No active matches';
        menu.appendChild(empty);
    } else {
        matches.forEach(match => {
            const statusText = match.status === 'waiting' ? 'Waiting' : match.status === 'active' ? 'In Progress' : 'Ended';
            const statusColor = match.status === 'waiting' ? '#44ff44' : match.status === 'active' ? '#ff8844' : '#888888';
            const privacyText = match.isPrivate ? '🔒 Private' : '🌐 Public';
            const isMyMatch = myMatchId && match.id === myMatchId;
            
            const item = document.createElement('div');
            item.className = 'menu-item';
            
            // Grey out if it's the player's own match or if it's active and can't join
            if (isMyMatch) {
                item.style.cursor = 'default';
                item.style.opacity = '0.5';
                item.style.filter = 'grayscale(100%)';
            } else {
                item.style.cursor = (match.status === 'active' && !match.allowJoinInProgress) ? 'not-allowed' : 'pointer';
                item.style.opacity = (match.status === 'active' && !match.allowJoinInProgress) ? '0.6' : '1';
            }
            
            const title = document.createElement('div');
            title.className = 'menu-item-title';
            const matchTitle = isMyMatch 
                ? `${match.gameMode} - ${match.map} <span style="color: #888888; font-size: 11px;">[Your Match]</span>`
                : `${match.gameMode} - ${match.map} <span style="color: ${statusColor}; font-size: 12px;">[${statusText}]</span>`;
            title.innerHTML = matchTitle;
            
            const desc = document.createElement('div');
            desc.className = 'menu-item-description';
            desc.innerHTML = `${privacyText} | Players: ${match.players}/${match.maxPlayers}`;
            
            item.appendChild(title);
            item.appendChild(desc);
            
            // Only make clickable if it's not the player's match and not an active match that can't be joined
            if (!isMyMatch && !(match.status === 'active' && !match.allowJoinInProgress)) {
                item.addEventListener('click', () => {
                    // Check if player has a match - will be checked on client side
                    if (match.isPrivate) {
                        showPINDialog(match.id);
                    } else {
                        joinMatch(match.id, null);
                    }
                });
            }
            
            menu.appendChild(item);
        });
    }
    
    showMenu('browser-ui');
}

// Weapon Selection
let selectedWeaponData = null;
function displayWeaponSelection(categories, weapons, gameModeId, mapId, forMatch) {
    const menu = document.getElementById('weapon-menu');
    menu.innerHTML = '';
    
    // If forMatch is true, this is for selecting weapon in a match, not for match creation
    if (!forMatch) {
        selectedWeaponData = { gameModeId, mapId };
    }
    
    // Group weapons by category
    const weaponsByCategory = {};
    categories.forEach(cat => {
        if (cat.enabled) {
            weaponsByCategory[cat.id] = {
                category: cat,
                weapons: []
            };
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
        
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'menu-item';
        categoryHeader.style.background = 'rgba(9, 135, 255, 0.2)';
        categoryHeader.style.cursor = 'default';
        categoryHeader.style.fontWeight = '600';
        categoryHeader.textContent = catData.category.name;
        menu.appendChild(categoryHeader);
        
        catData.weapons.forEach(weapon => {
            const item = createMenuItem(
                weapon.name,
                `Select ${weapon.name} for this match`,
                () => {
                    if (forMatch) {
                        // Player is selecting weapon for their current match
                        hideMenu('weapon-ui');
                        fetch(`https://${GetParentResourceName()}/setPlayerWeapon`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ weaponHash: weapon.hash })
                        }).then(() => {
                            // Release NUI focus after weapon is selected
                            fetch(`https://${GetParentResourceName()}/closeMenu`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ menu: 'weapon' })
                            });
                        });
                    } else {
                        // This shouldn't happen anymore (weapon selection removed from match creation)
                        // But keep for backwards compatibility
                        showMatchSettings(weapon.hash);
                    }
                }
            );
            menu.appendChild(item);
        });
    });
    
    showMenu('weapon-ui');
}

// Match Settings (Private/PIN) - no weapon selection
function showMatchSettings(gameModeId, mapId) {
    const menu = document.getElementById('weapon-menu');
    menu.innerHTML = '';
    
    // Store game mode and map for match creation
    selectedWeaponData = { gameModeId, mapId };
    
    const privateOption = createMenuItem(
        'Create Private Match',
        'Require a PIN to join',
        () => {
            showDialog('Enter PIN', 'Enter 4-6 digit PIN', (pin) => {
                const errorEl = document.getElementById('dialog-error');
                if (pin.length >= 4 && pin.length <= 6 && /^\d+$/.test(pin)) {
                    if (errorEl) {
                        errorEl.textContent = '';
                        errorEl.style.display = 'none';
                    }
                    // Don't hide menus here - let server confirmation handle it
                    createMatch(null, true, pin);
                } else {
                    showError('PIN must be 4-6 digits');
                    // Re-show dialog with error
                    setTimeout(() => {
                        showDialog('Enter PIN', 'Enter 4-6 digit PIN', arguments.callee);
                    }, 100);
                }
            });
        }
    );
    
    const publicOption = createMenuItem(
        'Create Public Match',
        'Anyone can join',
        () => {
            // Don't hide menus here - let server confirmation handle it
            createMatch(null, false, null);
        }
    );
    
    menu.appendChild(privateOption);
    menu.appendChild(publicOption);
    showMenu('weapon-ui');
}

function createMatch(weaponHash, isPrivate, pin) {
    // Validate selectedWeaponData exists
    if (!selectedWeaponData || !selectedWeaponData.gameModeId || !selectedWeaponData.mapId) {
        showError('Missing game mode or map selection. Please try again.');
        return;
    }
    
    // Don't hide menus here - let the server confirmation handle it
    // This prevents the UI from disappearing before we know if the match was created successfully
    
    fetch(`https://${GetParentResourceName()}/createMatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            gameModeId: selectedWeaponData.gameModeId,
            mapId: selectedWeaponData.mapId,
            isPrivate: isPrivate,
            pin: pin
        })
    }).catch((error) => {
        console.error('Match creation error:', error);
        showError('Failed to create match. Please try again.');
    });
}

function showPINDialog(matchId) {
    const dialog = document.getElementById('pin-ui');
    const input = document.getElementById('pin-input');
    const errorEl = document.getElementById('pin-error');
    input.value = '';
    
    // Clear any previous errors
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
    
    showMenu('pin-ui');
    setTimeout(() => input.focus(), 100);
    
    const submitBtn = document.getElementById('pin-submit');
    const cancelBtn = document.getElementById('pin-cancel');
    
    const submitHandler = () => {
        const pin = input.value.trim();
        if (pin) {
            // joinMatch will handle the confirmation check
            joinMatch(matchId, pin);
        }
        submitBtn.removeEventListener('click', submitHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        input.removeEventListener('keypress', enterHandler);
    };
    
    const cancelHandler = () => {
        hideMenu('pin-ui');
        submitBtn.removeEventListener('click', submitHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        input.removeEventListener('keypress', enterHandler);
    };
    
    const enterHandler = (e) => {
        if (e.key === 'Enter') {
            submitHandler();
        }
    };
    
    submitBtn.addEventListener('click', submitHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    input.addEventListener('keypress', enterHandler);
}

function joinMatch(matchId, pin) {
    // Check if player has a match - this will be checked on client side
    fetch(`https://${GetParentResourceName()}/checkHasMatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json()).then(data => {
        if (data.hasMatch) {
            showConfirmDialog(
                'You already have a match created. Do you want to close it and join this match?',
                () => {
                    // Yes - close current match and join
                    hideMenu('confirm-ui');
                    hideMenu('browser-ui');
                    hideMenu('pin-ui');
                    fetch(`https://${GetParentResourceName()}/closeMatch`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    }).then(() => {
                        fetch(`https://${GetParentResourceName()}/joinMatch`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ matchId: matchId, pin: pin || null })
                        });
                    });
                },
                () => {
                    // No - just close dialog
                }
            );
        } else {
            fetch(`https://${GetParentResourceName()}/joinMatch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matchId: matchId, pin: pin || null })
            });
            hideMenu('browser-ui');
            hideMenu('pin-ui');
        }
    });
}

// Admin Weapon Config
function displayWeaponConfig(categories, weapons) {
    console.log('displayWeaponConfig called with', categories?.length || 0, 'categories and', weapons?.length || 0, 'weapons');
    
    // Store weapons list for client-side validation
    currentWeaponsList = weapons || [];
    
    // Close any open dialogs first, but respect error flag on weapon-select-ui
    hideMenu('dialog-ui');
    hideMenu('category-select-ui');
    // Don't force close weapon-select-ui if it has an error - let hideMenu handle it
    const weaponSelectUI = document.getElementById('weapon-select-ui');
    if (!weaponSelectUI || weaponSelectUI.getAttribute('data-error-open') !== 'true') {
        hideMenu('weapon-select-ui');
    }
    
    const menu = document.getElementById('weapon-config-menu');
    if (!menu) {
        console.error('weapon-config-menu element not found!');
        return;
    }
    menu.innerHTML = '';
    
    // Add Weapon button (categories are read-only from config)
    const addWepBtn = document.createElement('button');
    addWepBtn.className = 'btn-primary';
    addWepBtn.style.width = '100%';
    addWepBtn.style.marginBottom = '16px';
    addWepBtn.textContent = '+ Add Weapon';
    addWepBtn.addEventListener('click', () => {
        showAddWeaponDialog(categories);
    });
    menu.appendChild(addWepBtn);
    
    // Categories section (read-only from config)
    const catHeader = document.createElement('div');
    catHeader.className = 'menu-item';
    catHeader.style.background = 'rgba(9, 135, 255, 0.3)';
    catHeader.style.cursor = 'default';
    catHeader.style.fontWeight = '600';
    catHeader.style.marginTop = '16px';
    catHeader.textContent = 'Categories';
    menu.appendChild(catHeader);
    
    if (categories.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'menu-item';
        emptyMsg.style.opacity = '0.6';
        emptyMsg.style.cursor = 'default';
        emptyMsg.textContent = 'No categories found';
        menu.appendChild(emptyMsg);
    } else {
        categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'menu-item';
            item.style.cursor = 'default';
            item.style.opacity = cat.enabled ? '1.0' : '0.6';
            
            const left = document.createElement('div');
            left.innerHTML = `<div style="font-weight: 600;">${cat.name}</div><div style="font-size: 11px; color: #888;">ID: ${cat.id} ${cat.enabled ? '(Enabled)' : '(Disabled)'}</div>`;
            
            item.appendChild(left);
            menu.appendChild(item);
        });
    }
    
    // Weapons section
    const wepHeader = document.createElement('div');
    wepHeader.className = 'menu-item';
    wepHeader.style.background = 'rgba(9, 135, 255, 0.3)';
    wepHeader.style.cursor = 'default';
    wepHeader.style.fontWeight = '600';
    wepHeader.style.marginTop = '16px';
    wepHeader.textContent = 'Weapons';
    menu.appendChild(wepHeader);
    
    if (weapons.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'menu-item';
        emptyMsg.style.opacity = '0.6';
        emptyMsg.style.cursor = 'default';
        emptyMsg.textContent = 'No weapons yet';
        menu.appendChild(emptyMsg);
    } else {
        weapons.forEach(weapon => {
            const item = document.createElement('div');
            item.className = 'menu-item';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            
            const left = document.createElement('div');
            left.innerHTML = `<div style="font-weight: 600;">${weapon.name}</div><div style="font-size: 11px; color: #888;">${weapon.category} | Hash: ${weapon.hash}</div>`;
            
            const right = document.createElement('div');
            right.style.display = 'flex';
            right.style.gap = '8px';
            right.style.alignItems = 'center';
            
            const toggle = document.createElement('button');
            toggle.className = weapon.enabled ? 'btn-primary' : 'btn-secondary';
            toggle.style.padding = '6px 12px';
            toggle.style.fontSize = '12px';
            toggle.textContent = weapon.enabled ? 'Enabled' : 'Disabled';
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const newState = !weapon.enabled;
                weapon.enabled = newState;
                toggle.textContent = newState ? 'Enabled' : 'Disabled';
                toggle.className = newState ? 'btn-primary' : 'btn-secondary';
                fetch(`https://${GetParentResourceName()}/updateWeaponConfig`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'weapon', hash: weapon.hash, enabled: newState })
                });
            });
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-secondary';
            removeBtn.style.padding = '6px 12px';
            removeBtn.style.fontSize = '12px';
            removeBtn.style.background = 'rgba(255, 68, 68, 0.2)';
            removeBtn.style.borderColor = '#ff4444';
            removeBtn.style.color = '#ff4444';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showConfirmDialog(
                    `Are you sure you want to remove weapon "${weapon.name}"?`,
                    () => {
                        hideMenu('confirm-ui');
                        fetch(`https://${GetParentResourceName()}/removeWeapon`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ hash: weapon.hash })
                        }).then(() => {
                            setTimeout(() => {
                                fetch(`https://${GetParentResourceName()}/refreshWeaponConfig`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' }
                                });
                            }, 300);
                        });
                    },
                    () => {
                        hideMenu('confirm-ui');
                    }
                );
            });
            
            right.appendChild(toggle);
            right.appendChild(removeBtn);
            
            item.appendChild(left);
            item.appendChild(right);
            menu.appendChild(item);
        });
    }
    
    // Ensure menu is shown and visible - force display
    const weaponConfigUI = document.getElementById('weapon-config-ui');
    if (weaponConfigUI) {
        console.log('Showing weapon-config-ui menu');
        weaponConfigUI.style.display = 'flex';
        weaponConfigUI.classList.remove('hidden');
        weaponConfigUI.classList.add('active');
        currentMenu = 'weapon-config-ui';
    } else {
        console.error('weapon-config-ui element not found!');
    }
}

// Categories are read-only from config - no add category dialog
function showAddCategoryDialog() {
    // This function is no longer used - categories are defined in config.lua
    showError('Categories are read-only. Edit config.lua to modify categories.');
}

// Store weapon data temporarily for category selection
let pendingWeaponData = null;
// Store current weapons list for validation
let currentWeaponsList = [];

function showAddWeaponDialog(categories) {
    // Hide weapon config menu first
    hideMenu('weapon-config-ui');
    
    // Get OX items first
    fetch(`https://${GetParentResourceName()}/getOXItems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }).then(response => response.json())
    .then(data => {
        // Filter to only show items starting with "weapon_"
        const weaponItems = (data.items || []).filter(item => {
            const itemName = item.name || '';
            return itemName.toLowerCase().startsWith('weapon_');
        });
        showWeaponSelectionDialog(categories, weaponItems);
    })
    .catch(() => {
        // If OX items fail, show dialog without dropdown
        showWeaponSelectionDialog(categories, []);
    });
}

// Check if weapon already exists
function checkWeaponExists(weaponHash, weaponName) {
    if (!currentWeaponsList || currentWeaponsList.length === 0) {
        return false;
    }
    
    // Check if weapon exists in current list
    // Since server converts string hashes to numbers, we can't directly compare
    // Instead, we'll compare by name (which should be unique) and also try hash comparison
    return currentWeaponsList.some(weapon => {
        // Compare as strings first (for exact matches)
        if (String(weapon.hash) === String(weaponHash)) {
            return true;
        }
        // Compare as numbers if both can be converted
        const weaponHashNum = typeof weapon.hash === 'string' ? parseInt(weapon.hash) : weapon.hash;
        const inputHashNum = typeof weaponHash === 'string' ? parseInt(weaponHash) : weaponHash;
        if (!isNaN(weaponHashNum) && !isNaN(inputHashNum) && weaponHashNum === inputHashNum) {
            return true;
        }
        // Compare by name (most reliable since names should be unique)
        if (weaponName && weapon.name) {
            const existingName = String(weapon.name).toLowerCase().trim();
            const inputName = String(weaponName).toLowerCase().trim();
            if (existingName === inputName) {
                return true;
            }
        }
        // Also check if the hash string matches the weapon name (for OX items)
        if (weapon.name && String(weapon.name).toLowerCase() === String(weaponHash).toLowerCase()) {
            return true;
        }
        return false;
    });
}

function showWeaponSelectionDialog(categories, oxItems) {
    const dialog = document.getElementById('weapon-select-ui');
    const content = document.getElementById('weapon-select-content');
    const title = document.getElementById('weapon-select-title');
    const errorEl = document.getElementById('weapon-select-error');
    
    title.textContent = 'Add Weapon';
    
    // Clear any previous errors
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
    
    // Clear content but keep error element (it's a child of content)
    const children = Array.from(content.children);
    children.forEach(child => {
        if (child.id !== 'weapon-select-error') {
            child.remove();
        }
    });
    
    // Show OX selection by default if available, otherwise manual entry
    if (oxItems.length > 0) {
        showOXWeaponSelection(categories, oxItems);
    } else {
        // Create tabs for manual entry vs OX selection
        const tabContainer = document.createElement('div');
        tabContainer.style.display = 'flex';
        tabContainer.style.gap = '8px';
        tabContainer.style.marginBottom = '16px';
        
        const manualTab = document.createElement('button');
        manualTab.className = 'btn-primary';
        manualTab.style.flex = '1';
        manualTab.textContent = 'Manual Entry';
        manualTab.addEventListener('click', () => {
            showManualWeaponEntry(categories);
        });
        
        const oxTab = document.createElement('button');
        oxTab.className = 'btn-secondary';
        oxTab.style.flex = '1';
        oxTab.textContent = 'OX Items (0)';
        oxTab.disabled = true;
        
        tabContainer.appendChild(manualTab);
        tabContainer.appendChild(oxTab);
        content.appendChild(tabContainer);
        
        showManualWeaponEntry(categories);
    }
    
    showMenu('weapon-select-ui');
}

function showManualWeaponEntry(categories) {
    const content = document.getElementById('weapon-select-content');
    const errorEl = document.getElementById('weapon-select-error');
    
    // Clear any previous errors
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
    
    // Clear existing content except tabs and error element
    const tabs = content.querySelector('div:first-of-type');
    const children = Array.from(content.children);
    children.forEach(child => {
        if (child.id !== 'weapon-select-error' && child !== tabs) {
            child.remove();
        }
    });
    if (tabs && !content.contains(tabs)) {
        content.insertBefore(tabs, errorEl?.nextSibling || null);
    }
    
    const hashInput = document.createElement('input');
    hashInput.type = 'text';
    hashInput.className = 'dialog-input';
    hashInput.placeholder = 'Enter weapon hash (e.g., WEAPON_PISTOL or PISTOL)';
    hashInput.style.marginBottom = '12px';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'dialog-input';
    nameInput.placeholder = 'Enter weapon name (e.g., Pistol)';
    nameInput.style.marginBottom = '16px';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'dialog-buttons';
    
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-primary';
    submitBtn.textContent = 'Continue';
    submitBtn.addEventListener('click', () => {
        const hash = hashInput.value.trim();
        const name = nameInput.value.trim();
        
        if (!hash) {
            showError('Weapon hash is required');
            return;
        }
        if (!name) {
            showError('Weapon name is required');
            return;
        }
        
        // Check if weapon already exists
        if (checkWeaponExists(hash, name)) {
            const errorEl = document.getElementById('weapon-select-error');
            if (errorEl) {
                errorEl.textContent = 'Weapon already exists';
                errorEl.style.display = 'block';
                setTimeout(() => {
                    errorEl.textContent = '';
                    errorEl.style.display = 'none';
                }, 5000);
            }
            return;
        }
        
        pendingWeaponData = { hash, name };
        hideMenu('weapon-select-ui');
        showCategorySelectionDialog(categories, handleWeaponCategorySelection);
    });
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
        hideMenu('weapon-select-ui');
        fetch(`https://${GetParentResourceName()}/closeMenu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ menu: 'weapon-select' })
        });
    });
    
    buttonContainer.appendChild(submitBtn);
    buttonContainer.appendChild(cancelBtn);
    
    content.appendChild(hashInput);
    content.appendChild(nameInput);
    content.appendChild(buttonContainer);
    
    setTimeout(() => hashInput.focus(), 100);
}

function showOXWeaponSelection(categories, oxItems) {
    const content = document.getElementById('weapon-select-content');
    // Clear existing content except tabs
    const tabs = content.querySelector('div');
    content.innerHTML = '';
    if (tabs) content.appendChild(tabs);
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'dialog-input';
    searchInput.placeholder = 'Search items...';
    searchInput.style.marginBottom = '12px';
    
    const itemsList = document.createElement('div');
    itemsList.className = 'paintball-menu';
    itemsList.style.maxHeight = '300px';
    itemsList.style.overflowY = 'auto';
    itemsList.style.marginBottom = '16px';
    
    let filteredItems = oxItems;
    
    function renderItems() {
        itemsList.innerHTML = '';
        filteredItems.forEach(item => {
            const itemName = item.label || item.name;
            const alreadyExists = checkWeaponExists(item.name, itemName);
            
            const itemEl = createMenuItem(
                item.label || item.name,
                alreadyExists ? `Item: ${item.name} (Already Added)` : `Item: ${item.name}`,
                () => {
                    // Don't allow clicking if already exists
                    if (alreadyExists) {
                        return;
                    }
                    
                    console.log('OX item clicked:', item.name, 'label:', itemName);
                    pendingWeaponData = {
                        hash: item.name,
                        name: itemName
                    };
                    hideMenu('weapon-select-ui');
                    showCategorySelectionDialog(categories, handleWeaponCategorySelection);
                }
            );
            
            // Style disabled items
            if (alreadyExists) {
                itemEl.style.opacity = '0.5';
                itemEl.style.cursor = 'not-allowed';
                itemEl.style.filter = 'grayscale(100%)';
                itemEl.style.pointerEvents = 'none';
            }
            
            itemsList.appendChild(itemEl);
        });
        
        if (filteredItems.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'menu-item';
            empty.style.textAlign = 'center';
            empty.style.padding = '20px';
            empty.textContent = 'No items found';
            itemsList.appendChild(empty);
        }
    }
    
    searchInput.addEventListener('input', (e) => {
        const search = e.target.value.toLowerCase();
        filteredItems = oxItems.filter(item => 
            (item.name && item.name.toLowerCase().includes(search)) ||
            (item.label && item.label.toLowerCase().includes(search))
        );
        renderItems();
    });
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-secondary';
    cancelBtn.style.width = '100%';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
        hideMenu('weapon-select-ui');
        fetch(`https://${GetParentResourceName()}/closeMenu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ menu: 'weapon-select' })
        });
    });
    
    content.appendChild(searchInput);
    content.appendChild(itemsList);
    content.appendChild(cancelBtn);
    
    renderItems();
    setTimeout(() => searchInput.focus(), 100);
}

function handleWeaponCategorySelection(selectedCategory) {
    if (selectedCategory && pendingWeaponData) {
        // Close category selection dialog first
        hideMenu('category-select-ui');
        
        // Make the request - weapon already validated client-side
        fetch(`https://${GetParentResourceName()}/addWeapon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                hash: pendingWeaponData.hash, 
                name: pendingWeaponData.name, 
                category: selectedCategory.id 
            })
        }).then((response) => {
            if (response.ok) {
                // Success - clear pending data and close weapon-select-ui
                pendingWeaponData = null;
                hideMenu('weapon-select-ui');
                // The server will trigger weaponConfigUpdated which will refresh the config menu
            } else {
                // Error response - show error inline
                const errorEl = document.getElementById('weapon-select-error');
                if (errorEl) {
                    errorEl.textContent = 'Failed to add weapon. Please try again.';
                    errorEl.style.display = 'block';
                    setTimeout(() => {
                        errorEl.textContent = '';
                        errorEl.style.display = 'none';
                    }, 5000);
                }
                // Reopen weapon-select-ui to show error
                showMenu('weapon-select-ui');
            }
        }).catch(() => {
            // Network error - show error inline
            const errorEl = document.getElementById('weapon-select-error');
            if (errorEl) {
                errorEl.textContent = 'Network error. Please try again.';
                errorEl.style.display = 'block';
                setTimeout(() => {
                    errorEl.textContent = '';
                    errorEl.style.display = 'none';
                }, 5000);
            }
            // Reopen weapon-select-ui to show error
            showMenu('weapon-select-ui');
        });
    } else {
        pendingWeaponData = null;
    }
}

function showCategorySelectionDialog(categories, callback) {
    const dialog = document.getElementById('category-select-ui');
    const menu = document.getElementById('category-select-menu');
    const title = document.getElementById('category-select-title');
    
    title.textContent = 'Select Category';
    menu.innerHTML = '';
    
    if (!categories || categories.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'menu-item';
        empty.style.textAlign = 'center';
        empty.style.padding = '20px';
        empty.textContent = 'No categories available. Create one first.';
        menu.appendChild(empty);
    } else {
        categories.forEach(cat => {
            const item = createMenuItem(
                cat.name,
                `ID: ${cat.id}`,
                () => {
                    hideMenu('category-select-ui');
                    if (callback) callback(cat);
                }
            );
            menu.appendChild(item);
        });
    }
    
    // Cancel button
    const cancelItem = createMenuItem(
        'Cancel',
        'Cancel adding weapon',
        () => {
            hideMenu('category-select-ui');
            if (callback) callback(null);
            fetch(`https://${GetParentResourceName()}/closeMenu`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ menu: 'category-select' })
            });
        }
    );
    cancelItem.style.borderColor = 'rgba(255, 68, 68, 0.3)';
    menu.appendChild(cancelItem);
    
    showMenu('category-select-ui');
}

// Escape key handler
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentMenu) {
        hideAllMenus();
        fetch(`https://${GetParentResourceName()}/closeMenu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ menu: 'all' })
        });
    }
});

// Notify NUI ready
function notifyNUIReady() {
    try {
        const resourceName = GetParentResourceName();
        fetch(`https://${resourceName}/nuiReady`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ready: true })
        }).catch(() => {});
    } catch (err) {}
}

if (typeof GetParentResourceName === 'function') {
    notifyNUIReady();
} else {
    setTimeout(() => {
        if (typeof GetParentResourceName === 'function') {
            notifyNUIReady();
        }
    }, 500);
}

