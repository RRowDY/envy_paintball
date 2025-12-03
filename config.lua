Config = {}

-- PED Configuration
Config.PedLocation = {
    coords = vector4(186.646149, -858.171448, 31.318726, 136.062988), -- Change these coordinates to where you want the PED
    model = `a_m_m_hasjew_01`, -- SWAT model, change if desired
    scenario = "WORLD_HUMAN_CLIPBOARD" -- Animation scenario
}

-- Interaction Settings
Config.InteractionDistance = 2.5 -- Distance to interact with PED
Config.InteractionKey = 38 -- E key
Config.MaxDistanceFromPed = 35 -- Maximum distance from PED before being removed from match (in meters)

-- Game Modes
Config.GameModes = {
    {
        name = "1v1 Ramps",
        id = "1v1_ramps",
        minPlayers = 2,
        maxPlayers = 2,
        teams = 2,
        playersPerTeam = 1
    },
    {
        name = "2v2 Ramps",
        id = "2v2_ramps",
        minPlayers = 4,
        maxPlayers = 4,
        teams = 2,
        playersPerTeam = 2
    },
    {
        name = "Team Deathmatch",
        id = "tdm",
        minPlayers = 4,
        maxPlayers = 16,
        teams = 2,
        playersPerTeam = nil -- Dynamic team sizes
    },
    {
        name = "Free For All",
        id = "ffa",
        minPlayers = 2,
        maxPlayers = 16,
        teams = 0, -- No teams
        playersPerTeam = nil
    }
}

-- Paintball Weapons Configuration
-- Categories are defined here (read-only)
-- Weapons are managed in-game via /paintball_weapons command

Config.WeaponCategories = {
    { id = "pistols", name = "Pistols", enabled = true },
    { id = "smgs", name = "SMGs", enabled = true },
    { id = "rifles", name = "Rifles", enabled = true }
}

Config.DefaultWeapon = `WEAPON_SPECIALCARBINE` -- Default weapon if none selected
Config.PaintballAmmo = 250 -- Starting ammo for paintball matches
Config.AmmoPerKill = 30 -- Ammo gained per kill
Config.MaxAmmo = 500 -- Maximum ammo cap

-- Match Settings
Config.MatchDuration = 600 -- 10 minutes in seconds
Config.RespawnTime = 5 -- Seconds to respawn
Config.KillLimit = 20 -- Kill limit for TDM/FFA
Config.MatchWaitTime = 30 -- Seconds to wait for players before starting
Config.AllowJoinInProgress = false -- Allow joining matches that are already in progress
Config.BaseBucket = 10000 -- Starting bucket ID for matches
Config.BucketIncrement = 1000 -- Increment per game mode

-- Map Editor Settings (Admin only)
Config.AdminGroups = {"admin", "owner"} -- ESX job groups that can use map editor
Config.MapEditorKey = 74 -- H key to toggle map editor

-- Testing Settings
Config.AllowSoloTesting = true -- Allow admins to start matches with just themselves (bypasses minPlayers requirement)

-- Debug Settings
Config.ShowSpawnPoints = true -- Show spawn points when in a match (for debugging)

-- Maps will be stored in maps.lua
-- Each map has: name, center, radius, spawns (array of vector4 coords)

