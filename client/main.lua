local ESX = exports['es_extended']:getSharedObject()

-- ============================================================================
-- STATE VARIABLES
-- ============================================================================
local paintballPed = nil
local isNearPed = false
local inMatch = false
local myMatchId = nil
local currentMatchId = nil
local myMatchData = nil
local activeMatchData = nil
local isAdmin = false
local mapEditorActive = false
local currentMapData = nil
local freecamActive = false
local freecam = nil
local originalCoords = nil
local placingPoint = false
local placingType = nil
local selectedTeam = nil
local aimPosition = nil
local recentlyPlaced = {}
local paintballWeaponHash = nil
local weaponGiven = false
local boundaryZone = nil
local editorZone = nil
local previewZone = nil
local zoneDrawThreads = {} -- Track threads that draw zones
local spawnProtected = false
local spawnProtectionTime = 0
local isDead = false

-- Export for OX Inventory
exports('IsInPaintball', function()
    return inMatch
end)

-- ============================================================================
-- PED INITIALIZATION
-- ============================================================================

CreateThread(function()
    RequestModel(Config.PedLocation.model)
    while not HasModelLoaded(Config.PedLocation.model) do
        Wait(100)
    end

    paintballPed = CreatePed(4, Config.PedLocation.model, Config.PedLocation.coords.x, Config.PedLocation.coords.y, Config.PedLocation.coords.z - 1.0, Config.PedLocation.coords.w, false, true)
    
    SetEntityAsMissionEntity(paintballPed, true, true)
    SetPedDiesWhenInjured(paintballPed, false)
    SetPedCanPlayAmbientAnims(paintballPed, true)
    SetPedCanRagdollFromPlayerImpact(paintballPed, false)
    SetEntityInvincible(paintballPed, true)
    FreezeEntityPosition(paintballPed, true)
    SetBlockingOfNonTemporaryEvents(paintballPed, true)
    
    if Config.PedLocation.scenario then
        TaskStartScenarioInPlace(paintballPed, Config.PedLocation.scenario, 0, true)
    end

    SetModelAsNoLongerNeeded(Config.PedLocation.model)
end)

-- ============================================================================
-- COORDINATE UPDATES (For Server-Side Distance Validation)
-- ============================================================================

CreateThread(function()
    while true do
        Wait(2000) -- Update every 2 seconds
        if currentMatchId then
            local playerPed = PlayerPedId()
            local coords = GetEntityCoords(playerPed)
            TriggerServerEvent('envy_paintball:updatePlayerCoords', {x = coords.x, y = coords.y, z = coords.z})
        else
            Wait(5000)
        end
    end
end)

-- ============================================================================
-- UI HELPERS
-- ============================================================================

local function WorldToScreen(coords)
    if not coords then return false, 0, 0 end
    local onScreen, screenX, screenY = GetScreenCoordFromWorldCoord(coords.x, coords.y, coords.z)
    if onScreen then
        local w, h = GetActiveScreenResolution()
        return true, screenX * w, screenY * h
    end
    return false, 0, 0
end

local function ShowPressEUI(coords, text, distance, maxDistance)
    if not coords or not text then 
        SendNUIMessage({ action = 'hidePressE' })
        return false 
    end
    
    local onScreen, screenX, screenY = WorldToScreen(coords)
    if onScreen then
        local extendedMaxDistance = maxDistance * 1.2
        local fadeStartDistance = maxDistance * 0.8
        local opacity = 1.0
        
        if distance > fadeStartDistance then
            local fadeRange = extendedMaxDistance - fadeStartDistance
            if fadeRange > 0 then
                local fadeProgress = (distance - fadeStartDistance) / fadeRange
                opacity = 1.0 - (fadeProgress * fadeProgress * (3.0 - 2.0 * fadeProgress))
            end
        end
        
        opacity = math.max(0.0, math.min(1.0, opacity))
        
        SendNUIMessage({
            action = 'showPressE',
            x = screenX,
            y = screenY,
            text = text,
            opacity = opacity
        })
        return true
    else
        SendNUIMessage({ action = 'hidePressE' })
        return false
    end
end

-- ============================================================================
-- PED INTERACTION
-- ============================================================================

CreateThread(function()
    while true do
        local sleep = 1000
        local playerPed = PlayerPedId()
        local playerCoords = GetEntityCoords(playerPed)

        if paintballPed and DoesEntityExist(paintballPed) then
            local pedCoords = GetEntityCoords(paintballPed)
            local textCoords = vector3(pedCoords.x, pedCoords.y, pedCoords.z + 1.0)
            local distance = #(playerCoords - pedCoords)

            if distance <= Config.InteractionDistance then
                sleep = 0
                if not isNearPed then
                    isNearPed = true
                end
                
                ShowPressEUI(textCoords, "Press ~eb~E~s~ to open paintball menu", distance, Config.InteractionDistance)

                if IsControlJustPressed(0, Config.InteractionKey) and not inMatch then
                    if myMatchId then
                        ESX.TriggerServerCallback('envy_paintball:getMatchData', function(matchData)
                            if matchData then
                                myMatchData = matchData
                            end
                            
                            local canStartMatch = false
                            if myMatchData and myMatchData.status == "waiting" then
                                local minRequired = myMatchData.gameMode.minPlayers
                                if Config.AllowSoloTesting and isAdmin and #myMatchData.players >= 1 then
                                    minRequired = 1
                                end
                                canStartMatch = #myMatchData.players >= minRequired
                            end
                            
                            SetNuiFocus(true, true)
                            SendNUIMessage({
                                action = 'showMainMenu',
                                hasMatch = myMatchId ~= nil,
                                inMatch = currentMatchId ~= nil,
                                canStartMatch = canStartMatch
                            })
                        end, myMatchId)
                    else
                        SetNuiFocus(true, true)
                        SendNUIMessage({
                            action = 'showMainMenu',
                            hasMatch = false,
                            inMatch = currentMatchId ~= nil,
                            canStartMatch = false
                        })
                    end
                end
            else
                if isNearPed then
                    isNearPed = false
                    SendNUIMessage({ action = 'hidePressE' })
                end
            end
        end

        Wait(sleep)
    end
end)

-- ============================================================================
-- MENU FUNCTIONS
-- ============================================================================

local selectedGameMode = nil

function OpenGameModeMenu()
    SetNuiFocus(false, false)
    Wait(50)
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'showGameModes',
        gameModes = Config.GameModes
    })
end

function OpenMatchBrowser()
    ESX.TriggerServerCallback('envy_paintball:getActiveMatches', function(matches)
        SetNuiFocus(false, false)
        Wait(50)
        SetNuiFocus(true, true)
        SendNUIMessage({
            action = 'showMatchBrowser',
            matches = matches,
            myMatchId = myMatchId
        })
    end)
end

function OpenMapSelectionMenu(gameMode)
    selectedGameMode = gameMode
    ESX.TriggerServerCallback('envy_paintball:getMaps', function(maps)
        SetNuiFocus(false, false)
        Wait(50)
        SetNuiFocus(true, true)
        SendNUIMessage({
            action = 'showMaps',
            maps = maps or {}
        })
    end)
end

-- ============================================================================
-- MAP EDITOR HELPER FUNCTIONS
-- ============================================================================

local function startZoneDrawThread(zone, zoneKey)
    -- Stop existing thread if any
    if zoneDrawThreads[zoneKey] then
        zoneDrawThreads[zoneKey] = nil
    end
    
    -- Start new thread to always draw the zone (similar to PolyZone's /zone command)
    zoneDrawThreads[zoneKey] = CreateThread(function()
        while zone and not zone.destroyed do
            zone:draw(true) -- Force draw regardless of debugPoly setting
            Wait(0)
        end
        zoneDrawThreads[zoneKey] = nil
    end)
end

local function updateEditorZone()
    -- Destroy existing editor zone if any
    if editorZone then
        editorZone:destroy()
        editorZone = nil
        if zoneDrawThreads['editor'] then
            zoneDrawThreads['editor'] = nil
        end
    end
    
    -- Create new zone if center and radius are set
    if currentMapData and currentMapData.center and currentMapData.radius then
        local center = currentMapData.center
        local radius = currentMapData.radius
        
        if center.x and center.y and center.z and radius > 0 then
            local centerVec3 = vector3(center.x, center.y, center.z)
            
            editorZone = CircleZone:Create(centerVec3, radius, {
                name = "paintball_editor_zone",
                useZ = true, -- Enable 3D sphere visualization
                debugPoly = false, -- Don't use PolyZone's debug mode, we'll draw manually
                debugColor = {0, 255, 0, 30} -- Green color with transparency for editor
            })
            
            -- Start thread to always draw this zone
            startZoneDrawThread(editorZone, 'editor')
        end
    end
end

local lastPreviewPosition = nil
local lastPreviewRadius = nil
local previewZoneUpdateTimer = 0

local function updatePreviewZone(position, radius, forceUpdate)
    -- Only update if position or radius changed significantly (avoid recreating every frame)
    local needsUpdate = false
    local currentTime = GetGameTimer()
    
    if not previewZone then
        needsUpdate = true
    elseif not lastPreviewPosition or not lastPreviewRadius then
        needsUpdate = true
    else
        local distChange = #(position - lastPreviewPosition)
        local radiusChange = math.abs(radius - lastPreviewRadius)
        -- Update if position changed by more than 0.5m or radius changed by more than 0.1m
        -- Also add a small debounce (50ms) to prevent rapid destroy/recreate during fast scrolling
        if forceUpdate or distChange > 0.5 or (radiusChange > 0.1 and (currentTime - previewZoneUpdateTimer) > 50) then
            needsUpdate = true
        end
    end
    
    if needsUpdate and position and radius and radius > 0 then
        -- Destroy existing preview zone if any
        if previewZone then
            previewZone:destroy()
            previewZone = nil
        end
        
        -- Create preview zone
        previewZone = CircleZone:Create(position, radius, {
            name = "paintball_preview_zone",
            useZ = true, -- Enable 3D sphere visualization
            debugPoly = false, -- Don't use PolyZone's debug mode, we'll draw manually
            debugColor = {0, 255, 0, 30} -- Green color with transparency for preview
        })
        
        -- Start thread to always draw this zone
        startZoneDrawThread(previewZone, 'preview')
        
        lastPreviewPosition = position
        lastPreviewRadius = radius
        previewZoneUpdateTimer = currentTime
    end
end

local function destroyPreviewZone()
    if previewZone then
        previewZone:destroy()
        previewZone = nil
        if zoneDrawThreads['preview'] then
            zoneDrawThreads['preview'] = nil
        end
    end
    lastPreviewPosition = nil
    lastPreviewRadius = nil
end

-- ============================================================================
-- NUI CALLBACKS
-- ============================================================================

RegisterNUICallback('selectGameMode', function(data, cb)
    local gameModeId = data.gameModeId
    local gameMode = nil
    
    for _, mode in ipairs(Config.GameModes) do
        if mode.id == gameModeId then
            gameMode = mode
            break
        end
    end
    
    if gameMode then
        SendNUIMessage({ action = 'hideMenu', menu = 'gamemode' })
        Wait(200)
        OpenMapSelectionMenu(gameMode)
    end
    
    cb('ok')
end)

RegisterNUICallback('selectMap', function(data, cb)
    local mapId = data.mapId
    
    if selectedGameMode then
        SendNUIMessage({ action = 'hideMenu', menu = 'map' })
        Wait(200)
        SendNUIMessage({
            action = 'showMatchSettings',
            gameModeId = selectedGameMode.id,
            mapId = mapId
        })
    end
    
    cb('ok')
end)

RegisterNUICallback('loadMapForEdit', function(data, cb)
    local mapId = data.mapId
    
    ESX.TriggerServerCallback('envy_paintball:getMaps', function(maps)
        local mapToEdit = nil
        for _, map in ipairs(maps) do
            if map.id == mapId then
                mapToEdit = map
                break
            end
        end
        
        if mapToEdit then
            currentMapData = {
                id = mapToEdit.id,
                name = mapToEdit.name,
                center = mapToEdit.center,
                radius = mapToEdit.radius,
                spawns = {}
            }
            
            for _, spawn in ipairs(mapToEdit.spawns) do
                table.insert(currentMapData.spawns, {
                    x = spawn.x,
                    y = spawn.y,
                    z = spawn.z,
                    w = spawn.w or 0.0,
                    team = spawn.team
                })
            end
            
            -- Start the editor if not already active
            if not mapEditorActive then
                StartMapEditor()
                Wait(500)
            end
            
            -- Create editor zone for loaded map
            updateEditorZone()
            
            if currentMapData.center and freecam then
                SetCamCoord(freecam, currentMapData.center.x, currentMapData.center.y, currentMapData.center.z + 50.0)
            end
            
            -- Close the map selection UI
            SendNUIMessage({ action = 'hideMenu', menu = 'map' })
            SendNUIMessage({ action = 'hideMenu', menu = 'editorMain' })
            SetNuiFocus(false, false)
            ESX.ShowNotification(string.format("~g~Map '%s' loaded for editing! Press F5 for menu~s~", mapToEdit.name), "success", 3000)
        else
            ESX.ShowNotification("Map not found!", "error", 3000)
        end
    end)
    
    cb('ok')
end)

RegisterNUICallback('deleteMap', function(data, cb)
    local mapId = data.mapId
    
    if not mapId then
        ESX.ShowNotification("Invalid map ID!", "error", 3000)
        cb('ok')
        return
    end
    
    TriggerServerEvent('envy_paintball:deleteMap', mapId)
    
    -- Only close map menu if not called from dashboard (dashboard handles its own refresh)
    -- Check if dashboard is open by checking if the action is coming from dashboard context
    if not data.fromDashboard then
        -- Close map menu and release focus
        SendNUIMessage({ action = 'hideMenu', menu = 'map' })
        SetNuiFocus(false, false)
    end
    -- If from dashboard, dashboard will refresh itself via refreshDashboard callback
    
    cb('ok')
end)

RegisterNUICallback('mainAction', function(data, cb)
    local action = data.action
    if action == 'create' then
        SendNUIMessage({ action = 'hideMenu', menu = 'main' })
        Wait(200)
        OpenGameModeMenu()
    elseif action == 'browse' then
        SendNUIMessage({ action = 'hideMenu', menu = 'main' })
        Wait(200)
        OpenMatchBrowser()
    elseif action == 'refresh' then
        if myMatchId then
            ESX.TriggerServerCallback('envy_paintball:getMatchData', function(matchData)
                if matchData then
                    myMatchData = matchData
                end
                
                local canStartMatch = false
                if myMatchData and myMatchData.status == "waiting" then
                    local minRequired = myMatchData.gameMode.minPlayers
                    if Config.AllowSoloTesting and isAdmin and #myMatchData.players >= 1 then
                        minRequired = 1
                    end
                    canStartMatch = #myMatchData.players >= minRequired
                end
                
                SetNuiFocus(true, true)
                SendNUIMessage({
                    action = 'showMainMenu',
                    hasMatch = myMatchId ~= nil,
                    inMatch = currentMatchId ~= nil,
                    canStartMatch = canStartMatch
                })
            end, myMatchId)
        else
            SetNuiFocus(true, true)
            SendNUIMessage({
                action = 'showMainMenu',
                hasMatch = false,
                inMatch = currentMatchId ~= nil,
                canStartMatch = false
            })
        end
    end
    cb('ok')
end)

RegisterNUICallback('createMatch', function(data, cb)
    local gameModeId = data.gameModeId
    local mapId = data.mapId
    local isPrivate = data.isPrivate
    local pin = data.pin
    
    if not gameModeId or not mapId then
        SendNUIMessage({ action = 'showError', message = 'Missing game mode or map selection. Please try again.' })
        cb('ok')
        return
    end
    
    TriggerServerEvent('envy_paintball:startMatch', gameModeId, mapId, isPrivate, pin)
    selectedGameMode = nil
    cb('ok')
end)

RegisterNUICallback('startMatch', function(data, cb)
    if myMatchId then
        SendNUIMessage({ action = 'hideMenu', menu = 'main' })
        SetNuiFocus(false, false)
        TriggerServerEvent('envy_paintball:startMatchManual', myMatchId)
    end
    cb('ok')
end)

RegisterNUICallback('closeMatch', function(data, cb)
    if myMatchId then
        TriggerServerEvent('envy_paintball:closeMatch', myMatchId)
        myMatchId = nil
    end
    cb('ok')
end)

RegisterNUICallback('joinMatch', function(data, cb)
    local matchId = data.matchId
    local pin = data.pin
    
    SetNuiFocus(false, false)
    TriggerServerEvent('envy_paintball:joinMatch', matchId, pin)
    cb('ok')
end)

RegisterNUICallback('selectWeapon', function(data, cb)
    if not currentMatchId then
        ESX.ShowNotification("You are not in a match!", "error")
        SetNuiFocus(false, false)
        cb('ok')
        return
    end
    
    ESX.TriggerServerCallback('envy_paintball:getWeapons', function(categories, weapons)
        if not categories or not weapons then
            ESX.ShowNotification("Failed to load weapons!", "error")
            SetNuiFocus(false, false)
            cb('ok')
            return
        end
        
        SetNuiFocus(true, true)
        SendNUIMessage({
            action = 'showWeaponSelection',
            categories = categories,
            weapons = weapons,
            forMatch = true
        })
    end)
    
    cb('ok')
end)

RegisterNUICallback('setPlayerWeapon', function(data, cb)
    if not data.weaponHash then
        ESX.ShowNotification("Invalid weapon selection!", "error")
        cb('ok')
        return
    end
    
    TriggerServerEvent('envy_paintball:setPlayerWeapon', tonumber(data.weaponHash))
    cb('ok')
end)

RegisterNUICallback('closeMenu', function(data, cb)
    if data.menu == 'all' then
        SendNUIMessage({ action = 'hideMenu' })
    else
        SendNUIMessage({ action = 'hideMenu', menu = data.menu })
    end
    
    CreateThread(function()
        Wait(50)
        SetNuiFocus(false, false)
    end)
    
    cb('ok')
end)

RegisterNUICallback('updateWeaponConfig', function(data, cb)
    TriggerServerEvent('envy_paintball:updateWeaponConfig', data.type, data.id or data.hash, data.enabled)
    cb('ok')
end)

RegisterNUICallback('addWeapon', function(data, cb)
    TriggerServerEvent('envy_paintball:addWeapon', data.hash, data.name, data.category)
    cb('ok')
end)

RegisterNUICallback('addLicense', function(data, cb)
    TriggerServerEvent('envy_paintball:addLicense', data.license)
    cb('ok')
end)

RegisterNUICallback('removeLicense', function(data, cb)
    TriggerServerEvent('envy_paintball:removeLicense', data.license)
    cb('ok')
end)

RegisterNUICallback('searchPlayers', function(data, cb)
    ESX.TriggerServerCallback('envy_paintball:searchPlayers', function(result)
        cb(result)
    end, data.searchTerm)
end)

RegisterNUICallback('removeWeapon', function(data, cb)
    TriggerServerEvent('envy_paintball:removeWeapon', data.hash)
    cb('ok')
end)

RegisterNUICallback('refreshWeaponConfig', function(data, cb)
    -- Refresh dashboard (redirects to dashboard)
    local preserveTab = 'weapons'
    ESX.TriggerServerCallback('envy_paintball:isOwner', function(isOwnerStatus)
        local isOwnerBool = (isOwnerStatus == true or isOwnerStatus == 1) and true or false
        ESX.TriggerServerCallback('envy_paintball:getLicenses', function(licenses)
            ESX.TriggerServerCallback('envy_paintball:getMaps', function(maps)
                ESX.TriggerServerCallback('envy_paintball:getAllWeapons', function(weaponData)
                    ESX.TriggerServerCallback('envy_paintball:getAllActiveMatches', function(matches)
                        SetNuiFocus(true, true)
                        SendNUIMessage({
                            action = 'showAdminDashboard',
                            maps = maps or {},
                            weapons = weaponData.weapons or {},
                            categories = weaponData.categories or {},
                            matches = matches or {},
                            licenses = licenses or {},
                            isOwner = isOwnerBool,
                            defaultTab = preserveTab
                        })
                    end)
                end)
            end)
        end)
    end)
    cb('ok')
end)

RegisterNUICallback('refreshDashboard', function(data, cb)
    local preserveTab = data and data.preserveTab or nil
            ESX.TriggerServerCallback('envy_paintball:isOwner', function(isOwnerStatus)
                -- Convert truthy value to explicit boolean
                local isOwnerBool = (isOwnerStatus == true or isOwnerStatus == 1) and true or false
                ESX.TriggerServerCallback('envy_paintball:getLicenses', function(licenses)
                    ESX.TriggerServerCallback('envy_paintball:getMaps', function(maps)
                        ESX.TriggerServerCallback('envy_paintball:getAllWeapons', function(weaponData)
                            ESX.TriggerServerCallback('envy_paintball:getAllActiveMatches', function(matches)
                                SetNuiFocus(true, true)
                                SendNUIMessage({
                                    action = 'showAdminDashboard',
                                    maps = maps or {},
                                    weapons = weaponData.weapons or {},
                                    categories = weaponData.categories or {},
                                    matches = matches or {},
                                    licenses = licenses or {},
                                    isOwner = isOwnerBool,
                                    defaultTab = preserveTab
                                })
                            end)
                        end)
                    end)
                end)
            end)
    cb('ok')
end)

RegisterNUICallback('getOXItems', function(data, cb)
    ESX.TriggerServerCallback('envy_paintball:getOXItems', function(items)
        cb({ items = items })
    end)
end)

RegisterNUICallback('adminCloseMatch', function(data, cb)
    local matchId = data.matchId
    local fromDashboard = data.fromDashboard or false
    TriggerServerEvent('envy_paintball:adminCloseMatch', matchId)
    Wait(500)
    
    if fromDashboard then
        -- Refresh dashboard
        ESX.TriggerServerCallback('envy_paintball:isOwner', function(isOwnerStatus)
            -- Convert truthy value (1, true) to explicit boolean
            local isOwnerBool = (isOwnerStatus == true or isOwnerStatus == 1) and true or false
            ESX.TriggerServerCallback('envy_paintball:getLicenses', function(licenses)
                ESX.TriggerServerCallback('envy_paintball:getMaps', function(maps)
                    ESX.TriggerServerCallback('envy_paintball:getAllWeapons', function(weaponData)
                        ESX.TriggerServerCallback('envy_paintball:getAllActiveMatches', function(matches)
                            SendNUIMessage({
                                action = 'showAdminDashboard',
                                maps = maps or {},
                                weapons = weaponData.weapons or {},
                                categories = weaponData.categories or {},
                                matches = matches or {},
                                licenses = licenses or {},
                                isOwner = isOwnerBool,
                                defaultTab = 'matches'
                            })
                        end)
                    end)
                end)
            end)
        end)
    else
        -- Fallback: refresh dashboard
        ESX.TriggerServerCallback('envy_paintball:isOwner', function(isOwnerStatus)
            local isOwnerBool = (isOwnerStatus == true or isOwnerStatus == 1) and true or false
            ESX.TriggerServerCallback('envy_paintball:getLicenses', function(licenses)
                ESX.TriggerServerCallback('envy_paintball:getMaps', function(maps)
                    ESX.TriggerServerCallback('envy_paintball:getAllWeapons', function(weaponData)
                        ESX.TriggerServerCallback('envy_paintball:getAllActiveMatches', function(matches)
                            SendNUIMessage({
                                action = 'showAdminDashboard',
                                maps = maps or {},
                                weapons = weaponData.weapons or {},
                                categories = weaponData.categories or {},
                                matches = matches or {},
                                licenses = licenses or {},
                                isOwner = isOwnerBool,
                                defaultTab = 'matches'
                            })
                        end)
                    end)
                end)
            end)
        end)
    end
    cb('ok')
end)

RegisterNUICallback('nuiReady', function(data, cb)
    cb('ok')
end)

-- ============================================================================
-- BOUNDARY ZONE HELPER FUNCTIONS
-- ============================================================================

local function createBoundaryZone(matchData)
    if not matchData or not matchData.map or not matchData.map.center or not matchData.map.radius then
        return
    end
    
    local center = matchData.map.center
    local radius = matchData.map.radius
    
    if not center or not center.x or not center.y or not center.z or not radius or radius <= 0 then
        return
    end
    
    local centerVec3 = vector3(center.x, center.y, center.z)
    
    -- Destroy existing zone if any
    if boundaryZone then
        boundaryZone:destroy()
        boundaryZone = nil
        if zoneDrawThreads['boundary'] then
            zoneDrawThreads['boundary'] = nil
        end
    end
    
    -- Create new CircleZone with sphere visualization
    boundaryZone = CircleZone:Create(centerVec3, radius, {
        name = "paintball_boundary",
        useZ = true, -- Enable 3D sphere instead of 2D circle
        debugPoly = false, -- Don't use PolyZone's debug mode, we'll draw manually
        debugColor = {255, 0, 0, 48} -- Red color with transparency
    })
    
    -- Start thread to always draw this zone
    startZoneDrawThread(boundaryZone, 'boundary')
    
    -- Handle player entering/exiting the zone
    boundaryZone:onPlayerInOut(function(isInside, point)
        -- Only handle when player exits the zone (isInside is false)
        if isInside or not inMatch or not activeMatchData then return end
        
        local matchData = activeMatchData
        local spawns = matchData.map and matchData.map.spawns
        local ped = PlayerPedId()
        local pedCoords = GetEntityCoords(ped)
        
        if spawns and #spawns > 0 then
            -- Select a random spawn point
            local spawnIndex = math.random(1, #spawns)
            local spawn = spawns[spawnIndex]
            
            if spawn and spawn.x and spawn.y and spawn.z then
                -- Teleport player to spawn point
                SetEntityCoords(ped, spawn.x, spawn.y, spawn.z, false, false, false, true)
                if spawn.w then
                    SetEntityHeading(ped, spawn.w)
                end
                
                ESX.ShowNotification("~r~You left the match boundary! Respawned at spawn point.~s~", "error", 3000)
            end
        else
            -- Fallback: push back towards center if no spawn points available
            local center = matchData.map.center
            if center then
                local dx = pedCoords.x - center.x
                local dy = pedCoords.y - center.y
                local distance2D = math.sqrt(dx * dx + dy * dy)
                
                if distance2D > 0.001 then
                    local directionX = -dx / distance2D
                    local directionY = -dy / distance2D
                    local newX = center.x + directionX * (radius - 0.5)
                    local newY = center.y + directionY * (radius - 0.5)
                    local foundGround, groundZ = GetGroundZFor_3dCoord(newX, newY, pedCoords.z + 10.0)
                    local newZ = foundGround and groundZ or pedCoords.z
                    SetEntityCoordsNoOffset(ped, newX, newY, newZ, false, false, false)
                    
                    ESX.ShowNotification("~r~You cannot leave the match boundary!~s~", "error", 2000)
                end
            end
        end
    end)
end

local function destroyBoundaryZone()
    if boundaryZone then
        boundaryZone:destroy()
        boundaryZone = nil
        if zoneDrawThreads['boundary'] then
            zoneDrawThreads['boundary'] = nil
        end
    end
end

-- ============================================================================
-- NET EVENTS - MATCH EVENTS
-- ============================================================================

RegisterNetEvent('envy_paintball:showError', function(message)
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'showError', message = message })
end)

RegisterNetEvent('envy_paintball:matchStarted', function(matchData)
    if matchData then
        currentMatchId = matchData.id
        if matchData.host == GetPlayerServerId(PlayerId()) then
            myMatchId = matchData.id
            myMatchData = matchData
        end
    end
    
    SendNUIMessage({ action = 'hideMenu' })
    CreateThread(function()
        Wait(100)
        SetNuiFocus(false, false)
    end)
    
    if matchData and matchData.status == "active" then
        inMatch = true
        ESX.ShowNotification("Match started! Good luck!", "success")
    else
        ESX.ShowNotification("Match created! Waiting for players...", "info")
    end
end)

RegisterNetEvent('envy_paintball:matchActive', function(matchData)
    inMatch = true
    activeMatchData = matchData
    weaponGiven = false
    LocalPlayer.state:set('invBusy', true, true)
    
    -- Create PolyZone circle zone for boundary
    createBoundaryZone(matchData)
    
    ESX.ShowNotification("Match started! Good luck!", "success")
end)

-- Scoreboard toggle state
local scoreboardVisible = false
local postMatchScoreboardVisible = false
local scoreboardData = nil

-- Update scoreboard data
RegisterNetEvent('envy_paintball:updateScoreboard', function(data)
    if not inMatch then return end
    
    -- Store scoreboard data
    scoreboardData = data
    
    -- Update scoreboard UI if visible (no focus, just display)
    if scoreboardVisible then
        SendNUIMessage({
            action = 'updateScoreboard',
            data = data
        })
    end
end)

-- Toggle scoreboard with G key (hold)
CreateThread(function()
    while true do
        Wait(0)
        if inMatch then
            if IsControlPressed(0, 47) then -- G key (hold)
                if not scoreboardVisible then
                    -- Request scoreboard data from server if we don't have it
                    if not scoreboardData then
                        TriggerServerEvent('envy_paintball:requestScoreboard')
                    else
                        -- Show scoreboard with existing data
                        SendNUIMessage({
                            action = 'updateScoreboard',
                            data = scoreboardData
                        })
                    end
                    scoreboardVisible = true
                end
            else
                if scoreboardVisible then
                    -- Hide scoreboard when G is released
                    SendNUIMessage({ action = 'hideScoreboard' })
                    scoreboardVisible = false
                end
            end
        else
            -- Hide scoreboard when not in match
            if scoreboardVisible then
                SendNUIMessage({ action = 'hideScoreboard' })
                scoreboardVisible = false
            end
            scoreboardData = nil
            
            -- Handle G key for post-match scoreboard (close)
            if IsControlJustPressed(0, 47) then -- G key (press)
                if postMatchScoreboardVisible then
                    SendNUIMessage({ action = 'hidePostMatchScoreboard' })
                    postMatchScoreboardVisible = false
                    SetNuiFocus(false, false) -- Disable cursor and NUI focus
                end
            end
        end
    end
end)

-- Show post-match scoreboard
RegisterNetEvent('envy_paintball:showPostMatchScoreboard', function(postMatchData)
    postMatchScoreboardVisible = true
    SetNuiFocus(true, true) -- Enable cursor and NUI focus
    SendNUIMessage({
        action = 'showPostMatchScoreboard',
        data = postMatchData
    })
end)

RegisterNetEvent('envy_paintball:matchEnded', function()
    inMatch = false
    myMatchId = nil
    currentMatchId = nil
    myMatchData = nil
    activeMatchData = nil
    LocalPlayer.state:set('invBusy', false, true)
    paintballWeaponHash = nil
    weaponGiven = false
    
    -- Hide scoreboard
    scoreboardVisible = false
    SendNUIMessage({ action = 'hideScoreboard' })
    
    local ped = PlayerPedId()
    
    -- Clear any ongoing animations
    ClearPedTasksImmediately(ped)
    
    -- Disable spawn protection and restore opacity
    if spawnProtected then
        spawnProtected = false
        SetEntityInvincible(ped, false)
        ResetEntityAlpha(ped) -- Restore full opacity
        TriggerServerEvent('envy_paintball:spawnProtectionEnded') -- Notify server
    end
    
    -- Clear all ghosting (server will handle cleanup, but clear locally too)
    ghostedPlayers = {}
    
    isDead = false
    
    -- Destroy boundary zone
    destroyBoundaryZone()
    
    -- Removed duplicate notification - server already sends notification with reason via EndMatch
end)

RegisterNetEvent('envy_paintball:matchJoined', function(matchData)
    if matchData then
        currentMatchId = matchData.id
        
        if matchData.status == "active" then
            weaponGiven = false
            inMatch = true
            activeMatchData = matchData
            LocalPlayer.state:set('invBusy', true, true)
            
            -- Create PolyZone circle zone for boundary
            createBoundaryZone(matchData)
        end
    end
    ESX.ShowNotification("Joined match! Good luck!", "success")
end)

RegisterNetEvent('envy_paintball:matchUpdated', function(matchData)
    if matchData and matchData.host == GetPlayerServerId(PlayerId()) then
        myMatchData = matchData
    end
end)

RegisterNetEvent('envy_paintball:giveWeapon', function(weaponHash, ammo)
    local ped = PlayerPedId()
    if not weaponHash then return end
    
    local ammoAmount = ammo or Config.PaintballAmmo
    paintballWeaponHash = weaponHash
    
    -- Check if player has a weapon equipped
    local currentWeapon = GetSelectedPedWeapon(ped)
    local unarmedHash = `WEAPON_UNARMED`
    
    if currentWeapon ~= unarmedHash then
        -- Player has a weapon equipped, unequip it first
        -- Disarm ox_inventory weapon if it exists
        if GetResourceState("ox_inventory") == "started" then
            TriggerEvent('ox_inventory:disarm', true) -- true = no animation
        end
    end
    
    -- Remove all weapons to ensure clean state
    RemoveAllPedWeapons(ped, true)
    
    -- Disable ox_inventory weapon handling (already handled by IsInPaintball export, but ensure it's set)
    -- The IsInPaintball export should already prevent ox_inventory from interfering
    
    -- Give weapon (allow on respawn, so don't check weaponGiven)
    GiveWeaponToPed(ped, weaponHash, ammoAmount, false, true)
    SetCurrentPedWeapon(ped, weaponHash, true)
    SetPedAmmo(ped, weaponHash, ammoAmount)
    RefillAmmoInstantly(ped)
    
    weaponGiven = true
end)

RegisterNetEvent('envy_paintball:removeWeapon', function(weaponHash)
    local ped = PlayerPedId()
    if not weaponHash then return end
    
    if HasPedGotWeapon(ped, weaponHash) then
        RemoveWeaponFromPed(ped, weaponHash)
    end
end)

RegisterNetEvent('envy_paintball:rewardAmmoForKill', function(weaponHash, ammoReward)
    local ped = PlayerPedId()
    
    if not weaponHash or not HasPedGotWeapon(ped, weaponHash) then
        return
    end
    
    local currentAmmo = GetAmmoInPedWeapon(ped, weaponHash)
    local newAmmo = math.min(currentAmmo + ammoReward, Config.MaxAmmo)
    SetPedAmmo(ped, weaponHash, newAmmo)
    
    ESX.ShowNotification(string.format("+%d Ammo (Total: %d/%d)", ammoReward, newAmmo, Config.MaxAmmo), "success")
end)

-- Track if we're already teleporting to prevent multiple teleports
local isTeleportingToPed = false

RegisterNetEvent('envy_paintball:teleportToPed', function(coords)
    -- Prevent multiple teleports
    if isTeleportingToPed then return end
    isTeleportingToPed = true
    
    local ped = PlayerPedId()
    
    -- Clear any ongoing animations
    ClearPedTasksImmediately(ped)
    
    -- Wait a moment to ensure revive has completed
    Wait(500)
    
    -- Use SetEntityCoords with all flags to ensure proper teleportation
    SetEntityCoords(ped, coords.x, coords.y, coords.z, false, false, false, true)
    SetEntityHeading(ped, coords.w or 0.0)
    
    -- Ensure player stays at this location (prevent ESX from restoring position)
    -- Only teleport once more if needed, not repeatedly
    CreateThread(function()
        local targetCoords = vector3(coords.x, coords.y, coords.z)
        local teleportedOnce = false
        -- Check once after a short delay, and only teleport back if moved
        Wait(1000)
        local currentCoords = GetEntityCoords(ped)
        local distance = #(currentCoords - targetCoords)
        if distance > 2.0 and not teleportedOnce then
            -- Player was moved, teleport back ONCE
            SetEntityCoords(ped, coords.x, coords.y, coords.z, false, false, false, true)
            SetEntityHeading(ped, coords.w or 0.0)
            teleportedOnce = true
        end
        
        -- Reset flag after monitoring is done
        Wait(2000)
        isTeleportingToPed = false
    end)
end)

RegisterNetEvent('envy_paintball:teleportToSpawn', function(spawn)
    local ped = PlayerPedId()
    SetEntityCoords(ped, spawn.x, spawn.y, spawn.z, false, false, false, true)
    SetEntityHeading(ped, spawn.w or 0.0)
end)

-- Track which players are ghosted (store ped references like the forum example)
local ghostedPlayers = {}

-- Update ghosted players list from server
RegisterNetEvent('envy_paintball:updateGhostedPlayers', function(serverGhostedList)
    if not inMatch then return end
    
    -- Get list of players that were ghosted before
    local previouslyGhosted = {}
    for playerId, _ in pairs(ghostedPlayers) do
        previouslyGhosted[playerId] = true
    end
    
    -- Clear current list
    ghostedPlayers = {}
    
    -- Update with server data - get ped references
    if serverGhostedList then
        for playerId, _ in pairs(serverGhostedList) do
            local targetPlayer = GetPlayerFromServerId(playerId)
            if targetPlayer ~= -1 then
                local targetPed = GetPlayerPed(targetPlayer)
                if DoesEntityExist(targetPed) then
                    ghostedPlayers[playerId] = targetPed
                end
            end
        end
    end
    
    -- Reset alpha for players that are no longer ghosted
    for playerId, _ in pairs(previouslyGhosted) do
        if not ghostedPlayers[playerId] then
            local targetPlayer = GetPlayerFromServerId(playerId)
            if targetPlayer ~= -1 then
                local targetPed = GetPlayerPed(targetPlayer)
                if DoesEntityExist(targetPed) then
                    ResetEntityAlpha(targetPed)
                end
            end
        end
    end
end)

-- Continuously apply ghosting to players (every frame like the forum example)
CreateThread(function()
    while true do
        Wait(0) -- Every frame for maximum visibility
        
        if inMatch then
            -- Continuously apply alpha to all ghosted players
            for playerId, ped in pairs(ghostedPlayers) do
                if DoesEntityExist(ped) then
                    SetEntityAlpha(ped, 150, false) -- Semi-transparent
                else
                    -- Ped no longer exists, try to get it again
                    local targetPlayer = GetPlayerFromServerId(playerId)
                    if targetPlayer ~= -1 then
                        local newPed = GetPlayerPed(targetPlayer)
                        if DoesEntityExist(newPed) then
                            ghostedPlayers[playerId] = newPed
                        else
                            -- Player might have left, remove from list
                            ghostedPlayers[playerId] = nil
                        end
                    else
                        -- Player not found, remove from list
                        ghostedPlayers[playerId] = nil
                    end
                end
            end
            
            -- Reset alpha for players NOT in ghosted list (ensure they're fully visible)
            if activeMatchData and activeMatchData.players then
                local myServerId = GetPlayerServerId(PlayerId())
                for _, playerId in ipairs(activeMatchData.players) do
                    if not ghostedPlayers[playerId] and playerId ~= myServerId then
                        local targetPlayer = GetPlayerFromServerId(playerId)
                        if targetPlayer ~= -1 then
                            local targetPed = GetPlayerPed(targetPlayer)
                            if DoesEntityExist(targetPed) then
                                ResetEntityAlpha(targetPed)
                            end
                        end
                    end
                end
            end
        else
            -- Clear all ghosting when not in match
            if next(ghostedPlayers) then
                for playerId, ped in pairs(ghostedPlayers) do
                    if DoesEntityExist(ped) then
                        ResetEntityAlpha(ped)
                    end
                end
                ghostedPlayers = {}
            end
        end
    end
end)

-- Respawn ped function (simplified version for paintball)
function RespawnPed(ped, coords, heading, setInvincible)
    -- Handle both vector3 and vector4, or table with x,y,z
    local x, y, z
    if type(coords) == "table" then
        if coords.x and coords.y and coords.z then
            x, y, z = coords.x, coords.y, coords.z
        else
            -- Fallback: try to extract from array
            x, y, z = coords[1] or 0.0, coords[2] or 0.0, coords[3] or 0.0
        end
    else
        -- Fallback
        local currentCoords = GetEntityCoords(ped)
        x, y, z = currentCoords.x, currentCoords.y, currentCoords.z
    end
    
    -- Find ground Z to prevent spawning underground
    local found, groundZ = GetGroundZFor_3dCoord(x, y, z, false)
    if found then
        z = groundZ + 1.0 -- Add 1.0 to ensure we're above ground
    end
    
    local h = heading or 0.0
    
    -- Resurrect first, then set position
    NetworkResurrectLocalPlayer(x, y, z, h, true, false)
    SetEntityCoordsNoOffset(ped, x, y, z, false, false, false)
    SetEntityHeading(ped, h)
    
    -- Explicitly unfreeze player (in case they were frozen from death/previous state)
    FreezeEntityPosition(ped, false)
    
    -- Only set invincible to false if not explicitly told to keep it
    if setInvincible ~= true then
        SetEntityInvincible(ped, false)
    end
    
    ClearPedBloodDamage(ped)
    
    -- Ensure ped can move and ragdoll
    SetPedCanRagdoll(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, false)

    TriggerEvent('esx_basicneeds:resetStatus')
    TriggerServerEvent('esx:onPlayerSpawn')
    TriggerEvent('esx:onPlayerSpawn')
    TriggerEvent('playerSpawned') -- compatibility with old scripts, will be removed soon
end

-- Custom revive function for paintball (no screen fades, no death cam, just revive)
function PaintballRevive(ped, coords, heading, keepInvincible)
    -- Set death status to false
    TriggerServerEvent('esx_ambulancejob:setDeathStatus', false)
    
    -- Resurrect player at spawn location (keepInvincible = true means don't set invincible to false)
    RespawnPed(ped, coords, heading, keepInvincible)
    
    ClearTimecycleModifier()
    SetPedMotionBlur(ped, false)
    ClearExtraTimecycleModifier()
    -- Reset death state
    isDead = false
end

-- Custom revive event for paintball (works in or out of match)
RegisterNetEvent('envy_paintball:revive')
AddEventHandler('envy_paintball:revive', function(coords, heading)
    local ped = PlayerPedId()
    -- If coords provided, use it; otherwise use current coords
    local reviveCoords = coords
    if not reviveCoords then
        reviveCoords = GetEntityCoords(ped)
    end
    PaintballRevive(ped, reviveCoords, heading or GetEntityHeading(ped))
end)

-- Handle respawn
RegisterNetEvent('envy_paintball:respawnPlayer', function(spawn)
    if not inMatch then return end
    
    local ped = PlayerPedId()
    
    -- Explicitly unfreeze player first (in case they were frozen from death/previous state)
    FreezeEntityPosition(ped, false)
    
    -- Revive player at spawn location using our custom revive (keepInvincible = true)
    PaintballRevive(ped, spawn, spawn.w or 0.0, true)
    
    -- Ensure player is unfrozen after revive
    FreezeEntityPosition(ped, false)
    
    -- IMMEDIATELY enable spawn protection after revive
    spawnProtected = true
    spawnProtectionTime = GetGameTimer()
    SetEntityInvincible(ped, true) -- Godmode
    
    -- Make player transparent (ghosted) but keep collision so shots can hit
    -- Set alpha locally - server will notify other clients and continuous loop will maintain it
    SetEntityAlpha(ped, 150, false) -- 150/255 = semi-transparent
    
    -- Start spawn protection thread IMMEDIATELY (runs in parallel with animation)
    CreateThread(function()
        local startTime = GetGameTimer()
        local protectionDuration = Config.SpawnProtectionTime * 1000
        
        while spawnProtected do
            Wait(0)
            local currentTime = GetGameTimer()
            local elapsed = currentTime - startTime
            
            -- Check if player shot (disable protection)
            if IsPedShooting(ped) then
                spawnProtected = false
                SetEntityInvincible(ped, false)
                
                -- Remove self from ghosted list immediately
                local myServerId = GetPlayerServerId(PlayerId())
                ghostedPlayers[myServerId] = nil
                
                ResetEntityAlpha(ped) -- Restore full opacity
                TriggerServerEvent('envy_paintball:spawnProtectionEnded') -- Notify server to update other clients
                ESX.ShowNotification("~r~Spawn protection removed!~s~", "info", 2000)
                break
            end
            
            -- Check if time expired
            if elapsed >= protectionDuration then
                spawnProtected = false
                SetEntityInvincible(ped, false)
                
                -- Remove self from ghosted list immediately
                local myServerId = GetPlayerServerId(PlayerId())
                ghostedPlayers[myServerId] = nil
                
                ResetEntityAlpha(ped) -- Restore full opacity
                TriggerServerEvent('envy_paintball:spawnProtectionEnded') -- Notify server to update other clients
                ESX.ShowNotification("~g~Spawn protection expired!~s~", "info", 2000)
                break
            end
            
            -- Visual indicator for spawn protection
            local remaining = math.ceil((protectionDuration - elapsed) / 1000)
            if remaining > 0 then
                DrawText2D(0.5, 0.85, string.format("~y~Spawn Protection: %d seconds~s~", remaining), 0.4)
            end
        end
    end)
    
    -- Play getting up animation (runs in parallel with spawn protection)
    ESX.Streaming.RequestAnimDict("get_up@directional@movement@from_knees@action")
    while not HasAnimDictLoaded("get_up@directional@movement@from_knees@action") do
        Wait(100)
    end
    
    -- Play animation
    TaskPlayAnim(ped, "get_up@directional@movement@from_knees@action", "getup_l_0", 7.0, -7.0, -1, 0, 0, false, false, false)

    Wait(500)
    StopAnimTask(ped, "get_up@directional@movement@from_knees@action", "getup_l_0", 1.0)
end)

RegisterNetEvent('envy_paintball:openWeaponConfig', function()
    -- Open dashboard with weapons tab selected
    ESX.TriggerServerCallback('envy_paintball:isOwner', function(isOwnerStatus)
        -- Convert truthy value (1, true) to explicit boolean
        local isOwnerBool = (isOwnerStatus == true or isOwnerStatus == 1) and true or false
        ESX.TriggerServerCallback('envy_paintball:getLicenses', function(licenses)
            ESX.TriggerServerCallback('envy_paintball:getMaps', function(maps)
                ESX.TriggerServerCallback('envy_paintball:getAllWeapons', function(weaponData)
                    ESX.TriggerServerCallback('envy_paintball:getAllActiveMatches', function(matches)
                        SetNuiFocus(true, true)
                        SendNUIMessage({
                            action = 'showAdminDashboard',
                            maps = maps or {},
                            weapons = weaponData.weapons or {},
                            categories = weaponData.categories or {},
                            matches = matches or {},
                            licenses = licenses or {},
                            isOwner = isOwnerBool,
                            defaultTab = 'weapons'
                        })
                    end)
                end)
            end)
        end)
    end)
end)

RegisterNetEvent('envy_paintball:weaponConfigUpdated', function()
    -- Check if dashboard is open, if so refresh it
    ESX.TriggerServerCallback('envy_paintball:isOwner', function(isOwnerStatus)
        -- Convert truthy value (1, true) to explicit boolean
        local isOwnerBool = (isOwnerStatus == true or isOwnerStatus == 1) and true or false
        ESX.TriggerServerCallback('envy_paintball:getLicenses', function(licenses)
            ESX.TriggerServerCallback('envy_paintball:getMaps', function(maps)
                ESX.TriggerServerCallback('envy_paintball:getAllWeapons', function(weaponData)
                    ESX.TriggerServerCallback('envy_paintball:getAllActiveMatches', function(matches)
                        Wait(100)
                        SetNuiFocus(true, true)
                        -- Refresh dashboard
                        SendNUIMessage({
                            action = 'showAdminDashboard',
                            maps = maps or {},
                            weapons = weaponData.weapons or {},
                            categories = weaponData.categories or {},
                            matches = matches or {},
                            licenses = licenses or {},
                            isOwner = isOwnerBool,
                            defaultTab = 'weapons'
                        })
                    end)
                end)
            end)
        end)
    end)
end)

-- ============================================================================
-- WEAPON RELOAD ENABLER
-- ============================================================================

CreateThread(function()
    while true do
        if inMatch and paintballWeaponHash then
            Wait(0)
            EnableControlAction(0, 23, true)
            EnableControlAction(0, 36, true)
        else
            Wait(500)
        end
    end
end)

-- ============================================================================
-- SPAWN POINT DEBUG VISUALIZATION
-- ============================================================================

CreateThread(function()
    while true do
        if Config.ShowSpawnPoints and inMatch and activeMatchData and activeMatchData.map and activeMatchData.map.spawns then
            Wait(0)
            -- Store local reference to prevent race condition
            local matchData = activeMatchData
            if matchData and matchData.map and matchData.map.spawns then
                local ped = PlayerPedId()
                local pedCoords = GetEntityCoords(ped)
                local spawns = matchData.map.spawns
                
                for i, spawn in ipairs(spawns) do
                    local spawnPos = vector3(spawn.x, spawn.y, spawn.z)
                    local distance = #(pedCoords - spawnPos)
                    
                    if distance < 100.0 then
                        local teamColor = spawn.team and (spawn.team == 1 and {255, 0, 0} or {0, 0, 255}) or {0, 255, 0}
                        
                        DrawMarker(1, spawn.x, spawn.y, spawn.z - 0.5, 0.0, 0.0, 0.0, 0, 0.0, 0.0, 1.0, 1.0, 1.0, teamColor[1], teamColor[2], teamColor[3], 150, false, false, 2, false, false, false, false)
                        DrawMarker(28, spawn.x, spawn.y, spawn.z, 0.0, 0.0, 0.0, 0, 0.0, 0.0, 0.8, 0.8, 0.3, teamColor[1], teamColor[2], teamColor[3], 150, false, false, 2, false, false, false, false)
                        
                        local label = spawn.team and string.format("~b~Spawn %d (Team %d)~s~", i, spawn.team) or string.format("~b~Spawn %d~s~", i)
                        DrawText3D(spawn.x, spawn.y, spawn.z + 1.5, label)
                    end
                end
            end
        else
            Wait(500)
        end
    end
end)

-- ============================================================================
-- MATCH BOUNDARY ZONE (Handled by PolyZone CircleZone)
-- ============================================================================
-- Boundary enforcement is now handled by PolyZone CircleZone
-- The zone is created when a match starts and destroyed when it ends
-- Visualization is handled automatically by PolyZone with debugPoly enabled

-- ============================================================================
-- ADMIN STATUS CHECK
-- ============================================================================

CreateThread(function()
    while true do
        ESX.TriggerServerCallback('envy_paintball:isAdmin', function(adminStatus)
            isAdmin = adminStatus
        end)
        Wait(30000)
    end
end)

-- ============================================================================
-- COMMANDS
-- ============================================================================

-- Admin Dashboard Command
RegisterCommand('paintball_admin', function()
    ESX.TriggerServerCallback('envy_paintball:isAdmin', function(adminStatus)
        isAdmin = adminStatus
        if isAdmin then
            -- Load all data for the dashboard
                ESX.TriggerServerCallback('envy_paintball:isOwner', function(isOwnerStatus)
                    -- Convert truthy value (1, true) to explicit boolean
                    local isOwnerBool = (isOwnerStatus == true or isOwnerStatus == 1) and true or false
                    ESX.TriggerServerCallback('envy_paintball:getLicenses', function(licenses)
                        ESX.TriggerServerCallback('envy_paintball:getMaps', function(maps)
                            ESX.TriggerServerCallback('envy_paintball:getAllWeapons', function(weaponData)
                                ESX.TriggerServerCallback('envy_paintball:getAllActiveMatches', function(matches)
                                    SetNuiFocus(true, true)
                                    SendNUIMessage({
                                        action = 'showAdminDashboard',
                                        maps = maps or {},
                                        weapons = weaponData.weapons or {},
                                        categories = weaponData.categories or {},
                                        matches = matches or {},
                                        licenses = licenses or {},
                                        isOwner = isOwnerBool
                                    })
                                end)
                            end)
                        end)
                    end)
                end)
        else
            ESX.ShowNotification("You don't have permission to use this command", "error")
        end
    end)
end, false)


RegisterCommand('leavepaintball', function()
    TriggerServerEvent('envy_paintball:leaveMatch')
end, false)

-- ============================================================================
-- FREECAM SYSTEM
-- ============================================================================

local freecamSpeed = 0.5
local freecamRotation = {x = 0.0, y = 0.0, z = 0.0}
local freecamPosition = nil

function StartFreecam()
    local playerPed = PlayerPedId()
    originalCoords = GetEntityCoords(playerPed)
    freecamPosition = vector3(originalCoords.x, originalCoords.y, originalCoords.z + 1.0)
    
    local playerHeading = GetEntityHeading(playerPed)
    freecamRotation = {x = -90.0, y = 0.0, z = playerHeading}
    
    freecam = CreateCam("DEFAULT_SCRIPTED_CAMERA", true)
    SetCamCoord(freecam, freecamPosition.x, freecamPosition.y, freecamPosition.z)
    SetCamRot(freecam, freecamRotation.x, freecamRotation.y, freecamRotation.z, 2)
    SetCamActive(freecam, true)
    RenderScriptCams(true, true, 1000, true, true)
    
    FreezeEntityPosition(playerPed, true)
    SetEntityVisible(playerPed, false, false)
    SetEntityCollision(playerPed, false, false)
    
    freecamActive = true
    
    CreateThread(function()
        while freecamActive do
            Wait(0)
            local camCoords = GetCamCoord(freecam)
            local camRot = GetCamRot(freecam, 2)
            
            local forward = vector3(0.0, 0.0, 0.0)
            local right = vector3(0.0, 0.0, 0.0)
            local up = vector3(0.0, 0.0, 0.0)
            
            if IsDisabledControlPressed(0, 32) then
                forward = GetForwardVector(camRot)
            elseif IsDisabledControlPressed(0, 33) then
                forward = -GetForwardVector(camRot)
            end
            
            if IsDisabledControlPressed(0, 34) then
                right = -GetRightVector(camRot)
            elseif IsDisabledControlPressed(0, 35) then
                right = GetRightVector(camRot)
            end
            
            if IsDisabledControlPressed(0, 22) then
                up = vector3(0.0, 0.0, freecamSpeed)
            elseif IsDisabledControlPressed(0, 36) then
                up = vector3(0.0, 0.0, -freecamSpeed)
            end
            
            local speed = freecamSpeed
            if IsDisabledControlPressed(0, 21) then
                speed = freecamSpeed * 3.0
            end
            
            freecamPosition = camCoords + (forward + right + up) * speed
            
            local mouseX = GetDisabledControlNormal(0, 1) * 5.0
            local mouseY = GetDisabledControlNormal(0, 2) * 5.0
            
            freecamRotation.z = freecamRotation.z - mouseX
            freecamRotation.x = math.max(-90.0, math.min(90.0, freecamRotation.x - mouseY))
            
            SetCamCoord(freecam, freecamPosition.x, freecamPosition.y, freecamPosition.z)
            SetCamRot(freecam, freecamRotation.x, freecamRotation.y, freecamRotation.z, 2)
            
            DisableAllControlActions(0)
            DisableAllControlActions(1)
            DisableAllControlActions(2)
            EnableControlAction(0, 45, true)
            EnableControlAction(0, 166, true)
            if placingPoint then
                EnableControlAction(0, 38, true)
                EnableControlAction(0, 322, true)
            end
            
            if not placingPoint then
                SetNuiFocusKeepInput(false)
            end
        end
    end)
end

function StopFreecam()
    if freecam then
        SetCamActive(freecam, false)
        RenderScriptCams(false, true, 1000, true, true)
        DestroyCam(freecam, false)
        freecam = nil
    end
    
    local playerPed = PlayerPedId()
    FreezeEntityPosition(playerPed, false)
    SetEntityVisible(playerPed, true, false)
    SetEntityCollision(playerPed, true, true)
    
    if originalCoords then
        SetEntityCoords(playerPed, originalCoords.x, originalCoords.y, originalCoords.z, false, false, false, true)
    end
    
    freecamActive = false
    freecamPosition = nil
    originalCoords = nil
end

function GetForwardVector(rotation)
    local z = math.rad(rotation.z)
    local x = math.rad(rotation.x)
    local num = math.abs(math.cos(x))
    return vector3(-math.sin(z) * num, math.cos(z) * num, math.sin(x))
end

function RotationToDirection(rotation)
    local adjustedRotation = {
        x = (math.pi / 180) * rotation.x,
        y = (math.pi / 180) * rotation.y,
        z = (math.pi / 180) * rotation.z
    }
    local direction = {
        x = -math.sin(adjustedRotation.z) * math.abs(math.cos(adjustedRotation.x)),
        y = math.cos(adjustedRotation.z) * math.abs(math.cos(adjustedRotation.x)),
        z = math.sin(adjustedRotation.x)
    }
    return vector3(direction.x, direction.y, direction.z)
end

function RayCastFromCamera(cameraCoord, cameraRotation, distance, excludeEntity)
    local direction = RotationToDirection(cameraRotation)
    local destination = {
        x = cameraCoord.x + direction.x * distance,
        y = cameraCoord.y + direction.y * distance,
        z = cameraCoord.z + direction.z * distance
    }
    local a, b, c, d, e = GetShapeTestResult(StartShapeTestRay(cameraCoord.x, cameraCoord.y, cameraCoord.z, destination.x, destination.y, destination.z, -1, excludeEntity or 0, 0))
    return b, c, e
end

function GetRightVector(rotation)
    local z = math.rad(rotation.z)
    return vector3(math.cos(z), math.sin(z), 0.0)
end

-- ============================================================================
-- MAP EDITOR
-- ============================================================================

function StartMapEditor()
    if not currentMapData or not currentMapData.id then
        currentMapData = {
            name = "",
            center = nil,
            radius = 50.0,
            spawns = {}
        }
    end
    
    mapEditorActive = true
    placingPoint = false
    placingType = nil
    selectedTeam = nil
    recentlyPlaced = {}
    StartFreecam()
    
    -- Create editor zone if center already exists
    updateEditorZone()
    
    CreateThread(function()
        while mapEditorActive do
            Wait(0)
            if IsControlJustPressed(0, 166) then
                if not placingPoint then
                    OpenMapEditorMenu()
                end
            end
            
            if IsDisabledControlJustPressed(0, 45) and not placingPoint and freecam then
                RemoveMarkerAtLook()
            end
        end
    end)
    
    CreateThread(function()
        while mapEditorActive do
            if not placingPoint then
                aimPosition = nil
            end
            Wait(0)
            if placingPoint and freecam then
                local camCoords = GetCamCoord(freecam)
                local camRot = GetCamRot(freecam, 2)
                local playerPed = PlayerPedId()
                local hit, endCoords, entityHit = RayCastFromCamera(camCoords, camRot, 1000.0, playerPed)
                
                local newAimPosition = nil
                if hit == 1 and endCoords then
                    local hitX, hitY = endCoords.x, endCoords.y
                    local topPoint = vector3(hitX, hitY, endCoords.z + 100.0)
                    local bottomPoint = vector3(hitX, hitY, endCoords.z - 100.0)
                    local downRayHandle = StartShapeTestLosProbe(topPoint.x, topPoint.y, topPoint.z, bottomPoint.x, bottomPoint.y, bottomPoint.z, -1, 0, 4)
                    local downRetval, downHit, downEndCoords, downSurfaceNormal, downEntityHit = GetShapeTestResult(downRayHandle)
                    
                    local finalZ = endCoords.z
                    if downHit == 1 and downEndCoords then
                        finalZ = downEndCoords.z
                    end
                    
                    local foundGround, groundZ = GetGroundZFor_3dCoord(hitX, hitY, endCoords.z + 50.0)
                    if foundGround and groundZ > finalZ - 5.0 then
                        finalZ = groundZ
                    end
                    
                    if finalZ < camCoords.z - 200.0 then
                        finalZ = camCoords.z - 10.0
                    end
                    
                    newAimPosition = vector3(hitX, hitY, finalZ + 0.1)
                else
                    local direction = RotationToDirection(camRot)
                    local testPos = camCoords + direction * 50.0
                    local foundGround, groundZ = GetGroundZFor_3dCoord(testPos.x, testPos.y, testPos.z + 50.0)
                    if foundGround then
                        newAimPosition = vector3(testPos.x, testPos.y, groundZ + 0.5)
                    else
                        foundGround, groundZ = GetGroundZFor_3dCoord(testPos.x, testPos.y, camCoords.z)
                        if foundGround then
                            newAimPosition = vector3(testPos.x, testPos.y, groundZ + 0.5)
                        else
                            newAimPosition = vector3(testPos.x, testPos.y, testPos.z)
                        end
                    end
                end
                
                if newAimPosition then
                    aimPosition = newAimPosition
                end
                
                if aimPosition then
                    -- Check if spawn point is inside zone for visual feedback
                    local isInsideZone = true
                    local markerColor = {0, 255, 255} -- Cyan for valid
                    
                    if placingType == "spawn" and currentMapData and currentMapData.center then
                        local spawnPoint = vector3(aimPosition.x, aimPosition.y, aimPosition.z)
                        if editorZone then
                            isInsideZone = editorZone:isPointInside(spawnPoint)
                        else
                            -- Fallback: manual check
                            local center = currentMapData.center
                            local radius = currentMapData.radius
                            if center and radius then
                                local centerVec3 = vector3(center.x, center.y, center.z)
                                local distance = #(spawnPoint - centerVec3)
                                isInsideZone = distance <= radius
                            end
                        end
                        
                        if not isInsideZone then
                            markerColor = {255, 0, 0} -- Red for invalid
                        end
                    end
                    
                    DrawMarker(27, aimPosition.x, aimPosition.y, aimPosition.z, 0.0, 0.0, 0.0, 0.0, 180.0, 0.0, 0.5, 0.5, 0.1, markerColor[1], markerColor[2], markerColor[3], 255, false, false, 2, false, false, false, false)
                    
                    if placingType == "center" then
                        -- Update preview zone using PolyZone CircleZone (only updates when position/radius changes significantly)
                        local previewPosition = vector3(aimPosition.x, aimPosition.y, aimPosition.z)
                        updatePreviewZone(previewPosition, currentMapData.radius, false)
                    end
                    
                    local placeText = ""
                    if placingType == "center" then
                        placeText = string.format("~y~CENTER POINT~s~\nPress ~g~E~s~ to place\n~b~Scroll~s~ to adjust radius: ~y~%.1fm~s~", currentMapData.radius)
                    elseif placingType == "spawn" then
                        if not isInsideZone then
                            placeText = "~r~SPAWN POINT (OUTSIDE ZONE)~s~\n~r~Must be inside the zone boundary!~s~"
                        else
                            placeText = "~y~SPAWN POINT~s~\nPress ~g~E~s~ to place"
                        end
                    end
                    DrawText3D(aimPosition.x, aimPosition.y, aimPosition.z + 2.0, placeText)
                end
                
                if placingType == "center" then
                    if IsDisabledControlJustPressed(0, 17) then
                        currentMapData.radius = math.min(currentMapData.radius + 1.0, 200.0)
                        -- Update preview zone if placing center (force update on scroll)
                        if aimPosition then
                            local previewPosition = vector3(aimPosition.x, aimPosition.y, aimPosition.z)
                            updatePreviewZone(previewPosition, currentMapData.radius, true)
                        end
                        -- Update zone if center is already placed
                        if currentMapData.center then
                            updateEditorZone()
                        end
                    elseif IsDisabledControlJustPressed(0, 16) then
                        currentMapData.radius = math.max(currentMapData.radius - 1.0, 5.0)
                        -- Update preview zone if placing center (force update on scroll)
                        if aimPosition then
                            local previewPosition = vector3(aimPosition.x, aimPosition.y, aimPosition.z)
                            updatePreviewZone(previewPosition, currentMapData.radius, true)
                        end
                        -- Update zone if center is already placed
                        if currentMapData.center then
                            updateEditorZone()
                        end
                    end
                end
                
                if IsControlJustPressed(0, 38) then
                    if aimPosition then
                        if placingType == "center" then
                            currentMapData.center = aimPosition
                            table.insert(recentlyPlaced, {
                                type = "center",
                                position = vector3(aimPosition.x, aimPosition.y, aimPosition.z),
                                time = GetGameTimer(),
                                duration = 3000
                            })
                            PlaySoundFrontend(-1, "CHECKPOINT_PERFECT", "HUD_MINI_GAME_SOUNDSET", true)
                            ESX.ShowNotification("~g~✓ Center point placed!~s~", "success", 3000)
                            placingPoint = false
                            placingType = nil
                            -- Destroy preview zone and create/update the editor zone
                            destroyPreviewZone()
                            updateEditorZone()
                        elseif placingType == "spawn" then
                            -- Validate spawn point is inside zone
                            if not currentMapData.center then
                                ESX.ShowNotification("~r~Error: Center point must be set before placing spawn points!~s~", "error", 4000)
                                PlaySoundFrontend(-1, "CHECKPOINT_MISSED", "HUD_MINI_GAME_SOUNDSET", true)
                                placingPoint = false
                                placingType = nil
                                selectedTeam = nil
                                return
                            end
                            
                            -- Check if spawn point is inside the zone
                            local spawnPoint = vector3(aimPosition.x, aimPosition.y, aimPosition.z)
                            local isInside = false
                            
                            if editorZone then
                                isInside = editorZone:isPointInside(spawnPoint)
                            else
                                -- Fallback: manual check if zone doesn't exist yet
                                local center = currentMapData.center
                                local radius = currentMapData.radius
                                if center and radius then
                                    local centerVec3 = vector3(center.x, center.y, center.z)
                                    local distance = #(spawnPoint - centerVec3)
                                    isInside = distance <= radius
                                end
                            end
                            
                            if not isInside then
                                ESX.ShowNotification("~r~Error: Spawn point must be inside the zone boundary!~s~", "error", 4000)
                                PlaySoundFrontend(-1, "CHECKPOINT_MISSED", "HUD_MINI_GAME_SOUNDSET", true)
                                -- Don't return - allow user to continue or press ESC to cancel
                            else
                                -- Only place spawn if validation passes
                                local spawn = {
                                x = aimPosition.x,
                                y = aimPosition.y,
                                z = aimPosition.z,
                                w = camRot.z or 0.0,
                                team = selectedTeam
                            }
                            table.insert(currentMapData.spawns, spawn)
                            table.insert(recentlyPlaced, {
                                type = "spawn",
                                position = vector3(aimPosition.x, aimPosition.y, aimPosition.z),
                                time = GetGameTimer(),
                                duration = 3000,
                                team = selectedTeam
                            })
                                PlaySoundFrontend(-1, "CHECKPOINT_PERFECT", "HUD_MINI_GAME_SOUNDSET", true)
                                local teamText = selectedTeam and string.format(" (Team %d)", selectedTeam) or ""
                                ESX.ShowNotification(string.format("~g~✓ Spawn point placed%s!~s~ Total: %d", teamText, #currentMapData.spawns), "success", 3000)
                                placingPoint = false
                                placingType = nil
                                selectedTeam = nil
                            end
                        end
                    end
                end
                
                if IsControlJustPressed(0, 322) then
                    placingPoint = false
                    placingType = nil
                    selectedTeam = nil
                    destroyPreviewZone()
                    ESX.ShowNotification("Placement cancelled", "info", 3000)
                end
            end
        end
    end)
    
    CreateThread(function()
        while mapEditorActive do
            Wait(0)
            
            if not placingPoint then
                DrawText2D(0.5, 0.02, "~y~MAP EDITOR - Press F5 for Menu~s~", 0.4)
                DrawText2D(0.5, 0.05, "~w~WASD: Move | Space/Ctrl: Up/Down | Shift: Speed | Mouse: Look~s~ | R: Remove Marker~s~", 0.3)
            else
                DrawText2D(0.5, 0.02, "~y~PLACING POINT - Aim and press E~s~", 0.4)
                DrawText2D(0.5, 0.05, "~w~Press ESC to cancel~s~", 0.3)
            end
            
            local currentTime = GetGameTimer()
            for i = #recentlyPlaced, 1, -1 do
                if currentTime - recentlyPlaced[i].time > recentlyPlaced[i].duration then
                    table.remove(recentlyPlaced, i)
                end
            end
            
            for _, flash in ipairs(recentlyPlaced) do
                local elapsed = currentTime - flash.time
                local progress = elapsed / flash.duration
                local alpha = math.floor(255 * (1.0 - progress))
                local scale = 1.0 + (progress * 0.8)
                
                if flash.type == "center" then
                    DrawMarker(1, flash.position.x, flash.position.y, flash.position.z - 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2.0 * scale, 2.0 * scale, 2.0 * scale, 0, 255, 0, alpha, false, true, 2, false, false, false, false)
                    DrawMarker(28, flash.position.x, flash.position.y, flash.position.z, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.5 * scale, 1.5 * scale, 0.8, 0, 255, 0, alpha, false, true, 2, false, false, false, false)
                    DrawMarker(1, flash.position.x, flash.position.y, flash.position.z - 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.3 * scale, 0.3 * scale, 0.1, 0, 255, 0, math.floor(alpha * 0.7), false, true, 2, false, false, false, false)
                    DrawText3D(flash.position.x, flash.position.y, flash.position.z + 2.0 + (scale * 0.5), "~g~✓ CENTER PLACED~s~")
                elseif flash.type == "spawn" then
                    local teamColor = flash.team and (flash.team == 1 and {255, 0, 0} or {0, 0, 255}) or {0, 0, 255}
                    DrawMarker(1, flash.position.x, flash.position.y, flash.position.z - 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.8 * scale, 1.8 * scale, 1.8 * scale, teamColor[1], teamColor[2], teamColor[3], alpha, false, true, 2, false, false, false, false)
                    DrawMarker(28, flash.position.x, flash.position.y, flash.position.z, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.2 * scale, 1.2 * scale, 0.8, teamColor[1], teamColor[2], teamColor[3], alpha, false, true, 2, false, false, false, false)
                    DrawMarker(1, flash.position.x, flash.position.y, flash.position.z - 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.3 * scale, 0.3 * scale, 0.1, teamColor[1], teamColor[2], teamColor[3], math.floor(alpha * 0.7), false, true, 2, false, false, false, false)
                    local teamText = flash.team and string.format(" (Team %d)", flash.team) or ""
                    DrawText3D(flash.position.x, flash.position.y, flash.position.z + 2.0 + (scale * 0.5), string.format("~b~✓ SPAWN PLACED%s~s~", teamText))
                end
            end
            
            if currentMapData then
                if currentMapData.center then
                    -- Draw center point marker (zone visualization is handled by PolyZone)
                    DrawMarker(1, currentMapData.center.x, currentMapData.center.y, currentMapData.center.z - 0.5, 0.0, 0.0, 0.0, 0, 0.0, 0.0, 1.0, 1.0, 1.0, 0, 255, 0, 50, false, false, 2, false, false, false, false)
                    DrawMarker(28, currentMapData.center.x, currentMapData.center.y, currentMapData.center.z, 0.0, 0.0, 0.0, 0, 0.0, 0.0, 0.8, 0.8, 0.3, 0, 255, 0, 50, false, false, 2, false, false, false, false)
                    DrawText3D(currentMapData.center.x, currentMapData.center.y, currentMapData.center.z + 1.5, "~g~CENTER POINT~s~")
                    -- Zone sphere is now handled by PolyZone CircleZone
                end

                if currentMapData.spawns then
                    for i, spawn in ipairs(currentMapData.spawns) do
                        local teamColor = spawn.team and (spawn.team == 1 and {255, 0, 0} or {0, 0, 255}) or {0, 0, 255}
                        DrawMarker(1, spawn.x, spawn.y, spawn.z - 0.5, 0.0, 0.0, 0.0, 0, 0.0, 0.0, 0.8, 0.8, 0.8, teamColor[1], teamColor[2], teamColor[3], 50, false, false, 2, false, false, false, false)
                        DrawMarker(28, spawn.x, spawn.y, spawn.z, 0.0, 0.0, 0.0, 0, 0.0, 0.0, 0.6, 0.6, 0.2, teamColor[1], teamColor[2], teamColor[3], 50, false, false, 2, false, false, false, false)
                        local label = spawn.team and string.format("~b~Spawn %d (Team %d)~s~", i, spawn.team) or string.format("~b~Spawn %d~s~", i)
                        DrawText3D(spawn.x, spawn.y, spawn.z + 1.5, label)
                    end
                end
            end
        end
    end)
end

function RemoveMarkerAtLook()
    if not mapEditorActive or placingPoint or not freecam or not currentMapData then
        return
    end
    
    local camCoords = GetCamCoord(freecam)
    local camRot = GetCamRot(freecam, 2)
    local playerPed = PlayerPedId()
    local hit, endCoords, entityHit = RayCastFromCamera(camCoords, camRot, 1000.0, playerPed)
    
    local checkDistance = 5.0
    local closestMarker = nil
    local closestDist = checkDistance
    local markerType = nil
    local markerIndex = nil
    
    if currentMapData.center then
        local centerPos = vector3(currentMapData.center.x, currentMapData.center.y, currentMapData.center.z)
        local distToCenter = #(camCoords - centerPos)
        
        if hit == 1 and endCoords then
            local hitPos = vector3(endCoords.x, endCoords.y, endCoords.z)
            local distFromHit = #(hitPos - centerPos)
            if distFromHit < closestDist then
                closestDist = distFromHit
                closestMarker = centerPos
                markerType = "center"
            end
        end
        
        if distToCenter < 50.0 then
            local direction = RotationToDirection(camRot)
            local toCenter = centerPos - camCoords
            local dot = (direction.x * toCenter.x + direction.y * toCenter.y + direction.z * toCenter.z) / (#toCenter + 0.001)
            
            if dot > 0.7 and distToCenter < closestDist then
                closestDist = distToCenter
                closestMarker = centerPos
                markerType = "center"
            end
        end
    end
    
    if currentMapData.spawns then
        for i = 1, #currentMapData.spawns do
            local spawn = currentMapData.spawns[i]
            local spawnPos = vector3(spawn.x, spawn.y, spawn.z)
            local distToSpawn = #(camCoords - spawnPos)
            
            if distToSpawn < 50.0 then
                local direction = RotationToDirection(camRot)
                local toSpawn = spawnPos - camCoords
                local dot = (direction.x * toSpawn.x + direction.y * toSpawn.y + direction.z * toSpawn.z) / (#toSpawn + 0.001)
                
                if dot > 0.7 and distToSpawn < closestDist then
                    closestDist = distToSpawn
                    closestMarker = spawnPos
                    markerType = "spawn"
                    markerIndex = i
                end
                
                if hit == 1 and endCoords then
                    local hitPos = vector3(endCoords.x, endCoords.y, endCoords.z)
                    local distFromHit = #(hitPos - spawnPos)
                    if distFromHit < closestDist then
                        closestDist = distFromHit
                        closestMarker = spawnPos
                        markerType = "spawn"
                        markerIndex = i
                    end
                end
            end
        end
    end
    
    if closestMarker and closestDist <= checkDistance then
        if markerType == "center" then
            currentMapData.center = nil
            -- Destroy editor zone when center is removed
            if editorZone then
                editorZone:destroy()
                editorZone = nil
            end
            ESX.ShowNotification("~r~Center point removed!~s~", "error", 3000)
            PlaySoundFrontend(-1, "CHECKPOINT_MISSED", "HUD_MINI_GAME_SOUNDSET", true)
        elseif markerType == "spawn" and markerIndex then
            table.remove(currentMapData.spawns, markerIndex)
            ESX.ShowNotification(string.format("~r~Spawn point %d removed!~s~", markerIndex), "error", 3000)
            PlaySoundFrontend(-1, "CHECKPOINT_MISSED", "HUD_MINI_GAME_SOUNDSET", true)
        end
    else
        ESX.ShowNotification("~y~No marker found to remove!~s~", "info", 2000)
    end
end

function StopMapEditor()
    mapEditorActive = false
    placingPoint = false
    placingType = nil
    selectedTeam = nil
    StopFreecam()
    currentMapData = nil
    
    -- Destroy editor zone and preview zone
    if editorZone then
        editorZone:destroy()
        editorZone = nil
    end
    destroyPreviewZone()
    
    SendNUIMessage({ action = 'hideMenu' })
    SetNuiFocus(false, false)
    CreateThread(function()
        Wait(100)
        SetNuiFocus(false, false)
    end)
    ESX.ShowNotification("Map Editor: ~r~DISABLED~s~", "error")
end

function OpenEditorMainMenu()
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'showEditorMainMenu'
    })
end

function OpenMapEditorMenu()
    if placingPoint then return end
    
    SetNuiFocus(false, false)
    Wait(50)
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'showEditorMenu',
        menuData = {
            radius = currentMapData.radius,
            mapName = currentMapData.name or "",
            isEditing = currentMapData.id ~= nil
        }
    })
end

function SetMapCenter()
    placingPoint = true
    placingType = "center"
    SendNUIMessage({ action = 'hideMenu', menu = 'editor' })
    SetNuiFocus(false, false)
    ESX.ShowNotification("Aim where you want the center point and press ~g~E~s~", "info", 3000)
end

function OpenSpawnTeamMenu()
    -- Check if center point is set
    if not currentMapData or not currentMapData.center then
        ESX.ShowNotification("~r~Error: You must set a center point before placing spawn points!~s~", "error", 4000)
        return
    end
    
    local hasTeamModes = false
    for _, gameMode in ipairs(Config.GameModes) do
        if gameMode.teams and gameMode.teams > 0 then
            hasTeamModes = true
            break
        end
    end
    
    if hasTeamModes then
        SetNuiFocus(false, false)
        Wait(50)
        SetNuiFocus(true, true)
        SendNUIMessage({
            action = 'showTeamMenu'
        })
    else
        StartPlacingSpawn(nil)
    end
end

function StartPlacingSpawn(team)
    selectedTeam = team
    placingPoint = true
    placingType = "spawn"
    SendNUIMessage({ action = 'hideMenu', menu = 'team' })
    SetNuiFocus(false, false)
    ESX.ShowNotification("Aim where you want the spawn point and press ~g~E~s~", "info", 3000)
end

function ClearMapData()
    currentMapData = {
        name = "",
        center = nil,
        radius = 50.0,
        spawns = {}
    }
    -- Destroy preview zone and editor zone when clearing map data
    destroyPreviewZone()
    updateEditorZone() -- This will destroy the editor zone since center is now nil
    ESX.ShowNotification("Map data cleared!", "info", 3000)
end

function SaveMap()
    if not currentMapData.center then
        ESX.ShowNotification("Please set a center point first!", "error", 3000)
        return
    end
    
    if #currentMapData.spawns == 0 then
        ESX.ShowNotification("Please add at least one spawn point!", "error", 3000)
        return
    end
    
    SetNuiFocus(false, false)
    Wait(50)
    SetNuiFocus(true, true)
    
    if currentMapData.id and currentMapData.name and currentMapData.name ~= "" then
        local mapData = {
            id = currentMapData.id,
            name = currentMapData.name,
            center = currentMapData.center,
            radius = currentMapData.radius,
            spawns = currentMapData.spawns
        }
        TriggerServerEvent('envy_paintball:saveMap', mapData)
        ESX.ShowNotification("~g~Map saved!~s~", "success", 3000)
        SetNuiFocus(false, false)
    else
        SendNUIMessage({
            action = 'showDialog',
            title = 'Enter Map Name',
            placeholder = 'Map name',
            dialogType = 'mapName'
        })
    end
end

RegisterNUICallback('editorMainAction', function(data, cb)
    local action = data.action
    
    if action == "createNewMap" then
        SendNUIMessage({ action = 'hideMenu', menu = 'editorMain' })
        CreateThread(function()
            Wait(100)
            SetNuiFocus(false, false)
        end)
        -- Clear any existing map data and start fresh
        currentMapData = {
            name = "",
            center = nil,
            radius = 50.0,
            spawns = {}
        }
        StartMapEditor()
        ESX.ShowNotification("~g~Map Editor: Started! Press F5 for menu~s~", "success", 3000)
    elseif action == "editMap" then
        SendNUIMessage({ action = 'hideMenu', menu = 'editorMain' })
        CreateThread(function()
            Wait(100)
            SetNuiFocus(false, false)
            Wait(50)
            ESX.TriggerServerCallback('envy_paintball:getMaps', function(maps)
                SetNuiFocus(true, true)
                SendNUIMessage({
                    action = 'showMaps',
                    maps = maps or {},
                    forEditing = true
                })
            end)
        end)
    elseif action == "deleteMap" then
        ESX.TriggerServerCallback('envy_paintball:getMaps', function(maps)
            SendNUIMessage({ action = 'hideMenu', menu = 'editorMain' })
            SetNuiFocus(false, false)
            Wait(50)
            SetNuiFocus(true, true)
            SendNUIMessage({
                action = 'showMaps',
                maps = maps or {},
                forDeleting = true
            })
        end)
    elseif action == "closeEditorMain" then
        SendNUIMessage({ action = 'hideMenu', menu = 'editorMain' })
        SetNuiFocus(false, false)
    end
    
    cb('ok')
end)

RegisterNUICallback('editorAction', function(data, cb)
    local action = data.action
    
    if action == "setCenter" then
        SendNUIMessage({ action = 'hideMenu', menu = 'editor' })
        SetNuiFocus(false, false)
        Wait(100)
        SetMapCenter()
    elseif action == "addSpawn" then
        SendNUIMessage({ action = 'hideMenu', menu = 'editor' })
        SetNuiFocus(false, false)
        Wait(100)
        OpenSpawnTeamMenu()
    elseif action == "clearMap" then
        ClearMapData()
        SendNUIMessage({ action = 'hideMenu' })
        SetNuiFocus(false, false)
    elseif action == "saveMap" then
        SendNUIMessage({ action = 'hideMenu', menu = 'editor' })
        SetNuiFocus(false, false)
        Wait(100)
        SaveMap()
    elseif action == "leaveEditor" then
        SendNUIMessage({ action = 'hideMenu', menu = 'editor' })
        SetNuiFocus(false, false)
        StopMapEditor()
    end
    
    cb('ok')
end)

RegisterNUICallback('selectTeam', function(data, cb)
    local team = data.team
    SendNUIMessage({ action = 'hideMenu', menu = 'team' })
    SetNuiFocus(false, false)
    Wait(100)
    StartPlacingSpawn(team)
    cb('ok')
end)

RegisterNUICallback('hidePostMatchScoreboard', function(data, cb)
    postMatchScoreboardVisible = false
    SetNuiFocus(false, false) -- Disable cursor and NUI focus
    cb('ok')
end)

RegisterNUICallback('dialogSubmit', function(data, cb)
    local value = data.value
    local type = data.type
    
    if type == 'mapName' then
        if value and value ~= "" then
            currentMapData.name = value
            if not currentMapData.id then
                currentMapData.id = "map_" .. GetGameTimer() .. "_" .. math.random(1000, 9999)
            end
            TriggerServerEvent('envy_paintball:saveMap', currentMapData)
        else
            ESX.ShowNotification("Map name cannot be empty!", "error", 3000)
        end
        SendNUIMessage({ action = 'hideMenu', menu = 'dialog' })
        SetNuiFocus(false, false)
        Wait(100)
        OpenMapEditorMenu()
    end
    
    cb('ok')
end)

-- ============================================================================
-- DRAWING FUNCTIONS
-- ============================================================================

function DrawText2D(x, y, text, scale)
    SetTextFont(4)
    SetTextProportional(1)
    SetTextScale(scale, scale)
    SetTextColour(255, 255, 255, 255)
    SetTextDropShadow(0, 0, 0, 0, 255)
    SetTextEdge(1, 0, 0, 0, 255)
    SetTextDropShadow()
    SetTextOutline()
    SetTextCentre(true)
    SetTextEntry("STRING")
    AddTextComponentString(text)
    DrawText(x, y)
end

function DrawText3D(x, y, z, text)
    local onScreen, _x, _y = World3dToScreen2d(x, y, z)
    
    local camCoords
    if freecam and DoesCamExist(freecam) then
        camCoords = GetCamCoord(freecam)
    else
        camCoords = GetGameplayCamCoord()
    end
    
    local distance = #(camCoords - vector3(x, y, z))
    distance = math.max(distance, 1.0)
    
    local scale = (1 / distance) * 2
    local fov = (1 / GetGameplayCamFov()) * 100
    scale = scale * fov
    scale = math.max(0.1, math.min(scale, 2.0))

    if onScreen then
        SetTextScale(0.0 * scale, 0.35 * scale)
        SetTextFont(4)
        SetTextProportional(1)
        SetTextColour(255, 255, 255, 215)
        SetTextDropshadow(0, 0, 0, 0, 255)
        SetTextEdge(2, 0, 0, 0, 150)
        SetTextDropShadow()
        SetTextOutline()
        SetTextEntry("STRING")
        SetTextCentre(1)
        AddTextComponentString(text)
        DrawText(_x, _y)
    end
end
