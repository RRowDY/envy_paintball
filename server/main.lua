local ESX = exports['es_extended']:getSharedObject()

-- ============================================================================
-- DATA STRUCTURES
-- ============================================================================
local activeMatches = {}
local maps = {}
local nextBucketId = Config.BaseBucket
local gameModeBucketMap = {}
local playerMatches = {} -- Maps playerId to matchId
local weapons = {}
local playerCoords = {} -- Server-side coordinate tracking for distance validation
local allowedLicenses = {} -- List of licenses that have admin access {license = "license:xxx", cfxName = "Joshua"}
local ghostedPlayers = {} -- Track which players are currently ghosted (spawn protection)

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get player's team number (returns nil for FFA)
local function GetPlayerTeam(match, playerId)
    if not match or not match.gameMode then return nil end
    if match.gameMode.teams == 0 then
        return nil -- FFA mode
    end
    
    if not match.teams then return nil end
    
    for teamNum, teamPlayers in ipairs(match.teams) do
        for _, pId in ipairs(teamPlayers) do
            if pId == playerId then
                return teamNum
            end
        end
    end
    return nil
end

-- Get appropriate spawn point for player
local function GetSpawnPointForPlayer(match, playerId)
    if not match or not match.map or not match.map.spawns then
        return nil
    end
    
    local spawns = match.map.spawns
    if #spawns == 0 then
        return nil
    end
    
    local playerTeam = GetPlayerTeam(match, playerId)
    
    -- FFA: any spawn point
    if not playerTeam then
        local ffaSpawns = {}
        for _, spawn in ipairs(spawns) do
            if not spawn.team then
                table.insert(ffaSpawns, spawn)
            end
        end
        -- If no FFA-specific spawns, use all spawns
        if #ffaSpawns == 0 then
            ffaSpawns = spawns
        end
        return ffaSpawns[math.random(1, #ffaSpawns)]
    else
        -- TDM/Team modes: spawn at team-specific spawn point
        local teamSpawns = {}
        for _, spawn in ipairs(spawns) do
            if spawn.team == playerTeam then
                table.insert(teamSpawns, spawn)
            end
        end
        -- If no team-specific spawns, use all spawns
        if #teamSpawns == 0 then
            teamSpawns = spawns
        end
        return teamSpawns[math.random(1, #teamSpawns)]
    end
end

-- Check if player is owner (has ACE permission)
local function IsOwner(source)
    if not source or type(source) ~= 'number' then return false end
    -- Check ACE permission for owner
    return IsPlayerAceAllowed(source, "envy_paintball.owner")
end

-- Check if player is admin (license-locked: only owner ACE or licenses in allowed list)
local function IsAdmin(source)
    if not source or type(source) ~= 'number' then return false end
    
    -- Check if owner (has ACE permission)
    if IsOwner(source) then
        return true
    end
    
    -- Check if license is in allowed list
    local identifiers = GetPlayerIdentifiers(source)
    if identifiers then
        for _, identifier in ipairs(identifiers) do
            if string.find(identifier, "license:") then
                for _, allowedLicenseData in ipairs(allowedLicenses) do
                    local allowedLicense = type(allowedLicenseData) == "string" and allowedLicenseData or allowedLicenseData.license
                    if identifier == allowedLicense then
                        return true
                    end
                end
            end
        end
    end
    
    -- ESX admin groups are NOT checked - script is license-locked
    -- Only owner (ACE permission) and licenses in allowed list have access
    
    return false
end

-- Find player's match (optimized lookup)
local function GetPlayerMatch(playerId)
    local matchId = playerMatches[playerId]
    if matchId and activeMatches[matchId] then
        return activeMatches[matchId], matchId
    end
    return nil, nil
end

-- Validate weapon hash and check if enabled
local function ValidateWeapon(weaponHash)
    if not weaponHash then return false, nil end
    
    weaponHash = tonumber(weaponHash)
    if not weaponHash or weaponHash == 0 then return false, nil end
    
    for _, w in ipairs(weapons) do
        if tonumber(w.hash) == weaponHash and w.enabled then
            return true, w
        end
    end
    
    return false, nil
end

-- Get valid weapon hash (with fallback)
local function GetValidWeaponHash(playerId, match)
    local weaponHash = nil
    
    -- Try player's selected weapon
    if match.playerWeapons and match.playerWeapons[playerId] then
        local isValid, weapon = ValidateWeapon(match.playerWeapons[playerId])
        if isValid then
            weaponHash = tonumber(weapon.hash)
        end
    end
    
    -- Fallback to first enabled weapon
    if not weaponHash then
        for _, w in ipairs(weapons) do
            if w.enabled then
                weaponHash = tonumber(w.hash)
                break
            end
        end
    end
    
    -- Final fallback to default
    if not weaponHash then
        weaponHash = GetHashKey("WEAPON_SPECIALCARBINE")
    end
    
    return weaponHash
end

-- Validate match exists and player is in it
local function ValidatePlayerInMatch(source, matchId)
    if not matchId or type(matchId) ~= 'string' then return false, nil end
    
    local match = activeMatches[matchId]
    if not match then return false, nil end
    
    -- Check if player is in match
    for _, playerId in ipairs(match.players) do
        if playerId == source then
            return true, match
        end
    end
    
    return false, nil
end

-- Check if player is already in a match
local function IsPlayerInMatch(source)
    return playerMatches[source] ~= nil
end

-- Get bucket for game mode
local function GetBucketForGameMode(gameModeId)
    if not gameModeBucketMap[gameModeId] then
        gameModeBucketMap[gameModeId] = nextBucketId
        nextBucketId = nextBucketId + Config.BucketIncrement
    end
    return gameModeBucketMap[gameModeId]
end

-- Find available bucket within game mode range
local function FindAvailableBucket(baseBucket)
    local maxBucket = baseBucket + Config.BucketIncrement - 1
    
    for testBucket = baseBucket, maxBucket do
        local found = false
        for _, match in pairs(activeMatches) do
            if match.bucket == testBucket then
                found = true
                break
            end
        end
        if not found then
            return testBucket
        end
    end
    
    return baseBucket -- Fallback if all buckets are used
end

-- ============================================================================
-- WEAPON MANAGEMENT
-- ============================================================================

function GivePaintballWeapon(playerId, weaponHash, ammo)
    if not weaponHash then return end
    TriggerClientEvent('envy_paintball:giveWeapon', playerId, weaponHash, ammo or Config.PaintballAmmo)
end

function RemovePaintballWeapon(playerId, weaponHash)
    if not weaponHash then return end
    TriggerClientEvent('envy_paintball:removeWeapon', playerId, weaponHash)
end

-- ============================================================================
-- MAP MANAGEMENT
-- ============================================================================

function LoadMaps()
    local file = LoadResourceFile(GetCurrentResourceName(), 'maps.lua')
    if file then
        local success, result = pcall(load(file))
        if success and result then
            maps = result
        else
            maps = {}
        end
    else
        maps = {}
        SaveMaps()
    end
end

function SaveMaps()
    local content = "-- Paintball Maps\n-- Auto-generated by Envy Paintball\n\nreturn {\n"
    
    for i, map in ipairs(maps) do
        content = content .. string.format("    {\n")
        content = content .. string.format("        id = \"%s\",\n", map.id)
        content = content .. string.format("        name = \"%s\",\n", map.name)
        content = content .. string.format("        center = vector3(%.2f, %.2f, %.2f),\n", map.center.x, map.center.y, map.center.z)
        content = content .. string.format("        radius = %.2f,\n", map.radius)
        content = content .. string.format("        spawns = {\n")
        
        for j, spawn in ipairs(map.spawns) do
            if spawn.team then
                content = content .. string.format("            {x = %.2f, y = %.2f, z = %.2f, w = %.2f, team = %d},\n", spawn.x, spawn.y, spawn.z, spawn.w or 0.0, spawn.team)
            else
                content = content .. string.format("            {x = %.2f, y = %.2f, z = %.2f, w = %.2f},\n", spawn.x, spawn.y, spawn.z, spawn.w or 0.0)
            end
        end
        
        content = content .. "        }\n"
        content = content .. "    }"
        if i < #maps then content = content .. "," end
        content = content .. "\n"
    end
    
    content = content .. "}\n"
    SaveResourceFile(GetCurrentResourceName(), 'maps.lua', content, -1)
end

-- ============================================================================
-- LICENSE MANAGEMENT
-- ============================================================================

function LoadLicenses()
    local file = LoadResourceFile(GetCurrentResourceName(), 'licenses.lua')
    if file then
        local success, result = pcall(load(file))
        if success and result then
            -- Handle both old format (array of strings) and new format (array of tables)
            allowedLicenses = {}
            for i, item in ipairs(result) do
                if type(item) == "string" then
                    -- Old format - just license string
                    table.insert(allowedLicenses, { license = item, cfxName = nil })
                elseif type(item) == "table" then
                    -- New format - table with license and cfxName
                    table.insert(allowedLicenses, {
                        license = item.license or item[1] or "",
                        cfxName = item.cfxName or nil
                    })
                end
            end
        else
            allowedLicenses = {}
        end
    else
        allowedLicenses = {}
        SaveLicenses()
    end
end

function SaveLicenses()
    local content = "-- Paintball Allowed Licenses\n-- Auto-generated by Envy Paintball\n-- Only the owner can manage these licenses\n\nreturn {\n"
    
    for i, licenseData in ipairs(allowedLicenses) do
        if licenseData.cfxName then
            content = content .. string.format("    { license = \"%s\", cfxName = \"%s\" }", licenseData.license, licenseData.cfxName)
        else
            content = content .. string.format("    { license = \"%s\" }", licenseData.license)
        end
        if i < #allowedLicenses then content = content .. "," end
        content = content .. "\n"
    end
    
    content = content .. "}\n"
    SaveResourceFile(GetCurrentResourceName(), 'licenses.lua', content, -1)
end

-- ============================================================================
-- WEAPON CONFIG MANAGEMENT
-- ============================================================================

function LoadWeaponConfig()
    local file = LoadResourceFile(GetCurrentResourceName(), 'weapons.lua')
    if file then
        local success, result = pcall(load(file))
        if success and result then
            weapons = result.weapons or {}
        else
            InitializeDefaultWeapons()
        end
    else
        InitializeDefaultWeapons()
    end
end

function InitializeDefaultWeapons()
    weapons = {}
    SaveWeaponConfig()
end

function SaveWeaponConfig()
    local content = "-- Paintball Weapons Configuration\n-- Auto-generated by Envy Paintball\n-- Categories are defined in config.lua\n\nreturn {\n"
    content = content .. "    weapons = {\n"
    
    for i, weapon in ipairs(weapons) do
        content = content .. string.format("        { hash = %s, name = \"%s\", category = \"%s\", enabled = %s }", weapon.hash, weapon.name, weapon.category, tostring(weapon.enabled))
        if i < #weapons then content = content .. "," end
        content = content .. "\n"
    end
    
    content = content .. "    }\n"
    content = content .. "}\n"
    SaveResourceFile(GetCurrentResourceName(), 'weapons.lua', content, -1)
end

-- ============================================================================
-- MATCH MANAGEMENT
-- ============================================================================

function StartMatch(matchId)
    local match = activeMatches[matchId]
    if not match then return end

    match.status = "active"
    
    -- Initialize scoring
    match.playerScores = {}
    match.teamScores = {}
    match.deadPlayers = {}
    
    -- Initialize player scores
    for _, playerId in ipairs(match.players) do
        match.playerScores[playerId] = 0
    end
    
    -- Initialize team scores
    if match.gameMode.teams > 0 then
        for i = 1, match.gameMode.teams do
            match.teamScores[i] = 0
        end
    end

    -- Set routing buckets
    for _, playerId in ipairs(match.players) do
        SetPlayerRoutingBucket(playerId, match.bucket)
    end

    -- Teleport and notify players
    for _, playerId in ipairs(match.players) do
        local spawnIndex = math.random(1, #match.map.spawns)
        local spawn = match.map.spawns[spawnIndex]
        TriggerClientEvent('envy_paintball:teleportToSpawn', playerId, spawn)
        TriggerClientEvent('envy_paintball:matchActive', playerId, match)
    end

    -- Wait before giving weapons
    Wait(1000)

    -- Give weapons
    for _, playerId in ipairs(match.players) do
        local weaponHash = GetValidWeaponHash(playerId, match)
        
        if not match.weaponHashes then
            match.weaponHashes = {}
        end
        match.weaponHashes[playerId] = weaponHash
        
        GivePaintballWeapon(playerId, weaponHash, Config.PaintballAmmo)
    end

    -- End match after duration
    CreateThread(function()
        Wait(Config.MatchDuration * 1000)
        if activeMatches[matchId] and activeMatches[matchId].status == "active" then
            EndMatch(matchId, "Time limit reached")
        end
    end)
end

function RemovePlayerFromMatch(playerId, matchId, reason)
    local match = activeMatches[matchId]
    if not match then return end
    
    -- Remove weapon
    if match.weaponHashes and match.weaponHashes[playerId] then
        RemovePaintballWeapon(playerId, match.weaponHashes[playerId])
        match.weaponHashes[playerId] = nil
    end
    
    -- Remove from players list
    for i, pId in ipairs(match.players) do
        if pId == playerId then
            table.remove(match.players, i)
            break
        end
    end
    
    -- Remove from teams
    for _, team in ipairs(match.teams) do
        for i, pId in ipairs(team) do
            if pId == playerId then
                table.remove(team, i)
                break
            end
        end
    end
    
    -- Reset routing bucket
    SetPlayerRoutingBucket(playerId, 0)
    playerMatches[playerId] = nil
    playerCoords[playerId] = nil
    
    -- Teleport back
    TriggerClientEvent('envy_paintball:teleportToPed', playerId, Config.PedLocation.coords)
    TriggerClientEvent('envy_paintball:matchEnded', playerId)
    
    if reason then
        TriggerClientEvent('ESX:Notify', playerId, "error", 5000, reason)
    end
    
    -- If host left waiting match, close it
    if match.host == playerId and match.status == "waiting" then
        EndMatch(matchId, "Host left the match")
        return
    end
    
    -- Notify other players
    for _, pId in ipairs(match.players) do
        TriggerClientEvent('ESX:Notify', pId, "info", 5000, string.format("Player left the match (%d/%d)", #match.players, match.gameMode.maxPlayers))
        if match.host == pId then
            TriggerClientEvent('envy_paintball:matchUpdated', pId, match)
        end
    end
end

function EndMatch(matchId, reason)
    local match = activeMatches[matchId]
    if not match then return end

    -- Store original status before changing it
    local wasActive = match.status == "active"
    match.status = "ended"
    
    -- Remove weapons
    if match.weaponHashes then
        for playerId, weaponHash in pairs(match.weaponHashes) do
            RemovePaintballWeapon(playerId, weaponHash)
        end
        match.weaponHashes = nil
    end

    -- Clear ghosted players for this match
    for _, playerId in ipairs(match.players) do
        ghostedPlayers[playerId] = nil
    end
    
    -- Cleanup all players
    for _, playerId in ipairs(match.players) do
        SetPlayerRoutingBucket(playerId, 0)
        playerMatches[playerId] = nil
        playerCoords[playerId] = nil
        
        -- Only teleport to PED if match was ACTIVE when closed
        if wasActive then
            -- Revive player first (if dead) at current location, then teleport
            local xPlayer = ESX.GetPlayerFromId(playerId)
            if xPlayer then
                -- Get player's current coords for revive
                local playerCoords = GetEntityCoords(GetPlayerPed(playerId))
                local playerHeading = GetEntityHeading(GetPlayerPed(playerId))
                -- Revive player using our custom paintball revive (no screen fades)
                TriggerClientEvent('envy_paintball:revive', playerId, playerCoords, playerHeading)
            end
            
            -- Teleport after revive completes (our custom revive is instant, no fade)
            CreateThread(function()
                Wait(500) -- Brief wait for revive to process
                TriggerClientEvent('envy_paintball:teleportToPed', playerId, Config.PedLocation.coords)
            end)
        end
        
        TriggerClientEvent('envy_paintball:matchEnded', playerId)
        TriggerClientEvent('ESX:Notify', playerId, "info", 5000, string.format("Match ended: %s", reason))
    end

    activeMatches[matchId] = nil
end

-- ============================================================================
-- SERVER CALLBACKS
-- ============================================================================

ESX.RegisterServerCallback('envy_paintball:getMaps', function(source, cb)
    cb(maps)
end)

ESX.RegisterServerCallback('envy_paintball:getMatchData', function(source, cb, matchId)
    local match = activeMatches[matchId]
    if match and match.host == source then
        cb(match)
    else
        cb(nil)
    end
end)

ESX.RegisterServerCallback('envy_paintball:isAdmin', function(source, cb)
    cb(IsAdmin(source))
end)

ESX.RegisterServerCallback('envy_paintball:isOwner', function(source, cb)
    cb(IsOwner(source))
end)

ESX.RegisterServerCallback('envy_paintball:getLicenses', function(source, cb)
    if not IsAdmin(source) then
        cb({})
        return
    end
    
    -- Return licenses in format expected by client
    local licenses = {}
    for _, licenseData in ipairs(allowedLicenses) do
        table.insert(licenses, {
            license = type(licenseData) == "string" and licenseData or licenseData.license,
            cfxName = type(licenseData) == "table" and licenseData.cfxName or nil
        })
    end
    
    cb(licenses)
end)

ESX.RegisterServerCallback('envy_paintball:searchPlayers', function(source, cb, searchTerm)
    if not IsOwner(source) then
        cb({ error = 'Permission denied' })
        return
    end
    
    if not searchTerm or type(searchTerm) ~= 'string' or #searchTerm < 2 then
        cb({ error = 'Search term must be at least 2 characters' })
        return
    end
    
    -- Strip "license:" prefix if present for searching
    local cleanSearchTerm = searchTerm
    if string.find(cleanSearchTerm:lower(), "^license:") then
        cleanSearchTerm = string.sub(cleanSearchTerm, 9) -- Remove "license:" prefix (8 chars + 1 for colon)
    end
    
    -- Also check online players first
    local onlineLicenseMap = {}
    local allPlayers = GetPlayers()
    for _, playerId in ipairs(allPlayers) do
        local identifiers = GetPlayerIdentifiers(playerId)
        local cfxName = GetPlayerName(playerId) -- Get CFX display name
        local licenseIdentifier = nil
        
        if identifiers then
            for _, identifier in ipairs(identifiers) do
                if string.find(identifier, "^license:") then
                    licenseIdentifier = identifier
                    break
                end
            end
        end
        
        if licenseIdentifier then
            -- Check if this license matches the search (only search by license, not CFX name)
            local searchLower = cleanSearchTerm:lower()
            local licensePart = string.sub(licenseIdentifier, 9) -- Remove "license:" prefix
            
            -- Check if search matches license part or full license (case-insensitive)
            local matchesLicense = string.find(licensePart:lower(), searchLower, 1, true) ~= nil or 
                                   string.find(licenseIdentifier:lower(), searchLower, 1, true) ~= nil
            
            if matchesLicense then
                onlineLicenseMap[licenseIdentifier] = {
                    license = licenseIdentifier,
                    cfxName = cfxName or nil,
                    online = true,
                    source = tonumber(playerId)
                }
            end
        end
    end
    
    local searchPattern = '%' .. cleanSearchTerm .. '%'
    local licenseSearchPattern = '%license:' .. cleanSearchTerm .. '%'
    local charLicensePattern = '%:' .. cleanSearchTerm .. '%' -- For char1:license:xxx format
    
    -- Search in database for license identifiers only (not character names)
    MySQL.query(
        'SELECT DISTINCT u.identifier FROM users u WHERE (u.identifier LIKE ? OR u.identifier LIKE ? OR u.identifier LIKE ?) ORDER BY u.identifier LIMIT 100',
        { searchPattern, licenseSearchPattern, charLicensePattern },
        function(result)
            if not result then
                cb({ error = 'Database query failed' })
                return
            end
            
            if #result == 0 then
                cb({ players = {} })
                return
            end
            
            -- Extract unique licenses from identifiers
            local licenseMap = {}
            for i = 1, #result do
                local charIdentifier = result[i].identifier
                if charIdentifier then
                    -- Extract license identifier from character identifier
                    -- Format is typically: char1:license:xxx or char2:license:xxx
                    local licenseIdentifier = nil
                    
                    -- Try to find license part in identifier
                    for part in charIdentifier:gmatch("[^:]+") do
                        if string.find(part, "^license:") then
                            licenseIdentifier = part
                            break
                        end
                    end
                    
                    -- If not found, try direct match
                    if not licenseIdentifier then
                        licenseIdentifier = charIdentifier:match("license:[^:]+")
                    end
                    
                    -- Store unique licenses (CFX name not available for offline players from DB)
                    if licenseIdentifier and not licenseMap[licenseIdentifier] then
                        licenseMap[licenseIdentifier] = {
                            license = licenseIdentifier,
                            cfxName = nil, -- Will be set if player comes online
                            charIdentifiers = {}
                        }
                    end
                    
                    -- Track all character identifiers for this license
                    if licenseIdentifier and licenseMap[licenseIdentifier] then
                        table.insert(licenseMap[licenseIdentifier].charIdentifiers, charIdentifier)
                    end
                end
            end
            
            -- Merge online licenses into the map
            for license, data in pairs(onlineLicenseMap) do
                if not licenseMap[license] then
                    licenseMap[license] = {
                        license = license,
                        cfxName = data.cfxName or string.match(license, "license:(.+)") or license,
                        charIdentifiers = {}
                    }
                end
                licenseMap[license].online = true
                licenseMap[license].source = data.source
                if data.cfxName then
                    licenseMap[license].cfxName = data.cfxName
                end
            end
            
            -- Convert to array and check online status
            local players = {}
            for license, data in pairs(licenseMap) do
                local isOnline = data.online or false
                local onlineSource = data.source or nil
                
                -- If not already marked as online, check if any character with this license is online
                if not isOnline then
                    for _, charIdentifier in ipairs(data.charIdentifiers) do
                        local targetPlayer = ESX.GetPlayerFromIdentifier(charIdentifier)
                        if targetPlayer then
                            isOnline = true
                            onlineSource = targetPlayer.source
                            -- Get actual license and CFX name from online player
                            local playerIdentifiers = GetPlayerIdentifiers(targetPlayer.source)
                            if playerIdentifiers then
                                for _, identifier in ipairs(playerIdentifiers) do
                                    if string.find(identifier, "^license:") then
                                        data.license = identifier
                                        break
                                    end
                                end
                            end
                            -- Get CFX name for this online player
                            data.cfxName = GetPlayerName(targetPlayer.source)
                            break
                        end
                    end
                end
                
                table.insert(players, {
                    license = data.license,
                    cfxName = data.cfxName,
                    online = isOnline,
                    source = onlineSource
                })
            end
            
            -- Sort by license
            table.sort(players, function(a, b)
                return a.license < b.license
            end)
            
            -- Limit to 50 results
            if #players > 50 then
                players = { table.unpack(players, 1, 50) }
            end
            
            cb({ players = players })
        end
    )
end)

ESX.RegisterServerCallback('envy_paintball:getAllActiveMatches', function(source, cb)
    if not IsAdmin(source) then
        cb({})
        return
    end
    
    local matchList = {}
    for matchId, match in pairs(activeMatches) do
        -- Get player details for each player in the match
        local playerDetails = {}
        for _, playerId in ipairs(match.players) do
            local xPlayer = ESX.GetPlayerFromId(playerId)
            if xPlayer then
                table.insert(playerDetails, {
                    id = playerId,
                    name = xPlayer.getName(),
                    identifier = xPlayer.identifier
                })
            end
        end
        
        table.insert(matchList, {
            id = matchId,
            gameMode = match.gameMode.name,
            map = match.map.name,
            players = #match.players,
            maxPlayers = match.gameMode.maxPlayers,
            status = match.status,
            host = match.host,
            bucket = match.bucket,
            playerDetails = playerDetails
        })
    end
    cb(matchList)
end)

ESX.RegisterServerCallback('envy_paintball:getWeapons', function(source, cb)
    local enabledWeapons = {}
    for _, weapon in ipairs(weapons) do
        if weapon.enabled then
            table.insert(enabledWeapons, weapon)
        end
    end
    cb(Config.WeaponCategories, enabledWeapons)
end)

ESX.RegisterServerCallback('envy_paintball:getAllWeapons', function(source, cb)
    local categoriesCopy = {}
    for i, cat in ipairs(Config.WeaponCategories) do
        categoriesCopy[i] = {
            id = cat.id,
            name = cat.name,
            enabled = cat.enabled
        }
    end
    
    local weaponsCopy = {}
    for i, weapon in ipairs(weapons) do
        weaponsCopy[i] = {
            hash = weapon.hash,
            name = weapon.name,
            category = weapon.category,
            enabled = weapon.enabled
        }
    end
    
    cb({
        categories = categoriesCopy,
        weapons = weaponsCopy
    })
end)

ESX.RegisterServerCallback('envy_paintball:getOXItems', function(source, cb)
    local items = {}
    
    if GetResourceState('ox_inventory') == 'started' then
        local success, oxItems = pcall(function()
            return exports.ox_inventory:Items()
        end)
        
        if success and oxItems then
            for itemName, itemData in pairs(oxItems) do
                table.insert(items, {
                    name = itemName,
                    label = itemData.label or itemName,
                    weight = itemData.weight or 0
                })
            end
            
            table.sort(items, function(a, b)
                return (a.label or a.name) < (b.label or b.name)
            end)
        end
    end
    
    cb(items)
end)

ESX.RegisterServerCallback('envy_paintball:getActiveMatches', function(source, cb)
    local matchesList = {}
    for matchId, match in pairs(activeMatches) do
        table.insert(matchesList, {
            id = match.id,
            gameMode = match.gameMode.name,
            gameModeId = match.gameMode.id,
            map = match.map.name,
            mapId = match.map.id,
            players = #match.players,
            maxPlayers = match.gameMode.maxPlayers,
            status = match.status,
            isPrivate = match.isPrivate,
            allowJoinInProgress = match.allowJoinInProgress
        })
    end
    cb(matchesList)
end)

-- ============================================================================
-- NET EVENTS - MATCH MANAGEMENT
-- ============================================================================

RegisterNetEvent('envy_paintball:startMatch', function(gameModeId, mapId, isPrivate, pin)
    local source = source
    local xPlayer = ESX.GetPlayerFromId(source)
    
    if not xPlayer then return end

    -- Validate game mode
    local gameMode = nil
    for _, mode in ipairs(Config.GameModes) do
        if mode.id == gameModeId then
            gameMode = mode
            break
        end
    end

    if not gameMode then
        TriggerClientEvent('envy_paintball:showError', source, "Invalid game mode")
        return
    end

    -- Validate map
    local map = nil
    for _, m in ipairs(maps) do
        if m.id == mapId then
            map = m
            break
        end
    end

    if not map then
        TriggerClientEvent('envy_paintball:showError', source, "Map not found")
        return
    end

    -- Check if player is already in a match
    if IsPlayerInMatch(source) then
        TriggerClientEvent('envy_paintball:showError', source, "You are already in a match!")
        return
    end

    -- Get bucket
    local bucketId = GetBucketForGameMode(gameModeId)
    local matchBucket = FindAvailableBucket(bucketId)

    -- Create match
    local matchId = "match_" .. os.time() .. "_" .. math.random(1000, 9999)
    local match = {
        id = matchId,
        gameMode = gameMode,
        map = map,
        players = {source},
        teams = {},
        startTime = os.time(),
        status = "waiting",
        bucket = matchBucket,
        isPrivate = isPrivate or false,
        pin = pin or nil,
        host = source,
        allowJoinInProgress = Config.AllowJoinInProgress,
        playerWeapons = {},
        playerScores = {}, -- Track individual player scores
        teamScores = {}, -- Track team scores
        deadPlayers = {} -- Track players waiting to respawn
    }

    -- Initialize teams
    if gameMode.teams > 0 then
        for i = 1, gameMode.teams do
            match.teams[i] = {}
        end
        table.insert(match.teams[1], source)
    end

    activeMatches[matchId] = match
    playerMatches[source] = matchId

    TriggerClientEvent('envy_paintball:matchStarted', source, match)
    TriggerClientEvent('ESX:Notify', source, "success", 5000, string.format("Match created! Waiting for players... (%d/%d)", 1, gameMode.maxPlayers))
end)

RegisterNetEvent('envy_paintball:startMatchManual', function(matchId)
    local source = source
    local match = activeMatches[matchId]
    
    if not match then
        TriggerClientEvent('envy_paintball:showError', source, "Match not found")
        return
    end
    
    if match.host ~= source then
        TriggerClientEvent('envy_paintball:showError', source, "You are not the host of this match")
        return
    end
    
    if match.status ~= "waiting" then
        TriggerClientEvent('envy_paintball:showError', source, "Match is not in waiting status")
        return
    end
    
    -- Check minimum players
    local minRequired = match.gameMode.minPlayers
    if Config.AllowSoloTesting and IsAdmin(source) and #match.players >= 1 then
        minRequired = 1
    end
    
    if #match.players < minRequired then
        TriggerClientEvent('envy_paintball:showError', source, string.format("Need at least %d players to start (currently %d)", match.gameMode.minPlayers, #match.players))
        return
    end
    
    StartMatch(matchId)
    TriggerClientEvent('ESX:Notify', source, "success", 5000, "Match started!")
end)

RegisterNetEvent('envy_paintball:closeMatch', function(matchId)
    local source = source
    local match = activeMatches[matchId]
    
    if not match then
        TriggerClientEvent('envy_paintball:showError', source, "Match not found")
        return
    end
    
    if match.host ~= source then
        TriggerClientEvent('envy_paintball:showError', source, "You are not the host of this match")
        return
    end
    
    EndMatch(matchId, "Host closed the match")
    TriggerClientEvent('ESX:Notify', source, "success", 5000, "Match closed successfully")
end)

RegisterNetEvent('envy_paintball:leaveMatch', function()
    local source = source
    local match, matchId = GetPlayerMatch(source)
    
    if not match then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "You are not in a match")
        return
    end
    
    RemovePlayerFromMatch(source, matchId, "You left the match")
    
    if #match.players == 0 then
        EndMatch(matchId, "All players left the match")
    end
end)

RegisterNetEvent('envy_paintball:joinMatch', function(matchId, pin)
    local source = source
    local xPlayer = ESX.GetPlayerFromId(source)
    
    if not xPlayer then return end

    local match = activeMatches[matchId]
    if not match then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Match not found")
        return
    end

    -- Validate PIN
    if match.isPrivate then
        if not pin or pin ~= match.pin then
            TriggerClientEvent('ESX:Notify', source, "error", 5000, "Invalid PIN")
            return
        end
    end

    -- Check if match allows joining in progress
    if match.status == "active" and not match.allowJoinInProgress then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Cannot join match in progress")
        return
    end

    -- Check if already in a match
    if IsPlayerInMatch(source) then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "You are already in a match!")
        return
    end

    -- Check if full
    if #match.players >= match.gameMode.maxPlayers then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Match is full")
        return
    end

    -- Add player
    table.insert(match.players, source)
    playerMatches[source] = matchId
    
    if match.status == "active" then
        SetPlayerRoutingBucket(source, match.bucket)
    end

    -- Add to team
    if match.gameMode.teams > 0 then
        local smallestTeam = 1
        local smallestCount = #match.teams[1]
        for i = 2, match.gameMode.teams do
            if #match.teams[i] < smallestCount then
                smallestTeam = i
                smallestCount = #match.teams[i]
            end
        end
        table.insert(match.teams[smallestTeam], source)
    end
    
    -- Initialize scoring for new player
    if not match.playerScores then
        match.playerScores = {}
    end
    match.playerScores[source] = 0

    -- If match is active, teleport and give weapon
    if match.status == "active" then
        local spawn = GetSpawnPointForPlayer(match, source)
        if not spawn then
            -- Fallback to random spawn
            local spawnIndex = math.random(1, #match.map.spawns)
            spawn = match.map.spawns[spawnIndex]
        end
        TriggerClientEvent('envy_paintball:teleportToSpawn', source, spawn)
        
        local weaponHash = GetValidWeaponHash(source, match)
        
        if not match.weaponHashes then
            match.weaponHashes = {}
        end
        match.weaponHashes[source] = weaponHash
        
        GivePaintballWeapon(source, weaponHash, Config.PaintballAmmo)
    end

    TriggerClientEvent('envy_paintball:matchJoined', source, match)
    TriggerClientEvent('ESX:Notify', source, "success", 5000, string.format("Joined match! (%d/%d)", #match.players, match.gameMode.maxPlayers))
    
    -- Notify host
    if match.host and match.status == "waiting" and #match.players >= match.gameMode.minPlayers then
        TriggerClientEvent('ESX:Notify', match.host, "info", 5000, "You can now start the match!")
        TriggerClientEvent('envy_paintball:matchUpdated', match.host, match)
    end
    
    -- Notify other players
    for _, playerId in ipairs(match.players) do
        if playerId ~= source then
            TriggerClientEvent('ESX:Notify', playerId, "info", 5000, string.format("Player joined! (%d/%d)", #match.players, match.gameMode.maxPlayers))
        end
    end
end)

RegisterNetEvent('envy_paintball:setPlayerWeapon', function(weaponHash)
    local source = source
    weaponHash = tonumber(weaponHash)
    
    if not weaponHash then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Invalid weapon hash")
        return
    end
    
    local match, matchId = GetPlayerMatch(source)
    if not match then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "You are not in a match")
        return
    end
    
    if match.status == "active" then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Cannot change weapon after match has started")
        return
    end
    
    -- Validate weapon
    local isValid, weapon = ValidateWeapon(weaponHash)
    if not isValid then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Invalid or disabled weapon")
        return
    end
    
    -- Store selection
    if not match.playerWeapons then
        match.playerWeapons = {}
    end
    match.playerWeapons[source] = weaponHash
    
    TriggerClientEvent('ESX:Notify', source, "success", 5000, string.format("Selected weapon: %s", weapon.name))
end)

-- ============================================================================
-- NET EVENTS - ADMIN FUNCTIONS
-- ============================================================================

RegisterNetEvent('envy_paintball:saveMap', function(mapData)
    local source = source
    
    if not IsAdmin(source) then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "You don't have permission to save maps")
        return
    end

    -- Validate map data
    if not mapData or type(mapData) ~= 'table' then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Invalid map data")
        return
    end

    if not mapData.name or type(mapData.name) ~= 'string' or #mapData.name == 0 then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Invalid map name")
        return
    end

    if not mapData.center or not mapData.radius or not mapData.spawns then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Missing required map data")
        return
    end

    -- Generate ID if needed
    if not mapData.id then
        mapData.id = "map_" .. os.time() .. "_" .. math.random(1000, 9999)
    end

    -- Convert spawns
    local spawns = {}
    for i, spawn in ipairs(mapData.spawns) do
        if type(spawn) == "vector4" then
            spawns[i] = {
                x = spawn.x,
                y = spawn.y,
                z = spawn.z,
                w = spawn.w or 0.0,
                team = nil
            }
        else
            spawns[i] = {
                x = spawn.x,
                y = spawn.y,
                z = spawn.z,
                w = spawn.w or 0.0,
                team = spawn.team
            }
        end
    end

    local newMap = {
        id = mapData.id,
        name = mapData.name,
        center = type(mapData.center) == "vector3" and mapData.center or vector3(mapData.center.x, mapData.center.y, mapData.center.z),
        radius = mapData.radius,
        spawns = spawns
    }

    -- Update or insert
    local found = false
    for i, map in ipairs(maps) do
        if map.id == newMap.id then
            maps[i] = newMap
            found = true
            break
        end
    end

    if not found then
        table.insert(maps, newMap)
    end

    SaveMaps()
    TriggerClientEvent('ESX:Notify', source, "success", 5000, string.format("Map '%s' saved successfully!", newMap.name))
end)

RegisterNetEvent('envy_paintball:deleteMap', function(mapId)
    local source = source
    
    if not IsAdmin(source) then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "You don't have permission to delete maps")
        return
    end

    -- Validate mapId
    if not mapId or type(mapId) ~= 'string' or #mapId == 0 then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Invalid map ID")
        return
    end

    -- Check if map is being used in any active matches first
    local mapInUse = false
    for matchId, match in pairs(activeMatches) do
        if match.map and match.map.id == mapId then
            mapInUse = true
            break
        end
    end

    if mapInUse then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Cannot delete map: It is currently being used in an active match")
        return
    end

    -- Find and remove the map
    local mapFound = false
    local mapName = ""
    for i, map in ipairs(maps) do
        if map.id == mapId then
            mapName = map.name
            table.remove(maps, i)
            mapFound = true
            break
        end
    end

    if not mapFound then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Map not found")
        return
    end

    SaveMaps()
    TriggerClientEvent('ESX:Notify', source, "success", 5000, string.format("Map '%s' deleted successfully!", mapName))
end)

RegisterNetEvent('envy_paintball:adminCloseMatch', function(matchId)
    local source = source
    
    if not IsAdmin(source) then
        TriggerClientEvent('envy_paintball:showError', source, "You don't have permission to close matches")
        return
    end
    
    local match = activeMatches[matchId]
    if not match then
        TriggerClientEvent('envy_paintball:showError', source, "Match not found")
        return
    end
    
    EndMatch(matchId, "Match closed by administrator")
    -- Removed duplicate notification - EndMatch already notifies all players including admin if they're in the match
end)

RegisterNetEvent('envy_paintball:updateWeaponConfig', function(type, id, enabled)
    local source = source
    
    if not IsAdmin(source) then
        TriggerClientEvent('envy_paintball:showError', source, "You don't have permission to modify weapon config")
        return
    end

    if type == 'weapon' then
        for i, weapon in ipairs(weapons) do
            if weapon.hash == id then
                weapons[i].enabled = enabled
                SaveWeaponConfig()
                TriggerClientEvent('ESX:Notify', source, "success", 3000, string.format("Weapon %s %s", weapon.name, enabled and "enabled" or "disabled"))
                TriggerClientEvent('envy_paintball:weaponConfigUpdated', source)
                break
            end
        end
    end
end)

RegisterNetEvent('envy_paintball:removeWeapon', function(hash)
    local source = source
    
    if not IsAdmin(source) then
        TriggerClientEvent('envy_paintball:showError', source, "You don't have permission to remove weapons")
        return
    end

    local weaponHash
    if type(hash) == "string" then
        weaponHash = GetHashKey(hash)
        if weaponHash == 0 and not hash:match("^WEAPON_") then
            weaponHash = GetHashKey("WEAPON_" .. hash)
        end
    else
        weaponHash = hash
    end

    local weaponFound = false
    local weaponName = ""
    for i, weapon in ipairs(weapons) do
        if weapon.hash == weaponHash then
            weaponName = weapon.name
            table.remove(weapons, i)
            weaponFound = true
            break
        end
    end

    if not weaponFound then
        TriggerClientEvent('envy_paintball:showError', source, "Weapon not found")
        return
    end
    
    SaveWeaponConfig()
    TriggerClientEvent('ESX:Notify', source, "success", 5000, string.format("Weapon '%s' removed", weaponName))
end)

RegisterNetEvent('envy_paintball:addLicense', function(licenseData)
    local source = source
    
    if not IsOwner(source) then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "You don't have permission to manage licenses")
        return
    end
    
    -- Handle both old format (string) and new format (object)
    local license = nil
    local cfxName = nil
    if type(licenseData) == "string" then
        license = licenseData
    elseif type(licenseData) == "table" then
        license = licenseData.license
        cfxName = licenseData.cfxName
    end
    
    -- Validate license format
    if not license or type(license) ~= 'string' or not string.find(license, "license:") then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "Invalid license format. Must start with 'license:'")
        return
    end
    
    -- Check if already exists
    for _, existingLicenseData in ipairs(allowedLicenses) do
        local existingLicense = type(existingLicenseData) == "string" and existingLicenseData or existingLicenseData.license
        if existingLicense == license then
            TriggerClientEvent('ESX:Notify', source, "error", 5000, "License already exists in the list")
            return
        end
    end
    
    -- If CFX name not provided, try to get it from online players
    if not cfxName then
        local allPlayers = GetPlayers()
        for _, playerId in ipairs(allPlayers) do
            local identifiers = GetPlayerIdentifiers(playerId)
            if identifiers then
                for _, identifier in ipairs(identifiers) do
                    if identifier == license then
                        cfxName = GetPlayerName(playerId)
                        break
                    end
                end
            end
            if cfxName then break end
        end
    end
    
    -- Add license with CFX name
    table.insert(allowedLicenses, {
        license = license,
        cfxName = cfxName
    })
    SaveLicenses()
    TriggerClientEvent('ESX:Notify', source, "success", 5000, "License added successfully")
    -- Trigger dashboard refresh
    TriggerClientEvent('envy_paintball:refreshDashboard', source)
end)

RegisterNetEvent('envy_paintball:removeLicense', function(license)
    local source = source
    
    if not IsOwner(source) then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "You don't have permission to manage licenses")
        return
    end
    
    -- Find and remove license
    local found = false
    for i, existingLicenseData in ipairs(allowedLicenses) do
        local existingLicense = type(existingLicenseData) == "string" and existingLicenseData or existingLicenseData.license
        if existingLicense == license then
            table.remove(allowedLicenses, i)
            found = true
            break
        end
    end
    
    if not found then
        TriggerClientEvent('ESX:Notify', source, "error", 5000, "License not found in the list")
        return
    end
    
    SaveLicenses()
    TriggerClientEvent('ESX:Notify', source, "success", 5000, "License removed successfully")
end)

RegisterNetEvent('envy_paintball:addWeapon', function(hash, name, category)
    local source = source
    
    if not IsAdmin(source) then
        TriggerClientEvent('envy_paintball:showError', source, "You don't have permission to add weapons")
        return
    end

    -- Validate category
    local categoryExists = false
    for _, cat in ipairs(Config.WeaponCategories) do
        if cat.id == category then
            categoryExists = true
            break
        end
    end

    if not categoryExists then
        TriggerClientEvent('envy_paintball:showError', source, "Invalid category")
        return
    end

    -- Convert hash
    local weaponHash
    if type(hash) == "string" then
        weaponHash = GetHashKey(hash)
        if weaponHash == 0 and not hash:match("^WEAPON_") then
            weaponHash = GetHashKey("WEAPON_" .. hash)
        end
    else
        weaponHash = hash
    end

    if weaponHash == 0 then
        TriggerClientEvent('envy_paintball:showError', source, "Invalid weapon hash")
        return
    end

    -- Check if exists
    for _, weapon in ipairs(weapons) do
        if weapon.hash == weaponHash then
            TriggerClientEvent('envy_paintball:showError', source, "Weapon already exists")
            return
        end
    end

    table.insert(weapons, {
        hash = weaponHash,
        name = name,
        category = category,
        enabled = true
    })
    
    SaveWeaponConfig()
    TriggerClientEvent('ESX:Notify', source, "success", 5000, string.format("Weapon '%s' added", name))
    TriggerClientEvent('envy_paintball:weaponConfigUpdated', source)
end)

-- ============================================================================
-- DISTANCE VALIDATION (Server-Side)
-- ============================================================================

-- Server-side distance checking for waiting matches
RegisterNetEvent('envy_paintball:updatePlayerCoords', function(coords)
    local source = source
    if not coords or type(coords) ~= 'table' then return end
    
    playerCoords[source] = {
        x = tonumber(coords.x) or 0,
        y = tonumber(coords.y) or 0,
        z = tonumber(coords.z) or 0
    }
end)

CreateThread(function()
    while true do
        Wait(5000) -- Check every 5 seconds
        
        local pedCoords = Config.PedLocation.coords
        
        for playerId, matchId in pairs(playerMatches) do
            local match = activeMatches[matchId]
            if match and match.status == "waiting" then
                local playerPos = playerCoords[playerId]
                if playerPos then
                    local distance = #(vector3(playerPos.x, playerPos.y, playerPos.z) - vector3(pedCoords.x, pedCoords.y, pedCoords.z))
                    
                    if distance > Config.MaxDistanceFromPed then
                        if match.host == playerId then
                            EndMatch(matchId, "Host went too far from the paintball area")
                            -- Removed duplicate notification - EndMatch already notifies the player
                        else
                            RemovePlayerFromMatch(playerId, matchId, "You went too far from the paintball area. You have been removed from the match.")
                        end
                    end
                end
            end
        end
    end
end)

-- Check win conditions
local function CheckWinCondition(match)
    local gameModeId = match.gameMode.id
    
    -- FFA: Check if any player reached score limit
    if gameModeId == "ffa" then
        for playerId, score in pairs(match.playerScores) do
            if score >= Config.ScoreLimitFFA then
                return true, playerId, nil
            end
        end
    -- TDM: Check if any team reached score limit
    elseif gameModeId == "tdm" then
        for teamNum, score in pairs(match.teamScores) do
            if score >= Config.ScoreLimitTDM then
                return true, nil, teamNum
            end
        end
    -- 1v1 and 2v2: Check if any player reached score limit
    elseif gameModeId == "1v1_ramps" or gameModeId == "2v2_ramps" then
        for playerId, score in pairs(match.playerScores) do
            if score >= Config.ScoreLimit1v1 then
                return true, playerId, nil
            end
        end
    end
    
    return false, nil, nil
end

-- ============================================================================
-- KILL REWARDS AND SCORING
-- ============================================================================

RegisterNetEvent('esx:onPlayerDeath', function(data)
    local victimId = source
    local killerServerId = data.killerServerId
    
    if not data.killedByPlayer or not killerServerId then return end
    
    local victimMatchId = playerMatches[victimId]
    if not victimMatchId then return end
    
    local killerMatchId = playerMatches[killerServerId]
    if not killerMatchId or killerMatchId ~= victimMatchId then return end
    
    local match = activeMatches[victimMatchId]
    if not match or match.status ~= "active" then return end
    
    -- Check if killer is on opposing team (for TDM)
    local killerTeam = GetPlayerTeam(match, killerServerId)
    local victimTeam = GetPlayerTeam(match, victimId)
    
    -- In TDM, only award points if killer is on opposing team
    if match.gameMode.id == "tdm" then
        if killerTeam == victimTeam or not killerTeam or not victimTeam then
            -- Same team or invalid teams, don't award points
            -- Still respawn the victim
            match.deadPlayers[victimId] = true
            CreateThread(function()
                Wait(Config.RespawnDelay * 1000)
                if match and match.status == "active" and match.deadPlayers[victimId] then
                    RespawnPlayer(match, victimId)
                end
            end)
            return
        end
    end
    
    -- Award points
    local gameModeId = match.gameMode.id
    
    if gameModeId == "ffa" then
        -- FFA: Award point to killer
        if not match.playerScores[killerServerId] then
            match.playerScores[killerServerId] = 0
        end
        match.playerScores[killerServerId] = match.playerScores[killerServerId] + Config.PointsPerKill
        
        -- Notify players
        local xPlayer = ESX.GetPlayerFromId(killerServerId)
        local killerName = xPlayer and xPlayer.getName() or "Unknown"
        for _, playerId in ipairs(match.players) do
            TriggerClientEvent('ESX:Notify', playerId, "info", 3000, string.format("%s scored! (%d/%d)", killerName, match.playerScores[killerServerId], Config.ScoreLimitFFA))
        end
        
    elseif gameModeId == "tdm" then
        -- TDM: Award point to killer's team
        if killerTeam then
            if not match.teamScores[killerTeam] then
                match.teamScores[killerTeam] = 0
            end
            match.teamScores[killerTeam] = match.teamScores[killerTeam] + Config.PointsPerKill
            
            -- Notify players
            for _, playerId in ipairs(match.players) do
                local team1Score = match.teamScores[1] or 0
                local team2Score = match.teamScores[2] or 0
                TriggerClientEvent('ESX:Notify', playerId, "info", 3000, string.format("Team %d scored! (%d - %d)", killerTeam, team1Score, team2Score))
            end
        end
        
    elseif gameModeId == "1v1_ramps" or gameModeId == "2v2_ramps" then
        -- 1v1/2v2: Award point to killer
        if not match.playerScores[killerServerId] then
            match.playerScores[killerServerId] = 0
        end
        match.playerScores[killerServerId] = match.playerScores[killerServerId] + Config.PointsPerKill
        
        -- Notify players
        local xPlayer = ESX.GetPlayerFromId(killerServerId)
        local killerName = xPlayer and xPlayer.getName() or "Unknown"
        for _, playerId in ipairs(match.players) do
            TriggerClientEvent('ESX:Notify', playerId, "info", 3000, string.format("%s scored! (%d/%d)", killerName, match.playerScores[killerServerId], Config.ScoreLimit1v1))
        end
    end
    
    -- Reward ammo
    if match.weaponHashes and match.weaponHashes[killerServerId] then
        local weaponHash = match.weaponHashes[killerServerId]
        TriggerClientEvent('envy_paintball:rewardAmmoForKill', killerServerId, weaponHash, Config.AmmoPerKill)
    end
    
    -- Mark victim as dead and schedule respawn
    match.deadPlayers[victimId] = true
    
    CreateThread(function()
        Wait(Config.RespawnDelay * 1000)
        if match and match.status == "active" and match.deadPlayers[victimId] then
            RespawnPlayer(match, victimId)
        end
    end)
    
    -- Check win condition
    local hasWon, winnerPlayerId, winnerTeam = CheckWinCondition(match)
    if hasWon then
        if winnerPlayerId then
            local xPlayer = ESX.GetPlayerFromId(winnerPlayerId)
            local winnerName = xPlayer and xPlayer.getName() or "Unknown"
            EndMatch(victimMatchId, string.format("%s won with %d points!", winnerName, match.playerScores[winnerPlayerId]))
        elseif winnerTeam then
            EndMatch(victimMatchId, string.format("Team %d won with %d points!", winnerTeam, match.teamScores[winnerTeam]))
        end
    end
end)

-- Respawn player function
function RespawnPlayer(match, playerId)
    if not match or match.status ~= "active" then return end
    if not match.deadPlayers[playerId] then return end
    
    -- Get spawn point
    local spawn = GetSpawnPointForPlayer(match, playerId)
    if not spawn then
        -- Fallback to random spawn
        if match.map.spawns and #match.map.spawns > 0 then
            spawn = match.map.spawns[math.random(1, #match.map.spawns)]
        else
            return
        end
    end
    
    -- Remove from dead players
    match.deadPlayers[playerId] = nil
    
    -- Respawn player
    TriggerClientEvent('envy_paintball:respawnPlayer', playerId, spawn)
    
    -- Mark player as ghosted on server
    ghostedPlayers[playerId] = true
    
    -- Enable spawn protection ghosting for all players in match (wait a moment for respawn to process)
    CreateThread(function()
        Wait(500) -- Wait for respawn to fully process
        -- Send updated ghost list to all players in match
        for _, otherPlayerId in ipairs(match.players) do
            TriggerClientEvent('envy_paintball:updateGhostedPlayers', otherPlayerId, ghostedPlayers)
        end
    end)
    
    -- Give weapon back (wait a moment for client to process respawn)
    CreateThread(function()
        Wait(500)
        if match and match.status == "active" and match.weaponHashes and match.weaponHashes[playerId] then
            local weaponHash = match.weaponHashes[playerId]
            GivePaintballWeapon(playerId, weaponHash, Config.PaintballAmmo)
        end
    end)
end

-- Handle spawn protection ending
RegisterNetEvent('envy_paintball:spawnProtectionEnded', function()
    local source = source
    local match, matchId = GetPlayerMatch(source)
    if not match or match.status ~= "active" then return end
    
    -- Remove player from ghosted list
    ghostedPlayers[source] = nil
    
    -- Send updated ghost list to all players in match
    for _, playerId in ipairs(match.players) do
        TriggerClientEvent('envy_paintball:updateGhostedPlayers', playerId, ghostedPlayers)
    end
end)

-- ============================================================================
-- COMMANDS
-- ============================================================================

-- ============================================================================
-- CLEANUP ON DISCONNECT
-- ============================================================================

AddEventHandler('playerDropped', function(reason)
    local playerId = source
    
    local match, matchId = GetPlayerMatch(playerId)
    if match then
        RemovePlayerFromMatch(playerId, matchId, "Player disconnected")
        
        if #match.players == 0 then
            EndMatch(matchId, "All players disconnected")
        end
    end
    
    playerMatches[playerId] = nil
    playerCoords[playerId] = nil
end)

-- ============================================================================
-- INITIALIZATION
-- ============================================================================

CreateThread(function()
    LoadWeaponConfig()
end)

CreateThread(function()
    LoadMaps()
end)

CreateThread(function()
    LoadLicenses()
end)
