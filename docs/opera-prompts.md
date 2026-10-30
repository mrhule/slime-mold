# Doom sting prompts for Gemini

The intro, "The Kingdom Underneath", sets the tone: a mock-heroic epic about a mold on the forest
floor, with a dramatic narrator over a big orchestra and choir. These prompts are for short
**stings**. Four are doom stings, played at random when the player is close to losing a level (few
cells left, or the map control collapsing). One, the rally, plays the first time
the player's mold touches an enemy mold.

The main voice is a **dramatic spoken-word narrator**, not a singer. The orchestra and a wordless or
chanting choir swell underneath and around the words. Every word should be easy to hear.

Paste the **style block** at the start of every prompt.

## Style block (prepend to every prompt)

> A dramatic spoken-word piece in the style of an epic movie-trailer or Shakespearean narrator,
> performed with total, deadly seriousness about something ridiculous: a mold dying on a forest floor.
> One deep, rich, theatrical male or female voice speaking (not singing) every line slowly and
> clearly, with long pauses and big emotional shifts from a hushed whisper to a booming shout. Under
> the voice, a full cinematic orchestra and a large choir singing long "ahh" and "ooh" notes, with
> timpani, low brass and strings that swell on the important words and fall silent in the pauses.
> Same epic, over-the-top fantasy mood as a grand film score. The words must be easy to make out.
> No singing of the words, no rap, no applause, no sound effects, no modern instruments.

## Length and ending rule (for every sting)

> About 12 to 18 seconds long. End on a final held orchestral and choir chord that fades out
> completely, with no abrupt cut and no trailing silence longer than half a second, so it can be
> dropped into the game and faded under the music.

## 1. The fading light, played when the player is losing (doom-fading.mp3)

> [style block] Slow and hushed, low strings and a distant choir. The narrator, mournful: "The veins
> grow thin... the light grows dim... and still, the mold endures." A long pause, one soft timpani
> beat, then barely a whisper: "But for how long?" The choir holds a single fragile note. [length rule]

## 2. The last stand, played when the player makes an advance but the AI pushes them back (doom-stand.mp3)

> [style block] Marching drums, building brass and a rising choir. The narrator, defiant, growing
> louder with each line: "They have taken our fields. They have taken our roots. But they will NOT
> take... THE KINGDOM." A huge orchestral and choir hit on the last two words, then a ringing
> final chord. [length rule]

## 3. The doomed observer (doom-observer.mp3)

> [style block] A nature-documentary narrator who has become far too emotional, over soft strings
> that gradually turn dark and heavy: "And here, in the shadow of the great snail, the mold faces its
> final hour. Brave. Foolish. Doomed." A tiny pause. "...Mostly foolish." A low brass sigh and a
> sad, quiet choir chord. [length rule]

## 4. The rallying cry, played at first contact with an enemy mold (doom-rally.mp3)

> [style block] This one is triumphant, not doomed: the tide has turned. A commander's voice
> addressing the troops over rolling drums, bright rising brass and a swelling, heroic choir:
> "Mold! The tide has turned! The leaves tremble! The snails retreat! Spread! Spread, and the whole
> forest floor shall be OURS!" Building to a shout, then a bright, victorious final chord with a
> brass flourish. Major key, hopeful and thrilling, not sad. [length rule]

## 5. The prophecy (doom-prophecy.mp3)

> [style block] A slow, ancient, hollow voice over deep drones, low organ and a whispering choir:
> "It was foretold... that one day the forest would rise against us. Rock. Twig. Snail. They come
> for the mold. They come... for YOU." A sudden loud orchestral stab on "you", then a long
> ominous fade. [length rule]

## 6. Round 2 first contact, the rivals remember (rally-round2.mp3)

Plays instead of the rally the first time the molds meet in round 2 (and later rounds, if you want
it to keep). It answers "The Spores Remember", the song that opens the round: the mold remembers,
and so do the rivals. Same triumphant major key as the rally, but with a knowing, wary edge.

> [style block] A veteran commander, calm and a little amused, over low rolling drums, steady brass
> and a rising choir. Not a surprise this time: the narrator has seen all this before. "They
> remember too, little mold... the rivals have grown. But so... have we." A short pause and one
> timpani beat, then louder and building: "Spread! Spread, and let them REMEMBER... the weight of
> the mold!" A big brass flourish and a bright, victorious final chord. Major key, confident and
> thrilling, with a hint of mischief, not sad. [length rule]

Variation if the first take is too close to the rally: ask Gemini to start with a hushed line,
"The spores remember... and so do the rivals", before the drums come in.

## Tips

- If Gemini starts singing the words, add "spoken word only, the voice never sings".
- If the words are hard to hear, add "voice clear and in front, orchestra quieter under it".
- If it does not feel like the intro, paste the intro's original prompt and lyrics at the top of
  this one and say "same style, voice and orchestra as the previous piece".
- Keep the rally clearly joyful and major-key so it never sounds like the doom stings. Give the
  others different moods (sad, defiant, comic, ominous) so the random picks feel
  distinct.
- Ask for 4 or 5 takes of each and keep the best, as vocals vary a lot between generations.
- Keep every sting at a similar loudness so none of them jumps out of the mix. Normalise them to the
  same level after generating.
- Export as mp3 or ogg and put them in `public/operas/` next to the intro as `doom-fading.mp3`,
  `doom-stand.mp3`, `doom-observer.mp3`, `doom-rally.mp3`, `doom-prophecy.mp3` and `rally-round2.mp3`.
