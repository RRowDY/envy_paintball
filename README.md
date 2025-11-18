# Envy Paintball

A comprehensive paintball game mode resource for FiveM with multiple game modes and an in-game map editor.

## Features

- **Multiple Game Modes:**
  - 1v1 Ramps
  - 2v2 Ramps
  - Team Deathmatch
  - Free For All

- **Interactive PED System:**
  - Approach the PED and press E to open the game mode selection menu
  - Select your preferred game mode and map

- **In-Game Map Editor:**
  - Visual map creation tool for admins
  - Define spawn points, center point, and radius
  - Real-time visualization of map boundaries

## Installation

1. Ensure the resource is in `resources/[envy]/envy_paintball/`
2. Add to your `server.cfg`:
   ```
   ensure envy_paintball
   ```

## Configuration

Edit `config.lua` to customize:

- **PED Location:** Set the coordinates where the paintball PED will spawn
- **Game Modes:** Modify game mode settings (player limits, teams, etc.)
- **Admin Groups:** Configure which ESX groups can use the map editor
- **Weapon:** Change the paintball weapon (default: snowball)

### Setting PED Location

In `config.lua`, update:
```lua
Config.PedLocation = {
    coords = vector4(x, y, z, heading), -- Your desired coordinates
    model = `s_m_y_swat_01`,
    scenario = "WORLD_HUMAN_CLIPBOARD"
}
```

## Usage

### For Players

1. Approach the paintball PED
2. Press **E** when prompted
3. Select a game mode from the menu
4. Choose a map
5. Wait for the match to start

### For Admins - Map Editor

1. Use the command: `/paintball_editor` to open the map editor
2. **Freecam Controls:**
   - **W/A/S/D** - Move forward/left/backward/right
   - **Space** - Move up
   - **Ctrl** - Move down
   - **Shift** - Move faster (3x speed)
   - **Mouse** - Look around
   - **F5** - Open/Close menu

3. **Menu Options:**
   - **Set Center Point** - Sets the center of the map at your current camera position
   - **Add Spawn Point** - Adds a spawn point (with team selection for team game modes)
   - **Set Radius** - Set the map boundary radius in meters
   - **Clear Map** - Clears all map data (with confirmation)
   - **Save Map** - Saves the current map (prompts for name)
   - **Leave Editor** - Exits the map editor and returns you to your original position

4. **Map Editor Tips:**
   - Green marker = Center point
   - Yellow circle markers = Radius boundary
   - Blue/Red markers = Spawn points (Red = Team 1, Blue = Team 2 or FFA)
   - You'll be put in freecam mode automatically
   - Use the menu (F5) to perform all actions - much more intuitive!
   - Make sure to set a center point and add at least one spawn before saving

## Map Structure

Maps are stored in `maps.lua` and have the following structure:
```lua
{
    id = "unique_map_id",
    name = "Map Name",
    center = vector3(x, y, z),
    radius = 50.0, -- Radius in meters
    spawns = {
        {x = x, y = y, z = z, w = heading, team = 1}, -- Team spawn (optional team field)
        {x = x, y = y, z = z, w = heading}, -- FFA spawn (no team field)
        -- More spawn points...
    }
}
```

**Note:** The `team` field in spawns is optional. If present, it assigns the spawn to a specific team (1 or 2) for team-based game modes. If omitted, the spawn is available for all players (FFA).

## Dependencies

- ESX Framework
- oxmysql
- esx_notify (for notifications)
- esx_menu_default (for menus)

## Notes

- The default paintball weapon is set to snowball (`WEAPON_SNOWBALL`). You can change this in `config.lua` if you have a custom paintball weapon.
- Maps are automatically saved to `maps.lua` when created through the editor.
- The match system is simplified - you may want to expand it with lobby systems, player joining, etc.

## Support

For issues or questions, check the resource configuration and ensure all dependencies are properly installed.

# envy_paintball
# envy_paintball
