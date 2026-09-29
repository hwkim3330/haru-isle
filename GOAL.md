# 하루섬 — goal and status

An original cozy island-life sim in the browser (genre homage; no Nintendo names, characters,
art or music). Everything is generated in code: terrain, models, faces, icons, music.

## Pillars (done = checked)
1. [ ] Island generator: seeded coast + beach, 3 tiers with rounded cliffs, rivers with forks
       and waterfalls, ponds, ramps/bridges so every tile is reachable, plots for buildings.
2. [ ] Look: toon shading, curved "rolling log" world, seasonal grass, day/night sky, weather.
3. [ ] Player: walk/run, act on the tile in front; tools (shovel, axe, net, rod, can,
       slingshot, ladder, pole); pockets; drop/place/pick up.
4. [ ] Nature: trees (fruit/cedar/palm/hardwood) shake/chop/regrow, rocks (materials, money
       rock), flowers + breeding, weeds, shells, dig spots/fossils, planting.
5. [ ] Critters: fish shadows by place/month/hour, bite timing; bugs by place/month/hour,
       sneak up; 40+ each; critter guide.
6. [ ] Neighbours: generated animals (species, colours, eyes, clothes, personality, name,
       catchphrase), houses, daily schedule, activities, generated dialogue, gifts, requests,
       friendship, move-ins from the campsite.
7. [ ] Economy: shop (daily stock, sell), museum (donate), crafting bench + recipes, house
       interior with furniture placement, catalogue of every item.
8. [ ] Multiplayer: host's island, friends join by code (PeerJS), host-authoritative world,
       up to 8, emotes/chat, heartbeat.
9. [ ] Audio: hourly generative music, babble voices, SFX. Save/load, Korean UI, touch.
10. [ ] Deploy: GitHub Pages + HF static Space. README.

## Testing
`pnpm dev` (port 5471), `node tools/*.mjs` headless GPU shots (tools/gpu.mjs).
Time override: `?t=2026-04-05T14:30`. Seed: `?seed=123`.
